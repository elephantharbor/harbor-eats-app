/**
 * Cycle 3 planning contract (D-01).
 * One household dinner plan. A one-dinner flow is a one-meal use of this
 * model. Status names stay internal. Voting never blocks finalize.
 * This module does not call a model and does not shop a second list.
 */

import { PRACTICAL_HINT_KEYS } from "./cycle2-schema.js";
import { householdIsSynthetic, sqlRealHousehold, sqlRealRow } from "./evidence-origin.js";

export const PLAN_STATUSES = Object.freeze(["draft", "ready", "shopping", "active", "completed"]);

/** Conceptual labels for the internal status values. */
export const STATUS_LABELS = Object.freeze({
  draft: "Draft",
  ready: "Ready to shop",
  shopping: "Shopping",
  active: "Active",
  completed: "Completed",
});

export const ENTRY_POINTS = Object.freeze(["plan_dinners", "tonight", "find_dinner"]);

export const MEAL_KINDS = Object.freeze(["recipe", "leftovers", "eating_out"]);

export const MEAL_STATES = Object.freeze([
  "planned",
  "selected",
  "cooking",
  "cooked",
  "partially_rated",
  "fully_rated",
  "skipped",
  "abandoned",
  "fulfilled",
]);

export const MIN_DINNER_COUNT = 1;
export const MAX_DINNER_COUNT = 14;

/**
 * Shopping has started after the first of these. The timestamp is the
 * authority. Status `shopping` is only the label used before any meal is
 * selected or cooked.
 */
export const SHOPPING_START_TRIGGERS = Object.freeze([
  "start_shopping",
  "line_purchased",
  "line_already_have",
]);

/**
 * Ingredient-bearing mutations rebuild the list before shopping starts and
 * emit deltas after. The others do not rewrite the list.
 */
export const MUTATION_EFFECTS = Object.freeze({
  add_meal: "ingredients",
  remove_meal: "ingredients",
  swap_meal: "ingredients",
  set_participants: "ingredients",
  set_leftovers: "ingredients",
  set_eating_out: "ingredients",
  adopt_version: "ingredients",
  skip_meal: "ingredients",
  abandon_meal: "ingredients",
  set_date: "none",
  reorder: "none",
  select_meal: "none",
  begin_cook: "none",
  exit_cook: "none",
  finish_cook: "none",
  rate_meal: "none",
  fulfill_meal: "none",
  vote: "none",
  finalize: "none",
  set_count: "none",
  start_shopping: "start",
  set_line_state: "line",
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function shoppingHasStarted(plan) {
  return Boolean(plan && plan.shopping_started_at);
}

/**
 * Explicit dinner count. A missing count is an error. The number 7 is
 * accepted only when the caller sends 7. "This week" is not a count.
 * @param {unknown} value
 */
export function assertDinnerCount(value) {
  if (value == null || value === "") {
    return { ok: false, error: "dinner_count_required", status: 400 };
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, error: "dinner_count_invalid", status: 400 };
  }
  if (value < MIN_DINNER_COUNT || value > MAX_DINNER_COUNT) {
    return { ok: false, error: "dinner_count_invalid", status: 400 };
  }
  return { ok: true, dinner_count: value };
}

function stringList(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) return null;
    out.push(item.trim());
  }
  return out;
}

function normalizeHints(value) {
  if (value == null) return { ok: true, hints: [] };
  if (!Array.isArray(value)) return { ok: false, error: "practical_hints_invalid" };
  const hints = [];
  for (const hint of value) {
    if (!hint || typeof hint.hint_key !== "string" || !PRACTICAL_HINT_KEYS.includes(hint.hint_key)) {
      return { ok: false, error: "practical_hints_invalid" };
    }
    const detail = hint.detail == null ? "" : String(hint.detail).trim();
    if (hint.hint_key === "equipment" && !detail) return { ok: false, error: "practical_hints_invalid" };
    hints.push({ hint_key: hint.hint_key, detail });
  }
  return { ok: true, hints };
}

/**
 * Structured planner intent. Later natural-language work can fill this
 * object. This function does not parse a sentence and does not call a model.
 * @param {object} [input]
 */
export function parsePlanIntent(input = {}) {
  const counted = assertDinnerCount(input.dinner_count);
  if (!counted.ok) return counted;
  const entry_point = input.entry_point || "plan_dinners";
  if (!ENTRY_POINTS.includes(entry_point)) {
    return { ok: false, error: "entry_point_invalid", status: 400 };
  }
  const meal_styles = stringList(input.meal_styles);
  if (meal_styles == null) return { ok: false, error: "meal_styles_invalid", status: 400 };
  const participant_ids = stringList(input.participant_ids);
  if (participant_ids == null) return { ok: false, error: "participant_ids_invalid", status: 400 };
  const hints = normalizeHints(input.practical_hints);
  if (!hints.ok) return { ok: false, error: hints.error, status: 400 };
  let max_cook_minutes = null;
  if (input.max_cook_minutes != null) {
    if (typeof input.max_cook_minutes !== "number" || input.max_cook_minutes < 0) {
      return { ok: false, error: "max_cook_minutes_invalid", status: 400 };
    }
    max_cook_minutes = input.max_cook_minutes;
  }
  let requested_ingredient = null;
  if (input.requested_ingredient != null && input.requested_ingredient !== "") {
    if (typeof input.requested_ingredient !== "string") {
      return { ok: false, error: "requested_ingredient_invalid", status: 400 };
    }
    requested_ingredient = input.requested_ingredient.trim().toLowerCase();
  }
  /** @type {{ participant_ids: string[] }[]|null} */
  let slots = null;
  if (input.slots != null) {
    if (!Array.isArray(input.slots)) return { ok: false, error: "slots_invalid", status: 400 };
    slots = [];
    for (const slot of input.slots) {
      const ids = stringList(slot && slot.participant_ids);
      if (ids == null) return { ok: false, error: "slots_invalid", status: 400 };
      slots.push({ participant_ids: ids });
    }
  }
  /** @type {(string|null)[]|null} */
  let scheduled_dates = null;
  if (input.scheduled_dates != null) {
    if (!Array.isArray(input.scheduled_dates)) {
      return { ok: false, error: "scheduled_dates_invalid", status: 400 };
    }
    scheduled_dates = [];
    for (const value of input.scheduled_dates) {
      if (value == null || value === "") scheduled_dates.push(null);
      else if (typeof value === "string" && validDate(value)) scheduled_dates.push(value);
      else return { ok: false, error: "scheduled_dates_invalid", status: 400 };
    }
  }
  return {
    ok: true,
    intent: {
      dinner_count: counted.dinner_count,
      entry_point,
      requested_ingredient,
      max_cook_minutes,
      meal_styles,
      participant_ids,
      practical_hints: hints.hints,
      slots,
      scheduled_dates,
    },
  };
}

export function validDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function assertParticipants(participantIds, householdMemberIds) {
  const allowed = new Set(householdMemberIds || []);
  const denied = (participantIds || []).filter((id) => !allowed.has(id));
  if (!participantIds || !participantIds.length) {
    return { ok: false, error: "participant_required", status: 400 };
  }
  if (denied.length) {
    return { ok: false, error: "forbidden_member", status: 403, member_ids: denied };
  }
  return { ok: true };
}

const CLOSED = {
  recipe: new Set(["fully_rated", "skipped", "abandoned"]),
  leftovers: new Set(["fulfilled", "skipped", "abandoned"]),
  eating_out: new Set(["fulfilled", "skipped", "abandoned"]),
};

export function mealIsClosed(meal) {
  const allowed = CLOSED[meal?.kind];
  return Boolean(allowed && allowed.has(meal.state));
}

export function planMealsClosed(plan) {
  if (!plan || !Array.isArray(plan.meals) || plan.meals.length !== plan.meal_count) return false;
  return plan.meals.every(mealIsClosed);
}

/**
 * A planned meal is not completed. Skipped, cooked, rated, and abandoned
 * stay distinct. Fulfilled is only leftovers or eating out.
 * @param {object} plan
 */
export function projectDinnerHistory(plan) {
  return (plan?.meals || []).map((meal) => {
    const cooked = ["cooked", "partially_rated", "fully_rated"].includes(meal.state);
    const rated = meal.state === "partially_rated" || meal.state === "fully_rated";
    const completed = meal.state === "fully_rated" || meal.state === "fulfilled";
    return {
      meal_id: meal.meal_id,
      position: meal.position,
      kind: meal.kind,
      state: meal.state,
      scheduled_date: meal.scheduled_date || null,
      completed,
      cooked,
      rated,
      skipped: meal.state === "skipped",
      abandoned: meal.state === "abandoned",
      fulfilled: meal.state === "fulfilled",
      counts_toward_cml: countsTowardCompletedMealLoop(plan, meal),
    };
  });
}

/**
 * Completed Meal Loop for this domain: a recipe meal that was cooked and
 * fully rated by the active participants of that meal. Household membership
 * is not the rating set. Synthetic and unproven plans do not count.
 * @param {object} plan
 * @param {object} meal
 * @param {object|null} [household]
 */
export function countsTowardCompletedMealLoop(plan, meal, household = null) {
  if (!plan || !meal) return false;
  if (meal.kind !== "recipe" || meal.state !== "fully_rated") return false;
  if (plan.data_origin !== "household") return false;
  if (household && householdIsSynthetic(household)) return false;
  const participants = meal.participant_ids || [];
  if (!participants.length) return false;
  const ratings = (meal.ratings || []).filter(
    (row) => row.data_origin === "household" && participants.includes(row.member_id)
  );
  return participants.every((id) => ratings.some((row) => row.member_id === id));
}

/**
 * Backstop query. A fully rated recipe counts only when every active
 * participant on that meal has a household-origin rating. Other household
 * members are not required. Synthetic and unproven rows are out.
 */
export function dinnerCompletedLoopSql() {
  const household = sqlRealHousehold("h");
  return `SELECT COUNT(*) AS c
    FROM dinner_plan_meal m
    JOIN dinner_plan p ON p.dinner_plan_id = m.dinner_plan_id
    JOIN household h ON h.household_id = p.household_id
    WHERE m.kind = 'recipe'
      AND m.state = 'fully_rated'
      AND ${sqlRealRow("p")}
      AND ${sqlRealRow("m")}
      AND ${household}
      AND (
        SELECT COUNT(*) FROM dinner_plan_participant part
        WHERE part.meal_id = m.meal_id AND part.active = 1
      ) > 0
      AND (
        SELECT COUNT(*) FROM dinner_plan_participant part
        WHERE part.meal_id = m.meal_id AND part.active = 1
      ) = (
        SELECT COUNT(*) FROM dinner_plan_rating r
        WHERE r.meal_id = m.meal_id
          AND r.data_origin = 'household'
          AND r.member_id IN (
            SELECT part.member_id FROM dinner_plan_participant part
            WHERE part.meal_id = m.meal_id AND part.active = 1
          )
      )`;
}

/** List row for household discovery. The full plan stays on presentDinnerPlan. */
export function presentDinnerPlanSummary(row) {
  if (!row) return null;
  return {
    dinner_plan_id: row.dinner_plan_id,
    household_id: row.household_id,
    status: row.status,
    status_label: STATUS_LABELS[row.status] || row.status,
    meal_count: row.meal_count,
    entry_point: row.entry_point,
    shopping_started_at: row.shopping_started_at ?? null,
    shopping_started: shoppingHasStarted(row),
    finalized_at: row.finalized_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function presentDinnerPlan(plan) {
  return {
    dinner_plan_id: plan.dinner_plan_id,
    household_id: plan.household_id,
    status: plan.status,
    status_label: STATUS_LABELS[plan.status] || plan.status,
    meal_count: plan.meal_count,
    entry_point: plan.entry_point,
    intent: plan.intent,
    shopping_started_at: plan.shopping_started_at,
    shopping_started: shoppingHasStarted(plan),
    votes_required: false,
    data_origin: plan.data_origin,
    created_by_member_id: plan.created_by_member_id,
    finalized_by_member_id: plan.finalized_by_member_id,
    finalized_at: plan.finalized_at,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    meals: plan.meals,
    shop_lines: plan.shop_lines,
    shop_deltas: plan.shop_deltas,
    votes: plan.votes,
    history: projectDinnerHistory(plan),
  };
}
