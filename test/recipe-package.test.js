import { describe, expect, it } from "vitest";
import { auditCatalogFields } from "../src/lib/legacy-preference-audit.js";
import {
  canRecommend,
  catalogVocabularyCoverage,
  createHouseholdVariation,
  ingredientsForPlan,
  isCurrentCatalogVersion,
  markKitchenTested,
  parseLegacyQuantity,
  projectLegacyCatalog,
  projectLegacyConcept,
  publishNextVersion,
  shopIngredients,
  validateRecipePackage,
} from "../src/lib/recipe-package.js";
import { MEAL_CONCEPTS, getConceptBySlug } from "../src/lib/recipe-store.js";

function publishedFixture(overrides = {}) {
  return {
    dish_id: "weeknight-beans",
    recipe_id: "rcp_weeknight-beans",
    recipe_version_id: "rv_weeknight-beans_v1",
    version_number: 1,
    title: "Weeknight beans",
    description: "A pot of beans with lime.",
    ingredients: [{ name: "black beans", quantity: 1, unit: "can", note: null }],
    base_servings: 2,
    equipment: ["stovetop"],
    prep_minutes: 10,
    cook_minutes: 15,
    total_minutes: 25,
    steps: [{ step_number: 1, title: "Simmer", body: "Simmer the beans until hot.", ingredient_refs: [] }],
    heat: null,
    doneness: null,
    dietary_labels: ["plant"],
    allergens: [],
    vocabulary_tag_ids: ["smoky"],
    provenance: "original_team_created",
    image: { ref: null, provenance: "unknown" },
    publication_status: "published",
    rights_state: "not_cleared_for_external_release",
    kitchen_tested: false,
    validation_kind: "structural_only",
    visibility: "global",
    household_id: null,
    data_origin: "household",
    ...overrides,
  };
}

describe("legacy recipe projection", () => {
  it("projects all 24 meals without inventing provenance or a kitchen test", () => {
    const packages = projectLegacyCatalog();
    expect(packages).toHaveLength(24);
    expect(MEAL_CONCEPTS).toHaveLength(24);
    for (const pkg of packages) {
      expect(pkg.provenance).toBe("unknown_unverified");
      expect(pkg.image.provenance).toBe("unknown");
      expect(pkg.rights_state).toBe("not_cleared_for_external_release");
      expect(pkg.kitchen_tested).toBe(false);
      expect(pkg.validation_kind).toBe("structural_only");
      expect(pkg.publication_status).toBe("unpublished");
      expect(pkg.data_origin).toBe("unproven");
      expect(pkg.description).toBeNull();
      expect(pkg.heat).toBeNull();
      expect(pkg.doneness).toBeNull();
      expect(canRecommend(pkg)).toBe(false);
      expect(isCurrentCatalogVersion(pkg.recipe_version_id)).toBe(true);
      expect(() => markKitchenTested(pkg)).toThrow(/not kitchen-tested/);
      const findings = validateRecipePackage(pkg);
      expect(findings.kitchen_tested).toBe(false);
      expect(findings.structural_only).toBe(true);
    }
  });

  it("maps authored tofu-taco metadata and leaves the default savory tag off", () => {
    const pkg = projectLegacyConcept(getConceptBySlug("crispy-chipotle-tofu-tacos"));
    expect(pkg.vocabulary_tag_ids).toEqual(["citrusy", "crispy", "mexican", "smoky", "tacos", "tofu"]);
    expect(pkg.equipment).toEqual(["air-fryer", "stovetop"]);
    expect(pkg.dietary_labels).toEqual(["dairy_free", "plant"]);
    expect(pkg.allergens).toEqual([]);
    expect(pkg.recipe_version_id).toBe("rv_crispy-chipotle-tofu-tacos_v1");
    expect(pkg.ingredients.find((item) => item.name === "extra-firm tofu")).toMatchObject({
      quantity: 14,
      unit: "oz",
    });
  });

  it("does not read smoky or grilled out of a title", () => {
    const lentil = projectLegacyConcept(getConceptBySlug("smoky-lentil-sweet-potato-stew"));
    expect(lentil.vocabulary_tag_ids).not.toContain("smoky");
    expect(lentil.vocabulary_tag_ids).toEqual(["american", "curries", "lentils", "stews"]);
    expect(lentil.equipment).toEqual(["sheet-pan"]);
    const peach = projectLegacyConcept(getConceptBySlug("grilled-peach-burrito-bowl"));
    expect(peach.vocabulary_tag_ids).not.toContain("grilled");
    expect(peach.vocabulary_tag_ids).toContain("bowls");
    expect(peach.vocabulary_tag_ids).toContain("peaches");
  });

  it("keeps finfish, fusion, and sheet-pan in their own concept types", () => {
    const salmon = projectLegacyConcept(getConceptBySlug("miso-ginger-salmon"));
    expect(salmon.vocabulary_tag_ids).toEqual([
      "citrusy",
      "grilled",
      "japanese",
      "salmon",
      "tender",
      "umami",
    ]);
    expect(salmon.vocabulary_tag_ids).not.toContain("fish");
    expect(salmon.allergens).toEqual(["finfish"]);
    expect(salmon.equipment).toEqual(["grill", "skillet"]);

    const noodles = projectLegacyConcept(getConceptBySlug("peanut-noodle-stir-fry"));
    expect(noodles.vocabulary_tag_ids).not.toContain("chinese");
    expect(noodles.vocabulary_tag_ids).not.toContain("thai");
    expect(noodles.allergens).toEqual(["nuts", "peanut"]);

    const chicken = projectLegacyConcept(getConceptBySlug("sheet-pan-lemon-herb-chicken"));
    expect(chicken.vocabulary_tag_ids).toEqual(["american", "chicken", "citrusy"]);
    expect(chicken.equipment).toEqual(["sheet-pan"]);
    expect(chicken.allergens).toEqual(["meat", "poultry"]);
  });

  it("reports raw coverage, including zeros", () => {
    const coverage = catalogVocabularyCoverage();
    for (const slug of ["korean", "swordfish", "sandwiches", "crunchy", "spicy", "tangy", "rich", "fresh", "savory"]) {
      expect(coverage[slug] || 0).toBe(0);
    }
    expect(coverage.smoky).toBe(1);
    expect(coverage.grilled).toBe(1);
    expect(coverage.citrusy).toBeGreaterThan(0);
  });

  it("leaves ambiguous catalog values unresolved", () => {
    const audit = auditCatalogFields(MEAL_CONCEPTS);
    const unresolved = audit.filter((row) => row.status === "unresolved").map((row) => `${row.source}:${row.value}`);
    expect(unresolved).toEqual(
      expect.arrayContaining([
        "cuisine:asian-fusion",
        "flavor_profile:savory",
        "flavor_profile:warm-spiced",
        "meal_format:fillet",
        "meal_format:handheld",
        "meal_format:packet",
        "meal_format:plate",
        "meal_format:side-main",
        "method:stovetop",
        "primary_ingredient:beans",
        "primary_ingredient:pasta",
        "spark:fish",
        "tag:seafood",
        "texture:mixed",
      ])
    );
  });
});

describe("recipe package rules", () => {
  it("parses a plain quantity and leaves a messy one unknown", () => {
    expect(parseLegacyQuantity("14 oz")).toMatchObject({ quantity: 14, unit: "oz" });
    expect(parseLegacyQuantity("½ tsp")).toMatchObject({ quantity: 0.5, unit: "tsp" });
    expect(parseLegacyQuantity("3 cups shredded")).toMatchObject({
      quantity: 3,
      unit: "cup",
      note: "shredded",
    });
    expect(parseLegacyQuantity("2")).toMatchObject({ quantity: 2, unit: "count" });
    expect(parseLegacyQuantity("8 small")).toMatchObject({ quantity: 8, unit: "count", note: "small" });
    expect(parseLegacyQuantity("a splash")).toMatchObject({ quantity: null, unit: null, raw: "a splash" });
  });

  it("requires vocabulary ids and refuses a free-text bbq tag", () => {
    const raw = publishedFixture({ vocabulary_tag_ids: ["bbq"] });
    expect(validateRecipePackage(raw).errors.map((item) => item.code)).toContain("unknown_vocabulary_tag");
    expect(canRecommend(raw)).toBe(false);
    const resolved = publishedFixture();
    expect(validateRecipePackage(resolved).ok).toBe(true);
    expect(canRecommend(resolved)).toBe(true);
    expect(canRecommend({ ...resolved, publication_status: "unpublished" })).toBe(false);
    expect(canRecommend({ ...resolved, publication_status: "invalid" })).toBe(false);
    expect(canRecommend({ ...resolved, publication_status: "draft" })).toBe(false);
  });

  it("does not recommend an unknown or current recipe just because the fields parse", () => {
    const unknown = publishedFixture({ provenance: "unknown_unverified", kitchen_tested: true });
    expect(validateRecipePackage(unknown).ok).toBe(false);
    expect(canRecommend(unknown)).toBe(false);
    expect(() => markKitchenTested(publishedFixture({ provenance: "original_team_created" }))).toThrow(
      /separate record/
    );
  });

  it("publishes v2 without rewriting v1 or a shopped list", () => {
    const v1 = publishedFixture();
    const shopped = shopIngredients(v1);
    const v2 = publishedFixture({
      recipe_version_id: "rv_weeknight-beans_v2",
      version_number: 2,
      ingredients: [{ name: "black beans", quantity: 3, unit: "can", note: null }],
    });
    const published = publishNextVersion([v1], v2);
    v2.ingredients[0].quantity = 9;
    expect(published.previous[0].ingredients[0].quantity).toBe(1);
    expect(shopped.ingredients[0].quantity).toBe(1);
    expect(ingredientsForPlan([shopped], published.versions, v1.recipe_version_id)[0].quantity).toBe(1);
    expect(published.versions.map((row) => row.recipe_version_id)).toEqual([
      "rv_weeknight-beans_v1",
      "rv_weeknight-beans_v2",
    ]);
    expect(() => publishNextVersion(published.versions, v1)).toThrow(/immutable/);
  });

  it("keeps a household variation private", () => {
    const base = projectLegacyConcept(getConceptBySlug("miso-ginger-salmon"));
    const variation = createHouseholdVariation(base, {
      household_id: "hh_test",
      data_origin: "synthetic",
      title: "Our miso salmon",
    });
    expect(base.recipe_id).toBe("rcp_miso-ginger-salmon");
    expect(variation.recipe_id).not.toBe(base.recipe_id);
    expect(variation).toMatchObject({
      visibility: "household",
      household_id: "hh_test",
      provenance: "household_submitted",
      publication_status: "unpublished",
      data_origin: "synthetic",
      becomes_global_recipe: false,
      kitchen_tested: false,
    });
    expect(canRecommend(variation)).toBe(false);
    expect(() =>
      publishNextVersion([base], { ...variation, version_number: 2, recipe_id: base.recipe_id })
    ).toThrow(/household variation/);
  });
});
