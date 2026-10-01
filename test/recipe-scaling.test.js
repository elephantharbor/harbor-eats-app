import { describe, expect, it } from "vitest";
import {
  scaleIngredientQuantity,
  scaleRecipeVersion,
} from "../src/lib/recipe-scaling.js";

describe("recipe scaling", () => {
  const baseVersion = {
    recipe_version_id: "rv_test",
    concept_id: "test",
    version_number: 1,
    servings: 4,
    prep_minutes: 10,
    cook_minutes: 20,
    effort: "Easy",
    methods: ["stovetop"],
    dietary_tags: [],
    ingredients: [
      { name: "corn tortillas", quantity: "8 small" },
      { name: "chipotle powder", quantity: "1 tsp" },
      { name: "extra-firm tofu", quantity: "14 oz" },
    ],
    steps: [{ title: "Cook", body: "Go", ingredient_refs: ["tofu"] }],
  };

  it("scales tortillas for 2 diners from base 4", () => {
    const scaled = scaleRecipeVersion(baseVersion, 2);
    expect(scaled.servings).toBe(2);
    expect(scaled.base_servings).toBe(4);
    expect(scaled.scale_factor).toBe(0.5);
    const tort = scaled.ingredients.find((i) => i.name.includes("tortilla"));
    expect(tort.quantity).toMatch(/^4/);
  });

  it("scales for 3 diners", () => {
    const scaled = scaleRecipeVersion(baseVersion, 3);
    expect(scaled.servings).toBe(3);
    const tort = scaled.ingredients.find((i) => i.name.includes("tortilla"));
    expect(parseInt(tort.quantity, 10)).toBe(6);
  });

  it("leaves base quantities at 4 when target matches canonical servings", () => {
    const scaled = scaleRecipeVersion(baseVersion, 4);
    expect(scaled.scale_factor).toBe(1);
    expect(scaled.ingredients[0].quantity).toBe("8 small");
  });

  it("handles fractional tsp amounts", () => {
    expect(scaleIngredientQuantity("½ tsp", 2, "salt")).toBe("1 tsp");
    expect(scaleIngredientQuantity("1 tbsp", 0.5, "oil")).toBe("½ tbsp");
  });
});
