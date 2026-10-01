import { MEAL_CATALOG, catalogMealToOption } from "./meal-catalog.js";
import { parseHouseholdSettings } from "./household-settings.js";
import { scoreCatalogMeals, LETTERS } from "./taste-model.js";

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 */
export async function loadRecommendationContext(db, household_id) {
  const hh = await db
    .prepare(
      `SELECT household_id, display_name, meal_choice_count, scheduling_cadence, settings_json
       FROM household WHERE household_id = ?`
    )
    .bind(household_id)
    .first();

  const constraintsRes = await db
    .prepare(`SELECT member_id, rule_key, status FROM constraint_rule WHERE household_id = ?`)
    .bind(household_id)
    .all();

  const evidenceRes = await db
    .prepare(
      `SELECT tag, kind, weight, source, member_id FROM preference_evidence
       WHERE household_id = ? ORDER BY created_at DESC LIMIT 200`
    )
    .bind(household_id)
    .all();

  const ratingsRes = await db
    .prepare(
      `SELECT r.score, r.member_id, mo.recipe_slug, mo.attributes_json
       FROM rating r
       JOIN meal_option mo ON mo.meal_option_id = r.meal_option_id
       WHERE r.household_id = ?
       ORDER BY r.updated_at DESC LIMIT 100`
    )
    .bind(household_id)
    .all();

  const recentCooks = await db
    .prepare(
      `SELECT mo.recipe_slug FROM cook c
       JOIN meal_option mo ON mo.meal_option_id = c.meal_option_id
       WHERE c.household_id = ?
       ORDER BY c.cooked_at DESC LIMIT 8`
    )
    .bind(household_id)
    .all();

  const settings = parseHouseholdSettings(hh);
  const ratings = (ratingsRes.results || []).map((r) => {
    let tags = [];
    try {
      const attrs = r.attributes_json ? JSON.parse(r.attributes_json) : null;
      if (attrs && Array.isArray(attrs.tags)) tags = attrs.tags;
    } catch { /* ignore */ }
    return {
      score: r.score,
      member_id: r.member_id,
      recipe_slug: r.recipe_slug,
      tags,
    };
  });

  return {
    settings,
    constraints: constraintsRes.results || [],
    evidence: evidenceRes.results || [],
    ratings,
    recent_recipe_slugs: (recentCooks.results || [])
      .map((r) => r.recipe_slug)
      .filter(Boolean),
  };
}

export function rankMealsForHousehold(ctx) {
  return scoreCatalogMeals({
    constraints: ctx.constraints,
    evidence: ctx.evidence,
    ratings: ctx.ratings,
    recent_recipe_slugs: ctx.recent_recipe_slugs,
    meal_choice_count: ctx.settings.meal_choice_count,
    prefs: ctx.settings.prefs,
  });
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 */
export async function loadMealHistory(db, household_id, limit = 20) {
  const rows = await db
    .prepare(
      `SELECT p.plan_id, p.status, p.updated_at,
              mo.meal_option_id, mo.name, mo.recipe_slug, mo.letter,
              sel.created_at AS selected_at,
              ck.cooked_at,
              mo.attributes_json
       FROM plan p
       LEFT JOIN meal_option mo ON mo.plan_id = p.plan_id AND mo.selected = 1
       LEFT JOIN selection sel ON sel.plan_id = p.plan_id
       LEFT JOIN cook ck ON ck.plan_id = p.plan_id
       WHERE p.household_id = ?
       ORDER BY p.updated_at DESC
       LIMIT ?`
    )
    .bind(household_id, limit)
    .all();

  const planIds = [...new Set((rows.results || []).map((r) => r.plan_id))];
  /** @type {Map<string, Array<{member_id: string, score: number}>>} */
  const ratingsByPlan = new Map();
  if (planIds.length) {
    const placeholders = planIds.map(() => "?").join(",");
    const rat = await db
      .prepare(
        `SELECT plan_id, member_id, score FROM rating WHERE plan_id IN (${placeholders})`
      )
      .bind(...planIds)
      .all();
    for (const r of rat.results || []) {
      if (!ratingsByPlan.has(r.plan_id)) ratingsByPlan.set(r.plan_id, []);
      ratingsByPlan.get(r.plan_id).push({ member_id: r.member_id, score: r.score });
    }
  }

  const seen = new Set();
  const items = [];
  for (const r of rows.results || []) {
    if (seen.has(r.plan_id)) continue;
    seen.add(r.plan_id);
    const ratings = ratingsByPlan.get(r.plan_id) || [];
    const avg =
      ratings.length > 0
        ? ratings.reduce((a, x) => a + x.score, 0) / ratings.length
        : null;
    let pending_feedback = false;
    if (r.status === "Cooked" && ratings.length === 0) pending_feedback = true;
    if (r.status === "Selected" && !r.cooked_at) pending_feedback = true;

    items.push({
      plan_id: r.plan_id,
      status: r.status,
      meal_name: r.name,
      recipe_slug: r.recipe_slug,
      selected_at: r.selected_at,
      cooked_at: r.cooked_at,
      ratings,
      avg_score: avg,
      pending_feedback,
      favorite: avg != null && avg >= 8.5,
    });
  }
  return items;
}

export function scoredToPlanOptions(scored, plan_id) {
  return scored.map((row) => {
    const opt = catalogMealToOption(row.meal, row.letter, plan_id);
    const persType =
      row.explanation.label === "Trying something new"
        ? "new"
        : row.explanation.label === "Likely crowd-pleaser"
          ? "favorite"
          : "why";
    opt.attributes_json.pers = {
      type: persType,
      label: row.explanation.label,
      line: row.explanation.line,
      confidence: row.explanation.confidence,
      factors: row.explanation.factors,
    };
    opt.score = row.total;
    return opt;
  });
}

export { MEAL_CATALOG, LETTERS };
