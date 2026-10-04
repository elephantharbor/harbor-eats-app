/**
 * Import catalog artifacts into an isolated staging sqlite file.
 * Refuses production. Does not edit v1.json.
 *
 *   node scripts/import-catalog.mjs --target staging --sqlite tmp/catalog-staging.sqlite
 */
import { createHash } from "node:crypto";
import { readdir, readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { FACTORY_CONTRACT, assertStagingTarget, normalizeFactoryPackage, normalizeLegacyPackage, planImport } from "../src/lib/catalog-import.js";
import { LEGACY_CONTRACT } from "../src/lib/catalog-legacy.js";
import { applyCatalogWrites, loadExistingVersions } from "../src/lib/catalog-write.js";

const PRODUCTION_D1_ID = "23aa3db3-1090-471b-8c8a-b6fe71f5c053";
const args = process.argv.slice(2);

function flag(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || "";
}

const target = flag("--target");
const sqlitePath = flag("--sqlite");
const databaseId = flag("--database-id");
const gate = assertStagingTarget(target, databaseId);
if (!gate.ok) {
  console.error(gate.detail || gate.error);
  process.exit(1);
}
if (!sqlitePath) {
  console.error("Pass --sqlite <file>. This script does not open production D1.");
  process.exit(1);
}
if (sqlitePath.includes(PRODUCTION_D1_ID)) {
  console.error("Refusing a sqlite path that names the production D1 id.");
  process.exit(1);
}

const catalogRoot = join(process.cwd(), "catalog");
const entries = (await readdir(catalogRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
/** @type {object[]} */
const records = [];
/** @type {object[]} */
const failures = [];

for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  const dir = join(catalogRoot, entry.name);
  const file = join(dir, "v1.json");
  let pkg;
  try {
    pkg = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    failures.push({ slug: entry.name, errors: [{ code: "unreadable_package", detail: String(error.message || error) }] });
    continue;
  }
  const names = await readdir(dir);
  let freezeIntegrity = "not_in_package";
  let freezeDetail = null;
  if (names.includes("FREEZE_INTEGRITY.json")) {
    const freeze = JSON.parse(await readFile(join(dir, "FREEZE_INTEGRITY.json"), "utf8"));
    freezeIntegrity = freeze.FREEZE_INTEGRITY || "present";
    freezeDetail = `fail_count=${freeze.fail_count}`;
  } else if (names.includes("FREEZE.txt")) {
    const text = await readFile(join(dir, "FREEZE.txt"), "utf8");
    freezeIntegrity = /awaiting/i.test(text) ? "awaiting_reaudit" : "present";
    freezeDetail = text.split("\n")[0];
  }
  let readmeDeclares = false;
  if (names.includes("README.md")) {
    const readme = await readFile(join(dir, "README.md"), "utf8");
    readmeDeclares = /not certified/i.test(readme);
  }
  const source = {
    source_path: `catalog/${entry.name}/v1.json`,
    freeze_integrity: freezeIntegrity,
    freeze_detail: freezeDetail,
    readme_declares_not_certified: readmeDeclares,
  };
  let normalized;
  if (pkg.catalog_contract === FACTORY_CONTRACT) {
    if (pkg.dish?.slug !== entry.name || pkg.dish?.dish_id !== entry.name) {
      failures.push({ slug: entry.name, errors: [{ code: "directory_slug_mismatch", detail: entry.name }] });
      continue;
    }
    normalized = normalizeFactoryPackage(pkg, source, { publicationStatus: "published" });
  } else if (pkg.catalog_contract === LEGACY_CONTRACT) {
    if (pkg.dish?.slug !== entry.name) {
      failures.push({ slug: entry.name, errors: [{ code: "directory_slug_mismatch", detail: entry.name }] });
      continue;
    }
    normalized = normalizeLegacyPackage(pkg, source);
  } else {
    failures.push({ slug: entry.name, errors: [{ code: "unknown_contract", detail: pkg.catalog_contract || null }] });
    continue;
  }
  if (!normalized.ok) failures.push({ slug: entry.name, errors: normalized.errors });
  else records.push(normalized.record);
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, imported: false, failures }, null, 2));
  process.exit(1);
}

await mkdir(dirname(sqlitePath), { recursive: true });
const db = new DatabaseSync(sqlitePath);
db.exec("PRAGMA foreign_keys = ON;");
db.exec("CREATE TABLE IF NOT EXISTS catalog_import_migration (name TEXT PRIMARY KEY);");
const migrationDir = join(process.cwd(), "migrations");
const migrations = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
for (const name of migrations) {
  const seen = db.prepare("SELECT name FROM catalog_import_migration WHERE name = ?").get(name);
  if (seen) continue;
  const sql = await readFile(join(migrationDir, name), "utf8");
  db.exec(sql);
  db.prepare("INSERT INTO catalog_import_migration (name) VALUES (?)").run(name);
}

const shim = sqliteShim(db);
const existing = await loadExistingVersions(shim);
const plan = planImport(existing, records);
if (!plan.ok) {
  console.error(JSON.stringify({ ok: false, imported: false, errors: plan.errors }, null, 2));
  process.exit(1);
}
const before = db.prepare("SELECT COUNT(*) AS c FROM catalog_version").get().c;
await applyCatalogWrites(shim, plan.writes, "2026-10-04T00:00:00.000Z");
const after = db.prepare("SELECT COUNT(*) AS c FROM catalog_version").get().c;
const published = db
  .prepare(
    `SELECT COUNT(*) AS c FROM catalog_version
      WHERE publication_status = 'published' AND visibility = 'global' AND household_id IS NULL`
  )
  .get().c;
const factory = db
  .prepare(`SELECT COUNT(*) AS c FROM catalog_provenance WHERE factory_certified = 1`)
  .get().c;
const legacy = db
  .prepare(`SELECT COUNT(*) AS c FROM catalog_provenance WHERE certification_class = 'legacy_structural'`)
  .get().c;

const factoryFiles = records.filter((record) => record.source_contract === FACTORY_CONTRACT);
for (const record of factoryFiles) {
  const onDisk = createHash("sha256").update(await readFile(join(process.cwd(), record.source_path))).digest("hex");
  record.package_sha256 = onDisk;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      target: "staging",
      sqlite: sqlitePath,
      packages: records.length,
      unchanged: plan.unchanged.length,
      versions_before: before,
      versions_after: after,
      published,
      factory_certified: factory,
      legacy_structural: legacy,
      wrangler: "not invoked",
    },
    null,
    2
  )
);

function sqliteShim(database) {
  return {
    prepare(sql) {
      const stmt = database.prepare(sql);
      const bound = (params) => ({
        all: async () => ({ results: params.length ? stmt.all(...params) : stmt.all() }),
        first: async () => (params.length ? stmt.get(...params) : stmt.get()) || null,
        run: async () => {
          if (params.length) stmt.run(...params);
          else stmt.run();
          return { success: true };
        },
      });
      return {
        bind(...params) {
          return bound(params);
        },
      };
    },
  };
}
