import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { MEAL_CATALOG } from "../src/lib/meal-catalog.js";
import {
  TASTE_NUDGE,
  keepLiveMenuMeals,
  mealStaysOnLiveMenu,
  scoreDinerTastes,
  vocabularyTagsForSlug,
} from "../src/lib/diner-taste-rank.js";
import { buildCycle2Catalog } from "../src/lib/cycle2-catalog.js";
import {
  attributeTastesFromMealRating,
  combineTasteRanks,
  decideEligibility,
} from "../src/lib/preference-concepts.js";
import { buildRankedChoiceSet } from "../src/lib/recommendation-pipeline.js";
import { loadRecommendationContext, rankMealsForHousehold } from "../src/lib/recommendations.js";
import {
  canRecommend,
  createHouseholdVariation,
  projectLegacyCatalog,
} from "../src/lib/recipe-package.js";
import { getConceptBySlug } from "../src/lib/recipe-store.js";
import { applyTasteChanges } from "../src/lib/taste-profile.js";
import { scoreMealsForHousehold } from "../src/lib/taste-model.js";

const meal = (slug) => MEAL_CATALOG.find((row) => row.recipe_slug === slug);
const TOFU = "crispy-chipotle-tofu-tacos";
const SOUP = "white-bean-kale-soup";
const SKILLET = "moroccan-chickpea-skillet";
const SALMON = "miso-ginger-salmon";
const FISH_TACOS = "crispy-fish-tacos-cabbage-slaw";
const SHRIMP = "lemon-garlic-shrimp-pasta";

function taste(memberId, slug, rank, extra = {}) {
  return {
    member_id: memberId,
    vocabulary_slug: slug,
    rank,
    stance: "explicit",
    data_origin: "household",
    ...extra,
  };
}

function place(dinerTastes) {
  return scoreMealsForHousehold({
    meals: [meal(TOFU), meal(SOUP), meal(SKILLET)],
    evidence: [],
    ratings: [],
    meal_choice_count: 3,
    diner_tastes: dinerTastes,
  });
}

function row(ranked, slug) {
  return ranked.find((item) => item.meal.recipe_slug === slug);
}

function indexOf(ranked, slug) {
  return ranked.findIndex((item) => item.meal.recipe_slug === slug);
}

describe("diner_taste changes Tonight's order", () => {
  it("uses the Cycle 2 package vocabulary, including tags the old sparks do not name", () => {
    const legacy = Object.fromEntries(
      projectLegacyCatalog().map((pkg) => [pkg.dish_id, pkg.vocabulary_tag_ids])
    );
    for (const pkg of buildCycle2Catalog()) {
      expect(pkg.vocabulary_tag_ids).toEqual(legacy[pkg.dish_id]);
      expect(pkg.kitchen_tested).toBe(false);
    }
    expect(vocabularyTagsForSlug(TOFU)).toEqual(["citrusy", "crispy", "mexican", "smoky", "tacos", "tofu"]);
    expect(vocabularyTagsForSlug(TOFU)).toContain("mexican");
    expect(vocabularyTagsForSlug(SALMON)).toContain("salmon");
    expect(vocabularyTagsForSlug(FISH_TACOS)).not.toContain("salmon");
    expect(vocabularyTagsForSlug(SHRIMP)).toContain("shrimp");
    expect(Object.values(legacy).some((tags) => tags.includes("korean"))).toBe(false);
  });

  it("nudges Love above Like, and sorts Less often down without dropping the meal", () => {
    const plain = place([]);
    const loved = place([taste("ana", "tacos", "love")]);
    const liked = place([taste("ana", "tacos", "like")]);
    const less = place([taste("ana", "tacos", "less_often")]);

    expect(row(loved, TOFU).total - row(plain, TOFU).total).toBeCloseTo(TASTE_NUDGE.love);
    expect(row(liked, TOFU).total - row(plain, TOFU).total).toBeCloseTo(TASTE_NUDGE.like);
    expect(row(less, TOFU).total - row(plain, TOFU).total).toBeCloseTo(TASTE_NUDGE.less_often);
    expect(TASTE_NUDGE.love).toBeGreaterThan(TASTE_NUDGE.like);
    expect(TASTE_NUDGE.like).toBeGreaterThan(0);
    expect(TASTE_NUDGE.less_often).toBeLessThan(0);

    expect(row(loved, SOUP).total).toBeCloseTo(row(plain, SOUP).total);
    expect(indexOf(loved, TOFU)).toBeLessThan(indexOf(less, TOFU));
    expect(less.map((item) => item.meal.recipe_slug)).toContain(TOFU);
    expect(row(less, TOFU).factors.eligible).toBe(true);
    expect(row(less, TOFU).factors.diner_taste_excludes).toBe(false);
    expect(row(loved, TOFU).explanation.line).toMatch(/You told us you love Tacos/);
    expect(row(loved, TOFU).explanation.line).not.toMatch(/ban|hard limit|average/i);
    expect(row(less, TOFU).explanation.line).not.toMatch(/ban|won't show|excluded|taken off the menu/i);
    expect(row(less, TOFU).explanation.line).not.toMatch(/less often removes|hard limit written/i);
  });

  it("keeps each diner's rank instead of averaging the household", () => {
    const one = scoreDinerTastes(meal(TOFU), [taste("ana", "tacos", "love")]);
    const two = scoreDinerTastes(meal(TOFU), [taste("ana", "tacos", "love"), taste("ben", "tacos", "love")]);
    const split = scoreDinerTastes(meal(TOFU), [
      taste("ana", "tacos", "love"),
      taste("ben", "tacos", "less_often"),
    ]);
    expect(two.score).toBeCloseTo(one.score * 2);
    expect(two.averaged).toBe(false);
    expect(two.member_count).toBe(2);
    expect(split.hits.map((hit) => hit.rank).sort()).toEqual(["less_often", "love"]);
    expect(split.score).toBeCloseTo(TASTE_NUDGE.love + TASTE_NUDGE.less_often);
    expect(split.score).not.toBeCloseTo((TASTE_NUDGE.love + TASTE_NUDGE.less_often) / 2);
    expect(() => combineTasteRanks()).toThrow(/one diner/);
  });

  it("does not invent matches for a taste the catalog does not carry", () => {
    const ranked = place([taste("ana", "korean", "love")]);
    expect(ranked.every((item) => item.factors.diner_taste_nudge === 0)).toBe(true);
    expect(ranked.map((item) => item.factors.diner_taste_hits)).toEqual([[], [], []]);
    expect(JSON.stringify(ranked.map((item) => item.explanation))).not.toMatch(/korean/i);
  });

  it("does not treat a salmon love as a love of every fish dish", () => {
    expect(scoreDinerTastes(meal(FISH_TACOS), [taste("ana", "salmon", "love")]).score).toBe(0);
    expect(scoreDinerTastes(meal(SALMON), [taste("ana", "salmon", "love")]).score).toBeCloseTo(TASTE_NUDGE.love);
  });

  it("ignores synthetic and unproven rows and lets explicit beat inferred", () => {
    expect(scoreDinerTastes(meal(TOFU), [taste("ana", "tacos", "love", { data_origin: "synthetic" })]).score).toBe(0);
    expect(scoreDinerTastes(meal(TOFU), [taste("ana", "tacos", "love", { data_origin: "unproven" })]).score).toBe(0);
    expect(scoreDinerTastes(meal(TOFU), [taste("ana", "tacos", "love", { data_origin: undefined })]).score).toBe(0);
    const both = scoreDinerTastes(meal(TOFU), [
      taste("ana", "tacos", "love"),
      taste("ana", "tacos", "less_often", { stance: "inferred", confidence: 0.4 }),
    ]);
    expect(both.hits).toEqual([expect.objectContaining({ rank: "love", stance: "explicit", excludes: false })]);
    expect(both.hits[0].confidence).toBeUndefined();
    expect(attributeTastesFromMealRating({ score: 10, recipe_slug: TOFU })).toEqual([]);
    const fromRating = scoreMealsForHousehold({
      meals: [meal(TOFU), meal(SALMON)],
      evidence: [],
      ratings: [{ recipe_slug: TOFU, score: 10, tags: ["tofu", "tacos", "plant", "salmon"], member_id: "ana" }],
      meal_choice_count: 3,
      diner_tastes: [],
    });
    expect(fromRating.every((item) => item.factors.diner_taste_hits.length === 0)).toBe(true);
  });

  it("lets a hard limit remove a loved meal, and leaves Less often eligible", () => {
    const limits = [{ member_id: "ana", rules: [{ id: "no_shellfish" }] }];
    const recipe = { vocabulary_tag_ids: ["shrimp"], allergens: ["shellfish"] };
    const loved = decideEligibility({
      limits,
      recipe,
      tastes: [taste("ana", "shrimp", "love")],
    });
    const less = decideEligibility({
      limits: [{ member_id: "ana", rules: [] }],
      recipe: { vocabulary_tag_ids: ["tacos"] },
      tastes: [taste("ana", "tacos", "less_often")],
    });
    expect(loved.eligible).toBe(false);
    expect(less.eligible).toBe(true);

    const constraints = [{ member_id: "ana", rule_key: "shellfish", status: "prohibited" }];
    const snapshot = structuredClone(constraints);
    const ranked = buildRankedChoiceSet({
      settings: { meal_choice_count: 5, prefs: {} },
      constraints,
      evidence: [],
      ratings: [],
      recent_recipe_slugs: [],
      active_member_count: 1,
      diner_tastes: [taste("ana", "shrimp", "love")],
    });
    expect(ranked.map((item) => item.meal.recipe_slug)).not.toContain(SHRIMP);
    expect(constraints).toEqual(snapshot);
    expect(ranked.every((item) => item.factors.diner_taste_excludes === false)).toBe(true);
  });

  it("keeps recipe-store meals and refuses unpublished, draft, invalid, and household packages", () => {
    expect(keepLiveMenuMeals(MEAL_CATALOG)).toHaveLength(MEAL_CATALOG.length);
    expect(keepLiveMenuMeals(projectLegacyCatalog())).toEqual([]);
    const prepared = buildCycle2Catalog()[0];
    const stripped = { ...prepared };
    delete stripped._catalog_blockers;
    delete stripped._compound_warnings;
    delete stripped._duplicate_warnings;
    expect(canRecommend(stripped)).toBe(true);
    expect(mealStaysOnLiveMenu({ ...stripped, publication_status: "draft" })).toBe(false);
    expect(mealStaysOnLiveMenu({ ...stripped, publication_status: "invalid" })).toBe(false);
    expect(mealStaysOnLiveMenu({ ...stripped, publication_status: "unpublished" })).toBe(false);
    const variation = createHouseholdVariation(stripped, {
      household_id: "hh_private",
      data_origin: "household",
    });
    expect(variation.kitchen_tested).toBe(false);
    const kept = keepLiveMenuMeals([variation, meal(SOUP)]);
    expect(kept.map((item) => item.recipe_slug)).toEqual([SOUP]);

    const live = buildRankedChoiceSet({
      settings: { meal_choice_count: 3, prefs: {} },
      constraints: [],
      evidence: [],
      ratings: [],
      recent_recipe_slugs: [],
      active_member_count: 1,
      diner_tastes: [],
    });
    const slugs = new Set(MEAL_CATALOG.map((item) => item.recipe_slug));
    expect(live.every((item) => slugs.has(item.meal.recipe_slug))).toBe(true);
    expect(live.every((item) => item.meal.kitchen_tested !== true)).toBe(true);
  });
});

function d1(db) {
  const stmt = (sql, params = []) => ({
    bind: (...args) => stmt(sql, args),
    run: async () => {
      db.prepare(sql).run(...params);
      return { success: true };
    },
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    first: async () => db.prepare(sql).get(...params) ?? null,
  });
  return { prepare: (sql) => stmt(sql) };
}

function applyMigrations(db, lastPrefix) {
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    if (lastPrefix && name.startsWith(lastPrefix)) break;
  }
}

describe("recommendation load reads diner_taste from D1, not the client", () => {
  it("ranks a real household's Love and ignores synthetic, unproven, and unmatched tastes", async () => {
    const db = new DatabaseSync(":memory:");
    applyMigrations(db);
    db.exec("PRAGMA foreign_keys = ON");
    const ts = "2026-10-03T00:00:00Z";
    db.prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_real', 'Real kitchen', 'active', 'UTC', 2, 'organic', ?, ?, 'household')`
    ).run(ts, ts);
    db.prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_qa', 'QA kitchen', 'active', 'UTC', 2, 'synthetic_qa', ?, ?, 'synthetic')`
    ).run(ts, ts);
    for (const [householdId, memberId] of [["hh_real", "m_real"], ["hh_qa", "m_qa"]]) {
      db.prepare(
        `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
         VALUES (?, ?, 'Ana', 'member', 'active', ?, ?)`
      ).run(memberId, householdId, ts, ts);
    }
    const limitsBefore = db.prepare("SELECT COUNT(*) AS c FROM constraint_rule").get().c;
    const wrapped = d1(db);
    await applyTasteChanges(wrapped, {
      householdId: "hh_real",
      memberId: "m_real",
      dataOrigin: "household",
      changes: [
        { vocabulary_slug: "tacos", rank: "love" },
        { vocabulary_slug: "korean", rank: "love" },
        { vocabulary_slug: "bowls", rank: "less_often" },
      ],
    });
    await applyTasteChanges(wrapped, {
      householdId: "hh_real",
      memberId: "m_real",
      dataOrigin: "synthetic",
      changes: [{ vocabulary_slug: "crispy", rank: "love" }],
    });
    await applyTasteChanges(wrapped, {
      householdId: "hh_real",
      memberId: "m_real",
      dataOrigin: "unproven",
      changes: [{ vocabulary_slug: "pasta", rank: "like" }],
    });
    await applyTasteChanges(wrapped, {
      householdId: "hh_qa",
      memberId: "m_qa",
      dataOrigin: "household",
      changes: [{ vocabulary_slug: "tacos", rank: "love" }],
    });

    const ctx = await loadRecommendationContext(wrapped, "hh_real");
    expect(ctx.diner_tastes.map((row) => row.vocabulary_slug).sort()).toEqual(["bowls", "korean", "tacos"]);
    expect(ctx.diner_tastes.every((row) => row.data_origin === "household")).toBe(true);
    expect(ctx.diner_tastes.every((row) => row.confidence == null)).toBe(true);
    expect(JSON.stringify(ctx.diner_tastes)).not.toMatch(/confidence/);

    const qa = await loadRecommendationContext(wrapped, "hh_qa");
    expect(qa.diner_tastes).toEqual([]);

    const ranked = rankMealsForHousehold(ctx);
    expect(ranked.some((item) => item.factors.diner_taste_hits.some((hit) => hit.vocabulary_slug === "tacos"))).toBe(true);
    expect(ranked.every((item) => item.factors.diner_taste_hits.every((hit) => hit.vocabulary_slug !== "korean"))).toBe(true);
    expect(JSON.stringify(ranked.map((item) => item.explanation.line))).not.toMatch(/korean/i);
    expect(ranked.every((item) => item.factors.diner_taste_excludes === false)).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS c FROM constraint_rule").get().c).toBe(limitsBefore);

    const clientSaidLessOften = {
      ...ctx,
      client_tastes: [taste("m_real", "tacos", "less_often")],
    };
    const fromServer = rankMealsForHousehold(ctx);
    const fromClientField = rankMealsForHousehold(clientSaidLessOften);
    expect(fromClientField.map((item) => item.total)).toEqual(fromServer.map((item) => item.total));
  });

  it("still plans Tonight when migration 0010 has not created diner_taste", async () => {
    const db = new DatabaseSync(":memory:");
    applyMigrations(db, "0009");
    const ts = "2026-10-03T00:00:00Z";
    db.prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_old', 'Older kitchen', 'active', 'UTC', 2, 'organic', ?, ?, 'household')`
    ).run(ts, ts);
    const ctx = await loadRecommendationContext(d1(db), "hh_old");
    expect(ctx.diner_tastes).toEqual([]);
    expect(rankMealsForHousehold(ctx).length).toBeGreaterThanOrEqual(3);
  });
});
