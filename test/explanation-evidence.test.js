import { describe, expect, it } from "vitest";
import { MEAL_CATALOG } from "../src/lib/meal-catalog.js";
import {
  buildTasteProfile,
  dedupeExplanations,
  ratingEvidence,
  scoreMealsForHousehold,
} from "../src/lib/taste-model.js";
import { buildRankedChoiceSet } from "../src/lib/recommendation-pipeline.js";

const meal = (slug) => MEAL_CATALOG.find((m) => m.recipe_slug === slug);
const rated = (slug, score, member_id = "m1") => ({
  recipe_slug: slug,
  tags: meal(slug).tags,
  score,
  member_id,
});

function explain(slug, input) {
  const ranked = scoreMealsForHousehold({
    meals: [meal(slug), meal("white-bean-kale-soup"), meal("moroccan-chickpea-skillet")],
    evidence: [],
    ratings: [],
    meal_choice_count: 3,
    ...input,
  });
  return ranked.find((r) => r.meal.recipe_slug === slug).explanation;
}

describe("low evidence: one rating is a first impression", () => {
  it("one 9/10 on a recipe is 'Made it before', not 'Worth another round'", () => {
    const why = explain("miso-ginger-salmon", { ratings: [rated("miso-ginger-salmon", 9)] });
    expect(why.kind).toBe("made_before");
    expect(why.label).not.toMatch(/another round/i);
    expect(why.line).toMatch(/You gave it 9\/10 last time/);
  });

  it("one plant rating does not make every plant meal 'similar'", () => {
    const ev = ratingEvidence(meal("white-bean-kale-soup"), [rated("crispy-chipotle-tofu-tacos", 9)]);
    expect(ev.similar_count).toBe(0);
    const why = explain("white-bean-kale-soup", { ratings: [rated("crispy-chipotle-tofu-tacos", 9)] });
    expect(why.kind).not.toMatch(/similar/);
    expect(why.line).not.toMatch(/tacos/i);
  });

  it("a single shared style tag reads as a hunch, not a pattern", () => {
    const why = explain("crispy-fish-tacos-cabbage-slaw", {
      meals: [meal("crispy-fish-tacos-cabbage-slaw"), meal("white-bean-kale-soup"), meal("moroccan-chickpea-skillet")],
      ratings: [rated("crispy-chipotle-tofu-tacos", 8)],
    });
    expect(why.kind).toBe("similar_tentative");
    expect(why.label).toBe("Worth a try");
    expect(why.line).toMatch(/early hunch/);
  });

  it("a fresh kitchen gets plain fit copy with no taste claim", () => {
    const why = explain("white-bean-kale-soup", {});
    expect(["starter", "fit", "exploration"]).toContain(why.kind);
    expect(why.line).not.toMatch(/you (like|love|keep|rated|gave)/i);
    expect(why.confidence).toBe("low");
  });

  it("a one-off like says 'you said', not 'you keep picking'", () => {
    const why = explain("crispy-chipotle-tofu-tacos", {
      meals: [meal("crispy-chipotle-tofu-tacos"), meal("white-bean-kale-soup"), meal("moroccan-chickpea-skillet")],
      evidence: [{ tag: "tacos", kind: "like", weight: 1 }],
    });
    expect(why.kind).toBe("known_preference");
    expect(why.line).toMatch(/You said you like taco night/);
    expect(why.line).not.toMatch(/taco night and taco night/);
  });

  it("the profile calls a single rating early days", () => {
    const profile = buildTasteProfile([], [rated("miso-ginger-salmon", 9)]);
    const line = profile.lines.find((l) => l.kind === "history").text;
    expect(line).toMatch(/first rating/i);
    expect(line).toMatch(/early days/);
  });
});

describe("high evidence: repeated success earns stronger copy", () => {
  it("two ratings averaging 8+ on the same recipe earn 'Worth another round'", () => {
    const why = explain("miso-ginger-salmon", {
      ratings: [rated("miso-ginger-salmon", 9, "m1"), rated("miso-ginger-salmon", 8, "m2")],
    });
    expect(why.kind).toBe("repeat_success");
    expect(why.label).toBe("Worth another round");
    expect(why.line).toMatch(/8\.5\/10 on average/);
  });

  it("two lukewarm ratings stay 'Made it before'", () => {
    const why = explain("miso-ginger-salmon", {
      ratings: [rated("miso-ginger-salmon", 6), rated("miso-ginger-salmon", 7, "m2")],
    });
    expect(why.kind).toBe("made_before");
  });

  it("several strong ratings across related recipes become a real pattern", () => {
    const why = explain("crispy-fish-tacos-cabbage-slaw", {
      meals: [meal("crispy-fish-tacos-cabbage-slaw"), meal("white-bean-kale-soup"), meal("moroccan-chickpea-skillet")],
      ratings: [
        rated("crispy-chipotle-tofu-tacos", 9),
        rated("crispy-chipotle-tofu-tacos", 8, "m2"),
        rated("black-bean-quesadillas", 9),
      ],
    });
    expect(why.kind).toBe("similar_strong");
    expect(why.label).toBe("Your kind of dinner");
  });

  it("repeated likes read as a pattern", () => {
    const why = explain("crispy-chipotle-tofu-tacos", {
      meals: [meal("crispy-chipotle-tofu-tacos"), meal("white-bean-kale-soup"), meal("moroccan-chickpea-skillet")],
      evidence: [{ tag: "tacos", kind: "like", weight: 3 }],
    });
    expect(why.line).toMatch(/You keep picking/);
  });

  it("confidence climbs with meal-specific evidence, not the household's total ratings", () => {
    const manyOther = Array.from({ length: 8 }, (_, i) => rated("teriyaki-tofu-bowls", 7, "m" + i));
    const low = explain("white-bean-kale-soup", { ratings: manyOther });
    expect(low.confidence).toBe("low");
    const high = explain("miso-ginger-salmon", {
      ratings: [rated("miso-ginger-salmon", 9), rated("miso-ginger-salmon", 9, "m2"), rated("miso-ginger-salmon", 8, "m3")],
    });
    expect(high.confidence).toBe("high");
  });
});

describe("explanation labels within one set of picks", () => {
  it("never repeats a claim-free label or an identical line", () => {
    const rows = ["white-bean-kale-soup", "moroccan-chickpea-skillet", "teriyaki-tofu-bowls"].map((slug) => ({
      meal: meal(slug),
      explanation: { kind: "starter", label: "Good starting point", line: "Clears everyone's hard limits — a solid first dinner to learn from." },
    }));
    const out = dedupeExplanations(rows);
    expect(new Set(out.map((r) => r.explanation.label)).size).toBe(3);
    expect(new Set(out.map((r) => r.explanation.line)).size).toBe(3);
    expect(out[0].explanation.label).toBe("Good starting point");
  });

  it("never swaps an evidence label or its reason for an unrelated fact", () => {
    const ranked = scoreMealsForHousehold({
      meals: [meal("miso-ginger-salmon"), meal("maple-mustard-glazed-salmon"), meal("white-bean-kale-soup")],
      evidence: [{ tag: "fish", kind: "like", weight: 1 }],
      ratings: [],
      meal_choice_count: 3,
    });
    const out = dedupeExplanations(ranked);
    const fish = out.filter((r) => r.meal.tags.includes("fish"));
    expect(fish).toHaveLength(2);
    expect(fish.every((r) => r.explanation.label === "Matches your likes")).toBe(true);
    expect(fish[0].explanation.line).toBe("You said you like fish dinners.");
    expect(fish[1].explanation.line).toBe("Same like, different dish: fish dinners.");
  });

  it("a fresh HH001-style plan has distinct labels and no 'Why this' prefix", () => {
    const ranked = buildRankedChoiceSet({
      constraints: [
        { rule_key: "dairy", status: "prohibited", member_id: "m1" },
        { rule_key: "meat", status: "prohibited", member_id: "m1" },
        { rule_key: "shellfish", status: "prohibited", member_id: "m1" },
        { rule_key: "nuts", status: "prohibited", member_id: "m1" },
      ],
      evidence: [],
      ratings: [],
      recent_recipe_slugs: [],
      settings: { meal_choice_count: 3, prefs: {} },
      active_member_count: 2,
    });
    expect(ranked.length).toBe(3);
    const labels = ranked.map((r) => r.explanation.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const r of ranked) {
      expect(r.explanation.label).not.toMatch(/^why this/i);
      expect(r.explanation.line).not.toMatch(/Worth another round/i);
    }
  });
});
