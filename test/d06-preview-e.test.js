/**
 * Preview-eval defects E1–E8. Each case fails on the pre-fix behavior:
 * empty ack rejected, frequencies ignored, weekday slot smeared by index,
 * missing dinner count rejected, short uncached prompts, shellfish alternative
 * dropped, cache-write double billed, service worker left on fw-sw-v23.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { createGenerationService, createMemoryStore, TASKS } from "../src/ai/index.js";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { PROMPTS, renderPrompt } from "../src/ai/prompts.js";
import { costUsd } from "../src/ai/pricing.js";
import { elapsedMs, monotonicNow } from "../src/lib/clock.js";
import { planDinners, plannerCatalog } from "../src/lib/dinner-planner.js";
import { assertDinnerCount } from "../src/lib/plan-contract.js";
import { createMemberSession } from "../src/lib/session.js";
import { checkSwInvariant, readSw } from "../scripts/release/sw-invariant.mjs";
import { reconcileAcknowledgement } from "../src/weave/ack.js";
import { detectPlanningConflicts, frequencyConflicts } from "../src/weave/conflicts.js";
import { applyPlanningDelta, datesFromPlanMeals, usualDinnerCount } from "../src/weave/state.js";
import { postValidateDiscoveryDelta, postValidatePlanningDelta } from "../src/weave/task-schemas.js";
import { routeWeaveRequest } from "../src/weave/routes.js";

function meal(slug, extra = {}) {
  return {
    concept: {
      concept_id: slug,
      title: extra.title || slug,
      cuisine: extra.cuisine || "american",
      primary_ingredient: extra.ingredient || "beans",
      tags: extra.tags || [],
      current_version: { methods: [] },
      exploration: extra.exploration ?? 0.2,
    },
    pkg: {
      recipe_id: `rcp_${slug}`,
      recipe_version_id: extra.recipe_version_id || `rv_${slug}_v1`,
      version_number: 1,
      title: extra.title || slug,
      total_minutes: 30,
      effort_level: extra.effort || "easy",
      ingredient_complexity: "simple",
      vocabulary_tag_ids: extra.tags || [],
      ingredients: [{ name: extra.ingredient || "salt", note: null }],
      allergens: extra.allergens || [],
      equipment: [],
      exploration: extra.exploration ?? 0.2,
    },
  };
}

const CATALOG = [
  meal("a-pasta", { tags: ["pasta"], cuisine: "italian", ingredient: "noodles" }),
  meal("b-pasta", { tags: ["pasta"], cuisine: "japanese", ingredient: "soba" }),
  meal("c-pork", { cuisine: "american", ingredient: "pork" }),
  meal("d-curry", { tags: ["curries"], cuisine: "indian", ingredient: "chickpeas" }),
  meal("m-cod", { allergens: ["finfish"], cuisine: "nordic", ingredient: "cod" }),
  meal("n-char", { allergens: ["finfish"], cuisine: "canadian", ingredient: "char" }),
];

function planIntent(overrides = {}) {
  return {
    dinner_count: 4,
    participant_ids: ["ana"],
    meal_styles: [],
    practical_hints: [],
    frequencies: [],
    weave_slots: [],
    ...overrides,
  };
}

function planningDelta(overrides = {}) {
  return {
    acknowledgement: "",
    clear: [],
    dinner_count: null,
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

function fishCount(slots) {
  return slots.filter((slot) => slot.recipe_slug === "m-cod" || slot.recipe_slug === "n-char").length;
}

describe("E1 empty acknowledgement", () => {
  it("accepts a valid intent whose acknowledgement is empty", () => {
    const delta = planningDelta({ dinner_count: 3, keep_it_easy: true });
    const planning = postValidatePlanningDelta(delta);
    const discovery = postValidateDiscoveryDelta(delta, { vocabulary: {} });
    expect(planning.ok).toBe(true);
    expect(planning.reason).toBeUndefined();
    expect(discovery.ok).toBe(true);
    expect(discovery.reason).toBeUndefined();
  });

  it("does not spend the repair retry on an empty acknowledgement", async () => {
    const provider = createFakeProvider({ script: [{ json: planningDelta({ dinner_count: 3, keep_it_easy: true }) }] });
    const service = createGenerationService({
      provider,
      store: createMemoryStore(),
      env: { AI_GATEWAY_ENABLED: "1", AI_TASKS_ENABLED: "planning_intent", AI_DAILY_BUDGET_USD: "5" },
      now: () => new Date("2026-10-10T15:00:00.000Z"),
    });
    const result = await service.run(
      "planning_intent",
      { text: "Plan three easy dinners this week.", state: null, context: { today: "2026-10-10" } },
      { householdId: "hh_e1" }
    );
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(provider.calls).toHaveLength(1);
  });

  it("composes the acknowledgement from the applied intent when the model echoes the user", () => {
    const text = "Plan three easy dinners this week.";
    const ack = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: text,
      state: { dinner_count: 3, keep_it_easy: true },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: text,
    });
    expect(ack.acknowledgement_source).toBe("reconciled");
    expect(ack.acknowledgement).not.toBe(text);
    expect(ack.acknowledgement).toMatch(/three dinners/);
    expect(ack.acknowledgement).toMatch(/mostly easy/);
  });
});

describe("E2 category frequency", () => {
  it("places two fish and at most one pasta when those meals exist", () => {
    const planned = planDinners(
      planIntent({
        frequencies: [
          { token: "fish", min_count: 2, max_count: 2 },
          { token: "pasta", min_count: null, max_count: 1 },
        ],
      }),
      { catalog: CATALOG, constraints: [], tastes: [] }
    );
    expect(fishCount(planned.slots)).toBe(2);
    expect(planned.slots.filter((slot) => slot.recipe_slug.endsWith("pasta"))).toHaveLength(1);
    expect(planned.constrained_requests.filter((row) => row.field === "frequency")).toEqual([]);
    expect(frequencyConflicts(planned)).toEqual([]);
  });

  it("returns a frequency conflict when fewer eligible meals exist than the minimum", () => {
    const planned = planDinners(
      planIntent({ frequencies: [{ token: "fish", min_count: 2, max_count: 2 }] }),
      { catalog: CATALOG.filter((entry) => entry.concept.concept_id !== "n-char"), constraints: [], tastes: [] }
    );
    expect(fishCount(planned.slots)).toBe(1);
    expect(planned.constrained_requests).toContainEqual(
      expect.objectContaining({ field: "frequency", token: "fish", min_count: 2, placed: 1, reason: "insufficient_eligible" })
    );
    expect(frequencyConflicts(planned)[0]).toMatchObject({ code: "frequency_unfilled", token: "fish", placed: 1 });
  });
});

describe("E3 weekday refinement", () => {
  const meals = [
    { position: 1, scheduled_date: "2026-10-13", recipe_slug: "c-pork", recipe_version_id: "rv_pork", title: "Pork" },
    { position: 2, scheduled_date: "2026-10-14", recipe_slug: "b-beans", recipe_version_id: "rv_beans", title: "Beans" },
    { position: 3, scheduled_date: "2026-10-15", recipe_slug: "a-pasta", recipe_version_id: "rv_pasta", title: "Pasta" },
    { position: 4, scheduled_date: "2026-10-16", recipe_slug: "d-curry", recipe_version_id: "rv_curry", title: "Curry" },
  ];

  it("maps a weekday through the plan's meal dates", () => {
    const dates = datesFromPlanMeals(meals);
    expect(dates.find((row) => row.weekday === "friday")).toEqual({ position: 4, date: "2026-10-16", weekday: "friday" });
    const { state } = applyPlanningDelta(
      { dinner_count: 4, slots: [] },
      planningDelta({
        slot_ops: [{ target_kind: "weekday", target: "friday", op: "set", special: true }],
      }),
      { today: "2026-10-10", dates, vocabulary: {} }
    );
    expect(state.slots).toEqual([
      expect.objectContaining({ position: 4, date: "2026-10-16", weekday: "friday", special: true }),
    ]);
  });

  it("changes only the named position and reports that position", () => {
    const planned = planDinners(
      planIntent({
        weave_slots: [{ position: 4, weekday: "friday", date: "2026-10-16", special: true }],
      }),
      { catalog: CATALOG, constraints: [], tastes: [], previous_slots: meals }
    );
    expect(planned.slots.slice(0, 3).map((slot) => slot.recipe_version_id)).toEqual(["rv_pork", "rv_beans", "rv_pasta"]);
    expect(planned.changed_positions).toEqual([4]);
    expect(planned.slots[3].recipe_version_id).not.toBe("rv_curry");
  });

  it("does not smear a position-less weekday onto dinner 1", () => {
    const planned = planDinners(
      planIntent({ weave_slots: [{ weekday: "friday", special: true }] }),
      { catalog: CATALOG, constraints: [], tastes: [], previous_slots: meals }
    );
    expect(planned.slots.map((slot) => slot.recipe_version_id)).toEqual(["rv_pork", "rv_beans", "rv_pasta", "rv_curry"]);
    expect(planned.changed_positions).toEqual([]);
  });
});

describe("E4 missing dinner count", () => {
  it("keeps an explicit plan create strict", () => {
    expect(assertDinnerCount(undefined).error).toBe("dinner_count_required");
  });

  it("defaults an omitted count to the household usual, or 3, and says so", () => {
    expect(usualDinnerCount(4)).toEqual({ count: 4, usual: true });
    expect(usualDinnerCount(null)).toEqual({ count: 3, usual: false });
    const applied = applyPlanningDelta(null, planningDelta({ keep_it_easy: true, acknowledgement: "Keep it easy." }), {
      today: "2026-10-10",
      vocabulary: {},
      dinner_count_default: 3,
    });
    expect(applied.dinner_count_defaulted).toBe(true);
    expect(applied.state.dinner_count).toBe(3);
    const ack = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "Keep it easy.",
      state: applied.state,
      conflicts: [],
      dropped: [],
      removedTokens: [],
      dinnerCountDefaulted: true,
      dinnerCountUsual: false,
    });
    expect(ack.acknowledgement_source).toBe("reconciled");
    expect(ack.acknowledgement).toMatch(/three dinners to start/);
    const usual = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "",
      state: { dinner_count: 4 },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      dinnerCountDefaulted: true,
      dinnerCountUsual: true,
    });
    expect(usual.acknowledgement).toMatch(/your usual four dinners/);
  });
});

describe("E5 prompt cache, effort, and the planning clock", () => {
  it("puts a long stable prefix before the variable request", () => {
    const first = renderPrompt("planning_intent", {
      text: "Plan three easy dinners.",
      state: { dinner_count: 3, keep_it_easy: null, slots: [] },
      context: { today: "2026-10-10", vocabulary: { ingredients: ["salmon", "shrimp"] }, diners: 2 },
    });
    const second = renderPrompt("planning_intent", {
      text: "Make Friday special.",
      state: { dinner_count: 4 },
      context: { today: "2026-10-16", vocabulary: { ingredients: ["cod"] } },
    });
    expect(first.version).toBe("planning_intent@4");
    expect(PROMPTS.discovery_intent.version).toBe("discovery_intent@4");
    expect(first.system).toBe(second.system);
    expect(first.system.length).toBeGreaterThanOrEqual(4096);
    expect(PROMPTS.discovery_intent.system.length).toBeGreaterThanOrEqual(4096);
    expect(first.user.startsWith("Request:")).toBe(true);
    expect(first.user.indexOf("Plan three easy dinners.")).toBeLessThan(first.user.indexOf("2026-10-10"));
    expect(first.user).not.toContain("salmon");
    expect(first.user).not.toContain("shrimp");
    expect(second.user).toContain("Make Friday special.");
    expect(TASKS.planning_intent.reasoning_effort).toBe("none");
    expect(TASKS.discovery_intent.reasoning_effort).toBe("none");
  });

  it("measures CPU time while Date.now is frozen", () => {
    const frozen = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(frozen);
    const start = monotonicNow();
    let i = 0;
    while ((elapsedMs(start) ?? 0) === 0 && i < 5e7) i += 1;
    spy.mockRestore();
    expect(i).toBeLessThan(5e7);
    expect(elapsedMs(start)).toBeGreaterThan(0);
  });
});

describe("E6 shellfish plan alternative", () => {
  it("fills the slots with fish and uses planning copy", () => {
    const detected = detectPlanningConflicts(
      {
        dinner_count: 2,
        include_ingredients: [],
        exclude_ingredients: [],
        frequencies: [{ token: "shrimp", min_count: 2, max_count: 2 }],
        slots: [],
        cuisines: [],
        meal_styles: [],
        intent_cues: [],
      },
      {
        participantIds: ["ana"],
        constraints: [{ member_id: "ana", rule_key: "shellfish", status: "prohibited" }],
        tastes: [],
      }
    );
    expect(detected.conflicts[0]).toMatchObject({
      code: "hard_ineligible",
      token: "shrimp",
      alternative: { kind: "category", token: "fish" },
    });
    expect(detected.repaired.frequencies).toContainEqual(
      expect.objectContaining({ token: "fish", min_count: 2, max_count: 2 })
    );
    const planned = planDinners(
      {
        dinner_count: 2,
        participant_ids: ["ana"],
        meal_styles: [],
        practical_hints: [],
        frequencies: detected.repaired.frequencies,
        weave_slots: detected.repaired.slots,
      },
      {
        constraints: [{ member_id: "ana", rule_key: "shellfish", status: "prohibited" }],
        tastes: [],
      }
    );
    const bySlug = new Map(plannerCatalog().map((entry) => [entry.concept.concept_id, entry]));
    const allergensOf = (slot) => bySlug.get(slot.recipe_slug)?.pkg.allergens || [];
    expect(planned.slots.every((slot) => slot.result === "recommended")).toBe(true);
    expect(planned.slots.filter((slot) => allergensOf(slot).includes("finfish"))).toHaveLength(2);
    expect(planned.slots.filter((slot) => allergensOf(slot).includes("shellfish"))).toHaveLength(0);
    const ack = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "Shrimp both nights.",
      state: detected.repaired,
      conflicts: detected.conflicts,
      dropped: [],
      removedTokens: detected.removed,
    });
    expect(ack.acknowledgement).toMatch(/these dinners are fish/);
    expect(ack.acknowledgement).not.toMatch(/find another seafood/);
    const findAck = reconcileAcknowledgement({
      task: "discovery_intent",
      modelAck: "Shrimp tonight.",
      state: {},
      conflicts: detected.conflicts,
      dropped: [],
      removedTokens: ["shrimp"],
    });
    expect(findAck.acknowledgement).toMatch(/looked for fish/);
  });
});

describe("E7 token cost", () => {
  it("matches input and output tokens without billing cache writes twice", () => {
    expect(costUsd("gpt-6-luna", { input_tokens: 1346, output_tokens: 159, cache_write_tokens: 1346 })).toBe(0.000214);
    expect(costUsd("gpt-6-luna", { input_tokens: 1346, cached_input_tokens: 200, output_tokens: 159, cache_write_tokens: 1346 })).toBe(
      costUsd("gpt-6-luna", { input_tokens: 1346, cached_input_tokens: 200, output_tokens: 159 })
    );
  });
});

describe("E8 service worker cache", () => {
  it("bumps the cache version and keeps the shell hash in step", () => {
    expect(readSw().version).toBe("fw-sw-v46");
    const check = checkSwInvariant();
    expect(check.ok, check.problems.join("; ")).toBe(true);
    expect(check.version).toBe("fw-sw-v46");
  });
});

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

function seedHousehold(sqlite) {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES ('hh_e', 'E', 'active', 'America/Chicago', 2, 'synthetic_qa', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', 'synthetic')`
  ).run();
  sqlite.prepare(
    `INSERT INTO member
      (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES ('m_a', 'hh_e', 'A', 'owner', 'active', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
  ).run();
}

const NIGHTS = [
  ["m1", 1, "2026-10-13", "rv_pork", "Pork"],
  ["m2", 2, "2026-10-14", "rv_beans", "Beans"],
  ["m3", 3, "2026-10-15", "rv_pasta", "Pasta"],
  ["m4", 4, "2026-10-16", "rv_curry", "Curry"],
];

function seedDatedPlan(sqlite) {
  sqlite.prepare(
    `INSERT INTO dinner_plan
      (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
       created_by_member_id, created_at, updated_at)
     VALUES ('dp_e3', 'hh_e', 'active', 4, 'plan_dinners', '{"dinner_count":4}', 'synthetic', 'm_a',
       '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
  ).run();
  for (const [id, position, date, version, title] of NIGHTS) {
    sqlite.prepare(
      `INSERT INTO dinner_plan_meal
        (meal_id, dinner_plan_id, position, kind, state, scheduled_date, recipe_slug, recipe_id,
         recipe_version_id, version_number, title, base_servings, allergens_json, vocabulary_json,
         tags_json, data_origin, created_at, updated_at)
       VALUES (?, 'dp_e3', ?, 'recipe', 'planned', ?, ?, ?, ?, 1, ?, 2, '[]', '[]', '[]', 'synthetic',
         '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run(id, position, date, version, version, version, title);
  }
}

async function postPlan(env, token, body) {
  const request = new Request("https://example.test/api/plan/interpret", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ schema_version: 1, ...body }),
  });
  const res = await routeWeaveRequest(env, request, "/api/plan/interpret");
  return { status: res.status, body: await res.json() };
}

describe("plan interpret route", () => {
  it("reconciles an empty acknowledgement and defaults a missing count without a retry", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_e", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [{ json: planningDelta({ keep_it_easy: true, acknowledgement: "" }) }],
    });
    const env = {
      DB: db,
      AI_PROVIDER: "fake",
      AI_FAKE_PROVIDER: provider,
      AI_GATEWAY_ENABLED: "1",
      AI_TASKS_ENABLED: "planning_intent",
      AI_DAILY_BUDGET_USD: "5",
    };
    const res = await postPlan(env, session.session_token, { text: "Keep most of these dinners easy.", state: null });
    expect(res.status).toBe(200);
    expect(res.body.fallback_code).toBeNull();
    expect(res.body.state.dinner_count).toBe(3);
    expect(res.body.acknowledgement).toMatch(/three dinners to start/);
    expect(provider.calls).toHaveLength(1);
    expect(res.body.deterministic_latency_ms).toBeNull();
  });

  it("uses the household's last plan length as the usual count", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedDatedPlan(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_e", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: planningDelta({ acknowledgement: "", keep_it_easy: true }) }] });
    const env = {
      DB: db,
      AI_PROVIDER: "fake",
      AI_FAKE_PROVIDER: provider,
      AI_GATEWAY_ENABLED: "1",
      AI_TASKS_ENABLED: "planning_intent",
      AI_DAILY_BUDGET_USD: "5",
    };
    const res = await postPlan(env, session.session_token, { text: "Keep it easy.", state: null });
    expect(res.body.fallback_code).toBeNull();
    expect(res.body.state.dinner_count).toBe(4);
    expect(res.body.acknowledgement).toMatch(/your usual/);
  });

  it("refines Friday on a dated plan without moving the other nights or dropping the date", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedDatedPlan(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_e", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [
        {
          json: planningDelta({
            acknowledgement: "",
            slot_ops: [
              {
                target_kind: "weekday",
                target: "friday",
                op: "set",
                effort: null,
                ingredient_complexity: null,
                max_minutes: null,
                max_minutes_hard: null,
                special: true,
                cuisine: null,
                meal_style: null,
                ingredient: null,
                category: null,
              },
            ],
          }),
        },
      ],
    });
    const env = {
      DB: db,
      AI_PROVIDER: "fake",
      AI_FAKE_PROVIDER: provider,
      AI_GATEWAY_ENABLED: "1",
      AI_TASKS_ENABLED: "planning_intent",
      AI_DAILY_BUDGET_USD: "5",
    };
    const res = await postPlan(env, session.session_token, {
      text: "Make Friday something more special.",
      state: { dinner_count: 4 },
      dinner_plan_id: "dp_e3",
    });
    expect(res.body.fallback_code).toBeNull();
    expect(res.body.state.slots[0]).toMatchObject({ position: 4, date: "2026-10-16", weekday: "friday", special: true });
    expect(res.body.preview.slots.slice(0, 3).map((slot) => slot.recipe_version_id)).toEqual(["rv_pork", "rv_beans", "rv_pasta"]);
    expect(res.body.changed_positions).toEqual([4]);
    expect(provider.calls).toHaveLength(1);
  });
});
