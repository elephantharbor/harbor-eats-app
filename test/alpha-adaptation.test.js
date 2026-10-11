import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createFakeProvider, createGenerationService, createMemoryStore, TASKS } from "../src/ai/index.js";
import { renderPrompt } from "../src/ai/prompts.js";
import { postValidateRecipeAdaptation } from "../src/ai/adaptation-schema.js";
import {
  ADAPTATION_SAFETY_REFUSAL,
  PRESSURE_COOKER_UNSUPPORTED,
  canonicalIngredientKey,
  equipmentUnsupportedResponse,
  effectiveRecipeView,
  ingredientMatchesSource,
  validateAdaptationSafety,
} from "../src/lib/meal-adaptation.js";
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
    const source = meal.pinned_ingredients[0];
    source.ingredient_id = source.ingredient_id || "extra-firm-tofu";
    const pinBefore = structuredClone(meal.pinned_ingredients);
    const firstId = source.ingredient_id;
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
    expect(applied.plan.meals[0].pinned_ingredients).toEqual(pinBefore);
    expect(effectiveRecipeView(applied.plan.meals[0]).ingredients[0].name).toBe("parsley");
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

  it("uses recipe_adaptation@3 so a stale cache entry misses", () => {
    expect(renderPrompt("recipe_adaptation", { text: "omit chipotle", recipe: {} }).version).toBe("recipe_adaptation@3");
    expect(TASKS.recipe_adaptation.prompt_version).toBe("recipe_adaptation@3");
  });

  it("preview and production enable adaptation and explanation with per-task caps", () => {
    for (const file of ["deploy/pages/preview/wrangler.toml", "deploy/pages/production/wrangler.toml"]) {
      const text = readFileSync(file, "utf8");
      const match = text.match(/AI_TASKS_ENABLED = "([^"]+)"/);
      const tasks = match[1].split(",");
      expect(tasks).toEqual(expect.arrayContaining(["planning_intent", "discovery_intent", "recipe_adaptation", "explanation"]));
    }
    expect(TASKS.recipe_adaptation.reasoning_effort).toBe("none");
    expect(TASKS.recipe_adaptation.limits.max_output_tokens).toBe(520);
    expect(TASKS.recipe_adaptation.allowed_models).toEqual(["fast-small"]);
    expect(TASKS.explanation.reasoning_effort).toBe("none");
    expect(TASKS.explanation.limits.max_output_tokens).toBe(300);
    expect(TASKS.explanation.allowed_models).toEqual(["fast-small"]);
  });

  const restrictedMeal = {
    kind: "recipe",
    recipe_slug: "test",
    title: "Test",
    participant_ids: ["a"],
    pinned_ingredients: [{ ingredient_id: "cashew", name: "cashews" }],
  };

  function swap(toName) {
    return {
      ingredient_ops: [{ op: "replace", from_id: "cashew", to_name: toName, policy: "keep_scaled" }],
      step_notes: [],
      acknowledgement: "Try this instead.",
      kind: "substitution",
      support: "advice",
    };
  }

  it("rejects peanuts, shrimp, and dairy for restricted diners", () => {
    const peanut = validateAdaptationSafety(swap("peanuts"), restrictedMeal, {
      constraints: [{ member_id: "a", rule_key: "nuts", status: "prohibited" }],
      tastes: [],
      catalog: plannerCatalog(),
    });
    expect(peanut.ok).toBe(false);
    const shrimp = validateAdaptationSafety(swap("shrimp"), restrictedMeal, {
      constraints: [{ member_id: "a", rule_key: "shellfish", status: "prohibited" }],
      tastes: [],
      catalog: plannerCatalog(),
    });
    expect(shrimp.ok).toBe(false);
    const dairy = validateAdaptationSafety(swap("butter"), restrictedMeal, {
      constraints: [{ member_id: "a", rule_key: "dairy", status: "prohibited" }],
      tastes: [],
      catalog: plannerCatalog(),
    });
    expect(dairy.ok).toBe(false);
  });

  it("treats parsley and cilantro as known herbs after descriptor stripping", () => {
    const herbCatalog = [
      {
        pkg: {
          ingredients: [
            { name: "fresh parsley", ingredient_id: "fresh-parsley" },
            { name: "fresh cilantro", ingredient_id: "fresh-cilantro" },
          ],
        },
      },
    ];
    expect(canonicalIngredientKey("flat-leaf parsley")).toBe("parsley");
    expect(canonicalIngredientKey("fresh-parsley")).toBe("parsley");
    for (const name of ["parsley", "fresh parsley", "flat-leaf parsley", "cilantro"]) {
      const out = validateAdaptationSafety(swap(name), restrictedMeal, {
        constraints: [],
        tastes: [],
        catalog: herbCatalog,
      });
      expect(out.ok, name).toBe(true);
      expect(out.override.ops[0].to_name).toBe(name);
    }
    const madeUp = validateAdaptationSafety(swap("zzqx-powder"), restrictedMeal, {
      constraints: [],
      tastes: [],
      catalog: herbCatalog,
    });
    expect(madeUp.ok).toBe(false);
    expect(madeUp.status).toBe("rejected_safety");
    expect(madeUp.blocked[0].limit_ids).toEqual(["unknown_ingredient"]);
  });

  it("fails closed on an unknown ingredient", () => {
    const out = validateAdaptationSafety(swap("zzqx-powder"), restrictedMeal, {
      constraints: [],
      tastes: [],
      catalog: plannerCatalog(),
    });
    expect(out.ok).toBe(false);
    expect(out.status).toBe("rejected_safety");
  });

  it("allows cashews under HH001-style nut rules", () => {
    const out = validateAdaptationSafety(swap("cashews"), restrictedMeal, {
      constraints: [
        { member_id: "a", rule_key: "dairy", status: "prohibited" },
        { member_id: "a", rule_key: "meat", status: "prohibited" },
        { member_id: "a", rule_key: "poultry", status: "prohibited" },
        { member_id: "a", rule_key: "shellfish", status: "prohibited" },
        { member_id: "a", rule_key: "nuts", status: "prohibited" },
        { member_id: "a", rule_key: "cashew", status: "permitted" },
      ],
      tastes: [],
      catalog: plannerCatalog(),
    });
    expect(out.ok).toBe(true);
  });

  it("rejects a peanut swap again when the plan applies a prepared override", () => {
    const ctx = {
      now: "2026-10-04T12:00:00.000Z",
      actor_member_id: "a",
      household_member_ids: ["a"],
      constraints: [{ member_id: "a", rule_key: "nuts", status: "prohibited" }],
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
    const meal = created.plan.meals[0];
    const fromId = meal.pinned_ingredients[0].ingredient_id || "salt";
    const applied = applyPlanMutation(
      created.plan,
      {
        op: "apply_adaptation",
        meal_id: meal.meal_id,
        adaptation: {
          support: "advice",
          override_json: {
            acknowledgement: "Peanuts work.",
            kind: "substitution",
            support: "advice",
            ops: [{ op: "replace", from_id: fromId, to_name: "peanuts", policy: "keep_scaled" }],
          },
        },
      },
      ctx
    );
    expect(applied.ok).toBe(false);
    expect(applied.error).toBe("adaptation_not_applicable");
    expect(applied.status).toBe(409);
    expect(applied.acknowledgement).toBe(ADAPTATION_SAFETY_REFUSAL);
    expect(meal.adaptation).toBeFalsy();
  });

  it("drops a replace with no source in the recipe and will not apply it", () => {
    const meal = {
      kind: "recipe",
      recipe_slug: "test",
      title: "Test",
      participant_ids: ["a"],
      pinned_ingredients: [{ ingredient_id: "cilantro", name: "cilantro" }],
    };
    const ctx = { constraints: [], tastes: [], catalog: plannerCatalog() };
    for (const fromId of [null, "not-in-this-recipe"]) {
      const checked = validateAdaptationSafety(
        {
          ingredient_ops: [{ op: "replace", from_id: fromId, to_name: "parsley", policy: "keep_scaled" }],
          acknowledgement: "Parsley works.",
          kind: "substitution",
          support: "advice",
        },
        meal,
        ctx
      );
      expect(checked.ok).toBe(true);
      expect(checked.override.ops).toEqual([]);
    }
    const planCtx = {
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
      planCtx
    );
    const planMeal = created.plan.meals[0];
    const applied = applyPlanMutation(
      created.plan,
      {
        op: "apply_adaptation",
        meal_id: planMeal.meal_id,
        adaptation: {
          support: "advice",
          override_json: {
            acknowledgement: "Parsley works.",
            kind: "substitution",
            support: "advice",
            ops: [{ op: "replace", from_id: null, to_name: "parsley", policy: "keep_scaled" }],
          },
        },
      },
      planCtx
    );
    expect(applied.ok).toBe(false);
    expect(planMeal.adaptation).toBeFalsy();
  });

  it("applies omit chipotle powder when the model names the ingredient", () => {
    const meal = {
      kind: "recipe",
      recipe_slug: "crispy-chipotle-tofu-tacos",
      title: "Crispy Chipotle Tofu Tacos",
      participant_ids: ["a"],
      pinned_ingredients: [
        { ingredient_id: "chipotle-powder", name: "chipotle powder", quantity: 1, unit: "tsp" },
        { name: "cilantro", quantity: 0.25, unit: "cup" },
      ],
    };
    const ctx = { constraints: [], tastes: [], catalog: plannerCatalog() };
    expect(ingredientMatchesSource(meal.pinned_ingredients[0], "chipotle powder")).toBe(true);
    expect(ingredientMatchesSource(meal.pinned_ingredients[1], "cilantro")).toBe(true);
    const removed = validateAdaptationSafety(
      {
        ingredient_ops: [{ op: "remove", from_id: "chipotle powder", to_name: null, policy: "omit" }],
        acknowledgement: "Leaving the chipotle out.",
        kind: "omit",
        support: "advice",
      },
      meal,
      ctx
    );
    expect(removed.ok).toBe(true);
    expect(removed.override.ops).toHaveLength(1);
    expect(removed.override.ops[0].op).toBe("remove");
    const swapped = validateAdaptationSafety(
      {
        ingredient_ops: [{ op: "replace", from_id: "cilantro", to_name: "parsley", policy: "keep_scaled" }],
        acknowledgement: "Parsley works.",
        kind: "substitution",
        support: "advice",
      },
      meal,
      ctx
    );
    expect(swapped.override.ops.map((op) => op.to_name)).toEqual(["parsley"]);

    const planCtx = {
      now: "2026-10-04T12:00:00.000Z",
      actor_member_id: "a",
      household_member_ids: ["a"],
      constraints: [],
      data_origin: "household",
      tastes: [],
      catalog: plannerCatalog(),
      id: (p) => `${p}_1`,
    };
    const versionId = plannerCatalog().find((row) => row.concept.concept_id === "crispy-chipotle-tofu-tacos").pkg.recipe_version_id;
    const created = createDinnerPlan(
      {
        entry_point: "plan_dinners",
        meal_count: 1,
        fill: "manual",
        meals: [{ kind: "recipe", recipe_version_id: versionId }],
        participant_ids: ["a"],
      },
      planCtx
    );
    const planMeal = created.plan.meals[0];
    const applied = applyPlanMutation(
      created.plan,
      {
        op: "apply_adaptation",
        meal_id: planMeal.meal_id,
        adaptation: {
          support: "advice",
          override_json: {
            acknowledgement: "Leaving the chipotle out.",
            kind: "omit",
            support: "advice",
            ops: [{ op: "remove", from_id: "chipotle powder", to_name: null, policy: "omit" }],
          },
        },
      },
      planCtx
    );
    expect(applied.ok).toBe(true);
    const pin = applied.plan.meals[0].pinned_ingredients;
    expect(pin.some((item) => /chipotle powder/i.test(item.name))).toBe(true);
    const view = effectiveRecipeView(applied.plan.meals[0]);
    expect(view.ingredients.some((item) => /chipotle powder/i.test(item.name || ""))).toBe(false);
  });

  it("merges parsley and fresh-parsley onto one shopping key", () => {
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
    const meal = created.plan.meals[0];
    meal.pinned_ingredients = [
      { ingredient_id: "parsley", name: "parsley", quantity: 1, unit: "cup" },
      { ingredient_id: "fresh-parsley", name: "fresh parsley", quantity: 2, unit: "cup" },
      { ingredient_id: "butter", name: "butter", quantity: 1, unit: "tbsp" },
      { ingredient_id: "peanut-butter", name: "peanut butter", quantity: 1, unit: "tbsp" },
    ];
    const applied = applyPlanMutation(
      created.plan,
      { op: "set_guest_count", meal_id: meal.meal_id, guest_count: 1 },
      ctx
    );
    expect(applied.ok).toBe(true);
    const ids = applied.plan.shop_lines.map((line) => line.ingredient_id);
    expect(ids.filter((id) => id === "parsley" || id === "fresh-parsley")).toEqual(["parsley"]);
    expect(applied.plan.shop_lines.find((line) => line.ingredient_id === "parsley").quantity).toBe(1.5);
    expect(ids).toContain("butter");
    expect(ids).toContain("peanut-butter");
  });

  it("refuses skipping a pressure cooker without asking the model", () => {
    const meal = {
      kind: "recipe",
      recipe_slug: "pressure-cooker-butter-chicken",
      title: "Pressure-Cooker Butter Chicken",
      equipment: ["pressure cooker"],
      pinned_steps: [{ step_number: 1, body: "Cook under pressure." }],
    };
    const blocked = equipmentUnsupportedResponse("Make this without the pressure cooker.", meal);
    expect(blocked.support).toBe("unsupported");
    expect(blocked.acknowledgement).toBe(PRESSURE_COOKER_UNSUPPORTED);
    expect(blocked.ingredient_ops).toEqual([]);
    expect(blocked.usage.provider_calls).toBe(0);
    expect(equipmentUnsupportedResponse("Make this less spicy.", meal)).toBeNull();
  });

  it("shows the safety refusal when the client cannot apply a swap", () => {
    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    const toastFn = app.slice(app.indexOf("function dinnerPlanErrorToast"), app.indexOf("function swapFailureCopy"));
    expect(toastFn).toContain('code === "adaptation_not_applicable"');
    expect(toastFn).toContain(ADAPTATION_SAFETY_REFUSAL);
    expect(toastFn).toContain("res.acknowledgement");
  });
});
