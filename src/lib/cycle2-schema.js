/**
 * Cycle 2 shared contract: taste vocabulary, three preference types,
 * and the recipe package. Later workstreams implement UX and catalog
 * content against these ids. This module does not render UI or rewrite
 * recipe prose.
 */

export const VOCABULARY_CATEGORIES = [
  "cuisine",
  "flavor",
  "texture",
  "meal_style",
  "ingredient",
];

export const CATEGORY_LABELS = {
  cuisine: "Cuisine",
  flavor: "Flavor",
  texture: "Texture",
  meal_style: "Meal style",
  ingredient: "Ingredient",
};

/** Personal tastes rank only. They never decide eligibility. */
export const TASTE_RANKS = ["love", "like", "less_often"];

export const TASTE_RANK_LABELS = {
  love: "Love",
  like: "Like",
  less_often: "Less often",
};

/** Removing a taste deletes that diner's row. It is not a stored ban. */
export const TASTE_REMOVE = "remove";

export const EVIDENCE_STANCES = ["explicit", "inferred"];

export const STANCE_LABELS = {
  explicit: "You told us",
  inferred: "We're learning",
};

/**
 * Hard dietary limits. Finfish permission is the absence of no_finfish.
 * It is never a taste rank.
 */
export const HARD_LIMIT_IDS = [
  "allergy",
  "prohibited_ingredient",
  "no_meat",
  "no_poultry",
  "no_shellfish",
  "no_dairy",
  "no_nuts",
  "no_finfish",
];

/** Relaxes no_nuts for cashew only. It does not relax any other limit. */
export const CASHEW_PERMITTED = "cashew_permitted";

export const HARD_LIMIT_LABELS = {
  allergy: "Allergy",
  prohibited_ingredient: "Prohibited ingredient",
  no_meat: "No meat",
  no_poultry: "No poultry",
  no_shellfish: "No shellfish",
  no_dairy: "No dairy",
  no_nuts: "No nuts",
  no_finfish: "No finfish",
  cashew_permitted: "Cashews are OK",
};

/**
 * Planning hints. Always overridable. Not eligibility and not taste evidence.
 * equipment requires a detail string (sheet-pan, grill, skillet, ...).
 */
export const PRACTICAL_HINT_KEYS = [
  "under_30_minutes",
  "low_cleanup",
  "grill_friendly",
  "equipment",
  "weeknight",
];

export const PRACTICAL_HINT_LABELS = {
  under_30_minutes: "Under 30 minutes",
  low_cleanup: "Low cleanup",
  grill_friendly: "Grill-friendly",
  equipment: "Equipment",
  weeknight: "Weeknight",
};

/**
 * Optional chips on one cooked meal. They are not a survey and they do
 * not write a standing taste or a hard limit by themselves.
 */
export const TARGETED_FEEDBACK_CODES = [
  "loved_the_crunch",
  "too_spicy",
  "great_sauce",
  "too_rich",
];

export const TARGETED_FEEDBACK = {
  loved_the_crunch: {
    code: "loved_the_crunch",
    label: "Loved the crunch",
    signal: "loved",
    vocabulary_slug: "crispy",
  },
  too_spicy: {
    code: "too_spicy",
    label: "Too spicy",
    signal: "too_much",
    vocabulary_slug: "spicy",
  },
  great_sauce: {
    code: "great_sauce",
    label: "Great sauce",
    signal: "loved",
    vocabulary_slug: null,
  },
  too_rich: {
    code: "too_rich",
    label: "Too rich",
    signal: "too_much",
    vocabulary_slug: "rich",
  },
};

export const RECIPE_PROVENANCE = [
  "original_team_created",
  "licensed",
  "ai_assisted",
  "household_submitted",
  "unknown_unverified",
];

export const IMAGE_PROVENANCE = [
  "original_photo",
  "licensed_photo",
  "ai_illustration",
  "unknown",
];

export const RIGHTS_STATES = [
  "not_cleared_for_external_release",
  "cleared_for_external_release",
  "unknown",
];

export const PUBLICATION_STATUSES = ["draft", "published", "unpublished", "invalid"];

export const PACKAGE_VISIBILITY = ["global", "household"];

/** Cycle 1 origin values. New learning tables keep this set. */
export const DATA_ORIGINS = ["household", "synthetic", "unproven"];

export const CONTRACT_TABLES = {
  taste_vocabulary: "taste_vocabulary",
  diner_taste: "diner_taste",
  diner_practical_hint: "diner_practical_hint",
  recipe: "recipe",
  recipe_package_version: "recipe_package_version",
  shopped_plan_line: "shopped_plan_line",
  targeted_feedback: "targeted_feedback",
};

/**
 * BBQ is the flavor Smoky. There is no separate barbecue vocabulary row.
 * Search resolves these aliases and does not insert one.
 */
export const BBQ_RESOLUTION = {
  vocabulary_slug: "smoky",
  category: "flavor",
  aliases: ["bbq", "barbecue", "barbeque", "bar-b-que", "bar b que", "smoked"],
};
