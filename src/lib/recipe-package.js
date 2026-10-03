/**
 * Recipe package contract.
 * Dish → Recipe → Recipe Version → Meal / outcome.
 *
 * Publishing a later version must not rewrite an earlier version or the
 * ingredient list already shopped for a plan. Household variations stay
 * in that household. Structural checks are not kitchen tests.
 *
 * The alpha catalog is projected here. Provenance that the repo does not
 * state stays unknown. Meal prose is not rewritten.
 */

import {
  DATA_ORIGINS,
  IMAGE_PROVENANCE,
  PACKAGE_VISIBILITY,
  PUBLICATION_STATUSES,
  RECIPE_PROVENANCE,
  RIGHTS_STATES,
} from "./cycle2-schema.js";
import { classifyLegacyValue } from "./legacy-preference-audit.js";
import { MEAL_CONCEPTS } from "./recipe-store.js";
import { getTasteTerm } from "./taste-vocabulary.js";

const CURRENT_VERSION_IDS = new Set(
  MEAL_CONCEPTS.map((concept) => concept.current_version.recipe_version_id)
);

const PACKAGE_KEYS = [
  "dish_id",
  "recipe_id",
  "recipe_version_id",
  "version_number",
  "title",
  "description",
  "ingredients",
  "base_servings",
  "equipment",
  "prep_minutes",
  "cook_minutes",
  "total_minutes",
  "steps",
  "heat",
  "doneness",
  "dietary_labels",
  "allergens",
  "vocabulary_tag_ids",
  "provenance",
  "image",
  "publication_status",
  "rights_state",
  "kitchen_tested",
  "validation_kind",
  "visibility",
  "household_id",
  "data_origin",
];

const UNIT_ALIASES = {
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  can: "can",
  cans: "can",
  clove: "clove",
  cloves: "clove",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  package: "package",
  packages: "package",
  jar: "jar",
  jars: "jar",
};

const FRACTIONS = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

function roundQuantity(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Split a legacy quantity string when the amount and unit are plain.
 * Anything else keeps the raw string and leaves quantity null.
 * @param {string|undefined} raw
 */
export function parseLegacyQuantity(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { quantity: null, unit: null, note: null, raw: text };
  const match = text.match(
    /^(?:(\d+)\s+)?([¼½¾⅓⅔⅛]|\d+\/\d+|\d+(?:\.\d+)?)(?:\s+([a-zA-Z]+))?(?:\s+(.+))?$/
  );
  if (!match) return { quantity: null, unit: null, note: null, raw: text };
  let quantity = 0;
  if (match[1]) quantity += Number(match[1]);
  const token = match[2];
  if (FRACTIONS[token]) quantity += FRACTIONS[token];
  else if (token.includes("/")) {
    const [num, den] = token.split("/").map(Number);
    if (!den) return { quantity: null, unit: null, note: null, raw: text };
    quantity += num / den;
  } else quantity += Number(token);
  if (!Number.isFinite(quantity)) return { quantity: null, unit: null, note: null, raw: text };
  const word = match[3] ? match[3].toLowerCase() : "";
  const rest = match[4] ? match[4].trim() : "";
  if (word && UNIT_ALIASES[word]) {
    return {
      quantity: roundQuantity(quantity),
      unit: UNIT_ALIASES[word],
      note: rest || null,
      raw: text,
    };
  }
  const note = [word, rest].filter(Boolean).join(" ") || null;
  return { quantity: roundQuantity(quantity), unit: "count", note, raw: text };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

/**
 * @param {object} concept
 */
export function projectLegacyConcept(concept) {
  const version = concept.current_version;
  const taste = [];
  const dietary = [];
  const allergens = [];
  const equipment = [];

  const cuisine = classifyLegacyValue("cuisine", concept.cuisine);
  if (cuisine.status === "mapped" && cuisine.vocabulary_slug) taste.push(cuisine.vocabulary_slug);

  const format = classifyLegacyValue("meal_format", concept.meal_format);
  if (format.status === "mapped" && format.vocabulary_slug) taste.push(format.vocabulary_slug);
  if (format.status === "mapped" && format.practical_detail) equipment.push(format.practical_detail);

  const texture = classifyLegacyValue("texture", concept.texture);
  if (texture.status === "mapped" && texture.vocabulary_slug) taste.push(texture.vocabulary_slug);

  const flavor = classifyLegacyValue("flavor_profile", concept.flavor_profile);
  if (flavor.status === "mapped") taste.push(...flavor.vocabulary_slugs);

  const ingredient = classifyLegacyValue("primary_ingredient", concept.primary_ingredient);
  if (ingredient.status === "mapped" && ingredient.vocabulary_slug) {
    taste.push(ingredient.vocabulary_slug);
  }

  for (const tag of concept.tags || []) {
    const row = classifyLegacyValue("tag", tag);
    if (row.status !== "mapped") continue;
    if (row.vocabulary_slug) taste.push(row.vocabulary_slug);
    if (row.dietary_label) dietary.push(row.dietary_label);
    if (row.allergen) allergens.push(row.allergen);
    if (row.practical_detail) equipment.push(row.practical_detail);
  }

  for (const spark of concept.sparks || []) {
    const row = classifyLegacyValue("spark", spark);
    if (row.status === "mapped" && row.vocabulary_slug) taste.push(row.vocabulary_slug);
    if (row.status === "mapped" && row.practical_detail) equipment.push(row.practical_detail);
  }

  const methods = version.methods || [];
  const soleDefault = methods.length === 1 && methods[0] === "stovetop";
  if (!soleDefault) {
    for (const method of methods) {
      const row = classifyLegacyValue("method", method);
      if (row.status !== "mapped") continue;
      if (row.vocabulary_slug) taste.push(row.vocabulary_slug);
      if (row.practical_detail) equipment.push(row.practical_detail);
    }
  }

  return {
    dish_id: concept.concept_id,
    recipe_id: `rcp_${concept.concept_id}`,
    recipe_version_id: version.recipe_version_id,
    version_number: version.version_number,
    title: concept.title || concept.name,
    description: null,
    ingredients: (version.ingredients || []).map((item) => {
      const parsed = parseLegacyQuantity(item.quantity);
      return {
        name: item.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        note: item.note || parsed.note || null,
        raw_quantity: parsed.raw,
      };
    }),
    base_servings: version.servings,
    equipment: unique(equipment),
    prep_minutes: version.prep_minutes,
    cook_minutes: version.cook_minutes,
    total_minutes: version.prep_minutes + version.cook_minutes,
    steps: (version.steps || []).map((step, index) => ({
      step_number: index + 1,
      title: step.title,
      body: step.body,
      ingredient_refs: step.ingredient_refs || [],
    })),
    heat: null,
    doneness: null,
    dietary_labels: unique(dietary),
    allergens: unique(allergens),
    vocabulary_tag_ids: unique(taste),
    provenance: "unknown_unverified",
    image: {
      ref: `/images/meals/${concept.concept_id}.webp`,
      provenance: "unknown",
    },
    publication_status: "unpublished",
    rights_state: "not_cleared_for_external_release",
    kitchen_tested: false,
    validation_kind: "structural_only",
    visibility: "global",
    household_id: null,
    data_origin: "unproven",
  };
}

export function projectLegacyCatalog(concepts = MEAL_CONCEPTS) {
  return concepts.map(projectLegacyConcept);
}

/**
 * How often each vocabulary slug appears on the current projection.
 * A zero is a zero. It is not a claim that the catalog is thin or full.
 * @param {object[]} [packages]
 */
export function catalogVocabularyCoverage(packages = projectLegacyCatalog()) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const pkg of packages) {
    for (const slug of pkg.vocabulary_tag_ids || []) {
      counts[slug] = (counts[slug] || 0) + 1;
    }
  }
  return counts;
}

function error(code, field) {
  return { code, field };
}

/**
 * Structural shape check. kitchen_tested is never inferred from a passing check.
 * @param {object} pkg
 */
export function validateRecipePackage(pkg) {
  /** @type {{ code: string, field: string }[]} */
  const errors = [];
  if (!pkg) return { ok: false, errors: [error("missing_package", "package")], kitchen_tested: false };

  for (const key of PACKAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(pkg, key)) errors.push(error("missing_field", key));
  }
  if (!pkg.title) errors.push(error("missing_title", "title"));
  if (!pkg.description) errors.push(error("missing_description", "description"));
  if (!pkg.recipe_id) errors.push(error("missing_recipe_id", "recipe_id"));
  if (!pkg.recipe_version_id) errors.push(error("missing_version_id", "recipe_version_id"));
  if (!pkg.dish_id) errors.push(error("missing_dish_id", "dish_id"));
  if (!Number.isInteger(pkg.base_servings) || pkg.base_servings < 1) {
    errors.push(error("bad_servings", "base_servings"));
  }
  if (!Array.isArray(pkg.ingredients) || !pkg.ingredients.length) {
    errors.push(error("missing_ingredients", "ingredients"));
  } else {
    pkg.ingredients.forEach((item, index) => {
      if (!item.name) errors.push(error("ingredient_name", `ingredients[${index}].name`));
      if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity)) {
        errors.push(error("ingredient_quantity", `ingredients[${index}].quantity`));
      }
      if (!item.unit) errors.push(error("ingredient_unit", `ingredients[${index}].unit`));
    });
  }
  if (!Array.isArray(pkg.equipment)) errors.push(error("bad_equipment", "equipment"));
  for (const field of ["prep_minutes", "cook_minutes", "total_minutes"]) {
    if (typeof pkg[field] !== "number" || pkg[field] < 0) errors.push(error("bad_time", field));
  }
  if (
    typeof pkg.prep_minutes === "number" &&
    typeof pkg.cook_minutes === "number" &&
    typeof pkg.total_minutes === "number" &&
    pkg.total_minutes !== pkg.prep_minutes + pkg.cook_minutes
  ) {
    errors.push(error("time_mismatch", "total_minutes"));
  }
  if (!Array.isArray(pkg.steps) || !pkg.steps.length) errors.push(error("missing_steps", "steps"));
  else {
    pkg.steps.forEach((step, index) => {
      if (step.step_number !== index + 1) errors.push(error("step_order", `steps[${index}]`));
      if (!step.body) errors.push(error("step_body", `steps[${index}].body`));
    });
  }
  if (!Array.isArray(pkg.dietary_labels)) errors.push(error("bad_dietary", "dietary_labels"));
  if (!Array.isArray(pkg.allergens)) errors.push(error("bad_allergens", "allergens"));
  if (!Array.isArray(pkg.vocabulary_tag_ids)) {
    errors.push(error("bad_vocabulary", "vocabulary_tag_ids"));
  } else {
    for (const slug of pkg.vocabulary_tag_ids) {
      const concept = getTasteTerm(slug);
      if (!concept) errors.push(error("unknown_vocabulary_tag", slug));
      else if (!concept.active) errors.push(error("inactive_vocabulary_tag", slug));
    }
  }
  if (!RECIPE_PROVENANCE.includes(pkg.provenance)) errors.push(error("bad_provenance", "provenance"));
  if (!pkg.image || !IMAGE_PROVENANCE.includes(pkg.image.provenance)) {
    errors.push(error("bad_image_provenance", "image.provenance"));
  }
  if (!PUBLICATION_STATUSES.includes(pkg.publication_status)) {
    errors.push(error("bad_publication", "publication_status"));
  }
  if (!RIGHTS_STATES.includes(pkg.rights_state)) errors.push(error("bad_rights", "rights_state"));
  if (!PACKAGE_VISIBILITY.includes(pkg.visibility)) errors.push(error("bad_visibility", "visibility"));
  if (!DATA_ORIGINS.includes(pkg.data_origin)) errors.push(error("bad_origin", "data_origin"));
  if (typeof pkg.kitchen_tested !== "boolean") errors.push(error("bad_kitchen_tested", "kitchen_tested"));
  if (pkg.kitchen_tested === true) {
    const current = isCurrentCatalogVersion(pkg.recipe_version_id);
    if (current || pkg.provenance === "unknown_unverified") {
      errors.push(error("kitchen_tested_refused", "kitchen_tested"));
    } else if (pkg.validation_kind !== "kitchen_tested") {
      errors.push(error("kitchen_test_needs_record", "validation_kind"));
    }
  }
  if (pkg.validation_kind === "kitchen_tested" && pkg.kitchen_tested !== true) {
    errors.push(error("structural_is_not_kitchen_tested", "validation_kind"));
  }
  if (pkg.visibility === "household" && !pkg.household_id) {
    errors.push(error("household_scope", "household_id"));
  }
  if (pkg.visibility === "global" && pkg.household_id) {
    errors.push(error("household_marked_global", "visibility"));
  }
  if (pkg.visibility === "household" && pkg.publication_status === "published") {
    errors.push(error("household_variation_not_global", "publication_status"));
  }
  return { ok: errors.length === 0, errors, kitchen_tested: false, structural_only: true };
}

/**
 * Unpublished, invalid, or household-only packages are not recommended.
 * A passing structural check does not publish a recipe.
 * @param {object} pkg
 */
export function canRecommend(pkg) {
  if (!pkg) return false;
  if (pkg.visibility !== "global" || pkg.household_id) return false;
  if (pkg.publication_status !== "published") return false;
  return validateRecipePackage(pkg).ok;
}

export function isCurrentCatalogVersion(recipeVersionId) {
  return CURRENT_VERSION_IDS.has(recipeVersionId);
}

export function markKitchenTested(pkg) {
  if (!pkg || isCurrentCatalogVersion(pkg.recipe_version_id) || pkg.provenance === "unknown_unverified") {
    throw new Error("This recipe is not kitchen-tested");
  }
  throw new Error("Kitchen testing is a separate record. Structural validation does not set it");
}

function clone(value) {
  return structuredClone(value);
}

/**
 * @param {object[]} versions
 * @param {object} next
 */
export function publishNextVersion(versions, next) {
  const prior = (versions || []).filter((row) => row.recipe_id === next.recipe_id);
  if (!prior.length) throw new Error("publish needs an existing recipe");
  if (prior.some((row) => row.recipe_version_id === next.recipe_version_id)) {
    throw new Error("recipe version id is immutable");
  }
  const maxNumber = Math.max(...prior.map((row) => row.version_number));
  if (!(next.version_number > maxNumber)) throw new Error("version numbers only move forward");
  if (next.visibility === "household" || next.household_id) {
    throw new Error("a household variation does not publish as a global recipe");
  }
  const snapshot = prior.map((row) => clone(row));
  const published = clone(next);
  return {
    versions: [...versions.map((row) => clone(row)), published],
    previous: snapshot,
  };
}

export function shopIngredients(version, shoppedAt = "2026-10-03T00:00:00.000Z") {
  return Object.freeze({
    plan_keeps: version.recipe_version_id,
    recipe_version_id: version.recipe_version_id,
    ingredients: Object.freeze(clone(version.ingredients)),
    shopped_at: shoppedAt,
  });
}

export function ingredientsForPlan(shoppedLines, versions, recipeVersionId) {
  const line = (shoppedLines || []).find((row) => row.recipe_version_id === recipeVersionId);
  if (line) return line.ingredients;
  const version = (versions || []).find((row) => row.recipe_version_id === recipeVersionId);
  return version ? version.ingredients : null;
}

/**
 * A household edit is a private recipe. It does not replace the global one.
 * @param {object} base
 * @param {{ household_id: string, data_origin: string, title?: string }} input
 */
export function createHouseholdVariation(base, input) {
  if (!input?.household_id) throw new Error("a household variation needs a household");
  if (!DATA_ORIGINS.includes(input.data_origin)) throw new Error("unknown data origin");
  const next = clone(base);
  next.recipe_id = `rcp_hh_${input.household_id}_${base.dish_id}`;
  next.recipe_version_id = `rv_hh_${input.household_id}_${base.dish_id}_v1`;
  next.version_number = 1;
  next.visibility = "household";
  next.household_id = input.household_id;
  next.provenance = "household_submitted";
  next.publication_status = "unpublished";
  next.data_origin = input.data_origin;
  next.kitchen_tested = false;
  next.validation_kind = "structural_only";
  next.rights_state = "not_cleared_for_external_release";
  if (input.title) next.title = input.title;
  next.becomes_global_recipe = false;
  return next;
}
