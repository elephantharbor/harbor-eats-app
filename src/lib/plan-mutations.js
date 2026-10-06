/**
 * Central dinner-plan mutations.
 * Ingredient changes rebuild the shopping list before shopping has started
 * and emit added / no-longer-needed deltas after. Date and order changes
 * do not rewrite the list. Eligibility is decided here from server constraints.
 */

import { assessMealEligibility, planDinners, plannerCatalog, swapSlot } from "./dinner-planner.js";
import { neededLines } from "./ingredient-identity.js";
import {
  ENTRY_POINTS,
  MEAL_KINDS,
  MUTATION_EFFECTS,
  assertDinnerCount,
  assertParticipants,
  parsePlanIntent,
  planMealsClosed,
  shoppingHasStarted,
  validDate,
} from "./plan-contract.js";

const EPS = 0.0005;

function fail(error, status = 400, extra = {}) {
  return { ok: false, error, status, ...extra };
}

function makeId(ctx, prefix) {
  if (typeof ctx.id === "function") return ctx.id(prefix);
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function lineKey(ingredientId, unit) {
  return `${ingredientId}\u0000${unit}`;
}

function safeToken(value) {
  return String(value || "x").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Primary key for dinner_shop_line. The plan id is part of the key because
 * line_id is unique across the whole database, not per plan.
 */
export function shopLineId(dinnerPlanId, ingredientId, unit) {
  const plan = dinnerPlanId == null || dinnerPlanId === "" ? "x" : String(dinnerPlanId);
  return `sl_${plan}_${safeToken(ingredientId)}_${safeToken(unit)}`;
}

function legacyShopLineId(ingredientId, unit) {
  return `sl_${safeToken(ingredientId)}_${safeToken(unit)}`;
}

export function scopeShopLineIds(plan) {
  if (!plan || !Array.isArray(plan.shop_lines)) return plan;
  for (const line of plan.shop_lines) {
    line.line_id = shopLineId(plan.dinner_plan_id, line.ingredient_id, line.unit);
  }
  return plan;
}

function sameShopLine(plan, line, lineId) {
  if (!line || lineId == null) return false;
  if (line.line_id === lineId) return true;
  if (shopLineId(plan.dinner_plan_id, line.ingredient_id, line.unit) === lineId) return true;
  return legacyShopLineId(line.ingredient_id, line.unit) === lineId;
}

export function resolveVersion(recipeVersionId, ctx = {}) {
  if (!recipeVersionId) return null;
  if (ctx.versions && ctx.versions[recipeVersionId]) return ctx.versions[recipeVersionId];
  const catalog = ctx.catalog || plannerCatalog();
  return catalog.find((entry) => entry.pkg.recipe_version_id === recipeVersionId) || null;
}

function pinnedEntry(meal) {
  return {
    concept: {
      concept_id: meal.recipe_slug,
      title: meal.title,
      tags: meal.tags || [],
    },
    pkg: {
      title: meal.title,
      allergens: meal.allergens || [],
      vocabulary_tag_ids: meal.vocabulary_tag_ids || [],
      ingredients: meal.pinned_ingredients || [],
    },
  };
}

function applyPin(meal, entry) {
  const pkg = entry.pkg;
  const concept = entry.concept || {};
  meal.kind = "recipe";
  meal.recipe_slug = concept.concept_id || meal.recipe_slug || null;
  meal.recipe_id = pkg.recipe_id;
  meal.recipe_version_id = pkg.recipe_version_id;
  meal.version_number = pkg.version_number;
  meal.title = pkg.title || concept.title || meal.title;
  meal.base_servings = pkg.base_servings;
  meal.pinned_ingredients = structuredClone(pkg.ingredients || []);
  meal.pinned_steps = structuredClone(pkg.steps || []);
  meal.allergens = [...(pkg.allergens || [])];
  meal.vocabulary_tag_ids = [...(pkg.vocabulary_tag_ids || [])];
  meal.tags = [...(concept.tags || [])];
  meal.effort_level = pkg.effort_level || null;
  meal.ingredient_complexity = pkg.ingredient_complexity || null;
}

function clearRecipe(meal, kind) {
  meal.kind = kind;
  meal.state = "planned";
  meal.title = kind === "leftovers" ? "Leftovers" : "Eating out";
  meal.recipe_slug = null;
  meal.recipe_id = null;
  meal.recipe_version_id = null;
  meal.version_number = null;
  meal.cooked_recipe_version_id = null;
  meal.base_servings = null;
  meal.pinned_ingredients = null;
  meal.pinned_steps = null;
  meal.allergens = [];
  meal.vocabulary_tag_ids = [];
  meal.tags = [];
  meal.effort_level = null;
  meal.ingredient_complexity = null;
  meal.ratings = [];
}

function blankMeal(ctx, position, kind) {
  return {
    meal_id: makeId(ctx, "dpm"),
    position,
    kind,
    state: "planned",
    scheduled_date: null,
    recipe_slug: null,
    recipe_id: null,
    recipe_version_id: null,
    version_number: null,
    cooked_recipe_version_id: null,
    title: null,
    base_servings: null,
    pinned_ingredients: null,
    pinned_steps: null,
    allergens: [],
    vocabulary_tag_ids: [],
    tags: [],
    effort_level: null,
    ingredient_complexity: null,
    participant_ids: [],
    ratings: [],
  };
}

function findMeal(plan, mealId) {
  return (plan.meals || []).find((meal) => meal.meal_id === mealId) || null;
}

function recipeLocked(meal) {
  return ["cooking", "cooked", "partially_rated", "fully_rated", "skipped", "abandoned", "fulfilled"].includes(meal.state);
}

/**
 * Cook instructions and ingredients come from the pin, never from a later
 * catalog version, until adopt_version replaces the pin.
 */
export function resolvedRecipe(meal, latest) {
  if (!meal || meal.kind !== "recipe") return null;
  return {
    recipe_version_id: meal.recipe_version_id,
    recipe_id: meal.recipe_id,
    version_number: meal.version_number,
    title: meal.title,
    ingredients: meal.pinned_ingredients,
    steps: meal.pinned_steps,
    base_servings: meal.base_servings,
    catalog_version_id: latest?.pkg?.recipe_version_id || latest?.recipe_version_id || null,
    using_pin: true,
  };
}

function checkEligibility(entry, participantIds, ctx) {
  return assessMealEligibility(entry, participantIds, ctx.constraints || [], ctx.tastes || []);
}

function buildMeal(spec, position, fallbackParticipants, ctx) {
  const participant_ids = spec.participant_ids || fallbackParticipants;
  const members = assertParticipants(participant_ids, ctx.household_member_ids);
  if (!members.ok) return members;
  const kind = spec.kind || "recipe";
  if (!MEAL_KINDS.includes(kind)) return fail("meal_kind_invalid");
  const scheduled_date = spec.scheduled_date ?? null;
  if (scheduled_date != null && !validDate(scheduled_date)) return fail("date_invalid");
  const meal = blankMeal(ctx, position, kind);
  meal.participant_ids = [...participant_ids];
  meal.scheduled_date = scheduled_date;
  if (kind !== "recipe") {
    meal.title = kind === "leftovers" ? "Leftovers" : "Eating out";
    return { ok: true, meal };
  }
  const entry = resolveVersion(spec.recipe_version_id, ctx);
  if (!entry) return fail("unknown_recipe", 404);
  const decision = checkEligibility(entry, participant_ids, ctx);
  if (!decision.eligible) return fail("hard_limit_blocked", 409, { blocked: decision.blocked });
  applyPin(meal, entry);
  return { ok: true, meal };
}

function blankPlan(input, ctx, intent) {
  const now = ctx.now;
  return {
    dinner_plan_id: input.dinner_plan_id || makeId(ctx, "dp"),
    household_id: input.household_id,
    status: "draft",
    meal_count: intent.dinner_count,
    entry_point: intent.entry_point,
    intent,
    shopping_started_at: null,
    data_origin: ctx.data_origin || "unproven",
    created_by_member_id: ctx.actor_member_id,
    finalized_by_member_id: null,
    finalized_at: null,
    votes_required: false,
    created_at: now,
    updated_at: now,
    meals: [],
    shop_lines: [],
    shop_deltas: [],
    votes: [],
  };
}

/**
 * @param {object} input
 * @param {object} ctx
 */
export function createDinnerPlan(input, ctx = {}) {
  const counted = assertDinnerCount(input.meal_count);
  if (!counted.ok) return counted;
  if (!ENTRY_POINTS.includes(input.entry_point)) return fail("entry_point_invalid");
  const participant_ids = input.participant_ids || input.intent?.participant_ids;
  const members = assertParticipants(participant_ids, ctx.household_member_ids);
  if (!members.ok) return members;
  const parsed = parsePlanIntent({
    ...(input.intent || {}),
    dinner_count: input.intent?.dinner_count ?? input.meal_count,
    entry_point: input.entry_point,
    participant_ids: input.intent?.participant_ids || participant_ids,
    keep_it_easy: input.keep_it_easy ?? input.intent?.keep_it_easy,
    keep_ingredients_simple: input.keep_ingredients_simple ?? input.intent?.keep_ingredients_simple,
  });
  if (!parsed.ok) return parsed;
  if (parsed.intent.dinner_count !== counted.dinner_count) {
    return fail("dinner_count_mismatch", 400);
  }
  const plan = blankPlan(input, ctx, parsed.intent);
  /** @type {object[]} */
  const unfilled = [];
  if (input.fill === "planner") {
    const planned = planDinners(parsed.intent, ctx);
    for (const slot of planned.slots) {
      if (slot.result !== "recommended" || !slot.recipe_version_id) {
        unfilled.push({ position: slot.position, reason: slot.reason, result: "constrained" });
        continue;
      }
      const built = buildMeal(
        {
          kind: "recipe",
          recipe_version_id: slot.recipe_version_id,
          participant_ids: slot.participant_ids,
          scheduled_date: parsed.intent.scheduled_dates?.[slot.position - 1] ?? null,
        },
        slot.position,
        participant_ids,
        ctx
      );
      if (!built.ok) return built;
      plan.meals.push(built.meal);
    }
    plan.planner = {
      model: null,
      source: planned.source,
      constrained_requests: planned.constrained_requests,
      unscored_hints: planned.unscored_hints,
      catalog_size: planned.catalog_size,
      preference_relaxations: planned.preference_relaxations || [],
    };
  } else {
    if (!Array.isArray(input.meals) || input.meals.length !== counted.dinner_count) {
      return fail("meal_count_mismatch", 400);
    }
    for (let index = 0; index < input.meals.length; index += 1) {
      const built = buildMeal(input.meals[index], index + 1, participant_ids, ctx);
      if (!built.ok) return built;
      plan.meals.push(built.meal);
    }
  }
  syncShopping(plan, [], ctx);
  scopeShopLineIds(plan);
  return { ok: true, plan, unfilled, votes_required: false };
}

function cookingBegan(plan) {
  return (plan.meals || []).some((meal) =>
    ["selected", "cooking", "cooked", "partially_rated", "fully_rated", "fulfilled"].includes(meal.state)
  );
}

function refreshStatus(plan) {
  if (planMealsClosed(plan)) {
    plan.status = "completed";
    return;
  }
  if (cookingBegan(plan)) {
    plan.status = "active";
    return;
  }
  if (shoppingHasStarted(plan)) {
    plan.status = "shopping";
    return;
  }
  if (plan.finalized_at) {
    plan.status = "ready";
    return;
  }
  plan.status = "draft";
}

function markStarted(plan, now) {
  if (!plan.shopping_started_at) plan.shopping_started_at = now;
}

function syncShopping(plan, previousLines, ctx) {
  const now = ctx.now;
  const needed = neededLines(plan.meals);
  if (!shoppingHasStarted(plan)) {
    plan.shop_lines = needed.map((item) => ({
      line_id: shopLineId(plan.dinner_plan_id, item.ingredient_id, item.unit),
      ingredient_id: item.ingredient_id,
      display_name: item.display_name,
      preparation: item.preparation,
      unit: item.unit,
      quantity: item.quantity,
      list_state: "open",
      still_needed: true,
      surplus_quantity: 0,
      meal_ids: item.meal_ids,
      created_at: now,
      updated_at: now,
    }));
    plan.shop_deltas = [];
    return;
  }
  const prior = new Map((previousLines || []).map((line) => [lineKey(line.ingredient_id, line.unit), line]));
  const seen = new Set();
  /** @type {object[]} */
  const lines = [];
  /** @type {object[]} */
  const deltas = [];
  const pushDelta = (kind, item, quantity) => {
    deltas.push({
      delta_id: makeId(ctx, "dsd"),
      dinner_plan_id: plan.dinner_plan_id,
      kind,
      ingredient_id: item.ingredient_id,
      display_name: item.display_name,
      unit: item.unit,
      quantity,
      meal_id: null,
      created_at: now,
    });
  };
  for (const item of needed) {
    const key = lineKey(item.ingredient_id, item.unit);
    seen.add(key);
    const existing = prior.get(key);
    if (!existing) {
      lines.push({
        line_id: shopLineId(plan.dinner_plan_id, item.ingredient_id, item.unit),
        ingredient_id: item.ingredient_id,
        display_name: item.display_name,
        preparation: item.preparation,
        unit: item.unit,
        quantity: item.quantity,
        list_state: "open",
        still_needed: true,
        surplus_quantity: 0,
        meal_ids: item.meal_ids,
        created_at: now,
        updated_at: now,
      });
      pushDelta("added", item, item.quantity || 0);
      continue;
    }
    const priorNeeded = existing.still_needed ? Number(existing.quantity) || 0 : 0;
    const nextQty = item.quantity == null ? priorNeeded : Number(item.quantity);
    if (nextQty > priorNeeded + EPS) pushDelta("added", item, Math.round((nextQty - priorNeeded) * 1000) / 1000);
    else if (priorNeeded > nextQty + EPS) {
      pushDelta("no_longer_needed", existing, Math.round((priorNeeded - nextQty) * 1000) / 1000);
    }
    lines.push({
      ...existing,
      line_id: shopLineId(plan.dinner_plan_id, item.ingredient_id, item.unit),
      display_name: existing.display_name || item.display_name,
      preparation: item.preparation,
      quantity: item.quantity,
      still_needed: true,
      surplus_quantity: priorNeeded > nextQty + EPS ? Math.round((priorNeeded - nextQty) * 1000) / 1000 : 0,
      meal_ids: item.meal_ids,
      list_state: existing.list_state,
      updated_at: now,
    });
  }
  for (const existing of previousLines || []) {
    const key = lineKey(existing.ingredient_id, existing.unit);
    if (seen.has(key)) continue;
    const priorNeeded = existing.still_needed ? Number(existing.quantity) || 0 : 0;
    if (priorNeeded > EPS) pushDelta("no_longer_needed", existing, priorNeeded);
    lines.push({
      ...existing,
      line_id: shopLineId(plan.dinner_plan_id, existing.ingredient_id, existing.unit),
      still_needed: false,
      surplus_quantity: priorNeeded,
      list_state: existing.list_state,
      updated_at: now,
    });
  }
  lines.sort((a, b) => a.ingredient_id.localeCompare(b.ingredient_id) || String(a.unit).localeCompare(String(b.unit)));
  plan.shop_lines = lines;
  plan.shop_deltas = [...(plan.shop_deltas || []), ...deltas];
  scopeShopLineIds(plan);
}

function addMeal(plan, action, ctx) {
  if (plan.meals.length >= plan.meal_count) return fail("plan_full", 409);
  const position = plan.meals.reduce((max, meal) => Math.max(max, meal.position), 0) + 1;
  const built = buildMeal(action, position, null, ctx);
  if (!built.ok) return built;
  plan.meals.push(built.meal);
  return { ok: true };
}

function removeMeal(plan, action) {
  const index = plan.meals.findIndex((meal) => meal.meal_id === action.meal_id);
  if (index < 0) return fail("meal_not_found", 404);
  if (recipeLocked(plan.meals[index]) && plan.meals[index].state !== "skipped" && plan.meals[index].state !== "abandoned") {
    return fail("outcome_locked", 409);
  }
  plan.meals.splice(index, 1);
  plan.meals.forEach((meal, mealIndex) => {
    meal.position = mealIndex + 1;
  });
  return { ok: true };
}

function swapMeal(plan, action, ctx) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (meal.kind !== "recipe") return fail("illegal_transition", 409);
  if (!["planned", "selected"].includes(meal.state)) return fail("outcome_locked", 409);
  let versionId = action.recipe_version_id;
  if (!versionId) {
    const slots = plan.meals.map((row) => ({
      position: row.position,
      recipe_slug: row.recipe_slug,
      recipe_version_id: row.recipe_version_id,
      participant_ids: row.participant_ids,
    }));
    const index = plan.meals.findIndex((row) => row.meal_id === meal.meal_id);
    const swapped = swapSlot(slots, index, {
      ...ctx,
      intent: plan.intent || { dinner_count: plan.meal_count, participant_ids: meal.participant_ids, meal_styles: [], practical_hints: [] },
    });
    if (!swapped.ok) return swapped;
    versionId = swapped.slots[index].recipe_version_id;
  }
  const entry = resolveVersion(versionId, ctx);
  if (!entry) return fail("unknown_recipe", 404);
  const decision = checkEligibility(entry, meal.participant_ids, ctx);
  if (!decision.eligible) return fail("hard_limit_blocked", 409, { blocked: decision.blocked });
  const kept = {
    meal_id: meal.meal_id,
    position: meal.position,
    state: meal.state,
    scheduled_date: meal.scheduled_date,
    participant_ids: [...meal.participant_ids],
  };
  applyPin(meal, entry);
  meal.meal_id = kept.meal_id;
  meal.position = kept.position;
  meal.state = kept.state;
  meal.scheduled_date = kept.scheduled_date;
  meal.participant_ids = kept.participant_ids;
  return { ok: true };
}

function sameParticipantIds(current, next) {
  const a = [...(current || [])].sort();
  const b = [...(next || [])].sort();
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

function setParticipants(plan, action, ctx) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  const members = assertParticipants(action.participant_ids, ctx.household_member_ids);
  if (!members.ok) return members;
  if (sameParticipantIds(meal.participant_ids, action.participant_ids)) {
    return { ok: true, skip_ingredient_sync: true };
  }
  if (meal.kind === "recipe") {
    const decision = checkEligibility(pinnedEntry(meal), action.participant_ids, ctx);
    if (!decision.eligible) return fail("hard_limit_blocked", 409, { blocked: decision.blocked });
  }
  meal.participant_ids = [...action.participant_ids];
  return { ok: true };
}

function convertNonRecipe(plan, action, kind) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (recipeLocked(meal) && meal.kind === "recipe") return fail("outcome_locked", 409);
  if (meal.kind !== "recipe" && !["planned", "skipped", "abandoned"].includes(meal.state)) {
    return fail("outcome_locked", 409);
  }
  clearRecipe(meal, kind);
  return { ok: true };
}

function adoptVersion(plan, action, ctx) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (meal.kind !== "recipe") return fail("illegal_transition", 409);
  if (!["planned", "selected"].includes(meal.state)) return fail("version_locked", 409);
  const entry = resolveVersion(action.recipe_version_id, ctx);
  if (!entry) return fail("unknown_recipe", 404);
  if (entry.pkg.recipe_id !== meal.recipe_id) return fail("recipe_mismatch", 409);
  const decision = checkEligibility(entry, meal.participant_ids, ctx);
  if (!decision.eligible) return fail("hard_limit_blocked", 409, { blocked: decision.blocked });
  applyPin(meal, entry);
  return { ok: true };
}

function setDate(plan, action) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (action.date == null || action.date === "") {
    meal.scheduled_date = null;
    return { ok: true };
  }
  if (!validDate(action.date)) return fail("date_invalid");
  meal.scheduled_date = action.date;
  return { ok: true };
}

function reorder(plan, action) {
  const ids = action.meal_ids;
  if (!Array.isArray(ids) || ids.length !== plan.meals.length || new Set(ids).size !== ids.length) {
    return fail("reorder_invalid");
  }
  const byId = new Map(plan.meals.map((meal) => [meal.meal_id, meal]));
  /** @type {object[]} */
  const next = [];
  for (const id of ids) {
    const meal = byId.get(id);
    if (!meal) return fail("reorder_invalid");
    next.push(meal);
  }
  next.forEach((meal, index) => {
    meal.position = index + 1;
  });
  plan.meals = next;
  return { ok: true };
}

function selectMeal(plan, action) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (meal.kind !== "recipe" || meal.state !== "planned") return fail("illegal_transition", 409);
  meal.state = "selected";
  return { ok: true };
}

function beginCook(plan, action) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (meal.kind !== "recipe") return fail("illegal_transition", 409);
  if (!["planned", "selected"].includes(meal.state)) return fail("illegal_transition", 409);
  meal.state = "cooking";
  return { ok: true };
}

function exitCook(plan, action) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (meal.state !== "cooking") return fail("illegal_transition", 409);
  meal.state = "planned";
  return { ok: true };
}

function finishCook(plan, action) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (meal.kind !== "recipe" || meal.state !== "cooking") return fail("illegal_transition", 409);
  meal.state = "cooked";
  meal.cooked_recipe_version_id = meal.recipe_version_id;
  return { ok: true };
}

function countableRatings(plan, meal) {
  return (meal.ratings || []).filter((row) => {
    if (!meal.participant_ids.includes(row.member_id)) return false;
    if (plan.data_origin === "household") return row.data_origin === "household";
    return row.data_origin === plan.data_origin;
  });
}

function applyRatingState(plan, meal) {
  const rated = new Set(countableRatings(plan, meal).map((row) => row.member_id));
  if (rated.size === 0) meal.state = "cooked";
  else if (meal.participant_ids.every((id) => rated.has(id))) meal.state = "fully_rated";
  else meal.state = "partially_rated";
}

function rateMeal(plan, action, ctx) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (meal.kind !== "recipe") return fail("leftovers_not_rated", 409);
  if (!["cooked", "partially_rated", "fully_rated"].includes(meal.state)) {
    return fail("rating_requires_cooked", 409);
  }
  const member_id = action.member_id || ctx.actor_member_id;
  if (!meal.participant_ids.includes(member_id)) return fail("forbidden_participant", 403);
  const members = assertParticipants([member_id], ctx.household_member_ids);
  if (!members.ok) return members;
  const score = action.score;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 10) {
    return fail("score_invalid");
  }
  const origin = ctx.data_origin || plan.data_origin;
  const existing = (meal.ratings || []).find((row) => row.member_id === member_id);
  if (existing && existing.data_origin === "household" && origin !== "household") {
    return fail("synthetic_cannot_replace_household_rating", 409);
  }
  const rating = {
    rating_id: existing?.rating_id || makeId(ctx, "dpr"),
    meal_id: meal.meal_id,
    member_id,
    recipe_version_id: meal.cooked_recipe_version_id || meal.recipe_version_id,
    score,
    data_origin: origin,
    created_at: existing?.created_at || ctx.now,
    updated_at: ctx.now,
  };
  meal.ratings = (meal.ratings || []).filter((row) => row.member_id !== member_id).concat(rating);
  applyRatingState(plan, meal);
  return { ok: true };
}

function markClosed(plan, action, state) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (!["planned", "selected", "cooking"].includes(meal.state)) return fail("illegal_transition", 409);
  meal.state = state;
  return { ok: true };
}

function fulfillMeal(plan, action) {
  const meal = findMeal(plan, action.meal_id);
  if (!meal) return fail("meal_not_found", 404);
  if (meal.kind === "recipe") return fail("illegal_transition", 409);
  if (meal.state !== "planned") return fail("illegal_transition", 409);
  meal.state = "fulfilled";
  return { ok: true };
}

function vote(plan, action, ctx) {
  const member_id = action.member_id || ctx.actor_member_id;
  const members = assertParticipants([member_id], ctx.household_member_ids);
  if (!members.ok) return members;
  const existing = (plan.votes || []).find((row) => row.member_id === member_id);
  if (existing) {
    existing.meal_id = action.meal_id || null;
    return { ok: true };
  }
  plan.votes.push({
    vote_id: makeId(ctx, "dpv"),
    dinner_plan_id: plan.dinner_plan_id,
    meal_id: action.meal_id || null,
    member_id,
    data_origin: ctx.data_origin || plan.data_origin,
    created_at: ctx.now,
  });
  return { ok: true };
}

function finalize(plan, ctx) {
  if (plan.status === "completed") return fail("plan_completed", 409);
  plan.finalized_by_member_id = ctx.actor_member_id;
  plan.finalized_at = ctx.now;
  plan.votes_required = false;
  return { ok: true, votes_cast: (plan.votes || []).length, votes_required: false };
}

function setPlanningPreferences(plan, action) {
  if (typeof action.keep_it_easy !== "boolean" || typeof action.keep_ingredients_simple !== "boolean") {
    return fail("planning_preferences_invalid");
  }
  plan.intent = {
    ...(plan.intent || {}),
    keep_it_easy: action.keep_it_easy,
    keep_ingredients_simple: action.keep_ingredients_simple,
  };
  return { ok: true };
}

function setCount(plan, action) {
  const counted = assertDinnerCount(action.meal_count);
  if (!counted.ok) return counted;
  if (counted.dinner_count < plan.meals.length) return fail("meal_count_too_small", 409);
  plan.meal_count = counted.dinner_count;
  plan.intent = { ...(plan.intent || {}), dinner_count: counted.dinner_count };
  return { ok: true };
}

function setLineState(plan, action, ctx) {
  const line = (plan.shop_lines || []).find((row) => sameShopLine(plan, row, action.line_id));
  if (!line) return fail("line_not_found", 404);
  const state = action.list_state === "checked" ? "purchased" : action.list_state;
  if (!["open", "already_have", "purchased"].includes(state)) return fail("list_state_invalid");
  line.list_state = state;
  line.updated_at = ctx.now;
  if (state === "purchased" || state === "already_have") markStarted(plan, ctx.now);
  return { ok: true };
}

function dispatch(plan, action, ctx) {
  switch (action.op) {
    case "add_meal":
      return addMeal(plan, action, ctx);
    case "remove_meal":
      return removeMeal(plan, action);
    case "swap_meal":
      return swapMeal(plan, action, ctx);
    case "set_participants":
      return setParticipants(plan, action, ctx);
    case "set_leftovers":
      return convertNonRecipe(plan, action, "leftovers");
    case "set_eating_out":
      return convertNonRecipe(plan, action, "eating_out");
    case "adopt_version":
      return adoptVersion(plan, action, ctx);
    case "set_date":
      return setDate(plan, action);
    case "reorder":
      return reorder(plan, action);
    case "select_meal":
      return selectMeal(plan, action);
    case "begin_cook":
      return beginCook(plan, action);
    case "exit_cook":
      return exitCook(plan, action);
    case "finish_cook":
      return finishCook(plan, action);
    case "rate_meal":
      return rateMeal(plan, action, ctx);
    case "skip_meal":
      return markClosed(plan, action, "skipped");
    case "abandon_meal":
      return markClosed(plan, action, "abandoned");
    case "fulfill_meal":
      return fulfillMeal(plan, action);
    case "vote":
      return vote(plan, action, ctx);
    case "finalize":
      return finalize(plan, ctx);
    case "set_count":
      return setCount(plan, action);
    case "set_planning_preferences":
      return setPlanningPreferences(plan, action);
    case "start_shopping":
      markStarted(plan, ctx.now);
      return { ok: true };
    case "set_line_state":
      return setLineState(plan, action, ctx);
    default:
      return fail("unknown_mutation");
  }
}

/**
 * @param {object} plan
 * @param {object} action
 * @param {object} [ctx]
 */
export function applyPlanMutation(plan, action, ctx = {}) {
  const effect = MUTATION_EFFECTS[action?.op];
  if (!effect) return fail("unknown_mutation");
  const next = structuredClone(plan);
  const previousLines = (next.shop_lines || []).map((line) => ({
    ...line,
    meal_ids: [...(line.meal_ids || [])],
  }));
  const applied = dispatch(next, action, ctx);
  if (!applied.ok) return applied;
  if (effect === "ingredients" && !applied.skip_ingredient_sync) syncShopping(next, previousLines, ctx);
  scopeShopLineIds(next);
  refreshStatus(next);
  next.updated_at = ctx.now || next.updated_at;
  next.votes_required = false;
  return {
    ok: true,
    plan: next,
    votes_required: false,
    votes_cast: (next.votes || []).length,
    shopping_started: shoppingHasStarted(next),
  };
}
