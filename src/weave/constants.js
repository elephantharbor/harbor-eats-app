/** Closed sets for D-06 weave (architecture decision card §1). */

export const INTENT_CUES = Object.freeze([
  "cozy",
  "fresh",
  "filling",
  "light",
  "comforting",
  "summery",
  "special",
  "restaurant_like",
  "weeknight",
]);

export const WEEKDAYS = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const PLAN_PROTEIN_TOKENS = Object.freeze(["fish", "seafood", "shellfish"]);

export const PLAN_STYLE_TOKENS = Object.freeze([
  "tacos",
  "bowls",
  "soups",
  "pasta",
  "grilled",
  "curries",
  "sandwiches",
  "stews",
  "stir-fries",
]);

export const PLAN_DIET_TOKENS = Object.freeze(["plant"]);

export const PLAN_INGREDIENT_TOKENS = Object.freeze([
  "mushrooms",
  "tofu",
  "salmon",
  "eggplant",
  "swordfish",
  "chickpeas",
  "shrimp",
  "chicken",
  "lentils",
  "cod",
  "cauliflower",
  "soba",
  "carrots",
  "arctic-char",
  "polenta",
  "rice-noodles",
  "peaches",
]);

/** Full PLAN_TOKENS enum for frequencies, exclude_categories, slot categories. */
export const PLAN_TOKENS = Object.freeze([
  ...PLAN_PROTEIN_TOKENS,
  ...PLAN_STYLE_TOKENS,
  ...PLAN_DIET_TOKENS,
  ...PLAN_INGREDIENT_TOKENS,
]);

export const PLANNING_CLEAR_FIELDS = Object.freeze([
  "dinner_count",
  "date_start",
  "date_end",
  "keep_it_easy",
  "keep_ingredients_simple",
  "max_minutes",
  "max_minutes_hard",
  "effort",
  "ingredient_complexity",
  "ingredient_complexity_hard",
  "special_count",
  "cuisines",
  "meal_styles",
  "include_ingredients",
  "exclude_ingredients",
  "exclude_categories",
  "frequencies",
  "intent_cues",
  "slots",
]);

export const DISCOVERY_CLEAR_FIELDS = Object.freeze([
  "text_residue",
  "max_minutes",
  "max_minutes_hard",
  "quick",
  "different",
  "keep_it_easy",
  "keep_ingredients_simple",
  "cuisines",
  "meal_styles",
  "flavors",
  "ingredients",
  "exclude_ingredients",
  "methods",
  "equipment",
  "textures",
  "effort_levels",
  "ingredient_complexities",
  "protein_groups",
  "diet",
  "intent_cues",
]);

export const AUTHORITY_CLAIMS =
  /\b(allergen[- ]?free|safe for (?:your|people|those|anyone)|nut[- ]?free|gluten[- ]?free|dairy[- ]?free|guaranteed|certified|eligible for)\b/i;
