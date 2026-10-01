import { describe, expect, it } from "vitest";
import { buildRankedChoiceSet } from "../src/lib/recommendation-pipeline.js";
import { getRecipeVersion } from "../src/lib/recipe-store.js";

describe("meal option B → recipe version consistency", () => {
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

  it("recipe content matches selected slug not first catalog item", () => {
    const ranked = buildRankedChoiceSet(ctx);
    const optionB = ranked.find((r) => r.letter === "B");
    expect(optionB).toBeTruthy();
    const version = getRecipeVersion(optionB.meal.recipe_version_id);
    expect(version).toBeTruthy();
    expect(version.concept_id).toBe(optionB.meal.recipe_slug);
    const optionA = ranked.find((r) => r.letter === "A");
    expect(version.concept_id).not.toBe(optionA.meal.recipe_slug);
    expect(version.title || version.concept?.title).not.toMatch(/chipotle tofu/i);
  });
});
