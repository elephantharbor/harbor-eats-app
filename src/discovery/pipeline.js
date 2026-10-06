/**
 * D-07 pipeline. Stages are pure. Eligibility and taste scoring are injected
 * so this file does not reimplement diet rules. The defaults call the
 * existing server helpers.
 */

import { assessMealEligibility } from "../lib/dinner-planner.js";
import { PIPELINE_STAGES } from "./constants.js";
import { matchExplicitCriteria } from "./criteria.js";
import { matchMealText } from "./match.js";
import { applyNoveltyDiversityRecency } from "./novelty.js";
import { reasonCodesFor } from "./reasons.js";
import { softPreferenceFor } from "./soft-prefs.js";
import { scoreDiscoveryTaste } from "./taste.js";

function rowFrom(meal) {
  return {
    meal,
    match_score: 0,
    matched_criteria: [],
    preference_tier: 0,
    preference_relaxed: false,
    soft_keep_easy: false,
    soft_keep_simple: false,
    taste_score: 0,
    taste_hits: [],
    recent: false,
    exploration: meal.exploration || 0,
    cuisine: meal.cuisine || null,
    primary_ingredient: meal.primary_ingredient || null,
    diversity_preferred: false,
    novelty_tiebreak: false,
  };
}

function trace(state, stage) {
  const priorOut = state.trace.length ? state.trace[state.trace.length - 1].out : state.started;
  state.trace.push({
    stage,
    in: priorOut,
    out: state.rows.length,
    excluded: priorOut - state.rows.length,
  });
}

function exclude(state, row, stage, code, detail) {
  state.excluded.push({
    recipe_slug: row.meal.recipe_slug,
    code,
    stage,
    detail: detail || null,
  });
}

/**
 * Default hard check. Meals without a planner entry fail closed.
 * Tastes are passed through assessMealEligibility and do not grant permission.
 * @param {object} meal
 * @param {object} context
 */
export function eligibleByServer(meal, context) {
  if (!context.participant_ids?.length) {
    return { eligible: false, detail: "participants_required", code: "participants_required" };
  }
  if (!meal.entry) {
    return { eligible: false, detail: "missing_catalog_entry", code: "ineligible_hard_limit" };
  }
  const decision = assessMealEligibility(meal.entry, context.participant_ids, context.constraints, context.tastes);
  return {
    eligible: decision.eligible,
    detail: decision.eligible ? null : "hard_limit",
    code: "ineligible_hard_limit",
    blocked: decision.blocked,
  };
}

export function stageContext(state) {
  const excludeSlugs = new Set(state.context.exclude_slugs || []);
  const recent = new Set(state.context.recent_slugs || []);
  const next = [];
  for (const row of state.rows) {
    row.recent = recent.has(row.meal.recipe_slug);
    if (excludeSlugs.has(row.meal.recipe_slug)) {
      exclude(state, row, "context", "excluded_slug", null);
      continue;
    }
    next.push(row);
  }
  state.rows = next;
  if (!state.context.participant_ids?.length) {
    for (const row of state.rows) exclude(state, row, "context", "participants_required", null);
    state.rows = [];
  }
  trace(state, "context");
  return state;
}

export function stageHardEligibility(state, deps) {
  const isEligible = deps.isEligible || eligibleByServer;
  const next = [];
  for (const row of state.rows) {
    const decision = isEligible(row.meal, state.context);
    if (!decision || decision.eligible !== true) {
      const code = decision?.code === "participants_required" ? "participants_required" : "ineligible_hard_limit";
      exclude(state, row, "hard_eligibility", code, decision?.detail || null);
      continue;
    }
    next.push(row);
  }
  state.rows = next;
  trace(state, "hard_eligibility");
  return state;
}

export function stageTextMatch(state) {
  const next = [];
  for (const row of state.rows) {
    const matched = matchMealText(row.meal, state.query.text);
    if (!matched.match) {
      exclude(state, row, "text_match", "text_miss", null);
      continue;
    }
    row.match_score = matched.score;
    next.push(row);
  }
  state.rows = next;
  trace(state, "text_match");
  return state;
}

export function stageExplicitCriteria(state) {
  const next = [];
  for (const row of state.rows) {
    const matched = matchExplicitCriteria(row.meal, state.query.criteria, state.context);
    if (!matched.pass) {
      exclude(state, row, "explicit_criteria", matched.code, matched.detail);
      continue;
    }
    row.matched_criteria = matched.matched;
    next.push(row);
  }
  state.rows = next;
  trace(state, "explicit_criteria");
  return state;
}

export function stageSoftPrefs(state) {
  for (const row of state.rows) {
    const soft = softPreferenceFor(row.meal, state.context.soft);
    row.preference_tier = soft.preference_tier;
    row.preference_relaxed = soft.preference_relaxed;
    row.soft_keep_easy = soft.keep_it_easy;
    row.soft_keep_simple = soft.keep_ingredients_simple;
  }
  state.rows.sort((a, b) =>
    a.preference_tier - b.preference_tier
    || b.taste_score - a.taste_score
    || a.meal.recipe_slug.localeCompare(b.meal.recipe_slug)
  );
  trace(state, "soft_prefs");
  return state;
}

export function stageTasteRanking(state, deps) {
  const scoreTaste = deps.scoreTaste || scoreDiscoveryTaste;
  for (const row of state.rows) {
    const taste = scoreTaste(row.meal, state.context);
    if (taste?.excludes) {
      throw new Error("a taste rank cannot exclude a meal");
    }
    row.taste_score = Number(taste?.score) || 0;
    row.taste_hits = taste?.hits || [];
  }
  state.rows.sort((a, b) =>
    a.preference_tier - b.preference_tier
    || b.taste_score - a.taste_score
    || b.match_score - a.match_score
    || a.meal.recipe_slug.localeCompare(b.meal.recipe_slug)
  );
  trace(state, "taste_ranking");
  return state;
}

export function stageNovelty(state) {
  const planMeals = state.context.plan_meals || [];
  state.rows = applyNoveltyDiversityRecency(state.rows, planMeals);
  trace(state, "novelty");
  return state;
}

export function presentResult(row, query, rank) {
  const reasons = reasonCodesFor(row, query);
  const meal = row.meal;
  return {
    rank,
    recipe_slug: meal.recipe_slug,
    recipe_version_id: meal.recipe_version_id,
    recipe_id: meal.recipe_id,
    title: meal.title,
    cuisine: meal.cuisine,
    meal_format: meal.meal_format,
    primary_ingredient: meal.primary_ingredient,
    total_minutes: meal.total_minutes,
    effort_level: meal.effort_level,
    ingredient_complexity: meal.ingredient_complexity,
    exploration: meal.exploration,
    preference_tier: row.preference_tier,
    preference_relaxed: row.preference_relaxed,
    taste_score: row.taste_score,
    taste_hits: row.taste_hits,
    match_score: row.match_score,
    reasons: reasons.reasons,
    primary_reason: reasons.primary_reason,
  };
}

export function stageResults(state) {
  const ordered = state.rows.map((row, index) => presentResult(row, state.query, index + 1));
  const offset = state.query.offset || 0;
  const limit = state.query.limit;
  state.total = ordered.length;
  state.trace.push({ stage: "results", in: ordered.length, out: ordered.length, excluded: 0 });
  state.results = ordered.slice(offset, offset + limit);
  state.rows = state.rows.slice(offset, offset + limit);
  return state;
}

function exclusionCounts(excluded) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const row of excluded) counts[row.code] = (counts[row.code] || 0) + 1;
  return counts;
}

/**
 * @param {object[]} meals discovery meals
 * @param {object} query normalized query
 * @param {object} context resolved context, including effective soft prefs
 * @param {{ isEligible?: Function, scoreTaste?: Function }} [deps]
 */
export function runDiscoveryPipeline(meals, query, context, deps = {}) {
  const planSlugSet = new Set(context.plan_slugs || []);
  const plan_meals = (meals || [])
    .filter((meal) => planSlugSet.has(meal.recipe_slug))
    .map((meal) => ({
      recipe_slug: meal.recipe_slug,
      cuisine: meal.cuisine || null,
      primary_ingredient: meal.primary_ingredient || null,
    }));
  const state = {
    query,
    context: { ...context, soft: context.soft, plan_meals },
    rows: (meals || []).map(rowFrom),
    excluded: [],
    trace: [],
    started: (meals || []).length,
    results: [],
    total: 0,
  };
  stageContext(state);
  stageHardEligibility(state, deps);
  stageTextMatch(state);
  stageExplicitCriteria(state);
  stageSoftPrefs(state);
  stageTasteRanking(state, deps);
  stageNovelty(state);
  stageResults(state);
  const stages = state.trace.map((step) => step.stage);
  if (stages.join(",") !== PIPELINE_STAGES.join(",")) {
    throw new Error(`discovery pipeline order drifted: ${stages.join(",")}`);
  }
  return {
    ok: true,
    results: state.results,
    total: state.total,
    excluded: state.excluded,
    excluded_counts: exclusionCounts(state.excluded),
    trace: state.trace,
    stages,
  };
}
