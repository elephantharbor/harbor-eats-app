/**
 * Stage 5. D-01 run preferences as soft tiers.
 * This module does not drop a meal. Tier math is classification.preferenceTier.
 * Keep it easy is not the explicit Easy filter. Keep ingredients simple is
 * not a pantry check and not ingredient_complexity as a hard filter.
 */

import { planningPreferences, preferenceTier, preferencesActive } from "../lib/classification.js";

/**
 * @param {object} meal
 * @param {{ keep_it_easy: boolean, keep_ingredients_simple: boolean }} soft
 */
export function softPreferenceFor(meal, soft) {
  const prefs = planningPreferences(soft);
  const active = preferencesActive(soft);
  const tier = active ? preferenceTier(meal.effort_level, meal.ingredient_complexity, prefs) : 0;
  return {
    active,
    preference_tier: tier,
    preference_relaxed: active && tier > 0,
    keep_it_easy: prefs.keep_it_easy && meal.effort_level === "easy",
    keep_ingredients_simple: prefs.keep_ingredients_simple && meal.ingredient_complexity === "simple",
  };
}
