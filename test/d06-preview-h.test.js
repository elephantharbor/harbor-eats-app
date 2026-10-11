/**
 * Preview-eval cycle 4 defects H2–H6. Each case fails on the pre-fix behavior.
 */
import { readFileSync, readdirSync } from "node:fs";
import { UNAVAILABLE_GATEWAY_CODES } from "../src/ai/errors.js";
import { PLAN_PICKER_ACK } from "../src/weave/ack.js";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { createMemberSession } from "../src/lib/session.js";
import { reconcileAcknowledgement } from "../src/weave/ack.js";
import { detectDiscoveryConflicts } from "../src/weave/conflicts.js";
import { routeWeaveRequest } from "../src/weave/routes.js";
import corpus from "./fixtures/d06-intent-corpus.json" with { type: "json" };

const BANNED = /provider|quota|budget|outage|rate limit|no dinners match/i;

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return sqlite;
}

function asD1(sqlite, trips = null) {
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
          const statement = {
            sql,
            params,
            async run() {
              if (trips) trips.push({ sql, batched: false, afterProvider: trips.providerDone === true });
              exec(sql, params);
              return { success: true, meta: { changes: 1 }, results: [] };
            },
            async first() {
              if (trips) trips.push({ sql, batched: false, afterProvider: trips.providerDone === true });
              const rows = exec(sql, params);
              return rows[0] ?? null;
            },
            async all() {
              if (trips) trips.push({ sql, batched: false, afterProvider: trips.providerDone === true });
              return { results: exec(sql, params) };
            },
          };
          return statement;
        },
      };
    },
    async batch(statements) {
      if (trips) {
        trips.push({
          sql: statements.map((statement) => statement.sql).join("\n"),
          batched: true,
          afterProvider: trips.providerDone === true,
          count: statements.length,
        });
      }
      const results = [];
      for (const statement of statements) results.push({ results: exec(statement.sql, statement.params), success: true });
      return results;
    },
  };
}

function seedHousehold(sqlite, { householdId = "hh_h", members = ["m_a"] } = {}) {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES (?, 'H', 'active', 'America/Chicago', ?, 'synthetic_qa', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', 'synthetic')`
  ).run(householdId, members.length);
  members.forEach((memberId, index) => {
    sqlite.prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run(memberId, householdId, memberId, index === 0 ? "owner" : "member");
  });
}

function seedMeal(sqlite, { slug, title, allergen, ingredient = null, minutes = 25, effort = "easy", format = "bowls", flavor = null }) {
  const dish = `dish_${slug}`;
  const version = `rv_${slug}`;
  sqlite.prepare(
    `INSERT INTO catalog_dish
      (dish_id, slug, title, name, cuisine, meal_format, primary_ingredient, flavor_profile, tags_json, sparks_json, chips_json, created_at)
     VALUES (?, ?, ?, ?, 'american', ?, ?, ?, '[]', '[]', '[]', '2026-10-10T00:00:00Z')`
  ).run(dish, slug, title, title, format, ingredient || "fish", flavor);
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

function seedLimit(sqlite, { householdId = "hh_h", memberId, rule }) {
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

describe("H2 unavailable gateway fallback", () => {
  async function findLimited(extraEnv, provider) {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedMeal(sqlite, { slug: "steak-night", title: "Steak Night", allergen: null, ingredient: "beef", minutes: 40, flavor: "citrusy" });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const res = await postWeave(envFor(db, provider, extraEnv), session.session_token, "/api/discovery/interpret", {
      text: "steak date night",
    });
    expect(res.status).toBe(200);
    expect(res.body.acknowledgement).toBe("Showing dinners that match your words.");
    expect(res.body.acknowledgement).not.toMatch(BANNED);
    expect(res.body.suggestions || []).not.toEqual(expect.arrayContaining(["Try fish"]));
    expect(res.body.results.map((row) => row.title)).toContain("Steak Night");
    return res.body;
  }

  it("searches the user's words when the daily limit is hit", async () => {
    const body = await findLimited({ AI_GLOBAL_PER_DAY: "0" }, createFakeProvider({ script: [{ json: discoveryDelta() }] }));
    expect(body.fallback_code).toBe("rate_limited");
  });

  it("uses the same gentle find copy for budget, outage, and provider config", async () => {
    await findLimited({ AI_DAILY_BUDGET_USD: "0" }, createFakeProvider({ script: [{ json: discoveryDelta() }] }));
    await findLimited({}, createFakeProvider({ script: [{ throw: { status: 503, message: "down" } }] }));
    await findLimited({}, createFakeProvider({ script: [{ throw: { status: 400, message: "bad" } }] }));
  });

  it("plans from a parsed count without mentioning the gateway", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const res = await postWeave(
      envFor(db, createFakeProvider({ script: [] }), { AI_GLOBAL_PER_DAY: "0", CATALOG_SOURCE: undefined }),
      session.session_token,
      "/api/plan/interpret",
      { text: "Plan three easy dinners this week." }
    );
    expect(res.body.fallback_code).toBe("rate_limited");
    expect(res.body.preview?.slots?.length).toBe(3);
    expect(res.body.state?.dinner_count).toBe(3);
    expect(res.body.acknowledgement || "").not.toMatch(BANNED);
    expect(res.body.acknowledgement).toMatch(/3|three/i);
    expect(JSON.stringify({ acknowledgement: res.body.acknowledgement, fallback_code: res.body.fallback_code })).not.toMatch(
      /provider|quota|budget|outage/i
    );
  });

  it("keeps the count picker copy when the request has no count", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const res = await postWeave(
      envFor(db, createFakeProvider({ script: [] }), { AI_GLOBAL_PER_DAY: "0", CATALOG_SOURCE: undefined }),
      session.session_token,
      "/api/plan/interpret",
      { text: "Make Wednesday vegetarian" }
    );
    expect(res.body.fallback_code).toBe("rate_limited");
    expect(res.body.preview).toBeNull();
    expect(res.body.acknowledgement).toMatch(/choose how many/i);
    expect(res.body.acknowledgement).not.toMatch(BANNED);
    const ui = readFileSync(new URL("../public/weave-ui.js", import.meta.url), "utf8");
    for (const code of UNAVAILABLE_GATEWAY_CODES) expect(ui).toContain(code);
    expect(ui).toMatch(/draft = text/);
  });

  it("treats a disabled gateway as the count picker, and still plans a counted request", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const env = envFor(db, createFakeProvider({ script: [] }), { AI_GATEWAY_ENABLED: "0", CATALOG_SOURCE: undefined });
    const picker = await postWeave(env, session.session_token, "/api/plan/interpret", { text: "Make Wednesday vegetarian" });
    expect(picker.body.fallback_code).toBe("disabled");
    expect(picker.body.preview).toBeNull();
    expect(picker.body.acknowledgement).toBe(PLAN_PICKER_ACK);
    const counted = await postWeave(env, session.session_token, "/api/plan/interpret", { text: "Plan three easy dinners this week." });
    expect(counted.body.fallback_code).toBe("disabled");
    expect(counted.body.state?.dinner_count).toBe(3);
    expect(counted.body.preview?.slots?.length).toBe(3);
  });

  it("treats a missing provider the same way", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const res = await postWeave(envFor(db, createFakeProvider({ script: [] }), { AI_PROVIDER: "none", CATALOG_SOURCE: undefined }), session.session_token, "/api/plan/interpret", {
      text: "something warm",
    });
    expect(res.body.fallback_code).toBe("provider_unconfigured");
    expect(res.body.preview).toBeNull();
    expect(res.body.acknowledgement).toMatch(/choose how many/i);
  });

  it("keeps Find on the keyword fallback when the gateway is disabled", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedMeal(sqlite, { slug: "steak-night", title: "Steak Night", allergen: null, ingredient: "beef", minutes: 40, flavor: "citrusy" });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const res = await postWeave(envFor(db, createFakeProvider({ script: [] }), { AI_GATEWAY_ENABLED: "0" }), session.session_token, "/api/discovery/interpret", {
      text: "steak date night",
    });
    expect(res.status).toBe(200);
    expect(res.body.fallback_code).toBe("disabled");
    expect(res.body.acknowledgement).toBe("Showing dinners that match your words.");
    expect(res.body.results.map((row) => row.title)).toContain("Steak Night");
  });
});

describe("H3 conflict repair relaxes soft filters", () => {
  it("drops the time limit and keeps fish tacos when quick excludes them", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedLimit(sqlite, { memberId: "m_a", rule: "shellfish" });
    seedMeal(sqlite, { slug: "fish-tacos", title: "Crispy Fish Tacos", allergen: "finfish", ingredient: "fish", minutes: 45, format: "tacos" });
    seedMeal(sqlite, { slug: "shrimp-tacos", title: "Shrimp Tacos", allergen: "shellfish", ingredient: "shrimp", minutes: 20, format: "tacos" });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [
        {
          json: discoveryDelta({
            quick: true,
            list_ops: [
              { field: "meal_styles", op: "add", value: "tacos" },
              { field: "ingredients", op: "add", value: "shrimp" },
            ],
          }),
        },
      ],
    });
    const res = await postWeave(envFor(db, provider), session.session_token, "/api/discovery/interpret", {
      text: "Shrimp tacos, quick please.",
    });
    const titles = res.body.results.map((row) => row.title);
    expect(titles).toContain("Crispy Fish Tacos");
    expect(titles).not.toContain("Shrimp Tacos");
    expect(res.body.acknowledgement.toLowerCase()).toMatch(/taco/);
    expect(res.body.acknowledgement.toLowerCase()).toMatch(/time|quick/);
    expect(res.body.acknowledgement).not.toMatch(/no dinners match/i);
    expect(res.body.state.meal_styles).toContain("tacos");
    expect(res.body.state.protein_groups).toContain("fish");
    expect(res.body.state.quick).not.toBe(true);
  });

  it("does not drop the dish or a hard limit when relaxing still finds nothing", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedLimit(sqlite, { memberId: "m_a", rule: "shellfish" });
    seedMeal(sqlite, { slug: "fish-bowl", title: "Fish Bowl", allergen: "finfish", ingredient: "fish", minutes: 45, format: "bowls" });
    seedMeal(sqlite, { slug: "shrimp-tacos", title: "Shrimp Tacos", allergen: "shellfish", ingredient: "shrimp", minutes: 20, format: "tacos" });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [
        {
          json: discoveryDelta({
            quick: true,
            list_ops: [
              { field: "meal_styles", op: "add", value: "tacos" },
              { field: "ingredients", op: "add", value: "shrimp" },
            ],
          }),
        },
      ],
    });
    const res = await postWeave(envFor(db, provider), session.session_token, "/api/discovery/interpret", {
      text: "Shrimp tacos, quick please.",
    });
    expect(res.body.total).toBe(0);
    expect(res.body.results.map((row) => row.title)).not.toContain("Shrimp Tacos");
    expect(res.body.acknowledgement.toLowerCase()).toMatch(/no dinners match/);
    expect(res.body.state.meal_styles).toContain("tacos");
  });
});

describe("H6 conflict phrasing and blocked categories", () => {
  it("groups shrimp under shellfish and drops seafood from the saved state", () => {
    const detected = detectDiscoveryConflicts(
      {
        ingredients: ["shrimp"],
        protein_groups: ["fish", "seafood"],
        cuisines: [],
        meal_styles: [],
        flavors: ["spicy"],
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
        userText: "Spicy peanut stir fry with prawns.",
      }
    );
    expect(detected.repaired.protein_groups).toContain("fish");
    expect(detected.repaired.protein_groups).not.toContain("seafood");
    expect(detected.repaired.protein_groups).not.toContain("shellfish");
    const ack = reconcileAcknowledgement({
      task: "discovery_intent",
      modelAck: "Spicy fish.",
      state: detected.repaired,
      conflicts: detected.conflicts,
      dropped: [],
      removedTokens: detected.removed,
      userText: "Spicy peanut stir fry with prawns.",
    });
    expect(ack.acknowledgement).toMatch(/Shellfish and peanut don't work for everyone/);
    expect(ack.acknowledgement).not.toMatch(/Shrimp/);
  });
});

describe("H4 post-provider D1 round trips", () => {
  it("batches limiter writes and catalog children into single round trips", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedMeal(sqlite, { slug: "arctic-char", title: "Arctic Char", allergen: "finfish", minutes: 30 });
    const trips = [];
    const db = asD1(sqlite, trips);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [
        {
          json: discoveryDelta({ list_ops: [{ field: "protein_groups", op: "add", value: "fish" }] }),
          after: () => {
            trips.providerDone = true;
          },
        },
      ],
    });
    const orig = provider.generate.bind(provider);
    provider.generate = async (req, opts) => {
      const result = await orig(req, opts);
      trips.providerDone = true;
      return result;
    };
    const res = await postWeave(envFor(db, provider), session.session_token, "/api/discovery/interpret", {
      text: "Something with fish",
    });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    const limiter = trips.filter((trip) => /ai_limit_counters/.test(trip.sql) && !trip.afterProvider);
    const after = trips.filter((trip) => trip.afterProvider && /ai_usage|ai_cache|ai_limit_counters/.test(trip.sql));
    const catalogChildren = trips.filter((trip) => /FROM catalog_ingredient|FROM catalog_step|FROM catalog_allergen/.test(trip.sql));
    expect(limiter).toHaveLength(1);
    expect(limiter[0].batched).toBe(true);
    expect(after).toHaveLength(1);
    expect(after[0].batched).toBe(true);
    expect(catalogChildren).toHaveLength(1);
    expect(catalogChildren[0].batched).toBe(true);
  });
});

describe("H5 corpus profiles and paced live eval", () => {
  it("covers dairy, shellfish, mixed, and allergen with at least two cases each", () => {
    const counts = {};
    for (const row of corpus.cases) counts[row.household] = (counts[row.household] || 0) + 1;
    for (const key of ["dairy", "shellfish", "mixed", "allergen"]) expect(counts[key] || 0).toBeGreaterThanOrEqual(2);
    const ids = corpus.cases.map((row) => row.id);
    expect(ids).toContain("find-shrimp-tonight");
    expect(ids).toContain("find-peanut-shrimp");
    expect(ids).toContain("find-steak-hearty");
  });

  it("paces the live script and caps provider calls", () => {
    const src = readFileSync(new URL("../scripts/eval-d06-live.mjs", import.meta.url), "utf8");
    expect(src).toContain('"max-calls"');
    expect(src).toMatch(/delay/);
    expect(src).toMatch(/setTimeout/);
  });
});

describe("UX pass: plan commit", () => {
  it("saves a language-built plan for the session's household", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    for (const slug of ["one", "two", "three"]) seedMeal(sqlite, { slug: `meal-${slug}`, title: `Meal ${slug}`, allergen: null, ingredient: "chicken" });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_h", member_id: "m_a" });
    const env = envFor(db, createFakeProvider({ script: [] }), { AI_GLOBAL_PER_DAY: "0" });
    const planned = await postWeave(env, session.session_token, "/api/plan/interpret", { text: "Plan three easy dinners this week." });
    expect(planned.body.preview?.slots?.length).toBe(3);
    const committed = await postWeave(env, session.session_token, "/api/plan/commit", {
      state: planned.body.state,
      preview: planned.body.preview,
      entry_point: "plan_dinners",
    });
    expect(committed.status).toBe(200);
    expect(committed.body.ok).toBe(true);
    const row = sqlite.prepare("SELECT household_id, data_origin FROM dinner_plan WHERE dinner_plan_id = ?").get(committed.body.plan.dinner_plan_id);
    expect(row.household_id).toBe("hh_h");
    expect(["household", "synthetic", "unproven"]).toContain(row.data_origin);
  });
});
