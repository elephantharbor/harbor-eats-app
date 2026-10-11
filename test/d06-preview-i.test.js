/**
 * Preview-eval cycle 5 defects I1–I5.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createGenerationService, createMemoryStore, TASKS } from "../src/ai/index.js";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { planDinners } from "../src/lib/dinner-planner.js";
import { createMemberSession } from "../src/lib/session.js";
import { reconcileAcknowledgement, refinementAcknowledgement } from "../src/weave/ack.js";
import { removeDiscoveryChip } from "../src/weave/chip-ops.js";
import { applyPlanningDelta, parsePortionCounts } from "../src/weave/state.js";
import { routeWeaveRequest } from "../src/weave/routes.js";

const ON = { AI_GATEWAY_ENABLED: "1", AI_TASKS_ENABLED: "discovery_intent,recipe_draft", AI_DAILY_BUDGET_USD: "5" };
const DISC_IN = (text) => ({
  text,
  state: null,
  context: {},
  vocabulary: { cuisines: ["thai"], methods: ["grill"], equipment: [] },
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
              const rows = exec(sql, params);
              return rows[0] ?? null;
            },
            async all() {
              return { results: exec(sql, params) };
            },
          };
        },
      };
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push({ results: exec(statement.sql, statement.params), success: true });
      return results;
    },
  };
}

function seedHousehold(sqlite) {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES ('hh_i', 'I', 'active', 'America/Chicago', 1, 'synthetic_qa', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', 'synthetic')`
  ).run();
  sqlite.prepare(
    `INSERT INTO member
      (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES ('m_a', 'hh_i', 'm_a', 'owner', 'active', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
  ).run();
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
    ...overrides,
  };
}

function slotOp(target, extra) {
  return {
    target_kind: "weekday",
    target,
    op: "set",
    effort: null,
    ingredient_complexity: null,
    max_minutes: null,
    max_minutes_hard: null,
    special: null,
    cuisine: null,
    meal_style: null,
    ingredient: null,
    category: null,
    ...extra,
  };
}

function envFor(db, provider) {
  return {
    DB: db,
    AI_PROVIDER: "fake",
    AI_FAKE_PROVIDER: provider,
    AI_GATEWAY_ENABLED: "1",
    AI_TASKS_ENABLED: "planning_intent,discovery_intent",
    AI_DAILY_BUDGET_USD: "5",
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
      title: extra.title || slug,
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
      title: extra.title || slug,
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

describe("I1 discovery timeout budget", () => {
  it("falls back after one discovery attempt and records each attempt", async () => {
    const provider = createFakeProvider({ script: [{ hang: true }] });
    const store = createMemoryStore();
    const service = createGenerationService({
      provider,
      store,
      env: ON,
      now: () => new Date(),
      maxTimeoutMs: 40,
    });
    const started = Date.now();
    const result = await service.run("discovery_intent", DISC_IN("Shrimp for dinner tonight."), { fallback: null });
    const elapsed = Date.now() - started;
    expect(result).toMatchObject({ ok: false, error: "timeout" });
    expect(provider.calls).toHaveLength(1);
    expect(elapsed).toBeLessThan(1000);
    expect(TASKS.discovery_intent.limits.timeout_ms).toBe(6000);
    const meta = result.metadata;
    expect(meta.attempts).toBe(1);
    expect(meta.attempt_latencies_ms).toHaveLength(1);
    expect(meta.attempt_latencies_ms[0]).toBeGreaterThanOrEqual(20);
    const row = JSON.parse(store.usage.at(-1).usage_metadata_json);
    expect(row.attempts).toBe(1);
    expect(row.attempt_latencies_ms).toEqual(meta.attempt_latencies_ms);
  });

  it("still retries a creative timeout once", async () => {
    const provider = createFakeProvider({ script: [{ hang: true }] });
    const store = createMemoryStore();
    const service = createGenerationService({
      provider,
      store,
      env: ON,
      now: () => new Date(),
      maxTimeoutMs: 30,
    });
    const result = await service.run("recipe_draft", { text: "soup" }, { fallback: null });
    expect(result.error).toBe("timeout");
    expect(provider.calls).toHaveLength(2);
    expect(result.metadata.attempts).toBe(2);
    expect(result.metadata.attempt_latencies_ms).toHaveLength(2);
  });
});

describe("I2 portion counts", () => {
  it("splits two cozy dinners and one light one into three slots", () => {
    expect(parsePortionCounts("two cozy dinners and one light one")).toEqual({
      dinner_count: 3,
      portions: [
        { cue: "cozy", count: 2 },
        { cue: "light", count: 1 },
      ],
    });
    const applied = applyPlanningDelta(
      null,
      planningDelta({
        dinner_count: 4,
        list_ops: [
          { field: "intent_cues", op: "add", value: "cozy" },
          { field: "intent_cues", op: "add", value: "light" },
        ],
      }),
      { today: "2026-10-10", user_text: "two cozy dinners and one light one", vocabulary: {} }
    );
    expect(applied.state.dinner_count).toBe(3);
    expect(applied.state.intent_cues).toEqual([]);
    expect(applied.state.slots.map((slot) => slot.intent_cue)).toEqual(["cozy", "cozy", "light"]);
    const ack = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "4 dinners",
      state: applied.state,
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: "two cozy dinners and one light one",
    });
    expect(ack.acknowledgement).toMatch(/three dinners/);
    expect(ack.acknowledgement).toMatch(/two cozy/);
    expect(ack.acknowledgement).toMatch(/one light/);
    expect(ack.acknowledgement).not.toMatch(/four dinners/);
  });

  it("scores each slot's cue instead of both cues on every dinner", () => {
    const cozy = ["stews", "soups", "rich", "savory", "umami", "creamy"];
    const planned = planDinners(
      {
        dinner_count: 3,
        participant_ids: ["ana"],
        meal_styles: [],
        practical_hints: [],
        frequencies: [],
        intent_cues: [],
        weave_slots: [
          { position: 1, intent_cue: "cozy" },
          { position: 2, intent_cue: "cozy" },
          { position: 3, intent_cue: "light" },
        ],
      },
      {
        catalog: [
          meal("salad", { tags: ["citrusy", "fresh"], cuisine: "mexican", ingredient: "greens" }),
          meal("stew-a", { tags: cozy, cuisine: "american", ingredient: "beans" }),
          meal("stew-b", { tags: cozy, cuisine: "indian", ingredient: "lentils" }),
        ],
        constraints: [],
        tastes: [],
      }
    );
    expect(planned.slots.map((slot) => slot.recipe_slug)).toEqual(["stew-a", "stew-b", "salad"]);
  });

  it("keeps a single cozy request as one global cue", () => {
    const applied = applyPlanningDelta(
      null,
      planningDelta({
        dinner_count: 4,
        list_ops: [{ field: "intent_cues", op: "add", value: "cozy" }],
      }),
      { today: "2026-10-10", user_text: "Something cozy.", vocabulary: {} }
    );
    expect(applied.state.dinner_count).toBe(4);
    expect(applied.state.intent_cues).toEqual(["cozy"]);
  });
});

describe("I3 refinement no-op for every slot field", () => {
  it("says Wednesday is already vegetarian instead of repeating the dinner count", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    sqlite.prepare(
      `INSERT INTO dinner_plan
        (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
         created_by_member_id, created_at, updated_at)
       VALUES ('dp_i', 'hh_i', 'active', 4, 'plan_dinners', '{"dinner_count":4}', 'synthetic', 'm_a',
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
         VALUES (?, 'dp_i', ?, 'recipe', 'planned', ?, ?, ?, ?, 1, ?, 2, '[]', '[]', ?, 'easy', 'synthetic',
           '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
      ).run(`m${position}`, position, date, slug, `rec_${slug}`, `rv_${slug}`, title, tags);
    }
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_i", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [{ json: planningDelta({ acknowledgement: "4 dinners", slot_ops: [slotOp("wednesday", { category: "plant" })] }) }],
    });
    const res = await postWeave(envFor(db, provider), session.session_token, "/api/plan/interpret", {
      text: "make Wednesday vegetarian",
      state: { dinner_count: 4 },
      dinner_plan_id: "dp_i",
    });
    expect(res.status).toBe(200);
    expect(res.body.changed_positions).toEqual([]);
    expect(res.body.acknowledgement).toMatch(/Wednesday's already vegetarian/);
    expect(res.body.acknowledgement).not.toBe("4 dinners");
  });

  it("explains cuisine, minutes, ingredient, and style no-ops", () => {
    const previousSlots = [
      {
        position: 1,
        scheduled_date: "2026-10-14",
        recipe_version_id: "rv",
        title: "Tacos",
        cuisine: "mexican",
        tags: ["mexican", "tacos", "mushrooms"],
        vocabulary_tag_ids: ["mexican", "tacos", "mushrooms"],
        total_minutes: 20,
        effort_level: "moderate",
      },
    ];
    const cases = [
      [{ cuisine: "mexican" }, /Wednesday's already Mexican/],
      [{ max_minutes: 30 }, /Wednesday's already under 30 min/],
      [{ ingredient: "mushrooms" }, /Wednesday already has mushrooms/],
      [{ meal_style: "tacos" }, /Wednesday's already tacos/],
      [{ ingredient_complexity: "simple" }, /Wednesday's already simple/],
    ];
    previousSlots[0].ingredient_complexity = "simple";
    for (const [patch, pattern] of cases) {
      const ack = refinementAcknowledgement({
        preview: { changed_positions: [] },
        previousSlots,
        slots: [{ position: 1, weekday: "wednesday", ...patch }],
      });
      expect(ack?.text).toMatch(pattern);
    }
    const easy = refinementAcknowledgement({
      preview: { changed_positions: [] },
      previousSlots: [{ position: 2, scheduled_date: "2026-10-13", recipe_version_id: "rv2", effort_level: "easy", title: "Pork" }],
      slots: [{ position: 2, weekday: "tuesday", effort: "easy" }],
    });
    expect(easy.text).toMatch(/Tuesday's already one of the easiest/);
  });
});

describe("I4 acknowledgement details", () => {
  it("mentions exclusions and applied flavor and protein cues", () => {
    const excluded = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "4 dinners",
      state: { dinner_count: 4, exclude_ingredients: ["mushrooms"], intent_cues: [], frequencies: [] },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: "No mushrooms this week.",
    });
    expect(excluded.acknowledgement).toMatch(/no mushrooms/i);

    const bright = reconcileAcknowledgement({
      task: "discovery_intent",
      modelAck: "Got it.",
      state: {
        flavors: ["citrusy"],
        protein_groups: ["fish"],
        exclude_ingredients: [],
        intent_cues: [],
        ingredients: [],
        cuisines: [],
      },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: "bright and citrusy fish",
    });
    expect(bright.acknowledgement).toMatch(/bright/i);
    expect(bright.acknowledgement).toMatch(/citrusy/i);
    expect(bright.acknowledgement).toMatch(/fish/i);

    const cleared = removeDiscoveryChip(
      { exclude_ingredients: ["mushrooms"], protein_groups: ["fish"], flavors: ["citrusy"] },
      "exclude:mushrooms"
    );
    expect(cleared.exclude_ingredients).toEqual([]);
    expect(removeDiscoveryChip(cleared, "protein:fish").protein_groups).toEqual([]);
  });
});

describe("I5 live eval call cap", () => {
  it("counts only provider responses toward --max-calls", () => {
    const src = readFileSync(new URL("../scripts/eval-d06-live.mjs", import.meta.url), "utf8");
    const requestAt = src.indexOf("const res = await api");
    const countAt = src.indexOf('source === "provider"');
    expect(requestAt).toBeGreaterThan(0);
    expect(countAt).toBeGreaterThan(requestAt);
    expect(src.slice(0, requestAt)).not.toContain("calls += 1");
    expect(src).toContain('"max-calls"');
    expect(src).toMatch(/setTimeout/);
  });
});
