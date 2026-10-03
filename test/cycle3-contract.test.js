import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { vocabularyTagsForSlug } from "../src/lib/diner-taste-rank.js";
import { assessMealEligibility, planDinners, plannerCatalog, swapSlot } from "../src/lib/dinner-planner.js";
import { routeDinnerPlanRequest } from "../src/lib/dinner-plan-routes.js";
import { aggregateContributions, canonicalIngredient, scaleForDiners } from "../src/lib/ingredient-identity.js";
import { reduceMealAction, selectionGuard } from "../src/lib/meal-identity.js";
import {
  SHOPPING_START_TRIGGERS,
  STATUS_LABELS,
  assertDinnerCount,
  countsTowardCompletedMealLoop,
  parsePlanIntent,
  projectDinnerHistory,
} from "../src/lib/plan-contract.js";
import { applyPlanMutation, createDinnerPlan, resolvedRecipe } from "../src/lib/plan-mutations.js";
import {
  DINNER_PLAN_LIST_LIMIT,
  findCurrentDinnerPlanId,
  listHouseholdDinnerPlans,
  loadDinnerPlan,
  saveDinnerPlan,
} from "../src/lib/dinner-plan-store.js";
import { createMemberSession } from "../src/lib/session.js";

function sequencer() {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

function baseCtx(extra = {}) {
  return {
    now: "2026-10-04T12:00:00.000Z",
    actor_member_id: "ana",
    household_member_ids: ["ana", "bo", "cia"],
    constraints: [],
    data_origin: "household",
    tastes: [],
    id: sequencer(),
    ...extra,
  };
}

function version(id, ingredients, extra = {}) {
  return {
    concept: {
      concept_id: extra.slug || id,
      title: extra.title || id,
      tags: extra.tags || [],
    },
    pkg: {
      recipe_id: extra.recipe_id || `rcp_${extra.slug || id}`,
      recipe_version_id: id,
      version_number: extra.version_number || 1,
      title: extra.title || id,
      base_servings: extra.base_servings ?? 4,
      ingredients,
      steps: [{ step_number: 1, title: "Cook", body: extra.step || "Cook the pinned version." }],
      allergens: extra.allergens || [],
      vocabulary_tag_ids: extra.vocabulary || [],
    },
  };
}

const VERSIONS = {
  rv_flour_v1: version("rv_flour_v1", [
    { name: "flour", quantity: 4, unit: "cup" },
    { name: "olive oil", quantity: 4, unit: "tbsp" },
  ], { slug: "flour-dish", recipe_id: "rcp_flour", title: "Flour dish" }),
  rv_flour_v2: version("rv_flour_v2", [
    { name: "flour", quantity: 9, unit: "cup" },
    { name: "beef", quantity: 1, unit: "lb" },
  ], { slug: "flour-dish", recipe_id: "rcp_flour", version_number: 2, title: "Flour dish", step: "Version two steps." }),
  rv_oil_v1: version("rv_oil_v1", [
    { name: "olive oil", quantity: 2, unit: "tablespoon" },
    { name: "stock", quantity: 1, unit: "cup" },
  ], { slug: "oil-dish", recipe_id: "rcp_oil", title: "Oil dish" }),
  rv_broth_cup_v1: version("rv_broth_cup_v1", [
    { name: "broth", quantity: 4, unit: "cup" },
  ], { slug: "broth-cup", recipe_id: "rcp_broth_cup", title: "Broth cups" }),
  rv_broth_tbsp_v1: version("rv_broth_tbsp_v1", [
    { name: "broth", quantity: 4, unit: "tbsp" },
  ], { slug: "broth-tbsp", recipe_id: "rcp_broth_tbsp", title: "Broth spoons" }),
  rv_salt_v1: version("rv_salt_v1", [
    { name: "salt", quantity: 4, unit: "tsp" },
  ], { slug: "salt-dish", recipe_id: "rcp_salt", title: "Salt dish" }),
  rv_pasta_v1: version("rv_pasta_v1", [
    { name: "pasta", quantity: 8, unit: "oz" },
    { name: "olive oil", quantity: 2, unit: "tbsp" },
    { name: "milk", quantity: 0.5, unit: "cup" },
  ], { slug: "pasta-dinner", recipe_id: "rcp_pasta", title: "Pasta dinner" }),
};

function withVersions(extra = {}) {
  return baseCtx({ versions: VERSIONS, ...extra });
}

function recipeMeal(recipe_version_id, participant_ids, extra = {}) {
  return { kind: "recipe", recipe_version_id, participant_ids, ...extra };
}

function makePlan(meals, extra = {}, ctxExtra = {}) {
  const ctx = withVersions(ctxExtra);
  const created = createDinnerPlan(
    {
      household_id: "hh_cedar",
      meal_count: meals.length,
      entry_point: extra.entry_point || "plan_dinners",
      participant_ids: extra.participant_ids || ["ana", "bo"],
      meals,
      intent: extra.intent,
    },
    ctx
  );
  return { created, ctx };
}

function line(plan, ingredientId, unit) {
  return plan.shop_lines.find((row) => row.ingredient_id === ingredientId && row.unit === unit);
}

function mutate(plan, action, ctx, now = "2026-10-04T13:00:00.000Z") {
  return applyPlanMutation(plan, action, { ...ctx, now, id: ctx.id || sequencer() });
}

describe("dinner count and intent", () => {
  it("requires an explicit count and does not turn a week into 7", () => {
    expect(parsePlanIntent({ note: "this week" }).error).toBe("dinner_count_required");
    expect(assertDinnerCount(undefined).error).toBe("dinner_count_required");
    expect(parsePlanIntent({ dinner_count: "7" }).error).toBe("dinner_count_invalid");
    const seven = parsePlanIntent({ dinner_count: 7, entry_point: "plan_dinners", participant_ids: ["ana"] });
    expect(seven.ok).toBe(true);
    expect(seven.intent.dinner_count).toBe(7);
    expect(seven.intent.model).toBeUndefined();
  });

  it("keeps one model for a single dinner and for several dinners", () => {
    const tonight = makePlan([recipeMeal("rv_flour_v1", ["ana"])], { entry_point: "tonight", participant_ids: ["ana"] });
    const week = makePlan(
      [
        recipeMeal("rv_flour_v1", ["ana"]),
        recipeMeal("rv_oil_v1", ["ana", "bo"]),
        { kind: "leftovers", participant_ids: ["ana"] },
        { kind: "eating_out", participant_ids: ["bo"] },
      ],
      { entry_point: "plan_dinners" }
    );
    expect(tonight.created.ok).toBe(true);
    expect(week.created.ok).toBe(true);
    expect(tonight.created.plan.entry_point).toBe("tonight");
    expect(tonight.created.plan.meal_count).toBe(1);
    expect(week.created.plan.meal_count).toBe(4);
    expect(tonight.created.plan.status).toBe("draft");
    expect(week.created.plan.status).toBe("draft");
  });
});

describe("dates, order, leftovers, and finalize", () => {
  it("keeps meals undated until a date is assigned, and removing it does not rebuild the plan", () => {
    const { created, ctx } = makePlan([
      recipeMeal("rv_flour_v1", ["ana"]),
      recipeMeal("rv_oil_v1", ["ana", "bo"]),
    ]);
    const plan = created.plan;
    expect(plan.meals.every((meal) => meal.scheduled_date == null)).toBe(true);
    const dated = mutate(plan, { op: "set_date", meal_id: plan.meals[1].meal_id, date: "2026-10-08" }, ctx);
    expect(dated.ok).toBe(true);
    expect(dated.plan.meals[1].scheduled_date).toBe("2026-10-08");
    expect(dated.plan.meals[0].scheduled_date).toBeNull();
    expect(dated.plan.meals[0].state).toBe("planned");
    expect(dated.plan.meals[1].recipe_version_id).toBe("rv_oil_v1");
    expect(dated.plan.shop_deltas).toEqual([]);
    const cleared = mutate(dated.plan, { op: "set_date", meal_id: plan.meals[1].meal_id, date: null }, ctx, "2026-10-04T14:00:00.000Z");
    expect(cleared.plan.meals[1].scheduled_date).toBeNull();
    expect(cleared.plan.meals.map((meal) => meal.recipe_version_id)).toEqual(["rv_flour_v1", "rv_oil_v1"]);
    expect(JSON.stringify(cleared.plan.shop_lines)).toBe(JSON.stringify(plan.shop_lines));
  });

  it("reorders without forcing a cook sequence or rewriting the list", () => {
    const { created, ctx } = makePlan([
      recipeMeal("rv_flour_v1", ["ana"], { scheduled_date: "2026-10-09" }),
      recipeMeal("rv_oil_v1", ["bo"], { scheduled_date: "2026-10-06" }),
    ]);
    const [first, second] = created.plan.meals;
    const reordered = mutate(created.plan, { op: "reorder", meal_ids: [second.meal_id, first.meal_id] }, ctx);
    expect(reordered.plan.meals.map((meal) => meal.meal_id)).toEqual([second.meal_id, first.meal_id]);
    expect(reordered.plan.meals.map((meal) => meal.state)).toEqual(["planned", "planned"]);
    expect(reordered.plan.meals.map((meal) => meal.scheduled_date)).toEqual(["2026-10-06", "2026-10-09"]);
    expect(reordered.plan.shop_deltas).toEqual([]);
    expect(reordered.plan.shop_lines.map((row) => row.line_id)).toEqual(created.plan.shop_lines.map((row) => row.line_id));
  });

  it("lets leftovers and eating out occupy a slot without ingredients or a recipe rating", () => {
    const { created, ctx } = makePlan([
      recipeMeal("rv_flour_v1", ["ana", "bo"]),
      recipeMeal("rv_oil_v1", ["ana"]),
    ]);
    const oil = created.plan.meals[1];
    const left = mutate(created.plan, { op: "set_leftovers", meal_id: oil.meal_id }, ctx);
    expect(left.plan.meals[1].kind).toBe("leftovers");
    expect(left.plan.meals[1].recipe_version_id).toBeNull();
    expect(line(left.plan, "stock", "cup")).toBeUndefined();
    const added = mutate(left.plan, {
      op: "add_meal",
      kind: "eating_out",
      participant_ids: ["bo"],
    }, ctx, "2026-10-04T15:00:00.000Z");
    expect(added.ok).toBe(false);
    const counted = mutate(left.plan, { op: "set_count", meal_count: 3 }, ctx, "2026-10-04T15:00:00.000Z");
    const eating = mutate(counted.plan, { op: "add_meal", kind: "eating_out", participant_ids: ["bo"] }, ctx, "2026-10-04T16:00:00.000Z");
    expect(eating.ok).toBe(true);
    const slot = eating.plan.meals.find((meal) => meal.kind === "eating_out");
    const rated = mutate(eating.plan, { op: "rate_meal", meal_id: slot.meal_id, member_id: "bo", score: 8 }, ctx);
    expect(rated.error).toBe("leftovers_not_rated");
    const done = mutate(eating.plan, { op: "fulfill_meal", meal_id: slot.meal_id }, ctx);
    expect(done.plan.meals.find((meal) => meal.meal_id === slot.meal_id).state).toBe("fulfilled");
  });

  it("finalizes when nobody has voted", () => {
    const { created, ctx } = makePlan([recipeMeal("rv_flour_v1", ["ana"])], {
      entry_point: "find_dinner",
      participant_ids: ["ana"],
    });
    const finalized = mutate(created.plan, { op: "finalize" }, ctx);
    expect(finalized.ok).toBe(true);
    expect(finalized.votes_cast).toBe(0);
    expect(finalized.votes_required).toBe(false);
    expect(finalized.plan.status).toBe("ready");
    expect(finalized.plan.status && STATUS_LABELS[finalized.plan.status]).toBe("Ready to shop");
    expect(SHOPPING_START_TRIGGERS).toEqual(["start_shopping", "line_purchased", "line_already_have"]);
  });
});

describe("participants, limits, and versions", () => {
  it("changes quantities from the pinned version and blocks a new diner whose limit fails", () => {
    const nuts = [{ member_id: "bo", rule_key: "nuts", status: "prohibited" }];
    const { created, ctx } = makePlan(
      [recipeMeal("rv_flour_v1", ["ana", "bo", "cia"])],
      { participant_ids: ["ana", "bo", "cia"] },
      { constraints: nuts }
    );
    expect(line(created.plan, "flour", "cup").quantity).toBe(3);
    const smaller = mutate(created.plan, {
      op: "set_participants",
      meal_id: created.plan.meals[0].meal_id,
      participant_ids: ["ana"],
    }, ctx);
    expect(smaller.ok).toBe(true);
    expect(line(smaller.plan, "flour", "cup").quantity).toBe(1);
    const walnut = createDinnerPlan(
      {
        household_id: "hh_cedar",
        meal_count: 1,
        entry_point: "tonight",
        participant_ids: ["bo"],
        meals: [recipeMeal("rv_mushroom-walnut-bolognese_v1", ["bo"])],
      },
      baseCtx({
        constraints: nuts,
        tastes: [{ member_id: "bo", vocabulary_slug: "mushrooms", rank: "love", stance: "explicit", data_origin: "household" }],
      })
    );
    expect(walnut.ok).toBe(false);
    expect(walnut.error).toBe("hard_limit_blocked");
    const loved = assessMealEligibility(
      plannerCatalog().find((entry) => entry.concept.concept_id === "mushroom-walnut-bolognese"),
      ["bo"],
      nuts,
      [{ member_id: "bo", vocabulary_slug: "mushrooms", rank: "love", stance: "explicit", data_origin: "household" }]
    );
    expect(loved.eligible).toBe(false);
  });

  it("scales one recipe for 1, 2, 3, and 4 diners and keeps mixed counts in one list", () => {
    const pin = VERSIONS.rv_flour_v1.pkg.ingredients;
    expect(scaleForDiners(pin, 4, 1).map((item) => item.quantity)).toEqual([1, 1]);
    expect(scaleForDiners(pin, 4, 2).map((item) => item.quantity)).toEqual([2, 2]);
    expect(scaleForDiners(pin, 4, 3).map((item) => item.quantity)).toEqual([3, 3]);
    expect(scaleForDiners(pin, 4, 4).map((item) => item.quantity)).toEqual([4, 4]);
    const quarterCup = scaleForDiners([{ name: "milk", quantity: 1, unit: "cup" }], 4, 3);
    expect(quarterCup[0].quantity).toBe(0.75);
    const { created } = makePlan([
      recipeMeal("rv_flour_v1", ["ana"]),
      recipeMeal("rv_flour_v1", ["ana", "bo"]),
      recipeMeal("rv_flour_v1", ["ana", "bo", "cia"]),
      recipeMeal("rv_broth_cup_v1", ["ana", "bo", "cia"]),
      recipeMeal("rv_broth_tbsp_v1", ["ana"]),
    ], { participant_ids: ["ana", "bo", "cia"] });
    expect(created.ok).toBe(true);
    expect(line(created.plan, "flour", "cup").quantity).toBe(6);
    expect(line(created.plan, "olive-oil", "tbsp").quantity).toBe(6);
    expect(line(created.plan, "broth", "cup").quantity).toBe(3);
    expect(line(created.plan, "broth", "tbsp").quantity).toBe(1);
    expect(line(created.plan, "broth", "cup").line_id).not.toBe(line(created.plan, "broth", "tbsp").line_id);
  });

  it("adds tablespoons together and does not add them to cups", () => {
    const rows = aggregateContributions([
      { name: "olive oil", quantity: 1, unit: "tbsp", meal_id: "m1" },
      { name: "olive oil", quantity: 2, unit: "tablespoon", meal_id: "m2" },
      { name: "olive oil", quantity: 1, unit: "cup", meal_id: "m3" },
      { name: "diced onion", quantity: 1, unit: "count", note: null, meal_id: "m4" },
      { name: "onion", quantity: 2, unit: "count", note: "sliced", meal_id: "m5" },
      { name: "yellow onion", quantity: 1, unit: "count", note: "diced", meal_id: "m6" },
    ]);
    const oilSpoons = rows.find((row) => row.ingredient_id === "olive-oil" && row.unit === "tbsp");
    const oilCups = rows.find((row) => row.ingredient_id === "olive-oil" && row.unit === "cup");
    const onion = rows.find((row) => row.ingredient_id === "onion");
    expect(oilSpoons.quantity).toBe(3);
    expect(oilCups.quantity).toBe(1);
    expect(onion.quantity).toBe(4);
    expect(onion.preparation).toContain("sliced");
    expect(onion.preparation).toContain("diced");
    expect(canonicalIngredient("diced onion").ingredient_id).toBe("onion");
    expect(canonicalIngredient("yellow onion", "diced").ingredient_id).toBe("onion");
    expect(rows.every((row) => row.grocery_area == null)).toBe(true);
  });

  it("swaps one meal and leaves the other pinned version alone", () => {
    const { created, ctx } = makePlan([
      recipeMeal("rv_flour_v1", ["ana"]),
      recipeMeal("rv_oil_v1", ["ana"]),
    ]);
    const before = created.plan.meals[0];
    const swapped = mutate(created.plan, {
      op: "swap_meal",
      meal_id: created.plan.meals[1].meal_id,
      recipe_version_id: "rv_salt_v1",
    }, ctx);
    expect(swapped.ok).toBe(true);
    expect(swapped.plan.meals[0].recipe_version_id).toBe("rv_flour_v1");
    expect(swapped.plan.meals[0].pinned_steps).toEqual(before.pinned_steps);
    expect(swapped.plan.meals[0].pinned_ingredients).toEqual(before.pinned_ingredients);
    expect(swapped.plan.meals[1].recipe_version_id).toBe("rv_salt_v1");
    const latest = VERSIONS.rv_flour_v2;
    const resolved = resolvedRecipe(swapped.plan.meals[0], latest);
    expect(resolved.recipe_version_id).toBe("rv_flour_v1");
    expect(resolved.ingredients).toEqual(before.pinned_ingredients);
    expect(resolved.steps[0].body).toBe("Cook the pinned version.");
    expect(resolved.catalog_version_id).toBe("rv_flour_v2");
    const adopted = mutate(swapped.plan, {
      op: "adopt_version",
      meal_id: swapped.plan.meals[0].meal_id,
      recipe_version_id: "rv_flour_v2",
    }, ctx, "2026-10-04T16:00:00.000Z");
    expect(adopted.plan.meals[0].recipe_version_id).toBe("rv_flour_v2");
    expect(adopted.plan.meals[0].pinned_steps[0].body).toBe("Version two steps.");
    expect(adopted.plan.meals[1].recipe_version_id).toBe("rv_salt_v1");
  });
});

describe("shopping started", () => {
  it("regenerates before shopping and keeps purchased progress after any start trigger", () => {
    const { created, ctx } = makePlan([
      recipeMeal("rv_flour_v1", ["ana", "bo", "cia", "cia"].filter((id, index, all) => all.indexOf(id) === index)),
    ], { participant_ids: ["ana", "bo", "cia"] });
    const flourId = created.plan.meals[0].meal_id;
    const dropped = mutate(created.plan, { op: "set_leftovers", meal_id: flourId }, ctx);
    expect(dropped.plan.shop_lines).toEqual([]);
    expect(dropped.plan.shop_deltas).toEqual([]);
    const again = mutate(dropped.plan, {
      op: "swap_meal",
      meal_id: flourId,
      recipe_version_id: "rv_flour_v1",
    }, ctx);
    expect(again.ok).toBe(false);
    const restored = makePlan([
      recipeMeal("rv_flour_v1", ["ana"]),
      recipeMeal("rv_oil_v1", ["ana"]),
    ]);
    const plan = restored.created.plan;
    const flourLine = line(plan, "flour", "cup");
    const marked = mutate(plan, { op: "set_line_state", line_id: flourLine.line_id, list_state: "purchased" }, restored.ctx);
    expect(marked.plan.shopping_started_at).toBeTruthy();
    expect(marked.plan.status).toBe("shopping");
    expect(line(marked.plan, "flour", "cup").list_state).toBe("purchased");
    const have = mutate(marked.plan, {
      op: "set_line_state",
      line_id: line(marked.plan, "stock", "cup").line_id,
      list_state: "already_have",
    }, restored.ctx, "2026-10-04T13:30:00.000Z");
    expect(have.plan.shopping_started_at).toBe(marked.plan.shopping_started_at);
    const added = mutate(have.plan, {
      op: "set_count",
      meal_count: 3,
    }, restored.ctx, "2026-10-04T13:40:00.000Z");
    const withSalt = mutate(added.plan, {
      op: "add_meal",
      kind: "recipe",
      recipe_version_id: "rv_salt_v1",
      participant_ids: ["ana"],
    }, restored.ctx, "2026-10-04T13:45:00.000Z");
    expect(withSalt.plan.shop_deltas.some((delta) => delta.kind === "added" && delta.ingredient_id === "salt")).toBe(true);
    expect(line(withSalt.plan, "flour", "cup").list_state).toBe("purchased");
    expect(line(withSalt.plan, "stock", "cup").list_state).toBe("already_have");
    const removed = mutate(withSalt.plan, { op: "remove_meal", meal_id: plan.meals[0].meal_id }, restored.ctx, "2026-10-04T13:50:00.000Z");
    const retired = line(removed.plan, "flour", "cup");
    expect(retired.list_state).toBe("purchased");
    expect(retired.still_needed).toBe(false);
    expect(removed.plan.shop_deltas.some((delta) => delta.kind === "no_longer_needed" && delta.ingredient_id === "flour")).toBe(true);
    const mode = mutate(restored.created.plan, { op: "start_shopping" }, restored.ctx, "2026-10-04T12:30:00.000Z");
    expect(mode.plan.shopping_started_at).toBe("2026-10-04T12:30:00.000Z");
    expect(mode.plan.shop_lines.every((row) => row.list_state === "open")).toBe(true);
  });

  it("does not rewrite the list or append deltas when set_participants is unchanged", () => {
    const { created, ctx } = makePlan(
      [recipeMeal("rv_flour_v1", ["ana", "bo"])],
      { participant_ids: ["ana", "bo"] }
    );
    const started = mutate(created.plan, { op: "start_shopping" }, ctx, "2026-10-04T12:30:00.000Z");
    const meal = started.plan.meals[0];
    const deltaCount = (started.plan.shop_deltas || []).length;
    const noop = mutate(
      started.plan,
      {
        op: "set_participants",
        meal_id: meal.meal_id,
        participant_ids: ["bo", "ana"],
      },
      ctx,
      "2026-10-04T12:35:00.000Z"
    );
    expect(noop.ok).toBe(true);
    expect((noop.plan.shop_deltas || []).length).toBe(deltaCount);
    expect(noop.plan.shop_lines).toEqual(started.plan.shop_lines);
    const smaller = mutate(
      noop.plan,
      {
        op: "set_participants",
        meal_id: meal.meal_id,
        participant_ids: ["ana"],
      },
      ctx,
      "2026-10-04T12:40:00.000Z"
    );
    expect(smaller.ok).toBe(true);
    expect(line(smaller.plan, "flour", "cup").quantity).toBe(1);
    expect(smaller.plan.shop_deltas.some((d) => d.kind === "no_longer_needed" && d.ingredient_id === "flour")).toBe(
      true
    );
  });

  it("keeps purchased and already-have marks when a meal is swapped after shopping started", () => {
    const { created, ctx } = makePlan([
      recipeMeal("rv_flour_v1", ["ana"]),
      recipeMeal("rv_oil_v1", ["ana"]),
    ], { participant_ids: ["ana"] });
    const plan = created.plan;
    const flourLine = line(plan, "flour", "cup");
    const stockLine = line(plan, "stock", "cup");
    const started = mutate(plan, { op: "set_line_state", line_id: flourLine.line_id, list_state: "purchased" }, ctx);
    const marked = mutate(started.plan, {
      op: "set_line_state",
      line_id: stockLine.line_id,
      list_state: "already_have",
    }, ctx, "2026-10-04T13:05:00.000Z");
    const swapped = mutate(marked.plan, {
      op: "swap_meal",
      meal_id: plan.meals[1].meal_id,
      recipe_version_id: "rv_salt_v1",
    }, ctx, "2026-10-04T13:10:00.000Z");
    expect(swapped.ok).toBe(true);
    expect(line(swapped.plan, "flour", "cup").list_state).toBe("purchased");
    expect(line(swapped.plan, "stock", "cup").list_state).toBe("already_have");
    expect(line(swapped.plan, "stock", "cup").still_needed).toBe(false);
    expect(swapped.plan.shop_deltas.some((delta) => delta.kind === "no_longer_needed" && delta.ingredient_id === "stock")).toBe(true);
    expect(swapped.plan.shop_deltas.some((delta) => delta.kind === "added" && delta.ingredient_id === "salt")).toBe(true);
  });
});

describe("cook, rate, and history", () => {
  it("cooks out of order and keeps planned, selected, cooked, and rated apart", () => {
    const { created, ctx } = makePlan([
      recipeMeal("rv_flour_v1", ["ana", "bo"]),
      recipeMeal("rv_oil_v1", ["ana", "bo"]),
      recipeMeal("rv_salt_v1", ["ana"]),
    ]);
    const [first, second, third] = created.plan.meals;
    const cookedLate = mutate(created.plan, { op: "begin_cook", meal_id: third.meal_id }, ctx);
    const finished = mutate(cookedLate.plan, { op: "finish_cook", meal_id: third.meal_id }, ctx, "2026-10-04T13:10:00.000Z");
    expect(finished.plan.meals[0].state).toBe("planned");
    expect(finished.plan.meals[1].state).toBe("planned");
    expect(finished.plan.meals[2].state).toBe("cooked");
    expect(finished.plan.status).toBe("active");
    const selected = mutate(finished.plan, { op: "select_meal", meal_id: first.meal_id }, ctx, "2026-10-04T13:20:00.000Z");
    expect(selected.plan.meals[0].state).toBe("selected");
    expect(selected.plan.meals[2].state).toBe("cooked");
    const tooSoon = mutate(selected.plan, { op: "rate_meal", meal_id: first.meal_id, member_id: "ana", score: 9 }, ctx);
    expect(tooSoon.error).toBe("rating_requires_cooked");
    const skippedCook = mutate(selected.plan, { op: "finish_cook", meal_id: second.meal_id }, ctx);
    expect(skippedCook.error).toBe("illegal_transition");
    const partial = mutate(selected.plan, { op: "rate_meal", meal_id: third.meal_id, member_id: "ana", score: 8 }, ctx);
    expect(partial.plan.meals[2].state).toBe("fully_rated");
    expect(partial.plan.meals[2].ratings[0].recipe_version_id).toBe("rv_salt_v1");
    const outsider = mutate(selected.plan, { op: "rate_meal", meal_id: third.meal_id, member_id: "cia", score: 7 }, ctx);
    expect(outsider.error).toBe("forbidden_participant");
    const two = mutate(created.plan, { op: "begin_cook", meal_id: first.meal_id }, ctx);
    const twoDone = mutate(two.plan, { op: "finish_cook", meal_id: first.meal_id }, ctx);
    const oneRate = mutate(twoDone.plan, { op: "rate_meal", meal_id: first.meal_id, member_id: "ana", score: 6 }, ctx);
    expect(oneRate.plan.meals[0].state).toBe("partially_rated");
    const both = mutate(oneRate.plan, { op: "rate_meal", meal_id: first.meal_id, member_id: "bo", score: 7 }, ctx, "2026-10-04T18:00:00.000Z");
    expect(both.plan.meals[0].state).toBe("fully_rated");
    expect(countsTowardCompletedMealLoop(both.plan, both.plan.meals[0])).toBe(true);
    const skipped = mutate(created.plan, { op: "skip_meal", meal_id: second.meal_id }, ctx);
    const abandoned = mutate(skipped.plan, { op: "abandon_meal", meal_id: third.meal_id }, ctx);
    const history = projectDinnerHistory(abandoned.plan);
    expect(history.map((row) => row.state)).toEqual(["planned", "skipped", "abandoned"]);
    expect(history.every((row) => row.completed === false)).toBe(true);
    expect(history[0].cooked).toBe(false);
    expect(history[1].skipped).toBe(true);
    expect(history[2].abandoned).toBe(true);
    expect(history[1].cooked).toBe(false);
  });

  it("does not count a planned meal or a synthetic plan as a completed meal loop", () => {
    const { created } = makePlan([recipeMeal("rv_flour_v1", ["ana"])], { participant_ids: ["ana"] });
    expect(projectDinnerHistory(created.plan)[0].completed).toBe(false);
    expect(countsTowardCompletedMealLoop(created.plan, created.plan.meals[0])).toBe(false);
    const synthetic = { ...created.plan, data_origin: "synthetic" };
    synthetic.meals[0].state = "fully_rated";
    synthetic.meals[0].ratings = [{ member_id: "ana", data_origin: "synthetic", score: 8 }];
    expect(countsTowardCompletedMealLoop(synthetic, synthetic.meals[0])).toBe(false);
  });
});

describe("deterministic planner", () => {
  it("fills explicit slots from the 24 meals, keeps taste ahead of a weak match, and does not invent coverage", () => {
    const catalog = plannerCatalog();
    expect(catalog).toHaveLength(24);
    const intent = parsePlanIntent({
      dinner_count: 4,
      entry_point: "plan_dinners",
      participant_ids: ["ana"],
      meal_styles: ["tacos"],
      requested_ingredient: "swordfish",
      practical_hints: [{ hint_key: "under_30_minutes" }, { hint_key: "low_cleanup" }],
    }).intent;
    const planned = planDinners(intent, {
      constraints: [],
      tastes: [{ member_id: "ana", vocabulary_slug: "tacos", rank: "love", stance: "explicit", data_origin: "household" }],
    });
    expect(planned.model).toBeNull();
    expect(planned.catalog_size).toBe(24);
    expect(planned.constrained_requests).toEqual([
      expect.objectContaining({ slug: "swordfish", reason: "no_catalog_coverage", invented: false, catalog_matches: 0 }),
    ]);
    expect(planned.unscored_hints).toContain("low_cleanup");
    const slugs = planned.slots.map((slot) => slot.recipe_slug);
    expect(planned.slots.every((slot) => slot.result === "recommended")).toBe(true);
    expect(new Set(slugs).size).toBe(4);
    expect(slugs.every((slug) => catalog.some((entry) => entry.concept.concept_id === slug))).toBe(true);
    expect(vocabularyTagsForSlug(slugs[0])).toContain("tacos");
    const earliest = [...catalog].sort((a, b) => a.concept.concept_id.localeCompare(b.concept.concept_id))[0];
    if (!vocabularyTagsForSlug(earliest.concept.concept_id).includes("tacos")) {
      expect(slugs[0]).not.toBe(earliest.concept.concept_id);
    }
    const lovedNuts = planDinners(
      { ...intent, requested_ingredient: null, dinner_count: 3 },
      {
        constraints: [{ member_id: "ana", rule_key: "nuts", status: "prohibited" }],
        tastes: [{ member_id: "ana", vocabulary_slug: "mushrooms", rank: "love", stance: "explicit", data_origin: "household" }],
      }
    );
    expect(lovedNuts.slots.map((slot) => slot.recipe_slug)).not.toContain("mushroom-walnut-bolognese");
    const open = planDinners(
      { ...intent, dinner_count: 1, requested_ingredient: null, participant_ids: ["bo"] },
      {
        constraints: [{ member_id: "ana", rule_key: "nuts", status: "prohibited" }],
        tastes: [{ member_id: "bo", vocabulary_slug: "mushrooms", rank: "love", stance: "explicit", data_origin: "household" }],
      }
    );
    expect(open.slots[0].recipe_slug).toBe("mushroom-walnut-bolognese");
  });

  it("returns a constrained slot instead of a violating meal, and a swap does not rebuild the others", () => {
    const onlyNuts = plannerCatalog().filter((entry) => entry.concept.concept_id === "mushroom-walnut-bolognese");
    const blocked = planDinners(
      { dinner_count: 2, entry_point: "plan_dinners", participant_ids: ["ana"], meal_styles: [], practical_hints: [] },
      { catalog: onlyNuts, constraints: [{ member_id: "ana", rule_key: "nuts", status: "prohibited" }] }
    );
    expect(blocked.slots.every((slot) => slot.result === "constrained" && slot.recipe_slug == null)).toBe(true);
    const planned = planDinners(
      { dinner_count: 3, entry_point: "plan_dinners", participant_ids: ["ana"], meal_styles: [], practical_hints: [] },
      { constraints: [] }
    );
    const swapped = swapSlot(planned.slots, 1, {
      intent: { dinner_count: 3, participant_ids: ["ana"], meal_styles: [], practical_hints: [] },
      constraints: [],
    });
    expect(swapped.ok).toBe(true);
    expect(swapped.slots[0]).toBe(planned.slots[0]);
    expect(swapped.slots[2]).toBe(planned.slots[2]);
    expect(swapped.slots[1]).not.toBe(planned.slots[1]);
    expect(swapped.slots[0].recipe_version_id).toBe(planned.slots[0].recipe_version_id);
    expect(swapped.slots[1].recipe_slug).not.toBe(planned.slots[1].recipe_slug);
  });

  it("does not let less-often remove a meal", () => {
    const meal = plannerCatalog().find((entry) => entry.concept.concept_id === "crispy-chipotle-tofu-tacos");
    const decision = assessMealEligibility(
      meal,
      ["ana"],
      [],
      [{ member_id: "ana", vocabulary_slug: "tacos", rank: "less_often", stance: "explicit", data_origin: "household" }]
    );
    expect(decision.eligible).toBe(true);
  });
});

describe("FW-01", () => {
  it("still refuses to move a cooked meal by previewing another recipe", () => {
    const guard = selectionGuard(
      {
        mealOptions: [{ meal_option_id: "mo_cooked" }, { meal_option_id: "mo_other" }],
        cooks: [{ meal_option_id: "mo_cooked", cooked_at: "2026-10-01T00:00:00.000Z", data_origin: "household" }],
        ratings: [],
        selections: [],
      },
      "mo_other"
    );
    expect(guard.ok).toBe(false);
    expect(guard.error).toBe("selection_locked");
    const preview = reduceMealAction(
      { selectedMealId: "mo_cooked", outcomeLocked: true, lifecycle: "Cooked" },
      { type: "preview", mealOptionId: "mo_other" }
    );
    expect(preview.selectedMealId).toBe("mo_cooked");
    expect(preview.lifecycle).toBe("Cooked");
  });
});

function asD1(sqlite, options = {}) {
  let lineInserts = 0;
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              if (String(sql).includes("INSERT INTO dinner_shop_line")) {
                lineInserts += 1;
                if (options.failLineInsertAt && lineInserts === options.failLineInsertAt) {
                  throw new Error("forced_line_insert_failure");
                }
              }
              sqlite.prepare(sql).run(...params);
              return { success: true, meta: { changes: 1 } };
            },
            async first() {
              return sqlite.prepare(sql).get(...params) ?? null;
            },
            async all() {
              return { results: sqlite.prepare(sql).all(...params) };
            },
          };
        },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) {
          results.push(await statement.run());
        }
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  return sqlite;
}

function insertHousehold(sqlite, id, origin = "household") {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES (?, ?, 'active', 'America/Chicago', 2, 'organic', '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z', ?)`
  ).run(id, id, origin);
}

function insertMember(sqlite, householdId, memberId) {
  sqlite.prepare(
    `INSERT INTO member
      (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES (?, ?, ?, 'owner', 'active', '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z')`
  ).run(memberId, householdId, memberId);
}

function legacyLineId(ingredientId, unit) {
  const safe = (value) => String(value || "x").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `sl_${safe(ingredientId)}_${safe(unit)}`;
}

function lineIdentity(row) {
  return `${row.ingredient_id}\u0000${row.unit}`;
}

describe("shopping line identity", () => {
  it("puts the dinner plan id in the line id and rejects the old global id", () => {
    const id = sequencer();
    const ctx = withVersions({
      id,
      household_member_ids: ["ana"],
      actor_member_id: "ana",
      data_origin: "synthetic",
    });
    const pasta = createDinnerPlan(
      {
        dinner_plan_id: "dp_pasta_night",
        household_id: "hh_fw_c3_shop",
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: ["ana"],
        meals: [recipeMeal("rv_pasta_v1", ["ana"])],
      },
      ctx
    );
    const other = createDinnerPlan(
      {
        dinner_plan_id: "dp_second_night",
        household_id: "hh_fw_c3_shop",
        meal_count: 1,
        entry_point: "tonight",
        participant_ids: ["ana"],
        meals: [recipeMeal("rv_oil_v1", ["ana"])],
      },
      ctx
    );
    expect(pasta.ok).toBe(true);
    expect(other.ok).toBe(true);
    const pastaOil = line(pasta.plan, "olive-oil", "tbsp");
    const otherOil = line(other.plan, "olive-oil", "tbsp");
    const pastaLine = line(pasta.plan, "pasta", "oz");
    expect(pastaOil.line_id).toBe("sl_dp_pasta_night_olive-oil_tbsp");
    expect(otherOil.line_id).toBe("sl_dp_second_night_olive-oil_tbsp");
    expect(pastaOil.line_id).not.toBe(legacyLineId("olive-oil", "tbsp"));
    expect(otherOil.line_id).not.toBe(pastaOil.line_id);
    expect(pastaLine.line_id).toBe("sl_dp_pasta_night_pasta_oz");
    expect(line(pasta.plan, "milk", "cup").quantity).toBe(0.125);
    const stored = pasta.plan.shop_lines.find((row) => row.line_id === legacyLineId("pasta", "oz"));
    expect(stored).toBeUndefined();
  });

  it("keeps both full lists when a synthetic household checks, marks already-have, and swaps", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite);
    insertHousehold(sqlite, "hh_fw_c3_shop", "synthetic");
    sqlite.prepare(
      `UPDATE household SET acquisition_source = 'synthetic_qa' WHERE household_id = 'hh_fw_c3_shop'`
    ).run();
    insertMember(sqlite, "hh_fw_c3_shop", "ana");
    const id = sequencer();
    const ctx = withVersions({
      id,
      household_member_ids: ["ana"],
      actor_member_id: "ana",
      data_origin: "synthetic",
    });
    const pasta = createDinnerPlan(
      {
        dinner_plan_id: "dp_pasta_night",
        household_id: "hh_fw_c3_shop",
        meal_count: 2,
        entry_point: "plan_dinners",
        participant_ids: ["ana"],
        meals: [
          recipeMeal("rv_pasta_v1", ["ana"]),
          recipeMeal("rv_flour_v1", ["ana"]),
        ],
      },
      ctx
    );
    const second = createDinnerPlan(
      {
        dinner_plan_id: "dp_second_night",
        household_id: "hh_fw_c3_shop",
        meal_count: 1,
        entry_point: "tonight",
        participant_ids: ["ana"],
        meals: [recipeMeal("rv_oil_v1", ["ana"])],
      },
      ctx
    );
    expect(pasta.ok).toBe(true);
    expect(second.ok).toBe(true);
    await saveDinnerPlan(db, pasta.plan);
    await saveDinnerPlan(db, second.plan);
    let loadedPasta = await loadDinnerPlan(db, "dp_pasta_night");
    let loadedSecond = await loadDinnerPlan(db, "dp_second_night");
    const pastaIds = loadedPasta.shop_lines.map(lineIdentity).sort();
    const secondIds = loadedSecond.shop_lines.map(lineIdentity).sort();
    expect(pastaIds).toEqual(["flour\u0000cup", "milk\u0000cup", "olive-oil\u0000tbsp", "pasta\u0000oz"]);
    expect(secondIds).toEqual(["olive-oil\u0000tbsp", "stock\u0000cup"]);
    expect(line(loadedPasta, "milk", "cup").quantity).toBe(0.125);
    expect(loadedPasta.shop_lines.every((row) => row.line_id.startsWith("sl_dp_pasta_night_"))).toBe(true);
    expect(loadedSecond.shop_lines.every((row) => row.line_id.startsWith("sl_dp_second_night_"))).toBe(true);
    expect(line(loadedPasta, "olive-oil", "tbsp").line_id).not.toBe(line(loadedSecond, "olive-oil", "tbsp").line_id);

    const checked = mutate(loadedPasta, {
      op: "set_line_state",
      line_id: line(loadedPasta, "flour", "cup").line_id,
      list_state: "purchased",
    }, ctx);
    await saveDinnerPlan(db, checked.plan);
    const have = mutate(await loadDinnerPlan(db, "dp_pasta_night"), {
      op: "set_line_state",
      line_id: legacyLineId("pasta", "oz"),
      list_state: "already_have",
    }, ctx, "2026-10-04T13:10:00.000Z");
    expect(have.ok).toBe(true);
    await saveDinnerPlan(db, have.plan);
    loadedPasta = await loadDinnerPlan(db, "dp_pasta_night");
    loadedSecond = await loadDinnerPlan(db, "dp_second_night");
    expect(loadedPasta.shop_lines.map(lineIdentity).sort()).toEqual(pastaIds);
    expect(loadedSecond.shop_lines.map(lineIdentity).sort()).toEqual(secondIds);
    expect(line(loadedPasta, "flour", "cup").list_state).toBe("purchased");
    expect(line(loadedPasta, "pasta", "oz").list_state).toBe("already_have");
    expect(line(loadedPasta, "pasta", "oz").line_id).toBe("sl_dp_pasta_night_pasta_oz");
    expect(line(loadedPasta, "milk", "cup").quantity).toBe(0.125);
    expect(line(loadedSecond, "stock", "cup").list_state).toBe("open");

    const swapped = mutate(loadedPasta, {
      op: "swap_meal",
      meal_id: loadedPasta.meals.find((meal) => meal.recipe_version_id === "rv_flour_v1").meal_id,
      recipe_version_id: "rv_salt_v1",
    }, ctx, "2026-10-04T13:20:00.000Z");
    expect(swapped.ok).toBe(true);
    await saveDinnerPlan(db, swapped.plan);
    loadedPasta = await loadDinnerPlan(db, "dp_pasta_night");
    loadedSecond = await loadDinnerPlan(db, "dp_second_night");
    expect(line(loadedPasta, "pasta", "oz").list_state).toBe("already_have");
    expect(line(loadedPasta, "pasta", "oz").still_needed).toBe(true);
    expect(line(loadedPasta, "flour", "cup").list_state).toBe("purchased");
    expect(line(loadedPasta, "flour", "cup").still_needed).toBe(false);
    expect(line(loadedPasta, "salt", "tsp").still_needed).toBe(true);
    expect(line(loadedPasta, "milk", "cup").quantity).toBe(0.125);
    expect(line(loadedPasta, "olive-oil", "tbsp")).toBeTruthy();
    expect(loadedSecond.shop_lines.map(lineIdentity).sort()).toEqual(secondIds);
    expect(sqlite.prepare("SELECT COUNT(*) AS c FROM dinner_shop_line").get().c).toBe(
      loadedPasta.shop_lines.length + loadedSecond.shop_lines.length
    );
    sqlite.close();
  });

  it("rolls back a failed line rebuild and leaves the stored list whole", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite);
    insertHousehold(sqlite, "hh_fw_c3_shop", "synthetic");
    insertMember(sqlite, "hh_fw_c3_shop", "ana");
    const ctx = withVersions({
      household_member_ids: ["ana"],
      actor_member_id: "ana",
      data_origin: "synthetic",
    });
    const created = createDinnerPlan(
      {
        dinner_plan_id: "dp_pasta_night",
        household_id: "hh_fw_c3_shop",
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: ["ana"],
        meals: [recipeMeal("rv_pasta_v1", ["ana"])],
      },
      ctx
    );
    await saveDinnerPlan(db, created.plan);
    const before = sqlite.prepare(
      `SELECT line_id, ingredient_id, unit, quantity, list_state FROM dinner_shop_line
       WHERE dinner_plan_id = 'dp_pasta_night' ORDER BY ingredient_id, unit`
    ).all();
    expect(before.map((row) => row.ingredient_id)).toEqual(["milk", "olive-oil", "pasta"]);
    const loaded = await loadDinnerPlan(db, "dp_pasta_night");
    loaded.meals[0].title = "Truncated pasta";
    loaded.shop_lines = loaded.shop_lines.map((row) => ({ ...row, list_state: "purchased" }));
    const failing = asD1(sqlite, { failLineInsertAt: 1 });
    await expect(saveDinnerPlan(failing, loaded)).rejects.toThrow("forced_line_insert_failure");
    const after = sqlite.prepare(
      `SELECT line_id, ingredient_id, unit, quantity, list_state FROM dinner_shop_line
       WHERE dinner_plan_id = 'dp_pasta_night' ORDER BY ingredient_id, unit`
    ).all();
    expect(after).toEqual(before);
    expect(sqlite.prepare("SELECT title FROM dinner_plan_meal WHERE dinner_plan_id = 'dp_pasta_night'").get().title).toBe("Pasta dinner");
    sqlite.close();
  });
});

describe("persistence and authorization", () => {
  it("round-trips purchased and already-have lines", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite);
    insertHousehold(sqlite, "hh_cedar");
    insertMember(sqlite, "hh_cedar", "ana");
    const { created } = makePlan([
      recipeMeal("rv_flour_v1", ["ana"]),
      recipeMeal("rv_oil_v1", ["ana"]),
    ], { participant_ids: ["ana"] }, { household_member_ids: ["ana"], actor_member_id: "ana" });
    created.plan.household_id = "hh_cedar";
    created.plan.created_by_member_id = "ana";
    const flour = line(created.plan, "flour", "cup");
    const stock = line(created.plan, "stock", "cup");
    flour.list_state = "purchased";
    stock.list_state = "already_have";
    created.plan.shopping_started_at = "2026-10-04T12:00:00.000Z";
    created.plan.status = "shopping";
    await saveDinnerPlan(db, created.plan);
    const loaded = await loadDinnerPlan(db, created.plan.dinner_plan_id);
    expect(loaded.shop_lines.find((row) => row.ingredient_id === "flour").list_state).toBe("purchased");
    expect(loaded.shop_lines.find((row) => row.ingredient_id === "stock").list_state).toBe("already_have");
    expect(loaded.meals[0].recipe_version_id).toBe("rv_flour_v1");
    expect(loaded.meals[0].pinned_steps[0].body).toBe("Cook the pinned version.");
    sqlite.close();
  });

  it("allows a member and denies another household, a missing plan, and a foreign participant", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite);
    insertHousehold(sqlite, "hh_cedar");
    insertHousehold(sqlite, "hh_birch");
    insertMember(sqlite, "hh_cedar", "ana");
    insertMember(sqlite, "hh_birch", "bo");
    sqlite.prepare(
      `INSERT INTO constraint_rule
        (constraint_id, household_id, member_id, rule_key, status, created_at, updated_at)
       VALUES ('cr_ana_nuts', 'hh_cedar', 'ana', 'nuts', 'prohibited', '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z')`
    ).run();
    const env = { DB: db };
    const ana = await createMemberSession(db, { household_id: "hh_cedar", member_id: "ana" });
    const bo = await createMemberSession(db, { household_id: "hh_birch", member_id: "bo" });
    const writeOrigin = async (_env, _householdId, request, body) => {
      if (request.headers.get("X-FlavorWeave-Data-Origin") === "synthetic") return "synthetic";
      if (body?.data_origin === "synthetic") return "synthetic";
      return "household";
    };
    const call = (token, path, method, body, headers = {}) => routeDinnerPlanRequest(
      env,
      new Request(`http://local${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-HE-Session": token } : {}),
          ...headers,
        },
        body: method === "GET" ? undefined : JSON.stringify(body || {}),
      }),
      path,
      new URL(`http://local${path}`),
      { writeOrigin }
    );
    const denied = await call(null, "/api/dinner-plans", "POST", { meal_count: 1 });
    expect(denied.status).toBe(401);
    const created = await call(ana.session_token, "/api/dinner-plans", "POST", {
      meal_count: 1,
      entry_point: "tonight",
      participant_ids: ["ana"],
      data_origin: "household",
      eligible: true,
      constraints: [],
      meals: [{ kind: "recipe", recipe_version_id: "rv_mushroom-walnut-bolognese_v1", participant_ids: ["ana"], eligible: true }],
    });
    expect(created.status).toBe(409);
    const blocked = await created.json();
    expect(blocked.error).toBe("hard_limit_blocked");
    const okRes = await call(ana.session_token, "/api/dinner-plans", "POST", {
      meal_count: 2,
      entry_point: "plan_dinners",
      participant_ids: ["ana"],
      meals: [
        { kind: "recipe", recipe_version_id: "rv_crispy-chipotle-tofu-tacos_v1", participant_ids: ["ana"], scheduled_date: "2026-10-11" },
        { kind: "recipe", recipe_version_id: "rv_miso-ginger-salmon_v1", participant_ids: ["ana"] },
      ],
    }, { "X-FlavorWeave-Data-Origin": "synthetic" });
    expect(okRes.status).toBe(201);
    const okBody = await okRes.json();
    expect(okBody.plan.data_origin).toBe("synthetic");
    expect(okBody.plan.meals[1].scheduled_date).toBeNull();
    expect(okBody.votes_required).toBe(false);
    const planId = okBody.plan.dinner_plan_id;
    const read = await call(ana.session_token, `/api/dinner-plans/${planId}`, "GET");
    expect(read.status).toBe(200);
    const cross = await call(bo.session_token, `/api/dinner-plans/${planId}`, "GET");
    expect(cross.status).toBe(403);
    expect((await cross.json()).error).toBe("forbidden_cross_household");
    const missing = await call(ana.session_token, "/api/dinner-plans/dp_missing", "GET");
    expect(missing.status).toBe(404);
    const foreign = await call(ana.session_token, `/api/dinner-plans/${planId}/mutations`, "POST", {
      op: "set_participants",
      meal_id: okBody.plan.meals[0].meal_id,
      participant_ids: ["bo"],
    });
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).error).toBe("forbidden_member");
    sqlite.close();
  });
});

function insertBareDinnerPlan(sqlite, row) {
  sqlite.prepare(
    `INSERT INTO dinner_plan
      (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json,
       shopping_started_at, data_origin, created_by_member_id, created_at, updated_at)
     VALUES (?, ?, ?, 1, 'plan_dinners', '{}', ?, 'synthetic', ?, ?, ?)`
  ).run(
    row.dinner_plan_id,
    row.household_id,
    row.status,
    row.shopping_started_at || null,
    row.member_id,
    row.created_at,
    row.updated_at
  );
}

describe("household dinner plan discovery", () => {
  it("picks the newest open plan and lists at most five for that household", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite);
    insertHousehold(sqlite, "hh_cedar", "synthetic");
    insertHousehold(sqlite, "hh_birch", "synthetic");
    insertHousehold(sqlite, "hh_tie", "synthetic");
    insertHousehold(sqlite, "hh_pine", "synthetic");
    insertMember(sqlite, "hh_cedar", "ana");
    insertMember(sqlite, "hh_birch", "bo");
    insertMember(sqlite, "hh_tie", "tia");
    insertMember(sqlite, "hh_pine", "pin");
    const cedar = [
      ["dp_a", "draft", "2026-09-28T00:00:00.000Z"],
      ["dp_b", "draft", "2026-09-29T00:00:00.000Z"],
      ["dp_c", "ready", "2026-09-30T00:00:00.000Z"],
      ["dp_d", "active", "2026-10-01T00:00:00.000Z"],
      ["dp_shop", "shopping", "2026-10-02T00:00:00.000Z"],
      ["dp_draft", "draft", "2026-10-04T00:00:00.000Z"],
      ["dp_done", "completed", "2026-10-09T00:00:00.000Z"],
    ];
    for (const [dinner_plan_id, status, updated_at] of cedar) {
      insertBareDinnerPlan(sqlite, {
        dinner_plan_id,
        household_id: "hh_cedar",
        status,
        member_id: "ana",
        shopping_started_at: status === "shopping" ? updated_at : null,
        created_at: updated_at,
        updated_at,
      });
    }
    insertBareDinnerPlan(sqlite, {
      dinner_plan_id: "dp_birch_secret",
      household_id: "hh_birch",
      status: "draft",
      member_id: "bo",
      created_at: "2026-10-10T00:00:00.000Z",
      updated_at: "2026-10-10T00:00:00.000Z",
    });
    insertBareDinnerPlan(sqlite, {
      dinner_plan_id: "dp_m",
      household_id: "hh_tie",
      status: "draft",
      member_id: "tia",
      created_at: "2026-10-03T00:00:00.000Z",
      updated_at: "2026-10-03T00:00:00.000Z",
    });
    insertBareDinnerPlan(sqlite, {
      dinner_plan_id: "dp_z",
      household_id: "hh_tie",
      status: "active",
      member_id: "tia",
      created_at: "2026-10-03T00:00:00.000Z",
      updated_at: "2026-10-03T00:00:00.000Z",
    });

    expect(await findCurrentDinnerPlanId(db, "hh_cedar")).toBe("dp_draft");
    const listed = await listHouseholdDinnerPlans(db, "hh_cedar");
    expect(DINNER_PLAN_LIST_LIMIT).toBe(5);
    expect(listed.map((row) => row.dinner_plan_id)).toEqual(["dp_draft", "dp_shop", "dp_d", "dp_c", "dp_b"]);
    expect(listed.every((row) => row.household_id === "hh_cedar")).toBe(true);
    expect(listed.map((row) => row.dinner_plan_id)).not.toContain("dp_birch_secret");
    expect(listed.map((row) => row.dinner_plan_id)).not.toContain("dp_done");
    expect(await findCurrentDinnerPlanId(db, "hh_birch")).toBe("dp_birch_secret");
    expect(await findCurrentDinnerPlanId(db, "hh_tie")).toBe("dp_z");
    expect(await findCurrentDinnerPlanId(db, "hh_pine")).toBeNull();
    expect(await listHouseholdDinnerPlans(db, "hh_pine")).toEqual([]);
    sqlite.close();
  });

  it("recovers a stored plan from the household with no client pointer", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite);
    insertHousehold(sqlite, "hh_cedar", "synthetic");
    insertHousehold(sqlite, "hh_birch", "synthetic");
    insertHousehold(sqlite, "hh_pine", "synthetic");
    insertMember(sqlite, "hh_cedar", "ana");
    insertMember(sqlite, "hh_cedar", "cam");
    insertMember(sqlite, "hh_birch", "bo");
    insertMember(sqlite, "hh_pine", "pin");
    const env = { DB: db };
    const ana = await createMemberSession(db, { household_id: "hh_cedar", member_id: "ana" });
    const cam = await createMemberSession(db, { household_id: "hh_cedar", member_id: "cam" });
    const bo = await createMemberSession(db, { household_id: "hh_birch", member_id: "bo" });
    const pin = await createMemberSession(db, { household_id: "hh_pine", member_id: "pin" });
    const writeOrigin = async () => "synthetic";
    const call = (token, path, method = "GET", query = "") => {
      const url = new URL(`http://local${path}${query ? `?${query}` : ""}`);
      return routeDinnerPlanRequest(
        env,
        new Request(url, {
          method,
          headers: token ? { "X-HE-Session": token } : {},
        }),
        path,
        url,
        { writeOrigin }
      );
    };
    const ids = sequencer();
    const older = createDinnerPlan(
      {
        dinner_plan_id: "dp_older_shop",
        household_id: "hh_cedar",
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: ["ana"],
        meals: [recipeMeal("rv_flour_v1", ["ana"])],
      },
      withVersions({
        id: ids,
        now: "2026-10-02T00:00:00.000Z",
        household_member_ids: ["ana", "cam"],
        actor_member_id: "ana",
        data_origin: "synthetic",
      })
    );
    older.plan.status = "shopping";
    older.plan.shopping_started_at = "2026-10-02T00:00:00.000Z";
    await saveDinnerPlan(db, older.plan);
    const newer = createDinnerPlan(
      {
        dinner_plan_id: "dp_newer_draft",
        household_id: "hh_cedar",
        meal_count: 1,
        entry_point: "tonight",
        participant_ids: ["ana"],
        meals: [recipeMeal("rv_oil_v1", ["ana"])],
      },
      withVersions({
        id: ids,
        now: "2026-10-05T00:00:00.000Z",
        household_member_ids: ["ana", "cam"],
        actor_member_id: "ana",
        data_origin: "synthetic",
      })
    );
    await saveDinnerPlan(db, newer.plan);
    insertBareDinnerPlan(sqlite, {
      dinner_plan_id: "dp_birch_secret",
      household_id: "hh_birch",
      status: "active",
      member_id: "bo",
      created_at: "2026-10-06T00:00:00.000Z",
      updated_at: "2026-10-06T00:00:00.000Z",
    });

    expect(await findCurrentDinnerPlanId(db, "hh_cedar")).toBe("dp_newer_draft");
    const denied = await call(null, "/api/dinner-plans");
    expect(denied.status).toBe(401);
    expect((await denied.json()).error).toBe("unauthorized");

    const listed = await call(ana.session_token, "/api/dinner-plans");
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    const byId = await call(ana.session_token, "/api/dinner-plans/dp_newer_draft");
    expect(byId.status).toBe(200);
    const byIdBody = await byId.json();
    const current = await call(cam.session_token, "/api/dinner-plans/current");
    expect(current.status).toBe(200);
    const currentBody = await current.json();
    expect(listedBody.ok).toBe(true);
    expect(listedBody.current).toEqual(byIdBody.plan);
    expect(currentBody.plan).toEqual(byIdBody.plan);
    expect(currentBody.plan.dinner_plan_id).toBe("dp_newer_draft");
    expect(currentBody.plan.meals).toHaveLength(1);
    expect(currentBody.plan.shop_lines.length).toBeGreaterThan(0);
    expect(listedBody.plans.map((row) => row.dinner_plan_id)).toEqual(["dp_newer_draft", "dp_older_shop"]);
    expect(listedBody.plans.every((row) => row.household_id === "hh_cedar")).toBe(true);
    expect(listedBody.plans[0].shop_lines).toBeUndefined();
    expect(JSON.stringify(listedBody)).not.toContain("dp_birch_secret");

    const sameHousehold = await call(ana.session_token, "/api/dinner-plans", "GET", "household_id=hh_cedar");
    expect(sameHousehold.status).toBe(200);
    const otherList = await call(ana.session_token, "/api/dinner-plans", "GET", "household_id=hh_birch");
    expect(otherList.status).toBe(403);
    expect((await otherList.json()).error).toBe("forbidden_cross_household");
    const otherCurrent = await call(ana.session_token, "/api/dinner-plans/current", "GET", "household_id=hh_no_such");
    expect(otherCurrent.status).toBe(403);
    const birchList = await call(bo.session_token, "/api/dinner-plans");
    const birchBody = await birchList.json();
    expect(birchBody.current.dinner_plan_id).toBe("dp_birch_secret");
    expect(birchBody.plans.map((row) => row.dinner_plan_id)).toEqual(["dp_birch_secret"]);
    expect(JSON.stringify(birchBody)).not.toContain("dp_newer_draft");
    const guessed = await call(bo.session_token, "/api/dinner-plans/dp_newer_draft");
    expect(guessed.status).toBe(403);
    expect((await guessed.json()).error).toBe("forbidden_cross_household");
    const missing = await call(ana.session_token, "/api/dinner-plans/dp_missing");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error).toBe("plan_not_found");

    const emptyList = await call(pin.session_token, "/api/dinner-plans");
    expect(emptyList.status).toBe(200);
    expect(await emptyList.json()).toEqual({ ok: true, current: null, plans: [] });
    const emptyCurrent = await call(pin.session_token, "/api/dinner-plans/current");
    expect(emptyCurrent.status).toBe(200);
    expect(await emptyCurrent.json()).toEqual({ ok: true, plan: null });

    sqlite.prepare("UPDATE dinner_plan SET status = 'completed' WHERE dinner_plan_id = 'dp_newer_draft'").run();
    const afterClose = await call(ana.session_token, "/api/dinner-plans");
    const afterCloseBody = await afterClose.json();
    expect(afterCloseBody.current.dinner_plan_id).toBe("dp_older_shop");
    expect(afterCloseBody.plans.map((row) => row.dinner_plan_id)).toEqual(["dp_older_shop", "dp_newer_draft"]);
    sqlite.prepare("UPDATE dinner_plan SET status = 'completed' WHERE household_id = 'hh_cedar'").run();
    const wrapped = await call(ana.session_token, "/api/dinner-plans");
    expect(wrapped.status).toBe(200);
    const wrappedBody = await wrapped.json();
    expect(wrappedBody.current).toBeNull();
    expect(wrappedBody.plans.map((row) => row.dinner_plan_id)).toEqual(["dp_newer_draft", "dp_older_shop"]);
    sqlite.close();
  });
});
