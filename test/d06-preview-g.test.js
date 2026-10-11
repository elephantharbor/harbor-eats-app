/**
 * Preview-eval cycle 3 defects G1–G8. Each case fails on the pre-fix behavior.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { elapsedMs, monotonicNow } from "../src/lib/clock.js";
import { createMemberSession } from "../src/lib/session.js";
import { reconcileAcknowledgement } from "../src/weave/ack.js";
import { detectDiscoveryConflicts, detectPlanningConflicts } from "../src/weave/conflicts.js";
import { discoveryStateToQuery } from "../src/weave/discovery-map.js";
import { routeWeaveRequest } from "../src/weave/routes.js";
import corpus from "./fixtures/d06-intent-corpus.json" with { type: "json" };

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return sqlite;
}

function asD1(sqlite, log = null) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              if (log) log.push(sql);
              sqlite.prepare(sql).run(...params);
              return { success: true, meta: { changes: 1 } };
            },
            async first() {
              if (log) log.push(sql);
              return sqlite.prepare(sql).get(...params) ?? null;
            },
            async all() {
              if (log) log.push(sql);
              return { results: sqlite.prepare(sql).all(...params) };
            },
          };
        },
      };
    },
  };
}

function seedHousehold(sqlite, { householdId = "hh_g", members = ["m_a"] } = {}) {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES (?, 'G', 'active', 'America/Chicago', ?, 'synthetic_qa', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', 'synthetic')`
  ).run(householdId, members.length);
  members.forEach((memberId, index) => {
    sqlite.prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run(memberId, householdId, memberId, index === 0 ? "owner" : "member");
  });
}

function seedMeal(sqlite, { slug, title, allergen, ingredient = null, minutes = 25, effort = "easy" }) {
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
     VALUES (?, ?, ?, 1, ?, 2, ?, ?, 'simple', '[]', '[]', 'published', 'global', ?, 'test', ?, '2026-10-10T00:00:00Z')`
  ).run(version, `rec_${slug}`, dish, title, minutes, effort, `hash-${slug}`, `test/${slug}`);
  if (allergen) {
    sqlite.prepare(`INSERT INTO catalog_allergen (recipe_version_id, allergen) VALUES (?, ?)`).run(version, allergen);
  }
  if (ingredient) {
    sqlite.prepare(
      `INSERT INTO catalog_ingredient (recipe_version_id, position, ingredient_id, name) VALUES (?, 1, ?, ?)`
    ).run(version, ingredient, ingredient);
  }
}

function seedLimit(sqlite, { householdId = "hh_g", memberId, rule }) {
  sqlite.prepare(
    `INSERT INTO constraint_rule
      (constraint_id, household_id, member_id, rule_key, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'prohibited', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
  ).run(`cr_${householdId}_${memberId}_${rule}`, householdId, memberId, rule);
}

function discoveryDelta(overrides = {}) {
  return {
    acknowledgement: "Got it.",
    clear: [],
    text_residue: null,
    max_minutes: null,
    max_minutes_hard: null,
    quick: null,
    different: null,
    keep_it_easy: null,
    keep_ingredients_simple: null,
    list_ops: [],
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
    ...overrides,
  };
}

function envFor(db, provider, tasks = "planning_intent,discovery_intent", { catalog = true } = {}) {
  return {
    DB: db,
    ...(catalog ? { CATALOG_SOURCE: "d1" } : {}),
    AI_PROVIDER: "fake",
    AI_FAKE_PROVIDER: provider,
    AI_GATEWAY_ENABLED: "1",
    AI_TASKS_ENABLED: tasks,
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

const SHELLFISH = [{ member_id: "m_a", rule_key: "shellfish", status: "prohibited" }];

describe("G2 shrimp find alternative", () => {
  it("searches for fish, drops filler residue, and acks the query that ran", () => {
    const detected = detectDiscoveryConflicts(
      {
        ingredients: ["shrimp"],
        protein_groups: [],
        cuisines: [],
        meal_styles: [],
        flavors: [],
        diet: [],
        intent_cues: [],
        text_residue: "dinner tonight",
      },
      { participantIds: ["m_a"], constraints: SHELLFISH, tastes: [], userText: "Shrimp for dinner tonight." }
    );
    expect(detected.conflicts[0]).toMatchObject({
      code: "hard_ineligible",
      token: "shrimp",
      limit_ids: ["no_shellfish"],
      alternative: { kind: "category", token: "fish" },
    });
    expect(detected.repaired.protein_groups).toContain("fish");
    expect(detected.repaired.ingredients || []).not.toContain("shrimp");
    expect(detected.repaired.text_residue).toBeFalsy();
    const query = discoveryStateToQuery(detected.repaired, {});
    expect(query.query.text || null).toBeFalsy();
    expect(query.query.criteria.protein_groups).toContain("fish");
  });

  it("returns fish dinners instead of an empty page", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedLimit(sqlite, { memberId: "m_a", rule: "shellfish" });
    seedMeal(sqlite, { slug: "arctic-char", title: "Arctic Char", allergen: "finfish", minutes: 30 });
    seedMeal(sqlite, { slug: "shrimp-scampi", title: "Shrimp Scampi", allergen: "shellfish", ingredient: "shrimp", minutes: 20 });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_g", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [{ json: discoveryDelta({ text_residue: "dinner tonight", list_ops: [{ field: "ingredients", op: "add", value: "shrimp" }] }) }],
    });
    const res = await postWeave(envFor(db, provider), session.session_token, "/api/discovery/interpret", {
      text: "Shrimp for dinner tonight.",
    });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.results.map((row) => row.title)).toContain("Arctic Char");
    expect(res.body.results.map((row) => row.title)).not.toContain("Shrimp Scampi");
    expect(res.body.state.text_residue).toBeFalsy();
    expect(res.body.acknowledgement.toLowerCase()).toMatch(/fish/);
    expect(res.body.acknowledgement).not.toMatch(/another seafood dinner/);
  });
});

describe("G3 conflicts across every positive request", () => {
  it("conflicts peanut and shellfish even when peanut never lands in ingredients", () => {
    const detected = detectDiscoveryConflicts(
      {
        ingredients: [],
        protein_groups: ["shellfish"],
        cuisines: [],
        meal_styles: [],
        flavors: [],
        diet: [],
        intent_cues: [],
        text_residue: null,
      },
      {
        participantIds: ["m_a", "m_b"],
        constraints: [
          { member_id: "m_a", rule_key: "nuts", status: "prohibited" },
          { member_id: "m_b", rule_key: "shellfish", status: "prohibited" },
        ],
        tastes: [],
        userText: "Peanut noodles with shrimp.",
      }
    );
    const tokens = detected.conflicts.map((row) => row.token);
    expect(tokens).toContain("peanut");
    expect(tokens).toContain("shellfish");
    expect(detected.conflicts.find((row) => row.token === "peanut").limit_ids).toContain("no_nuts");
    expect(detected.conflicts.find((row) => row.token === "shellfish").alternative).toEqual({ kind: "category", token: "fish" });
    expect(detected.repaired.protein_groups).toContain("fish");
    expect(detected.repaired.protein_groups).not.toContain("shellfish");
  });

  it("conflicts steak for a no-meat diner when the model only kept a cue", () => {
    const detected = detectPlanningConflicts(
      {
        dinner_count: 2,
        include_ingredients: [],
        exclude_ingredients: [],
        frequencies: [],
        slots: [],
        cuisines: [],
        meal_styles: [],
        intent_cues: ["filling"],
      },
      {
        participantIds: ["m_a", "m_b"],
        constraints: [
          { member_id: "m_a", rule_key: "fish", status: "prohibited" },
          { member_id: "m_b", rule_key: "meat", status: "prohibited" },
        ],
        tastes: [],
        userText: "Steak tonight, something hearty.",
      }
    );
    expect(detected.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "hard_ineligible", token: "steak", limit_ids: expect.arrayContaining(["no_meat"]) }),
      ])
    );
    const ack = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "Filling",
      state: { ...detected.repaired, dinner_count: 2 },
      conflicts: detected.conflicts,
      dropped: [],
      removedTokens: detected.removed,
      userText: "Steak tonight, something hearty.",
    });
    expect(ack.acknowledgement.toLowerCase()).toMatch(/steak/);
    expect(ack.acknowledgement).not.toBe("Filling");
  });

  it("uses no-results copy and broaden options when nothing matches", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedMeal(sqlite, { slug: "arctic-char", title: "Arctic Char", allergen: "finfish" });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_g", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [{ json: discoveryDelta({ acknowledgement: "Got it.", text_residue: "xylophone" }) }],
    });
    const res = await postWeave(envFor(db, provider), session.session_token, "/api/discovery/interpret", {
      text: "Xylophone please.",
    });
    expect(res.body.total).toBe(0);
    expect(res.body.acknowledgement.toLowerCase()).toMatch(/no dinners match/);
    expect(res.body.acknowledgement).not.toMatch(/got it/i);
    expect(res.body.suggestions?.length).toBeGreaterThan(0);
  });
});

describe("G4 refinement acknowledgements", () => {
  it("names the meal that changed and the minutes", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, { householdId: "hh_e" });
    sqlite.prepare(
      `INSERT INTO dinner_plan
        (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
         created_by_member_id, created_at, updated_at)
       VALUES ('dp_g4', 'hh_e', 'active', 4, 'plan_dinners', '{"dinner_count":4}', 'synthetic', 'm_a',
         '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run();
    const nights = [
      ["m1", 1, "2026-10-13", "rv_pork", "Pork Tenderloin"],
      ["m2", 2, "2026-10-14", "rv_beans", "Quesadillas"],
      ["m3", 3, "2026-10-15", "rv_pasta", "Cashew Pesto Pasta"],
      ["m4", 4, "2026-10-16", "rv_curry", "Chickpea Curry"],
    ];
    for (const [id, position, date, version, title] of nights) {
      sqlite.prepare(
        `INSERT INTO dinner_plan_meal
          (meal_id, dinner_plan_id, position, kind, state, scheduled_date, recipe_slug, recipe_id,
           recipe_version_id, version_number, title, base_servings, allergens_json, vocabulary_json,
           tags_json, effort_level, data_origin, created_at, updated_at)
         VALUES (?, 'dp_g4', ?, 'recipe', 'planned', ?, ?, ?, ?, 1, ?, 2, '[]', '[]', '[]', 'moderate', 'synthetic',
           '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
      ).run(id, position, date, version, version, version, title);
    }
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_e", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [
        {
          json: planningDelta({
            acknowledgement: "4 dinners",
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
    const res = await postWeave(envFor(db, provider, "planning_intent", { catalog: false }), session.session_token, "/api/plan/interpret", {
      text: "Make Friday something special.",
      state: { dinner_count: 4 },
      dinner_plan_id: "dp_g4",
    });
    expect(res.body.changed_positions).toEqual([4]);
    expect(res.body.acknowledgement).toMatch(/Friday's now .+ about \d+ min/);
    expect(res.body.acknowledgement).not.toBe("4 dinners");
  });

  it("says why a no-op easy request did not change and offers another option", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedMeal(sqlite, { slug: "tuesday-pork", title: "Pork Tenderloin", minutes: 35, effort: "easy" });
    sqlite.prepare(
      `INSERT INTO dinner_plan
        (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
         created_by_member_id, created_at, updated_at)
       VALUES ('dp_easy', 'hh_g', 'active', 1, 'plan_dinners', '{"dinner_count":1}', 'synthetic', 'm_a',
         '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run();
    sqlite.prepare(
      `INSERT INTO dinner_plan_meal
        (meal_id, dinner_plan_id, position, kind, state, scheduled_date, recipe_slug, recipe_id,
         recipe_version_id, version_number, title, base_servings, allergens_json, vocabulary_json,
         tags_json, effort_level, data_origin, created_at, updated_at)
       VALUES ('m1', 'dp_easy', 1, 'recipe', 'planned', '2026-10-13', 'tuesday-pork', 'rec_tuesday-pork',
         'rv_tuesday-pork', 1, 'Pork Tenderloin', 2, '[]', '[]', '[]', 'easy', 'synthetic',
         '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run();
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_g", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [
        {
          json: planningDelta({
            acknowledgement: "4 dinners",
            dinner_count: 1,
            slot_ops: [
              {
                target_kind: "weekday",
                target: "tuesday",
                op: "set",
                effort: "easy",
                ingredient_complexity: null,
                max_minutes: null,
                max_minutes_hard: null,
                special: null,
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
    const res = await postWeave(envFor(db, provider, "planning_intent"), session.session_token, "/api/plan/interpret", {
      text: "Make Tuesday easier.",
      state: { dinner_count: 1 },
      dinner_plan_id: "dp_easy",
    });
    expect(res.body.changed_positions).toEqual([]);
    expect(res.body.acknowledgement).toMatch(/Tuesday's already one of the easiest/);
    expect(res.body.suggestions?.some((line) => /swap tuesday/i.test(line))).toBe(true);
  });

  it("includes a pasta cap in the reconciled sentence", () => {
    const ack = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "4 dinners",
      state: {
        dinner_count: 4,
        frequencies: [{ token: "pasta", min_count: null, max_count: 1 }],
        intent_cues: [],
      },
      conflicts: [],
      dropped: [],
      removedTokens: [],
      userText: "Pasta no more than once.",
    });
    expect(ack.acknowledgement).toMatch(/pasta once at most/);
  });
});

describe("G1 live eval households", () => {
  it("mints a fresh member id per run and names all five profiles", async () => {
    const { memberIdForRun, profileKeys } = await import("../scripts/eval-d06-households.mjs");
    expect(profileKeys(corpus).sort()).toEqual(["allergen", "clear", "dairy", "mixed", "shellfish"]);
    const first = memberIdForRun("run1", "clear", "a");
    const second = memberIdForRun("run2", "clear", "a");
    const other = memberIdForRun("run1", "dairy", "a");
    expect(new Set([first, second, other]).size).toBe(3);
    expect(first).not.toBe("a");
    const src = readFileSync(new URL("../scripts/eval-d06-live.mjs", import.meta.url), "utf8");
    expect(src).toContain("profileKeys");
    expect(src).toContain("memberIdForRun");
    expect(src).toContain("for (const key of profileKeys(corpus))");
    expect(src).not.toContain("member_id: owner,");
  });
});

describe("G5 planning deterministic time", () => {
  it("reports n/a rather than 0 when the CPU clock is frozen", () => {
    const frozen = 5000;
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(frozen);
    const perfSpy = vi.spyOn(performance, "now").mockReturnValue(frozen);
    const start = monotonicNow();
    let sink = 0;
    for (let i = 0; i < 100000; i += 1) sink += i;
    const ms = elapsedMs(start);
    dateSpy.mockRestore();
    perfSpy.mockRestore();
    expect(sink).toBeGreaterThan(0);
    expect(ms).toBeNull();
  });
});

describe("G6 provider time versus server overhead", () => {
  it("splits provider time from route overhead", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedMeal(sqlite, { slug: "arctic-char", title: "Arctic Char", allergen: "finfish" });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_g", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [{ delay_ms: 40, json: discoveryDelta({ list_ops: [{ field: "intent_cues", op: "add", value: "cozy" }] }) }],
    });
    const res = await postWeave(envFor(db, provider), session.session_token, "/api/discovery/interpret", {
      text: "Something cozy but not too heavy.",
    });
    expect(res.body.provider_latency_ms).toBeGreaterThanOrEqual(30);
    expect(res.body.server_overhead_ms).toEqual(expect.any(Number));
    expect(res.body.server_overhead_ms).toBeGreaterThanOrEqual(0);
    const deterministic = res.body.deterministic_latency_ms || 0;
    const summed = res.body.provider_latency_ms + res.body.server_overhead_ms + deterministic;
    expect(Math.abs(res.body.total_latency_ms - summed)).toBeLessThan(30);
  });

  it("loads household reads and the catalog once on Find", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedMeal(sqlite, { slug: "arctic-char", title: "Arctic Char", allergen: "finfish" });
    const log = [];
    const db = asD1(sqlite, log);
    const session = await createMemberSession(db, { household_id: "hh_g", member_id: "m_a" });
    const mark = log.length;
    const provider = createFakeProvider({
      script: [{ json: discoveryDelta({ list_ops: [{ field: "intent_cues", op: "add", value: "cozy" }] }) }],
    });
    await postWeave(envFor(db, provider), session.session_token, "/api/discovery/interpret", {
      text: "Something cozy but not too heavy.",
    });
    const sql = log.slice(mark).map((line) => line.replace(/\s+/g, " "));
    expect(sql.filter((line) => /from catalog_version/i.test(line))).toHaveLength(1);
    expect(sql.filter((line) => /status = 'active'/i.test(line))).toHaveLength(1);
    expect(sql.filter((line) => /from constraint_rule/i.test(line))).toHaveLength(1);
    expect(sql.filter((line) => /from diner_taste/i.test(line))).toHaveLength(1);
  });
});

describe("G7 unknown restriction keys", () => {
  it("rejects an unknown rule key with 400 and still stores a real one", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_g", member_id: "m_a" });
    const env = { DB: db };
    const unknown = await worker.fetch(
      new Request("https://example.test/api/members/m_a/constraints", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.session_token}` },
        body: JSON.stringify({ rule_key: "finfish", status: "prohibited" }),
      }),
      env
    );
    expect(unknown.status).toBe(400);
    expect(sqlite.prepare("SELECT rule_key FROM constraint_rule").all()).toEqual([]);
    const known = await worker.fetch(
      new Request("https://example.test/api/members/m_a/constraints", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.session_token}` },
        body: JSON.stringify({ rule_key: "shellfish", status: "prohibited" }),
      }),
      env
    );
    expect(known.status).toBe(200);
    expect(sqlite.prepare("SELECT rule_key FROM constraint_rule").all()).toEqual([{ rule_key: "shellfish" }]);
  });
});

describe("G8 interpret cache", () => {
  it("reuses a household-free interpretation and recomputes conflicts", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, { householdId: "hh_g8a", members: ["m_g8a"] });
    seedHousehold(sqlite, { householdId: "hh_g8b", members: ["m_g8b"] });
    seedLimit(sqlite, { householdId: "hh_g8a", memberId: "m_g8a", rule: "shellfish" });
    seedMeal(sqlite, { slug: "arctic-char", title: "Arctic Char", allergen: "finfish" });
    seedMeal(sqlite, { slug: "shrimp-scampi", title: "Shrimp Scampi", allergen: "shellfish", ingredient: "shrimp" });
    const db = asD1(sqlite);
    const restricted = await createMemberSession(db, { household_id: "hh_g8a", member_id: "m_g8a" });
    const open = await createMemberSession(db, { household_id: "hh_g8b", member_id: "m_g8b" });
    const provider = createFakeProvider({
      script: [{ json: discoveryDelta({ text_residue: "dinner tonight", list_ops: [{ field: "ingredients", op: "add", value: "shrimp" }] }) }],
    });
    const env = envFor(db, provider);
    const first = await postWeave(env, restricted.session_token, "/api/discovery/interpret", { text: "Shrimp for dinner tonight." });
    const second = await postWeave(env, open.session_token, "/api/discovery/interpret", { text: "Shrimp for dinner tonight." });
    expect(provider.calls).toHaveLength(1);
    expect(second.body.source).toBe("cache");
    expect(first.body.conflicts.length).toBeGreaterThan(0);
    expect(second.body.conflicts).toEqual([]);
    expect(JSON.stringify(provider.calls[0].user)).not.toContain("hh_g8a");
    expect(JSON.stringify(provider.calls[0].user)).not.toContain("m_g8a");
    expect(first.body.results.map((row) => row.title)).not.toContain("Shrimp Scampi");
    expect(second.body.results.map((row) => row.title)).toContain("Shrimp Scampi");
  });
});
