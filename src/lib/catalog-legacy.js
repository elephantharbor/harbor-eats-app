/**
 * Structural migration of the current recipe-store meals into catalog artifacts.
 * Prose, quantities, steps, tags, and ids are copied. Nothing is kitchen-tested
 * here, and nothing is marked factory-certified.
 */

import { projectLegacyConcept } from "./recipe-package.js";
import { MEAL_CONCEPTS } from "./recipe-store.js";

export const LEGACY_CONTRACT = "flavorweave-legacy-catalog-package";
export const LEGACY_AUDIT_DRAFT_CONTRACT = "flavorweave-legacy-audit-draft";

export const LEGACY_EVIDENCE_NOTE =
  "Structurally migrated from recipe-store.js. Provenance is unknown where the repo does not state it. Image rights are unverified. This is not a modern factory certification. kitchen_tested is false because the repo has no kitchen-test record for this meal. Household cook count and rating count are unknown, not zero.";

/**
 * @param {import("./recipe-store.js").MealConcept} concept
 */
export function legacyPackageFromConcept(concept) {
  const version = concept.current_version;
  const projected = projectLegacyConcept(concept);
  const slug = concept.concept_id;
  return {
    catalog_contract: LEGACY_CONTRACT,
    catalog_contract_version: 1,
    evidence_class: "legacy_structural",
    dish: {
      dish_id: slug,
      slug,
      title: concept.title || concept.name,
      name: concept.name,
      description: null,
      cuisine: concept.cuisine,
      meal_format: concept.meal_format,
      primary_ingredient: concept.primary_ingredient,
      texture: concept.texture,
      flavor_profile: concept.flavor_profile,
      weeknight: concept.weeknight,
      exploration: concept.exploration,
      plate: concept.plate,
      tone: concept.tone,
      tags: concept.tags,
      sparks: concept.sparks,
      chips: concept.chips,
      current_recipe_id: projected.recipe_id,
      current_version_id: version.recipe_version_id,
    },
    recipe: {
      recipe_id: projected.recipe_id,
      dish_id: slug,
      visibility: "global",
      household_id: null,
    },
    recipe_version: {
      recipe_version_id: version.recipe_version_id,
      recipe_id: projected.recipe_id,
      dish_id: slug,
      version_number: version.version_number,
      immutable: true,
      title: concept.title || concept.name,
      description: null,
      base_servings: version.servings,
      prep_minutes: version.prep_minutes,
      cook_minutes: version.cook_minutes,
      total_minutes: version.prep_minutes + version.cook_minutes,
      effort_level: version.effort_level || null,
      ingredient_complexity: version.ingredient_complexity || null,
      methods: version.methods,
      dietary_tags: version.dietary_tags,
      heat: null,
      doneness: null,
      substitutions: version.substitutions || null,
      ingredients: (version.ingredients || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        note: item.note || null,
      })),
      steps: (version.steps || []).map((step, index) => ({
        step_number: index + 1,
        title: step.title,
        body: step.body,
        ingredient_refs: step.ingredient_refs || [],
      })),
    },
    projection: {
      vocabulary_tag_ids: projected.vocabulary_tag_ids,
      dietary_labels: projected.dietary_labels,
      allergens: projected.allergens,
      equipment: projected.equipment,
      parsed_ingredients: projected.ingredients,
    },
    image: {
      master_ref: `/images/meals/${slug}.webp`,
      card_ref: `/images/meals/${slug}-640.webp`,
      provenance: "unknown",
      rights: "unverified",
    },
    certification: {
      certification_class: "legacy_structural",
      factory_certified: false,
      text_provenance: "unknown_unverified",
      text_provenance_raw: null,
      image_provenance: "unknown",
      image_rights: "unverified",
      kitchen_tested: false,
      household_cook_count: null,
      rating_count: null,
      freeze_integrity: null,
      gates_a_o: null,
      image_gates: null,
      evidence_basis: "recipe_store_structural_migration",
      evidence_note: LEGACY_EVIDENCE_NOTE,
    },
    publication: {
      status: "published",
      artifact_status: "published",
      visibility: "global",
      household_id: null,
      note: "Live alpha menu. Published means the version may be recommended. It does not mean factory-certified.",
    },
  };
}

export function legacyPackagesFromStore(concepts = MEAL_CONCEPTS) {
  return concepts.map(legacyPackageFromConcept);
}
