/**
 * Persist a dinner plan. The document from plan-mutations is the authority.
 * Child rows are replaced from that document. Legacy `plan` rows are not used.
 * The whole write is one D1 batch, which commits as a single transaction.
 */

import { scopeShopLineIds } from "./plan-mutations.js";

function bindGet(db, sql, params) {
  return db.prepare(sql).bind(...params).first();
}

async function bindAll(db, sql, params) {
  const result = await db.prepare(sql).bind(...params).all();
  return result?.results || [];
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function parse(value, fallback) {
  if (value == null || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Open and recent rows returned by household discovery. Not a client limit. */
export const DINNER_PLAN_LIST_LIMIT = 5;

/**
 * Current plan: the most recently updated row for that household whose
 * status is not completed. Ties break on created_at, then dinner_plan_id,
 * both descending. A newer completed plan does not replace an older open
 * one. No open plan means there is no current plan.
 * The recent list is at most DINNER_PLAN_LIST_LIMIT rows: non-completed
 * first, then completed, each group in that same order.
 */
const DINNER_PLAN_RECENCY = "updated_at DESC, created_at DESC, dinner_plan_id DESC";

export async function findCurrentDinnerPlanId(db, householdId) {
  const row = await bindGet(
    db,
    `SELECT dinner_plan_id FROM dinner_plan
     WHERE household_id = ? AND status != 'completed'
     ORDER BY ${DINNER_PLAN_RECENCY}
     LIMIT 1`,
    [householdId]
  );
  return row?.dinner_plan_id || null;
}

export async function listHouseholdDinnerPlans(db, householdId) {
  return bindAll(
    db,
    `SELECT dinner_plan_id, household_id, status, meal_count, entry_point,
            shopping_started_at, finalized_at, created_at, updated_at
     FROM dinner_plan
     WHERE household_id = ?
     ORDER BY CASE WHEN status = 'completed' THEN 1 ELSE 0 END, ${DINNER_PLAN_RECENCY}
     LIMIT ?`,
    [householdId, DINNER_PLAN_LIST_LIMIT]
  );
}

export async function loadDinnerPlan(db, dinnerPlanId) {
  const plan = await bindGet(
    db,
    `SELECT dinner_plan_id, household_id, status, meal_count, entry_point, intent_json,
            shopping_started_at, data_origin, created_by_member_id, finalized_by_member_id,
            finalized_at, created_at, updated_at
     FROM dinner_plan WHERE dinner_plan_id = ?`,
    [dinnerPlanId]
  );
  if (!plan) return null;
  const meals = await bindAll(
    db,
    `SELECT meal_id, dinner_plan_id, position, kind, state, scheduled_date, recipe_slug,
            recipe_id, recipe_version_id, version_number, cooked_recipe_version_id, title,
            base_servings, pinned_ingredients_json, pinned_steps_json, allergens_json,
            vocabulary_json, tags_json, effort_level, ingredient_complexity, data_origin
     FROM dinner_plan_meal WHERE dinner_plan_id = ? ORDER BY position`,
    [dinnerPlanId]
  );
  const participants = await bindAll(
    db,
    `SELECT part.meal_id, part.member_id, part.active
     FROM dinner_plan_participant part
     JOIN dinner_plan_meal meal ON meal.meal_id = part.meal_id
     WHERE meal.dinner_plan_id = ? AND part.active = 1
     ORDER BY part.member_id`,
    [dinnerPlanId]
  );
  const ratings = await bindAll(
    db,
    `SELECT rating_id, meal_id, member_id, recipe_version_id, score, data_origin, created_at, updated_at
     FROM dinner_plan_rating WHERE dinner_plan_id = ?`,
    [dinnerPlanId]
  );
  const lines = await bindAll(
    db,
    `SELECT line_id, ingredient_id, display_name, preparation, unit, quantity, list_state,
            still_needed, surplus_quantity, meal_ids_json, created_at, updated_at
     FROM dinner_shop_line WHERE dinner_plan_id = ?
     ORDER BY ingredient_id, unit`,
    [dinnerPlanId]
  );
  const deltas = await bindAll(
    db,
    `SELECT delta_id, dinner_plan_id, kind, ingredient_id, display_name, unit, quantity, meal_id, created_at
     FROM dinner_shop_delta WHERE dinner_plan_id = ? ORDER BY created_at, delta_id`,
    [dinnerPlanId]
  );
  const votes = await bindAll(
    db,
    `SELECT vote_id, dinner_plan_id, meal_id, member_id, data_origin, created_at
     FROM dinner_plan_vote WHERE dinner_plan_id = ?`,
    [dinnerPlanId]
  );
  const byMeal = new Map();
  for (const meal of meals) {
    byMeal.set(meal.meal_id, {
      meal_id: meal.meal_id,
      position: meal.position,
      kind: meal.kind,
      state: meal.state,
      scheduled_date: meal.scheduled_date,
      recipe_slug: meal.recipe_slug,
      recipe_id: meal.recipe_id,
      recipe_version_id: meal.recipe_version_id,
      version_number: meal.version_number,
      cooked_recipe_version_id: meal.cooked_recipe_version_id,
      title: meal.title,
      base_servings: meal.base_servings,
      pinned_ingredients: parse(meal.pinned_ingredients_json, null),
      pinned_steps: parse(meal.pinned_steps_json, null),
      allergens: parse(meal.allergens_json, []),
      vocabulary_tag_ids: parse(meal.vocabulary_json, []),
      tags: parse(meal.tags_json, []),
      effort_level: meal.effort_level || null,
      ingredient_complexity: meal.ingredient_complexity || null,
      participant_ids: [],
      ratings: [],
    });
  }
  for (const row of participants) {
    const meal = byMeal.get(row.meal_id);
    if (meal) meal.participant_ids.push(row.member_id);
  }
  for (const row of ratings) {
    const meal = byMeal.get(row.meal_id);
    if (!meal) continue;
    meal.ratings.push({
      rating_id: row.rating_id,
      meal_id: row.meal_id,
      member_id: row.member_id,
      recipe_version_id: row.recipe_version_id,
      score: row.score,
      data_origin: row.data_origin,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  const document = {
    dinner_plan_id: plan.dinner_plan_id,
    household_id: plan.household_id,
    status: plan.status,
    meal_count: plan.meal_count,
    entry_point: plan.entry_point,
    intent: parse(plan.intent_json, {}),
    shopping_started_at: plan.shopping_started_at,
    data_origin: plan.data_origin,
    created_by_member_id: plan.created_by_member_id,
    finalized_by_member_id: plan.finalized_by_member_id,
    finalized_at: plan.finalized_at,
    votes_required: false,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    meals: [...byMeal.values()],
    shop_lines: lines.map((line) => ({
      line_id: line.line_id,
      ingredient_id: line.ingredient_id,
      display_name: line.display_name,
      preparation: line.preparation,
      unit: line.unit,
      quantity: line.quantity,
      list_state: line.list_state,
      still_needed: line.still_needed === 1 || line.still_needed === true,
      surplus_quantity: line.surplus_quantity || 0,
      meal_ids: parse(line.meal_ids_json, []),
      created_at: line.created_at,
      updated_at: line.updated_at,
    })),
    shop_deltas: deltas,
    votes,
  };
  scopeShopLineIds(document);
  return document;
}

export async function saveDinnerPlan(db, plan) {
  scopeShopLineIds(plan);
  const existing = await bindGet(
    db,
    "SELECT dinner_plan_id FROM dinner_plan WHERE dinner_plan_id = ?",
    [plan.dinner_plan_id]
  );
  if (typeof db.batch !== "function") {
    throw new Error("dinner_plan_save_requires_transaction");
  }
  const statements = [];
  const add = (sql, params) => {
    statements.push(db.prepare(sql).bind(...params));
  };
  const parent = [
    plan.status,
    plan.meal_count,
    plan.entry_point,
    json(plan.intent || {}),
    plan.shopping_started_at,
    plan.data_origin,
    plan.finalized_by_member_id,
    plan.finalized_at,
    plan.updated_at,
    plan.dinner_plan_id,
  ];
  if (!existing) {
    add(
      `INSERT INTO dinner_plan
        (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json,
         shopping_started_at, data_origin, created_by_member_id, finalized_by_member_id,
         finalized_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan.dinner_plan_id,
        plan.household_id,
        plan.status,
        plan.meal_count,
        plan.entry_point,
        json(plan.intent || {}),
        plan.shopping_started_at,
        plan.data_origin,
        plan.created_by_member_id,
        plan.finalized_by_member_id,
        plan.finalized_at,
        plan.created_at,
        plan.updated_at,
      ]
    );
  } else {
    add(
      `UPDATE dinner_plan
       SET status = ?, meal_count = ?, entry_point = ?, intent_json = ?, shopping_started_at = ?,
           data_origin = ?, finalized_by_member_id = ?, finalized_at = ?, updated_at = ?
       WHERE dinner_plan_id = ?`,
      parent
    );
  }
  add("DELETE FROM dinner_shop_delta WHERE dinner_plan_id = ?", [plan.dinner_plan_id]);
  add("DELETE FROM dinner_shop_line WHERE dinner_plan_id = ?", [plan.dinner_plan_id]);
  add("DELETE FROM dinner_plan_vote WHERE dinner_plan_id = ?", [plan.dinner_plan_id]);
  add("DELETE FROM dinner_plan_meal WHERE dinner_plan_id = ?", [plan.dinner_plan_id]);
  for (const meal of plan.meals || []) {
    add(
      `INSERT INTO dinner_plan_meal
        (meal_id, dinner_plan_id, position, kind, state, scheduled_date, recipe_slug, recipe_id,
         recipe_version_id, version_number, cooked_recipe_version_id, title, base_servings,
         pinned_ingredients_json, pinned_steps_json, allergens_json, vocabulary_json, tags_json,
         effort_level, ingredient_complexity, data_origin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meal.meal_id,
        plan.dinner_plan_id,
        meal.position,
        meal.kind,
        meal.state,
        meal.scheduled_date,
        meal.recipe_slug,
        meal.recipe_id,
        meal.recipe_version_id,
        meal.version_number,
        meal.cooked_recipe_version_id,
        meal.title,
        meal.base_servings,
        json(meal.pinned_ingredients),
        json(meal.pinned_steps),
        json(meal.allergens || []),
        json(meal.vocabulary_tag_ids || []),
        json(meal.tags || []),
        meal.effort_level || null,
        meal.ingredient_complexity || null,
        plan.data_origin,
        plan.updated_at,
        plan.updated_at,
      ]
    );
    for (const memberId of meal.participant_ids || []) {
      add(
        `INSERT INTO dinner_plan_participant (meal_id, member_id, household_id, active)
         VALUES (?, ?, ?, 1)`,
        [meal.meal_id, memberId, plan.household_id]
      );
    }
    for (const rating of meal.ratings || []) {
      add(
        `INSERT INTO dinner_plan_rating
          (rating_id, meal_id, dinner_plan_id, household_id, member_id, recipe_version_id, score,
           data_origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rating.rating_id,
          meal.meal_id,
          plan.dinner_plan_id,
          plan.household_id,
          rating.member_id,
          rating.recipe_version_id,
          rating.score,
          rating.data_origin,
          rating.created_at,
          rating.updated_at,
        ]
      );
    }
  }
  for (const line of plan.shop_lines || []) {
    add(
      `INSERT INTO dinner_shop_line
        (line_id, dinner_plan_id, ingredient_id, display_name, preparation, unit, quantity,
         list_state, still_needed, surplus_quantity, meal_ids_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        line.line_id,
        plan.dinner_plan_id,
        line.ingredient_id,
        line.display_name,
        line.preparation,
        line.unit,
        line.quantity,
        line.list_state,
        line.still_needed ? 1 : 0,
        line.surplus_quantity || 0,
        json(line.meal_ids || []),
        line.created_at || plan.updated_at,
        line.updated_at || plan.updated_at,
      ]
    );
  }
  for (const delta of plan.shop_deltas || []) {
    add(
      `INSERT INTO dinner_shop_delta
        (delta_id, dinner_plan_id, kind, ingredient_id, display_name, unit, quantity, meal_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        delta.delta_id,
        plan.dinner_plan_id,
        delta.kind,
        delta.ingredient_id,
        delta.display_name,
        delta.unit,
        delta.quantity,
        delta.meal_id,
        delta.created_at,
      ]
    );
  }
  for (const vote of plan.votes || []) {
    add(
      `INSERT INTO dinner_plan_vote
        (vote_id, dinner_plan_id, meal_id, household_id, member_id, data_origin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        vote.vote_id,
        plan.dinner_plan_id,
        vote.meal_id,
        plan.household_id,
        vote.member_id,
        vote.data_origin,
        vote.created_at,
      ]
    );
  }
  await db.batch(statements);
}

export async function householdMemberIds(db, householdId) {
  const rows = await bindAll(
    db,
    `SELECT member_id FROM member
     WHERE household_id = ? AND status = 'active'`,
    [householdId]
  );
  return rows.map((row) => row.member_id);
}

export async function householdConstraints(db, householdId) {
  return bindAll(
    db,
    `SELECT member_id, rule_key, status FROM constraint_rule WHERE household_id = ?`,
    [householdId]
  );
}

/** Personal tastes for ranking. Hard limits do not read this list. */
export async function householdTastes(db, householdId) {
  return bindAll(
    db,
    `SELECT member_id, vocabulary_slug, rank, stance, data_origin
     FROM diner_taste WHERE household_id = ?`,
    [householdId]
  );
}
