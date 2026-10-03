/**
 * Shopping identity for a dinner plan.
 * A canonical id plus display and preparation. Preparation is not part of
 * the id. Compatible units add. Incompatible units stay on their own lines.
 * The serving ratio is the same clamp used by scaleRecipeVersion.
 * Already-have and purchased are list states, not a pantry.
 */

import { scaleIngredientQuantity } from "./recipe-scaling.js";

const PREP_WORDS = new Set([
  "diced",
  "chopped",
  "minced",
  "sliced",
  "grated",
  "shredded",
  "crushed",
  "julienned",
  "halved",
  "quartered",
]);

/** Same aliases as recipe-package parseLegacyQuantity. Tbsp is not a cup. */
const UNIT_ALIASES = {
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  can: "can",
  cans: "can",
  clove: "clove",
  cloves: "clove",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  package: "package",
  packages: "package",
  jar: "jar",
  jars: "jar",
  count: "count",
  each: "count",
  serving: "serving",
};

/**
 * Same purchasable item, different recipe strings in the 24-meal catalog.
 * Not a grocery ontology — do not alias distinct products (oils, sauces, citrus).
 */
export const SHOPPING_INGREDIENT_ALIASES = {
  "yellow-onion": "onion",
};

export function roundQuantity(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

/**
 * @param {number} baseServings
 * @param {number} dinerCount
 */
export function servingRatio(baseServings, dinerCount) {
  const base = Math.max(1, Number(baseServings) || 4);
  const requested = Math.max(1, Math.min(8, Number(dinerCount) || base));
  return requested / base;
}

export function normalizeUnit(unit) {
  if (unit == null || unit === "") return null;
  const key = String(unit).trim().toLowerCase();
  return UNIT_ALIASES[key] || null;
}

/**
 * @param {string} name
 * @param {string|null|undefined} note
 */
export function canonicalIngredient(name, note = null) {
  let text = String(name || "").trim().toLowerCase();
  /** @type {string[]} */
  const preps = [];
  if (note) preps.push(String(note).trim().toLowerCase());
  const words = text.split(/\s+/).filter(Boolean);
  while (words.length > 1 && PREP_WORDS.has(words[0])) preps.push(words.shift());
  while (words.length > 1 && PREP_WORDS.has(words[words.length - 1])) preps.push(words.pop());
  const display = words.join(" ");
  const slugged = display
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const ingredient_id = SHOPPING_INGREDIENT_ALIASES[slugged] || slugged || "unknown";
  const preparation = [...new Set(preps.filter(Boolean))].sort().join(", ") || null;
  return {
    ingredient_id,
    display_name: display || String(name || ""),
    preparation,
  };
}

function perServing(item) {
  return item.unit === "serving" || /for serving/i.test(String(item.note || item.raw_quantity || ""));
}

/**
 * Scale one pinned ingredient by the dinner-plan serving ratio.
 * Numeric quantities stay numeric so cups are not snapped to a display step.
 * @param {object} item
 * @param {number} ratio
 */
export function scaleIngredientRecord(item, ratio) {
  if (perServing(item)) {
    return { ...item, quantity: item.quantity, unparsed: item.quantity == null };
  }
  if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
    return { ...item, quantity: roundQuantity(item.quantity * ratio), unparsed: false };
  }
  const raw = item.raw_quantity || item.quantity;
  if (raw == null || raw === "") return { ...item, quantity: null, unparsed: true };
  const scaled = scaleIngredientQuantity(String(raw), ratio, item.name || "");
  return { ...item, quantity: scaled, unparsed: true };
}

export function scaleForDiners(ingredients, baseServings, dinerCount) {
  const ratio = servingRatio(baseServings, dinerCount);
  return (ingredients || []).map((item) => scaleIngredientRecord(item, ratio));
}

function joinPrep(values) {
  const unique = [...new Set((values || []).filter(Boolean))].sort();
  return unique.length ? unique.join(", ") : null;
}

/**
 * @param {object[]} rows
 */
export function aggregateContributions(rows) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const row of rows || []) {
    const canon = row.ingredient_id
      ? row
      : { ...row, ...canonicalIngredient(row.name, row.note || row.preparation) };
    const unit = canon.unit && UNIT_ALIASES[canon.unit] ? UNIT_ALIASES[canon.unit] : canon.unit;
    const unparsed = canon.unparsed === true || typeof canon.quantity !== "number" || !unit;
    const key = unparsed
      ? `${canon.ingredient_id}\u0000unparsed`
      : `${canon.ingredient_id}\u0000${unit}`;
    const hit = map.get(key);
    if (!hit) {
      map.set(key, {
        ingredient_id: canon.ingredient_id,
        display_name: canon.display_name,
        unit: unparsed ? unit || "unparsed" : unit,
        quantity: unparsed ? null : roundQuantity(canon.quantity),
        preparations: [canon.preparation],
        meal_ids: canon.meal_id ? [canon.meal_id] : [],
        unparsed,
      });
      continue;
    }
    if (!unparsed) hit.quantity = roundQuantity(hit.quantity + canon.quantity);
    if (canon.preparation) hit.preparations.push(canon.preparation);
    if (canon.meal_id && !hit.meal_ids.includes(canon.meal_id)) hit.meal_ids.push(canon.meal_id);
  }
  return [...map.values()]
    .map((item) => ({
      ingredient_id: item.ingredient_id,
      display_name: item.display_name,
      preparation: joinPrep(item.preparations),
      unit: item.unit,
      quantity: item.quantity,
      meal_ids: item.meal_ids,
      unparsed: item.unparsed,
    }))
    .sort((a, b) => a.ingredient_id.localeCompare(b.ingredient_id) || String(a.unit).localeCompare(String(b.unit)));
}

/**
 * Scaled contributions from recipe meals that still need shopping.
 * Skipped, abandoned, leftovers, and eating out contribute nothing.
 * @param {object[]} meals
 */
export function contributionsFromMeals(meals) {
  /** @type {object[]} */
  const rows = [];
  for (const meal of meals || []) {
    if (!meal || meal.kind !== "recipe") continue;
    if (meal.state === "skipped" || meal.state === "abandoned") continue;
    const diners = (meal.participant_ids || []).length;
    const scaled = scaleForDiners(meal.pinned_ingredients || [], meal.base_servings, diners);
    for (const item of scaled) {
      const canon = canonicalIngredient(item.name, item.note || null);
      const unit = normalizeUnit(item.unit);
      rows.push({
        meal_id: meal.meal_id,
        ingredient_id: canon.ingredient_id,
        display_name: canon.display_name,
        preparation: canon.preparation,
        unit,
        quantity: item.quantity,
        unparsed: item.unparsed === true || typeof item.quantity !== "number" || !unit,
      });
    }
  }
  return rows;
}

export function neededLines(meals) {
  return aggregateContributions(contributionsFromMeals(meals)).filter((row) => row.unparsed || row.quantity !== 0);
}
