/**
 * Discovery context for standalone browse, replacing one planned meal,
 * and choosing a meal onto a dinner plan.
 * The client names a mode and ids. The server fills household, plan,
 * constraints, and tastes. Client diet flags are not a field on this object.
 */

import { assertParticipants } from "../lib/plan-contract.js";
import {
  CONTEXT_KEYS,
  DISCOVERY_MODES,
  DISCOVERY_SCHEMA_VERSION,
  FORBIDDEN_CONTEXT_KEYS,
} from "./constants.js";
import { emptySoft } from "./query.js";

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(error, status = 400) {
  return { ok: false, error, status };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalId(value, name) {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || !ID_RE.test(value)) return fail(`${name}_invalid`);
  return { ok: true, value };
}

function slugList(value, name) {
  if (value == null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return fail(`${name}_invalid`);
  const out = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") return fail(`${name}_invalid`);
    const slug = item.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) return fail(`${name}_invalid`);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  out.sort((a, b) => a.localeCompare(b));
  return { ok: true, value: out };
}

function idList(value, name) {
  if (value == null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return fail(`${name}_invalid`);
  const ids = [];
  for (const item of value) {
    if (typeof item !== "string" || !ID_RE.test(item)) return fail(`${name}_invalid`);
    if (!ids.includes(item)) ids.push(item);
  }
  return { ok: true, value: ids };
}

/**
 * Client context before the server merges the plan. `constraints` and
 * `eligible` are rejected.
 * @param {object} [input]
 */
export function normalizeClientContext(input = {}) {
  if (!isPlainObject(input)) return fail("context_invalid");
  for (const key of FORBIDDEN_CONTEXT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) return fail("client_constraints_forbidden");
  }
  const unknown = Object.keys(input).find((key) => !CONTEXT_KEYS.includes(key));
  if (unknown) return fail("unknown_field");

  const mode = input.mode || "standalone";
  if (!DISCOVERY_MODES.includes(mode)) return fail("mode_invalid");
  const dinnerPlan = optionalId(input.dinner_plan_id, "dinner_plan_id");
  if (!dinnerPlan.ok) return dinnerPlan;
  const meal = optionalId(input.meal_id, "meal_id");
  if (!meal.ok) return meal;
  let position = null;
  if (input.position != null) {
    if (typeof input.position !== "number" || !Number.isInteger(input.position) || input.position < 1) {
      return fail("position_invalid");
    }
    position = input.position;
  }
  const participants = idList(input.participant_ids, "participant_ids");
  if (!participants.ok) return participants;
  const exclude = slugList(input.exclude_slugs, "exclude_slugs");
  if (!exclude.ok) return exclude;

  if (mode === "standalone") {
    if (dinnerPlan.value) return fail("dinner_plan_not_allowed");
    if (meal.value) return fail("meal_not_allowed");
  } else if (!dinnerPlan.value) {
    return fail("dinner_plan_required");
  }
  if (mode === "replace_plan_meal" && !meal.value) return fail("meal_required");
  if (mode !== "standalone" && exclude.value.length) return fail("exclude_slugs_not_allowed");

  return {
    ok: true,
    context: {
      schema_version: DISCOVERY_SCHEMA_VERSION,
      mode,
      dinner_plan_id: dinnerPlan.value,
      meal_id: meal.value,
      position,
      participant_ids: participants.value,
      exclude_slugs: exclude.value,
    },
  };
}

function planSoft(plan) {
  const intent = plan?.intent || {};
  return {
    keep_it_easy: intent.keep_it_easy === true,
    keep_ingredients_simple: intent.keep_ingredients_simple === true,
  };
}

function recipeSlugs(meals) {
  return (meals || []).map((meal) => meal.recipe_slug).filter(Boolean);
}

/**
 * Open nights on a stored plan. Cycle 3 does not persist an empty slot as
 * a meal row. `createDinnerPlan` with `fill: "planner"` returns nights the
 * planner could not fill in `unfilled` and does not insert them. Emptiness
 * that remains is `meal_count` minus the stored meal rows. `set_count` can
 * raise `meal_count` without adding rows. `add_meal` appends the next
 * position. A client `position` is not an address of a hole.
 * @param {object|null|undefined} plan
 */
export function emptyNightCount(plan) {
  const stored = Array.isArray(plan?.meals) ? plan.meals.length : 0;
  const count = Number.isInteger(plan?.meal_count) ? plan.meal_count : 0;
  return Math.max(0, count - stored);
}

/**
 * Merge a normalized client context with server state.
 * Plan modes take participants, exclude slugs, and default chips from the
 * stored plan. The client cannot override those.
 * @param {object} client from normalizeClientContext
 * @param {{ household_id: string, member_ids: string[], constraints: object[], tastes: object[], recent_slugs?: string[], plan?: object|null }} server
 * @param {{ soft_provided: boolean, soft: { keep_it_easy: boolean, keep_ingredients_simple: boolean } }} query
 */
export function resolveDiscoveryContext(client, server, query) {
  if (!server || !server.household_id) return fail("household_required");
  if (!Array.isArray(server.constraints)) return fail("constraints_required");
  if (!Array.isArray(server.tastes)) return fail("tastes_required");
  const mode = client.mode;
  const recent_slugs = [...new Set((server.recent_slugs || []).filter((slug) => typeof slug === "string" && slug))];
  const recent_source = server.recent_source === "cook" || server.recent_source === "unavailable"
    ? server.recent_source
    : null;

  /** @type {string[]} */
  let participant_ids = [];
  /** @type {string[]} */
  let exclude_slugs = [];
  /** @type {string[]} */
  let plan_slugs = [];
  let meal_id = null;
  let position = null;
  let dinner_plan_id = null;
  /** @type {object|null} */
  let inherited = null;

  if (mode === "standalone") {
    participant_ids = client.participant_ids.length ? client.participant_ids : [...(server.member_ids || [])];
    exclude_slugs = [...client.exclude_slugs];
    position = null;
  } else {
    const plan = server.plan;
    if (!plan || plan.dinner_plan_id !== client.dinner_plan_id) return fail("plan_not_found", 404);
    if (plan.household_id && plan.household_id !== server.household_id) {
      return fail("forbidden_cross_household", 403);
    }
    dinner_plan_id = plan.dinner_plan_id;
    inherited = planSoft(plan);
    const meals = plan.meals || [];
    if (mode === "replace_plan_meal" || client.meal_id) {
      const meal = meals.find((row) => row.meal_id === client.meal_id);
      if (!meal) return fail("meal_not_found", 404);
      if (meal.kind !== "recipe" || !["planned", "selected"].includes(meal.state)) {
        return fail("outcome_locked", 409);
      }
      meal_id = meal.meal_id;
      position = meal.position;
      participant_ids = meal.participant_ids?.length ? [...meal.participant_ids] : [...(server.member_ids || [])];
      exclude_slugs = meal.recipe_slug ? [meal.recipe_slug] : [];
      plan_slugs = recipeSlugs(meals.filter((row) => row.meal_id !== meal.meal_id));
    } else {
      if (emptyNightCount(plan) < 1) return fail("plan_full", 409);
      participant_ids = client.participant_ids.length ? client.participant_ids : [...(server.member_ids || [])];
      exclude_slugs = recipeSlugs(meals);
      plan_slugs = [...exclude_slugs];
      position = null;
    }
  }

  const members = assertParticipants(participant_ids, server.member_ids || []);
  if (!members.ok) return members;

  let soft = emptySoft();
  let soft_source = "default_off";
  if (query.soft_provided) {
    soft = { ...query.soft };
    soft_source = "query";
  } else if (inherited) {
    soft = inherited;
    soft_source = "plan_intent";
  }

  return {
    ok: true,
    context: {
      schema_version: DISCOVERY_SCHEMA_VERSION,
      mode,
      household_id: server.household_id,
      participant_ids,
      dinner_plan_id,
      meal_id,
      position,
      exclude_slugs,
      plan_slugs,
      recent_slugs,
      recent_source,
      soft,
      soft_source,
      plan_soft: inherited,
      constraints: server.constraints,
      tastes: server.tastes,
    },
  };
}

/**
 * What the client should do with a chosen result. Search itself does not
 * write the plan. `recipe_version_id` has to be the result's published id.
 * Omitting it makes swap_meal call the automatic planner instead of the pick.
 * @param {object} context
 */
export function selectionFor(context) {
  if (!context || context.mode === "standalone") {
    return {
      action: "none",
      method: null,
      path: null,
      op: null,
      meal_id: null,
      participant_ids: [],
      recipe_version_id_from: null,
    };
  }
  const path = `/api/dinner-plans/${context.dinner_plan_id}/mutations`;
  if (context.mode === "replace_plan_meal" || context.meal_id) {
    return {
      action: "swap_meal",
      method: "POST",
      path,
      op: "swap_meal",
      meal_id: context.meal_id,
      participant_ids: [...context.participant_ids],
      recipe_version_id_from: "result",
    };
  }
  return {
    action: "add_meal",
    method: "POST",
    path,
    op: "add_meal",
    meal_id: null,
    participant_ids: [...context.participant_ids],
    recipe_version_id_from: "result",
  };
}

/** Fields safe to echo. Constraints and tastes stay on the server. */
export function publicContext(context) {
  return {
    schema_version: context.schema_version,
    mode: context.mode,
    household_id: context.household_id,
    participant_ids: [...context.participant_ids],
    dinner_plan_id: context.dinner_plan_id,
    meal_id: context.meal_id,
    position: context.position,
    exclude_slugs: [...context.exclude_slugs],
    plan_slugs: [...context.plan_slugs],
    recent_slugs: [...context.recent_slugs],
    recent_source: context.recent_source || null,
    soft: { ...context.soft },
    soft_source: context.soft_source,
  };
}
