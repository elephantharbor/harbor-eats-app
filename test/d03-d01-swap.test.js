import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { CLASSIFICATION_BACKFILL } from "../src/lib/classification-backfill.js";
import { preferenceTier } from "../src/lib/classification.js";
import {
  contentHash,
  culinaryHashPayload,
  normalizeFactoryPackage,
  normalizeLegacyPackage,
  planImport,
} from "../src/lib/catalog-import.js";
import { applyCatalogWrites, loadExistingVersions, retireCatalogVersions } from "../src/lib/catalog-write.js";
import { loadPublishedCatalog } from "../src/lib/catalog-runtime.js";
import { planDinners, swapSlot } from "../src/lib/dinner-planner.js";
import { parsePlanIntent } from "../src/lib/plan-contract.js";
import { applyPlanMutation, createDinnerPlan } from "../src/lib/plan-mutations.js";
import { loadCatalogRecordsForTest } from "./helpers/catalog-import-fixture.js";

const root = join(process.cwd(), "catalog");

function sqliteShim(database) {
  return {
    prepare(sql) {
      const stmt = database.prepare(sql);
      return {
        bind(...params) {
          return {
            run: async () => {
              stmt.run(...params);
              return { success: true };
            },
            first: async () => stmt.get(...params) || null,
            all: async () => ({ results: stmt.all(...params) }),
          };
        },
      };
    },
  };
}

function applyMigrations(database) {
  database.exec("PRAGMA foreign_keys = ON;");
  const dir = join(process.cwd(), "migrations");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, name), "utf8"));
  }
}

function mealEntry(slug, effort, complexity, extra = {}) {
  return {
    concept: {
      concept_id: slug,
      title: extra.title || slug,
      cuisine: extra.cuisine || "american",
      primary_ingredient: extra.ingredient || "beans",
      tags: extra.tags || [],
      current_version: { methods: extra.methods || [] },
    },
    pkg: {
      recipe_id: `rcp_${slug}`,
      recipe_version_id: extra.recipe_version_id || `rv_${slug}_v1`,
      version_number: 1,
      title: extra.title || slug,
      total_minutes: extra.minutes ?? 40,
      effort_level: effort,
      ingredient_complexity: complexity,
      vocabulary_tag_ids: extra.tags || [],
      ingredients: extra.ingredients || [{ name: "salt", note: null }],
      allergens: extra.allergens || [],
      equipment: [],
    },
  };
}

function intent(overrides = {}) {
  return parsePlanIntent({
    dinner_count: 1,
    entry_point: "plan_dinners",
    participant_ids: ["ana"],
    meal_styles: [],
    practical_hints: [],
    ...overrides,
  }).intent;
}

describe("D-03 classification", () => {
  it("locks the Vale prep-r2 distribution on the current packages", () => {
    const rows = Object.values(CLASSIFICATION_BACKFILL);
    expect(rows).toHaveLength(50);
    const effort = { easy: 0, moderate: 0, involved: 0 };
    const complexity = { simple: 0, standard: 0, adventurous: 0 };
    for (const row of rows) {
      effort[row.effort_level] += 1;
      complexity[row.ingredient_complexity] += 1;
      const pkg = JSON.parse(readFileSync(join(root, row.recipe_version_id.replace(/^rv_/, "").replace(/_v\d+$/, ""), `${row.recipe_version_id.endsWith("_v2") ? "v2" : "v1"}.json`), "utf8"));
      expect(pkg.recipe_version.effort_level).toBe(row.effort_level);
      expect(pkg.recipe_version.ingredient_complexity).toBe(row.ingredient_complexity);
      expect(pkg.recipe_version.effort).toBeUndefined();
      expect(pkg.recipe_version.complexity).toBeUndefined();
      expect(pkg.dish.effort_band).toBeUndefined();
    }
    expect(effort).toEqual({ easy: 16, moderate: 29, involved: 5 });
    expect(complexity).toEqual({ simple: 22, standard: 26, adventurous: 2 });
  });

  it("keeps the culinary hash stable when only classification changes", () => {
    const path = join(root, "cider-braised-pork-shoulder/v1.json");
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    const sidecar = { source_path: "catalog/cider-braised-pork-shoulder/v1.json", freeze_integrity: "not_in_package" };
    const published = normalizeFactoryPackage(pkg, sidecar, { publicationStatus: "published" });
    expect(published.ok, JSON.stringify(published.errors)).toBe(true);
    const same = structuredClone(pkg);
    same.recipe_version.effort_level = "easy";
    const relabeled = normalizeFactoryPackage(same, sidecar, { publicationStatus: "published" });
    expect(relabeled.ok).toBe(true);
    expect(relabeled.record.content_hash).toBe(published.record.content_hash);
    expect(contentHash(culinaryHashPayload(relabeled.record))).toBe(published.record.content_hash);
    expect(relabeled.record.classification_hash).not.toBe(published.record.classification_hash);
    const cooked = structuredClone(pkg);
    cooked.recipe_version.ingredients = cooked.recipe_version.ingredients.map((item, index) =>
      index === 0 ? { ...item, name: `${item.name} extra` } : item
    );
    const changed = normalizeFactoryPackage(cooked, sidecar, { publicationStatus: "published" });
    expect(changed.ok).toBe(true);
    expect(changed.record.content_hash).not.toBe(published.record.content_hash);
  });

  it("requires enums on published meals and still accepts a retired legacy file", () => {
    const factoryPath = join(root, "cider-braised-pork-shoulder/v1.json");
    const factory = JSON.parse(readFileSync(factoryPath, "utf8"));
    const sidecar = { source_path: "catalog/cider-braised-pork-shoulder/v1.json", freeze_integrity: "not_in_package" };
    const missing = structuredClone(factory);
    delete missing.recipe_version.effort_level;
    const rejected = normalizeFactoryPackage(missing, sidecar, { publicationStatus: "published" });
    expect(rejected.ok).toBe(false);
    expect(rejected.errors.some((error) => error.code === "bad_effort_level")).toBe(true);
    const obsolete = structuredClone(factory);
    obsolete.recipe_version.effort = "long";
    const legacyKey = normalizeFactoryPackage(obsolete, sidecar, { publicationStatus: "published" });
    expect(legacyKey.errors.some((error) => error.code === "obsolete_effort")).toBe(true);
    const v1 = JSON.parse(readFileSync(join(root, "chipotle-lime-black-bean-bowls/v1.json"), "utf8"));
    const retired = normalizeLegacyPackage(
      v1,
      { source_path: "catalog/chipotle-lime-black-bean-bowls/v1.json" },
      { publicationStatus: "retired" }
    );
    expect(retired.ok, JSON.stringify(retired.errors)).toBe(true);
    expect(retired.record.effort).toBeUndefined();
    expect(retired.record.effort_level).toBeNull();
  });
});

describe("D-01 planning preferences", () => {
  const catalog = [
    mealEntry("easy-simple", "easy", "simple", { cuisine: "mexican", tags: ["mexican", "tacos"] }),
    mealEntry("easy-standard", "easy", "standard", { cuisine: "italian" }),
    mealEntry("moderate-simple", "moderate", "simple", { cuisine: "indian" }),
    mealEntry("moderate-standard", "moderate", "standard", { cuisine: "thai" }),
    mealEntry("involved-standard", "involved", "standard", { cuisine: "vietnamese" }),
    mealEntry("walnut-easy", "easy", "simple", {
      cuisine: "italian",
      tags: ["nuts"],
      allergens: ["nuts"],
      ingredients: [{ name: "walnut", note: null }],
    }),
  ];

  it("leaves ranking unchanged when both preferences are off", () => {
    const off = planDinners(intent({ dinner_count: 1 }), { catalog, constraints: [], tastes: [] });
    const bare = planDinners(
      {
        dinner_count: 1,
        entry_point: "plan_dinners",
        participant_ids: ["ana"],
        meal_styles: [],
        practical_hints: [],
      },
      { catalog, constraints: [], tastes: [] }
    );
    expect(off.slots[0].recipe_slug).toBe(bare.slots[0].recipe_slug);
    expect(off.preference_relaxations).toEqual([]);
  });

  it("prefers easy, then moderate, and admits involved only when the easier pool is used up", () => {
    const easy = planDinners(intent({ dinner_count: 3, keep_it_easy: true }), {
      catalog: catalog.filter((entry) => entry.concept.concept_id !== "walnut-easy"),
      constraints: [],
      tastes: [],
    });
    expect(easy.slots.map((slot) => slot.effort_level)).toEqual(["easy", "easy", "moderate"]);
    expect(easy.slots[2].preference_relaxed).toBe(true);
    const thin = planDinners(intent({ dinner_count: 2, keep_it_easy: true }), {
      catalog: [
        mealEntry("only-easy", "easy", "standard"),
        mealEntry("mod-a", "moderate", "standard"),
        mealEntry("hard", "involved", "standard"),
      ],
      constraints: [],
      tastes: [],
    });
    expect(thin.slots.map((slot) => slot.effort_level)).toEqual(["easy", "moderate"]);
  });

  it("relaxes both preferences in effort-major order and still refuses a hard limit", () => {
    expect(preferenceTier("easy", "simple", { keep_it_easy: true, keep_ingredients_simple: true })).toBe(0);
    expect(preferenceTier("easy", "standard", { keep_it_easy: true, keep_ingredients_simple: true })).toBe(1);
    expect(preferenceTier("moderate", "simple", { keep_it_easy: true, keep_ingredients_simple: true })).toBe(3);
    const both = planDinners(intent({ dinner_count: 4, keep_it_easy: true, keep_ingredients_simple: true }), {
      catalog: catalog.filter((entry) => entry.concept.concept_id !== "walnut-easy"),
      constraints: [],
      tastes: [],
    });
    expect(both.slots.map((slot) => `${slot.effort_level}|${slot.ingredient_complexity}`)).toEqual([
      "easy|simple",
      "easy|standard",
      "moderate|simple",
      "moderate|standard",
    ]);
    const blocked = planDinners(intent({ dinner_count: 1, keep_it_easy: true }), {
      catalog: [catalog.find((entry) => entry.concept.concept_id === "walnut-easy"), mealEntry("mod", "moderate", "standard")],
      constraints: [{ member_id: "ana", rule_key: "nuts", status: "prohibited" }],
      tastes: [],
    });
    expect(blocked.slots[0].recipe_slug).toBe("mod");
    const five = planDinners(intent({ dinner_count: 5, keep_it_easy: true }), {
      catalog: ["a", "b", "c", "d", "e"].map((slug, index) =>
        mealEntry(`easy-${slug}`, "easy", "simple", { cuisine: ["mexican", "italian", "indian", "thai", "japanese"][index] })
      ),
      constraints: [],
      tastes: [],
    });
    expect(new Set(five.slots.map((slot) => slot.recipe_slug)).size).toBe(5);
  });

  it("keeps a requested ingredient ahead of an easier meal", () => {
    const planned = planDinners(
      intent({
        dinner_count: 1,
        keep_it_easy: true,
        requested_ingredient: "salmon",
      }),
      {
        catalog: [
          mealEntry("easy-beans", "easy", "simple", { ingredient: "beans", tags: ["beans"] }),
          mealEntry("moderate-salmon", "moderate", "standard", { ingredient: "salmon", tags: ["salmon"] }),
        ],
        constraints: [],
        tastes: [],
      }
    );
    expect(planned.slots[0].recipe_slug).toBe("moderate-salmon");
  });

  it("stores planning preferences on the run and does not rewrite chosen meals", () => {
    const ctx = {
      catalog: catalog.filter((entry) => entry.concept.concept_id !== "walnut-easy"),
      versions: {},
      constraints: [],
      tastes: [],
      household_member_ids: ["ana"],
      actor_member_id: "ana",
      now: "2026-10-06T17:00:00.000Z",
      id: (prefix) => `${prefix}_fixed`,
    };
    for (const entry of ctx.catalog) ctx.versions[entry.pkg.recipe_version_id] = entry;
    const created = createDinnerPlan(
      {
        household_id: "hh",
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: ["ana"],
        fill: "planner",
        keep_it_easy: true,
      },
      ctx
    );
    expect(created.ok, JSON.stringify(created)).toBe(true);
    expect(created.plan.intent.keep_it_easy).toBe(true);
    expect(created.plan.meals[0].effort_level).toBe("easy");
    const version = created.plan.meals[0].recipe_version_id;
    const toggled = applyPlanMutation(
      created.plan,
      { op: "set_planning_preferences", keep_it_easy: false, keep_ingredients_simple: true },
      ctx
    );
    expect(toggled.ok).toBe(true);
    expect(toggled.plan.meals[0].recipe_version_id).toBe(version);
    expect(toggled.plan.intent.keep_ingredients_simple).toBe(true);
    const swapped = swapSlot(
      toggled.plan.meals.map((meal) => ({
        position: meal.position,
        recipe_slug: meal.recipe_slug,
        recipe_version_id: meal.recipe_version_id,
        participant_ids: meal.participant_ids,
      })),
      0,
      { ...ctx, intent: toggled.plan.intent }
    );
    expect(swapped.ok).toBe(true);
    expect(swapped.slots[0].ingredient_complexity).toBe("simple");
  });
});

describe("swap version resolution", () => {
  it("previews published D1 version ids and refuses a retired v1", async () => {
    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    const { records, retireVersionIds } = loadCatalogRecordsForTest();
    const shim = sqliteShim(database);
    const plan = planImport(await loadExistingVersions(shim), records);
    expect(plan.ok, JSON.stringify(plan)).toBe(true);
    await applyCatalogWrites(shim, plan.writes, "2026-10-06T17:00:00.000Z");
    await retireCatalogVersions(shim, [...new Set(retireVersionIds)]);
    const loaded = await loadPublishedCatalog(shim);
    expect(loaded.ok, loaded.detail).toBe(true);
    expect(loaded.count).toBe(75);
    const miso = loaded.planner.find((entry) => entry.concept.concept_id === "miso-ginger-salmon");
    const salmon = loaded.planner.find((entry) => entry.concept.concept_id === "maple-mustard-glazed-salmon");
    const preview = planDinners(intent({ dinner_count: 2 }), {
      catalog: [miso, salmon],
      constraints: [],
      tastes: [],
    });
    expect(preview.slots.map((slot) => slot.recipe_version_id).sort()).toEqual([
      "rv_maple-mustard-glazed-salmon_v2",
      "rv_miso-ginger-salmon_v2",
    ]);
    const ctx = {
      catalog: loaded.planner,
      versions: loaded.versionsById,
      constraints: [],
      tastes: [],
      household_member_ids: ["ana"],
      actor_member_id: "ana",
      now: "2026-10-06T17:00:00.000Z",
      id: (prefix) => `${prefix}_d1`,
    };
    const created = createDinnerPlan(
      {
        household_id: "hh",
        meal_count: 2,
        entry_point: "plan_dinners",
        participant_ids: ["ana"],
        meals: [
          { kind: "recipe", recipe_version_id: miso.pkg.recipe_version_id, participant_ids: ["ana"] },
          { kind: "recipe", recipe_version_id: salmon.pkg.recipe_version_id, participant_ids: ["ana"] },
        ],
      },
      ctx
    );
    expect(created.ok, JSON.stringify(created)).toBe(true);
    const first = created.plan.meals[0];
    const secondId = created.plan.meals[1].recipe_version_id;
    const swapped = applyPlanMutation(
      created.plan,
      { op: "swap_meal", meal_id: first.meal_id, recipe_version_id: salmon.pkg.recipe_version_id },
      ctx
    );
    expect(swapped.ok, JSON.stringify(swapped)).toBe(true);
    expect(swapped.plan.meals[0].recipe_version_id).toBe(salmon.pkg.recipe_version_id);
    expect(swapped.plan.meals[0].meal_id).toBe(first.meal_id);
    expect(swapped.plan.meals[1].recipe_version_id).toBe(secondId);
    const retired = applyPlanMutation(
      created.plan,
      { op: "swap_meal", meal_id: first.meal_id, recipe_version_id: "rv_miso-ginger-salmon_v1" },
      ctx
    );
    expect(retired.ok).toBe(false);
    expect(retired.error).toBe("unknown_recipe");
    database.close();
  });
});

describe("swap sheet lifecycle", () => {
  it("closes on keep and escape without a mutation, and keeps a failure inside the sheet", () => {
    const code = readFileSync(new URL("../public/planning-ui.js", import.meta.url), "utf8");
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    const reduce = sandbox.window.FlavorWeavePlanning.swapSheetReduce;
    let state = reduce(null, { type: "open", mealId: "dinner-2" });
    state = reduce(state, { type: "keep" });
    expect(state).toMatchObject({ open: false, mutated: false, toast: false });
    state = reduce({ open: true, mutated: false, toast: false, error: null, mealId: "dinner-2" }, { type: "escape" });
    expect(state.mutated).toBe(false);
    expect(state.open).toBe(false);
    state = reduce({ open: true, mutated: false, toast: false, error: null, mealId: "dinner-2" }, { type: "fail" });
    expect(state).toMatchObject({ open: true, mutated: false, toast: false });
    expect(state.error).toBeTruthy();
    state = reduce(state, { type: "success" });
    expect(state).toMatchObject({ open: false, mutated: true, toast: true });
  });
});
