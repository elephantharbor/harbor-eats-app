/**
 * Preview cycle 9: negated Find words are exclusions, and a no-results
 * suggestion does not repeat a cue the search already has.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { matchExplicitCriteria } from "../src/discovery/criteria.js";
import { createMemberSession } from "../src/lib/session.js";
import { noResultsAcknowledgement, noResultsSuggestions } from "../src/weave/ack.js";
import { applyNegationOverlay, mealMatchesExcludedTerm, parseNegations, termForms } from "../src/weave/negation.js";
import { routeWeaveRequest } from "../src/weave/routes.js";
import { emptyDiscoveryState } from "../src/weave/state.js";

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return sqlite;
}

function asD1(sqlite) {
  function exec(sql, params) {
    const returning = /returning/i.test(sql);
    const reading = /^\s*select/i.test(sql) || returning;
    if (reading) return sqlite.prepare(sql).all(...params);
    sqlite.prepare(sql).run(...params);
    return [];
  }
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            sql,
            params,
            async run() {
              exec(sql, params);
              return { success: true, meta: { changes: 1 }, results: [] };
            },
            async first() {
              return exec(sql, params)[0] ?? null;
            },
            async all() {
              return { results: exec(sql, params) };
            },
          };
        },
      };
    },
    async batch(statements) {
      return statements.map((statement) => ({ results: exec(statement.sql, statement.params), success: true }));
    },
  };
}

function seedHousehold(sqlite) {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES ('hh_l', 'L', 'active', 'America/Chicago', 1, 'synthetic_qa', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', 'synthetic')`
  ).run();
  sqlite.prepare(
    `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES ('m_a', 'hh_l', 'm_a', 'owner', 'active', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
  ).run();
}

function seedMeal(sqlite, { slug, title, allergen = "finfish", methods = [] }) {
  const dish = `dish_${slug}`;
  const version = `rv_${slug}`;
  sqlite.prepare(
    `INSERT INTO catalog_dish
      (dish_id, slug, title, name, cuisine, meal_format, primary_ingredient, tags_json, sparks_json, chips_json, created_at)
     VALUES (?, ?, ?, ?, 'american', 'bowls', 'fish', '[]', '[]', '[]', '2026-10-10T00:00:00Z')`
  ).run(dish, slug, title, title);
  sqlite.prepare(
    `INSERT INTO catalog_version
      (recipe_version_id, recipe_id, dish_id, version_number, title, base_servings, total_minutes,
       effort_level, ingredient_complexity, methods_json, dietary_tags_json, publication_status,
       visibility, content_hash, source_contract, source_path, created_at)
     VALUES (?, ?, ?, 1, ?, 2, 25, 'easy', 'simple', ?, '[]', 'published', 'global', ?, 'test', ?, '2026-10-10T00:00:00Z')`
  ).run(version, `rec_${slug}`, dish, title, JSON.stringify(methods), `hash-${slug}`, `test/${slug}`);
  if (allergen) sqlite.prepare(`INSERT INTO catalog_allergen (recipe_version_id, allergen) VALUES (?, ?)`).run(version, allergen);
}

function discoveryDelta(overrides = {}) {
  return {
    acknowledgement: "Fish, nothing fried.",
    clear: [],
    text_residue: "fried",
    max_minutes: null,
    max_minutes_hard: null,
    quick: null,
    different: null,
    keep_it_easy: null,
    keep_ingredients_simple: null,
    list_ops: [
      { field: "protein_groups", op: "add", value: "fish" },
      { field: "methods", op: "add", value: "fried" },
      { field: "ingredients", op: "add", value: "fried" },
    ],
    concepts: [{ id: "fried", polarity: "avoid" }],
    ...overrides,
  };
}

function envFor(db, provider) {
  return {
    DB: db,
    CATALOG_SOURCE: "d1",
    AI_PROVIDER: "fake",
    AI_FAKE_PROVIDER: provider,
    AI_GATEWAY_ENABLED: "1",
    AI_TASKS_ENABLED: "planning_intent,discovery_intent",
    AI_DAILY_BUDGET_USD: "5",
  };
}

async function postFind(sqlite, text, delta) {
  seedHousehold(sqlite);
  const db = asD1(sqlite);
  const session = await createMemberSession(db, { household_id: "hh_l", member_id: "m_a" });
  const provider = createFakeProvider({ script: [{ json: delta }] });
  const request = new Request("https://example.test/api/discovery/interpret", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.session_token}` },
    body: JSON.stringify({ schema_version: 1, mode: "standalone", state: null, timezone: "America/Chicago", text }),
  });
  const res = await routeWeaveRequest(envFor(db, provider), request, "/api/discovery/interpret");
  return { status: res.status, body: await res.json() };
}

describe("negation overlay", () => {
  it.each([
    ["fish but nothing fried", ["fried"]],
    ["no fried fish", ["fried"]],
    ["not fried", ["fried"]],
    ["without fried", ["fried"]],
    ["avoid fried", ["fried"]],
    ["something cozy but not too heavy", []],
  ])("parses %j", (text, expected) => {
    expect(parseNegations(text)).toEqual(expected);
  });

  it("does not treat friday as fried", () => {
    const forms = termForms("fried");
    expect(forms.has("fry")).toBe(true);
    expect(forms.has("fried")).toBe(true);
    expect(forms.has("frying")).toBe(true);
    expect(forms.has("fryer")).toBe(true);
    expect(forms.has("friday")).toBe(false);
    expect(mealMatchesExcludedTerm({ title: "Fish on Friday", recipe_slug: "fish-friday", methods: ["roast"] }, "fried")).toBe(false);
    expect(mealMatchesExcludedTerm({ title: "Pan-Fried Fish", recipe_slug: "pan-fried-fish", methods: ["skillet"] }, "fried")).toBe(true);
    expect(mealMatchesExcludedTerm({ title: "Air-Fryer Salmon", recipe_slug: "air-fryer-salmon", methods: ["roast"] }, "fried")).toBe(true);
    expect(mealMatchesExcludedTerm({ title: "Beef Stir-Fry", recipe_slug: "beef-stir-fry", methods: ["stir-fry"] }, "fried")).toBe(true);
    expect(mealMatchesExcludedTerm({ title: "Baked Cod", recipe_slug: "baked-cod", methods: ["bake"] }, "fried")).toBe(false);
  });

  it("overrides a model include and leaves the light cue alone", () => {
    const state = emptyDiscoveryState();
    state.methods = ["fried"];
    state.ingredients = ["fried"];
    state.protein_groups = ["fish"];
    state.text_residue = "fish but nothing fried";
    state.intent_cues = ["cozy", "light"];
    applyNegationOverlay(state, "fish but nothing fried");
    expect(state.methods).toEqual([]);
    expect(state.ingredients).toEqual([]);
    expect(state.protein_groups).toEqual(["fish"]);
    expect(state.text_residue).toBeNull();
    expect(state.exclude_terms).toEqual(["fried"]);
    expect(state.intent_cues).toEqual(["cozy", "light"]);

    const light = emptyDiscoveryState();
    light.intent_cues = ["cozy", "light"];
    applyNegationOverlay(light, "something cozy but not too heavy");
    expect(light.exclude_terms || []).toEqual([]);
    expect(light.intent_cues).toEqual(["cozy", "light"]);
  });

  it("excludes a fried meal in criteria matching", () => {
    const fried = matchExplicitCriteria(
      { title: "Pan-Fried Fish", recipe_slug: "pan-fried-fish", methods: ["skillet"], ingredient_ids: [] },
      { ...emptyCriteria(), exclude_ingredients: ["fried"], protein_groups: [] }
    );
    const baked = matchExplicitCriteria(
      { title: "Baked Cod", recipe_slug: "baked-cod", methods: ["bake"], ingredient_ids: [] },
      { ...emptyCriteria(), exclude_ingredients: ["fried"] }
    );
    expect(fried.pass).toBe(false);
    expect(baked.pass).toBe(true);
  });
});

function emptyCriteria() {
  return {
    cuisines: [],
    meal_styles: [],
    flavors: [],
    ingredients: [],
    exclude_ingredients: [],
    effort_levels: [],
    ingredient_complexities: [],
    methods: [],
    equipment: [],
    protein_groups: [],
    diet: [],
    textures: [],
    quick: false,
    different: false,
    max_minutes: null,
  };
}

describe("fish but nothing fried", () => {
  function seedFish(sqlite) {
    seedMeal(sqlite, { slug: "baked-cod", title: "Baked Cod", methods: ["bake"] });
    seedMeal(sqlite, { slug: "pan-fried-fish", title: "Pan-Fried Fish", methods: ["skillet"] });
    seedMeal(sqlite, { slug: "air-fryer-salmon", title: "Air-Fryer Salmon", methods: ["roast"] });
    seedMeal(sqlite, { slug: "fish-friday", title: "Fish on Friday", methods: ["roast"] });
  }

  it("drops the model's fried include and keeps the other fish", async () => {
    const sqlite = migrate();
    seedFish(sqlite);
    const res = await postFind(sqlite, "fish but nothing fried", discoveryDelta());
    expect(res.status).toBe(200);
    const titles = res.body.results.map((row) => row.title);
    expect(titles).toContain("Baked Cod");
    expect(titles).toContain("Fish on Friday");
    expect(titles).toContain("Air-Fryer Salmon");
    expect(titles).not.toContain("Pan-Fried Fish");
    expect(res.body.state.methods || []).not.toContain("fried");
    expect(res.body.state.exclude_cooking).toEqual(["deep", "pan", "shallow"]);
    expect(res.body.query.criteria.methods || []).not.toContain("fried");
    expect(res.body.query.criteria.exclude_ingredients || []).not.toContain("fried");
    expect(res.body.total).toBeGreaterThan(0);
  });

  it("applies the same exclusion when the model returns nothing", async () => {
    const sqlite = migrate();
    seedFish(sqlite);
    const res = await postFind(sqlite, "fish but nothing fried", discoveryDelta({
      acknowledgement: "",
      text_residue: null,
      list_ops: [],
    }));
    expect(res.status).toBe(200);
    const titles = res.body.results.map((row) => row.title);
    expect(titles).toContain("Baked Cod");
    expect(titles).not.toContain("Pan-Fried Fish");
    expect(res.body.state.exclude_cooking).toEqual(["deep", "pan", "shallow"]);
    expect(res.body.query.criteria.exclude_ingredients || []).not.toContain("fried");
    expect(res.body.query.criteria.methods || []).not.toContain("fried");
  });

  it("does not suggest fish again when every fried dinner dropped out", async () => {
    const sqlite = migrate();
    seedMeal(sqlite, { slug: "pan-fried-fish", title: "Pan-Fried Fish", methods: ["skillet"] });
    const res = await postFind(sqlite, "fish but nothing fried", discoveryDelta());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.suggestions).not.toContain("Try fish");
    expect(res.body.acknowledgement).not.toMatch(/Try fish/);
    expect(res.body.acknowledgement).toMatch(/something easier/);
  });
});

describe("no-results suggestions", () => {
  it("keeps the original sentence when no cue is active", () => {
    expect(noResultsAcknowledgement([])).toBe("No dinners match that. Try fish, something easier, or clear a filter.");
    expect(noResultsSuggestions({})).toEqual(["Try fish", "Make it easier", "Clear a filter"]);
  });

  it("skips a cue the search already has", () => {
    const fish = { protein_groups: ["fish"] };
    expect(noResultsSuggestions(fish)).toEqual(["Make it easier", "Clear a filter"]);
    expect(noResultsAcknowledgement([], fish)).toBe("No dinners match that. Try something easier, or clear a filter.");
    const easy = { keep_it_easy: true, text_residue: "fish" };
    expect(noResultsSuggestions(easy)).toEqual(["Clear a filter"]);
    expect(noResultsAcknowledgement([], easy)).toBe("No dinners match that. Clear a filter.");
  });
});
