/**
 * Behavioral parity for the original 24 meals.
 * Publication and certification fields are intentional additions.
 * A mismatch here is a migration error.
 */

import { projectLegacyConcept } from "./recipe-package.js";
import { MEAL_CONCEPTS } from "./recipe-store.js";

export const INTENTIONAL_DIFFERENCES = Object.freeze([
  "Legacy artifacts are published so the staging menu can serve them. The Cycle 2 in-memory projection marks those same meals unpublished. recipe-store meals have no publication field.",
  "Certification, image rights, and evidence notes are recorded beside the meal. They are not recipe-store fields, and they do not change ingredients or steps.",
  "A parsed quantity and unit may sit beside the original quantity string. Parity compares the original string.",
  "Household cook count and rating count stay unknown for the legacy 24. They are not stored as zero.",
]);

function same(actual, expected) {
  return JSON.stringify(actual ?? null) === JSON.stringify(expected ?? null);
}

function sorted(values) {
  return [...(values || [])].map((item) => String(item)).sort();
}

/**
 * @param {import("./recipe-store.js").MealConcept} concept
 * @param {object} record normalized or database-loaded catalog record
 */
export function parityConcept(concept, record) {
  /** @type {{ field: string, actual: unknown, expected: unknown }[]} */
  const mismatches = [];
  const version = concept.current_version;
  const projected = projectLegacyConcept(concept);
  function check(field, actual, expected) {
    if (!same(actual, expected)) mismatches.push({ field, actual, expected });
  }
  check("dish_id", record.dish_id || record.slug, concept.concept_id);
  check("recipe_id", record.recipe_id, `rcp_${concept.concept_id}`);
  check("recipe_version_id", record.recipe_version_id, version.recipe_version_id);
  check("version_number", record.version_number, version.version_number);
  check("title", record.title, concept.title || concept.name);
  check("name", record.name, concept.name);
  check("servings", record.base_servings, version.servings);
  check("prep_minutes", record.prep_minutes, version.prep_minutes);
  check("cook_minutes", record.cook_minutes, version.cook_minutes);
  check("total_minutes", record.total_minutes, version.prep_minutes + version.cook_minutes);
  check("methods", record.methods, version.methods);
  check("cuisine", record.cuisine, concept.cuisine);
  check("meal_format", record.meal_format, concept.meal_format);
  check("primary_ingredient", record.primary_ingredient, concept.primary_ingredient);
  check("texture", record.texture, concept.texture);
  check("flavor_profile", record.flavor_profile, concept.flavor_profile);
  check("weeknight", record.weeknight === 1 || record.weeknight === true, concept.weeknight === true);
  check("exploration", record.exploration, concept.exploration);
  check("plate", record.plate, concept.plate);
  check("tone", record.tone, concept.tone);
  check("sparks", record.sparks, concept.sparks);
  check("chips", record.chips, concept.chips);
  check("tags", sorted(record.eligibility_tags || record.tags), sorted(concept.tags));
  check("vocabulary_tag_ids", sorted(record.vocabulary_tag_ids), sorted(projected.vocabulary_tag_ids));
  check("dietary_labels", sorted(record.dietary_labels), sorted(projected.dietary_labels));
  check("allergens", sorted(record.allergens), sorted(projected.allergens));
  const actualIngredients = (record.ingredients || []).map((item) => ({
    name: item.name,
    quantity: item.raw_quantity,
    note: item.note || null,
  }));
  const expectedIngredients = (version.ingredients || []).map((item) => ({
    name: item.name,
    quantity: item.quantity,
    note: item.note || null,
  }));
  check("ingredients", actualIngredients, expectedIngredients);
  const actualSteps = (record.steps || []).map((step, index) => ({
    step_number: step.step_number || index + 1,
    title: step.title,
    body: step.body,
    ingredient_refs: step.ingredient_refs || [],
  }));
  const expectedSteps = (version.steps || []).map((step, index) => ({
    step_number: index + 1,
    title: step.title,
    body: step.body,
    ingredient_refs: step.ingredient_refs || [],
  }));
  check("steps", actualSteps, expectedSteps);
  const images = record.images || [];
  const master = images.find((item) => item.role === "master");
  const card = images.find((item) => item.role === "card");
  check("image_master", master?.path, `/images/meals/${concept.concept_id}.webp`);
  check("image_card", card?.path, `/images/meals/${concept.concept_id}-640.webp`);
  check("factory_certified", record.provenance?.factory_certified ? 1 : 0, 0);
  check("kitchen_tested", record.provenance?.kitchen_tested ? 1 : 0, 0);
  return { slug: concept.concept_id, ok: mismatches.length === 0, mismatches };
}

export function parityCatalog(records, concepts = MEAL_CONCEPTS) {
  const bySlug = new Map(records.map((record) => [record.slug || record.dish_id, record]));
  const results = concepts.map((concept) => {
    const record = bySlug.get(concept.concept_id);
    if (!record) {
      return {
        slug: concept.concept_id,
        ok: false,
        mismatches: [{ field: "missing", actual: null, expected: concept.concept_id }],
      };
    }
    return parityConcept(concept, record);
  });
  return {
    ok: results.every((row) => row.ok),
    results,
    intentional: INTENTIONAL_DIFFERENCES,
  };
}
