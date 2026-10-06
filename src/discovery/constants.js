/**
 * D-07 Catalog Discovery constants.
 * Closed sets live here so the UI, the query parser, and the pipeline
 * cannot invent a parallel vocabulary.
 */

import { EFFORT_LEVELS, INGREDIENT_COMPLEXITIES } from "../lib/classification.js";

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
]);

export const EFFORT_FILTERS = EFFORT_LEVELS;
export const COMPLEXITY_FILTERS = INGREDIENT_COMPLEXITIES;

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
