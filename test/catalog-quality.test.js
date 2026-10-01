import { describe, expect, it } from "vitest";
import {
  runAllCatalogQualityChecks,
  validateCatalogQuality,
  validateChoiceSetDiversity,
} from "../src/lib/catalog-quality.js";
import { listCatalogMeals } from "../src/lib/recipe-store.js";
import { buildRankedChoiceSet } from "../src/lib/recommendation-pipeline.js";

describe("catalog quality", () => {
  it("passes full catalog validation", () => {
    const result = runAllCatalogQualityChecks();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("has breadth for multi-week alpha use", () => {
    const meals = listCatalogMeals();
    expect(meals.length).toBeGreaterThanOrEqual(20);
    const cuisines = new Set(meals.map((m) => m.cuisine));
    expect(cuisines.size).toBeGreaterThanOrEqual(8);
  });

  it("choice sets avoid triple duplicate primary ingredient", () => {
    const picked = listCatalogMeals().slice(0, 3);
    const bad = validateChoiceSetDiversity([
      picked[0],
      picked[0],
      picked[0],
    ]);
    expect(bad.ok).toBe(false);
  });
});

describe("recommendation plan integrity", () => {
  it("option B is not option A content", () => {
    const ctx = {
      settings: { meal_choice_count: 3, prefs: {} },
      constraints: [
        { rule_key: "dairy", status: "prohibited" },
        { rule_key: "meat", status: "prohibited" },
        { rule_key: "poultry", status: "prohibited" },
        { rule_key: "shellfish", status: "prohibited" },
        { rule_key: "nuts", status: "prohibited" },
      ],
      evidence: [],
      ratings: [],
      recent_recipe_slugs: [],
      active_member_count: 2,
    };
    const ranked = buildRankedChoiceSet(ctx);
    expect(ranked.length).toBeGreaterThanOrEqual(3);
    const b = ranked.find((r) => r.letter === "B");
    const a = ranked.find((r) => r.letter === "A");
    expect(b).toBeTruthy();
    expect(a).toBeTruthy();
    expect(b.meal.recipe_slug).not.toBe(a.meal.recipe_slug);
    const quality = validateCatalogQuality();
    expect(quality.ok).toBe(true);
  });
});
