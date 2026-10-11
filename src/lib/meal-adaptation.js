/**
 * Per-meal recipe adaptation overlay. Catalog pins stay immutable.
 */

import { assessMealEligibility, plannerCatalog } from "./dinner-planner.js";
import { canonicalIngredient } from "./ingredient-identity.js";

const PRESSURE_COOKER_UNSUPPORTED =
  "That pressure cooker is doing most of the work in this version. I'd stick with the original method for this recipe.";

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function resolveIngredientId(name, catalog) {
  const n = normalizeName(name);
  if (!n) return null;
  for (const entry of catalog || plannerCatalog()) {
    for (const ing of entry.pkg?.ingredients || []) {
      if (normalizeName(ing.name) === n) return ing.ingredient_id || canonicalIngredient(ing.name).ingredient_id;
    }
  }
  const canon = canonicalIngredient(name);
  return canon.ingredient_id;
}

/**
 * @param {object} meal
 */
export function mealAdaptation(meal) {
  return meal?.adaptation?.override_json ? meal.adaptation : null;
}

/**
 * Ingredients/steps used for cook and shopping (pin + override).
 * @param {object} meal
 */
export function effectiveRecipeView(meal) {
  const base = resolvedPin(meal);
  if (!base) return null;
  const row = mealAdaptation(meal);
  if (!row || row.recipe_version_id !== meal.recipe_version_id) return base;
  const override = row.override_json || {};
  let ingredients = structuredClone(base.ingredients || []);
  const steps = structuredClone(base.steps || []);
  for (const op of override.ops || []) {
    if (op.op === "remove") {
      ingredients = ingredients.filter((ing) => ing.ingredient_id !== op.from_id);
    } else if (op.op === "replace") {
      ingredients = ingredients.map((ing) => {
        if (ing.ingredient_id !== op.from_id) return ing;
        const canon = canonicalIngredient(op.to_name || ing.name);
        return {
          ...ing,
          ingredient_id: op.to_ingredient_id || canon.ingredient_id,
          name: op.to_name || ing.name,
          display_name: op.to_name || ing.name,
          policy: op.policy,
        };
      });
    } else if (op.op === "add") {
      const canon = canonicalIngredient(op.to_name || "ingredient");
      ingredients.push({
        ingredient_id: op.to_ingredient_id || canon.ingredient_id,
        name: op.to_name,
        quantity: null,
        unit: null,
        optional: true,
        policy: op.policy || "to_taste",
      });
    }
    for (const note of op.step_notes || []) {
      const step = steps.find((s) => s.step_number === note.step_number);
      if (step) step.body = `${step.body || ""} ${note.note}`.trim();
    }
  }
  return { ...base, ingredients, steps, adapted: true };
}

function resolvedPin(meal) {
  if (!meal || meal.kind !== "recipe") return null;
  return {
    recipe_version_id: meal.recipe_version_id,
    ingredients: meal.pinned_ingredients || [],
    steps: meal.pinned_steps || [],
    equipment: meal.equipment || [],
  };
}

/**
 * @param {object} meal
 */
export function effectivePinnedIngredients(meal) {
  const view = effectiveRecipeView(meal);
  return view?.ingredients || meal.pinned_ingredients || [];
}

export function pinRequiresPressureCooker(meal) {
  const equip = meal.pinned_equipment || meal.equipment || [];
  const steps = meal.pinned_steps || [];
  const blob = JSON.stringify(equip) + JSON.stringify(steps);
  return /pressure cooker/i.test(blob);
}

export function reconcileEquipmentUnsupported(text, meal, modelOutput) {
  const asksNoPc = /\b(no|without|skip)\b.*pressure cooker/i.test(text || "");
  if (!asksNoPc || !pinRequiresPressureCooker(meal)) return modelOutput;
  return {
    ...modelOutput,
    equipment_supported: false,
    support: "unsupported",
    acknowledgement: PRESSURE_COOKER_UNSUPPORTED,
    step_notes: [],
    ingredient_ops: [],
  };
}

/**
 * @param {object} modelOutput
 * @param {object} meal
 * @param {object} ctx
 */
export function validateAdaptationSafety(modelOutput, meal, ctx) {
  const catalog = ctx.catalog || plannerCatalog();
  const ops = [];
  const dropped = [];
  for (const raw of modelOutput.ingredient_ops || []) {
    const fromId = raw.from_id;
    const toName = raw.to_name;
    if (fromId) {
      const pin = (meal.pinned_ingredients || []).find((i) => i.ingredient_id === fromId);
      if (!pin) {
        dropped.push(fromId);
        continue;
      }
    }
    if (toName) {
      const synthetic = {
        concept: { concept_id: meal.recipe_slug, title: meal.title, tags: [] },
        pkg: {
          title: meal.title,
          ingredients: [{ name: toName, ingredient_id: resolveIngredientId(toName, catalog) }],
          allergens: [],
          vocabulary_tag_ids: [],
        },
      };
      const decision = assessMealEligibility(synthetic, meal.participant_ids, ctx.constraints || [], ctx.tastes || []);
      if (!decision.eligible) {
        return { ok: false, status: "rejected_safety", blocked: decision.blocked };
      }
    }
    ops.push({
      op: raw.op,
      from_id: fromId,
      to_name: toName,
      to_ingredient_id: toName ? resolveIngredientId(toName, catalog) : null,
      policy: raw.policy,
      step_notes: (modelOutput.step_notes || []).filter((n) => n.step_number),
    });
  }
  return {
    ok: true,
    override: {
      acknowledgement: modelOutput.acknowledgement,
      kind: modelOutput.kind,
      support: modelOutput.support,
      ops,
      dropped,
    },
  };
}

export { PRESSURE_COOKER_UNSUPPORTED };
