import { describe, expect, it } from "vitest";
import {
  runAllCatalogQualityChecks,
  validateCatalogScaling,
  validateRecipeCompleteness,
  validateTofuLimeRegression,
} from "../src/lib/catalog-quality.js";
import { MEAL_CONCEPTS, getConceptBySlug } from "../src/lib/recipe-store.js";
import { scaleRecipeVersion } from "../src/lib/recipe-scaling.js";

describe("FW-03 recipe completeness (structural)", () => {
  it("passes executable recipe checks for all catalog meals", () => {
    const result = validateRecipeCompleteness();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("fish taco QA: slaw, oil, heat, doneness, and crema guidance", () => {
    const c = getConceptBySlug("crispy-fish-tacos-cabbage-slaw");
    expect(c).toBeTruthy();
    const v = c.current_version;
    expect(v.ingredients.some((i) => /oil/i.test(i.name))).toBe(true);
    expect(v.ingredients.some((i) => /lime/i.test(i.name))).toBe(true);
    expect(v.ingredients.find((i) => /crema/i.test(i.name))?.note).toMatch(/store-bought/i);
    const fry = v.steps.find((s) => /crisp fish/i.test(s.title));
    expect(fry.body).toMatch(/medium-high|400°F|min/i);
    expect(fry.body).toMatch(/flakes easily|golden/i);
    const slawRefs = v.steps.find((s) => /slaw/i.test(s.title))?.ingredient_refs || [];
    for (const ref of slawRefs) {
      expect(v.ingredients.some((i) => i.name.toLowerCase().includes(ref.toLowerCase()))).toBe(true);
    }
  });

  it("Oct 1 tofu/lime regression — PASS on current catalog", () => {
    expect(validateTofuLimeRegression().ok).toBe(true);
  });
});

describe("FW-04 serving scale audit", () => {
  const sampleSlugs = [
    "crispy-chipotle-tofu-tacos",
    "miso-ginger-salmon",
    "cashew-pesto-pasta",
    "crispy-fish-tacos-cabbage-slaw",
    "coconut-chickpea-curry",
  ];

  it("passes grammar and metadata for servings 1–4 across catalog", () => {
    expect(validateCatalogScaling([1, 2, 3, 4]).ok).toBe(true);
  });

  for (const slug of sampleSlugs) {
    for (const diners of [1, 2, 3, 4]) {
      it(`scales ${slug} for ${diners} diner(s) without 1 cups grammar`, () => {
        const c = getConceptBySlug(slug);
        const scaled = scaleRecipeVersion(c.current_version, diners);
        expect(scaled.requested_servings).toBe(diners);
        for (const ing of scaled.ingredients) {
          expect(ing.quantity || "").not.toMatch(/^1 cups\b/i);
        }
      });
    }
  }

  it("aggregate catalog quality gate still passes", () => {
    expect(runAllCatalogQualityChecks().ok).toBe(true);
    expect(MEAL_CONCEPTS.length).toBe(24);
  });
});
