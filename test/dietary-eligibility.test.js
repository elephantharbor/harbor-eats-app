import { describe, expect, it } from "vitest";
import {
  constraintRowsFromKeys,
  dietProfiles,
  filterEligibleOptions,
  isOptionEligibleForHousehold,
  keysFromConstraintRows,
  optionTags,
} from "../src/lib/eligibility.js";
import { MEAL_CATALOG, catalogMealToOption } from "../src/lib/meal-catalog.js";
import { scoreMealsForHousehold } from "../src/lib/taste-model.js";

const options = MEAL_CATALOG.map((m) => catalogMealToOption(m, "X", "test"));
const slugsFor = (constraints) =>
  filterEligibleOptions(options, constraints).map((o) => o.recipe_slug);

function diner(member_id, keys) {
  return constraintRowsFromKeys(keys).map((r) => ({ ...r, member_id }));
}

/** HH001 hard diet: no dairy, no shellfish, no meat but fish, no poultry, no nuts except cashews. */
const HH001_KEYS = ["dairy", "meat", "poultry", "shellfish", "nuts", "cashew_ok"];

describe("constraint rows from client keys", () => {
  it("stores the cashew exception as an explicit permitted row", () => {
    expect(constraintRowsFromKeys(HH001_KEYS)).toEqual([
      { rule_key: "dairy", status: "prohibited" },
      { rule_key: "meat", status: "prohibited" },
      { rule_key: "poultry", status: "prohibited" },
      { rule_key: "shellfish", status: "prohibited" },
      { rule_key: "nuts", status: "prohibited" },
      { rule_key: "cashew", status: "permitted" },
    ]);
  });

  it("drops an exception that has no parent limit to relax", () => {
    expect(constraintRowsFromKeys(["dairy", "cashew_ok"])).toEqual([
      { rule_key: "dairy", status: "prohibited" },
    ]);
  });

  it("ignores none and duplicates, and round-trips back to client keys", () => {
    const rows = constraintRowsFromKeys(["none", "nuts", "nuts", "cashew_ok", "cashew_ok"]);
    expect(rows).toHaveLength(2);
    expect(keysFromConstraintRows(rows)).toEqual(["nuts", "cashew_ok"]);
  });
});

describe("hard dietary eligibility · HH001", () => {
  it("keeps plant and fish dinners, and drops dairy, meat, poultry, shellfish and nuts", () => {
    const eligible = slugsFor(diner("m1", HH001_KEYS));
    expect(eligible).toContain("crispy-chipotle-tofu-tacos");
    expect(eligible).toContain("miso-ginger-salmon");
    expect(eligible).toContain("citrus-fennel-arctic-char");
    for (const blocked of [
      "black-bean-quesadillas",
      "harissa-roasted-carrots-feta",
      "sheet-pan-lemon-herb-chicken",
      "lemon-garlic-shrimp-pasta",
      "peanut-noodle-stir-fry",
      "mushroom-walnut-bolognese",
    ]) {
      expect(eligible).not.toContain(blocked);
    }
  });

  it("allows cashews only when the exception is explicit", () => {
    expect(slugsFor(diner("m1", HH001_KEYS))).toContain("cashew-pesto-pasta");
    const strict = HH001_KEYS.filter((k) => k !== "cashew_ok");
    expect(slugsFor(diner("m1", strict))).not.toContain("cashew-pesto-pasta");
  });

  it("treats fish as an eligibility rule, separate from taste", () => {
    const noFish = slugsFor(diner("m1", [...HH001_KEYS, "fish"]));
    expect(noFish.some((s) => /salmon|char|fish/.test(s))).toBe(false);
    expect(noFish).toContain("coconut-chickpea-curry");
  });

  it("reads ingredient words in the dish name even when tags miss them", () => {
    const walnut = options.find((o) => o.recipe_slug === "mushroom-walnut-bolognese");
    expect(optionTags(walnut)).toContain("walnut");
    expect(optionTags({ name: "Coconut curry", tags: ["plant"] })).not.toContain("nuts");
    expect(optionTags({ name: "Butternut squash soup", tags: ["plant"] })).not.toContain("butter");
    expect(optionTags({ name: "Peanut butter noodles", tags: ["plant"] })).toEqual(["plant", "peanut"]);
  });

  it("excludes walnut bolognese from No nuts by catalog tags, with the name removed", () => {
    const walnut = options.find((o) => o.recipe_slug === "mushroom-walnut-bolognese");
    expect(walnut.tags).toEqual(expect.arrayContaining(["nuts", "walnut"]));
    const nameless = { name: "Weeknight pasta", tags: walnut.tags };
    expect(isOptionEligibleForHousehold(nameless, diner("m1", ["nuts"]))).toBe(false);
    expect(isOptionEligibleForHousehold(nameless, diner("m1", HH001_KEYS))).toBe(false);
    const untagged = { name: "Mushroom Walnut Bolognese", tags: ["plant", "dairy-free", "pasta"] };
    expect(isOptionEligibleForHousehold(untagged, diner("m1", ["nuts"]))).toBe(false);
  });

  it("never lets a bare 'nuts' tag through the cashew exception", () => {
    const mystery = { name: "Trail mix bowl", tags: ["plant", "nuts"] };
    expect(isOptionEligibleForHousehold(mystery, diner("m1", HH001_KEYS))).toBe(false);
  });

  it("'No meat' covers poultry, so chicken is out even without 'No poultry'", () => {
    expect(slugsFor(diner("m1", ["meat"]))).not.toContain("sheet-pan-lemon-herb-chicken");
    expect(slugsFor(diner("m1", ["meat"]))).toContain("miso-ginger-salmon");
    expect(slugsFor(diner("m1", ["poultry"]))).not.toContain("sheet-pan-lemon-herb-chicken");
  });
});

describe("multi-diner eligibility", () => {
  it("a cashew-OK diner does not relax a strict-nuts diner", () => {
    const rows = [...diner("ana", ["nuts", "cashew_ok"]), ...diner("ben", ["nuts"])];
    expect(slugsFor(rows)).not.toContain("cashew-pesto-pasta");
    expect(slugsFor(diner("ana", ["nuts", "cashew_ok"]))).toContain("cashew-pesto-pasta");
  });

  it("unions limits: one diner's no-meat plus another's no-fish leaves plant dinners", () => {
    const rows = [...diner("ana", ["meat"]), ...diner("ben", ["fish"])];
    const eligible = slugsFor(rows);
    expect(eligible.length).toBeGreaterThanOrEqual(3);
    for (const slug of eligible) {
      const meal = MEAL_CATALOG.find((m) => m.recipe_slug === slug);
      expect(meal.tags).not.toContain("fish");
      expect(meal.tags).not.toContain("meat");
      expect(meal.tags).not.toContain("poultry");
    }
  });

  it("a household-wide prohibition cannot be relaxed by one diner's exception", () => {
    const rows = [
      { rule_key: "nuts", status: "prohibited", member_id: null },
      ...diner("ana", ["nuts", "cashew_ok"]),
    ];
    expect(dietProfiles(rows)[0].permitted.has("cashew")).toBe(false);
    expect(slugsFor(rows)).not.toContain("cashew-pesto-pasta");
  });

  it("three and four diners: a meal must clear every one of them", () => {
    const three = [
      ...diner("ana", HH001_KEYS),
      ...diner("ben", ["shellfish"]),
      ...diner("cy", ["fish"]),
    ];
    const eligibleThree = slugsFor(three);
    expect(eligibleThree).not.toContain("miso-ginger-salmon");
    expect(eligibleThree).toContain("cashew-pesto-pasta");
    const four = [...three, ...diner("dee", ["nuts"])];
    const eligibleFour = slugsFor(four);
    expect(eligibleFour).not.toContain("cashew-pesto-pasta");
    expect(eligibleFour.every((s) => eligibleThree.includes(s))).toBe(true);
    expect(eligibleFour.length).toBeGreaterThanOrEqual(3);
  });

  it("a diner with no limits adds nothing to the union", () => {
    const rows = [...diner("ana", ["dairy"]), ...diner("ben", ["none"])];
    expect(slugsFor(rows)).toEqual(slugsFor(diner("ana", ["dairy"])));
  });
});

describe("taste never overrides a hard limit", () => {
  it("a strong like and a 10/10 history cannot bring back a prohibited meal", () => {
    const constraints = diner("m1", HH001_KEYS);
    const eligibleMeals = MEAL_CATALOG.filter((m) =>
      slugsFor(constraints).includes(m.recipe_slug)
    );
    const ranked = scoreMealsForHousehold({
      meals: eligibleMeals,
      evidence: [
        { tag: "pasta", kind: "like", weight: 9 },
        { tag: "shellfish", kind: "like", weight: 9 },
      ],
      ratings: [
        { recipe_slug: "lemon-garlic-shrimp-pasta", tags: ["shellfish", "pasta"], score: 10 },
        { recipe_slug: "lemon-garlic-shrimp-pasta", tags: ["shellfish", "pasta"], score: 10 },
      ],
      meal_choice_count: 5,
    });
    const slugs = ranked.map((r) => r.meal.recipe_slug);
    expect(slugs).not.toContain("lemon-garlic-shrimp-pasta");
    expect(slugs).not.toContain("mushroom-walnut-bolognese");
  });
});
