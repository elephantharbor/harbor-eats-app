/**
 * Automated recipe / catalog quality checks — CI fails on violations.
 * Structural validation only; not kitchen-tested cooking evidence.
 */

import { MEAL_CONCEPTS } from "./recipe-store.js";
import { MEAL_CATALOG } from "./meal-catalog.js";
import { filterEligibleOptions } from "./eligibility.js";
import { scaleRecipeVersion } from "./recipe-scaling.js";

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

const PANTRY_OK_WITHOUT_QTY = /^(salt|pepper|black pepper|water)$/i;

const HEAT_TIME =
  /(\d+\s*°\s*[FC]|medium[- ]?high|medium[- ]?low|high heat|low heat|simmer|boil|broil|bake at|air fry|grill|roast at|pan-fry|sear|sauté|saute)/i;

const TIME_OR_DONE =
  /(\d+\s*[–-]\s*\d+\s*min|\d+\s*min|until [a-z]|until golden|until crisp|until tender|until pink|until opaque|until thickened|until al dente|until wilted|until soft|165°F|flakes easily|al dente)/i;

const DONENESS_PROTEIN = /(tofu|salmon|shrimp|chicken|cod|char|fish fillet|arctic char|white fish)/i;

const COMPOUND_NAME =
  /(crema|pesto|slaw mix|pickled|preserved|salsa|harissa paste|chipotle in adobo|shawarma spice|adobo|spice blend)/i;

const COMPOUND_OK_NOTE = /(store-bought|prepared|pre-shredded|package|bottled|blend|whisk|mix|make|or \d)/i;

const NON_COOKING_STEP =
  /^(serve|assemble|plate|rest|top|build tacos|cut into|layer|spoon|open carefully|toss & serve|toss pasta|finish & serve)$/i;

const OIL_IN_STEP = /\bin oil\b|with oil|oiled skillet|oiled pan|drizzle of oil/i;

const BAD_UNIT_GRAMMAR = /^1 (cups|tablespoons|teaspoons|cloves|cans|ozs)\b/i;

function ingredientNames(concept) {
  return concept.current_version.ingredients.map((i) => i.name.toLowerCase());
}

function refMatchesIngredient(names, ref) {
  const r = ref.toLowerCase().trim();
  if (!r) return true;
  return names.some((n) => n.includes(r) || r.includes(n.split(/\s+/)[0]));
}

function stepNeedsCookingGuidance(step) {
  const title = (step.title || "").trim();
  if (NON_COOKING_STEP.test(title)) return false;
  if (/^(finish|dress|make sauce|fill|glaze|warm|mash|season|spice|pack|blend|press|marinate)$/i.test(title)) {
    return /cook|roast|simmer|sauté|saute|bake|grill|fry|sear|boil|steam|whisk polenta|brown|crisp|pan-fry|air fry/i.test(
      step.body || ""
    );
  }
  return /cook|roast|simmer|sauté|saute|bake|grill|fry|sear|boil|steam|brown|crisp|pan-fry|air fry|stir-fry|dredge|marinate|grill|steam bake/i.test(
    `${title} ${step.body || ""}`
  );
}

function stepNeedsDoneness(step, ingredientRefs) {
  const refs = (ingredientRefs || []).join(" ");
  if (!DONENESS_PROTEIN.test(refs) && !DONENESS_PROTEIN.test(step.body || "")) return false;
  return !/(until|opaque|pink|golden|crisp|flakes|165°F|al dente|tender-crisp|deep golden|done)/i.test(step.body || "");
}

/**
 * FW-03 executable recipe completeness (structural).
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateRecipeCompleteness() {
  /** @type {string[]} */
  const errors = [];

  for (const c of MEAL_CONCEPTS) {
    const v = c.current_version;
    const slug = c.concept_id;
    const names = ingredientNames(c);

    for (const ing of v.ingredients) {
      const q = (ing.quantity || "").trim();
      if (!q && !PANTRY_OK_WITHOUT_QTY.test(ing.name)) {
        errors.push(`${slug}: ingredient "${ing.name}" missing quantity`);
      } else if (q && !/for serving/i.test(q) && !/^[\d½¼¾⅓⅔⅛(]/.test(q)) {
        if (!PANTRY_OK_WITHOUT_QTY.test(ing.name)) {
          errors.push(`${slug}: ingredient "${ing.name}" needs numeric quantity (got "${q}")`);
        }
      }
      if (COMPOUND_NAME.test(ing.name)) {
        const note = ing.note || "";
        const explainedInSteps = (v.steps || []).some(
          (s) =>
            COMPOUND_OK_NOTE.test(s.body || "") &&
            (s.body || "").toLowerCase().includes(ing.name.split(/\s+/)[0].toLowerCase())
        );
        if (!COMPOUND_OK_NOTE.test(note) && !explainedInSteps) {
          errors.push(
            `${slug}: compound ingredient "${ing.name}" needs store-bought/prep note or step guidance`
          );
        }
      }
    }

    for (const step of v.steps) {
      for (const ref of step.ingredient_refs || []) {
        if (!refMatchesIngredient(names, ref)) {
          errors.push(`${slug}: step "${step.title}" references missing ingredient "${ref}"`);
        }
      }
      if (OIL_IN_STEP.test(step.body || "")) {
        const hasOil = v.ingredients.some((i) => /oil/i.test(i.name));
        if (!hasOil) errors.push(`${slug}: step "${step.title}" uses oil but oil is not listed`);
      }
      if (stepNeedsCookingGuidance(step)) {
        if (!HEAT_TIME.test(step.body || "") && !TIME_OR_DONE.test(step.body || "")) {
          errors.push(`${slug}: step "${step.title}" missing heat or time/doneness guidance`);
        }
        if (stepNeedsDoneness(step, step.ingredient_refs)) {
          errors.push(`${slug}: step "${step.title}" missing doneness guidance for protein`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * FW-04 scaled quantity grammar and plausibility for servings 1–4.
 * @param {number[]} targets
 */
export function validateCatalogScaling(targets = [1, 2, 3, 4]) {
  /** @type {string[]} */
  const errors = [];

  for (const c of MEAL_CONCEPTS) {
    const base = c.current_version.servings || 4;
    for (const n of targets) {
      if (n < 1 || n > 4) continue;
      const scaled = scaleRecipeVersion(c.current_version, n);
      if (scaled.base_servings !== base) {
        errors.push(`${c.concept_id}@${n}: wrong base_servings`);
      }
      if (scaled.requested_servings !== n) {
        errors.push(`${c.concept_id}@${n}: wrong requested_servings`);
      }
      for (const ing of scaled.ingredients || []) {
        const q = ing.quantity || "";
        if (BAD_UNIT_GRAMMAR.test(q)) {
          errors.push(`${c.concept_id}@${n}: bad unit grammar "${q}"`);
        }
        if (/^0\s/.test(q) || /^0$/.test(q.trim())) {
          errors.push(`${c.concept_id}@${n}: zero quantity for ${ing.name}`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Oct 1 tofu/lime observation — structural lime coverage for chipotle tofu tacos */
export function validateTofuLimeRegression() {
  const c = MEAL_CONCEPTS.find((row) => row.concept_id === "crispy-chipotle-tofu-tacos");
  if (!c) return { ok: false, errors: ["crispy-chipotle-tofu-tacos: missing from catalog"] };
  const lime = c.current_version.ingredients.find((i) => /^lime$/i.test(i.name));
  if (!lime || !/^2\b/.test(String(lime.quantity || "").trim())) {
    return { ok: false, errors: ["crispy-chipotle-tofu-tacos: expected 2 limes in ingredients"] };
  }
  const names = ingredientNames(c);
  for (const step of c.current_version.steps) {
    for (const ref of step.ingredient_refs || []) {
      if (/lime/i.test(ref) && !refMatchesIngredient(names, ref)) {
        return { ok: false, errors: [`crispy-chipotle-tofu-tacos: lime ref broken in "${step.title}"`] };
      }
    }
  }
  return { ok: true, errors: [] };
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
        if (!refMatchesIngredient(names, ref) && ref.length > 2) {
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
  const parts = [
    validateCatalogQuality(),
    validateRecipeCompleteness(),
    validateCatalogScaling([1, 2, 3, 4]),
    validateTofuLimeRegression(),
    validateDefaultEligibilityFloor(),
  ];
  const errors = parts.flatMap((p) => p.errors);
  return { ok: errors.length === 0, errors };
}
