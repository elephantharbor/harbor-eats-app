/**
 * Automated recipe / catalog quality checks — CI fails on violations.
 */

import { MEAL_CONCEPTS } from "./recipe-store.js";
import { MEAL_CATALOG } from "./meal-catalog.js";
import { filterEligibleOptions } from "./eligibility.js";

const VALID_DIETARY = new Set([
  "plant",
  "fish",
  "finfish",
  "dairy-free",
  "dairy",
  "poultry",
  "meat",
  "shellfish",
  "seafood",
  "nuts",
  "cashew",
  "peanut",
  "tacos",
  "pasta",
  "bowl",
  "stew",
  "curry",
  "sheet-pan",
]);

const ALLERGEN_CONFLICTS = [
  { tag: "dairy-free", forbiddenIngredient: /cheese|feta|yogurt|butter|cream/i },
  { tag: "plant", forbiddenIngredient: /chicken|salmon|shrimp|cod|char|fish fillet|arctic char/i },
];

function ingredientNames(concept) {
  return concept.current_version.ingredients.map((i) => i.name.toLowerCase());
}

/**
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateCatalogQuality() {
  /** @type {string[]} */
  const errors = [];

  for (const c of MEAL_CONCEPTS) {
    const v = c.current_version;
    const slug = c.concept_id;
    if (!v.ingredients.length) errors.push(`${slug}: missing ingredients`);
    if (!v.steps.length) errors.push(`${slug}: missing cooking steps`);
    if (!v.servings || v.servings < 1) errors.push(`${slug}: invalid servings`);
    if ((v.prep_minutes ?? 0) + (v.cook_minutes ?? 0) < 5) {
      errors.push(`${slug}: missing meaningful cook/prep time`);
    }
    for (const tag of v.dietary_tags) {
      if (!VALID_DIETARY.has(tag) && !c.tags.includes(tag)) {
        errors.push(`${slug}: unknown dietary tag "${tag}"`);
      }
    }
    const names = ingredientNames(c);
    for (const step of v.steps) {
      for (const ref of step.ingredient_refs || []) {
        const found = names.some((n) => n.includes(ref.toLowerCase()));
        if (!found && ref.length > 2) {
          errors.push(`${slug}: step "${step.title}" references missing ingredient "${ref}"`);
        }
      }
    }
    for (const { tag, forbiddenIngredient } of ALLERGEN_CONFLICTS) {
      if (c.tags.includes(tag)) {
        for (const ing of v.ingredients) {
          if (forbiddenIngredient.test(ing.name)) {
            errors.push(`${slug}: tag ${tag} conflicts with ingredient ${ing.name}`);
          }
        }
      }
    }
    if (v.steps.some((s) => !s.body || s.body.length < 10)) {
      errors.push(`${slug}: incomplete step text`);
    }
  }

  const slugs = new Set(MEAL_CATALOG.map((m) => m.recipe_slug));
  if (slugs.size !== MEAL_CATALOG.length) {
    errors.push("catalog: duplicate recipe_slug entries");
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Choice-set diversity: flag near-duplicates in a final set.
 * @param {import('./meal-catalog.js').CatalogMeal[]} picked
 */
export function validateChoiceSetDiversity(picked) {
  /** @type {string[]} */
  const errors = [];
  const slugs = picked.map((p) => p.recipe_slug);
  if (new Set(slugs).size !== slugs.length) errors.push("choice_set: duplicate recipe in set");

  const primaryCounts = {};
  for (const p of picked) {
    const pi = p.primary_ingredient || "mixed";
    primaryCounts[pi] = (primaryCounts[pi] || 0) + 1;
  }
  for (const [pi, n] of Object.entries(primaryCounts)) {
    if (pi !== "mixed" && n >= 3) errors.push(`choice_set: repeated primary ingredient ${pi} (${n}x)`);
  }
  const cuisineCounts = {};
  for (const p of picked) {
    const key = p.cuisine || "unknown";
    cuisineCounts[key] = (cuisineCounts[key] || 0) + 1;
  }
  for (const [c, n] of Object.entries(cuisineCounts)) {
    if (n >= 3) errors.push(`choice_set: repeated cuisine ${c} (${n}x)`);
  }
  return { ok: errors.length === 0, errors };
}

/** HH001 default constraints smoke test — eligible count should support plans */
export function validateDefaultEligibilityFloor() {
  const hh001 = [
    { rule_key: "dairy", status: "prohibited" },
    { rule_key: "meat", status: "prohibited" },
    { rule_key: "poultry", status: "prohibited" },
    { rule_key: "shellfish", status: "prohibited" },
    { rule_key: "nuts", status: "prohibited" },
  ];
  const options = MEAL_CATALOG.map((m) =>
    ({
      letter: "X",
      meal_option_id: "x",
      name: m.name,
      recipe_slug: m.recipe_slug,
      attributes_json: { tags: m.tags, recipe_slug: m.recipe_slug },
    })
  );
  const eligible = filterEligibleOptions(options, hh001);
  if (eligible.length < 8) {
    return { ok: false, errors: [`hh001 eligible floor: only ${eligible.length} meals (need ≥8)`] };
  }
  return { ok: true, errors: [] };
}

export function runAllCatalogQualityChecks() {
  const parts = [validateCatalogQuality(), validateDefaultEligibilityFloor()];
  const errors = parts.flatMap((p) => p.errors);
  return { ok: errors.length === 0, errors };
}
