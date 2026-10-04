/**
 * Rank Tonight's recipe-store meals with diner_taste.
 *
 * The live menu stays the recipe-store catalog. Cycle 2 packages supply
 * vocabulary tags for those same dishes. Love and Like nudge a matching meal
 * up. Less often nudges it down. No rank bans a meal, writes a hard limit, or
 * changes eligibility.
 *
 * Each row belongs to one diner. Scores are the sum of those nudges. They are
 * not a household average. A taste whose slug is on no package matches nothing.
 * Synthetic and unproven rows are ignored. An inferred row does not replace
 * an explicit one. This module does not learn tastes from ratings.
 */

import { TASTE_RANKS } from "./cycle2-schema.js";
import { tasteRankEffect } from "./preference-concepts.js";
import { canRecommend, projectLegacyCatalog } from "./recipe-package.js";
import { getTasteTerm } from "./taste-vocabulary.js";

/** Enough to move a meal past ordinary exploration noise, not past a hard limit. */
export const TASTE_NUDGE = Object.freeze({
  love: 1.5,
  like: 0.65,
  less_often: -1.15,
});

/** @type {Map<string, string[]>|null} */
let tagsByDish = null;

/**
 * Vocabulary slugs on the Cycle 2 package for a recipe-store dish.
 * buildCatalogPackage does not rewrite these ids; the legacy projection is
 * the same deterministic map, without pulling the catalog's file reader
 * into the Worker.
 * @param {string} slug
 * @returns {string[]}
 */
export function vocabularyTagsForSlug(slug) {
  if (!tagsByDish) {
    tagsByDish = new Map(
      projectLegacyCatalog().map((pkg) => [pkg.dish_id, Object.freeze([...(pkg.vocabulary_tag_ids || [])])])
    );
  }
  return tagsByDish.get(slug) || [];
}

/** Test seam. The catalog is static in production. */
export function resetVocabularyTagCache() {
  tagsByDish = null;
}

function joinNames(list) {
  if (list.length <= 1) return list.join("");
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function displayName(slug) {
  const term = getTasteTerm(slug);
  return term && term.active ? term.display_name : null;
}

/**
 * A recipe-store meal has no package publication fields and stays on the menu.
 * A package is admitted only when canRecommend says so: published, global,
 * and structurally valid. Draft, unpublished, invalid, and household-only
 * packages are not recommended.
 * @param {object} meal
 */
export function mealStaysOnLiveMenu(meal) {
  if (!meal) return false;
  const looksLikePackage =
    meal.publication_status != null || meal.visibility != null || meal.household_id != null;
  if (!looksLikePackage) return true;
  return canRecommend(meal);
}

export function keepLiveMenuMeals(meals) {
  return (meals || []).filter(mealStaysOnLiveMenu);
}

/**
 * @param {object} meal
 * @param {object[]|null|undefined} tastes
 */
export function scoreDinerTastes(meal, tastes) {
  const tags = new Set(
    meal && Object.prototype.hasOwnProperty.call(meal, "vocabulary_tag_ids")
      ? meal.vocabulary_tag_ids || []
      : vocabularyTagsForSlug(meal?.recipe_slug || meal?.dish_id || "")
  );
  /** @type {Map<string, object>} */
  const chosen = new Map();
  for (const row of tastes || []) {
    if (!row || !row.member_id || !row.vocabulary_slug) continue;
    if (row.data_origin !== "household") continue;
    if (!TASTE_RANKS.includes(row.rank)) continue;
    if (!tags.has(row.vocabulary_slug)) continue;
    const effect = tasteRankEffect(row.rank);
    if (effect.excludes || effect.ban || effect.allergy) {
      throw new Error("a taste rank cannot exclude a meal");
    }
    const key = `${row.member_id}\0${row.vocabulary_slug}`;
    const prior = chosen.get(key);
    const stance = row.stance === "inferred" ? "inferred" : "explicit";
    if (prior && prior.stance === "explicit" && stance === "inferred") continue;
    chosen.set(key, {
      member_id: row.member_id,
      vocabulary_slug: row.vocabulary_slug,
      rank: row.rank,
      stance,
      delta: TASTE_NUDGE[row.rank],
      excludes: false,
    });
  }
  const hits = [...chosen.values()];
  const score = hits.reduce((sum, hit) => sum + hit.delta, 0);
  return {
    score,
    hits,
    member_count: new Set(hits.map((hit) => hit.member_id)).size,
    excludes: false,
    averaged: false,
  };
}

/**
 * Sentences for hits that really matched this meal. No match, no sentence.
 * @param {object[]|null|undefined} hits
 */
export function tasteHitSentences(hits) {
  const rows = hits || [];
  const names = (rank) =>
    [...new Set(rows.filter((hit) => hit.rank === rank).map((hit) => displayName(hit.vocabulary_slug)).filter(Boolean))];
  const loves = names("love");
  const likes = names("like");
  const less = names("less_often");
  /** @type {string[]} */
  const sentences = [];
  if (loves.length) sentences.push(`You told us you love ${joinNames(loves.slice(0, 2))}`);
  if (likes.length) sentences.push(`You said you like ${joinNames(likes.slice(0, 2))}`);
  if (less.length) sentences.push(`${joinNames(less.slice(0, 2))} stays on the menu and sorts lower`);
  return sentences;
}
