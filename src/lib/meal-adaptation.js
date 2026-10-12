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

/**
 * The model is shown `ingredient_id || name`. A later pin may store only the
 * slug, so a source matches the id or the normalized name.
 * @param {object} item
 * @param {string|null|undefined} fromId
 */
export function ingredientMatchesSource(item, fromId) {
  if (fromId == null || fromId === "") return false;
  const want = normalizeName(fromId);
  if (!want) return false;
  const shown = item?.ingredient_id || item?.name || item?.display_name;
  for (const value of [item?.ingredient_id, item?.name, item?.display_name, shown]) {
    if (value == null || value === "") continue;
    if (value === fromId || normalizeName(value) === want) return true;
  }
  return false;
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
      ingredients = ingredients.filter((ing) => !ingredientMatchesSource(ing, op.from_id));
    } else if (op.op === "replace") {
      ingredients = ingredients.map((ing) => {
        if (!ingredientMatchesSource(ing, op.from_id)) return ing;
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

const EQUIPMENT_PHRASE =
  /\b(?:air fryer|pressure cooker|instant pot|slow cooker|dutch oven|sheet pan|skillet|oven|grill|stove|stovetop|microwave|broiler|pan)\b/i;

function cleanIngredientPhrase(value) {
  let text = String(value || "")
    .replace(/[.?!].*$/s, "")
    .replace(/\b(?:please|thanks|thank you)\b/gi, "")
    .trim();
  text = text.replace(/^(?:the|some|a bit of|a|an|my|our|extra)\s+/i, "").trim();
  text = text.split(/\s+(?:and|but|so|because|if|while|then)\s+/i)[0].trim();
  text = text.replace(/^(?:the|some|a|an)\s+/i, "").trim();
  return text.replace(/\s+/g, " ");
}

function pushTarget(found, value) {
  const cleaned = cleanIngredientPhrase(value);
  if (!cleaned) return;
  if (/^(?:less|more|fewer|it|this|that|the original)$/i.test(cleaned)) return;
  if (EQUIPMENT_PHRASE.test(cleaned)) return;
  if (found.some((item) => item.toLowerCase() === cleaned.toLowerCase())) return;
  found.push(cleaned);
}

/**
 * Ingredient the cook asked to put in. The thing being removed is not a target.
 * "swap cashews for peanuts" → peanuts. "omit peanuts" → none.
 * @param {string} text
 * @returns {string[]}
 */
export function requestedSubstituteTargets(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return [];
  /** @type {string[]} */
  const found = [];
  const swap = raw.match(/\b(?:swap|replace|trade)\s+(?:out\s+)?(.+?)\s+(?:for|with|to)\s+(.+)$/i);
  if (swap) pushTarget(found, swap[2]);
  const useInstead = raw.match(/\b(?:use|try|add|put)\s+(.+?)\s+instead of\b/i);
  if (useInstead) pushTarget(found, useInstead[1]);
  const insteadUse = raw.match(/\binstead of\s+.+?(?:,)?\s+(?:use|try|add|put)\s+(.+)$/i);
  if (insteadUse) pushTarget(found, insteadUse[1]);
  const substitute = raw.match(/\bsubstitute\s+(.+?)\s+for\s+/i);
  if (substitute) pushTarget(found, substitute[1]);
  const swapIn = raw.match(/\bswap\s+in\s+(.+)$/i);
  if (swapIn) pushTarget(found, swapIn[1]);
  if (!found.length) {
    const bare = raw.match(/\b(?:use|add|try)\s+(.+)$/i);
    if (bare) pushTarget(found, bare[1]);
  }
  return found;
}

function displayIngredient(name) {
  const cleaned = String(name || "").trim();
  if (!cleaned) return "That ingredient";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function unknownOnly(safety) {
  const rows = safety?.blocked || [];
  if (!rows.length) return false;
  return rows.every((row) => {
    const ids = row.limit_ids || [];
    return ids.length > 0 && ids.every((id) => id === "unknown_ingredient");
  });
}

/**
 * Safety refusal when the cook names a substitute that conflicts with a diner
 * at this table. Null when the provider may still run. Unknown names are left
 * for the model; only a known limit conflict stops the call.
 * @param {string} text
 * @param {object} meal
 * @param {object} ctx
 */
export function requestedSubstituteConflict(text, meal, ctx) {
  const targets = requestedSubstituteTargets(text);
  if (!targets.length) return null;
  for (const name of targets) {
    const safety = validateAdaptationSafety(
      {
        ingredient_ops: [{ op: "add", to_name: name, policy: "to_taste" }],
        step_notes: [],
        acknowledgement: "",
        kind: "substitution",
        support: "advice",
      },
      meal,
      ctx
    );
    if (safety.ok || safety.status !== "rejected_safety" || unknownOnly(safety)) continue;
    return {
      ok: true,
      support: "rejected_safety",
      acknowledgement: ADAPTATION_SAFETY_REFUSAL,
      kind: "substitution",
      ingredient_ops: [],
      step_notes: [],
      blocked: [
        {
          display_name: displayIngredient(name),
          ingredient_id: canonicalIngredient(name).ingredient_id,
        },
      ],
      source: "deterministic",
      usage: { provider_calls: 0 },
    };
  }
  return null;
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
      const pin = (meal.pinned_ingredients || []).find((item) => ingredientMatchesSource(item, fromId));
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
