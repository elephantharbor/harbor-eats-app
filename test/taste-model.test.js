import { describe, expect, it } from "vitest";
import { scoreCatalogMeals, buildTasteProfile } from "../src/lib/taste-model.js";

describe("taste model v1", () => {
  it("filters ineligible meals via constraints", () => {
    const ranked = scoreCatalogMeals({
      constraints: [{ rule_key: "shellfish", status: "prohibited" }],
      evidence: [],
      ratings: [],
      meal_choice_count: 3,
    });
    expect(ranked.length).toBe(3);
    const slugs = ranked.map((r) => r.meal.recipe_slug);
    expect(slugs).not.toContain("shrimp-stir-fry");
  });

  it("boosts meals matching preference evidence", () => {
    const ranked = scoreCatalogMeals({
      constraints: [],
      evidence: [{ tag: "tacos", kind: "like", weight: 2 }],
      ratings: [],
      meal_choice_count: 3,
    });
    const top = ranked[0].meal;
    const tacoish =
      top.recipe_slug.includes("taco") ||
      top.tags.includes("tacos") ||
      top.sparks.includes("tacos");
    expect(tacoish).toBe(true);
    expect(ranked[0].explanation.line).toMatch(/like/i);
  });

  it("builds honest low-evidence profile copy", () => {
    const profile = buildTasteProfile([], []);
    expect(profile.lines[0].text).toMatch(/learning/i);
  });
});
