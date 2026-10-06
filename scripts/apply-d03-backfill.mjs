/**
 * Stamp locked Juniper prep-r2 classifications onto the current package only.
 * Does not mint a culinary version and does not edit a superseded v1 when v2 exists.
 *
 *   node scripts/apply-d03-backfill.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { contentHash } from "../src/lib/catalog-import.js";
import { classificationPayload, CLASSIFICATION_ACTOR, CLASSIFICATION_BATCH_ID } from "../src/lib/classification.js";
import { sqlLiteral } from "../src/lib/catalog-staging-sql.js";

const root = process.cwd();
const sourcePath = process.env.D03_BACKFILL || join(root, "data/d03-backfill-classifications-r2.json");
const backfill = JSON.parse(readFileSync(sourcePath, "utf8"));
if (backfill.source !== CLASSIFICATION_BATCH_ID) {
  console.error(`unexpected source ${backfill.source}`);
  process.exit(1);
}
if (backfill.n !== 50 || backfill.meals.length !== 50) {
  console.error("expected 50 meals");
  process.exit(1);
}

const bySlug = new Map();
for (const meal of backfill.meals) {
  if (bySlug.has(meal.slug)) {
    console.error(`duplicate slug ${meal.slug}`);
    process.exit(1);
  }
  bySlug.set(meal.slug, meal);
}

function highestVersionFile(dir) {
  const versions = readdirSync(dir)
    .map((name) => /^v(\d+)\.json$/.exec(name))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  if (!versions.length) return null;
  const n = Math.max(...versions);
  return { n, file: `v${n}.json` };
}

function placeClassification(version, labels) {
  const next = {};
  let placed = false;
  for (const [key, value] of Object.entries(version)) {
    if (key === "effort" || key === "complexity" || key === "effort_level" || key === "ingredient_complexity") {
      if (!placed) {
        next.effort_level = labels.effort_level;
        next.ingredient_complexity = labels.ingredient_complexity;
        placed = true;
      }
      continue;
    }
    next[key] = value;
  }
  if (!placed) {
    next.effort_level = labels.effort_level;
    next.ingredient_complexity = labels.ingredient_complexity;
  }
  return next;
}

function culinaryFingerprint(pkg) {
  const version = pkg.recipe_version || {};
  return JSON.stringify({
    title: version.title,
    description: version.description,
    ingredients: version.ingredients,
    steps: version.steps,
    prep_minutes: version.prep_minutes,
    cook_minutes: version.cook_minutes,
    total_minutes: version.total_minutes,
    version_number: version.version_number,
    recipe_version_id: version.recipe_version_id,
  });
}

const catalogRoot = join(root, "catalog");
const dirs = readdirSync(catalogRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
const rows = [];
const effort = { easy: 0, moderate: 0, involved: 0 };
const complexity = { simple: 0, standard: 0, adventurous: 0 };
const cross = {};

for (const entry of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
  const dir = join(catalogRoot, entry.name);
  const highest = highestVersionFile(dir);
  if (!highest) continue;
  const labels = bySlug.get(entry.name);
  if (!labels) {
    console.error(`catalog meal missing from locked backfill: ${entry.name}`);
    process.exit(1);
  }
  const path = join(dir, highest.file);
  const before = readFileSync(path, "utf8");
  const pkg = JSON.parse(before);
  const fingerprint = culinaryFingerprint(pkg);
  if (pkg.dish) delete pkg.dish.effort_band;
  pkg.recipe_version = placeClassification(pkg.recipe_version || {}, labels);
  if (culinaryFingerprint(pkg) !== fingerprint) {
    console.error(`culinary bytes changed for ${entry.name}`);
    process.exit(1);
  }
  const next = `${JSON.stringify(pkg, null, 2)}\n`;
  if (next !== before) writeFileSync(path, next);
  const versionId = pkg.recipe_version.recipe_version_id;
  const hash = contentHash(classificationPayload(labels.effort_level, labels.ingredient_complexity));
  rows.push({
    slug: entry.name,
    effort_level: labels.effort_level,
    ingredient_complexity: labels.ingredient_complexity,
    recipe_version_id: versionId,
    classification_hash: hash,
    version_file: `catalog/${entry.name}/${highest.file}`,
  });
  effort[labels.effort_level] += 1;
  complexity[labels.ingredient_complexity] += 1;
  const key = `${labels.effort_level}|${labels.ingredient_complexity}`;
  cross[key] = (cross[key] || 0) + 1;
  bySlug.delete(entry.name);
}

if (bySlug.size) {
  console.error(`backfill slugs missing from catalog: ${[...bySlug.keys()].join(", ")}`);
  process.exit(1);
}
if (rows.length !== 50) {
  console.error(`patched ${rows.length}, expected 50`);
  process.exit(1);
}
const expectEffort = { easy: 16, moderate: 29, involved: 5 };
const expectComplexity = { simple: 22, standard: 26, adventurous: 2 };
const expectCross = {
  "easy|simple": 13,
  "easy|standard": 3,
  "easy|adventurous": 0,
  "moderate|simple": 9,
  "moderate|standard": 19,
  "moderate|adventurous": 1,
  "involved|simple": 0,
  "involved|standard": 4,
  "involved|adventurous": 1,
};
for (const [key, count] of Object.entries(expectEffort)) {
  if (effort[key] !== count) {
    console.error(`effort ${key} ${effort[key]} !== ${count}`);
    process.exit(1);
  }
}
for (const [key, count] of Object.entries(expectComplexity)) {
  if (complexity[key] !== count) {
    console.error(`complexity ${key} ${complexity[key]} !== ${count}`);
    process.exit(1);
  }
}
for (const [key, count] of Object.entries(expectCross)) {
  if ((cross[key] || 0) !== count) {
    console.error(`cross ${key} ${cross[key] || 0} !== ${count}`);
    process.exit(1);
  }
}

const vendored = join(root, "data/d03-backfill-classifications-r2.json");
writeFileSync(vendored, `${JSON.stringify(backfill, null, 2)}\n`);

const mapBody = rows
  .map(
    (row) =>
      `  ${JSON.stringify(row.slug)}: Object.freeze({ effort_level: ${JSON.stringify(row.effort_level)}, ingredient_complexity: ${JSON.stringify(row.ingredient_complexity)}, recipe_version_id: ${JSON.stringify(row.recipe_version_id)} }),`
  )
  .join("\n");
writeFileSync(
  join(root, "src/lib/classification-backfill.js"),
  `/**
 * Locked D-03 labels. Vale prep-r2 re-check PASS 50/50.
 * Source batch: ${CLASSIFICATION_BATCH_ID}.
 * Classification only. Culinary recipe versions are not minted here.
 */

export const CLASSIFICATION_BACKFILL = Object.freeze({
${mapBody}
});

export function classificationForSlug(slug) {
  return CLASSIFICATION_BACKFILL[slug] || null;
}
`
);

function historyId(versionId) {
  return `clh_${CLASSIFICATION_BATCH_ID}_${versionId}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

const importedAt = "2026-10-06T17:00:00.000Z";
const sql = [
  "-- D-03 classification backfill for databases that already store culinary content_hash.",
  "-- Vale prep-r2 PASS 50/50. Batch d03-classification-backfill-juniper-prep-r2.",
  "-- Does not rewrite content_hash, ingredients, steps, or version ids.",
  "-- Apply migration 0013 first. Never point wrangler.staging.toml at production D1.",
  "--",
  "-- Preview (harbor-eats-cycle1-preview, 65bc636d-7048-4e58-900b-9066edf6509f):",
  "--   npx wrangler d1 migrations apply harbor-eats-cycle1-preview --remote --config wrangler.staging.toml",
  "--   npx wrangler d1 execute harbor-eats-cycle1-preview --remote --config wrangler.staging.toml --file data/d03-classification-import.sql",
  "--",
  "-- Production (harbor-eats-db, 23aa3db3-1090-471b-8c8a-b6fe71f5c053), Cora only:",
  "--   npx wrangler d1 migrations apply harbor-eats-db --remote --config wrangler.toml",
  "--   npx wrangler d1 execute harbor-eats-db --remote --config wrangler.toml --file data/d03-classification-import.sql",
  "--",
  "-- Fresh empty databases should use scripts/import-catalog.mjs after 0013,",
  "-- which renders data/staging-catalog-import.sql. Do not replay that full file",
  "-- onto preview or production: culinary hashes no longer include the old effort string.",
  "",
];
for (const row of rows) {
  sql.push(
    `UPDATE catalog_version SET effort_level = ${sqlLiteral(row.effort_level)}, ingredient_complexity = ${sqlLiteral(row.ingredient_complexity)}, classification_hash = ${sqlLiteral(row.classification_hash)} WHERE recipe_version_id = ${sqlLiteral(row.recipe_version_id)};`
  );
  sql.push(
    `INSERT OR IGNORE INTO catalog_classification_history (history_id, recipe_version_id, prior_effort_level, prior_ingredient_complexity, new_effort_level, new_ingredient_complexity, source, reason, created_at) VALUES (${sqlLiteral(historyId(row.recipe_version_id))}, ${sqlLiteral(row.recipe_version_id)}, NULL, NULL, ${sqlLiteral(row.effort_level)}, ${sqlLiteral(row.ingredient_complexity)}, ${sqlLiteral(CLASSIFICATION_ACTOR)}, ${sqlLiteral(CLASSIFICATION_BATCH_ID)}, ${sqlLiteral(importedAt)});`
  );
}
sql.push("");
writeFileSync(join(root, "data/d03-classification-import.sql"), sql.join("\n"));
console.log(JSON.stringify({ patched: rows.length, effort, complexity, cross }, null, 2));
if (!existsSync(vendored)) process.exit(1);
