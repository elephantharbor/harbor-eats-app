/**
 * Preview-eval cycle 7 defects K1–K3.
 * K1 uses the interpret route and the committed plan shape: meals have no
 * scheduled_date, and vegetarian is the dish chip, not a tag.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { createMemberSession } from "../src/lib/session.js";
import { reconcileAcknowledgement } from "../src/weave/ack.js";
import { routeWeaveRequest } from "../src/weave/routes.js";
import { applyPlanningDelta, parsePortionCounts } from "../src/weave/state.js";

afterEach(() => {
  vi.useRealTimers();
});

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
     VALUES ('hh_k', 'K', 'active', 'America/Chicago', 1, 'synthetic_qa', '2026-10-12T00:00:00Z', '2026-10-12T00:00:00Z', 'synthetic')`
  ).run();
  sqlite.prepare(
    `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES ('m_a', 'hh_k', 'm_a', 'owner', 'active', '2026-10-12T00:00:00Z', '2026-10-12T00:00:00Z')`
  ).run();
}

function seedDish(sqlite, { slug, title, tags = "[]", chips = "[]", dietary = null }) {
  sqlite.prepare(
    `INSERT INTO catalog_dish
      (dish_id, slug, title, name, cuisine, meal_format, primary_ingredient, tags_json, sparks_json, chips_json, created_at)
     VALUES (?, ?, ?, ?, 'american', 'bowls', 'beans', ?, '[]', ?, '2026-10-12T00:00:00Z')`
  ).run(`dish_${slug}`, slug, title, title, tags, chips);
  sqlite.prepare(
    `INSERT INTO catalog_version
      (recipe_version_id, recipe_id, dish_id, version_number, title, base_servings, total_minutes,
       effort_level, ingredient_complexity, methods_json, dietary_tags_json, publication_status,
       visibility, content_hash, source_contract, source_path, created_at)
     VALUES (?, ?, ?, 1, ?, 2, 30, 'easy', 'simple', '[]', '[]', 'published', 'global', ?, 'test', ?, '2026-10-12T00:00:00Z')`
  ).run(`rv_${slug}`, `rec_${slug}`, `dish_${slug}`, title, `hash-${slug}`, `test/${slug}`);
  if (dietary) {
    sqlite.prepare(`INSERT INTO catalog_dietary_label (recipe_version_id, label) VALUES (?, ?)`).run(`rv_${slug}`, dietary);
  }
}

function seedPlan(sqlite, meals) {
  sqlite.prepare(
    `INSERT INTO dinner_plan
      (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
       created_by_member_id, created_at, updated_at)
     VALUES ('dp_k', 'hh_k', 'active', ?, 'plan_dinners', ?, 'synthetic', 'm_a',
       '2026-10-12T00:00:00Z', '2026-10-12T00:00:00Z')`
  ).run(meals.length, JSON.stringify({ dinner_count: meals.length }));
  for (const meal of meals) {
    sqlite.prepare(
      `INSERT INTO dinner_plan_meal
        (meal_id, dinner_plan_id, position, kind, state, scheduled_date, recipe_slug, recipe_id,
         recipe_version_id, version_number, title, base_servings, allergens_json, vocabulary_json,
         tags_json, effort_level, data_origin, created_at, updated_at)
       VALUES (?, 'dp_k', ?, 'recipe', 'planned', ?, ?, ?, ?, 1, ?, 2, '[]', '[]', ?, 'easy', 'synthetic',
         '2026-10-12T00:00:00Z', '2026-10-12T00:00:00Z')`
    ).run(
      `m${meal.position}`,
      meal.position,
      meal.date ?? null,
      meal.slug,
      `rec_${meal.slug}`,
      `rv_${meal.slug}`,
      meal.title,
      meal.tags || "[]"
    );
  }
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

async function postWeave(env, token, body) {
  const request = new Request("https://example.test/api/plan/interpret", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      schema_version: 1,
      text: "make Wednesday vegetarian",
      state: null,
      timezone: "America/Chicago",
      dinner_plan_id: "dp_k",
      ...body,
    }),
  });
  const res = await routeWeaveRequest(env, request, "/api/plan/interpret");
  return { status: res.status, body: await res.json() };
}

describe("K1 Wednesday vegetarian on a committed plan", () => {
  it("explains a cache hit when the only vegetarian signal is the dish chip and the meals are undated", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T18:00:00Z"));
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedDish(sqlite, { slug: "monday-pork", title: "Pork Chops", tags: '["meat"]' });
    seedDish(sqlite, { slug: "tuesday-pork", title: "Pork Stew", tags: '["meat"]' });
    seedDish(sqlite, {
      slug: "wednesday-quesadilla",
      title: "Black Bean Quesadillas",
      tags: '["dairy"]',
      chips: '["Vegetarian","35 min"]',
    });
    seedDish(sqlite, { slug: "thursday-cod", title: "Cod", tags: '["fish"]' });
    seedPlan(sqlite, [
      { position: 1, slug: "monday-pork", title: "Pork Chops", tags: '["meat"]' },
      { position: 2, slug: "tuesday-pork", title: "Pork Stew", tags: '["meat"]' },
      { position: 3, slug: "wednesday-quesadilla", title: "Black Bean Quesadillas", tags: '["dairy"]' },
      { position: 4, slug: "thursday-cod", title: "Cod", tags: '["fish"]' },
    ]);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_k", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: planningDelta() }] });
    const env = envFor(db, provider);
    const first = await postWeave(env, session.session_token);
    const second = await postWeave(env, session.session_token);
    expect(first.status).toBe(200);
    expect(first.body.acknowledgement).toMatch(/Wednesday's already vegetarian/);
    expect(first.body.acknowledgement).not.toBe("4 dinners");
    expect(first.body.changed_positions).toEqual([]);
    expect(second.body.source).toBe("cache");
    expect(provider.calls).toHaveLength(1);
    expect(second.body.acknowledgement).toMatch(/Wednesday's already vegetarian/);
    expect(second.body.changed_positions).toEqual([]);
    expect(second.body.preview.slots[2].recipe_slug).toBe("wednesday-quesadilla");
  });

  it("replaces a Wednesday that is not vegetarian when the cached delta has no slot", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T18:00:00Z"));
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedDish(sqlite, { slug: "monday-pork", title: "Pork Chops", tags: '["meat"]' });
    seedDish(sqlite, { slug: "tuesday-pork", title: "Pork Stew", tags: '["meat"]' });
    seedDish(sqlite, { slug: "wednesday-pork", title: "Pork Roast", tags: '["meat"]' });
    seedDish(sqlite, { slug: "thursday-cod", title: "Cod", tags: '["fish"]' });
    seedDish(sqlite, { slug: "tofu-bowl", title: "Tofu Bowl", tags: '["dairy"]', dietary: "plant" });
    seedPlan(sqlite, [
      { position: 1, slug: "monday-pork", title: "Pork Chops", tags: '["meat"]' },
      { position: 2, slug: "tuesday-pork", title: "Pork Stew", tags: '["meat"]' },
      { position: 3, slug: "wednesday-pork", title: "Pork Roast", tags: '["meat"]' },
      { position: 4, slug: "thursday-cod", title: "Cod", tags: '["fish"]' },
    ]);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_k", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: planningDelta() }] });
    const res = await postWeave(envFor(db, provider), session.session_token);
    expect(res.status).toBe(200);
    expect(res.body.changed_positions).toEqual([3]);
    expect(res.body.preview.slots[2].recipe_slug).toBe("tofu-bowl");
    expect(res.body.acknowledgement).toMatch(/Wednesday's now Tofu Bowl/);
    expect(res.body.acknowledgement).not.toBe("4 dinners");
  });
});

describe("K2 portion wording", () => {
  const rows = [
    ["two filling dinners plus a light one", 3, ["filling", "filling", "light"]],
    ["two hearty dinners and one light one", 3, ["filling", "filling", "light"]],
    ["two cozy dinners with a light one", 3, ["cozy", "cozy", "light"]],
    ["2 filling & a light one", 3, ["filling", "filling", "light"]],
    ["a quick one plus two filling dinners", 3, ["weeknight", "filling", "filling"]],
    ["one hearty dinner and two light ones", 3, ["filling", "light", "light"]],
    ["three cozy dinners plus one quick one", 4, ["cozy", "cozy", "cozy", "weeknight"]],
  ];

  it.each(rows)("%s assigns a cue to each dinner", (text, count, cues) => {
    const parsed = parsePortionCounts(text);
    expect(parsed.dinner_count).toBe(count);
    expect(parsed.portions.reduce((sum, row) => sum + row.count, 0)).toBe(count);
    const applied = applyPlanningDelta(
      null,
      planningDelta({
        dinner_count: 4,
        list_ops: [
          { field: "intent_cues", op: "add", value: "filling" },
          { field: "intent_cues", op: "add", value: "light" },
        ],
      }),
      { today: "2026-10-12", user_text: text, vocabulary: {} }
    );
    expect(applied.state.dinner_count).toBe(count);
    expect(applied.state.intent_cues).toEqual([]);
    expect(applied.state.slots.map((slot) => slot.intent_cue)).toEqual(cues);
  });
});

describe("K3 acknowledgement punctuation", () => {
  it("does not leave a period against the special clause", () => {
    const joined = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "4 dinners",
      state: {
        dinner_count: 4,
        intent_cues: ["special"],
        slots: [],
        frequencies: [],
        exclude_ingredients: [],
        exclude_categories: [],
        include_ingredients: [],
        cuisines: [],
        meal_styles: [],
      },
      conflicts: [{ token: "shrimp", field: "exclude_ingredients", code: "hard_limit" }],
      dropped: [],
      removedTokens: ["shrimp"],
      userText: "shrimp, something special",
    });
    expect(joined.acknowledgement).toBe("Shellfish doesn't work for everyone at your table, so we left it out. Something special is still on.");
    expect(joined.acknowledgement).not.toMatch(/\.,/);

    const stored = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "Shellfish doesn't work for everyone, so I left that out., something special",
      state: {
        dinner_count: 4,
        intent_cues: [],
        slots: [],
        frequencies: [],
        exclude_ingredients: [],
        exclude_categories: [],
      },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: "something special",
    });
    expect(stored.acknowledgement).toBe("Shellfish doesn't work for everyone, so I left that out, something special");
    expect(stored.acknowledgement).not.toMatch(/\.,/);
  });
});
