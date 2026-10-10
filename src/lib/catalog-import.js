/**
 * Validate catalog artifacts and normalize them into import records.
 * Certified factory JSON is not rewritten. A malformed package or an
 * identity collision is refused.
 */

import { createHash } from "node:crypto";
import { getTasteTerm } from "./taste-vocabulary.js";
import { CATALOG_PUBLICATION_STATES } from "./catalog-publish.js";
import { LEGACY_AUDIT_DRAFT_CONTRACT, LEGACY_CONTRACT } from "./catalog-legacy.js";
import {
  CLASSIFICATION_ACTOR,
  CLASSIFICATION_BATCH_ID,
  classificationPayload,
  isEffortLevel,
  isIngredientComplexity,
} from "./classification.js";
import {
  eligibilityTagsFromMappedFactory,
  mapFactoryDietaryLabel,
  mapFactoryPackageAllergens,
  mapFactoryProvenance,
  normalizeFactoryPublicationStatus,
} from "./factory-package-tokens.js";

export const FACTORY_CONTRACT = "flavorweave-catalog-package";

const PRODUCTION_D1_ID = "23aa3db3-1090-471b-8c8a-b6fe71f5c053";

const ELIGIBILITY_TOKENS = new Set([
  "meat",
  "beef",
  "pork",
  "lamb",
  "bacon",
  "sausage",
  "poultry",
  "chicken",
  "turkey",
  "duck",
  "shellfish",
  "shrimp",
  "mussel",
  "finfish",
  "fish",
  "dairy",
  "milk",
  "cheese",
  "butter",
  "egg",
  "soy",
  "wheat",
  "sesame",
  "nuts",
  "peanut",
  "almond",
  "walnut",
  "pecan",
  "cashew",
  "hazelnut",
  "pistachio",
]);

function error(code, field, detail) {
  return { code, field, detail: detail || null };
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function contentHash(payload) {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function stampHashes(record) {
  record.content_hash = contentHash(hashPayload(record));
  record.classification_hash =
    record.effort_level && record.ingredient_complexity
      ? contentHash(classificationPayload(record.effort_level, record.ingredient_complexity))
      : null;
  return record;
}

/**
 * Culinary hash input. Classification enums, the classification hash, and the
 * removed legacy effort / effort_band / complexity strings are not included.
 * Changing only effort_level or ingredient_complexity must not change this payload.
 */
export function culinaryHashPayload(record) {
  return hashPayload(record);
}

function requirePublishedClassification(dish, version, publicationStatus, errors) {
  if (publicationStatus !== "published") return;
  if (Object.prototype.hasOwnProperty.call(version, "effort")) {
    errors.push(error("obsolete_effort", "recipe_version.effort"));
  }
  if (Object.prototype.hasOwnProperty.call(version, "complexity")) {
    errors.push(error("obsolete_complexity", "recipe_version.complexity"));
  }
  if (Object.prototype.hasOwnProperty.call(dish, "effort_band")) {
    errors.push(error("obsolete_effort_band", "dish.effort_band"));
  }
  if (!isEffortLevel(version.effort_level)) {
    errors.push(error("bad_effort_level", "recipe_version.effort_level", String(version.effort_level ?? "")));
  }
  if (!isIngredientComplexity(version.ingredient_complexity)) {
    errors.push(error("bad_ingredient_complexity", "recipe_version.ingredient_complexity", String(version.ingredient_complexity ?? "")));
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sortedUnique(values) {
  return [...new Set(values.filter((item) => item != null && item !== ""))].sort();
}

/**
 * Hard-limit tags taken only from fields the factory package already states.
 * @param {object} pkg
 */
export function eligibilityTagsFromFactory(pkg, mappedAllergens = null) {
  if (mappedAllergens) return eligibilityTagsFromMappedFactory(pkg, mappedAllergens);
  const mapped = mapFactoryPackageAllergens(pkg);
  if (!mapped.ok) return legacyEligibilityTags(pkg?.recipe_version || {});
  return eligibilityTagsFromMappedFactory(pkg, mapped.allergens);
}

function legacyEligibilityTags(version) {
  const eligibility = version.dietary_eligibility || {};
  /** @type {string[]} */
  const tags = [];
  if (eligibility.contains_meat === true) tags.push("meat");
  if (eligibility.contains_poultry === true) tags.push("poultry");
  if (eligibility.contains_finfish === true) tags.push("finfish");
  if (eligibility.contains_shellfish === true) tags.push("shellfish");
  if (eligibility.contains_dairy === true) tags.push("dairy");
  for (const token of asArray(version.allergens)) {
    const name = String(token || "").trim().toLowerCase();
    if (ELIGIBILITY_TOKENS.has(name)) tags.push(name);
  }
  const nutPolicy = String(eligibility.nut_policy || "").toLowerCase();
  if (nutPolicy === "cashews_only_ok") tags.push("cashew");
  return sortedUnique(tags);
}

function hashPayload(record) {
  return {
    dish_id: record.dish_id,
    recipe_id: record.recipe_id,
    recipe_version_id: record.recipe_version_id,
    version_number: record.version_number,
    title: record.version_title,
    description: record.version_description,
    base_servings: record.base_servings,
    prep_minutes: record.prep_minutes,
    cook_minutes: record.cook_minutes,
    total_minutes: record.total_minutes,
    heat: record.heat,
    doneness: record.doneness,
    methods: record.methods,
    ingredients: record.ingredients,
    steps: record.steps,
    vocabulary_tag_ids: record.vocabulary_tag_ids,
    dietary_labels: record.dietary_labels,
    allergens: record.allergens,
    eligibility_tags: record.eligibility_tags,
    components: record.components,
  };
}

function requireTasteTags(tags, errors) {
  if (!Array.isArray(tags)) {
    errors.push(error("bad_vocabulary", "vocabulary_tag_ids"));
    return [];
  }
  for (const slug of tags) {
    const term = getTasteTerm(slug);
    if (!term) errors.push(error("unknown_vocabulary_tag", slug, slug));
    else if (!term.active) errors.push(error("inactive_vocabulary_tag", slug, slug));
  }
  return [...tags];
}

function checkTimes(prep, cook, total, errors) {
  for (const [field, value] of [
    ["prep_minutes", prep],
    ["cook_minutes", cook],
    ["total_minutes", total],
  ]) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      errors.push(error("bad_time", field));
    }
  }
  if (
    typeof prep === "number" &&
    typeof cook === "number" &&
    typeof total === "number" &&
    total !== prep + cook
  ) {
    errors.push(error("time_mismatch", "total_minutes", `${prep}+${cook}!=${total}`));
  }
}

function checkSteps(steps, errors) {
  if (!Array.isArray(steps) || !steps.length) {
    errors.push(error("missing_steps", "steps"));
    return;
  }
  steps.forEach((step, index) => {
    if (!step || step.step_number !== index + 1) errors.push(error("step_order", `steps[${index}]`));
    if (!step?.body) errors.push(error("step_body", `steps[${index}].body`));
  });
}

function legacyImageRefs(image, slug) {
  function normalizeRef(ref, role) {
    if (!ref) {
      return role === "master" ? `/images/meals/${slug}.webp` : `/images/meals/${slug}-640.webp`;
    }
    if (String(ref).startsWith("/")) return String(ref);
    return `/images/meals/${ref}`;
  }
  return {
    master_ref: normalizeRef(image.master_ref, "master"),
    card_ref: normalizeRef(image.card_ref, "card"),
    provenance: image.provenance || "unknown",
    rights: image.rights || image.image_rights || "unverified",
  };
}

/**
 * @param {object} pkg
 * @param {{
 *   source_path: string,
 *   freeze_integrity?: string|null,
 *   freeze_detail?: string|null,
 *   vale_audit?: object|null,
 * }} source
 * @param {{ publicationStatus?: string }} [policy]
 */
export function normalizeLegacyPackage(pkg, source, policy = {}) {
  /** @type {ReturnType<typeof error>[]} */
  const errors = [];
  if (!pkg || pkg.catalog_contract !== LEGACY_CONTRACT) {
    return { ok: false, errors: [error("bad_contract", "catalog_contract")], record: null };
  }
  const dish = pkg.dish || {};
  const recipe = pkg.recipe || {};
  const version = pkg.recipe_version || {};
  const certification = pkg.certification || {};
  const publication = pkg.publication || {};
  const image = legacyImageRefs(pkg.image || {}, dish.slug || dish.dish_id);
  const projection = pkg.projection || {};
  const versionNumber = version.version_number;
  if (certification.factory_certified !== false) {
    errors.push(error("legacy_marked_factory_certified", "certification.factory_certified"));
  }
  if (certification.kitchen_tested !== false) {
    errors.push(error("legacy_kitchen_tested", "certification.kitchen_tested"));
  }
  if (versionNumber === 1 && certification.certification_class !== "legacy_structural") {
    errors.push(error("bad_certification_class", "certification.certification_class"));
  }
  if (!dish.dish_id || dish.dish_id !== dish.slug) errors.push(error("dish_identity", "dish.dish_id"));
  if (recipe.recipe_id !== `rcp_${dish.dish_id}`) errors.push(error("recipe_identity", "recipe.recipe_id"));
  const expectedVersionId = `rv_${dish.dish_id}_v${versionNumber}`;
  if (version.recipe_version_id !== expectedVersionId) {
    errors.push(error("version_identity", "recipe_version.recipe_version_id"));
  }
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    errors.push(error("bad_version_number", "recipe_version.version_number"));
  }
  if (!Number.isInteger(version.base_servings) || version.base_servings < 1) {
    errors.push(error("bad_servings", "recipe_version.base_servings"));
  }
  if (!policy.relaxTimeMismatch) {
    checkTimes(version.prep_minutes, version.cook_minutes, version.total_minutes, errors);
  }
  if (!Array.isArray(version.ingredients) || !version.ingredients.length) {
    errors.push(error("missing_ingredients", "recipe_version.ingredients"));
  }
  checkSteps(version.steps, errors);
  const taste = requireTasteTags(projection.vocabulary_tag_ids, errors);
  if (!CATALOG_PUBLICATION_STATES.includes(publication.status)) {
    errors.push(error("bad_publication", "publication.status"));
  }
  if (publication.visibility !== "global" || publication.household_id) {
    errors.push(error("bad_visibility", "publication.visibility"));
  }
  const parsed = asArray(projection.parsed_ingredients);
  const ingredients = asArray(version.ingredients).map((item, index) => {
    const parsedItem = parsed[index] || {};
    if (!item?.name) errors.push(error("ingredient_name", `ingredients[${index}].name`));
    if (parsedItem.name && parsedItem.name !== item.name) {
      errors.push(error("parsed_name_mismatch", `projection.parsed_ingredients[${index}].name`));
    }
    return {
      position: index,
      ingredient_id: null,
      name: item.name,
      display_name: item.name,
      quantity: typeof parsedItem.quantity === "number" ? parsedItem.quantity : null,
      unit: parsedItem.unit || null,
      raw_quantity: item.quantity ?? parsedItem.raw_quantity ?? null,
      note: item.note || null,
      preparation: null,
      optional: 0,
      role: null,
    };
  });
  const publicationStatus = policy.publicationStatus || publication.status;
  requirePublishedClassification(dish, version, publicationStatus, errors);
  const provenanceCert = {
    ...certification,
    certification_class: "legacy_structural",
    text_provenance: certification.text_provenance || "legacy_unknown",
    text_provenance_raw: certification.text_provenance_raw ?? null,
    image_provenance: certification.image_provenance || image.provenance || "unknown",
    image_rights: certification.image_rights || image.rights || "unverified",
    evidence_basis: certification.evidence_basis || "legacy_structural",
    evidence_note: certification.evidence_note || certification.note || "Legacy catalog package.",
    freeze_integrity: source.freeze_integrity || certification.freeze_integrity || null,
    gates_a_o: certification.gates_a_o || (source.vale_audit?.overall === "PASS" ? "PASS" : null),
    image_gates: certification.image_gates || (source.vale_audit?.gates?.K === "PASS" ? "PASS" : null),
  };
  const record = baseRecord({
    dish,
    recipe,
    version,
    ingredients,
    taste,
    dietary: asArray(projection.dietary_labels),
    allergens: asArray(projection.allergens),
    equipment: asArray(projection.equipment),
    eligibilityTags: asArray(dish.tags),
    publicationStatus,
    artifactPublicationStatus: publication.artifact_status || publication.status,
    certification: provenanceCert,
    image,
    components: [],
    source,
    contract: LEGACY_CONTRACT,
    selfReport: {
      evidence_class: pkg.evidence_class || "legacy_structural",
      kitchen_tested: false,
      household_cook_count: certification.household_cook_count ?? null,
      rating_count: certification.rating_count ?? null,
      package_revision: pkg.package_revision || null,
      artifact_certification_class: certification.certification_class || null,
      vale_audit: source.vale_audit || null,
      supersedes_version_id: version.supersedes_version_id || null,
    },
  });
  stampHashes(record);
  record.supersedes_version_id = version.supersedes_version_id || version.replaces_recipe_version_id || null;
  return { ok: errors.length === 0, errors, record: errors.length ? null : record };
}

/**
 * Certified legacy audit drafts use a separate on-disk contract. Bytes are not rewritten.
 * @param {object} pkg
 * @param {ReturnType<typeof legacySidecar>} source
 * @param {{ publicationStatus?: string, relaxTimeMismatch?: boolean }} [policy]
 */
export function normalizeLegacyAuditDraftPackage(pkg, source, policy = {}) {
  /** @type {ReturnType<typeof error>[]} */
  const errors = [];
  if (!pkg || pkg.catalog_contract !== LEGACY_AUDIT_DRAFT_CONTRACT) {
    return { ok: false, errors: [error("bad_contract", "catalog_contract")], record: null };
  }
  if (pkg.kitchen_tested !== false) {
    errors.push(error("legacy_kitchen_tested", "kitchen_tested"));
  }
  const dish = pkg.dish || {};
  const recipe = pkg.recipe || {};
  const version = pkg.recipe_version || {};
  const image = legacyImageRefs(pkg.image || {}, dish.slug || dish.dish_id);
  if (!dish.dish_id || dish.dish_id !== dish.slug) errors.push(error("dish_identity", "dish.dish_id"));
  if (recipe.recipe_id !== `rcp_${dish.dish_id}`) errors.push(error("recipe_identity", "recipe.recipe_id"));
  const versionNumber = version.version_number;
  const expectedVersionId = `rv_${dish.dish_id}_v${versionNumber}`;
  if (version.recipe_version_id !== expectedVersionId) {
    errors.push(error("version_identity", "recipe_version.recipe_version_id"));
  }
  if (versionNumber !== 2) errors.push(error("bad_version_number", "recipe_version.version_number"));
  if (version.kitchen_tested !== false) errors.push(error("legacy_kitchen_tested", "recipe_version.kitchen_tested"));
  if (!Number.isInteger(version.base_servings) || version.base_servings < 1) {
    errors.push(error("bad_servings", "recipe_version.base_servings"));
  }
  if (!policy.relaxTimeMismatch) {
    checkTimes(version.prep_minutes, version.cook_minutes, version.total_minutes, errors);
  }
  if (!Array.isArray(version.ingredients) || !version.ingredients.length) {
    errors.push(error("missing_ingredients", "recipe_version.ingredients"));
  }
  checkSteps(version.steps, errors);
  const taste = requireTasteTags(version.vocabulary_tag_ids, errors);
  const ingredients = asArray(version.ingredients).map((item, index) => {
    if (!item?.name) errors.push(error("ingredient_name", `ingredients[${index}].name`));
    const raw =
      item.raw_quantity ||
      (typeof item.quantity === "number" && item.unit ? `${item.quantity} ${item.unit}` : item.quantity) ||
      null;
    return {
      position: index,
      ingredient_id: null,
      name: item.name,
      display_name: item.name,
      quantity: typeof item.quantity === "number" ? item.quantity : null,
      unit: item.unit || null,
      raw_quantity: raw,
      note: item.note || null,
      preparation: item.preparation || null,
      optional: 0,
      role: item.role || null,
    };
  });
  const eligibilityTags = legacyEligibilityTags(version);
  const certification = pkg.certification || {
    certification_class: "unreviewed_revision_draft",
    factory_certified: false,
    text_provenance: version.provenance || pkg.provenance || "legacy_unknown",
    image_provenance: image.provenance,
    image_rights: "unverified",
    kitchen_tested: false,
    household_cook_count: null,
    rating_count: null,
    evidence_basis: "legacy_v1_read_and_corrected_in_draft",
    evidence_note: pkg.catalog_contract_note || certification.evidence_note || certification.note || "Legacy catalog audit draft.",
  };
  const publicationStatus = policy.publicationStatus || version.publication_status || "draft";
  if (!CATALOG_PUBLICATION_STATES.includes(publicationStatus)) {
    errors.push(error("bad_publication", "publication_status", String(publicationStatus)));
  }
  requirePublishedClassification(dish, version, publicationStatus, errors);
  const record = baseRecord({
    dish: {
      ...dish,
      tags: eligibilityTags.length ? eligibilityTags : asArray(dish.tags),
    },
    recipe: { ...recipe, visibility: "global", household_id: null },
    version,
    ingredients,
    taste,
    dietary: asArray(version.dietary_labels),
    allergens: asArray(version.allergens).map((item) => String(item)),
    equipment: asArray(version.equipment).map((item) => String(item)),
    eligibilityTags: eligibilityTags.length ? eligibilityTags : asArray(dish.tags),
    publicationStatus,
    artifactPublicationStatus: version.publication_status || version.publication_state || "draft",
    certification: {
      ...certification,
      certification_class: "legacy_structural",
      factory_certified: false,
      kitchen_tested: false,
      freeze_integrity: source.freeze_integrity || null,
      gates_a_o: source.vale_audit?.overall === "PASS" ? "PASS" : null,
      image_gates: source.vale_audit?.gates?.K === "PASS" ? "PASS" : null,
    },
    image,
    components: [],
    source,
    contract: LEGACY_AUDIT_DRAFT_CONTRACT,
    selfReport: {
      evidence_class: "legacy_structural",
      kitchen_tested: false,
      household_cook_count: null,
      rating_count: null,
      package_revision: pkg.package_revision || null,
      vale_audit: source.vale_audit || null,
      supersedes_version_id: version.replaces_recipe_version_id || version.supersedes_version_id || null,
      source_v1: pkg.source_v1 || null,
      artifact_certification_class: certification.certification_class || null,
    },
  });
  stampHashes(record);
  record.supersedes_version_id = version.replaces_recipe_version_id || version.supersedes_version_id || null;
  return { ok: errors.length === 0, errors, record: errors.length ? null : record };
}

/**
 * @param {object} pkg
 * @param {{
 *   source_path: string,
 *   freeze_integrity?: string|null,
 *   freeze_detail?: string|null,
 *   readme_declares_not_certified?: boolean,
 * }} source
 */
export function normalizeFactoryPackage(pkg, source, policy = {}) {
  /** @type {ReturnType<typeof error>[]} */
  const errors = [];
  if (!pkg || pkg.catalog_contract !== FACTORY_CONTRACT) {
    return { ok: false, errors: [error("bad_contract", "catalog_contract")], record: null };
  }
  const dish = pkg.dish || {};
  const recipe = pkg.recipe || {};
  const version = pkg.recipe_version || {};
  const image = pkg.image || {};
  if (!dish.dish_id || dish.dish_id !== dish.slug) errors.push(error("dish_identity", "dish.dish_id"));
  if (!recipe.recipe_id || recipe.dish_id !== dish.dish_id) errors.push(error("recipe_identity", "recipe.recipe_id"));
  if (!version.recipe_version_id || version.dish_id !== dish.dish_id || version.recipe_id !== recipe.recipe_id) {
    errors.push(error("version_identity", "recipe_version.recipe_version_id"));
  }
  // Factory v1, or a factory successor (vN>1) that names the version it supersedes in the same recipe.
  const factorySupersedes = version.supersedes_recipe_version_id || version.supersedes_version_id || null;
  const validSuccessor =
    Number.isInteger(version.version_number) &&
    version.version_number > 1 &&
    typeof factorySupersedes === "string" &&
    factorySupersedes.startsWith(`rv_${dish.dish_id}_v`) &&
    factorySupersedes !== version.recipe_version_id;
  if (version.version_number !== 1 && !validSuccessor) {
    errors.push(error("bad_version_number", "recipe_version.version_number"));
  }
  if (version.immutable !== true) errors.push(error("version_not_immutable", "recipe_version.immutable"));
  if (!Number.isInteger(version.base_servings) || version.base_servings < 1) {
    errors.push(error("bad_servings", "recipe_version.base_servings"));
  }
  checkTimes(version.prep_minutes, version.cook_minutes, version.total_minutes, errors);
  if (!Array.isArray(version.ingredients) || !version.ingredients.length) {
    errors.push(error("missing_ingredients", "recipe_version.ingredients"));
  } else {
    version.ingredients.forEach((item, index) => {
      if (!item?.name) errors.push(error("ingredient_name", `ingredients[${index}].name`));
      if (typeof item?.quantity !== "number" || !Number.isFinite(item.quantity)) {
        errors.push(error("ingredient_quantity", `ingredients[${index}].quantity`));
      }
      if (!item?.unit) errors.push(error("ingredient_unit", `ingredients[${index}].unit`));
    });
  }
  checkSteps(version.steps, errors);
  const taste = requireTasteTags(version.vocabulary_tag_ids, errors);
  if (!Array.isArray(version.allergens)) errors.push(error("bad_allergens", "recipe_version.allergens"));
  if (!Array.isArray(version.dietary_labels)) errors.push(error("bad_dietary", "recipe_version.dietary_labels"));
  const publicationStatus = policy.publicationStatus || version.publication_status || "draft";
  if (!CATALOG_PUBLICATION_STATES.includes(publicationStatus)) {
    errors.push(error("bad_publication", "publication_status", String(publicationStatus)));
  }
  if (version.kitchen_tested !== false) errors.push(error("factory_kitchen_tested", "recipe_version.kitchen_tested"));
  const confidence = pkg.catalog_confidence || {};
  if (confidence.kitchen_tested !== false) errors.push(error("confidence_kitchen_tested", "catalog_confidence.kitchen_tested"));
  if (confidence.household_cooks !== 0) errors.push(error("cook_count", "catalog_confidence.household_cooks"));
  if (confidence.household_completed_ratings !== 0) {
    errors.push(error("rating_count", "catalog_confidence.household_completed_ratings"));
  }
  requirePublishedClassification(dish, version, publicationStatus, errors);
  const master = imagePath(image, "master", dish.slug);
  const card = imagePath(image, "card", dish.slug);
  if (!master || !card) errors.push(error("missing_image", "image"));
  const allergenMap = mapFactoryPackageAllergens(pkg);
  if (!allergenMap.ok) {
    for (const token of allergenMap.unknown) {
      errors.push(error("unknown_factory_allergen", "recipe_version.allergens", token));
    }
  }
  /** @type {string[]} */
  const mappedAllergens = allergenMap.ok ? allergenMap.allergens : [];
  /** @type {string[]} */
  const mappedDietary = [];
  for (const label of asArray(version.dietary_labels)) {
    const mapped = mapFactoryDietaryLabel(label);
    if (!mapped.ok) errors.push(error("unknown_factory_dietary_label", "recipe_version.dietary_labels", mapped.token));
    else mappedDietary.push(mapped.value);
  }
  const provenanceRaw = version.provenance || recipe.provenance?.source_class || null;
  const provenanceMapped = mapFactoryProvenance(
    typeof provenanceRaw === "object" && provenanceRaw?.source_class ? provenanceRaw.source_class : provenanceRaw
  );
  if (!provenanceMapped.ok) {
    errors.push(error("unknown_factory_provenance", "recipe_version.provenance", provenanceMapped.token));
  }
  const eligibilityTags = allergenMap.ok ? eligibilityTagsFromMappedFactory(pkg, mappedAllergens) : [];
  const ingredients = asArray(version.ingredients).map((item, index) => ({
    position: index,
    ingredient_id: item.ingredient_id || null,
    name: item.name,
    display_name: item.display_name || item.name,
    quantity: item.quantity,
    unit: item.unit,
    raw_quantity: `${item.quantity} ${item.unit}`,
    note: item.note || null,
    preparation: item.preparation || null,
    optional: item.optional ? 1 : 0,
    role: item.role || null,
  }));
  const selfReport = {
    publication_status: version.publication_status || null,
    publication_state: version.publication_state || null,
    certification: pkg.certification || null,
    structural_qa_state: version.structural_qa_state || null,
    culinary_audit_state: version.culinary_audit_state || null,
    catalog_confidence: confidence,
    image_qa_state: image.qa_state || null,
    image_fidelity_state: image.recipe_fidelity_state || null,
    image_rights: image.rights || null,
    readme_declares_not_certified: source.readme_declares_not_certified === true,
    freeze_integrity: source.freeze_integrity || "not_in_package",
    freeze_detail: source.freeze_detail || null,
    recommendation_eligible: pkg.recommendation_eligible === true,
  };
  const evidenceNote = factoryEvidenceNote(selfReport, version);
  const record = baseRecord({
    dish: {
      ...dish,
      name: dish.title,
      texture: null,
      flavor_profile: null,
      weeknight: null,
      exploration: null,
      plate: null,
      tone: null,
      tags: eligibilityTags,
      sparks: [],
      chips: [],
    },
    recipe,
    version,
    ingredients,
    taste,
    dietary: mappedDietary,
    allergens: mappedAllergens,
    equipment: asArray(version.equipment).map((item) => String(item)),
    eligibilityTags,
    publicationStatus,
    artifactPublicationStatus:
      normalizeFactoryPublicationStatus(version.publication_status || version.publication_state) ||
      version.publication_status ||
      version.publication_state ||
      null,
    certification: {
      certification_class: "factory_certified",
      factory_certified: true,
      text_provenance: provenanceMapped.ok ? provenanceMapped.value || "ai_assisted" : "ai_assisted",
      text_provenance_raw:
        typeof provenanceRaw === "object" && provenanceRaw?.source_class
          ? provenanceRaw.source_class
          : version.provenance || recipe.provenance?.source_class || null,
      image_provenance: image.provenance || "ai_illustration",
      image_rights: image.rights || version.rights_state || "unknown",
      kitchen_tested: false,
      household_cook_count: 0,
      rating_count: 0,
      freeze_integrity: source.freeze_integrity || "not_in_package",
      gates_a_o: "not_recorded_in_package",
      image_gates: image.qa_state || "not_recorded_in_package",
      evidence_basis: "wave1_session_designation",
      evidence_note: evidenceNote,
    },
    image: {
      master_ref: master,
      card_ref: card,
      provenance: image.provenance || "ai_illustration",
      rights: image.rights || "unknown",
    },
    components: asArray(version.components),
    source,
    contract: FACTORY_CONTRACT,
    selfReport,
  });
  record.supersedes_version_id = version.version_number > 1 ? factorySupersedes : null;
  stampHashes(record);
  return { ok: errors.length === 0, errors, record: errors.length ? null : record };
}

function imagePath(image, role, slug) {
  const derivatives = asArray(image?.derivatives);
  const wanted = role === "master" ? ["master"] : ["card", "thumb"];
  const row = derivatives.find((item) => wanted.includes(item?.role));
  if (row?.spec_catalog_path) return row.spec_catalog_path;
  if (!slug) return null;
  return role === "master" ? `/images/meals/${slug}.webp` : `/images/meals/${slug}-640.webp`;
}

function factoryEvidenceNote(selfReport, version) {
  const cert = selfReport.certification ? JSON.stringify(selfReport.certification) : "null";
  const confidence = selfReport.catalog_confidence || {};
  return [
    "Wave 1 isolated-staging designation: factory-certified.",
    "Text provenance is AI-assisted. Image provenance is the package image provenance.",
    "kitchen_tested is false. Household cook count is 0. Rating count is 0.",
    `Artifact publication_status is ${version.publication_status || "missing"}.`,
    `Package certification object is ${cert}.`,
    `Package catalog_confidence structural=${confidence.structural_validation || "missing"}, culinary=${confidence.culinary_audit || "missing"}, dietary=${confidence.dietary_audit || "missing"}, image=${confidence.image_fidelity || "missing"}.`,
    `Freeze integrity on disk is ${selfReport.freeze_integrity}.`,
    `Image qa_state is ${selfReport.image_qa_state || "missing"}.`,
    "Gates A-O and image gates K/L1/L2 are not records inside this package, so they are not stamped PASS from the file.",
    selfReport.readme_declares_not_certified
      ? "The package README still says it is not certified. That sentence is kept. The culinary text was not rewritten."
      : "The package README does not declare itself uncertified.",
  ].join(" ");
}

function baseRecord(input) {
  const { dish, recipe, version, source } = input;
  return {
    dish_id: dish.dish_id,
    slug: dish.slug || dish.dish_id,
    title: dish.title,
    name: dish.name || dish.title,
    description: dish.description ?? null,
    cuisine: dish.cuisine ?? null,
    meal_format: dish.meal_format ?? null,
    primary_ingredient: dish.primary_ingredient ?? null,
    texture: dish.texture ?? null,
    flavor_profile: dish.flavor_profile ?? null,
    weeknight: dish.weeknight == null ? null : dish.weeknight ? 1 : 0,
    exploration: dish.exploration ?? null,
    plate: dish.plate ?? null,
    tone: dish.tone ?? null,
    tags: input.eligibilityTags,
    sparks: dish.sparks || [],
    chips: dish.chips || [],
    recipe_id: recipe.recipe_id,
    visibility: "global",
    household_id: null,
    recipe_version_id: version.recipe_version_id,
    version_number: version.version_number,
    version_title: version.title,
    version_description: version.description ?? null,
    base_servings: version.base_servings,
    prep_minutes: version.prep_minutes,
    cook_minutes: version.cook_minutes,
    total_minutes: version.total_minutes,
    effort_level: isEffortLevel(version.effort_level) ? version.effort_level : null,
    ingredient_complexity: isIngredientComplexity(version.ingredient_complexity) ? version.ingredient_complexity : null,
    classification_source: isEffortLevel(version.effort_level) ? CLASSIFICATION_ACTOR : null,
    classification_reason: isEffortLevel(version.effort_level) ? CLASSIFICATION_BATCH_ID : null,
    heat: version.heat ?? null,
    doneness: version.doneness ?? null,
    methods: asArray(version.methods),
    dietary_tags: asArray(version.dietary_tags),
    substitutions: version.substitutions ?? null,
    components: input.components,
    publication_status: input.publicationStatus,
    artifact_publication_status: input.artifactPublicationStatus,
    ingredients: input.ingredients,
    steps: asArray(version.steps).map((step, index) => ({
      step_number: step.step_number || index + 1,
      title: step.title || null,
      body: step.body,
      ingredient_refs: asArray(step.ingredient_refs),
    })),
    vocabulary_tag_ids: [...input.taste],
    dietary_labels: [...input.dietary],
    allergens: [...input.allergens],
    equipment: [...input.equipment],
    eligibility_tags: [...input.eligibilityTags],
    images: [
      {
        role: "master",
        path: input.image.master_ref,
        provenance: input.image.provenance,
        rights_state: input.image.rights,
      },
      {
        role: "card",
        path: input.image.card_ref,
        provenance: input.image.provenance,
        rights_state: input.image.rights,
      },
    ],
    provenance: {
      ...input.certification,
      factory_certified: input.certification.factory_certified ? 1 : 0,
      kitchen_tested: input.certification.kitchen_tested ? 1 : 0,
      package_self_report: input.selfReport,
    },
    content_hash: "",
    source_contract: input.contract,
    source_path: source.source_path,
  };
}

/**
 * Refuse identity collisions before any write.
 * Same culinary hash is a repeat, not a second row.
 * @param {Map<string, { content_hash: string, version_number: number }>} existingById
 * @param {object[]} records
 */
export function planImport(existingById, records) {
  /** @type {ReturnType<typeof error>[]} */
  const errors = [];
  /** @type {object[]} */
  const writes = [];
  /** @type {string[]} */
  const unchanged = [];
  const seenVersion = new Set();
  const seenDishVersion = new Set();
  const seenRecipeVersion = new Set();
  for (const record of records) {
    const versionId = record.recipe_version_id;
    const dishKey = `${record.dish_id}\0${record.version_number}`;
    const recipeKey = `${record.recipe_id}\0${record.version_number}`;
    if (seenVersion.has(versionId) || seenDishVersion.has(dishKey) || seenRecipeVersion.has(recipeKey)) {
      errors.push(error("identity_collision", versionId, record.dish_id));
      continue;
    }
    seenVersion.add(versionId);
    seenDishVersion.add(dishKey);
    seenRecipeVersion.add(recipeKey);
    const prior = existingById.get(versionId);
    if (prior && prior.content_hash !== record.content_hash) {
      errors.push(error("immutable_version_conflict", versionId, "content hash differs"));
      continue;
    }
    if (prior) unchanged.push(versionId);
    writes.push(record);
  }
  return { ok: errors.length === 0, errors, writes, unchanged };
}

export function assertStagingTarget(target, databaseId) {
  if (target !== "staging") {
    return { ok: false, error: "import_target_refused", detail: "Pass --target staging. Production is not a catalog target." };
  }
  if (databaseId && databaseId === PRODUCTION_D1_ID) {
    return { ok: false, error: "production_d1_refused", detail: PRODUCTION_D1_ID };
  }
  return { ok: true };
}

export { PRODUCTION_D1_ID };
