import { describe, expect, it } from "vitest";
import { createFakeProvider, createGenerationService, createMemoryStore, TASKS } from "../src/ai/index.js";
import { postValidateRecipeAdaptation } from "../src/ai/adaptation-schema.js";
import { validateAdaptationSafety, effectivePinnedIngredients } from "../src/lib/meal-adaptation.js";
import { applyPlanMutation, createDinnerPlan } from "../src/lib/plan-mutations.js";
import { plannerCatalog } from "../src/lib/dinner-planner.js";

const adaptOut = {
  acknowledgement: "Parsley works here.",
  kind: "substitution",
  support: "advice",
  ingredient_ops: [{ op: "replace", from_id: "cilantro", to_name: "parsley", policy: "keep_scaled" }],
  step_notes: [],
  equipment_supported: true,
  flavor_impact: "similar",
  warning: null,
};

describe("recipe adaptation", () => {
  it("post_validate rejects digits in acknowledgement", () => {
    const bad = postValidateRecipeAdaptation({ ...adaptOut, acknowledgement: "Use 2 bunches" });
    expect(bad.ok).toBe(false);
  });

  it("apply_adaptation updates effective ingredients without mutating pin", () => {
    const ctx = {
      now: "2026-10-04T12:00:00.000Z",
      actor_member_id: "a",
      household_member_ids: ["a"],
      constraints: [],
      data_origin: "household",
      tastes: [],
      catalog: plannerCatalog(),
      id: (p) => `${p}_1`,
    };
    const created = createDinnerPlan(
      {
        entry_point: "plan_dinners",
        meal_count: 1,
        fill: "manual",
        meals: [{ kind: "recipe", recipe_version_id: plannerCatalog()[0].pkg.recipe_version_id }],
        participant_ids: ["a"],
      },
      ctx
    );
    const plan = created.plan;
    const meal = plan.meals[0];
    const pinBefore = structuredClone(meal.pinned_ingredients);
    const firstId = meal.pinned_ingredients[0].ingredient_id || "salt";
    const applied = applyPlanMutation(
      plan,
      {
        op: "apply_adaptation",
        meal_id: meal.meal_id,
        adaptation: {
          support: "advice",
          override_json: {
            acknowledgement: "Parsley works.",
            kind: "substitution",
            support: "advice",
            ops: [{ op: "replace", from_id: firstId, to_name: "parsley", policy: "keep_scaled", to_ingredient_id: "parsley" }],
          },
        },
      },
      ctx
    );
    expect(applied.ok).toBe(true);
    expect(meal.pinned_ingredients).toEqual(pinBefore);
  });

  it("fake provider runs recipe_adaptation task", async () => {
    const provider = createFakeProvider({ script: [{ json: adaptOut }] });
    const service = createGenerationService({
      provider,
      store: createMemoryStore(),
      env: { AI_GATEWAY_ENABLED: "1", AI_TASKS_ENABLED: "recipe_adaptation", AI_DAILY_BUDGET_USD: "5" },
    });
    const r = await service.run(
      "recipe_adaptation",
      {
        text: "no cilantro",
        recipe: {
          recipe_version_id: "rv_test",
          title: "Test",
          equipment: [],
          ingredients: [{ ingredient_id: "cilantro", name: "cilantro" }],
          steps: [{ step_number: 1, title: "Mix" }],
        },
      },
      { householdId: "hh", fallback: null }
    );
    expect(r.ok).toBe(true);
    expect(r.output.kind).toBe("substitution");
    expect(TASKS.recipe_adaptation.executable).toBe(true);
  });

  it("rejects peanuts for no_nuts household", () => {
    const meal = {
      kind: "recipe",
      recipe_slug: "test",
      title: "Test",
      participant_ids: ["a"],
      pinned_ingredients: [{ ingredient_id: "cashew", name: "cashews" }],
    };
    const out = validateAdaptationSafety(
      {
          ingredient_ops: [{ op: "replace", from_id: "cashew", to_name: "shrimp", policy: "keep_scaled" }],
        step_notes: [],
        acknowledgement: "Try peanuts.",
        kind: "substitution",
        support: "advice",
      },
      meal,
      { constraints: [{ member_id: "a", rule_key: "shellfish", status: "prohibited" }], tastes: [], catalog: plannerCatalog() }
    );
    expect(out.ok).toBe(false);
  });
});
