import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { loadCatalogFromDisk } from "../src/lib/catalog-disk.js";
import { webpDimensions } from "../src/lib/freeze-integrity.js";
import { planImport } from "../src/lib/catalog-import.js";
import { loadPublishedCatalog } from "../src/lib/catalog-runtime.js";
import { applyCatalogWrites, loadExistingVersions, retireCatalogVersions } from "../src/lib/catalog-write.js";
import { assessCulinaryQuality } from "../src/lib/culinary-quality.js";
import { generateS08CatalogDelta, verifyS08CatalogDelta } from "../scripts/s08-catalog-delta.mjs";
import { assessMealEligibility } from "../src/lib/dinner-planner.js";
import { constraintRowsFromKeys } from "../src/lib/eligibility.js";
import { neededLines, scaleForDiners } from "../src/lib/ingredient-identity.js";
import { presentShopQuantity } from "../src/lib/shop-display.js";
import { createDinnerPlan, resolvedRecipe } from "../src/lib/plan-mutations.js";

const root = join(process.cwd(), "catalog");
const HH001 = constraintRowsFromKeys(["dairy", "meat", "poultry", "shellfish", "nuts", "cashew_ok"]);

function readPkg(slug, file) {
  return JSON.parse(readFileSync(join(root, slug, file), "utf8"));
}

function sqliteShim(database) {
  return {
    prepare(sql) {
      const stmt = database.prepare(sql);
      return {
        bind: (...params) => ({
          all: async () => ({ results: params.length ? stmt.all(...params) : stmt.all() }),
          first: async () => (params.length ? stmt.get(...params) : stmt.get()) || null,
          run: async () => {
            if (params.length) stmt.run(...params);
            else stmt.run();
            return { success: true };
          },
        }),
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

async function importCatalog(database) {
  const stagingPolicy = JSON.parse(readFileSync(join(root, "staging-publication.json"), "utf8"));
  const loaded = loadCatalogFromDisk(root, stagingPolicy);
  expect(loaded.failures, JSON.stringify(loaded.failures, null, 2)).toEqual([]);
  const shim = sqliteShim(database);
  const existing = await loadExistingVersions(shim);
  const plan = planImport(existing, loaded.records);
  expect(plan.ok, JSON.stringify(plan.errors)).toBe(true);
  await applyCatalogWrites(shim, plan.writes, "2026-10-18T00:00:00.000Z");
  await retireCatalogVersions(shim, [...new Set(loaded.retireVersionIds)]);
  return loaded;
}

describe("S-08 culinary objective checks", () => {
  it("rejects an unexplained do-not-add, an unsafe fish temperature, and an unnamed salt", () => {
    const ban = assessCulinaryQuality({
      dish: { title: "Example" },
      recipe_version: {
        base_servings: 4,
        ingredients: [{ name: "pasta", quantity: 12, unit: "oz" }],
        steps: [{ body: "Boil the pasta. Do not add salt.", ingredient_refs: ["pasta"] }],
      },
    });
    expect(ban.fails.map((item) => item.code)).toContain("unexplained_ban");

    const fish = assessCulinaryQuality({
      dish: { title: "Salmon" },
      recipe_version: {
        dietary_eligibility: { contains_finfish: true },
        ingredients: [{ name: "salmon fillets", quantity: 4, unit: "count" }],
        steps: [{ body: "Cook the salmon fillets to 125 F.", ingredient_refs: ["salmon fillets"] }],
      },
    });
    expect(fish.fails.map((item) => item.code)).toContain("unsafe_temperature");

    const salt = assessCulinaryQuality({
      dish: { title: "Eggs" },
      recipe_version: {
        ingredients: [{ name: "kosher salt", quantity: 1, unit: "tsp" }],
        steps: [{ body: "Season with the kosher salt.", ingredient_refs: ["kosher salt"] }],
      },
    });
    expect(salt.fails.map((item) => item.code)).toContain("salt_type");
  });

  it("warns when pasta is boiled with no salt ratio, and an override can cover that warning", () => {
    const bare = assessCulinaryQuality({
      dish: { title: "Noodles" },
      recipe_version: {
        ingredients: [{ name: "spaghetti", quantity: 12, unit: "oz" }],
        steps: [{ body: "Boil the spaghetti in water.", ingredient_refs: ["spaghetti"] }],
      },
    });
    expect(bare.warnings.map((item) => item.code)).toContain("boiling_salt_ratio");

    const covered = assessCulinaryQuality({
      reviewer_overrides: ["boiling_salt_ratio"],
      dish: { title: "Noodles" },
      recipe_version: {
        ingredients: [{ name: "spaghetti", quantity: 12, unit: "oz" }],
        steps: [{ body: "Boil the spaghetti in water.", ingredient_refs: ["spaghetti"] }],
      },
    });
    expect(covered.warnings).toEqual([]);
    expect(covered.fails).toEqual([]);
  });

  it("accepts a stated ratio and does not require acid, garlic, or a garnish", () => {
    const result = assessCulinaryQuality({
      dish: { title: "Plain pasta" },
      recipe_version: {
        ingredients: [
          { name: "spaghetti", quantity: 12, unit: "oz" },
          { name: "Diamond Crystal kosher salt", quantity: 28, unit: "g" },
        ],
        steps: [
          {
            body: "Boil the spaghetti in 3 qt water with 28 g Diamond Crystal kosher salt, about 1% by weight.",
            ingredient_refs: ["spaghetti", "Diamond Crystal kosher salt"],
          },
        ],
      },
    });
    expect(result.fails).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe("S-08 revised recipes", () => {
  it("keeps salmon at 145 F with salt, acid, and one herb, and does not instruct 125 F", () => {
    const pkg = readPkg("maple-mustard-glazed-salmon", "v3.json");
    const blob = JSON.stringify(pkg.recipe_version);
    expect(blob).toContain("145 F");
    expect(blob).not.toMatch(/125\s*F/);
    expect(blob).toContain("Diamond Crystal kosher salt");
    expect(blob).toContain("fresh dill");
    expect(blob).toContain("lemon");
    expect(pkg.evidence.kitchen_tested).toBe(false);
    expect(pkg.evidence.culinary_reviewed).toBe("s08-2026-10-18");
    expect(assessCulinaryQuality(pkg).fails).toEqual([]);
    expect(assessCulinaryQuality(pkg).warnings).toEqual([]);
    const v2 = JSON.stringify(readPkg("maple-mustard-glazed-salmon", "v2.json"));
    expect(v2).toContain("No oil is listed");
  });

  it("keeps cashew pesto dairy-free, cashew-allergen, and salted in the pot", () => {
    const pkg = readPkg("cashew-pesto-pasta", "v3.json");
    const names = pkg.recipe_version.ingredients.map((item) => item.name);
    expect(names).not.toContain("parmesan");
    expect(names.join(" ")).not.toMatch(/\bmilk\b|\bcheese\b|\bmiso\b/i);
    expect(pkg.projection.allergens).toEqual(["cashew", "nuts", "wheat"]);
    expect(pkg.projection.dietary_labels).toContain("dairy_free");
    expect(JSON.stringify(pkg)).toContain("not nut-safe");
    expect(JSON.stringify(pkg.recipe_version.steps)).toContain("28 g");
    expect(JSON.stringify(pkg.recipe_version.steps)).toContain("extra-virgin olive oil");
    expect(pkg.evidence.household_rated).toBe(false);
    expect(assessCulinaryQuality(pkg).fails).toEqual([]);
  });

  it("passes every S-08 revision through the objective checker", () => {
    const slugs = [
      ["maple-mustard-glazed-salmon", "v3.json"],
      ["cashew-pesto-pasta", "v3.json"],
      ["chipotle-lime-black-bean-bowls", "v3.json"],
      ["ginger-scallion-fish-packets", "v3.json"],
      ["harissa-roasted-carrots-feta", "v3.json"],
      ["lemon-garlic-shrimp-pasta", "v3.json"],
      ["moroccan-chickpea-skillet", "v3.json"],
      ["mushroom-walnut-bolognese", "v3.json"],
      ["roasted-cauliflower-shawarma-plate", "v3.json"],
      ["sesame-soba-noodle-bowl", "v3.json"],
      ["sheet-pan-lemon-herb-chicken", "v3.json"],
      ["smoky-lentil-sweet-potato-stew", "v3.json"],
      ["thai-basil-eggplant-stir-fry", "v3.json"],
      ["white-bean-kale-soup", "v3.json"],
      ["black-bean-quesadillas", "v3.json"],
      ["steak-au-poivre-smashed-potatoes", "v2.json"],
      ["spanish-potato-tortilla", "v2.json"],
      ["linguine-with-clams", "v2.json"],
    ];
    for (const [slug, file] of slugs) {
      const pkg = readPkg(slug, file);
      const result = assessCulinaryQuality(pkg);
      expect(result, slug).toEqual({ fails: [], warnings: [] });
      expect(pkg.evidence.kitchen_tested).toBe(false);
    }
  });
});

describe("S-08 version pins, ratings, and shopping", () => {
  it("leaves a pinned older version, its rating, and its shop line in place when v3 is published", async () => {
    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    await importCatalog(database);
    const ts = "2026-10-18T12:00:00.000Z";
    const v2Ingredients = readPkg("maple-mustard-glazed-salmon", "v2.json").recipe_version.ingredients;
    database
      .prepare(
        `INSERT INTO household (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
         VALUES ('hh_s08', 'S08 kitchen', 'active', 'UTC', 4, 'synthetic_qa', ?, ?, 'synthetic')`
      )
      .run(ts, ts);
    database
      .prepare(
        `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
         VALUES ('m_s08', 'hh_s08', 'Ada', 'member', 'active', ?, ?)`
      )
      .run(ts, ts);
    database
      .prepare(
        `INSERT INTO dinner_plan (dinner_plan_id, household_id, status, meal_count, entry_point, created_by_member_id, created_at, updated_at, data_origin)
         VALUES ('dp_s08', 'hh_s08', 'active', 1, 'plan_dinners', 'm_s08', ?, ?, 'synthetic')`
      )
      .run(ts, ts);
    database
      .prepare(
        `INSERT INTO dinner_plan_meal (
           meal_id, dinner_plan_id, position, kind, state, recipe_slug, recipe_id, recipe_version_id,
           version_number, title, base_servings, pinned_ingredients_json, pinned_steps_json, created_at, updated_at, data_origin
         ) VALUES (
           'meal_s08', 'dp_s08', 1, 'recipe', 'cooked', 'maple-mustard-glazed-salmon', 'rcp_maple-mustard-glazed-salmon',
           'rv_maple-mustard-glazed-salmon_v2', 2, 'Maple Mustard Glazed Salmon', 4, ?, '[]', ?, ?, 'synthetic'
         )`
      )
      .run(JSON.stringify(v2Ingredients), ts, ts);
    database
      .prepare(
        `INSERT INTO dinner_plan_rating (rating_id, meal_id, dinner_plan_id, household_id, member_id, recipe_version_id, score, data_origin, created_at, updated_at)
         VALUES ('rate_s08', 'meal_s08', 'dp_s08', 'hh_s08', 'm_s08', 'rv_maple-mustard-glazed-salmon_v2', 6, 'synthetic', ?, ?)`
      )
      .run(ts, ts);
    database
      .prepare(
        `INSERT INTO dinner_shop_line (line_id, dinner_plan_id, ingredient_id, display_name, unit, quantity, list_state, meal_ids_json, created_at, updated_at)
         VALUES ('line_s08', 'dp_s08', 'dijon-mustard', 'Dijon mustard', 'tbsp', 2, 'purchased', '["meal_s08"]', ?, ?)`
      )
      .run(ts, ts);

    await importCatalog(database);

    const meal = database.prepare(`SELECT recipe_version_id, pinned_ingredients_json FROM dinner_plan_meal WHERE meal_id = 'meal_s08'`).get();
    expect(meal.recipe_version_id).toBe("rv_maple-mustard-glazed-salmon_v2");
    expect(JSON.parse(meal.pinned_ingredients_json)).toEqual(v2Ingredients);
    const rating = database.prepare(`SELECT recipe_version_id, score FROM dinner_plan_rating WHERE rating_id = 'rate_s08'`).get();
    expect(rating).toEqual({ recipe_version_id: "rv_maple-mustard-glazed-salmon_v2", score: 6 });
    const shop = database.prepare(`SELECT display_name, quantity, list_state FROM dinner_shop_line WHERE line_id = 'line_s08'`).get();
    expect(shop).toEqual({ display_name: "Dijon mustard", quantity: 2, list_state: "purchased" });

    const current = database.prepare(`SELECT current_version_id FROM catalog_dish WHERE dish_id = 'maple-mustard-glazed-salmon'`).get();
    expect(current.current_version_id).toBe("rv_maple-mustard-glazed-salmon_v3");
    const v2Names = database
      .prepare(`SELECT name FROM catalog_ingredient WHERE recipe_version_id = 'rv_maple-mustard-glazed-salmon_v2'`)
      .all()
      .map((row) => row.name);
    expect(v2Names).not.toContain("fresh dill");
    const v3Names = database
      .prepare(`SELECT name FROM catalog_ingredient WHERE recipe_version_id = 'rv_maple-mustard-glazed-salmon_v3'`)
      .all()
      .map((row) => row.name);
    expect(v3Names).toContain("fresh dill");
    expect(v3Names).toContain("olive oil");
  });

  it("cooks from the pin until adopt_version, and shopping lines come from that pin", async () => {
    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    await importCatalog(database);
    const loaded = await loadPublishedCatalog(sqliteShim(database));
    expect(loaded.count).toBe(250);
    const salmon = loaded.planner.find((entry) => entry.concept.concept_id === "maple-mustard-glazed-salmon");
    expect(salmon.pkg.recipe_version_id).toBe("rv_maple-mustard-glazed-salmon_v3");
    expect(assessMealEligibility(salmon, ["tom"], HH001, []).eligible).toBe(true);
    const ginger = loaded.planner.find((entry) => entry.concept.concept_id === "ginger-scallion-fish-packets");
    expect(assessMealEligibility(ginger, ["tom"], HH001, []).eligible).toBe(true);

    const created = createDinnerPlan(
      {
        household_id: "hh_s08_plan",
        dinner_plan_id: "dp_s08_plan",
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: ["ada"],
        meals: [{ kind: "recipe", recipe_version_id: salmon.pkg.recipe_version_id, participant_ids: ["ada"] }],
      },
      {
        now: "2026-10-18T00:00:00.000Z",
        actor_member_id: "ada",
        household_member_ids: ["ada"],
        constraints: [],
        data_origin: "synthetic",
        catalog: loaded.planner,
        versions: loaded.versionsById,
        id: (prefix) => `${prefix}_s08`,
      }
    );
    expect(created.ok, JSON.stringify(created)).toBe(true);
    const meal = created.plan.meals[0];
    const pin = structuredClone(meal.pinned_ingredients);
    expect(pin.some((item) => item.name === "fresh dill")).toBe(true);
    const resolved = resolvedRecipe(meal, {
      pkg: { recipe_version_id: "rv_maple-mustard-glazed-salmon_v9", ingredients: [{ name: "not the pinned salmon" }] },
    });
    expect(resolved.recipe_version_id).toBe("rv_maple-mustard-glazed-salmon_v3");
    expect(resolved.ingredients).toEqual(pin);
    expect(resolved.catalog_version_id).toBe("rv_maple-mustard-glazed-salmon_v9");
    const lines = neededLines([meal]);
    expect(lines.some((line) => /dill/i.test(line.display_name || line.name || ""))).toBe(true);

    const salt = pin.find((item) => /salt/i.test(item.name));
    const scaled = scaleForDiners([salt], 4, 2);
    expect(scaled[0].quantity).toBe(4);
  });
});

const OPTIONAL_RISK =
  "That lower temperature does not meet the USDA/FDA recommendation and carries higher risk, especially for young children, pregnant people, older adults, and anyone immunocompromised.";

describe("S-08 doneness primary instruction", () => {
  it("fails a recipe whose only temperature is below the default, including one that only says optional", () => {
    const only = assessCulinaryQuality({
      dish: { title: "Salmon" },
      recipe_version: {
        dietary_eligibility: { contains_finfish: true },
        ingredients: [{ name: "salmon fillets", quantity: 4, unit: "count" }],
        steps: [{ body: "Cook the salmon fillets to 125 F.", ingredient_refs: ["salmon fillets"] }],
      },
    });
    expect(only.fails.map((item) => item.code)).toContain("unsafe_temperature");

    const wordOnly = assessCulinaryQuality({
      dish: { title: "Salmon" },
      recipe_version: {
        dietary_eligibility: { contains_finfish: true },
        doneness: "Optional: pull the salmon at 125 F.",
        ingredients: [{ name: "salmon fillets", quantity: 4, unit: "count" }],
        steps: [{ body: "Cook the salmon fillets to 125 F.", ingredient_refs: ["salmon fillets"] }],
      },
    });
    expect(wordOnly.fails.map((item) => item.code)).toContain("unsafe_temperature");
  });

  it("accepts a safe primary temperature plus a labeled optional note, and rejects the note alone", () => {
    const ok = assessCulinaryQuality({
      dish: { title: "Salmon" },
      recipe_version: {
        dietary_eligibility: { contains_finfish: true },
        doneness: `Cook the salmon to 145 F in the center. Optional traditional preparation: some cooks pull at 125 F. ${OPTIONAL_RISK}`,
        ingredients: [{ name: "salmon fillets", quantity: 4, unit: "count" }],
        steps: [{ body: "Cook the salmon fillets to 145 F in the center.", ingredient_refs: ["salmon fillets"] }],
      },
    });
    expect(ok.fails.filter((item) => item.code === "unsafe_temperature")).toEqual([]);

    const noteOnly = assessCulinaryQuality({
      dish: { title: "Salmon" },
      recipe_version: {
        dietary_eligibility: { contains_finfish: true },
        doneness: `Optional traditional preparation: pull the salmon at 125 F. ${OPTIONAL_RISK}`,
        ingredients: [{ name: "salmon fillets", quantity: 4, unit: "count" }],
        steps: [{ body: "Cook the salmon fillets until done.", ingredient_refs: ["salmon fillets"] }],
      },
    });
    expect(noteOnly.fails.map((item) => item.code)).toContain("unsafe_temperature");
  });

  it("accepts opaque and firm shrimp with a labeled lower-temperature note", () => {
    const ok = assessCulinaryQuality({
      dish: { title: "Shrimp" },
      recipe_version: {
        dietary_eligibility: { contains_shellfish: true },
        doneness: `Cook the shrimp until opaque and firm. Optional traditional preparation: shrimp still translucent, about 120 F to 125 F. ${OPTIONAL_RISK}`,
        ingredients: [{ name: "shrimp", quantity: 1, unit: "lb" }],
        steps: [{ body: "Simmer the shrimp until opaque and firm.", ingredient_refs: ["shrimp"] }],
      },
    });
    expect(ok.fails.filter((item) => item.code === "unsafe_temperature")).toEqual([]);
  });

  it("publishes the twelve doneness revisions at the USDA/FDA primary instruction", () => {
    const slugs = [
      ["ethiopian-beef-tibs", 145, 29, 44],
      ["gochujang-grilled-flank-steak", 145, 27, 52],
      ["grilled-swordfish-olive-caper", 145, 30, 48],
      ["malaysian-curry-laksa", null, 29, 54],
      ["nigerian-beef-suya-skewers", 145, 41, 61],
      ["pan-seared-halibut-lemon-butter-corn", 145, 18, 26],
      ["roasted-whole-branzino-salmoriglio", 145, 49, 64],
      ["salade-nicoise-seared-tuna", 145, 32, 47],
      ["seared-duck-breast-cherry", 165, 26, 36],
      ["seared-scallops-parsnip-puree", null, 41, 51],
      ["tex-mex-steak-fajitas", 145, 34, 54],
      ["thai-yum-nua-beef-salad", 145, 32, 44],
    ];
    for (const [slug, floor, cook, total] of slugs) {
      const pkg = readPkg(slug, "v2.json");
      expect(pkg.package_revision).toBe("s08-doneness");
      expect(pkg.evidence?.culinary_reviewed).toBeUndefined();
      expect(pkg.recipe_version.recipe_version_id).toBe(`rv_${slug}_v2`);
      expect(pkg.recipe_version.cook_minutes).toBe(cook);
      expect(pkg.recipe_version.total_minutes).toBe(total);
      expect(pkg.kitchen_tested).toBe(false);
      const culinary = assessCulinaryQuality(pkg);
      expect(culinary.fails.filter((item) => item.code === "unsafe_temperature"), slug).toEqual([]);
      const raw = readFileSync(join(root, slug, "v2.json"), "utf8");
      expect(raw, slug).not.toContain("pull at 120 to 125 F");
      expect(raw, slug).not.toContain("130-135 F target");
      expect(raw, slug).not.toContain("at least 130 F");
      const prose = `${pkg.recipe_version.doneness}\n${pkg.recipe_version.steps.map((step) => step.body).join("\n")}`;
      expect(prose).toContain("Optional traditional preparation:");
      expect(prose).toContain("does not meet the USDA/FDA recommendation");
      expect(prose).toContain("immunocompromised");
      if (floor) expect(prose).toContain(`${floor} F`);
      else expect(prose).toMatch(/opaque/i);
      const v1 = readFileSync(join(root, slug, "v1.json"), "utf8");
      expect(v1).not.toContain('"package_revision": "s08-doneness"');
    }
  });

  it("flags a below-minimum temperature in any text field, including one with no protein name", () => {
    const base = {
      dish: { title: "Scallops" },
      recipe_version: {
        dietary_eligibility: { contains_shellfish: true },
        doneness: "Scallops opaque and firm throughout.",
        ingredients: [{ name: "scallops", quantity: 1, unit: "lb" }],
        steps: [{ body: "Sear the scallops until opaque and firm.", ingredient_refs: ["scallops"] }],
      },
    };
    const pull = assessCulinaryQuality({
      ...base,
      scaling_notes: { do_not_scale: ["pull at 120 to 125 F"] },
    });
    expect(pull.fails.map((item) => item.code)).toContain("unsafe_temperature");

    const instructed = assessCulinaryQuality({
      dish: { title: "Steak fajitas" },
      recipe_version: {
        dietary_eligibility: { contains_meat: true },
        doneness: "Steak at 145 F.",
        ingredients: [{ name: "steak", quantity: 1.5, unit: "lb" }],
        steps: [{ body: "Sear the steak to 145 F.", ingredient_refs: ["steak"] }],
      },
      food_safety_note: "Cook the steak to at least 130 F and rest 5 minutes.",
    });
    expect(instructed.fails.map((item) => item.code)).toContain("unsafe_temperature");

    const oven = assessCulinaryQuality({
      ...base,
      scaling_notes: { 4: "Preheat the oven to 400 F." },
    });
    expect(oven.fails.filter((item) => item.code === "unsafe_temperature")).toEqual([]);

    const choice = assessCulinaryQuality(readPkg("thai-yum-nua-beef-salad", "v2.json"));
    expect(choice.fails.filter((item) => item.code === "unsafe_temperature")).toEqual([]);
    expect(readPkg("thai-yum-nua-beef-salad", "v2.json").recipe_version.food_safety_note).toContain("diner's choice");
  });
});

describe("S-08 pasta water on the shopping list", () => {
  function pinnedMeal(slug, file) {
    const pkg = readPkg(slug, file);
    const ingredients = pkg.recipe_version.ingredients.map((item) => ({
      name: item.name,
      quantity: typeof item.quantity === "number" ? item.quantity : null,
      unit: item.unit || null,
      raw_quantity:
        item.raw_quantity ||
        (typeof item.quantity === "number" && item.unit ? `${item.quantity} ${item.unit}` : item.quantity) ||
        null,
      note: item.note || null,
    }));
    return {
      meal_id: slug,
      kind: "recipe",
      state: "planned",
      base_servings: pkg.recipe_version.base_servings,
      participant_ids: ["a", "b", "c", "d"],
      pinned_ingredients: ingredients,
    };
  }

  it("does not shop cooking water in any unit, and still shops water used in the dish", () => {
    for (const [slug, file] of [
      ["cashew-pesto-pasta", "v3.json"],
      ["lemon-garlic-shrimp-pasta", "v3.json"],
      ["mushroom-walnut-bolognese", "v3.json"],
      ["sesame-soba-noodle-bowl", "v3.json"],
      ["steak-au-poivre-smashed-potatoes", "v2.json"],
    ]) {
      const lines = neededLines([pinnedMeal(slug, file)]);
      const water = lines.filter((line) => line.display_name === "water" || line.ingredient_id === "water");
      expect(water, slug).toEqual([]);
    }

    const sauce = neededLines([
      {
        meal_id: "sauce",
        kind: "recipe",
        state: "planned",
        base_servings: 4,
        participant_ids: ["a", "b", "c", "d"],
        pinned_ingredients: [{ name: "water", quantity: 0.25, unit: "cup", raw_quantity: "0.25 cup", note: "to loosen the sauce" }],
      },
    ]);
    const cup = sauce.find((line) => line.display_name === "water");
    expect(cup?.unparsed).toBe(false);
    expect(presentShopQuantity({ quantity: cup.quantity, unit: cup.unit, name: cup.display_name }).display).toMatch(/cup/);

    const rice = neededLines([pinnedMeal("thai-basil-eggplant-stir-fry", "v3.json")]);
    expect(rice.some((line) => line.display_name === "water" || line.ingredient_id === "water")).toBe(true);
  });
});

describe("S-08 hero images", () => {
  const heroes = [
    {
      slug: "maple-mustard-glazed-salmon",
      source: "b99df43ec8ba0a7810ef381ee147d69800290185c232ebb217f176a3b82b15c1",
      master: "0073b40dea7b0325fa9fd559105e5f4e66f1287185edc68df2f973e4dbf33e60",
      card: "34229d7d199c5fe40fb55e642173be37776d8eb2aa28da5574c6b16cafc1278c",
      qa: "audit_pass",
      prompt: "docs/catalog/s08/image-prompt-maple-mustard-glazed-salmon.md",
    },
    {
      slug: "cashew-pesto-pasta",
      source: "8658a59c684d5a3a8bcc3585f3b1a18b18533eb481ed121e32130d245fdaa69f",
      master: "fbfa4b712bc4308d83cebfbd258bc9565f0ab155a4e40111dcd2534a0c67749d",
      card: "d5727b20bf247add3736dff038788afd90b7ec66c7097ceb149ed5f58af08d3c",
      qa: "audit_pass",
      prompt: "docs/catalog/s08/image-prompt-cashew-pesto-pasta.md",
    },
    {
      slug: "moroccan-chickpea-skillet",
      source: "28b9518ab52a69cd89af51f6e17f63a915f937d0f83413b13a7a875ffc170296",
      master: "0b4aca78927b035dd564e13c92579988514d88339ac22e3cdf1888eea48cfb52",
      card: "d882e7b6e61a9e686888c1f1acecc64e4eadcf021312c11aae83e1033b7ff490",
      qa: "audit_pass",
      prompt: "docs/catalog/s08/image-prompt-moroccan-chickpea-skillet.md",
    },
  ];

  for (const hero of heroes) {
    it(`${hero.slug} WebP matches the v3 image record`, () => {
      const pkg = readPkg(hero.slug, "v3.json");
      expect(pkg.image.generation.method).toBe("original_ai_generation");
      expect(pkg.image.generation.generator).toBe("Grok Bot GenerateImage");
      expect(pkg.image.generation.generation_date).toBe("2026-10-18");
      expect(pkg.image.generation.prompt_file).toBe(hero.prompt);
      expect(pkg.image.generation.source_sha256).toBe(hero.source);
      expect(pkg.image.provenance).toBe("ai_illustration");
      expect(pkg.image.qa_state).toBe(hero.qa);
      expect(pkg.image.file_hashes).toEqual({
        source_jpeg_sha256: hero.source,
        master_sha256: hero.master,
        card_sha256: hero.card,
      });
      const masterPath = join(process.cwd(), "public/images/meals", `${hero.slug}.webp`);
      const cardPath = join(process.cwd(), "public/images/meals", `${hero.slug}-640.webp`);
      const masterBuf = readFileSync(masterPath);
      const cardBuf = readFileSync(cardPath);
      expect(createHash("sha256").update(masterBuf).digest("hex")).toBe(hero.master);
      expect(createHash("sha256").update(cardBuf).digest("hex")).toBe(hero.card);
      expect(webpDimensions(masterBuf)).toEqual({ width: 1200, height: 900 });
      expect(webpDimensions(cardBuf)).toEqual({ width: 640, height: 480 });
      expect(readFileSync(join(process.cwd(), hero.prompt), "utf8")).toContain(hero.source);
      expect(readFileSync(join(process.cwd(), "docs/catalog/s08/IMAGE-PROVENANCE.md"), "utf8")).toContain(
        hero.qa === "audit_fail" ? `${hero.slug} — FAIL` : `${hero.slug} — PASS`
      );
    });
  }
});

describe("S-08 catalog delta", () => {
  it("matches the generator and keeps 250 published dishes with pinned versions resolvable", async () => {
    const generated = await generateS08CatalogDelta();
    const onDisk = readFileSync(join(process.cwd(), "data", "s08-catalog-delta.sql"), "utf8");
    expect(onDisk).toBe(generated.sql);
    expect(generated.versionIds).toHaveLength(30);
    const verification = await verifyS08CatalogDelta(onDisk);
    expect(verification.ok, JSON.stringify({ before: verification.before, after: verification.after, pin: verification.pin })).toBe(
      true
    );
    expect(verification.after.published).toBe(250);
    expect(verification.after.versions).toBe(305);
    expect(verification.twice.versions).toBe(305);
    expect(verification.pin.publication_status).toBe("retired");
    expect(verification.salmonCurrent.current_version_id).toBe("rv_maple-mustard-glazed-salmon_v3");
  });
});
