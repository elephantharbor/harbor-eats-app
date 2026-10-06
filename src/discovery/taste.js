/**
 * Stage 6. Taste ranking through the existing diner-taste scorer.
 * Less often lowers a meal. It does not remove it. This stage does not
 * call scoreMealsForHousehold or buildRankedChoiceSet: those return a
 * 3–5 choice set and fold recency into the score. Discovery keeps the
 * full set and applies recency in stage 7.
 */

import { scoreDinerTastes } from "../lib/diner-taste-rank.js";

/**
 * @param {object} meal
 * @param {object} context
 */
export function scoreDiscoveryTaste(meal, context) {
  const participants = new Set(context.participant_ids || []);
  const tastes = (context.tastes || []).filter((row) => !row?.member_id || participants.has(row.member_id));
  const taste = scoreDinerTastes(
    {
      recipe_slug: meal.recipe_slug,
      vocabulary_tag_ids: meal.vocabulary_tag_ids || [],
    },
    tastes
  );
  return {
    score: taste.score,
    hits: taste.hits,
    excludes: taste.excludes === true,
  };
}
