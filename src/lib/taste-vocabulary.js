/**
 * Curated taste vocabulary shared by diner preferences and recipe descriptions.
 * Stable slugs are the source of truth. Free-text tags are not.
 *
 * A concept stays here even when the current catalog has few or zero meals
 * that use it. Match counts live on the catalog projection, not on the term.
 */

import { CATEGORY_LABELS, VOCABULARY_CATEGORIES } from "./cycle2-schema.js";

/**
 * @typedef {object} TasteTerm
 * @property {string} slug
 * @property {string} display_name
 * @property {"cuisine"|"flavor"|"texture"|"meal_style"|"ingredient"} category
 * @property {string[]} synonyms
 * @property {boolean} active
 * @property {string|null} parent_slug
 */

/**
 * @param {string} slug
 * @param {string} displayName
 * @param {TasteTerm["category"]} category
 * @param {string[]} [synonyms]
 * @param {string|null} [parentSlug]
 * @returns {TasteTerm}
 */
function term(slug, displayName, category, synonyms = [], parentSlug = null) {
  return {
    slug,
    display_name: displayName,
    category,
    synonyms,
    active: true,
    parent_slug: parentSlug,
  };
}

/** @type {TasteTerm[]} */
const TERMS = [
  term("mexican", "Mexican", "cuisine"),
  term("indian", "Indian", "cuisine", ["indian inspired"]),
  term("thai", "Thai", "cuisine", ["thai inspired"]),
  term("mediterranean", "Mediterranean", "cuisine"),
  term("japanese", "Japanese", "cuisine", ["japanese inspired"]),
  term("italian", "Italian", "cuisine", ["italian inspired"]),
  term("korean", "Korean", "cuisine"),
  term("chinese", "Chinese", "cuisine", ["chinese inspired"]),
  term("middle-eastern", "Middle Eastern", "cuisine"),
  term("north-african", "North African", "cuisine"),
  term("american", "American", "cuisine"),
  term("scandinavian", "Scandinavian", "cuisine", ["scandinavian inspired"]),
  term("moroccan", "Moroccan", "cuisine"),
  term("californian", "Californian", "cuisine"),

  term("smoky", "Smoky", "flavor", [
    "bbq",
    "barbecue",
    "barbeque",
    "bar-b-que",
    "bar b que",
    "smoked",
  ]),
  term("citrusy", "Citrusy", "flavor", ["citrus", "bright"]),
  term("savory", "Savory", "flavor", ["savoury"]),
  term("spicy", "Spicy", "flavor"),
  term("tangy", "Tangy", "flavor"),
  term("rich", "Rich", "flavor"),
  term("fresh", "Fresh", "flavor"),
  term("umami", "Umami", "flavor"),
  term("herbaceous", "Herbaceous", "flavor"),

  term("crispy", "Crispy", "texture", ["crisp"]),
  term("creamy", "Creamy", "texture"),
  term("crunchy", "Crunchy", "texture", ["crunch"]),
  term("tender", "Tender", "texture"),

  term("tacos", "Tacos", "meal_style", ["taco", "taco night"]),
  term("bowls", "Bowls", "meal_style", ["bowl"]),
  term("soups", "Soups", "meal_style", ["soup"]),
  term("pasta", "Pasta", "meal_style"),
  term("grilled", "Grilled", "meal_style", ["grill", "grilling"]),
  term("curries", "Curries", "meal_style", ["curry", "curry bowls"]),
  term("sandwiches", "Sandwiches", "meal_style", ["sandwich"]),
  term("stews", "Stews", "meal_style", ["stew"]),
  term("stir-fries", "Stir-fries", "meal_style", ["stir fry", "stir-fry"]),

  term("mushrooms", "Mushrooms", "ingredient", ["mushroom"]),
  term("tofu", "Tofu", "ingredient"),
  term("salmon", "Salmon", "ingredient"),
  term("eggplant", "Eggplant", "ingredient", ["aubergine"]),
  term("swordfish", "Swordfish", "ingredient"),
  term("chickpeas", "Chickpeas", "ingredient", ["chickpea"]),
  term("shrimp", "Shrimp", "ingredient"),
  term("chicken", "Chicken", "ingredient"),
  term("lentils", "Lentils", "ingredient", ["lentil"]),
  term("cod", "Cod", "ingredient"),
  term("cauliflower", "Cauliflower", "ingredient"),
  term("soba", "Soba", "ingredient"),
  term("carrots", "Carrots", "ingredient", ["carrot"]),
  term("arctic-char", "Arctic char", "ingredient", ["arctic char"]),
  term("polenta", "Polenta", "ingredient"),
  term("rice-noodles", "Rice noodles", "ingredient", ["rice noodles"]),
  term("peaches", "Peaches", "ingredient", ["peach"]),
];

/**
 * Fold a search string to the alias key. Exact key match only.
 * No stemming and no partial contains.
 * @param {unknown} input
 */
export function normalizeTasteTerm(input) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function freezeTerm(row) {
  return Object.freeze({
    ...row,
    synonyms: Object.freeze([...row.synonyms]),
  });
}

/**
 * @param {TasteTerm[]} terms
 */
export function assertVocabulary(terms) {
  const slugs = new Set();
  /** @type {Map<string, string>} */
  const aliases = new Map();
  for (const row of terms) {
    if (!row.slug || slugs.has(row.slug)) {
      throw new Error(`taste vocabulary slug collision: ${row.slug}`);
    }
    slugs.add(row.slug);
    if (!VOCABULARY_CATEGORIES.includes(row.category)) {
      throw new Error(`taste vocabulary bad category: ${row.slug}`);
    }
    if (!row.display_name || typeof row.active !== "boolean") {
      throw new Error(`taste vocabulary incomplete: ${row.slug}`);
    }
    if (row.parent_slug && !terms.some((other) => other.slug === row.parent_slug)) {
      throw new Error(`taste vocabulary missing parent: ${row.slug}`);
    }
    if (row.parent_slug === row.slug) {
      throw new Error(`taste vocabulary self parent: ${row.slug}`);
    }
    const keys = [row.slug, row.display_name, ...(row.synonyms || [])];
    for (const key of keys) {
      const norm = normalizeTasteTerm(key);
      if (!norm) throw new Error(`taste vocabulary empty alias: ${row.slug}`);
      const prior = aliases.get(norm);
      if (prior && prior !== row.slug) {
        throw new Error(`taste vocabulary alias ${norm} maps to ${prior} and ${row.slug}`);
      }
      aliases.set(norm, row.slug);
    }
  }
  return aliases;
}

const CURATED = Object.freeze(TERMS.map(freezeTerm));
assertVocabulary([...CURATED]);

export function listVocabulary() {
  return CURATED;
}

/**
 * @param {string} slug
 * @param {TasteTerm[]} [vocabulary]
 */
export function getTasteTerm(slug, vocabulary = CURATED) {
  return vocabulary.find((row) => row.slug === slug) || null;
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || null;
}
