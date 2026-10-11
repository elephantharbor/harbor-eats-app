import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createFakeProvider, createGenerationService, createMemoryStore, TASKS } from "../src/ai/index.js";
import { postValidateRecipeAdaptation } from "../src/ai/adaptation-schema.js";
import { ADAPTATION_SAFETY_REFUSAL, canonicalIngredientKey, validateAdaptationSafety } from "../src/lib/meal-adaptation.js";
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

  it("shows the safety refusal when the client cannot apply a swap", () => {
    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    const toastFn = app.slice(app.indexOf("function dinnerPlanErrorToast"), app.indexOf("function swapFailureCopy"));
    expect(toastFn).toContain('code === "adaptation_not_applicable"');
    expect(toastFn).toContain(ADAPTATION_SAFETY_REFUSAL);
    expect(toastFn).toContain("res.acknowledgement");
  });
});
