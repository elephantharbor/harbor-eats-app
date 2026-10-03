/**
 * Cycle 2 catalog (D-03): project the 24 legacy meals into publishable recipe packages.
 * Does not rewrite step prose, invent provenance, or flip the live alpha recommender.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { listVocabulary } from "./taste-vocabulary.js";
import {
  canRecommend,
  catalogVocabularyCoverage,
  parseLegacyQuantity,
  projectLegacyConcept,
  validateRecipePackage,
} from "./recipe-package.js";
import { MEAL_CONCEPTS, getConceptBySlug } from "./recipe-store.js";
import {
  PACKAGE_ALLERGEN_IDS,
  PACKAGE_DIETARY_LABELS,
  validateCompoundIngredients,
  warnCatalogDuplicates,
} from "./recipe-package-integrity.js";

const DATA_DIR = new URL("../../data/", import.meta.url);

/** @typedef {{ dish_id: string, publication_status: string, recommendable: boolean, blockers: string[] }} CatalogRowStatus */

/**
 * Re-parse legacy ingredient rows so structural validation can pass without
 * changing stored recipe-store prose.
 * @param {object} pkg
 */
export function normalizeCatalogPackageIngredients(pkg) {
  const next = structuredClone(pkg);
  next.ingredients = (next.ingredients || []).map((row) => {
    if (typeof row.quantity === "number" && Number.isFinite(row.quantity) && row.unit) {
      return row;
    }
    const raw = row.raw_quantity ?? String(row.quantity ?? "");
    const parsed = parseLegacyQuantity(raw);
    if (parsed.quantity != null && parsed.unit) {
      return {
        name: row.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        note: row.note || parsed.note || null,
        raw_quantity: parsed.raw,
      };
    }
    return row;
  });
  return next;
}

/**
 * Short description from existing steps — no invented backstory.
 * @param {object} pkg
 */
export function derivePackageDescription(pkg) {
  const steps = pkg.steps || [];
  const cookStep = steps.find((step) => (step.body || "").trim().length >= 24);
  const body = (cookStep?.body || steps[0]?.body || "").replace(/\s+/g, " ").trim();
  if (body) {
    if (body.length <= 200) return body;
    const cut = body.slice(0, 197);
    const lastSpace = cut.lastIndexOf(" ");
    return `${cut.slice(0, lastSpace > 80 ? lastSpace : 197)}…`;
  }
  const titles = steps.map((s) => s.title).filter(Boolean).slice(0, 3).join(", ");
  return titles ? `${pkg.title}: ${titles}.` : pkg.title;
}

function validatePackageMetadata(pkg) {
  /** @type {string[]} */
  const errors = [];
  for (const label of pkg.dietary_labels || []) {
    if (!PACKAGE_DIETARY_LABELS.has(label)) errors.push(`unknown dietary label: ${label}`);
  }
  for (const allergen of pkg.allergens || []) {
    if (!PACKAGE_ALLERGEN_IDS.has(allergen)) errors.push(`unknown allergen: ${allergen}`);
  }
  return errors;
}

/**
 * @param {object} concept
 * @param {object} [basePkg]
 */
export function buildCatalogPackage(concept, basePkg = projectLegacyConcept(concept)) {
  const pkg = normalizeCatalogPackageIngredients(basePkg);
  if (!pkg.description) pkg.description = derivePackageDescription(pkg);
  return pkg;
}

/**
 * @param {object} pkg
 * @param {{ duplicateWarnings?: string[] }} [extras]
 */
export function applyPublicationGate(pkg, extras = {}) {
  const next = structuredClone(pkg);
  const structural = validateRecipePackage(next);
  const metadataErrors = validatePackageMetadata(next);
  const compound = validateCompoundIngredients(next);
  /** @type {string[]} */
  const blockers = [];
  if (!structural.ok) {
    blockers.push(...structural.errors.map((e) => `${e.code}:${e.field}`));
  }
  blockers.push(...metadataErrors);
  if (!compound.ok) {
    blockers.push(...compound.errors);
  }
  if (blockers.length) {
    next.publication_status = "unpublished";
  } else {
    next.publication_status = "published";
  }
  next._catalog_blockers = blockers;
  next._compound_warnings = compound.warnings;
  next._duplicate_warnings = extras.duplicateWarnings || [];
  return next;
}

export function buildCycle2Catalog() {
  const projected = MEAL_CONCEPTS.map((concept) => buildCatalogPackage(concept));
  const duplicateWarnings = warnCatalogDuplicates(projected);
  const byDish = Object.fromEntries(
    projected.map((pkg) => {
      const dupes = duplicateWarnings.filter((w) => w.dish_ids?.includes(pkg.dish_id));
      return [pkg.dish_id, applyPublicationGate(pkg, { duplicateWarnings: dupes.map((d) => d.message) })];
    })
  );
  return MEAL_CONCEPTS.map((c) => byDish[c.concept_id]);
}

export function catalogPublicationInventory(packages = buildCycle2Catalog()) {
  /** @type {CatalogRowStatus[]} */
  const rows = packages.map((pkg) => ({
    dish_id: pkg.dish_id,
    publication_status: pkg.publication_status,
    recommendable: canRecommend(stripCatalogSeams(pkg)),
    blockers: pkg._catalog_blockers || [],
  }));
  const published = rows.filter((r) => r.publication_status === "published").length;
  const recommendable = rows.filter((r) => r.recommendable).length;
  const structuralOk = rows.filter((r) => !(r.blockers || []).length).length;
  return {
    total: rows.length,
    structural_valid: structuralOk,
    published,
    unpublished: rows.length - published,
    recommendable,
    rows,
  };
}

function stripCatalogSeams(pkg) {
  const { _catalog_blockers, _compound_warnings, _duplicate_warnings, ...rest } = pkg;
  return rest;
}

export function loadImageInventory() {
  const path = fileURLToPath(new URL("cycle2-image-inventory.json", DATA_DIR));
  return JSON.parse(readFileSync(path, "utf8"));
}

const COOK_TIME_BANDS = [
  { id: "under_30", label: "Under 30 minutes", max: 29 },
  { id: "30_to_45", label: "30–45 minutes", min: 30, max: 45 },
  { id: "over_45", label: "Over 45 minutes", min: 46 },
];

function cookTimeBand(totalMinutes) {
  if (typeof totalMinutes !== "number") return "unknown";
  if (totalMinutes <= 29) return "under_30";
  if (totalMinutes <= 45) return "30_to_45";
  return "over_45";
}

/**
 * Coverage across cuisine, meal style, eligibility, flavors/textures, cook-time bands.
 * @param {object[]} [packages]
 */
export function buildCoverageReport(packages = buildCycle2Catalog()) {
  const vocabBySlug = new Map(listVocabulary().map((row) => [row.slug, row]));
  const cuisineSlugs = new Set(
    listVocabulary().filter((t) => t.category === "cuisine").map((t) => t.slug)
  );
  const mealStyleSlugs = new Set(
    listVocabulary().filter((t) => t.category === "meal_style").map((t) => t.slug)
  );
  const flavorSlugs = new Set(listVocabulary().filter((t) => t.category === "flavor").map((t) => t.slug));
  const textureSlugs = new Set(
    listVocabulary().filter((t) => t.category === "texture").map((t) => t.slug)
  );

  const cuisine = {};
  const meal_style = {};
  const flavors = {};
  const textures = {};
  const cook_time_bands = { under_30: 0, "30_to_45": 0, over_45: 0, unknown: 0 };
  let plant_eligible = 0;
  let fish_eligible = 0;

  for (const pkg of packages) {
    const tags = pkg.vocabulary_tag_ids || [];
    for (const slug of tags) {
      if (cuisineSlugs.has(slug)) cuisine[slug] = (cuisine[slug] || 0) + 1;
      if (mealStyleSlugs.has(slug)) meal_style[slug] = (meal_style[slug] || 0) + 1;
      if (flavorSlugs.has(slug)) flavors[slug] = (flavors[slug] || 0) + 1;
      if (textureSlugs.has(slug)) textures[slug] = (textures[slug] || 0) + 1;
    }
    const band = cookTimeBand(pkg.total_minutes);
    cook_time_bands[band] = (cook_time_bands[band] || 0) + 1;
    if ((pkg.dietary_labels || []).includes("plant")) plant_eligible += 1;
    if ((pkg.allergens || []).includes("finfish")) fish_eligible += 1;
  }

  const vocabulary_raw = catalogVocabularyCoverage(packages);

  return {
    generated_at: "2026-10-03",
    meal_count: packages.length,
    cuisine,
    meal_style,
    plant_eligible,
    fish_eligible,
    flavors,
    textures,
    cook_time_bands,
    vocabulary_raw,
    cook_time_band_definitions: COOK_TIME_BANDS,
    zero_coverage_starter_terms: [
      "korean",
      "savory",
      "spicy",
      "tangy",
      "rich",
      "fresh",
      "crunchy",
      "sandwiches",
      "swordfish",
    ].filter((slug) => !(vocabulary_raw[slug] > 0)),
  };
}

export function getConceptByDishId(dishId) {
  return getConceptBySlug(dishId);
}
