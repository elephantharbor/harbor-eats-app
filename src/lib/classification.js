/**
 * D-03 catalog classification and D-01 planning-run preferences.
 * Culinary recipe text is not classified here. These enums describe the
 * frozen version; they are not a new recipe and they are not household Taste.
 */

export const EFFORT_LEVELS = Object.freeze(["easy", "moderate", "involved"]);
export const INGREDIENT_COMPLEXITIES = Object.freeze(["simple", "standard", "adventurous"]);

export const EFFORT_LABELS = Object.freeze({
  easy: "Easy",
  moderate: "Moderate",
  involved: "Involved",
});

/** Short card label. Standard and adventurous stay unlabeled in V1 (not D-07). */
export const COMPLEXITY_CARD_LABELS = Object.freeze({
  simple: "Simple ingredients",
  standard: "",
  adventurous: "",
});

export const CLASSIFICATION_BATCH_ID = "d03-classification-backfill-juniper-prep-r2";
export const CLASSIFICATION_ACTOR = "juniper";

/**
 * Both preferences on. Lower tier is chosen first. Effort stays put until
 * every ingredient band at that effort is exhausted, then effort relaxes.
 * Counts are the locked Juniper prep-r2 catalog (Vale re-check PASS 50/50):
 *   0 easy+simple 13
 *   1 easy+standard 3
 *   2 easy+adventurous 0
 *   3 moderate+simple 9
 *   4 moderate+standard 19
 *   5 moderate+adventurous 1
 *   6 involved+simple 0
 *   7 involved+standard 4
 *   8 involved+adventurous 1
 * Involved is admitted only after easier tiers cannot fill another distinct meal.
 */
export const BOTH_PREFS_RELAXATION = Object.freeze([
  ["easy", "simple"],
  ["easy", "standard"],
  ["easy", "adventurous"],
  ["moderate", "simple"],
  ["moderate", "standard"],
  ["moderate", "adventurous"],
  ["involved", "simple"],
  ["involved", "standard"],
  ["involved", "adventurous"],
]);

export function isEffortLevel(value) {
  return EFFORT_LEVELS.includes(value);
}

export function isIngredientComplexity(value) {
  return INGREDIENT_COMPLEXITIES.includes(value);
}

export function effortLabel(value) {
  return EFFORT_LABELS[value] || "";
}

export function complexityCardLabel(value) {
  return COMPLEXITY_CARD_LABELS[value] || "";
}

export function classificationPayload(effortLevel, ingredientComplexity) {
  return {
    effort_level: effortLevel,
    ingredient_complexity: ingredientComplexity,
  };
}

export function planningPreferences(intent) {
  return {
    keep_it_easy: intent?.keep_it_easy === true,
    keep_ingredients_simple: intent?.keep_ingredients_simple === true,
  };
}

export function preferencesActive(intent) {
  const prefs = planningPreferences(intent);
  return prefs.keep_it_easy || prefs.keep_ingredients_simple;
}

/**
 * @param {string|null|undefined} effortLevel
 * @param {string|null|undefined} ingredientComplexity
 * @param {{ keep_it_easy?: boolean, keep_ingredients_simple?: boolean }} prefs
 */
export function preferenceTier(effortLevel, ingredientComplexity, prefs) {
  const effortRank = EFFORT_LEVELS.indexOf(effortLevel);
  const complexityRank = INGREDIENT_COMPLEXITIES.indexOf(ingredientComplexity);
  const effort = effortRank < 0 ? EFFORT_LEVELS.length : effortRank;
  const complexity = complexityRank < 0 ? INGREDIENT_COMPLEXITIES.length : complexityRank;
  if (prefs?.keep_it_easy && prefs?.keep_ingredients_simple) {
    return effort * INGREDIENT_COMPLEXITIES.length + complexity;
  }
  if (prefs?.keep_it_easy) return effort;
  if (prefs?.keep_ingredients_simple) return complexity;
  return 0;
}

/**
 * A requested ingredient is a planning requirement. Meals that match it are
 * considered before preference relaxation. Minutes stay a score boost:
 * Keep it easy is not a duration filter.
 * @param {{ ingredient?: string, slug?: string, entry?: object }} feature
 * @param {object} intent
 * @param {(feature: object, slug: string) => boolean} matchesRequest
 */
export function requirementTier(feature, intent, matchesRequest) {
  if (!intent?.requested_ingredient) return 0;
  return matchesRequest(feature, intent.requested_ingredient) ? 0 : 1;
}
