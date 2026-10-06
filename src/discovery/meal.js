/**
 * Flat catalog row the pipeline matches against.
 * Built from a planner entry (`concept` + `pkg`) so Discovery uses the
 * published D1 shape the dinner planner already uses.
 */

import { canonicalIngredient } from "../lib/ingredient-identity.js";
import { getTasteTerm } from "../lib/taste-vocabulary.js";
import {
  FISH_SIGNAL_TOKENS,
  LAND_PROTEIN_TOKENS,
  SHELLFISH_SIGNAL_TOKENS,
} from "./constants.js";

function classifyTags(ids) {
  /** @type {string[]} */
  const flavors = [];
  /** @type {string[]} */
  const styles = [];
  /** @type {string[]} */
  const cuisines = [];
  /** @type {string[]} */
  const ingredients = [];
  /** @type {string[]} */
  const textures = [];
  for (const slug of ids || []) {
    const term = getTasteTerm(slug);
    if (!term || !term.active) continue;
    if (term.category === "flavor") flavors.push(slug);
    else if (term.category === "meal_style") styles.push(slug);
    else if (term.category === "cuisine") cuisines.push(slug);
    else if (term.category === "ingredient") ingredients.push(slug);
    else if (term.category === "texture") textures.push(term.slug);
  }
  return { flavors, styles, cuisines, ingredients, textures };
}

function tokenSet(list) {
  return unique((list || []).map((token) => String(token).trim().toLowerCase()));
}

/**
 * Seafood groups from eligibility tags and allergens only.
 * `fish` is finfish or fish. `shellfish` is shellfish. `seafood` is either.
 * Meat or poultry in that same union yields no group, so a poultry dish
 * that merely contains fish sauce stays out. A missing signal yields no
 * group. Titles, primary ingredients, and ingredient vocabulary are not read.
 * @param {string[]} tokens
 * @returns {string[]}
 */
export function proteinGroupsFromSignals(tokens) {
  const present = new Set(tokenSet(tokens));
  if (LAND_PROTEIN_TOKENS.some((token) => present.has(token))) return [];
  /** @type {string[]} */
  const groups = [];
  if (FISH_SIGNAL_TOKENS.some((token) => present.has(token))) groups.push("fish");
  if (SHELLFISH_SIGNAL_TOKENS.some((token) => present.has(token))) groups.push("shellfish");
  if (groups.length) groups.push("seafood");
  groups.sort((a, b) => a.localeCompare(b));
  return groups;
}

function activeTextureSlug(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const term = getTasteTerm(value.trim().toLowerCase());
  if (!term || !term.active || term.category !== "texture") return null;
  return term.slug;
}

function collectionFields({ eligibility_tags, allergens, dietary_labels, texture, grouped }) {
  const tags = tokenSet(eligibility_tags);
  const allergy = tokenSet(allergens);
  return {
    eligibility_tags: tags,
    allergens: allergy,
    dietary_labels: tokenSet(dietary_labels),
    textures: unique([...(grouped.textures || []), activeTextureSlug(texture)]),
    protein_groups: proteinGroupsFromSignals([...tags, ...allergy]),
  };
}

function unique(list) {
  return [...new Set((list || []).filter(Boolean))];
}

/**
 * @param {object} entry planner catalog entry, or a record with concept/pkg
 */
export function projectDiscoveryMeal(entry) {
  const concept = entry?.concept || {};
  const pkg = entry?.pkg || {};
  const vocabulary = unique(pkg.vocabulary_tag_ids || []);
  const grouped = classifyTags(vocabulary);
  const ingredient_ids = [];
  const ingredient_names = [];
  for (const item of pkg.ingredients || []) {
    const named = item.ingredient_id || canonicalIngredient(item.name, item.note).ingredient_id;
    if (named && named !== "unknown") ingredient_ids.push(named);
    if (item.name) ingredient_names.push(String(item.name));
  }
  const cuisine = concept.cuisine || grouped.cuisines[0] || null;
  const collections = collectionFields({
    eligibility_tags: concept.tags,
    allergens: pkg.allergens,
    dietary_labels: pkg.dietary_labels,
    texture: concept.texture,
    grouped,
  });
  return {
    recipe_slug: concept.concept_id || pkg.dish_id || null,
    recipe_version_id: pkg.recipe_version_id || null,
    recipe_id: pkg.recipe_id || null,
    title: pkg.title || concept.title || concept.name || "",
    cuisine,
    meal_format: concept.meal_format || null,
    primary_ingredient: concept.primary_ingredient || grouped.ingredients[0] || null,
    flavor_profile: concept.flavor_profile || null,
    vocabulary_tag_ids: vocabulary,
    flavors: grouped.flavors,
    styles: grouped.styles,
    cuisines: unique([cuisine, ...grouped.cuisines]),
    ...collections,
    ingredient_ids: unique(ingredient_ids),
    ingredient_names,
    total_minutes: pkg.total_minutes == null ? null : pkg.total_minutes,
    effort_level: pkg.effort_level || null,
    ingredient_complexity: pkg.ingredient_complexity || null,
    methods: unique([...(pkg.methods || []), ...(concept.current_version?.methods || [])]),
    equipment: unique(pkg.equipment || []),
    exploration: Number.isFinite(concept.exploration) ? concept.exploration : Number(pkg.exploration) || 0,
    entry,
  };
}

/**
 * Test and fixture rows. Production search projects planner entries.
 * A flat row has no `entry`, so the default eligibility adapter fails closed
 * unless the caller injects `isEligible`.
 * @param {object} partial
 */
export function discoveryMeal(partial) {
  const vocabulary = unique(partial.vocabulary_tag_ids || []);
  const grouped = vocabulary.length ? classifyTags(vocabulary) : {
    flavors: partial.flavors || [],
    styles: partial.styles || [],
    cuisines: partial.cuisines || [],
    ingredients: [],
  };
  const cuisine = partial.cuisine || grouped.cuisines[0] || null;
  const collections = collectionFields({
    eligibility_tags: partial.eligibility_tags,
    allergens: partial.allergens,
    dietary_labels: partial.dietary_labels,
    texture: partial.texture,
    grouped,
  });
  return {
    recipe_slug: partial.recipe_slug,
    recipe_version_id: partial.recipe_version_id || `rv_${partial.recipe_slug}_v2`,
    recipe_id: partial.recipe_id || `rcp_${partial.recipe_slug}`,
    title: partial.title || partial.recipe_slug,
    cuisine,
    meal_format: partial.meal_format || null,
    primary_ingredient: partial.primary_ingredient || null,
    flavor_profile: partial.flavor_profile || null,
    vocabulary_tag_ids: vocabulary,
    flavors: partial.flavors || grouped.flavors,
    styles: partial.styles || grouped.styles,
    cuisines: unique(partial.cuisines || [cuisine, ...grouped.cuisines]),
    ...collections,
    ingredient_ids: unique(partial.ingredient_ids || []),
    ingredient_names: partial.ingredient_names || [],
    total_minutes: partial.total_minutes == null ? null : partial.total_minutes,
    effort_level: partial.effort_level || null,
    ingredient_complexity: partial.ingredient_complexity || null,
    methods: unique(partial.methods || []),
    equipment: unique(partial.equipment || []),
    exploration: partial.exploration == null ? 0 : partial.exploration,
    entry: partial.entry || null,
  };
}
