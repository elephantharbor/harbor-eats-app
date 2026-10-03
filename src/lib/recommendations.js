import { MEAL_CATALOG, catalogMealToOption } from "./meal-catalog.js";
import { parseHouseholdSettings } from "./household-settings.js";
import { LETTERS } from "./taste-model.js";
import { buildRankedChoiceSet } from "./recommendation-pipeline.js";
import { getCurrentVersionIdForSlug } from "./recipe-store.js";
import { householdIsSynthetic, learningRows, sqlRealRow } from "./evidence-origin.js";
import { learningTasteRows } from "./preference-concepts.js";
import { historyFromActivity } from "./meal-identity.js";

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 */
export async function loadRecommendationContext(db, household_id) {
  const hh = await db
    .prepare(
      `SELECT household_id, display_name, meal_choice_count, scheduling_cadence, settings_json,
              acquisition_source, data_origin
       FROM household WHERE household_id = ?`
    )
    .bind(household_id)
    .first();

  const constraintsRes = await db
    .prepare(`SELECT member_id, rule_key, status FROM constraint_rule WHERE household_id = ?`)
    .bind(household_id)
    .all();

  const realOnly = hh ? !householdIsSynthetic(hh) : true;
  const evidenceOriginSql = realOnly ? `AND ${sqlRealRow("preference_evidence")}` : "";
  const ratingOriginSql = realOnly ? `AND ${sqlRealRow("r")}` : "";
  const cookOriginSql = realOnly ? `AND ${sqlRealRow("c")}` : "";

  const evidenceRes = await db
    .prepare(
      `SELECT tag, kind, weight, source, member_id, data_origin FROM preference_evidence
       WHERE household_id = ? ${evidenceOriginSql} ORDER BY created_at DESC LIMIT 200`
    )
    .bind(household_id)
    .all();

  const ratingsRes = await db
    .prepare(
      `SELECT r.score, r.member_id, r.data_origin, mo.recipe_slug, mo.attributes_json
       FROM rating r
       JOIN meal_option mo ON mo.meal_option_id = r.meal_option_id
       WHERE r.household_id = ? ${ratingOriginSql}
       ORDER BY r.updated_at DESC LIMIT 100`
    )
    .bind(household_id)
    .all();

  const membersRes = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM member WHERE household_id = ? AND status = 'active'`
    )
    .bind(household_id)
    .first();

  const recentCooks = await db
    .prepare(
      `SELECT mo.recipe_slug FROM cook c
       JOIN meal_option mo ON mo.meal_option_id = c.meal_option_id
       WHERE c.household_id = ? ${cookOriginSql}
       ORDER BY c.cooked_at DESC LIMIT 8`
    )
    .bind(household_id)
    .all();

  const settings = parseHouseholdSettings(hh);
  const dinerTastes = await loadDinerTastes(db, household_id, hh);
  const ratings = learningRows(ratingsRes.results || [], hh).map((r) => {
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
    evidence: learningRows(evidenceRes.results || [], hh),
    ratings,
    recent_recipe_slugs: (recentCooks.results || [])
      .map((r) => r.recipe_slug)
      .filter(Boolean),
    active_member_count: membersRes ? Number(membersRes.c) || 2 : 2,
    diner_tastes: dinerTastes,
  };
}

/**
 * Standing tastes for ranking. Read from diner_taste only.
 * Synthetic and unproven rows stay out, matching the Cycle 1 learning gate.
 * A missing 0010 table leaves Tonight on the recipe-store menu with no nudges.
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} householdId
 * @param {{ data_origin?: string, acquisition_source?: string|null }|null} household
 */
async function loadDinerTastes(db, householdId, household) {
  try {
    const originSql =
      household && !householdIsSynthetic(household) ? `AND ${sqlRealRow("diner_taste")}` : "";
    const res = await db
      .prepare(
        `SELECT member_id, vocabulary_slug, rank, stance, confidence, data_origin
           FROM diner_taste
          WHERE household_id = ? ${originSql}`
      )
      .bind(householdId)
      .all();
    return learningTasteRows(res.results || [], household).map((row) => ({
      member_id: row.member_id,
      vocabulary_slug: row.vocabulary_slug,
      rank: row.rank,
      stance: row.stance,
      data_origin: row.data_origin,
    }));
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return [];
    throw e;
  }
}

export function rankMealsForHousehold(ctx) {
  return buildRankedChoiceSet(ctx);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 */
export async function loadMealHistory(db, household_id, limit = 20) {
  const hh = await db
    .prepare(
      `SELECT household_id, data_origin, acquisition_source FROM household WHERE household_id = ?`
    )
    .bind(household_id)
    .first();
  const members = await db
    .prepare(`SELECT COUNT(*) AS c FROM member WHERE household_id = ? AND status = 'active'`)
    .bind(household_id)
    .first();
  const active = members ? Number(members.c) || 1 : 1;
  const plansRes = await db
    .prepare(
      `SELECT plan_id, status, updated_at, data_origin FROM plan
       WHERE household_id = ? ORDER BY updated_at DESC LIMIT ?`
    )
    .bind(household_id, limit)
    .all();
  const plans = (plansRes.results || []).map((plan) => ({
    ...plan,
    active_member_count: active,
  }));
  if (!plans.length) return [];
  const ids = plans.map((plan) => plan.plan_id);
  const placeholders = ids.map(() => "?").join(",");
  const options = await db
    .prepare(
      `SELECT plan_id, meal_option_id, letter, name, recipe_slug, recipe_version, attributes_json
       FROM meal_option WHERE plan_id IN (${placeholders})`
    )
    .bind(...ids)
    .all();
  const selections = await db
    .prepare(
      `SELECT plan_id, meal_option_id, created_at, data_origin FROM selection WHERE plan_id IN (${placeholders})`
    )
    .bind(...ids)
    .all();
  const cooks = await db
    .prepare(
      `SELECT plan_id, cook_id, meal_option_id, cooked_at, created_at, data_origin
       FROM cook WHERE plan_id IN (${placeholders})`
    )
    .bind(...ids)
    .all();
  const ratings = await db
    .prepare(
      `SELECT plan_id, meal_option_id, member_id, score, recipe_version_id, data_origin
       FROM rating WHERE plan_id IN (${placeholders})`
    )
    .bind(...ids)
    .all();
  return historyFromActivity({
    household: hh,
    plans,
    options: options.results || [],
    selections: selections.results || [],
    cooks: cooks.results || [],
    ratings: ratings.results || [],
  }).map((item) => ({
    ...item,
    recipe_version_id: item.recipe_version_id || getCurrentVersionIdForSlug(item.recipe_slug),
  }));
}

export function scoredToPlanOptions(scored, plan_id) {
  return scored.map((row) => {
    const opt = catalogMealToOption(row.meal, row.letter, plan_id);
    const kind = row.explanation.kind || null;
    const persType =
      kind === "exploration" || row.explanation.label === "Something new"
        ? "new"
        : kind === "repeat_success"
          ? "favorite"
          : "why";
    opt.attributes_json.pers = {
      type: persType,
      kind,
      label: row.explanation.label,
      line: row.explanation.line,
      confidence: row.explanation.confidence,
      factors: row.explanation.factors,
    };
    opt.attributes_json.score = row.total;
    opt.score = row.total;
    opt.recipe_version = row.meal.recipe_version_id || getCurrentVersionIdForSlug(row.meal.recipe_slug);
    return opt;
  });
}

export { buildRankedChoiceSet };

export { MEAL_CATALOG, LETTERS };
