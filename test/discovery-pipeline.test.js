import { describe, expect, it } from "vitest";
import { preferenceTier } from "../src/lib/classification.js";
import { PIPELINE_STAGES } from "../src/discovery/constants.js";
import { discoveryMeal, projectDiscoveryMeal } from "../src/discovery/meal.js";
import { runDiscoveryPipeline } from "../src/discovery/pipeline.js";
import { normalizeQuery } from "../src/discovery/query.js";
import { softPreferenceFor } from "../src/discovery/soft-prefs.js";

function meal(partial) {
  return discoveryMeal(partial);
}

function run(meals, queryInput = {}, context = {}, deps = {}) {
  const normalized = normalizeQuery(queryInput);
  if (!normalized.ok) throw new Error(normalized.error);
  const soft = context.soft || (normalized.query.soft_provided ? normalized.query.soft : normalized.query.soft);
  return runDiscoveryPipeline(meals, normalized.query, {
    mode: "standalone",
    participant_ids: ["m1"],
    exclude_slugs: [],
    plan_slugs: [],
    recent_slugs: [],
    constraints: [],
    tastes: [],
    ...context,
    soft,
  }, {
    isEligible: () => ({ eligible: true }),
    ...deps,
  });
}

describe("discovery pipeline", () => {
  it("runs the eight stages in order", () => {
    const result = run([meal({ recipe_slug: "soup", title: "Soup", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 20 })]);
    expect(result.stages).toEqual([...PIPELINE_STAGES]);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].primary_reason).toBe("eligible_catalog_fit");
    expect(result.results[0].recipe_version_id).toBe("rv_soup_v2");
    expect(result.results[0].entry).toBeUndefined();
  });

  it("drops a hard-ineligible title match before the text stage", () => {
    const result = run(
      [
        meal({ recipe_slug: "tacos", title: "Tacos", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 20 }),
        meal({ recipe_slug: "soup", title: "Soup", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 20 }),
      ],
      { text: "taco" },
      {},
      { isEligible: (item) => ({ eligible: item.recipe_slug !== "tacos" }) }
    );
    expect(result.results).toEqual([]);
    expect(result.excluded.find((row) => row.recipe_slug === "tacos").code).toBe("ineligible_hard_limit");
    expect(result.excluded.find((row) => row.recipe_slug === "tacos").stage).toBe("hard_eligibility");
    expect(result.excluded.find((row) => row.recipe_slug === "soup").code).toBe("text_miss");
  });

  it("treats an explicit Easy filter as a hard drop and Keep it easy as a soft tier", () => {
    const meals = [
      meal({ recipe_slug: "slow-easy", title: "Sheet Pan Chicken", effort_level: "easy", ingredient_complexity: "standard", total_minutes: 60 }),
      meal({ recipe_slug: "fast-moderate", title: "Stir Fry", effort_level: "moderate", ingredient_complexity: "simple", total_minutes: 20 }),
    ];
    const hard = run(meals, { criteria: { effort_levels: ["easy"] } }, { soft: { keep_it_easy: false, keep_ingredients_simple: false } }, {
      scoreTaste: (item) => ({ score: item.recipe_slug === "fast-moderate" ? 5 : 0, hits: [] }),
    });
    expect(hard.results.map((row) => row.recipe_slug)).toEqual(["slow-easy"]);
    expect(hard.excluded.find((row) => row.recipe_slug === "fast-moderate").code).toBe("explicit_effort");
    expect(hard.results[0].reasons).toContain("explicit_effort");
    expect(hard.results[0].reasons).not.toContain("soft_keep_easy");

    const soft = run(meals, {}, { soft: { keep_it_easy: true, keep_ingredients_simple: false } }, {
      scoreTaste: (item) => ({ score: item.recipe_slug === "fast-moderate" ? 5 : 0, hits: [] }),
    });
    expect(soft.results.map((row) => row.recipe_slug)).toEqual(["slow-easy", "fast-moderate"]);
    expect(soft.results[0].reasons).toContain("soft_keep_easy");
    expect(soft.results[0].preference_tier).toBe(0);
    expect(soft.results[1].preference_relaxed).toBe(true);
    expect(soft.results[1].reasons).toContain("soft_pref_relaxed");
    expect(soft.excluded).toEqual([]);
  });

  it("keeps Quick on the clock and Simple off the pantry", () => {
    const meals = [
      meal({
        recipe_slug: "slow-easy",
        title: "Sheet Pan Chicken",
        effort_level: "easy",
        ingredient_complexity: "simple",
        total_minutes: 60,
        ingredient_ids: ["chicken", "potato"],
      }),
      meal({
        recipe_slug: "fast-moderate",
        title: "Stir Fry",
        effort_level: "moderate",
        ingredient_complexity: "standard",
        total_minutes: 20,
        ingredient_ids: ["tofu"],
      }),
    ];
    const quick = run(meals, { criteria: { quick: true } });
    expect(quick.results.map((row) => row.recipe_slug)).toEqual(["fast-moderate"]);
    expect(quick.excluded.find((row) => row.recipe_slug === "slow-easy").code).toBe("explicit_quick");

    const easy = run(meals, { criteria: { effort_levels: ["easy"] } });
    expect(easy.results.map((row) => row.recipe_slug)).toEqual(["slow-easy"]);
    expect(easy.results[0].total_minutes).toBe(60);

    const simple = run(meals, { criteria: { ingredient_complexities: ["simple"] } });
    expect(simple.results.map((row) => row.recipe_slug)).toEqual(["slow-easy"]);
    expect(simple.results[0].ingredient_ids).toBeUndefined();
    expect(simple.excluded.find((row) => row.recipe_slug === "fast-moderate").code).toBe("explicit_complexity");
    expect(JSON.stringify(simple.excluded)).not.toContain("pantry");
  });

  it("orders both D-01 chips with the shared preference tier", () => {
    const prefs = { keep_it_easy: true, keep_ingredients_simple: true };
    const meals = [
      meal({ recipe_slug: "aaa-involved", effort_level: "involved", ingredient_complexity: "adventurous", total_minutes: 90 }),
      meal({ recipe_slug: "mmm-easy-standard", effort_level: "easy", ingredient_complexity: "standard", total_minutes: 40 }),
      meal({ recipe_slug: "zzz-easy-simple", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 25 }),
    ];
    const result = run(meals, {}, { soft: prefs });
    expect(result.results.map((row) => row.recipe_slug)).toEqual([
      "zzz-easy-simple",
      "mmm-easy-standard",
      "aaa-involved",
    ]);
    expect(result.results.map((row) => row.preference_tier)).toEqual([
      preferenceTier("easy", "simple", prefs),
      preferenceTier("easy", "standard", prefs),
      preferenceTier("involved", "adventurous", prefs),
    ]);
    expect(softPreferenceFor(meals[2], prefs).preference_tier).toBe(0);
  });

  it("lowers a less-often taste and still returns the meal", () => {
    const meals = [
      meal({ recipe_slug: "spicy-stew", title: "Spicy Stew", vocabulary_tag_ids: ["spicy"], effort_level: "moderate", ingredient_complexity: "standard", total_minutes: 40 }),
      meal({ recipe_slug: "plain-soup", title: "Plain Soup", vocabulary_tag_ids: [], effort_level: "moderate", ingredient_complexity: "standard", total_minutes: 40 }),
    ];
    const result = run(meals, {}, {
      tastes: [{ member_id: "m1", vocabulary_slug: "spicy", rank: "less_often", stance: "explicit", data_origin: "household" }],
    });
    expect(result.results.map((row) => row.recipe_slug)).toEqual(["plain-soup", "spicy-stew"]);
    expect(result.excluded).toEqual([]);
    expect(result.results[1].reasons).toContain("taste_less_often");
    expect(result.results[1].taste_score).toBeLessThan(0);
  });

  it("uses the server eligibility helper for a dairy hard limit", () => {
    const cream = projectDiscoveryMeal({
      concept: { concept_id: "cream-pasta", title: "Cream Pasta", tags: ["dairy"], cuisine: "american" },
      pkg: {
        dish_id: "cream-pasta",
        recipe_version_id: "rv_cream_v2",
        recipe_id: "rcp_cream",
        title: "Cream Pasta",
        vocabulary_tag_ids: [],
        allergens: ["dairy"],
        ingredients: [{ name: "cream" }],
        total_minutes: 20,
        effort_level: "easy",
        ingredient_complexity: "simple",
      },
    });
    const tofu = projectDiscoveryMeal({
      concept: { concept_id: "tofu-tacos", title: "Tofu Tacos", tags: ["plant"], cuisine: "mexican" },
      pkg: {
        dish_id: "tofu-tacos",
        recipe_version_id: "rv_tofu_v2",
        recipe_id: "rcp_tofu",
        title: "Tofu Tacos",
        vocabulary_tag_ids: ["tofu"],
        allergens: [],
        ingredients: [{ name: "tofu" }],
        total_minutes: 25,
        effort_level: "easy",
        ingredient_complexity: "simple",
      },
    });
    const result = runDiscoveryPipeline(
      [cream, tofu],
      normalizeQuery({ text: "cream" }).query,
      {
        participant_ids: ["m1"],
        exclude_slugs: [],
        plan_slugs: [],
        recent_slugs: [],
        soft: { keep_it_easy: false, keep_ingredients_simple: false },
        constraints: [{ member_id: "m1", rule_key: "dairy", status: "prohibited" }],
        tastes: [],
      }
    );
    expect(result.results).toEqual([]);
    expect(result.excluded.find((row) => row.recipe_slug === "cream-pasta").code).toBe("ineligible_hard_limit");
    expect(result.excluded.find((row) => row.recipe_slug === "tofu-tacos").code).toBe("text_miss");
  });

  it("demotes a recent meal inside the taste band and does not drop it", () => {
    const meals = [
      meal({ recipe_slug: "recent-hit", title: "Recent", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 30, cuisine: "mexican" }),
      meal({ recipe_slug: "fresh-hit", title: "Fresh", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 30, cuisine: "korean" }),
    ];
    const inside = run(meals, {}, { recent_slugs: ["recent-hit"] }, {
      scoreTaste: (item) => ({ score: item.recipe_slug === "recent-hit" ? 5 : 4.6, hits: [] }),
    });
    expect(inside.results.map((row) => row.recipe_slug)).toEqual(["fresh-hit", "recent-hit"]);
    expect(inside.results[1].reasons).toContain("recent_demoted");

    const outside = run(meals, {}, { recent_slugs: ["recent-hit"] }, {
      scoreTaste: (item) => ({ score: item.recipe_slug === "recent-hit" ? 5 : 4, hits: [] }),
    });
    expect(outside.results.map((row) => row.recipe_slug)).toEqual(["recent-hit", "fresh-hit"]);
  });

  it("spreads cuisines inside the taste band without dropping a match", () => {
    const meals = [
      meal({ recipe_slug: "a", title: "A", cuisine: "mexican", primary_ingredient: "beans", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 30 }),
      meal({ recipe_slug: "b", title: "B", cuisine: "mexican", primary_ingredient: "beans", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 30 }),
      meal({ recipe_slug: "c", title: "C", cuisine: "korean", primary_ingredient: "tofu", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 30 }),
    ];
    const scores = { a: 2, b: 1.9, c: 1.6 };
    const result = run(meals, {}, {}, {
      scoreTaste: (item) => ({ score: scores[item.recipe_slug], hits: [] }),
    });
    expect(result.results.map((row) => row.recipe_slug)).toEqual(["a", "c", "b"]);
    expect(result.results.find((row) => row.recipe_slug === "c").reasons).toContain("diversity_preferred");
    expect(result.total).toBe(3);
  });

  it("hides the meal being replaced and still ranks the rest", () => {
    const meals = [
      meal({ recipe_slug: "tacos", title: "Tacos", effort_level: "easy", ingredient_complexity: "simple", total_minutes: 20 }),
      meal({ recipe_slug: "soup", title: "Soup", effort_level: "moderate", ingredient_complexity: "standard", total_minutes: 40 }),
    ];
    const result = run(meals, { text: "taco" }, { exclude_slugs: ["tacos"], plan_slugs: ["soup"] });
    expect(result.results).toEqual([]);
    expect(result.excluded.find((row) => row.recipe_slug === "tacos").code).toBe("excluded_slug");
    expect(result.excluded.find((row) => row.recipe_slug === "soup").code).toBe("text_miss");
  });
});
