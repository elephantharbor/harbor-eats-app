/**
 * D-07 Catalog Discovery constants.
 * Closed sets live here so the UI, the query parser, and the pipeline
 * cannot invent a parallel vocabulary.
 */

import { EFFORT_LEVELS, INGREDIENT_COMPLEXITIES } from "../lib/classification.js";
import { listVocabulary } from "../lib/taste-vocabulary.js";

export const DISCOVERY_SCHEMA_VERSION = 1;

export const DISCOVERY_MODES = Object.freeze([
  "standalone",
  "replace_plan_meal",
  "choose_for_plan",
]);

/** Published catalog ceiling. A page cannot ask for more than the catalog. */
export const DISCOVERY_DEFAULT_LIMIT = 20;
export const DISCOVERY_MAX_LIMIT = 50;
export const DISCOVERY_MAX_TEXT = 200;
export const DISCOVERY_MAX_LIST = 20;

/**
 * Quick is a clock. Thirty minutes matches the existing "under 30 minutes"
 * hint and the taste-model "Weeknight quick" fact. It is not effort_level
 * `easy`, and it is not the D-01 Keep it easy chip.
 */
export const QUICK_MAX_MINUTES = 30;

/**
 * Same band the dinner planner uses when it reorders inside a preference
 * tier. A clearly better taste score is not buried to vary the page.
 */
export const DISCOVERY_TASTE_BAND = 0.5;

/** Catalog exploration at or above this can win a tie inside that band. */
export const NOVELTY_EXPLORATION_MIN = 0.55;

export const PIPELINE_STAGES = Object.freeze([
  "context",
  "hard_eligibility",
  "text_match",
  "explicit_criteria",
  "soft_prefs",
  "taste_ranking",
  "novelty",
  "results",
]);

/** Meals removed before ranking. They are counts, not cards. */
export const EXCLUSION_CODES = Object.freeze([
  "excluded_slug",
  "ineligible_hard_limit",
  "participants_required",
  "text_miss",
  "explicit_effort",
  "explicit_complexity",
  "explicit_quick",
  "explicit_max_minutes",
  "explicit_cuisine",
  "explicit_meal_style",
  "explicit_flavor",
  "explicit_ingredient",
  "explicit_exclude_ingredient",
  "explicit_method",
  "explicit_equipment",
  "explicit_protein",
  "explicit_diet",
  "explicit_texture",
  "explicit_different",
]);

/**
 * Why a returned meal sits where it sits. Hard exclusions are not in this list.
 * `soft_keep_easy` is the D-01 chip. `explicit_effort` is the Discovery Easy
 * filter. They are different codes on purpose.
 */
export const RANK_REASON_CODES = Object.freeze([
  "taste_love",
  "taste_like",
  "explicit_effort",
  "explicit_quick",
  "explicit_max_minutes",
  "explicit_complexity",
  "explicit_ingredient",
  "explicit_exclude_ingredient",
  "explicit_cuisine",
  "explicit_meal_style",
  "explicit_flavor",
  "explicit_method",
  "explicit_equipment",
  "explicit_protein",
  "explicit_diet",
  "explicit_texture",
  "explicit_different",
  "text_match",
  "soft_keep_easy",
  "soft_keep_simple",
  "taste_less_often",
  "soft_pref_relaxed",
  "recent_demoted",
  "diversity_preferred",
  "novelty_tiebreak",
  "eligible_catalog_fit",
]);

/** First match in this list is the card's primary_reason. */
export const PRIMARY_REASON_PRIORITY = RANK_REASON_CODES;

export const CRITERIA_LIST_FIELDS = Object.freeze([
  "cuisines",
  "meal_styles",
  "flavors",
  "ingredients",
  "exclude_ingredients",
  "effort_levels",
  "ingredient_complexities",
  "methods",
  "equipment",
  "protein_groups",
  "diet",
  "textures",
]);

export const EFFORT_FILTERS = EFFORT_LEVELS;
export const COMPLEXITY_FILTERS = INGREDIENT_COMPLEXITIES;

/**
 * Seafood groups. `seafood` is the fish-or-shellfish collection.
 * Signals that fill these groups live on eligibility tags and allergens,
 * not on titles. See proteinGroupsFromSignals.
 */
export const PROTEIN_GROUP_FILTERS = Object.freeze(["fish", "seafood", "shellfish"]);

/** Eligibility-tag or allergen tokens that count as finfish. */
export const FISH_SIGNAL_TOKENS = Object.freeze(["finfish", "fish"]);

/** Eligibility-tag or allergen tokens that count as shellfish. */
export const SHELLFISH_SIGNAL_TOKENS = Object.freeze(["shellfish"]);

/**
 * Land protein in the same tag and allergen union keeps the meal out of
 * every seafood group. Fish sauce on a chicken pho is not a fish dinner.
 */
export const LAND_PROTEIN_TOKENS = Object.freeze(["meat", "poultry"]);

/**
 * Stored recipe_version dietary labels the catalog actually writes.
 * `plant` is the plant-forward collection; normalize adds `plant_based`
 * and `vegetarian`. There is no stored `vegan` label.
 */
export const DIET_FILTERS = Object.freeze(["dairy_free", "plant", "plant_based", "vegetarian"]);

/** Active Taste Vocabulary texture slugs. Flavor terms are not in this list. */
export const TEXTURE_FILTERS = Object.freeze(
  listVocabulary()
    .filter((term) => term.category === "texture" && term.active)
    .map((term) => term.slug)
    .sort((a, b) => a.localeCompare(b))
);

/**
 * Keys a client might send expecting them to mean something. They are
 * rejected so Quick, Easy, Simple, and pantry stay distinct.
 */
export const FORBIDDEN_QUERY_KEYS = Object.freeze([
  "constraints",
  "eligible",
  "pantry",
  "already_have",
  "effort",
  "simple",
  "easy",
  "quick_and_easy",
]);

export const QUERY_KEYS = Object.freeze([
  "schema_version",
  "text",
  "criteria",
  "soft",
  "limit",
  "offset",
]);

export const CRITERIA_KEYS = Object.freeze([
  ...CRITERIA_LIST_FIELDS,
  "max_minutes",
  "quick",
  "different",
]);

export const SOFT_KEYS = Object.freeze(["keep_it_easy", "keep_ingredients_simple"]);

export const CONTEXT_KEYS = Object.freeze([
  "mode",
  "dinner_plan_id",
  "meal_id",
  "position",
  "participant_ids",
  "exclude_slugs",
]);

export const FORBIDDEN_CONTEXT_KEYS = Object.freeze([
  "constraints",
  "eligible",
  "tastes",
  "catalog",
  "ratings",
  "pantry",
  "already_have",
]);
