import { describe, expect, it } from "vitest";
import {
  mergeCanonicalAttributes,
  projectMealOption,
} from "../src/lib/meal-option-view.js";

const freshAttributes = {
  title: "Miso ginger salmon",
  chips: ["Fish", "35 min"],
  plate: "🐟",
  tone: "tone-b",
  minutes: 35,
  effort: "Medium",
  cuisine: "japanese",
  meal_format: "fillet",
  recipe_slug: "miso-ginger-salmon",
  recipe_version_id: "rv_miso-ginger-salmon_v1",
  pers: { type: "why", label: "A strong match", line: "Bright and weeknight-fast." },
  score: 7.4,
};

describe("FW-02 meal option metadata", () => {
  it("projects time, effort, and meal style from a fresh option", () => {
    const view = projectMealOption({
      letter: "B",
      meal_option_id: "plan-B",
      name: "Miso ginger salmon",
      recipe_slug: "miso-ginger-salmon",
      recipe_version: "rv_miso-ginger-salmon_v1",
      attributes_json: freshAttributes,
    });
    expect(view.time).toBe("35 min");
    expect(view.effort).toBe("Medium");
    expect(view.chips).toEqual(expect.arrayContaining(["Fish", "fillet"]));
    expect(view.meal_format).toBe("fillet");
    expect(view.pers.label).toBe("A strong match");
    expect(view.chips).not.toContain("Shared");
  });

  it("restores the same metadata from a raw persisted row", () => {
    const restored = projectMealOption({
      letter: "B",
      meal_option_id: "plan-B",
      name: "Miso ginger salmon",
      recipe_slug: "miso-ginger-salmon",
      recipe_version: "rv_miso-ginger-salmon_v1",
      attributes_json: JSON.stringify(freshAttributes),
    });
    expect(restored.time).toBe("35 min");
    expect(restored.effort).toBe("Medium");
    expect(restored.meal_format).toBe("fillet");
    expect(restored.pers.line).toMatch(/weeknight/);
    expect(restored.recipe_version_id).toBe("rv_miso-ginger-salmon_v1");
  });

  it("hydrates a lossy share snapshot from the catalog instead of Shared", () => {
    const merged = mergeCanonicalAttributes(freshAttributes, {
      title: "Miso ginger salmon",
      chips: ["Shared"],
      pers: { type: "why", label: "Shared pick", line: "Someone shared these picks with you" },
    });
    expect(merged.minutes).toBe(35);
    expect(merged.chips).toEqual(["Fish", "35 min"]);
    expect(merged.effort).toBe("Medium");
    expect(merged.meal_format).toBe("fillet");
    expect(merged.pers.label).toBe("A strong match");
    expect(merged.recipe_slug).toBe("miso-ginger-salmon");

    const shared = projectMealOption({
      letter: "B",
      meal_option_id: "plan-B",
      name: "Miso ginger salmon",
      recipe_slug: "miso-ginger-salmon",
      recipe_version: "rv_miso-ginger-salmon_v1",
      attributes_json: {
        title: "Miso ginger salmon",
        pers: freshAttributes.pers,
      },
    });
    expect(shared.time).toBe("22 min");
    expect(shared.effort).toBe("Medium");
    expect(shared.chips.join(" ")).not.toMatch(/Shared/);
    expect(shared.meal_format).toBe("fillet");
    expect(shared.pers.label).toBe("A strong match");
  });
});
