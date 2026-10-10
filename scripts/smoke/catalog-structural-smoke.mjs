#!/usr/bin/env node
/**
 * Reusable structural catalog smoke (read-only).
 *   node scripts/smoke/catalog-structural-smoke.mjs --db <sqlite>            # seeded local D1 (default: wrangler local state)
 *   node scripts/smoke/catalog-structural-smoke.mjs --api <baseUrl> [--db …] # + live API (GET only; prod allowed read-only)
 *   --wave12  limit to the 25 wave-12 meals (default: every published meal)
 * Checks per published meal: identity (dish↔version↔slug), current version pointer → published version,
 * active image path (master + card) → non-empty valid WebP at 1200×900 / 640×480 (file and/or HTTP),
 * ingredients, instructions, allergen metadata, effort_level, ingredient_complexity, recipe resolution.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { webpDimensions } from "../../src/lib/freeze-integrity.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const EFFORT = ["easy", "moderate", "involved"];
export const COMPLEXITY = ["simple", "standard", "adventurous"];
export const WAVE12_SLUGS = [
  "sheet-pan-gnocchi-brussels-apples", "miso-mushroom-ramen", "brazilian-fish-moqueca", "vegetable-biryani-cashews",
  "filipino-chicken-adobo", "classic-smash-burgers", "chicken-enchiladas-verdes", "baked-ziti-italian-sausage",
  "peruvian-lomo-saltado", "pumpkin-pinto-bean-chili", "salade-nicoise-seared-tuna", "japanese-okonomiyaki",
  "vietnamese-turmeric-dill-fish", "thai-turkey-larb-lettuce-wraps", "sheet-pan-shrimp-boil", "pressure-cooker-butter-chicken",
  "turkish-lahmacun", "mushroom-hominy-pozole-rojo", "sabich-pita-sandwiches", "tomato-soup-grilled-cheese",
  "spaghetti-puttanesca", "cottage-pie", "cashew-chicken-stir-fry", "thai-fish-cakes-cucumber-relish", "seared-scallops-parsnip-puree",
];
/** Allergen invariants that must hold (Oversight hard rules). */
export const ALLERGEN_INVARIANTS = [
  { slug: "sabich-pita-sandwiches", mustInclude: ["sesame"], mustExclude: ["peanut", "nuts", "tree_nut"] },
];

export function defaultLocalDb(root = repoRoot) {
  const base = join(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (!existsSync(base)) return null;
  const f = readdirSync(base).filter((x) => x.endsWith(".sqlite") && x !== "metadata.sqlite");
  return f.length ? join(base, f[0]) : null;
}

export function sqliteJson(db, sql) {
  const out = execFileSync("sqlite3", ["-json", "-readonly", db, sql], { encoding: "utf8" });
  return out.trim() ? JSON.parse(out) : [];
}

export function loadCatalogFromDb(db) {
  const rows = sqliteJson(
    db,
    `SELECT d.dish_id, d.slug, d.title AS dish_title, d.current_version_id, d.current_recipe_id,
            v.recipe_version_id, v.recipe_id, v.dish_id AS v_dish_id, v.publication_status, v.title, v.effort_level, v.ingredient_complexity,
            (SELECT COUNT(*) FROM catalog_ingredient i WHERE i.recipe_version_id=v.recipe_version_id) AS n_ingredients,
            (SELECT COUNT(*) FROM catalog_step s WHERE s.recipe_version_id=v.recipe_version_id AND length(trim(s.body))>0) AS n_steps,
            (SELECT group_concat(allergen) FROM catalog_allergen a WHERE a.recipe_version_id=v.recipe_version_id) AS allergens,
            (SELECT group_concat(tag) FROM catalog_eligibility_tag e WHERE e.recipe_version_id=v.recipe_version_id) AS tags,
            (SELECT group_concat(label) FROM catalog_dietary_label l WHERE l.recipe_version_id=v.recipe_version_id) AS labels,
            (SELECT group_concat(lower(name), '|') FROM catalog_ingredient i WHERE i.recipe_version_id=v.recipe_version_id) AS ingredient_names,
            (SELECT path FROM catalog_image_ref r WHERE r.recipe_version_id=v.recipe_version_id AND r.role='master') AS image_master,
            (SELECT path FROM catalog_image_ref r WHERE r.recipe_version_id=v.recipe_version_id AND r.role='card') AS image_card
       FROM catalog_dish d LEFT JOIN catalog_version v ON v.recipe_version_id = d.current_version_id
      ORDER BY d.slug`
  );
  const split = (x, sep = ",") => (x ? x.split(sep).filter(Boolean) : []);
  return rows.map((r) => ({
    ...r,
    allergens: [...new Set(split(r.allergens))].sort(),
    tags: split(r.tags),
    labels: split(r.labels),
    ingredient_names: split(r.ingredient_names, "|"),
  }));
}

function webpProblems(buf, w, h, label) {
  const p = [];
  if (!buf || buf.length < 1024) return [`${label}: empty or tiny (${buf?.length ?? 0} bytes)`];
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") p.push(`${label}: not RIFF/WEBP`);
  const dim = webpDimensions(buf);
  if (!dim || dim.width !== w || dim.height !== h) p.push(`${label}: ${dim?.width}x${dim?.height} expected ${w}x${h}`);
  return p;
}

/**
 * HH001 hard-limit cross-check: ingredient names that clearly imply a restricted class must be
 * reflected in allergen/eligibility tokens (so eligibility filtering can exclude them).
 */
export const HARD_LIMIT_KEYWORDS = {
  shellfish: [/\bshrimp\b/, /\bscallops?\b/, /\bmussels?\b/, /\bclams?\b/, /\bcrab\b/, /\blobster\b/],
  poultry: [/\bchicken\b(?! (stock|broth))/, /\bturkey\b/],
  meat: [/\bbeef\b(?! (stock|broth))/, /\bpork\b/, /\blamb\b/, /\bsausage\b/, /\bchorizo\b/, /\bbacon\b/, /(?<!(sword|tuna |salmon |fish |cauliflower |cabbage ))\bsteak\b/],
  dairy: [/\bbutter\b(?!milk| lettuce)/, /\bcheese\b/, /\bparmesan\b/, /\bfeta\b/, /\bpaneer\b/, /\bcream\b(?! of)/, /\byogurt\b/, /\bwhole milk\b/, /\bmozzarella\b/, /\bricotta\b/, /\bghee\b/],
  nuts: [/\bwalnuts?\b/, /\balmonds?\b/, /\bpecans?\b/, /\bpistachios?\b/, /\bhazelnuts?\b/, /\bpeanuts?\b/, /\bpeanut butter\b/],
};
const CLASS_TOKENS = {
  shellfish: ["shellfish", "seafood"],
  poultry: ["poultry"],
  meat: ["meat"],
  dairy: ["dairy", "milk"],
  nuts: ["nuts", "peanut", "walnut", "tree_nut", "almond", "pecan", "pistachio", "hazelnut"],
};
const NON_DAIRY = /(coconut|oat|almond|soy|cashew) (milk|cream|butter)|peanut butter|nut butter|cocoa butter|plant butter|vegan/;
export function hardLimitProblems(m) {
  const tokens = new Set([...m.allergens, ...m.tags]);
  const out = [];
  for (const [cls, res] of Object.entries(HARD_LIMIT_KEYWORDS)) {
    const hit = m.ingredient_names.find((n) => res.some((re) => re.test(n)) && !(cls === "dairy" && NON_DAIRY.test(n)) && !(cls === "nuts" && /\bnutmeg\b/.test(n)));
    if (hit && !CLASS_TOKENS[cls].some((t) => tokens.has(t))) out.push(`hard-limit: ingredient "${hit}" implies ${cls} but no ${cls} token`);
  }
  if (m.labels.includes("dairy_free") && (tokens.has("dairy") || tokens.has("milk"))) out.push("dairy_free label contradicts dairy/milk token");
  return out;
}

/** Pure structural checks for one meal row (DB + local files). */
export function checkMeal(m, { root = repoRoot, readFile = (p) => readFileSync(join(root, "public", p)) } = {}) {
  const p = [];
  if (!m.recipe_version_id) return ["current_version_id does not resolve to a catalog_version"];
  if (m.publication_status !== "published") p.push(`current version is ${m.publication_status}`);
  if (m.v_dish_id !== m.dish_id) p.push(`version dish ${m.v_dish_id} != dish ${m.dish_id}`);
  if (m.current_recipe_id && m.recipe_id !== m.current_recipe_id) p.push("current_recipe_id mismatch");
  if (!m.title || !m.slug) p.push("missing title/slug");
  if (!(m.n_ingredients > 0)) p.push("no ingredients");
  if (!(m.n_steps > 0)) p.push("no instructions");
  if (!EFFORT.includes(m.effort_level)) p.push(`effort_level=${m.effort_level}`);
  if (!COMPLEXITY.includes(m.ingredient_complexity)) p.push(`ingredient_complexity=${m.ingredient_complexity}`);
  if (m.allergens.length === 0 && m.labels.length === 0 && m.tags.length === 0) p.push("no allergen/dietary metadata");
  p.push(...hardLimitProblems(m));
  for (const [role, path, w, h] of [["master", m.image_master, 1200, 900], ["card", m.image_card, 640, 480]]) {
    if (!path) { p.push(`no active ${role} image`); continue; }
    if (/\/rejected\//.test(path)) p.push(`${role} image path is rejected/`);
    if (path !== `/images/meals/${m.slug}${role === "card" ? "-640" : ""}.webp`) p.push(`${role} path ${path} not canonical`);
    let buf = null;
    try { buf = readFile(path.replace(/^\//, "")); } catch { p.push(`${role} image file missing: ${path}`); continue; }
    p.push(...webpProblems(buf, w, h, `${role} file`));
  }
  for (const inv of ALLERGEN_INVARIANTS.filter((i) => i.slug === m.slug)) {
    for (const a of inv.mustInclude) if (!m.allergens.includes(a)) p.push(`allergen invariant: missing ${a}`);
    for (const a of inv.mustExclude) if (m.allergens.includes(a)) p.push(`allergen invariant: unexpected ${a}`);
  }
  return p;
}

export async function checkMealApi(m, base, fetchImpl = fetch) {
  const p = [];
  const r = await fetchImpl(`${base}/api/recipes/${m.slug}`);
  if (!r.ok) return [`GET /api/recipes/${m.slug} -> ${r.status}`];
  const body = await r.json();
  const rec = body.recipe || {};
  if (rec.recipe_slug !== m.slug) p.push(`api slug ${rec.recipe_slug}`);
  if (m.recipe_version_id && rec.recipe_version_id !== m.recipe_version_id)
    p.push(`api version ${rec.recipe_version_id} != current ${m.recipe_version_id}`);
  if (!(rec.ingredients?.length > 0)) p.push("api: no ingredients");
  if (!(rec.steps?.length > 0)) p.push("api: no steps");
  if (!EFFORT.includes(rec.effort_level)) p.push(`api effort_level=${rec.effort_level}`);
  if (!COMPLEXITY.includes(rec.ingredient_complexity)) p.push(`api ingredient_complexity=${rec.ingredient_complexity}`);
  for (const [suffix, w, h] of [["", 1200, 900], ["-640", 640, 480]]) {
    const ir = await fetchImpl(`${base}/images/meals/${m.slug}${suffix}.webp`);
    if (ir.status !== 200) { p.push(`api image${suffix} -> ${ir.status}`); continue; }
    if (!/image\/webp/i.test(ir.headers.get("content-type") || "")) p.push(`api image${suffix} content-type`);
    p.push(...webpProblems(Buffer.from(await ir.arrayBuffer()), w, h, `api image${suffix}`));
  }
  return p;
}

export async function runSmoke({ db, api, wave12 = false, expectedMeals = 75, fetchImpl = fetch, log = console.log } = {}) {
  const meals = loadCatalogFromDb(db);
  const published = meals.filter((m) => m.publication_status === "published");
  const scope = wave12 ? published.filter((m) => WAVE12_SLUGS.includes(m.slug)) : published;
  const failures = {};
  if (!wave12 && published.length !== expectedMeals) failures._catalog = [`published=${published.length} expected ${expectedMeals}`];
  if (wave12) {
    const missing = WAVE12_SLUGS.filter((s) => !scope.some((m) => m.slug === s));
    if (missing.length) failures._wave12 = [`missing: ${missing.join(",")}`];
  }
  const unpublishedCurrent = meals.filter((m) => m.publication_status !== "published");
  if (api) {
    const h = await fetchImpl(`${api}/api/health`);
    const hb = h.ok ? await h.json() : {};
    if (hb.catalog_runtime_meals !== expectedMeals) (failures._health ||= []).push(`health catalog_runtime_meals=${hb.catalog_runtime_meals}`);
  }
  for (const m of scope) {
    const p = checkMeal(m);
    if (api) p.push(...(await checkMealApi(m, api, fetchImpl)));
    if (p.length) failures[m.slug] = p;
  }
  const result = { ok: Object.keys(failures).length === 0, checked: scope.length, published: published.length, dishes_without_published_current: unpublishedCurrent.length, api: api || null, failures };
  log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2);
  const val = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
  const db = val("--db") || defaultLocalDb();
  if (!db || !existsSync(db)) {
    console.error("catalog smoke: no sqlite DB (run npm run db:migrate:local && node scripts/seed-local-d1-catalog.mjs, or pass --db)");
    process.exit(2);
  }
  const r = await runSmoke({ db, api: val("--api")?.replace(/\/$/, ""), wave12: a.includes("--wave12") });
  process.exit(r.ok ? 0 : 1);
}
