/**
 * Stage 7. Novelty, diversity, and recency reorder inside a preference tier.
 * They do not drop a meal and they do not cross a tier boundary.
 * Recency is the household's recent cook slugs. It is not a hard hide.
 * Plan meals already chosen count as used cuisines and ingredients so the
 * page can lead somewhere else when taste is inside the band.
 */

import { DISCOVERY_TASTE_BAND } from "./constants.js";

function better(a, b, usedCuisine, usedIngredient) {
  const key = (row) => [
    row.recent ? 1 : 0,
    aCuisineUsed(row, usedCuisine),
    aIngredientUsed(row, usedIngredient),
    -(Number(row.exploration) || 0),
    row.meal.recipe_slug,
  ];
  const left = key(a);
  const right = key(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return true;
    if (left[index] > right[index]) return false;
  }
  return false;
}

function aCuisineUsed(row, usedCuisine) {
  return row.cuisine && usedCuisine.has(row.cuisine) ? 1 : 0;
}

function aIngredientUsed(row, usedIngredient) {
  return row.primary_ingredient && usedIngredient.has(row.primary_ingredient) ? 1 : 0;
}

function whyAhead(winner, head, usedCuisine, usedIngredient) {
  if (head.recent && !winner.recent) return "recent";
  const cuisine = aCuisineUsed(head, usedCuisine) === 1 && aCuisineUsed(winner, usedCuisine) === 0;
  const ingredient = aIngredientUsed(head, usedIngredient) === 1 && aIngredientUsed(winner, usedIngredient) === 0;
  if (cuisine || ingredient) return "diversity";
  if ((Number(winner.exploration) || 0) > (Number(head.exploration) || 0)) return "novelty";
  return null;
}

function reorderBand(band, planMeals) {
  const pool = band.slice();
  const usedCuisine = new Set((planMeals || []).map((meal) => meal.cuisine).filter(Boolean));
  const usedIngredient = new Set((planMeals || []).map((meal) => meal.primary_ingredient).filter(Boolean));
  /** @type {object[]} */
  const picked = [];
  while (pool.length) {
    let bestIndex = 0;
    for (let index = 1; index < pool.length; index += 1) {
      if (better(pool[index], pool[bestIndex], usedCuisine, usedIngredient)) bestIndex = index;
    }
    const head = pool[0];
    const winner = pool[bestIndex];
    if (winner !== head) {
      const cause = whyAhead(winner, head, usedCuisine, usedIngredient);
      if (cause === "diversity") winner.diversity_preferred = true;
      if (cause === "novelty") winner.novelty_tiebreak = true;
    }
    pool.splice(bestIndex, 1);
    picked.push(winner);
    if (winner.cuisine) usedCuisine.add(winner.cuisine);
    if (winner.primary_ingredient) usedIngredient.add(winner.primary_ingredient);
  }
  return picked;
}

/**
 * @param {object[]} rows sorted by preference tier, then taste score, then slug
 * @param {object[]} [planMeals] `{ cuisine, primary_ingredient }` already on the plan
 */
export function applyNoveltyDiversityRecency(rows, planMeals = []) {
  /** @type {Map<number, object[]>} */
  const byTier = new Map();
  for (const row of rows) {
    const tier = row.preference_tier || 0;
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier).push(row);
  }
  /** @type {object[]} */
  const ordered = [];
  for (const tier of [...byTier.keys()].sort((a, b) => a - b)) {
    const group = byTier.get(tier);
    const best = group[0]?.taste_score ?? 0;
    const band = [];
    const rest = [];
    for (const row of group) {
      if (row.taste_score >= best - DISCOVERY_TASTE_BAND) band.push(row);
      else rest.push(row);
    }
    ordered.push(...reorderBand(band, planMeals));
    ordered.push(...rest);
  }
  return ordered;
}
