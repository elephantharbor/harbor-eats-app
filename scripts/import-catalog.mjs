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
import {
  FACTORY_CONTRACT,
  assertStagingTarget,
  normalizeFactoryPackage,
  normalizeLegacyAuditDraftPackage,
  normalizeLegacyPackage,
  planImport,
} from "../src/lib/catalog-import.js";
import { LEGACY_AUDIT_DRAFT_CONTRACT, LEGACY_CONTRACT } from "../src/lib/catalog-legacy.js";
import { applyCatalogWrites, loadExistingVersions, retireCatalogVersions } from "../src/lib/catalog-write.js";

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
/** @type {object[]} */
const records = [];
/** @type {object[]} */
const failures = [];
/** @type {string[]} */
const retireVersionIds = [];

async function legacySidecar(dir, slug, fileName) {
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
  let valeAudit = null;
  if (names.includes("VALE-AUDIT.json")) {
    valeAudit = JSON.parse(await readFile(join(dir, "VALE-AUDIT.json"), "utf8"));
  }
  let readmeDeclares = false;
  if (names.includes("README.md")) {
    const readme = await readFile(join(dir, "README.md"), "utf8");
    readmeDeclares = /not certified/i.test(readme);
  }
  return {
    source_path: `catalog/${slug}/${fileName}`,
    freeze_integrity: freezeIntegrity,
    freeze_detail: freezeDetail,
    readme_declares_not_certified: readmeDeclares,
    vale_audit: valeAudit,
  };
}

async function factorySidecar(dir, slug) {
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
  return {
    source_path: `catalog/${slug}/v1.json`,
    freeze_integrity: freezeIntegrity,
    freeze_detail: freezeDetail,
    readme_declares_not_certified: readmeDeclares,
  };
}

const entries = (await readdir(catalogRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());

for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  const dir = join(catalogRoot, entry.name);
  const names = await readdir(dir);
  if (!names.includes("v1.json")) continue;
  const pkg = JSON.parse(await readFile(join(dir, "v1.json"), "utf8"));
  if (pkg.catalog_contract === FACTORY_CONTRACT) {
    if (pkg.dish?.slug !== entry.name || pkg.dish?.dish_id !== entry.name) {
      failures.push({ slug: entry.name, errors: [{ code: "directory_slug_mismatch", detail: entry.name }] });
      continue;
    }
    const normalized = normalizeFactoryPackage(pkg, await factorySidecar(dir, entry.name), {
      publicationStatus: stagingPolicy.publication_status || "published",
    });
    if (!normalized.ok) failures.push({ slug: entry.name, errors: normalized.errors });
    else records.push(normalized.record);
    continue;
  }
  if (pkg.catalog_contract !== LEGACY_CONTRACT) {
    failures.push({ slug: entry.name, errors: [{ code: "unknown_contract", detail: pkg.catalog_contract || null }] });
    continue;
  }
  if (pkg.dish?.slug !== entry.name) {
    failures.push({ slug: entry.name, errors: [{ code: "directory_slug_mismatch", detail: entry.name }] });
    continue;
  }
  const v1 = normalizeLegacyPackage(pkg, await legacySidecar(dir, entry.name, "v1.json"));
  if (!v1.ok) failures.push({ slug: entry.name, file: "v1.json", errors: v1.errors });
  else records.push(v1.record);

  if (!names.includes("v2.json")) continue;
  const pkg2 = JSON.parse(await readFile(join(dir, "v2.json"), "utf8"));
  const v2Sidecar = await legacySidecar(dir, entry.name, "v2.json");
  const v2Policy = {
    publicationStatus: stagingPolicy.legacy_v2_publication_status || stagingPolicy.publication_status || "published",
    relaxTimeMismatch: true,
  };
  const v2 =
    pkg2.catalog_contract === LEGACY_AUDIT_DRAFT_CONTRACT
      ? normalizeLegacyAuditDraftPackage(pkg2, v2Sidecar, v2Policy)
      : pkg2.catalog_contract === LEGACY_CONTRACT
        ? normalizeLegacyPackage(pkg2, v2Sidecar, v2Policy)
        : { ok: false, errors: [{ code: "unknown_contract", field: "catalog_contract", detail: pkg2.catalog_contract }] };
  if (!v2.ok) failures.push({ slug: entry.name, file: "v2.json", errors: v2.errors });
  else {
    records.push(v2.record);
    if (stagingPolicy.legacy_v1_retire_on_v2_import) {
      retireVersionIds.push(v2.record.supersedes_version_id || `rv_${entry.name}_v1`);
    }
  }
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
  await writeFile(d1SqlPath, await renderD1Sql(db), "utf8");
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

function sqlLiteral(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function renderD1Sql(database) {
  const lines = [
    "-- Harbor Eats staging catalog import (legacy-24 v2). Not for production D1.",
    "-- Generated by scripts/import-catalog.mjs. No BEGIN TRANSACTION wrapper.",
    "",
  ];
  const dishes = database.prepare("SELECT * FROM catalog_dish ORDER BY slug").all();
  for (const row of dishes) {
    lines.push(
      `INSERT OR REPLACE INTO catalog_dish (dish_id, slug, title, name, description, cuisine, meal_format, primary_ingredient, texture, flavor_profile, effort_band, weeknight, exploration, plate, tone, tags_json, sparks_json, chips_json, current_recipe_id, current_version_id, created_at) VALUES (${[
        row.dish_id,
        row.slug,
        row.title,
        row.name,
        row.description,
        row.cuisine,
        row.meal_format,
        row.primary_ingredient,
        row.texture,
        row.flavor_profile,
        row.effort_band,
        row.weeknight,
        row.exploration,
        row.plate,
        row.tone,
        row.tags_json,
        row.sparks_json,
        row.chips_json,
        row.current_recipe_id,
        row.current_version_id,
        row.created_at,
      ]
        .map(sqlLiteral)
        .join(", ")});`
    );
  }
  const versions = database.prepare("SELECT * FROM catalog_version ORDER BY dish_id, version_number").all();
  for (const row of versions) {
    lines.push(
      `INSERT OR REPLACE INTO catalog_version (recipe_version_id, recipe_id, dish_id, version_number, title, description, base_servings, prep_minutes, cook_minutes, total_minutes, effort, heat, doneness, methods_json, dietary_tags_json, substitutions_json, components_json, publication_status, artifact_publication_status, visibility, household_id, content_hash, source_contract, source_path, created_at) VALUES (${[
        row.recipe_version_id,
        row.recipe_id,
        row.dish_id,
        row.version_number,
        row.title,
        row.description,
        row.base_servings,
        row.prep_minutes,
        row.cook_minutes,
        row.total_minutes,
        row.effort,
        row.heat,
        row.doneness,
        row.methods_json,
        row.dietary_tags_json,
        row.substitutions_json,
        row.components_json,
        row.publication_status,
        row.artifact_publication_status,
        row.visibility,
        row.household_id,
        row.content_hash,
        row.source_contract,
        row.source_path,
        row.created_at,
      ]
        .map(sqlLiteral)
        .join(", ")});`
    );
  }
  lines.push("");
  lines.push("-- Child tables: delete and re-insert per version for idempotent staging loads.");
  for (const table of [
    "catalog_ingredient",
    "catalog_step",
    "catalog_taste_tag",
    "catalog_dietary_label",
    "catalog_allergen",
    "catalog_equipment",
    "catalog_eligibility_tag",
    "catalog_image_ref",
    "catalog_provenance",
  ]) {
    const cols = database.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    const rows = database.prepare(`SELECT * FROM ${table}`).all();
    for (const row of rows) {
      const versionId = row.recipe_version_id;
      lines.push(`DELETE FROM ${table} WHERE recipe_version_id = ${sqlLiteral(versionId)};`);
      lines.push(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((col) => sqlLiteral(row[col])).join(", ")});`
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}
