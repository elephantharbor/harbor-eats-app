/**
 * Screen the live catalog version of each dish. Flags are candidates.
 * Unbranded "kosher salt" on a pre-S-08 package is counted, not flagged:
 * the gram-and-brand standard applies to new and materially revised recipes.
 *
 * Run: node scripts/s08-catalog-screen.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assessCulinaryQuality } from "../src/lib/culinary-quality.js";

const root = join(process.cwd(), "catalog");
const SALTY =
  /\b(salt|soy|miso|fish sauce|oyster|gochujang|doenjang|cheese|feta|parmesan|pecorino|anchovy|caper|olives?|broth|stock|kimchi|harissa|curry paste|pesto|tamari|bouillon|worcestershire|sausage|bacon|prosciutto|pickle|adobo|tomato paste|coconut aminos|nutritional yeast)\b/i;
const SWEET = /\b(cookie|cake|brownie|ice cream|pudding|sorbet|tart|pie|muffin|scone|biscotti|shortbread|panna cotta|custard)\b/i;

function versionFiles(dir) {
  return readdirSync(dir)
    .filter((name) => /^v\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
}

function ingredientNames(pkg) {
  return (pkg.recipe_version?.ingredients || []).map((item) => item.name || "");
}

const rows = [];
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(root, entry.name);
  const files = versionFiles(dir);
  if (!files.includes("v1.json")) continue;
  const liveName = files[files.length - 1];
  const pkg = JSON.parse(readFileSync(join(dir, liveName), "utf8"));
  const culinary = assessCulinaryQuality(pkg);
  const reviewed = Boolean(pkg.evidence?.culinary_reviewed);
  const names = ingredientNames(pkg);
  const sweet = SWEET.test(`${pkg.dish?.title || ""} ${entry.name}`);
  const salty = names.some((name) => SALTY.test(name));
  const blob = (pkg.recipe_version?.steps || []).map((step) => step.body || "").join("\n");
  const flags = [];
  for (const fail of culinary.fails) {
    if (!reviewed && fail.code === "salt_type") continue;
    flags.push(`${fail.code}: ${fail.detail}`);
  }
  for (const warning of culinary.warnings) {
    if (!reviewed && warning.code === "boiling_salt_ratio" && /\b(salt|soy|miso|broth|stock)\b/i.test(blob)) continue;
    flags.push(`${warning.code}: ${warning.detail}`);
  }
  if (!reviewed && !sweet && !salty) flags.push("weak_seasoning: no salty foundation ingredient on a savory dish");
  rows.push({
    slug: entry.name,
    live: liveName,
    reviewed,
    salt_type_notes: culinary.fails.filter((item) => item.code === "salt_type").length,
    flags,
  });
}

const flagged = rows.filter((row) => row.flags.length);
const summary = {
  screened: rows.length,
  flagged: flagged.length,
  culinary_reviewed: rows.filter((row) => row.reviewed).length,
  unbranded_salt_informational: rows.filter((row) => row.salt_type_notes && !row.reviewed).length,
  flagged_slugs: flagged.map((row) => ({ slug: row.slug, live: row.live, flags: row.flags })),
};
console.log(JSON.stringify(summary, null, 2));
