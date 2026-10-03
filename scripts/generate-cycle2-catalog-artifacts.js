#!/usr/bin/env node
/**
 * Regenerate Cycle 2 catalog artifacts (image inventory + coverage report).
 * Local only — does not touch D1 or the live recommender.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildCoverageReport, buildCycle2Catalog } from "../src/lib/cycle2-catalog.js";
import { MEAL_CONCEPTS } from "../src/lib/recipe-store.js";

const root = new URL("../", import.meta.url);
const dataDir = new URL("../data/", import.meta.url);

const packages = buildCycle2Catalog();

const imageInventory = {
  generated_at: "2026-10-03",
  rights_default: "not_cleared_for_external_release",
  meals: MEAL_CONCEPTS.map((concept) => ({
    dish_id: concept.concept_id,
    image_ref: `/images/meals/${concept.concept_id}.webp`,
    image_provenance: "unknown",
    source: "unknown",
    license: "unknown",
    capture_kind: "unknown",
    rights_state: "not_cleared_for_external_release",
  })),
};

const coverage = buildCoverageReport(packages);

writeFileSync(fileURLToPath(new URL("cycle2-image-inventory.json", dataDir)), `${JSON.stringify(imageInventory, null, 2)}\n`);
writeFileSync(fileURLToPath(new URL("cycle2-coverage-report.json", dataDir)), `${JSON.stringify(coverage, null, 2)}\n`);

console.log(`Wrote ${imageInventory.meals.length} image rows and coverage for ${coverage.meal_count} meals.`);
