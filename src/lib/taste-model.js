/**
 * Taste Model v1 — deterministic, scored, explainable recommendations.
 *
 * Explanations are proportional to stored evidence:
 * - repeat: this exact recipe was rated here
 * - known preference: a stored like matches the meal
 * - tentative similarity: a rated recipe shares a style tag (not a diet tag)
 * - exploration / starter: no taste claim at all
 */

import { scoreDinerTastes, tasteHitSentences } from "./diner-taste-rank.js";
import { MEAL_CATALOG } from "./meal-catalog.js";

const LETTERS = ["A", "B", "C", "D", "E"];

/**
 * Diet and protein tags say what a meal is safe for, not what it tastes like.
 * One rating on a plant meal must not read as evidence about every plant meal.
 */
const NON_STYLE_TAGS = new Set([
  "plant",
  "vegetarian",
  "dairy",
  "dairy-free",
  "nuts",
  "cashew",
  "peanut",
  "walnut",
  "almond",
  "pecan",
  "hazelnut",
  "pistachio",
  "macadamia",
  "pine-nut",
  "meat",
  "poultry",
  "fish",
  "finfish",
  "seafood",
  "shellfish",
]);

/** A repeat is "worth another round" only with more than one rating behind it. */
const REPEAT_SUCCESS_MIN_RATINGS = 2;
const REPEAT_SUCCESS_MIN_AVG = 8;
/** Similarity is a hunch until several ratings across different recipes agree. */
const SIMILAR_STRONG_MIN_RATINGS = 3;
const SIMILAR_STRONG_MIN_RECIPES = 2;
const SIMILAR_MIN_AVG = 7;
/** A stored like reads as a pattern only after repeated signals. */
const PATTERN_MIN_WEIGHT = 3;

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

function styleTags(tags) {
  return (tags || []).map((t) => String(t).toLowerCase()).filter((t) => !NON_STYLE_TAGS.has(t));
}

/** Tags and sparks overlap (tacos, crispy); count each once. */
function tasteTags(meal) {
  return [...new Set([...sparkTags(meal), ...mealTags(meal)])];
}

/**
 * @param {import('./meal-catalog.js').CatalogMeal} meal
 * @param {{ likes: Map<string, number>, dislikes: Map<string, number> }} ev
 */
function prefScore(meal, ev) {
  let s = 0;
  let hits = 0;
  for (const t of tasteTags(meal)) {
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

function average(rows) {
  if (!rows.length) return null;
  return rows.reduce((a, r) => a + Number(r.score), 0) / rows.length;
}

/**
 * Split stored ratings into this exact recipe and recipes that share a style tag.
 * @param {import('./meal-catalog.js').CatalogMeal} meal
 * @param {RatingRow[]} ratings
 * @param {string[]} recentSlugs
 */
export function ratingEvidence(meal, ratings, recentSlugs = []) {
  const slug = meal.recipe_slug;
  const style = new Set(styleTags(meal.tags));
  const exact = [];
  const similar = [];
  for (const r of ratings || []) {
    if (r.score == null) continue;
    if (r.recipe_slug && r.recipe_slug === slug) {
      exact.push(r);
      continue;
    }
    if (style.size && styleTags(r.tags).some((t) => style.has(t))) similar.push(r);
  }
  const similarSlugs = [...new Set(similar.map((r) => r.recipe_slug).filter(Boolean))];
  return {
    exact_avg: average(exact),
    exact_count: exact.length,
    similar_avg: average(similar),
    similar_count: similar.length,
    similar_slugs: similarSlugs,
    fatigue: recentSlugs.includes(slug) ? 2.5 : 0,
  };
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
export function scoreMealsForHousehold(input) {
  const {
    meals = MEAL_CATALOG,
    evidence = [],
    ratings = [],
    recent_recipe_slugs = [],
    meal_choice_count = 3,
    prefs = {},
    active_member_count = 2,
    diner_tastes = [],
  } = input;

  const ev = tagSetFromEvidence(evidence);
  const disagree = disagreementIndex(ratings);
  const explorationBoost = prefs.exploration_appetite === "adventurous" ? 0.15 : 0;

  /** @type {Array<{ meal: import('./meal-catalog.js').CatalogMeal, total: number, factors: Record<string, any>, confidence: string }>} */
  const scored = meals.map((meal) => {
    const pref = prefScore(meal, ev);
    const taste = scoreDinerTastes(meal, diner_tastes);
    const exp = ratingEvidence(meal, ratings, recent_recipe_slugs);
    let total = 5 + pref.score * 0.8 + taste.score;
    if (exp.exact_avg != null) total += (exp.exact_avg - 5.5) * 0.6;
    if (exp.similar_avg != null) {
      // Shrink toward neutral: one similar rating moves the score a quarter as far as an exact one.
      const weight = exp.similar_count / (exp.similar_count + 3);
      total += (exp.similar_avg - 5.5) * 0.6 * weight;
    }
    total -= exp.fatigue;
    total += meal.exploration * (0.5 + disagree * 0.4 + explorationBoost);
    if (isRepeatSuccess(exp)) total += 0.8;

    const evidenceCount = pref.hits + exp.exact_count * 2 + exp.similar_count + taste.hits.length;
    let confidence = "low";
    if (evidenceCount >= 6) confidence = "high";
    else if (evidenceCount >= 2) confidence = "medium";

    return {
      meal,
      total,
      factors: {
        pref_match: pref.score,
        pref_hits: pref.hits,
        experienced_avg: exp.exact_avg,
        experienced_count: exp.exact_count,
        similar_avg: exp.similar_avg,
        similar_count: exp.similar_count,
        similar_slugs: exp.similar_slugs,
        fatigue_penalty: exp.fatigue,
        exploration: meal.exploration,
        disagreement_index: disagree,
        eligible: true,
        diner_taste_nudge: taste.score,
        diner_taste_hits: taste.hits,
        diner_taste_excludes: false,
        diner_taste_averaged: false,
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
    explanation: buildWhy(row, ev, ratings.length, active_member_count),
  }));
}

/** @deprecated use scoreMealsForHousehold via recommendation-pipeline */
export function scoreCatalogMeals(input) {
  return scoreMealsForHousehold({ ...input, meals: MEAL_CATALOG });
}

function humanTag(tag) {
  const map = {
    crispy: "crispy textures",
    tacos: "taco night",
    curry: "curry bowls",
    fish: "fish dinners",
    finfish: "fish dinners",
    sheet: "easy sheet-pan dinners",
    "sheet-pan": "easy sheet-pan dinners",
    bright: "bright, citrusy flavors",
    plant: "plant-forward meals",
  };
  return map[tag] || tag.replace(/[_-]/g, " ");
}

function householdPhrase(activeCount) {
  if (activeCount >= 4) return "your crew";
  if (activeCount === 3) return "everyone in your kitchen";
  if (activeCount === 2) return "your household";
  return "your kitchen";
}

function fmtScore(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function titleForSlug(slug) {
  const meal = MEAL_CATALOG.find((m) => m.recipe_slug === slug);
  return meal ? meal.title || meal.name : null;
}

function joinPhrases(list) {
  if (list.length <= 1) return list.join("");
  return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
}

function isRepeatSuccess(exp) {
  return (
    exp.exact_count >= REPEAT_SUCCESS_MIN_RATINGS &&
    exp.exact_avg != null &&
    exp.exact_avg >= REPEAT_SUCCESS_MIN_AVG
  );
}

/**
 * @returns {{ kind: string, label: string, line: string, confidence: string, factors?: object }}
 */
export function buildWhy(row, ev, ratingCount, activeMemberCount = 2) {
  const crew = householdPhrase(activeMemberCount);
  const f = row.factors;
  const meal = row.meal;
  const tags = tasteTags(meal);
  const liked = [...new Set(tags.filter((t) => ev.likes.has(t)).map(humanTag))];
  const dislikedTag = tags.find((t) => ev.dislikes.has(t));
  const out = (kind, label, sentences) => {
    const parts = sentences.filter(Boolean);
    if (dislikedTag) parts.push(`Heads-up: it leans on ${humanTag(dislikedTag)}, which you've pushed back on`);
    return {
      kind,
      label,
      line: parts.slice(0, 2).join(". ") + ".",
      confidence: row.confidence,
      factors: f,
    };
  };
  const recent = f.fatigue_penalty > 0 ? "You made it recently, so it's here as a sure thing" : null;

  if (f.experienced_count > 0 && f.experienced_avg != null) {
    const avg = fmtScore(f.experienced_avg);
    if (isRepeatSuccess({ exact_count: f.experienced_count, exact_avg: f.experienced_avg })) {
      return out("repeat_success", "Worth another round", [`Rated ${avg}/10 on average when you made it`, recent]);
    }
    const first = f.experienced_count === 1 ? `You gave it ${avg}/10 last time` : `Rated ${avg}/10 on average last time`;
    return out("made_before", "Made it before", [first, recent]);
  }

  if (liked.length) {
    const strongest = Math.max(...tags.filter((t) => ev.likes.has(t)).map((t) => ev.likes.get(t)));
    const what = joinPhrases(liked.slice(0, 2));
    const sentence = strongest >= PATTERN_MIN_WEIGHT ? `You keep picking ${what}` : `You said you like ${what}`;
    return { ...out("known_preference", "Matches your likes", [sentence]), topic: what };
  }

  const tasteSentences = tasteHitSentences(f.diner_taste_hits);
  const positiveTaste = tasteSentences.filter((line) => !/sorts lower/.test(line));
  if (positiveTaste.length) {
    return {
      ...out("diner_taste", "Matches what you told us", tasteSentences.slice(0, 2)),
      topic: positiveTaste[0],
    };
  }

  if (f.similar_count > 0 && f.similar_avg != null && f.similar_avg >= SIMILAR_MIN_AVG) {
    const titles = (f.similar_slugs || []).map(titleForSlug).filter(Boolean);
    const avg = fmtScore(f.similar_avg);
    if (
      f.similar_count >= SIMILAR_STRONG_MIN_RATINGS &&
      titles.length >= SIMILAR_STRONG_MIN_RECIPES &&
      f.similar_avg >= REPEAT_SUCCESS_MIN_AVG
    ) {
      return out("similar_strong", "Your kind of dinner", [
        `Same family as ${joinPhrases(titles.slice(0, 2))}, which you rated ${avg}/10`,
      ]);
    }
    if (titles.length) {
      return out("similar_tentative", "Worth a try", [
        `A little like ${titles[0]}, which you rated ${avg}/10 — an early hunch, not a sure thing`,
      ]);
    }
  }

  if (f.exploration >= 0.55) {
    if (f.disagreement_index > 0.35) {
      return out("exploration", "Something new", [`A fresh middle ground while ${crew} sorts out shared favorites`]);
    }
    return out("exploration", "Something new", ["A fresh direction — your ratings will tell us if it's a keeper"]);
  }

  if (ratingCount === 0) {
    return out("starter", "Good starting point", [
      "Clears everyone's hard limits — a solid first dinner to learn from",
    ]);
  }
  return out("fit", "Fits your table", [`Clears ${crew}'s hard limits. Your next ratings will sharpen picks`]);
}

/** Labels that make no taste claim; safe to swap for a plain fact about the meal. */
const SWAPPABLE_KINDS = new Set(["starter", "fit", "exploration"]);

function factAlternatives(meal) {
  const alts = [];
  if (Number(meal.minutes) > 0 && Number(meal.minutes) <= 30) {
    alts.push({ label: "Weeknight quick", line: `On the table in about ${meal.minutes} minutes.` });
  }
  if (String(meal.effort || "").toLowerCase() === "easy") {
    alts.push({ label: "Easy win", line: "Low effort, and it clears everyone's hard limits." });
  }
  if (Number(meal.exploration) >= 0.5) {
    alts.push({ label: "Something new", line: "A fresh direction — your ratings will tell us if it's a keeper." });
  }
  alts.push({ label: "Fits your table", line: "Clears everyone's hard limits, no compromises." });
  return alts;
}

/**
 * Within one choice set, no two cards share a label + line, and claim-free
 * labels never repeat. Evidence labels are never swapped for a stronger claim.
 * @template {{ meal: any, explanation: { kind: string, label: string, line: string } }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function dedupeExplanations(rows) {
  const labels = new Set();
  const lines = new Set();
  return rows.map((row) => {
    let { label, line } = row.explanation;
    const swappable = SWAPPABLE_KINDS.has(row.explanation.kind);
    if (swappable && labels.has(label)) {
      const alt = factAlternatives(row.meal).find((a) => !labels.has(a.label));
      if (alt) {
        label = alt.label;
        line = alt.line;
      }
    }
    if (lines.has(line)) {
      if (swappable) {
        const alt = factAlternatives(row.meal).find((a) => !lines.has(a.line));
        if (alt) line = alt.line;
      } else if (row.explanation.topic) {
        line = `Same like, different dish: ${row.explanation.topic}.`;
      }
    }
    labels.add(label);
    lines.add(line);
    return { ...row, explanation: { ...row.explanation, label, line } };
  });
}

/**
 * Human-readable taste profile lines (no internal jargon).
 * Wording tracks how much evidence stands behind each line.
 */
export function buildTasteProfile(evidence, ratings) {
  const ev = tagSetFromEvidence(evidence);
  const likeEntries = [...ev.likes.entries()].sort((a, b) => b[1] - a[1]);
  const likes = [...new Set(likeEntries.slice(0, 5).map(([t]) => humanTag(t)))];
  const patterns = [...new Set(likeEntries.filter(([, w]) => w >= PATTERN_MIN_WEIGHT).map(([t]) => humanTag(t)))];
  const mentions = likes.filter((t) => !patterns.includes(t));
  const dislikes = [...new Set(
    [...ev.dislikes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => humanTag(t))
  )];

  const avg =
    ratings.length > 0
      ? ratings.reduce((a, r) => a + r.score, 0) / ratings.length
      : null;

  const lines = [];
  if (patterns.length) lines.push({ kind: "like", text: `You keep coming back to ${joinPhrases(patterns)}.` });
  if (mentions.length) lines.push({ kind: "like", text: `You've told us you're into ${joinPhrases(mentions)}.` });
  if (dislikes.length) lines.push({ kind: "avoid", text: `You've pushed back on ${joinPhrases(dislikes)}.` });
  if (avg != null) {
    lines.push({
      kind: "history",
      text:
        ratings.length === 1
          ? `Your first rating: ${avg.toFixed(1)}/10. One dinner in — still early days.`
          : `Dinners here average ${avg.toFixed(1)}/10 across ${ratings.length} ratings.`,
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
