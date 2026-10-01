/**
 * Taste Model v1 — deterministic, scored, explainable recommendations.
 */

import { filterEligibleOptions } from "./eligibility.js";
import { MEAL_CATALOG, catalogMealToOption } from "./meal-catalog.js";

const LETTERS = ["A", "B", "C", "D", "E"];

/**
 * @typedef {{ tag: string, kind: string, weight: number, source?: string }} EvidenceRow
 * @typedef {{ recipe_slug?: string, score: number, member_id?: string, tags?: string[] }} RatingRow
 */

function tagSetFromEvidence(rows) {
  /** @type {Map<string, number>} */
  const likes = new Map();
  /** @type {Map<string, number>} */
  const dislikes = new Map();
  for (const r of rows || []) {
    const t = String(r.tag || "").toLowerCase();
    if (!t) continue;
    const w = Number(r.weight) || 1;
    if (r.kind === "dislike") dislikes.set(t, (dislikes.get(t) || 0) + w);
    else if (r.kind === "like") likes.set(t, (likes.get(t) || 0) + w);
  }
  return { likes, dislikes };
}

function mealTags(meal) {
  return (meal.tags || []).map((t) => String(t).toLowerCase());
}

function sparkTags(meal) {
  return (meal.sparks || []).map((t) => String(t).toLowerCase());
}

/**
 * @param {import('./meal-catalog.js').CatalogMeal} meal
 * @param {{ likes: Map<string, number>, dislikes: Map<string, number> }} ev
 */
function prefScore(meal, ev) {
  let s = 0;
  let hits = 0;
  for (const t of [...mealTags(meal), ...sparkTags(meal)]) {
    if (ev.likes.has(t)) {
      s += ev.likes.get(t);
      hits += 1;
    }
    if (ev.dislikes.has(t)) {
      s -= ev.dislikes.get(t) * 1.2;
      hits += 1;
    }
  }
  return { score: s, hits };
}

/**
 * @param {import('./meal-catalog.js').CatalogMeal} meal
 * @param {RatingRow[]} ratings
 * @param {string[]} recentSlugs
 */
function experiencedScore(meal, ratings, recentSlugs) {
  const slug = meal.recipe_slug;
  const related = (ratings || []).filter((r) => {
    if (r.recipe_slug === slug) return true;
    if (Array.isArray(r.tags) && r.tags.some((t) => mealTags(meal).includes(String(t).toLowerCase()))) {
      return true;
    }
    return false;
  });
  if (!related.length) return { avg: null, count: 0 };
  const avg = related.reduce((a, r) => a + r.score, 0) / related.length;
  let fatigue = 0;
  if (recentSlugs.includes(slug)) fatigue = 2.5;
  return { avg, count: related.length, fatigue };
}

function disagreementIndex(ratings) {
  const scores = (ratings || []).map((r) => r.score);
  if (scores.length < 2) return 0;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (Math.abs(max - min) >= 4 || (min <= 4 && max >= 8)) return 1;
  return (max - min) / 10;
}

/**
 * @param {object} input
 */
export function scoreCatalogMeals(input) {
  const {
    constraints = [],
    evidence = [],
    ratings = [],
    recent_recipe_slugs = [],
    meal_choice_count = 3,
    prefs = {},
  } = input;

  const catalogOptions = MEAL_CATALOG.map((m) =>
    catalogMealToOption(m, "X", "catalog")
  );
  const eligibleCatalog = filterEligibleOptions(catalogOptions, constraints);
  const eligibleSlugs = new Set(
    eligibleCatalog.map((o) => {
      const attrs =
        typeof o.attributes_json === "string"
          ? JSON.parse(o.attributes_json)
          : o.attributes_json;
      return attrs && attrs.recipe_slug;
    })
  );
  const meals = MEAL_CATALOG.filter((m) => eligibleSlugs.has(m.recipe_slug));

  const ev = tagSetFromEvidence(evidence);
  const disagree = disagreementIndex(ratings);
  const explorationBoost = prefs.exploration_appetite === "adventurous" ? 0.15 : 0;

  /** @type {Array<{ meal: import('./meal-catalog.js').CatalogMeal, total: number, factors: Record<string, number|boolean|string|null>, confidence: string }>} */
  const scored = meals.map((meal) => {
    const pref = prefScore(meal, ev);
    const exp = experiencedScore(meal, ratings, recent_recipe_slugs);
    let total = 5 + pref.score * 0.8;
    if (exp.avg != null) total += (exp.avg - 5.5) * 0.6;
    total -= exp.fatigue || 0;
    total += meal.exploration * (0.5 + disagree * 0.4 + explorationBoost);
    if (exp.avg != null && exp.avg >= 8) total += 0.8;

    const evidenceCount = pref.hits + exp.count + evidence.length;
    let confidence = "low";
    if (evidenceCount >= 6) confidence = "high";
    else if (evidenceCount >= 2) confidence = "medium";

    return {
      meal,
      total,
      factors: {
        pref_match: pref.score,
        pref_hits: pref.hits,
        experienced_avg: exp.avg,
        experienced_count: exp.count,
        fatigue_penalty: exp.fatigue || 0,
        exploration: meal.exploration,
        disagreement_index: disagree,
        eligible: true,
      },
      confidence,
    };
  });

  scored.sort((a, b) => b.total - a.total);

  const count = Math.min(5, Math.max(3, meal_choice_count));
  let picked = scored.slice(0, count);

  if (picked.length >= 3 && disagree > 0.35) {
    const exploreCandidate = scored.find(
      (s) => s.meal.exploration >= 0.55 && !picked.slice(0, 2).includes(s)
    );
    if (exploreCandidate && picked.length >= 3) {
      picked = [...picked.slice(0, count - 1), exploreCandidate];
    }
  }

  return picked.map((row, idx) => ({
    ...row,
    letter: LETTERS[idx],
    explanation: buildWhy(row, ev, ratings.length),
  }));
}

function humanTag(tag) {
  const map = {
    crispy: "crispy textures",
    tacos: "taco night",
    curry: "curry bowls",
    fish: "finfish",
    sheet: "easy sheet-pan dinners",
    bright: "bright, citrusy flavors",
    plant: "plant-forward meals",
  };
  return map[tag] || tag.replace(/_/g, " ");
}

function buildWhy(row, ev, ratingCount) {
  const parts = [];
  const meal = row.meal;
  const tags = [...sparkTags(meal), ...mealTags(meal)];
  const liked = tags.filter((t) => ev.likes.has(t));
  const disliked = tags.filter((t) => ev.dislikes.has(t));

  if (liked.length) {
    parts.push(`Matches what you've said you like (${liked.slice(0, 2).map(humanTag).join(", ")})`);
  }
  if (row.factors.experienced_avg != null && row.factors.experienced_count > 0) {
    parts.push(
      `Similar meals rated around ${row.factors.experienced_avg.toFixed(1)}/10 here`
    );
  }
  if (row.factors.fatigue_penalty > 0) {
    parts.push("We'd normally wait — but it's still a strong fit tonight");
  } else if (row.factors.exploration >= 0.55 && row.factors.disagreement_index > 0.35) {
    parts.push("A small stretch while you two calibrate tastes");
  } else if (row.factors.exploration >= 0.55) {
    parts.push("A gentle try-something-new slot");
  }
  if (disliked.length) {
    parts.push(`Note: touches ${humanTag(disliked[0])} — double-check if that's still OK`);
  }

  if (!parts.length) {
    if (ratingCount === 0) {
      return {
        label: "Good starting point",
        line: "Fits your household diet limits. We'll personalize more after you cook and rate.",
        confidence: row.confidence,
      };
    }
    return {
      label: "Fits your kitchen",
      line: "Clears everyone's hard limits. Not much history yet — ratings will sharpen this.",
      confidence: row.confidence,
    };
  }

  let label = "Why this";
  if (row.factors.exploration >= 0.55 && !liked.length) label = "Trying something new";
  else if (row.factors.experienced_avg != null && row.factors.experienced_avg >= 8) label = "Likely crowd-pleaser";

  return {
    label,
    line: parts.slice(0, 2).join(". ") + ".",
    confidence: row.confidence,
    factors: row.factors,
  };
}

/**
 * Human-readable taste profile lines (no internal jargon).
 */
export function buildTasteProfile(evidence, ratings) {
  const ev = tagSetFromEvidence(evidence);
  const likes = [...ev.likes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => humanTag(t));
  const dislikes = [...ev.dislikes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => humanTag(t));

  const avg =
    ratings.length > 0
      ? ratings.reduce((a, r) => a + r.score, 0) / ratings.length
      : null;

  const lines = [];
  if (likes.length) lines.push({ kind: "like", text: `You tend to enjoy ${likes.join(", ")}.` });
  if (dislikes.length) lines.push({ kind: "avoid", text: `You've pushed back on ${dislikes.join(", ")}.` });
  if (avg != null) {
    lines.push({
      kind: "history",
      text: `Meals you've rated together average ${avg.toFixed(1)}/10 so far.`,
    });
  }
  if (!lines.length) {
    lines.push({
      kind: "starter",
      text: "We're still learning — cook a few dinners and rate them to sharpen picks.",
    });
  }
  return { lines, likes, dislikes, meals_rated: ratings.length };
}

export { LETTERS };
