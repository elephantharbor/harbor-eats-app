/**
 * Preview-eval cycle 6 defects J1–J5.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { planDinners } from "../src/lib/dinner-planner.js";
import { createMemberSession } from "../src/lib/session.js";
import { checkSwInvariant, readSw } from "../scripts/release/sw-invariant.mjs";
import { reconcileAcknowledgement } from "../src/weave/ack.js";
import { detectDiscoveryConflicts } from "../src/weave/conflicts.js";
import { routeWeaveRequest } from "../src/weave/routes.js";
import { applyPlanningDelta, emptyDiscoveryState, parsePortionCounts } from "../src/weave/state.js";

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

function seedHousehold(sqlite, { householdId = "hh_j", members = ["m_a"] } = {}) {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES (?, 'J', 'active', 'America/Chicago', ?, 'synthetic_qa', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', 'synthetic')`
  ).run(householdId, members.length);
  for (const [index, memberId] of members.entries()) {
    sqlite.prepare(
      `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run(memberId, householdId, memberId, index === 0 ? "owner" : "member");
  }
}

function seedLimit(sqlite, { householdId = "hh_j", memberId, rule }) {
  sqlite.prepare(
    `INSERT INTO constraint_rule
      (constraint_id, household_id, member_id, rule_key, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'prohibited', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
  ).run(`cr_${householdId}_${memberId}_${rule}`, householdId, memberId, rule);
}

function seedMeal(sqlite, { slug, title, allergen, ingredient = null }) {
  const dish = `dish_${slug}`;
  const version = `rv_${slug}`;
  sqlite.prepare(
    `INSERT INTO catalog_dish
      (dish_id, slug, title, name, cuisine, meal_format, primary_ingredient, tags_json, sparks_json, chips_json, created_at)
     VALUES (?, ?, ?, ?, 'american', 'bowls', ?, '[]', '[]', '[]', '2026-10-10T00:00:00Z')`
  ).run(dish, slug, title, title, ingredient || "fish");
  sqlite.prepare(
    `INSERT INTO catalog_version
      (recipe_version_id, recipe_id, dish_id, version_number, title, base_servings, total_minutes,
       effort_level, ingredient_complexity, methods_json, dietary_tags_json, publication_status,
       visibility, content_hash, source_contract, source_path, created_at)
     VALUES (?, ?, ?, 1, ?, 2, 25, 'easy', 'simple', '[]', '[]', 'published', 'global', ?, 'test', ?, '2026-10-10T00:00:00Z')`
  ).run(version, `rec_${slug}`, dish, title, `hash-${slug}`, `test/${slug}`);
  if (allergen) sqlite.prepare(`INSERT INTO catalog_allergen (recipe_version_id, allergen) VALUES (?, ?)`).run(version, allergen);
  if (ingredient) {
    sqlite.prepare(`INSERT INTO catalog_ingredient (recipe_version_id, position, ingredient_id, name) VALUES (?, 1, ?, ?)`).run(version, ingredient, ingredient);
  }
}

function discoveryDelta(overrides = {}) {
  return {
    acknowledgement: "",
    clear: [],
    text_residue: null,
    max_minutes: null,
    max_minutes_hard: null,
    quick: null,
    different: null,
    keep_it_easy: null,
    keep_ingredients_simple: null,
    list_ops: [],
    concepts: [],
    ...overrides,
  };
}

function planningDelta(overrides = {}) {
  return {
    acknowledgement: "4 dinners",
    clear: [],
    dinner_count: 4,
    date_start: null,
    date_end: null,
    keep_it_easy: null,
    keep_ingredients_simple: null,
    max_minutes: null,
    max_minutes_hard: null,
    effort: null,
    ingredient_complexity: null,
    ingredient_complexity_hard: null,
    special_count: null,
    list_ops: [],
    frequency_ops: [],
    slot_ops: [],
    concepts: [],
    ...overrides,
  };
}

function envFor(db, provider, extra = {}) {
  return {
    DB: db,
    CATALOG_SOURCE: "d1",
    AI_PROVIDER: "fake",
    AI_FAKE_PROVIDER: provider,
    AI_GATEWAY_ENABLED: "1",
    AI_TASKS_ENABLED: "planning_intent,discovery_intent",
    AI_DAILY_BUDGET_USD: "5",
    ...extra,
  };
}

async function postWeave(env, token, path, body) {
  const request = new Request(`https://example.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ schema_version: 1, mode: "standalone", state: null, timezone: "America/Chicago", ...body }),
  });
  const res = await routeWeaveRequest(env, request, path);
  return { status: res.status, body: await res.json() };
}

function meal(slug, extra = {}) {
  return {
    concept: {
      concept_id: slug,
      title: slug,
      cuisine: extra.cuisine || "american",
      primary_ingredient: extra.ingredient || "beans",
      tags: extra.tags || [],
      current_version: { methods: [] },
      exploration: 0.2,
    },
    pkg: {
      recipe_id: `rcp_${slug}`,
      recipe_version_id: `rv_${slug}`,
      version_number: 1,
      title: slug,
      total_minutes: 30,
      effort_level: "easy",
      ingredient_complexity: "simple",
      vocabulary_tag_ids: extra.tags || [],
      ingredients: [{ name: extra.ingredient || "salt", note: null }],
      allergens: [],
      equipment: [],
      exploration: 0.2,
    },
  };
}

describe("J1 raw-text hazards when the model returns nothing", () => {
  it("names shellfish, satay, steak, and dairy from the request itself", () => {
    const allergen = detectDiscoveryConflicts(emptyDiscoveryState(), {
      participantIds: ["a", "b"],
      constraints: [
        { member_id: "a", rule_key: "nuts", status: "prohibited" },
        { member_id: "b", rule_key: "shellfish", status: "prohibited" },
      ],
      tastes: [],
      userText: "satay noodles with prawns",
    });
    const tokens = allergen.conflicts.map((row) => row.token).sort();
    expect(tokens).toEqual(["peanut", "shrimp"]);
    expect(allergen.conflicts.find((row) => row.token === "shrimp").alternative).toEqual({ kind: "category", token: "fish" });
    expect(allergen.conflicts.find((row) => row.token === "peanut").alternative).toEqual({ kind: "drop" });

    const steak = detectDiscoveryConflicts(emptyDiscoveryState(), {
      participantIds: ["a"],
      constraints: [{ member_id: "a", rule_key: "meat", status: "prohibited" }],
      tastes: [],
      userText: "steak for dinner",
    });
    expect(steak.conflicts.map((row) => row.token)).toContain("steak");

    const dairy = detectDiscoveryConflicts(emptyDiscoveryState(), {
      participantIds: ["a"],
      constraints: [{ member_id: "a", rule_key: "dairy", status: "prohibited" }],
      tastes: [],
      userText: "butter noodles",
    });
    expect(dairy.conflicts.map((row) => row.token)).toContain("butter");
    expect(dairy.conflicts[0].limit_ids).toContain("no_dairy");
  });

  it("still returns the structured conflict when the model delta is empty", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, { members: ["m_a", "m_b"] });
    seedLimit(sqlite, { memberId: "m_a", rule: "nuts" });
    seedLimit(sqlite, { memberId: "m_b", rule: "shellfish" });
    seedMeal(sqlite, { slug: "arctic-char", title: "Arctic Char", allergen: "finfish" });
    seedMeal(sqlite, { slug: "shrimp-scampi", title: "Shrimp Scampi", allergen: "shellfish", ingredient: "shrimp" });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_j", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: discoveryDelta() }] });
    const res = await postWeave(envFor(db, provider), session.session_token, "/api/discovery/interpret", {
      text: "satay noodles with prawns",
    });
    expect(res.status).toBe(200);
    expect(res.body.fallback_code).toBe("empty_delta");
    expect(res.body.conflicts.map((row) => row.token).sort()).toEqual(["peanut", "shrimp"]);
    expect(res.body.conflicts.find((row) => row.token === "shrimp").alternative.token).toBe("fish");
    expect(res.body.acknowledgement).toMatch(/shellfish/i);
    expect(res.body.acknowledgement).toMatch(/peanut/i);
    expect(res.body.acknowledgement).toMatch(/fish/i);
    expect(res.body.acknowledgement).not.toBe("No dinners match that. Try fish, something easier, or clear a filter.");
    expect(res.body.results.map((row) => row.title)).not.toContain("Shrimp Scampi");
  });
});

describe("J2 vegetarian no-op on a cache hit", () => {
  it("recomputes the explanation when the cached delta has no slot", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    sqlite.prepare(
      `INSERT INTO dinner_plan
        (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
         created_by_member_id, created_at, updated_at)
       VALUES ('dp_j', 'hh_j', 'active', 4, 'plan_dinners', '{"dinner_count":4}', 'synthetic', 'm_a',
         '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run();
    const meals = [
      [1, "2026-10-12", "monday-pork", "Pork", "[]"],
      [2, "2026-10-13", "tuesday-pork", "Pork", "[]"],
      [3, "2026-10-14", "wednesday-tofu", "Tofu Bowl", '["vegetarian"]'],
      [4, "2026-10-15", "thursday-cod", "Cod", "[]"],
    ];
    for (const [position, date, slug, title, tags] of meals) {
      sqlite.prepare(
        `INSERT INTO dinner_plan_meal
          (meal_id, dinner_plan_id, position, kind, state, scheduled_date, recipe_slug, recipe_id,
           recipe_version_id, version_number, title, base_servings, allergens_json, vocabulary_json,
           tags_json, effort_level, data_origin, created_at, updated_at)
         VALUES (?, 'dp_j', ?, 'recipe', 'planned', ?, ?, ?, ?, 1, ?, 2, '[]', '[]', ?, 'easy', 'synthetic',
           '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
      ).run(`m${position}`, position, date, slug, `rec_${slug}`, `rv_${slug}`, title, tags);
    }
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_j", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: planningDelta() }] });
    const env = envFor(db, provider, { CATALOG_SOURCE: undefined });
    const body = { text: "make Wednesday vegetarian", state: { dinner_count: 4 }, dinner_plan_id: "dp_j" };
    const first = await postWeave(env, session.session_token, "/api/plan/interpret", body);
    const second = await postWeave(env, session.session_token, "/api/plan/interpret", body);
    expect(first.body.acknowledgement).toMatch(/Wednesday's already vegetarian/);
    expect(second.body.source).toBe("cache");
    expect(provider.calls).toHaveLength(1);
    expect(second.body.acknowledgement).toMatch(/Wednesday's already vegetarian/);
    expect(second.body.acknowledgement).not.toBe("4 dinners");
    expect(second.body.changed_positions).toEqual([]);
  });
});

describe("J3 hearty portions", () => {
  it("assigns hearty and light to separate dinners", () => {
    expect(parsePortionCounts("two hearty dinners and one light one")).toEqual({
      dinner_count: 3,
      portions: [
        { cue: "filling", count: 2 },
        { cue: "light", count: 1 },
      ],
    });
    const applied = applyPlanningDelta(
      null,
      planningDelta({
        dinner_count: 4,
        list_ops: [
          { field: "intent_cues", op: "add", value: "filling" },
          { field: "intent_cues", op: "add", value: "light" },
        ],
      }),
      { today: "2026-10-10", user_text: "two hearty dinners and one light one", vocabulary: {} }
    );
    expect(applied.state.dinner_count).toBe(3);
    expect(applied.state.intent_cues).toEqual([]);
    expect(applied.state.slots.map((slot) => slot.intent_cue)).toEqual(["filling", "filling", "light"]);
    const filling = ["stews", "soups", "rich", "savory", "umami", "creamy"];
    const planned = planDinners(
      {
        dinner_count: 3,
        participant_ids: ["ana"],
        meal_styles: [],
        practical_hints: [],
        frequencies: [],
        intent_cues: [],
        weave_slots: applied.state.slots,
      },
      {
        catalog: [
          meal("salad", { tags: ["citrusy", "fresh"], cuisine: "mexican", ingredient: "greens" }),
          meal("stew-a", { tags: filling, cuisine: "american", ingredient: "beans" }),
          meal("stew-b", { tags: filling, cuisine: "indian", ingredient: "lentils" }),
        ],
        constraints: [],
        tastes: [],
      }
    );
    expect(planned.slots.map((slot) => slot.recipe_slug)).toEqual(["stew-a", "stew-b", "salad"]);
  });
});

describe("J4 acknowledgement wording", () => {
  it("keeps flavor words and does not end on a bare special chip", () => {
    const bright = reconcileAcknowledgement({
      task: "discovery_intent",
      modelAck: "Fish",
      state: { protein_groups: ["fish"], flavors: [], intent_cues: [], ingredients: [], cuisines: [], exclude_ingredients: [] },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: "zesty lemony fish",
    });
    expect(bright.acknowledgement).toMatch(/zesty/i);
    expect(bright.acknowledgement).toMatch(/lemony/i);
    expect(bright.acknowledgement).toMatch(/fish/i);

    const special = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "4 dinners",
      state: { dinner_count: 4, intent_cues: ["special"], slots: [], frequencies: [], exclude_ingredients: [] },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: "something special",
    });
    expect(special.acknowledgement).toMatch(/something special/i);
    expect(special.acknowledgement).not.toMatch(/ · Special\b/);
  });
});

describe("J5 service worker shell", () => {
  it("keeps fw-sw-v28 while the shell hash still matches", () => {
    const check = checkSwInvariant();
    expect(check.ok, check.problems.join("; ")).toBe(true);
    expect(readSw().version).toBe("fw-sw-v28");
    expect(check.version).toBe("fw-sw-v28");
  });
});
