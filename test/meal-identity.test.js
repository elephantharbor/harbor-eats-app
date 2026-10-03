import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  canonicalRecipeVersion,
  cookGuard,
  historyFromActivity,
  ratingGuard,
  reduceMealAction,
  resolvePlanOutcome,
  selectionGuard,
} from "../src/lib/meal-identity.js";

function clientReduce() {
  const code = readFileSync(new URL("../public/meal-identity.js", import.meta.url), "utf8");
  const sandbox = { window: {}, Object, JSON };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.MealIdentity.reduceMealAction;
}

const household = { household_id: "hh001", data_origin: "household", acquisition_source: "organic" };

function ratedState() {
  return {
    selectedMealId: "plan-A",
    previewMealId: null,
    cookingMealId: null,
    lifecycle: "Rated",
    outcomeLocked: true,
    lockedMealOptionId: "plan-A",
    ratingsByOption: {
      "plan-A": { m1: { score: 8, note: "", recipe_version_id: "rv_miso-ginger-salmon_v1" } },
    },
    ratings: { m1: { score: 8, note: "", recipe_version_id: "rv_miso-ginger-salmon_v1" } },
  };
}

describe("FW-01 meal identity", () => {
  it("keeps A's rating after inspecting B, entering cook, and exiting", () => {
    let state = ratedState();
    state = reduceMealAction(state, { type: "preview", mealOptionId: "plan-B" });
    expect(state.selectedMealId).toBe("plan-A");
    expect(state.lifecycle).toBe("Rated");
    expect(state.ratings.m1.score).toBe(8);
    expect(state.ratingsByOption["plan-B"]).toBeUndefined();

    state = reduceMealAction(state, { type: "begin_cook", mealOptionId: "plan-B" });
    expect(state.selectedMealId).toBe("plan-A");
    expect(state.cookingMealId).toBe("plan-B");
    expect(state.lifecycle).toBe("Rated");

    state = reduceMealAction(state, { type: "exit_cook" });
    expect(state.cookingMealId).toBeNull();
    expect(state.lifecycle).toBe("Rated");
    expect(state.ratings.m1.recipe_version_id).toBe("rv_miso-ginger-salmon_v1");

    const finish = reduceMealAction(
      { ...state, cookingMealId: "plan-B", previewMealId: "plan-B" },
      { type: "finish_cook" }
    );
    expect(finish.committed).toBe(false);
    expect(finish.error).toBe("cook_requires_explicit_selection");
    expect(finish.lifecycle).toBe("Rated");
    expect(finish.ratingsByOption["plan-A"].m1.score).toBe(8);
    expect(finish.ratingsByOption["plan-B"]).toBeUndefined();
  });

  it("navigation only does not select", () => {
    const state = reduceMealAction(
      { selectedMealId: null, lifecycle: "Unselected", ratingsByOption: {} },
      { type: "navigate", mealOptionId: "plan-B" }
    );
    expect(state.previewMealId).toBe("plan-B");
    expect(state.selectedMealId).toBeNull();
    expect(state.lifecycle).toBe("Unselected");
  });

  it("explicit selection chooses the meal and abandonment does not rate it", () => {
    let state = reduceMealAction(
      { selectedMealId: null, lifecycle: "Unselected", outcomeLocked: false, ratingsByOption: {} },
      { type: "select", mealOptionId: "plan-B" }
    );
    expect(state.selectedMealId).toBe("plan-B");
    expect(state.lifecycle).toBe("Selected");
    expect(state.ratings.m1).toBeUndefined();

    state = reduceMealAction(state, { type: "abandon_selection" });
    expect(state.selectedMealId).toBeNull();
    expect(state.lifecycle).toBe("Unselected");
    expect(state.ratingsByOption["plan-B"]).toBeUndefined();
  });

  it("refuses to move a locked rating onto a later selection", () => {
    const state = reduceMealAction(ratedState(), { type: "select", mealOptionId: "plan-B" });
    expect(state.error).toBe("selection_locked");
    expect(state.selectedMealId).toBe("plan-A");
    expect(state.ratings.m1.score).toBe(8);
  });

  it("second recommendation round does not inherit the first round's rating", () => {
    const first = ratedState();
    const second = reduceMealAction(
      {
        ...first,
        outcomeLocked: false,
        lifecycle: "Unselected",
        selectedMealId: null,
      },
      { type: "select", mealOptionId: "plan2-B" }
    );
    expect(second.selectedMealId).toBe("plan2-B");
    expect(second.ratingsByOption["plan-A"].m1.score).toBe(8);
    expect(second.ratingsByOption["plan-A"].m1.recipe_version_id).toBe("rv_miso-ginger-salmon_v1");
    expect(second.ratings.m1).toBeUndefined();
  });

  it("binds a rating to the cooked meal's recipe version permanently", () => {
    let state = reduceMealAction(
      {
        selectedMealId: "plan-A",
        outcomeLocked: true,
        lockedMealOptionId: "plan-A",
        lifecycle: "Cooked",
        ratingsByOption: {},
      },
      { type: "rate", memberId: "m1", score: 8, recipeVersionId: "rv_miso-ginger-salmon_v1" }
    );
    state = reduceMealAction(state, {
      type: "rate",
      memberId: "m1",
      score: 9,
      recipeVersionId: "rv_other_v1",
    });
    expect(state.ratingsByOption["plan-A"].m1.score).toBe(9);
    expect(state.ratingsByOption["plan-A"].m1.recipe_version_id).toBe("rv_miso-ginger-salmon_v1");
    expect(canonicalRecipeVersion(
      { recipe_version: "rv_miso-ginger-salmon_v1" },
      "rv_other_v1",
      "rv_miso-ginger-salmon_v1"
    )).toBe("rv_miso-ginger-salmon_v1");
  });

  it("acceptance: rate A, inspect B, cook enter/exit without complete, reload keeps A rated and B unrated", () => {
    let state = ratedState();
    for (const action of [
      { type: "preview", mealOptionId: "plan-B" },
      { type: "begin_cook", mealOptionId: "plan-B" },
      { type: "exit_cook" },
    ]) {
      state = reduceMealAction(state, action);
    }
    expect(state.selectedMealId).toBe("plan-A");
    expect(state.ratingsByOption["plan-A"].m1.score).toBe(8);
    expect(state.ratingsByOption["plan-B"]).toBeUndefined();

    const outcome = resolvePlanOutcome({
      household,
      mealOptions: [
        { plan_id: "p1", meal_option_id: "plan-A", name: "Miso salmon", recipe_slug: "miso-ginger-salmon", recipe_version: "rv_miso-ginger-salmon_v1" },
        { plan_id: "p1", meal_option_id: "plan-B", name: "Tofu tacos", recipe_slug: "crispy-tofu-tacos", recipe_version: "rv_crispy-tofu-tacos_v1" },
      ],
      selections: [
        { plan_id: "p1", meal_option_id: "plan-A", created_at: "2026-10-02T00:00:00Z", data_origin: "household" },
      ],
      cooks: [
        { plan_id: "p1", cook_id: "c1", meal_option_id: "plan-A", cooked_at: "2026-10-02T00:30:00Z", data_origin: "household" },
      ],
      ratings: [
        { plan_id: "p1", meal_option_id: "plan-A", member_id: "m1", score: 8, recipe_version_id: "rv_miso-ginger-salmon_v1", data_origin: "household" },
      ],
    });
    expect(outcome.meal_option_id).toBe("plan-A");
    expect(outcome.ratings).toHaveLength(1);
    expect(outcome.ratings[0].meal_option_id).toBe("plan-A");
    expect(outcome.ratings.find((row) => row.meal_option_id === "plan-B")).toBeUndefined();
  });

  it("reload outcome still shows A rated and B unrated after a stray selection", () => {
    const outcome = resolvePlanOutcome({
      household,
      mealOptions: [
        { plan_id: "p1", meal_option_id: "plan-A", name: "Miso salmon", recipe_slug: "miso-ginger-salmon", recipe_version: "rv_miso-ginger-salmon_v1" },
        { plan_id: "p1", meal_option_id: "plan-B", name: "Tofu tacos", recipe_slug: "crispy-tofu-tacos", recipe_version: "rv_crispy-tofu-tacos_v1", selected: 1 },
      ],
      selections: [
        { plan_id: "p1", meal_option_id: "plan-A", created_at: "2026-10-02T00:00:00Z", data_origin: "household" },
        { plan_id: "p1", meal_option_id: "plan-B", created_at: "2026-10-02T01:00:00Z", data_origin: "household" },
      ],
      cooks: [
        { plan_id: "p1", cook_id: "c1", meal_option_id: "plan-A", cooked_at: "2026-10-02T00:30:00Z", data_origin: "household" },
      ],
      ratings: [
        { plan_id: "p1", meal_option_id: "plan-A", member_id: "m1", score: 8, recipe_version_id: "rv_miso-ginger-salmon_v1", data_origin: "household" },
      ],
    });
    expect(outcome.meal_option_id).toBe("plan-A");
    expect(outcome.ratings).toHaveLength(1);
    expect(outcome.ratings[0].score).toBe(8);
    expect(outcome.option.name).toBe("Miso salmon");

    const history = historyFromActivity({
      household,
      plans: [{ plan_id: "p1", status: "Selected", active_member_count: 1, data_origin: "household" }],
      options: [
        { plan_id: "p1", meal_option_id: "plan-A", name: "Miso salmon", recipe_slug: "miso-ginger-salmon", recipe_version: "rv_miso-ginger-salmon_v1" },
        { plan_id: "p1", meal_option_id: "plan-B", name: "Tofu tacos", recipe_slug: "crispy-tofu-tacos", recipe_version: "rv_crispy-tofu-tacos_v1" },
      ],
      selections: [
        { plan_id: "p1", meal_option_id: "plan-A", created_at: "2026-10-02T00:00:00Z", data_origin: "household" },
        { plan_id: "p1", meal_option_id: "plan-B", created_at: "2026-10-02T01:00:00Z", data_origin: "household" },
      ],
      cooks: [
        { plan_id: "p1", cook_id: "c1", meal_option_id: "plan-A", cooked_at: "2026-10-02T00:30:00Z", data_origin: "household" },
      ],
      ratings: [
        { plan_id: "p1", meal_option_id: "plan-A", member_id: "m1", score: 8, recipe_version_id: "rv_miso-ginger-salmon_v1", data_origin: "household" },
      ],
    });
    expect(history).toHaveLength(1);
    expect(history[0].meal_name).toBe("Miso salmon");
    expect(history[0].meal_option_id).toBe("plan-A");
    expect(history[0].avg_score).toBe(8);
    expect(history[0].status).toBe("Rated");
    expect(history[0].recipe_version_id).toBe("rv_miso-ginger-salmon_v1");
  });

  it("client reducer matches the server reducer for the inspect/cook/exit path", () => {
    const reduce = clientReduce();
    let state = ratedState();
    for (const action of [
      { type: "preview", mealOptionId: "plan-B" },
      { type: "begin_cook", mealOptionId: "plan-B" },
      { type: "exit_cook" },
      { type: "finish_cook" },
    ]) {
      const fromClient = action.type === "finish_cook"
        ? reduce({ ...state, cookingMealId: "plan-B" }, action)
        : reduce(state, action);
      const fromServer = action.type === "finish_cook"
        ? reduceMealAction({ ...state, cookingMealId: "plan-B" }, action)
        : reduceMealAction(state, action);
      expect(fromClient.selectedMealId).toBe(fromServer.selectedMealId);
      expect(fromClient.lifecycle).toBe(fromServer.lifecycle);
      expect(fromClient.error || null).toBe(fromServer.error || null);
      expect(fromClient.committed || false).toBe(fromServer.committed || false);
      state = fromServer;
    }
    expect(state.ratingsByOption["plan-A"].m1.score).toBe(8);
  });

  it("server guards: cook and rating cannot retarget a different meal", () => {
    const identity = {
      household,
      selections: [
        { meal_option_id: "plan-A", created_at: "2026-10-02T00:00:00Z", data_origin: "household" },
        { meal_option_id: "plan-B", created_at: "2026-10-02T01:00:00Z", data_origin: "household" },
      ],
      cooks: [{ cook_id: "c1", meal_option_id: "plan-A", cooked_at: "2026-10-02T00:30:00Z", data_origin: "household" }],
      ratings: [{ meal_option_id: "plan-A", member_id: "m1", score: 8, data_origin: "household" }],
    };
    expect(selectionGuard(identity, "plan-B").ok).toBe(false);
    expect(selectionGuard(identity, "plan-B").error).toBe("selection_locked");
    expect(cookGuard(identity, "plan-B").ok).toBe(false);
    expect(ratingGuard(identity, "plan-B").ok).toBe(false);
    expect(ratingGuard(identity, "plan-A").ok).toBe(true);
    expect(cookGuard({ selections: [], cooks: [], ratings: [] }, "plan-B").error).toBe("selection_required");
  });
});
