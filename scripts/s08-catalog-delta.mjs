/**
 * Build data/s08-catalog-delta.sql from a fresh local catalog import and
 * verify it against a second local sqlite. Does not open D1. Does not apply
 * the delta to Preview or Production.
 *
 *   node scripts/s08-catalog-delta.mjs
 *   node scripts/s08-catalog-delta.mjs --check
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { planImport } from "../src/lib/catalog-import.js";
import { loadCatalogFromDisk } from "../src/lib/catalog-disk.js";
import { applyCatalogWrites, loadExistingVersions, retireCatalogVersions } from "../src/lib/catalog-write.js";
import { assertCatalogDeltaTargets, renderCatalogDeltaSql, splitStagingD1Statements } from "../src/lib/catalog-staging-sql.js";

const IMPORTED_AT = "2026-10-04T00:00:00.000Z";
const OUT = join(process.cwd(), "data", "s08-catalog-delta.sql");

export function sqliteShim(database) {
  return {
    prepare(sql) {
      const stmt = database.prepare(sql);
      return {
        bind(...params) {
          return {
            all: async () => ({ results: params.length ? stmt.all(...params) : stmt.all() }),
            first: async () => (params.length ? stmt.get(...params) : stmt.get()) || null,
            run: async () => {
              if (params.length) stmt.run(...params);
              else stmt.run();
              return { success: true };
            },
          };
        },
      };
    },
  };
}

export function applyMigrations(database) {
  database.exec("PRAGMA foreign_keys = ON;");
  const dir = join(process.cwd(), "migrations");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, name), "utf8"));
  }
}

export function s08VersionIds(catalogRoot = join(process.cwd(), "catalog")) {
  /** @type {string[]} */
  const ids = [];
  for (const entry of readdirSync(catalogRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const dir = join(catalogRoot, entry.name);
    for (const name of readdirSync(dir).filter((file) => /^v\d+\.json$/.test(file)).sort()) {
      const pkg = JSON.parse(readFileSync(join(dir, name), "utf8"));
      const revision = pkg.package_revision || pkg.recipe_version?.package_revision || "";
      if (String(revision).startsWith("s08-")) ids.push(pkg.recipe_version.recipe_version_id);
    }
  }
  return ids;
}

function loadAll() {
  const catalogRoot = join(process.cwd(), "catalog");
  const policy = JSON.parse(readFileSync(join(catalogRoot, "staging-publication.json"), "utf8"));
  const loaded = loadCatalogFromDisk(catalogRoot, policy);
  if (loaded.failures.length) {
    throw new Error(`catalog load failed: ${JSON.stringify(loaded.failures.slice(0, 3))}`);
  }
  return loaded;
}

async function importRecords(database, records, retireVersionIds = []) {
  const shim = sqliteShim(database);
  const existing = await loadExistingVersions(shim);
  const plan = planImport(existing, records);
  if (!plan.ok) throw new Error(`planImport failed: ${JSON.stringify(plan.errors.slice(0, 5))}`);
  await applyCatalogWrites(shim, plan.writes, IMPORTED_AT);
  if (retireVersionIds.length) await retireCatalogVersions(shim, [...new Set(retireVersionIds)]);
  return plan;
}

function openMigrated() {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

/**
 * @returns {Promise<{ sql: string, versionIds: string[], versionCount: number }>}
 */
export async function generateS08CatalogDelta() {
  const loaded = loadAll();
  const versionIds = s08VersionIds();
  const known = new Set(loaded.records.map((record) => record.recipe_version_id));
  const missing = versionIds.filter((id) => !known.has(id));
  if (missing.length) throw new Error(`s08 ids not in the catalog load: ${missing.join(", ")}`);
  const database = openMigrated();
  await importRecords(database, loaded.records, loaded.retireVersionIds);
  const sql = renderCatalogDeltaSql(database, versionIds);
  const guard = assertCatalogDeltaTargets(sql);
  if (!guard.ok) throw new Error(`delta touches a forbidden statement: ${guard.problems.join(" | ")}`);
  database.close();
  return { sql, versionIds, versionCount: loaded.records.length };
}

function baselineRecords(records, versionIds) {
  const skip = new Set(versionIds);
  /** @type {Map<string, object[]>} */
  const byDish = new Map();
  for (const record of records) {
    if (skip.has(record.recipe_version_id)) continue;
    const copy = { ...record };
    if (!byDish.has(copy.dish_id)) byDish.set(copy.dish_id, []);
    byDish.get(copy.dish_id).push(copy);
  }
  const baseline = [];
  for (const group of byDish.values()) {
    const max = Math.max(...group.map((record) => record.version_number));
    for (const record of group) {
      record.publication_status = record.version_number === max ? "published" : "retired";
      baseline.push(record);
    }
  }
  return baseline;
}

function counts(database) {
  const published = database
    .prepare(
      `SELECT COUNT(*) AS c FROM catalog_version
        WHERE publication_status = 'published' AND visibility = 'global' AND household_id IS NULL`
    )
    .get().c;
  const dishes = database.prepare("SELECT COUNT(*) AS c FROM catalog_dish").get().c;
  const versions = database.prepare("SELECT COUNT(*) AS c FROM catalog_version").get().c;
  const twoPublished = database
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT dish_id FROM catalog_version
          WHERE publication_status = 'published' AND visibility = 'global' AND household_id IS NULL
          GROUP BY dish_id HAVING COUNT(*) != 1
       )`
    )
    .get().c;
  const currentMismatch = database
    .prepare(
      `SELECT COUNT(*) AS c FROM catalog_dish d
        LEFT JOIN catalog_version v ON v.recipe_version_id = d.current_version_id
       WHERE d.current_version_id IS NULL OR v.publication_status != 'published'`
    )
    .get().c;
  return { published, dishes, versions, twoPublished, currentMismatch };
}

function seedPinnedSalmon(database) {
  database
    .prepare(
      `INSERT INTO household (household_id, display_name, status, timezone, servings_default, created_at, updated_at, data_origin)
       VALUES ('hh_s08_delta', 'S-08 delta check', 'incubation_pilot', 'America/Chicago', 2, ?, ?, 'synthetic')`
    )
    .run(IMPORTED_AT, IMPORTED_AT);
  database
    .prepare(
      `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('mem_s08_delta', 'hh_s08_delta', 'Delta', 'owner', 'active', ?, ?)`
    )
    .run(IMPORTED_AT, IMPORTED_AT);
  database
    .prepare(
      `INSERT INTO dinner_plan (
         dinner_plan_id, household_id, status, meal_count, entry_point, intent_json,
         data_origin, created_by_member_id, created_at, updated_at
       ) VALUES ('plan_s08_delta', 'hh_s08_delta', 'completed', 1, 'plan_dinners', '{}', 'synthetic', 'mem_s08_delta', ?, ?)`
    )
    .run(IMPORTED_AT, IMPORTED_AT);
  database
    .prepare(
      `INSERT INTO dinner_plan_meal (
         meal_id, dinner_plan_id, position, kind, state, recipe_slug, recipe_id, recipe_version_id,
         version_number, title, base_servings, pinned_ingredients_json, pinned_steps_json, data_origin,
         created_at, updated_at
       ) VALUES (
         'meal_s08_delta', 'plan_s08_delta', 1, 'recipe', 'cooked', 'maple-mustard-glazed-salmon',
         'rcp_maple-mustard-glazed-salmon', 'rv_maple-mustard-glazed-salmon_v2', 2, 'Maple Mustard Glazed Salmon',
         4, '[]', '[]', 'synthetic', ?, ?
       )`
    )
    .run(IMPORTED_AT, IMPORTED_AT);
  database
    .prepare(
      `INSERT INTO dinner_plan_rating (
         rating_id, meal_id, dinner_plan_id, household_id, member_id, recipe_version_id, score,
         data_origin, created_at, updated_at
       ) VALUES ('rate_s08_delta', 'meal_s08_delta', 'plan_s08_delta', 'hh_s08_delta', 'mem_s08_delta',
         'rv_maple-mustard-glazed-salmon_v2', 6, 'synthetic', ?, ?)`
    )
    .run(IMPORTED_AT, IMPORTED_AT);
  database
    .prepare(
      `INSERT INTO dinner_shop_line (
         line_id, dinner_plan_id, ingredient_id, display_name, unit, quantity, list_state,
         still_needed, meal_ids_json, created_at, updated_at
       ) VALUES ('shop_s08_delta', 'plan_s08_delta', 'dijon', 'Dijon mustard', 'tbsp', 2, 'purchased', 0, '[]', ?, ?)`
    )
    .run(IMPORTED_AT, IMPORTED_AT);
}

function householdCounts(database) {
  return {
    household: database.prepare("SELECT COUNT(*) AS c FROM household").get().c,
    dinner_plan: database.prepare("SELECT COUNT(*) AS c FROM dinner_plan").get().c,
    dinner_plan_meal: database.prepare("SELECT COUNT(*) AS c FROM dinner_plan_meal").get().c,
    dinner_plan_rating: database.prepare("SELECT COUNT(*) AS c FROM dinner_plan_rating").get().c,
    dinner_shop_line: database.prepare("SELECT COUNT(*) AS c FROM dinner_shop_line").get().c,
  };
}

function applyDelta(database, sql) {
  const guard = assertCatalogDeltaTargets(sql);
  if (!guard.ok) throw new Error(`refusing to apply delta: ${guard.problems.join(" | ")}`);
  for (const statement of splitStagingD1Statements(sql)) database.exec(statement);
}

/**
 * Import the pre-S-08 catalog, apply the delta twice, and check the invariants.
 * @param {string} sql
 */
export async function verifyS08CatalogDelta(sql) {
  const loaded = loadAll();
  const versionIds = s08VersionIds();
  const database = openMigrated();
  await importRecords(database, baselineRecords(loaded.records, versionIds));
  const before = counts(database);
  seedPinnedSalmon(database);
  const householdBefore = householdCounts(database);
  applyDelta(database, sql);
  const after = counts(database);
  applyDelta(database, sql);
  const twice = counts(database);
  const householdAfter = householdCounts(database);
  const pin = database
    .prepare(
      `SELECT v.recipe_version_id, v.publication_status, COUNT(i.position) AS ingredients
         FROM dinner_plan_meal m
         JOIN catalog_version v ON v.recipe_version_id = m.recipe_version_id
         JOIN catalog_ingredient i ON i.recipe_version_id = v.recipe_version_id
        WHERE m.recipe_version_id = 'rv_maple-mustard-glazed-salmon_v2'
        GROUP BY v.recipe_version_id, v.publication_status`
    )
    .get();
  const salmonCurrent = database
    .prepare(`SELECT current_version_id FROM catalog_dish WHERE dish_id = 'maple-mustard-glazed-salmon'`)
    .get();
  const donenessCurrent = database
    .prepare(
      `SELECT d.dish_id, d.current_version_id, v.publication_status
         FROM catalog_dish d
         JOIN catalog_version v ON v.recipe_version_id = d.current_version_id
        WHERE d.dish_id IN (
          'ethiopian-beef-tibs','gochujang-grilled-flank-steak','grilled-swordfish-olive-caper',
          'malaysian-curry-laksa','nigerian-beef-suya-skewers','pan-seared-halibut-lemon-butter-corn',
          'roasted-whole-branzino-salmoriglio','salade-nicoise-seared-tuna','seared-duck-breast-cherry',
          'seared-scallops-parsnip-puree','tex-mex-steak-fajitas','thai-yum-nua-beef-salad'
        )
        ORDER BY d.dish_id`
    )
    .all();
  database.close();
  const ok =
    before.published === 250 &&
    before.dishes === 250 &&
    after.published === 250 &&
    after.dishes === 250 &&
    after.versions === loaded.records.length &&
    after.twoPublished === 0 &&
    after.currentMismatch === 0 &&
    twice.published === 250 &&
    twice.versions === after.versions &&
    twice.twoPublished === 0 &&
    twice.currentMismatch === 0 &&
    JSON.stringify(householdBefore) === JSON.stringify(householdAfter) &&
    pin?.publication_status === "retired" &&
    pin?.ingredients > 0 &&
    salmonCurrent?.current_version_id === "rv_maple-mustard-glazed-salmon_v3" &&
    donenessCurrent.length === 12 &&
    donenessCurrent.every((row) => row.publication_status === "published" && row.current_version_id.endsWith("_v2"));
  return {
    ok,
    versionIds: versionIds.length,
    before,
    after,
    twice,
    householdBefore,
    householdAfter,
    pin,
    salmonCurrent,
    donenessCurrent,
  };
}

async function main() {
  const check = process.argv.includes("--check");
  const generated = await generateS08CatalogDelta();
  if (!check) writeFileSync(OUT, generated.sql, "utf8");
  const onDisk = readFileSync(OUT, "utf8");
  if (onDisk !== generated.sql) {
    console.error(JSON.stringify({ ok: false, error: "data/s08-catalog-delta.sql does not match the generator" }));
    process.exit(1);
  }
  const verification = await verifyS08CatalogDelta(onDisk);
  const report = {
    ok: verification.ok,
    sql: "data/s08-catalog-delta.sql",
    s08_versions: generated.versionIds.length,
    catalog_versions_after_delta: verification.after.versions,
    published_before: verification.before.published,
    published_after: verification.after.published,
    published_after_second_apply: verification.twice.published,
    versions_after_second_apply: verification.twice.versions,
    dishes_with_two_published: verification.after.twoPublished,
    current_version_not_published: verification.after.currentMismatch,
    salmon_v2_pin: verification.pin,
    salmon_current: verification.salmonCurrent,
    household_unchanged: JSON.stringify(verification.householdBefore) === JSON.stringify(verification.householdAfter),
    applied_to_d1: false,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!verification.ok) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
