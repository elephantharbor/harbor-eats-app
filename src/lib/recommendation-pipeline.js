/**
 * candidate sources → eligibility → Taste scoring → fatigue → diversity → final N
 */

import { filterEligibleOptions } from "./eligibility.js";
import { gatherCandidates, catalogMealToOption } from "./candidate-providers.js";
import { scoreMealsForHousehold } from "./taste-model.js";
import { validateChoiceSetDiversity } from "./catalog-quality.js";

/**
 * @param {import('./recommendations.js').RecommendationContext} rec
 */
export function buildRankedChoiceSet(rec) {
  const ctx = { rec };
  const candidates = gatherCandidates(ctx);
  const catalogOptions = candidates.map((m) =>
    catalogMealToOption(m, "X", "pipeline")
  );
  const eligibleOpts = filterEligibleOptions(catalogOptions, rec.constraints);
  const eligibleSlugs = new Set(
    eligibleOpts.map((o) => {
      const attrs =
        typeof o.attributes_json === "string"
          ? JSON.parse(o.attributes_json)
          : o.attributes_json;
      return attrs?.recipe_slug;
    })
  );
  const eligibleMeals = candidates.filter((m) => eligibleSlugs.has(m.recipe_slug));

  let scored = scoreMealsForHousehold({
    meals: eligibleMeals,
    constraints: rec.constraints,
    evidence: rec.evidence,
    ratings: rec.ratings,
    recent_recipe_slugs: rec.recent_recipe_slugs,
    meal_choice_count: rec.settings.meal_choice_count,
    prefs: rec.settings.prefs,
    active_member_count: rec.active_member_count,
  });

  const count = Math.min(5, Math.max(3, rec.settings.meal_choice_count || 3));
  scored = applyChoiceSetDiversity(scored, count, rec.recent_recipe_slugs);

  return scored;
}

/**
 * @param {ReturnType<typeof scoreMealsForHousehold>} scored
 * @param {number} count
 * @param {string[]} recentSlugs
 */
function applyChoiceSetDiversity(scored, count, recentSlugs) {
  /** @type {typeof scored} */
  const picked = [];
  const usedSlugs = new Set();
  const usedPrimary = new Set();
  const usedCuisineFormat = new Set();

  for (const row of scored) {
    if (picked.length >= count) break;
    const m = row.meal;
    const cf = `${m.cuisine}:${m.meal_format}`;
    if (usedSlugs.has(m.recipe_slug)) continue;
    if (usedPrimary.has(m.primary_ingredient) && picked.length >= 2) continue;
    if (usedCuisineFormat.has(cf) && picked.length >= 2) continue;
    if (recentSlugs.includes(m.recipe_slug) && picked.length >= count - 1) continue;
    picked.push(row);
    usedSlugs.add(m.recipe_slug);
    usedPrimary.add(m.primary_ingredient);
    usedCuisineFormat.add(cf);
  }

  for (const row of scored) {
    if (picked.length >= count) break;
    if (!usedSlugs.has(row.meal.recipe_slug)) {
      picked.push(row);
      usedSlugs.add(row.meal.recipe_slug);
    }
  }

  const mealsOnly = picked.map((p) => p.meal);
  const divCheck = validateChoiceSetDiversity(mealsOnly);
  if (!divCheck.ok && picked.length >= 3) {
    const last = picked.pop();
    const replacement = scored.find(
      (s) =>
        !picked.some((p) => p.meal.recipe_slug === s.meal.recipe_slug) &&
        s.meal.recipe_slug !== last?.meal.recipe_slug
    );
    if (replacement) picked.push(replacement);
    else if (last) picked.push(last);
  }

  return picked.map((row, idx) => ({
    ...row,
    letter: ["A", "B", "C", "D", "E"][idx],
  }));
}
