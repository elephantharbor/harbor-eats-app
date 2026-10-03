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
import { loadDinnerPlan, saveDinnerPlan } from "../src/lib/dinner-plan-store.js";
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

function asD1(sqlite) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              sqlite.prepare(sql).run(...params);
              return { success: true };
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
