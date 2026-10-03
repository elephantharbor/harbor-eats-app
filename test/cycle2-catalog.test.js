import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildCatalogPackage,
  buildCoverageReport,
  buildCycle2Catalog,
  catalogPublicationInventory,
  derivePackageDescription,
  loadImageInventory,
  normalizeCatalogPackageIngredients,
} from "../src/lib/cycle2-catalog.js";
import {
  validateCompoundIngredients,
  warnCatalogDuplicates,
} from "../src/lib/recipe-package-integrity.js";
import {
  canRecommend,
  createHouseholdVariation,
  ingredientsForPlan,
  parseLegacyQuantity,
  projectLegacyCatalog,
  publishNextVersion,
  shopIngredients,
  validateRecipePackage,
} from "../src/lib/recipe-package.js";
import { MEAL_CONCEPTS, getConceptBySlug } from "../src/lib/recipe-store.js";

const COVERAGE_PATH = fileURLToPath(new URL("../data/cycle2-coverage-report.json", import.meta.url));

describe("Cycle 2 catalog (D-03)", () => {
  it("keeps legacy projection unpublished while prepared packages can publish", () => {
    const legacy = projectLegacyCatalog();
    expect(legacy.every((p) => p.publication_status === "unpublished")).toBe(true);
    expect(legacy.every((p) => !canRecommend(p))).toBe(true);

    const prepared = buildCycle2Catalog();
    const inventory = catalogPublicationInventory(prepared);
    expect(inventory.total).toBe(24);
    expect(inventory.structural_valid).toBe(24);
    expect(inventory.published).toBe(24);
    expect(inventory.recommendable).toBe(24);
    for (const pkg of prepared) {
      expect(pkg.provenance).toBe("unknown_unverified");
      expect(pkg.kitchen_tested).toBe(false);
      expect(pkg.validation_kind).toBe("structural_only");
      expect(pkg.rights_state).toBe("not_cleared_for_external_release");
      expect(pkg.image.provenance).toBe("unknown");
      expect(pkg.description).toBeTruthy();
      const stripped = { ...pkg };
      delete stripped._catalog_blockers;
      delete stripped._compound_warnings;
      delete stripped._duplicate_warnings;
      expect(canRecommend(stripped)).toBe(true);
    }
  });

  it("parses glued fractions and for-serving quantities", () => {
    expect(parseLegacyQuantity("1½ cups")).toMatchObject({ quantity: 1.5, unit: "cup" });
    expect(parseLegacyQuantity("for serving")).toMatchObject({ quantity: 1, unit: "serving" });
    const salmon = buildCatalogPackage(getConceptBySlug("miso-ginger-salmon"));
    const rice = salmon.ingredients.find((i) => i.name === "steamed rice");
    expect(rice).toMatchObject({ quantity: 1, unit: "serving" });
  });

  it("derives descriptions from step prose only", () => {
    const pkg = buildCatalogPackage(getConceptBySlug("crispy-chipotle-tofu-tacos"));
    expect(pkg.description).toMatch(/tofu|taco|chipotle/i);
    expect(pkg.description).not.toMatch(/licensed|AI|household/i);
    const emptySteps = { ...pkg, steps: [], description: null };
    expect(derivePackageDescription(emptySteps)).toBe(pkg.title);
  });

  it("flags unexplained compound ingredients", () => {
    const bad = validateCompoundIngredients({
      ingredients: [{ name: "house pesto", quantity: 1, unit: "cup" }],
      steps: [{ body: "Serve immediately." }],
    });
    expect(bad.ok).toBe(false);
    const good = validateCompoundIngredients({
      ingredients: [{ name: "dairy-free crema", quantity: 1, unit: "cup", note: "store-bought" }],
      steps: [],
    });
    expect(good.ok).toBe(true);
  });

  it("emits duplicate warnings without blocking publication", () => {
    const packages = buildCycle2Catalog();
    const warnings = warnCatalogDuplicates(packages);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.message.includes("tacos"))).toBe(true);
    expect(packages.every((p) => p.publication_status === "published")).toBe(true);
  });

  it("matches committed coverage report JSON", () => {
    const live = buildCoverageReport(buildCycle2Catalog());
    const committed = JSON.parse(readFileSync(COVERAGE_PATH, "utf8"));
    expect(committed.meal_count).toBe(24);
    expect(committed.zero_coverage_starter_terms).toEqual(live.zero_coverage_starter_terms);
    expect(committed.cuisine).toEqual(live.cuisine);
    expect(committed.plant_eligible).toBe(live.plant_eligible);
    expect(committed.fish_eligible).toBe(live.fish_eligible);
    expect(committed.cook_time_bands).toEqual(live.cook_time_bands);
  });

  it("lists 24 image refs with unknown provenance and unverified rights", () => {
    const inventory = loadImageInventory();
    expect(inventory.meals).toHaveLength(24);
    for (const row of inventory.meals) {
      expect(row.image_ref).toMatch(/^\/images\/meals\/.+\.webp$/);
      expect(row.image_provenance).toBe("unknown");
      expect(row.source).toBe("unknown");
      expect(row.license).toBe("unknown");
      expect(row.capture_kind).toBe("unknown");
      expect(row.rights_state).toBe("not_cleared_for_external_release");
    }
    expect(new Set(inventory.meals.map((m) => m.dish_id)).size).toBe(24);
  });

  it("keeps household variations private and off the recommender", () => {
    const base = buildCatalogPackage(getConceptBySlug("miso-ginger-salmon"));
    const variation = createHouseholdVariation(base, {
      household_id: "hh_catalog_test",
      data_origin: "household",
      title: "Salmon without mushrooms",
    });
    expect(variation.provenance).toBe("household_submitted");
    expect(variation.visibility).toBe("household");
    expect(canRecommend(variation)).toBe(false);
    expect(variation.publication_status).toBe("unpublished");
    expect(variation.becomes_global_recipe).toBe(false);
  });

  it("does not recommend draft, invalid, or unpublished packages", () => {
    const pkg = buildCatalogPackage(getConceptBySlug("cashew-pesto-pasta"));
    const stripped = { ...pkg };
    expect(canRecommend({ ...stripped, publication_status: "draft" })).toBe(false);
    expect(canRecommend({ ...stripped, publication_status: "invalid" })).toBe(false);
    expect(canRecommend({ ...stripped, publication_status: "unpublished" })).toBe(false);
  });

  it("preserves immutable version 1 when publishing v2 and shopping", () => {
    const v1 = buildCatalogPackage(getConceptBySlug("cashew-pesto-pasta"));
    const publishedV1 = { ...v1, publication_status: "published", provenance: "original_team_created" };
    expect(validateRecipePackage(publishedV1).ok).toBe(true);
    const shopped = shopIngredients(publishedV1);
    const v2 = {
      ...publishedV1,
      recipe_version_id: "rv_cashew-pesto-pasta_v2",
      version_number: 2,
      ingredients: publishedV1.ingredients.map((row, index) =>
        index === 0 ? { ...row, quantity: row.quantity + 1 } : row
      ),
    };
    const published = publishNextVersion([publishedV1], v2);
    v2.ingredients[0].quantity = 99;
    expect(published.previous[0].ingredients[0].quantity).not.toBe(99);
    expect(shopped.ingredients[0].quantity).toBe(publishedV1.ingredients[0].quantity);
    expect(
      ingredientsForPlan([shopped], published.versions, publishedV1.recipe_version_id)[0].quantity
    ).toBe(publishedV1.ingredients[0].quantity);
  });

  it("maps only canonical vocabulary slugs on tofu tacos", () => {
    const pkg = buildCatalogPackage(getConceptBySlug("crispy-chipotle-tofu-tacos"));
    expect(pkg.vocabulary_tag_ids).toEqual(["citrusy", "crispy", "mexican", "smoky", "tacos", "tofu"]);
    expect(pkg.vocabulary_tag_ids).not.toContain("korean");
    expect(pkg.vocabulary_tag_ids).not.toContain("sandwiches");
  });

  it("normalizes legacy projection ingredients without changing recipe-store", () => {
    const raw = projectLegacyCatalog().find((p) => p.dish_id === "black-bean-quesadillas");
    const normalized = normalizeCatalogPackageIngredients(raw);
    const cheese = normalized.ingredients.find((i) => /cheese/i.test(i.name));
    expect(cheese.quantity).toBe(1.5);
    expect(cheese.unit).toBe("cup");
    expect(MEAL_CONCEPTS.find((c) => c.concept_id === "black-bean-quesadillas").current_version.ingredients[1]
      .quantity).toBe("1½ cups");
  });
});
