/**
 * Import catalog artifacts into an isolated staging sqlite file.
 * Refuses production. Does not edit v1.json.
 *
 *   node scripts/import-catalog.mjs --target staging --sqlite tmp/catalog-staging.sqlite
 *   node scripts/import-catalog.mjs --target staging --sqlite tmp/catalog-staging.sqlite --d1-sql data/staging-catalog-import.sql
 */
import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { FACTORY_CONTRACT, assertStagingTarget, planImport } from "../src/lib/catalog-import.js";
import { loadCatalogFromDisk } from "../src/lib/catalog-disk.js";
import { applyCatalogWrites, loadExistingVersions, retireCatalogVersions } from "../src/lib/catalog-write.js";
import { renderStagingD1Sql } from "../src/lib/catalog-staging-sql.js";

const PRODUCTION_D1_ID = "23aa3db3-1090-471b-8c8a-b6fe71f5c053";
const args = process.argv.slice(2);

function flag(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || "";
}

const target = flag("--target");
const sqlitePath = flag("--sqlite");
const d1SqlPath = flag("--d1-sql");
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
const stagingPolicy = JSON.parse(await readFile(join(catalogRoot, "staging-publication.json"), "utf8"));
const loaded = loadCatalogFromDisk(catalogRoot, stagingPolicy);
const records = loaded.records;
const failures = loaded.failures;
const retireVersionIds = loaded.retireVersionIds;

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
if (retireVersionIds.length) {
  await retireCatalogVersions(shim, [...new Set(retireVersionIds)]);
}
const after = db.prepare("SELECT COUNT(*) AS c FROM catalog_version").get().c;
const published = db
  .prepare(
    `SELECT COUNT(*) AS c FROM catalog_version
      WHERE publication_status = 'published' AND visibility = 'global' AND household_id IS NULL`
  )
  .get().c;
const currentV2 = db
  .prepare(
    `SELECT COUNT(*) AS c FROM catalog_dish d
      JOIN catalog_version v ON v.recipe_version_id = d.current_version_id
     WHERE v.version_number = 2`
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

if (d1SqlPath) {
  await mkdir(dirname(d1SqlPath), { recursive: true });
  await writeFile(d1SqlPath, renderStagingD1Sql(db), "utf8");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      target: "staging",
      sqlite: sqlitePath,
      d1_sql: d1SqlPath || null,
      packages: records.length,
      unchanged: plan.unchanged.length,
      versions_before: before,
      versions_after: after,
      published,
      legacy_v2_current: currentV2,
      retired_superseded: retireVersionIds.length,
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
