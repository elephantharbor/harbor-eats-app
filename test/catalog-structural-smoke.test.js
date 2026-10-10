import { describe, expect, it } from "vitest";
import { checkMeal, hardLimitProblems, WAVE12_SLUGS } from "../scripts/smoke/catalog-structural-smoke.mjs";

const base = {
  dish_id: "cottage-pie",
  slug: "cottage-pie",
  current_recipe_id: "rcp_cottage-pie",
  recipe_id: "rcp_cottage-pie",
  recipe_version_id: "rv_cottage-pie_v1",
  v_dish_id: "cottage-pie",
  publication_status: "published",
  title: "Cottage Pie",
  effort_level: "moderate",
  ingredient_complexity: "standard",
  n_ingredients: 18,
  n_steps: 8,
  allergens: ["meat", "milk"],
  tags: ["meat", "dairy"],
  labels: [],
  ingredient_names: ["ground beef", "butter"],
  image_master: "/images/meals/cottage-pie.webp",
  image_card: "/images/meals/cottage-pie-640.webp",
};

describe("catalog structural smoke", () => {
  it("passes a complete real meal (real bundled WebPs)", () => {
    expect(checkMeal(base)).toEqual([]);
  });
  it("flags unresolved version pointer, unpublished, empty recipe, bad enums", () => {
    expect(checkMeal({ ...base, recipe_version_id: null })[0]).toMatch(/does not resolve/);
    const p = checkMeal({ ...base, publication_status: "retired", n_ingredients: 0, n_steps: 0, effort_level: "hard", ingredient_complexity: null });
    expect(p.join()).toMatch(/retired/);
    expect(p.join()).toMatch(/no ingredients/);
    expect(p.join()).toMatch(/no instructions/);
    expect(p.join()).toMatch(/effort_level=hard/);
    expect(p.join()).toMatch(/ingredient_complexity=null/);
  });
  it("flags missing, rejected, empty and wrong-size images", () => {
    expect(checkMeal({ ...base, image_master: null }).join()).toMatch(/no active master/);
    expect(checkMeal({ ...base, image_card: "/images/meals/rejected/cottage-pie-640.webp" }).join()).toMatch(/rejected/);
    expect(checkMeal(base, { readFile: () => Buffer.alloc(10) }).join()).toMatch(/empty or tiny/);
    // card bytes served as master -> dimension mismatch
    expect(checkMeal({ ...base, image_master: "/images/meals/cottage-pie-640.webp" }).join()).toMatch(/640x480 expected 1200x900|not canonical/);
  });
  it("enforces Sabich sesame invariant", () => {
    const sabich = { ...base, slug: "sabich-pita-sandwiches", dish_id: "sabich-pita-sandwiches", v_dish_id: "sabich-pita-sandwiches" };
    expect(checkMeal({ ...sabich, allergens: ["egg", "wheat"] }).join()).toMatch(/missing sesame/);
    expect(checkMeal({ ...sabich, allergens: ["egg", "sesame", "peanut"] }).join()).toMatch(/unexpected peanut/);
  });
  it("hard-limit cross-check catches an untagged restricted ingredient", () => {
    expect(hardLimitProblems({ ...base, allergens: [], tags: [], ingredient_names: ["large shrimp"] })[0]).toMatch(/shellfish/);
    expect(hardLimitProblems({ ...base, allergens: [], tags: [], ingredient_names: ["swordfish steak", "butter lettuce", "coconut milk"] })).toEqual([]);
    expect(hardLimitProblems({ ...base, allergens: ["milk"], tags: [], labels: ["dairy_free"] }).join()).toMatch(/contradicts/);
  });
  it("tracks the 25 wave-12 slugs", () => expect(new Set(WAVE12_SLUGS).size).toBe(25));
});
