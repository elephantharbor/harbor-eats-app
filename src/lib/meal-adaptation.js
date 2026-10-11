/**
 * Per-meal recipe adaptation overlay. Catalog pins stay immutable.
 */

import { assessMealEligibility, plannerCatalog } from "./dinner-planner.js";
import { canonicalIngredient } from "./ingredient-identity.js";
import { classifySubstituteName } from "./preference-concepts.js";

const PRESSURE_COOKER_UNSUPPORTED =
  "That pressure cooker is doing most of the work in this version. I'd stick with the original method for this recipe.";

export const ADAPTATION_SAFETY_REFUSAL =
  "That swap doesn't work for everyone eating this dinner, so we'd leave it out.";

export const ADAPTATION_FALLBACK_REFUSAL =
  "We're not sure that would work here, so we'd keep the original.";

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function resolveIngredientId(name, catalog) {
  const want = keysForIngredient(name);
  if (!want.size) return null;
  for (const entry of catalog || plannerCatalog()) {
    for (const ing of entry.pkg?.ingredients || []) {
      const keys = keysForIngredient(ing.name, ing.ingredient_id);
      for (const key of want) {
        if (keys.has(key)) return ing.ingredient_id || canonicalIngredient(ing.name).ingredient_id;
      }
    }
  }
  return canonicalIngredient(name).ingredient_id;
}

/** Preparation and form words. They are not a different ingredient. */
const DESCRIPTOR_WORDS = new Set([
  "fresh",
  "dried",
  "dry",
  "chopped",
  "minced",
  "diced",
  "sliced",
  "grated",
  "ground",
  "whole",
  "raw",
  "frozen",
  "canned",
  "finely",
  "roughly",
  "packed",
  "large",
  "small",
  "baby",
]);

/**
 * Importer-style identity: "fresh parsley", "flat-leaf parsley", and id
 * "fresh-parsley" share the key "parsley". "peanut butter" stays intact.
 * @param {string} value
 */
export function canonicalIngredientKey(value) {
  const words = normalizeName(value).split(" ").filter(Boolean);
  /** @type {string[]} */
  const kept = [];
  for (let i = 0; i < words.length; i += 1) {
    if (words[i] === "flat" && words[i + 1] === "leaf") {
      i += 1;
      continue;
    }
    if (DESCRIPTOR_WORDS.has(words[i])) continue;
    kept.push(words[i]);
  }
  const core = (kept.length ? kept : words).join(" ");
  if (core.endsWith("s") && !core.endsWith("ss") && core.length > 3) return core.slice(0, -1);
  return core;
}

function keysForIngredient(name, id) {
  const keys = new Set();
  const add = (value) => {
    const key = canonicalIngredientKey(value);
    if (key) keys.add(key);
  };
  add(name);
  if (id) add(String(id).replace(/-/g, " "));
  return keys;
}

function catalogKnowsIngredient(name, catalog) {
  const want = keysForIngredient(name);
  if (!want.size) return false;
  for (const entry of catalog || plannerCatalog()) {
    for (const ing of entry.pkg?.ingredients || []) {
      const keys = keysForIngredient(ing.name, ing.ingredient_id);
      for (const key of want) {
        if (keys.has(key)) return true;
      }
    }
  }
  return false;
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
 * Deterministic refusal when this recipe needs a pressure cooker and the
 * cook asked to skip it. Null when the provider may still run.
 * @param {string} text
 * @param {object} meal
 */
export function equipmentUnsupportedResponse(text, meal) {
  const probe = reconcileEquipmentUnsupported(text, meal, {
    acknowledgement: "",
    support: "advice",
    kind: "substitution",
    ingredient_ops: [{ op: "replace", from_id: "x", to_name: "y" }],
    step_notes: [{ step_number: 1, note: "keep" }],
    equipment_supported: true,
  });
  if (probe.support !== "unsupported") return null;
  return {
    ok: true,
    support: "unsupported",
    acknowledgement: PRESSURE_COOKER_UNSUPPORTED,
    kind: "unsupported",
    ingredient_ops: [],
    step_notes: [],
    equipment_supported: false,
    source: "deterministic",
    usage: { provider_calls: 0 },
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
    if (toName) {
      const signals = classifySubstituteName(toName);
      const inCatalog = catalogKnowsIngredient(toName, catalog);
      if (!signals.known && !inCatalog) {
        const participants = meal.participant_ids?.length ? meal.participant_ids : [null];
        return {
          ok: false,
          status: "rejected_safety",
          blocked: participants.map((member_id) => ({ member_id, limit_ids: ["unknown_ingredient"] })),
        };
      }
      const tags = [...new Set([...signals.tags, ...signals.allergens, ...signals.diet_tokens])];
      const synthetic = {
        concept: { concept_id: meal.recipe_slug, title: toName, tags },
        pkg: {
          title: toName,
          ingredients: [{ name: toName, ingredient_id: resolveIngredientId(toName, catalog) }],
          allergens: signals.allergens,
          vocabulary_tag_ids: signals.ingredient_slugs,
        },
      };
      const decision = assessMealEligibility(synthetic, meal.participant_ids, ctx.constraints || [], ctx.tastes || []);
      if (!decision.eligible) {
        return { ok: false, status: "rejected_safety", blocked: decision.blocked };
      }
    }
    const needsSource = raw.op === "replace" || raw.op === "remove";
    if (needsSource || fromId) {
      const pin = fromId
        ? (meal.pinned_ingredients || []).find((item) => item.ingredient_id === fromId)
        : null;
      if (!pin) {
        dropped.push(fromId ?? null);
        continue;
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
