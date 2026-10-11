/**
 * Preview-eval fixes for the D-06.1 runtime.
 * AI-free plan paths use the real route and a provider that throws if called.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createD1Store, createGenerationService } from "../src/ai/index.js";
import { estimateInputTokens } from "../src/ai/gateway.js";
import { costUsd, effectiveMaxOutputTokens, worstCaseCostUsd } from "../src/ai/pricing.js";
import { renderPrompt } from "../src/ai/prompts.js";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { TASKS } from "../src/ai/tasks.js";
import { createMemberSession } from "../src/lib/session.js";
import { reconcileAcknowledgement } from "../src/weave/ack.js";
import { routeWeaveRequest } from "../src/weave/routes.js";
import { applySharedSemantics, dayScopedSoftCue, deriveCatalogCookingMethods, excludedByFrying } from "../src/weave/semantics.js";
import { applyDiscoveryDelta, emptyDiscoveryState, emptyPlanningState } from "../src/weave/state.js";

const fixedNow = () => new Date("2026-10-10T15:00:30.000Z");

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return sqlite;
}

function asD1(sqlite) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              sqlite.prepare(sql).run(...params);
              return { success: true, meta: { changes: 1 } };
            },
            async first() {
              return sqlite.prepare(sql).get(...params) ?? null;
            },
            async all() {
              return { results: sqlite.prepare(sql).all(...params) };
            },
          };
        },
      };
    },
  };
}

function asD1RejectingNegativeBinds(sqlite) {
  const check = (params) => {
    for (const value of params) {
      if (typeof value === "number" && value < 0) throw new Error("D1_ERROR: negative bind");
    }
  };
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            sql,
            params,
            async run() {
              check(params);
              sqlite.prepare(sql).run(...params);
              return { success: true, meta: { changes: 1 } };
            },
            async first() {
              check(params);
              return sqlite.prepare(sql).get(...params) ?? null;
            },
            async all() {
              check(params);
              return { results: sqlite.prepare(sql).all(...params) };
            },
          };
        },
      };
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) {
        check(statement.params);
        results.push({ results: sqlite.prepare(statement.sql).all(...statement.params), success: true });
      }
      return results;
    },
  };
}

function seedHousehold(sqlite, householdId = "hh_eval") {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES (?, 'Eval', 'active', 'UTC', 2, 'synthetic_qa', '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z', 'synthetic')`
  ).run(householdId);
  sqlite.prepare(
    `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES ('m_a', ?, 'A', 'owner', 'active', '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z')`
  ).run(householdId);
}

function seedPlan(sqlite, { id = "dp_eval", householdId = "hh_eval", meals }) {
  sqlite.prepare(
    `INSERT INTO dinner_plan
      (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
       created_by_member_id, created_at, updated_at)
     VALUES (?, ?, 'active', ?, 'plan_dinners', ?, 'synthetic', 'm_a', '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z')`
  ).run(id, householdId, meals.length, JSON.stringify({ dinner_count: meals.length }));
  for (const meal of meals) {
    sqlite.prepare(
      `INSERT INTO dinner_plan_meal
        (meal_id, dinner_plan_id, position, kind, state, scheduled_date, recipe_slug, recipe_id,
         recipe_version_id, version_number, title, base_servings, allergens_json, vocabulary_json,
         tags_json, effort_level, data_origin, created_at, updated_at)
       VALUES (?, ?, ?, 'recipe', 'planned', ?, ?, ?, ?, 1, ?, 2, '[]', '[]', '[]', ?, 'synthetic',
         '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z')`
    ).run(
      `${id}_m${meal.position}`,
      id,
      meal.position,
      meal.date ?? null,
      meal.slug,
      `rec_${meal.slug}`,
      `rv_${meal.slug}`,
      meal.title,
      meal.effort ?? null
    );
  }
}

function seedMeal(sqlite, { slug, title, methods = [], description = "" }) {
  sqlite.prepare(
    `INSERT INTO catalog_dish
      (dish_id, slug, title, name, cuisine, meal_format, primary_ingredient, description, tags_json, sparks_json, chips_json, created_at)
     VALUES (?, ?, ?, ?, 'american', 'bowls', 'beans', ?, '[]', '[]', '[]', '2026-10-11T00:00:00Z')`
  ).run(`dish_${slug}`, slug, title, title, description);
  sqlite.prepare(
    `INSERT INTO catalog_version
      (recipe_version_id, recipe_id, dish_id, version_number, title, description, base_servings, total_minutes,
       effort_level, ingredient_complexity, methods_json, dietary_tags_json, publication_status,
       visibility, content_hash, source_contract, source_path, created_at)
     VALUES (?, ?, ?, 1, ?, ?, 2, 30, 'easy', 'simple', ?, '[]', 'published', 'global', ?, 'test', ?, '2026-10-11T00:00:00Z')`
  ).run(`rv_${slug}`, `rec_${slug}`, `dish_${slug}`, title, description, JSON.stringify(methods), `hash-${slug}`, `test/${slug}`);
}

function throwingProvider() {
  return createFakeProvider({ script: [{ throw: { message: "provider should not run" } }] });
}

function planEnv(db, provider) {
  return {
    DB: db,
    AI_PROVIDER: "fake",
    AI_FAKE_PROVIDER: provider,
    AI_GATEWAY_ENABLED: "1",
    AI_TASKS_ENABLED: "planning_intent,discovery_intent",
    AI_DAILY_BUDGET_USD: "5",
  };
}

async function post(env, token, path, body) {
  const request = new Request(`https://example.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ schema_version: 1, timezone: "UTC", ...body }),
  });
  const res = await routeWeaveRequest(env, request, path);
  return { status: res.status, body: await res.json() };
}

function discoveryDelta(extra = {}) {
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
    ...extra,
  };
}

function cookingOf(slug) {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "catalog", slug, "v1.json"), "utf8"));
  return deriveCatalogCookingMethods([pkg])[0];
}

describe("day-targeted soft cue", () => {
  it("applies lighten-up Friday only to Friday and does not call the provider", async () => {
    expect(dayScopedSoftCue("four light dinners, make Friday special")).toBeNull();
    expect(dayScopedSoftCue("lighten up Friday")).toMatchObject({ weekday: "friday", cue: "light" });
    const sqlite = migrate();
    seedHousehold(sqlite);
    const meals = [
      { position: 1, date: "2026-10-12", slug: "miso-ginger-salmon", title: "Miso-Ginger Salmon" },
      { position: 2, date: "2026-10-13", slug: "cashew-pesto-pasta", title: "Cashew Pesto Pasta" },
      { position: 3, date: "2026-10-14", slug: "teriyaki-tofu-bowls", title: "Teriyaki Tofu Bowls" },
      { position: 4, date: "2026-10-16", slug: "smoky-lentil-sweet-potato-stew", title: "Smoky Lentil Sweet Potato Stew" },
    ];
    seedPlan(sqlite, { meals });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_eval", member_id: "m_a" });
    const provider = throwingProvider();
    const res = await post(planEnv(db, provider), session.session_token, "/api/plan/interpret", {
      text: "lighten up Friday",
      dinner_plan_id: "dp_eval",
      state: { ...emptyPlanningState(), dinner_count: 4 },
    });
    expect(res.status).toBe(200);
    expect(res.body.llm_called).toBe(false);
    expect(provider.calls).toHaveLength(0);
    expect(res.body.state.intent_cues || []).not.toContain("light");
    expect(res.body.state.slots.filter((slot) => slot.intent_cue === "light")).toEqual([
      expect.objectContaining({ position: 4, weekday: "friday", intent_cue: "light" }),
    ]);
    expect(res.body.changed_positions).toEqual([4]);
    expect(res.body.acknowledgement).toMatch(/^Friday's now lighter: .+\.$/);
    expect(res.body.acknowledgement).not.toMatch(/four light dinners/i);
    for (const meal of meals.slice(0, 3)) {
      expect(res.body.preview.slots.find((slot) => slot.position === meal.position).recipe_slug).toBe(meal.slug);
    }
    expect(res.body.preview.slots.find((slot) => slot.position === 4).recipe_slug).not.toBe(meals[3].slug);
  });
});

describe("weekend resolution", () => {
  it("targets the one weekend dinner on an undated plan without a provider call", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const meals = [
      { position: 1, slug: "miso-ginger-salmon", title: "Miso-Ginger Salmon" },
      { position: 2, slug: "cashew-pesto-pasta", title: "Cashew Pesto Pasta" },
      { position: 3, slug: "teriyaki-tofu-bowls", title: "Teriyaki Tofu Bowls" },
    ];
    seedPlan(sqlite, { meals });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_eval", member_id: "m_a" });
    const provider = throwingProvider();
    const res = await post(planEnv(db, provider), session.session_token, "/api/plan/interpret", {
      text: "go easier on the weekend",
      dinner_plan_id: "dp_eval",
      state: { ...emptyPlanningState(), dinner_count: 3 },
    });
    expect(res.status).toBe(200);
    expect(provider.calls).toHaveLength(0);
    expect(res.body.llm_called).toBe(false);
    expect(res.body.acknowledgement).toBeTruthy();
    expect(res.body.preview?.slots).toHaveLength(3);
    expect(res.body.telemetry?.route).toBe("deterministic");
    expect(res.body.state.slots.filter((slot) => slot.effort === "easy")).toEqual([
      expect.objectContaining({ position: 1, weekday: "sunday", effort: "easy" }),
    ]);
    expect(res.body.preview.slots.find((slot) => slot.position === 2).recipe_slug).toBe("cashew-pesto-pasta");
    expect(res.body.preview.slots.find((slot) => slot.position === 3).recipe_slug).toBe("teriyaki-tofu-bowls");
  });

  it("opens the chooser when more than one dinner is on the weekend", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedPlan(sqlite, {
      meals: [
        { position: 1, date: "2026-10-17", slug: "miso-ginger-salmon", title: "Miso-Ginger Salmon" },
        { position: 2, date: "2026-10-18", slug: "cashew-pesto-pasta", title: "Cashew Pesto Pasta" },
        { position: 3, date: "2026-10-19", slug: "teriyaki-tofu-bowls", title: "Teriyaki Tofu Bowls" },
      ],
    });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_eval", member_id: "m_a" });
    const provider = throwingProvider();
    const res = await post(planEnv(db, provider), session.session_token, "/api/plan/interpret", {
      text: "go easier on the weekend",
      dinner_plan_id: "dp_eval",
      state: { ...emptyPlanningState(), dinner_count: 3 },
    });
    expect(res.status).toBe(200);
    expect(provider.calls).toHaveLength(0);
    expect(res.body.preview).toBeNull();
    expect(res.body.choice?.candidates.map((row) => row.position)).toEqual([1, 2]);
    expect(res.body.choice?.multi).toBe(true);
    expect(res.body.state.pending_slot).toMatchObject({ effort: "easy" });
    expect(res.body.acknowledgement).toBeTruthy();
    expect(res.body.telemetry?.route).toBe("deterministic");
  });

  it("does not go silent when the plan has no weekend dinner", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedPlan(sqlite, {
      meals: [
        { position: 1, date: "2026-10-12", slug: "miso-ginger-salmon", title: "Miso-Ginger Salmon" },
        { position: 2, date: "2026-10-13", slug: "cashew-pesto-pasta", title: "Cashew Pesto Pasta" },
        { position: 3, date: "2026-10-14", slug: "teriyaki-tofu-bowls", title: "Teriyaki Tofu Bowls" },
      ],
    });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_eval", member_id: "m_a" });
    const provider = throwingProvider();
    const res = await post(planEnv(db, provider), session.session_token, "/api/plan/interpret", {
      text: "go easier on the weekend",
      dinner_plan_id: "dp_eval",
      state: { ...emptyPlanningState(), dinner_count: 3 },
    });
    expect(res.status).toBe(200);
    expect(provider.calls).toHaveLength(0);
    expect(res.body.acknowledgement).toMatch(/no weekend|Add days/i);
    expect(res.body.telemetry).toBeTruthy();
    expect(res.body.choice?.reason).toBe("weekend_absent");
  });
});

describe("family language and frying negations", () => {
  it("maps the whole family onto easy familiar food and does not search the phrase", () => {
    const applied = applyDiscoveryDelta(null, discoveryDelta({ text_residue: "whole family" }), {
      user_text: "something the whole family will eat",
    });
    expect(applied.state.text_residue).toBeNull();
    expect(applied.state.intent_cues).toContain("weeknight");
    expect(applied.state.keep_it_easy).toBe(true);
    expect(applied.state.keep_ingredients_simple).toBe(true);
    expect(applied.state.semantic_rank).toContain("mild");
    expect(applied.semantic.canonical_intents).toContain("family");
    const noun = applyDiscoveryDelta(null, discoveryDelta({ text_residue: "xylophone" }), { user_text: "xylophone" });
    expect(noun.state.text_residue).toBe("xylophone");
  });

  it("treats without frying as every frying method and boosts crispy non-fry meals", () => {
    const state = emptyDiscoveryState();
    const semantic = applySharedSemantics(state, {
      text: "crispy without frying",
      concepts: [{ id: "deep_fried", polarity: "avoid" }],
      task: "discovery_intent",
    });
    expect(state.exclude_cooking).toEqual(["deep", "pan", "shallow"]);
    expect(state.semantic_rank).toContain("crispy_non_fry");
    expect(semantic.canonical_intents).toContain("fried");
    const fish = cookingOf("crispy-fish-tacos-cabbage-slaw");
    const tofu = cookingOf("crispy-chipotle-tofu-tacos");
    expect(excludedByFrying({ cooking: fish.cooking }, state.exclude_cooking)).toBe(true);
    expect(excludedByFrying({ cooking: tofu.cooking }, state.exclude_cooking)).toBe(false);
    const deepOnly = emptyDiscoveryState();
    applySharedSemantics(deepOnly, { text: "crispy but not deep fried", concepts: [], task: "discovery_intent" });
    expect(deepOnly.exclude_cooking).toEqual(["deep"]);
    expect(deepOnly.semantic_rank).toContain("crispy_non_fry");
  });
});

describe("acknowledgements and telemetry", () => {
  it("names frying, crispy, filling, and a broader set, and does not invent a light filter", () => {
    const fried = reconcileAcknowledgement({
      task: "discovery_intent",
      modelAck: "Got it.",
      state: { ...emptyDiscoveryState(), exclude_cooking: ["deep", "pan", "shallow"] },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: "nothing fried",
    });
    expect(fried.acknowledgement.toLowerCase()).toMatch(/no fried/);
    expect(fried.acknowledgement).not.toBe("Got it.");

    const crispy = reconcileAcknowledgement({
      task: "discovery_intent",
      modelAck: "Got it.",
      state: { ...emptyDiscoveryState(), exclude_cooking: ["deep", "pan", "shallow"], semantic_rank: ["crispy_non_fry"] },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: "crispy without frying",
    });
    expect(crispy.acknowledgement.toLowerCase()).toMatch(/crispy/);
    expect(crispy.acknowledgement.toLowerCase()).toMatch(/no fried/);

    const healthy = applyDiscoveryDelta(null, discoveryDelta({
      concepts: [
        { id: "healthy", polarity: "prefer" },
        { id: "filling", polarity: "prefer" },
      ],
    }), { user_text: "Healthy but filling" });
    expect(healthy.semantic.primary_ack.toLowerCase()).toMatch(/filling/);
    expect(healthy.semantic.primary_ack.toLowerCase()).toMatch(/lighter/);
    expect(healthy.semantic.primary_ack.toLowerCase()).not.toMatch(/\bhealthy\b/);

    const shrimp = reconcileAcknowledgement({
      task: "discovery_intent",
      modelAck: "",
      state: { ...emptyDiscoveryState(), intent_cues: ["light"], semantic_rank: ["vegetable_forward", "fewer_fried"] },
      conflicts: [{ token: "shrimp", field: "ingredients", code: "hard_limit" }],
      dropped: [],
      removedTokens: ["shrimp"],
      userText: "healthy with shrimp",
    });
    expect(shrimp.acknowledgement.toLowerCase()).not.toMatch(/not too heavy is still on/);
  });

  it("reports a restaurant-style cue that arrived as a list op", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedMeal(sqlite, { slug: "miso-ginger-salmon", title: "Miso-Ginger Salmon", methods: ["grill"] });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_eval", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [{
        json: discoveryDelta({
          keep_it_easy: true,
          list_ops: [{ field: "intent_cues", op: "add", value: "restaurant_like" }],
        }),
      }],
    });
    const res = await post({
      ...planEnv(db, provider),
      CATALOG_SOURCE: "d1",
    }, session.session_token, "/api/discovery/interpret", {
      text: "Like a restaurant, but easy",
      state: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.state.intent_cues).toContain("restaurant_like");
    expect(res.body.telemetry.canonical_intents).toContain("restaurant_like");
  });

  it("names a broader set for an unknown adjective", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedMeal(sqlite, { slug: "miso-ginger-salmon", title: "Miso-Ginger Salmon", methods: ["grill"] });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_eval", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [{ json: discoveryDelta({ text_residue: "snorfblat", concepts: [{ id: "snorfblat", polarity: "prefer" }] }) }],
    });
    const res = await post({
      ...planEnv(db, provider),
      CATALOG_SOURCE: "d1",
    }, session.session_token, "/api/discovery/interpret", {
      text: "Something snorfblat",
      state: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.acknowledgement.toLowerCase()).toMatch(/broader/);
    expect(res.body.acknowledgement.toLowerCase()).not.toContain("snorfblat");
    expect(res.body.acknowledgement).not.toBe("Got it.");
  });
});

describe("chooser apply", () => {
  it("applies every chosen position with the pending patch and no provider call", async () => {
    const bridge = readFileSync(new URL("../public/weave-bridge.js", import.meta.url), "utf8");
    expect(bridge).not.toContain("target_position: positions[0]");
    expect(bridge).toContain("slot_choice: { positions }");

    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_eval", member_id: "m_a" });
    const provider = throwingProvider();
    const env = planEnv(db, provider);
    const state = { ...emptyPlanningState(), dinner_count: 3, pending_slot: { effort: "easy" } };
    const applied = await post(env, session.session_token, "/api/plan/apply", {
      state,
      slot_choice: { positions: [1, 3] },
    });
    expect(applied.status).toBe(200);
    expect(applied.body.state.slots.filter((slot) => slot.effort === "easy").map((slot) => slot.position)).toEqual([1, 3]);
    expect(applied.body.state.pending_slot).toBeUndefined();

    const interpreted = await post(env, session.session_token, "/api/plan/interpret", {
      text: "go easier on the weekend",
      target_positions: [1, 2],
      state: { ...emptyPlanningState(), dinner_count: 3 },
    });
    expect(interpreted.status).toBe(200);
    expect(interpreted.body.llm_called).toBe(false);
    expect(interpreted.body.state.slots.filter((slot) => slot.effort === "easy").map((slot) => slot.position)).toEqual([1, 2]);
    expect(provider.calls).toHaveLength(0);
  });
});

describe("spend settlement", () => {
  it("refunds the reserved worst case down to the actual cost", async () => {
    const sqlite = migrate();
    const db = asD1RejectingNegativeBinds(sqlite);
    const store = createD1Store(db);
    const provider = createFakeProvider({ script: [{ json: { text: "Fits the evening." } }] });
    const service = createGenerationService({
      provider,
      store,
      env: {
        AI_GATEWAY_ENABLED: "1",
        AI_TASKS_ENABLED: "explanation",
        AI_DAILY_BUDGET_USD: "5",
      },
      now: fixedNow,
    });
    const input = { meal: "meal 0", reasons: ["quick"], cache_bust: "a" };
    const result = await service.run("explanation", input, { householdId: "hh_eval" });
    expect(result.ok).toBe(true);
    const actual = Math.ceil(result.estimated_cost_usd * 1e6);
    const prompt = renderPrompt("explanation", input);
    const reserved = Math.ceil(
      worstCaseCostUsd("gpt-6-luna", estimateInputTokens(prompt), effectiveMaxOutputTokens(TASKS.explanation.limits.max_output_tokens, "gpt-6-luna"))
      * (TASKS.explanation.limits.max_retries + 1)
      * 1e6
    );
    expect(actual).toBeGreaterThan(0);
    expect(actual).toBeLessThan(reserved);
    expect(await store.counterValue("spend_day:2026-10-10")).toBe(actual);
    expect(costUsd("gpt-6-luna", { input_tokens: 1, output_tokens: 1 })).toBeGreaterThan(0);
  });
});
