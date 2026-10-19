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

  it("uses singular cup when scaled to 1", () => {
    expect(scaleIngredientQuantity("4 cups", 0.25, "broth")).toBe("1 cup");
    expect(scaleIngredientQuantity("2 cups", 0.5, "rice")).toBe("1 cup");
  });

  it("shows a quarter cup and tablespoons instead of rounding up to a half cup", () => {
    expect(scaleIngredientQuantity("0.5 cup", 0.5, "raw cashews")).toBe("¼ cup");
    expect(scaleIngredientQuantity("0.25 cup", 0.5, "extra-virgin olive oil")).toBe("2 tbsp");
    expect(scaleIngredientQuantity("0.25 cup", 0.5, "nutritional yeast")).toBe("2 tbsp");
  });

  it("does not treat words inside a name as a count", () => {
    expect(scaleIngredientQuantity("1 lb", 0.5, "large shrimp")).toBe("½ lb");
    expect(scaleIngredientQuantity("1 tsp", 0.5, "onion powder")).toBe("½ tsp");
    expect(scaleIngredientQuantity("2 clove", 0.5, "garlic")).toBe("1 clove");
  });

  it("keeps gram salt on a half-gram step", () => {
    expect(scaleIngredientQuantity("31 g", 0.5, "Diamond Crystal kosher salt")).toBe("15½ g");
    expect(scaleIngredientQuantity("8 g", 0.25, "Diamond Crystal kosher salt")).toBe("2 g");
  });
});
