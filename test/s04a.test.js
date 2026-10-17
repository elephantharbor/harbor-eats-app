/**
 * S-04A: scoped general-item ids, sanitized database errors, actionable
 * client-error counts, synthetic onboarding, duplicate members, and
 * request-time grocery mode. No Instacart network call.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { classifyClientError, clientErrorSignatures, summarizeClientErrors } from "../src/lib/client-error-class.js";
import { databaseLeakText } from "../src/lib/db-error.js";
import { createMemberSession } from "../src/lib/session.js";
import {
  addGeneralItem,
  editLine,
  emptyHouseholdList,
  generalRequirementId,
  legacyGeneralRequirementId,
  recipeYieldLine,
  renderExportCsv,
  exportSections,
} from "../src/lib/household-shop.js";
import { projectPlanIntoList } from "../src/lib/household-shop.js";
import { createDinnerPlan } from "../src/lib/plan-mutations.js";
import { plannerCatalog } from "../src/lib/dinner-planner.js";
import { contentFingerprintInput, fingerprint } from "../src/lib/grocery/fingerprint.js";
import { projectTransfer } from "../src/lib/grocery/projection.js";
import { groceryEnvForHousehold, groceryEnvForRequest, instacartActivation, productionLocked } from "../src/lib/grocery/config.js";
import { INSTACART_API_HOSTS } from "../src/lib/grocery/allowlist.js";
import { createInstacartAdapter } from "../src/lib/grocery/instacart.js";

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return sqlite;
}

function asD1(sqlite) {
  function statement(sql, params) {
    return {
      sql,
      params,
      async run() {
        const result = sqlite.prepare(sql).run(...params);
        return { success: true, meta: { changes: result.changes } };
      },
      async first() {
        return sqlite.prepare(sql).get(...params) ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...params) };
      },
    };
  }
  return {
    prepare(sql) {
      return {
        ...statement(sql, []),
        bind(...params) {
          return statement(sql, params);
        },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        try {
          sqlite.exec("ROLLBACK");
        } catch {
          /* already rolled back */
        }
        throw error;
      }
    },
  };
}

function leak(value) {
  return databaseLeakText(JSON.stringify(value));
}

async function call(env, method, path, { token, body, headers = {} } = {}) {
  const requestHeaders = { "Content-Type": "application/json", ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const res = await worker.fetch(
    new Request(new URL(`https://fw.test${path}`), {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env
  );
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed, text };
}

function seedHousehold(sqlite, id, memberId, name = id) {
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES (?, ?, 'active', 'America/Chicago', 2, 'organic', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z', 'household')`
    )
    .run(id, name);
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', 'active', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
    )
    .run(memberId, id, memberId);
}

describe("A2 general item identity", () => {
  it("scopes a new id to the list and still resolves a legacy id", () => {
    expect(generalRequirementId("hsl_one", "towels")).toBe("hrg_hsl-one_towels");
    expect(legacyGeneralRequirementId("towels")).toBe("hrg_towels");
    expect(generalRequirementId("hsl_one", "towels")).not.toBe(generalRequirementId("hsl_two", "towels"));
    expect(generalRequirementId("hsl_one", "towels")).not.toBe(legacyGeneralRequirementId("towels"));
  });

  it("keeps the same request id idempotent in one household and distinct across households", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_a", "m_a");
    seedHousehold(sqlite, "hh_b", "m_b");
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const sessionA = await createMemberSession(env.DB, { household_id: "hh_a", member_id: "m_a" });
    const sessionB = await createMemberSession(env.DB, { household_id: "hh_b", member_id: "m_b" });

    const first = await call(env, "POST", "/api/household-shop", {
      token: sessionA.session_token,
      body: { expected_revision: 1, op: "add_item", text: "paper towels", client_request_id: "shared-req" },
    });
    expect(first.status).toBe(200);
    expect(leak(first.body)).toBe(false);
    const repeat = await call(env, "POST", "/api/household-shop", {
      token: sessionA.session_token,
      body: {
        expected_revision: first.body.list.revision,
        op: "add_item",
        text: "paper towels",
        client_request_id: "shared-req",
      },
    });
    expect(repeat.status).toBe(200);
    expect(repeat.body.idempotent).toBe(true);

    const other = await call(env, "POST", "/api/household-shop", {
      token: sessionB.session_token,
      body: { expected_revision: 1, op: "add_item", text: "paper towels", client_request_id: "shared-req" },
    });
    expect(other.status).toBe(200);
    expect(leak(other.body)).toBe(false);
    const ids = sqlite.prepare(`SELECT requirement_id, shop_list_id FROM household_shop_requirement ORDER BY requirement_id`).all();
    expect(ids).toHaveLength(2);
    expect(new Set(ids.map((row) => row.requirement_id)).size).toBe(2);
    expect(ids.every((row) => row.requirement_id.startsWith("hrg_") && row.requirement_id.split("_").length >= 3)).toBe(true);

    const isolated = await call(env, "GET", "/api/household-shop", { token: sessionB.session_token });
    expect(isolated.status).toBe(200);
    expect(isolated.body.list.household_id).toBe("hh_b");
    expect(isolated.body.list.lines).toHaveLength(1);
    const crossed = await call(env, "POST", "/api/household-shop", {
      token: sessionB.session_token,
      body: { household_id: "hh_a", expected_revision: 1, op: "add_item", text: "secret", client_request_id: "nope" },
    });
    expect(crossed.status).toBe(403);
    expect(leak(crossed.body)).toBe(false);
  });

  it("treats concurrent retries of one request id as one row and does not leak database text", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_a", "m_a");
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const session = await createMemberSession(env.DB, { household_id: "hh_a", member_id: "m_a" });
    const body = { expected_revision: 1, op: "add_item", text: "bananas", client_request_id: "race" };
    const [left, right] = await Promise.all([
      call(env, "POST", "/api/household-shop", { token: session.session_token, body }),
      call(env, "POST", "/api/household-shop", { token: session.session_token, body }),
    ]);
    expect(leak(left.body)).toBe(false);
    expect(leak(right.body)).toBe(false);
    expect([left.status, right.status].every((status) => status === 200 || status === 409)).toBe(true);
    const rows = sqlite.prepare(`SELECT requirement_id FROM household_shop_requirement`).all();
    expect(rows).toHaveLength(1);
    const revision = sqlite.prepare(`SELECT revision FROM household_shop_list`).get().revision;
    const retry = await call(env, "POST", "/api/household-shop", {
      token: session.session_token,
      body: { ...body, expected_revision: revision },
    });
    expect(retry.status).toBe(200);
    expect(retry.body.idempotent).toBe(true);
    expect(sqlite.prepare(`SELECT COUNT(*) AS c FROM household_shop_requirement`).get().c).toBe(1);
  });

  it("loads a legacy requirement id and treats a repeat as the same item", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_a", "m_a");
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const session = await createMemberSession(env.DB, { household_id: "hh_a", member_id: "m_a" });
    const legacyId = legacyGeneralRequirementId("legacy-item");
    sqlite
      .prepare(
        `INSERT INTO household_shop_list
          (shop_list_id, household_id, status, revision, content_revision, dinner_plan_id, trip_method, created_at, updated_at)
         VALUES ('hsl_legacy', 'hh_a', 'open', 4, 2, NULL, NULL, '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO household_shop_line
          (line_id, shop_list_id, ingredient_id, general_key, display_name, name_custom, preparation, unit,
           quantity_required, quantity_manual, quantity_override, override_basis, override_stale, reconcile_note,
           list_state, still_needed, surplus_quantity, meal_ids_json, recipe_version_ids_json, category,
           category_custom, unparsed, note, created_at, updated_at)
         VALUES ('hl_legacy', 'hsl_legacy', NULL, 'paper towels', 'Paper towels', 0, NULL, 'unparsed',
           NULL, 1, NULL, NULL, 0, NULL, 'open', 1, 0, '[]', '[]', 'other', 0, 1, NULL,
           '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO household_shop_requirement
          (requirement_id, line_id, shop_list_id, origin, dinner_plan_id, plan_line_id, meal_ids_json,
           recipe_version_ids_json, quantity, unit, still_needed, source_key, client_request_id,
           display_name, preparation, created_at, updated_at)
         VALUES (?, 'hl_legacy', 'hsl_legacy', 'general', NULL, NULL, '[]', '[]', 1, 'unparsed', 1,
           ?, 'legacy-item', 'Paper towels', NULL, '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
      )
      .run(legacyId, `general:${legacyId}`);
    const loaded = await call(env, "GET", "/api/household-shop", { token: session.session_token });
    expect(loaded.status).toBe(200);
    expect(loaded.body.list.lines.map((line) => line.display_name)).toContain("Paper towels");
    const again = await call(env, "POST", "/api/household-shop", {
      token: session.session_token,
      body: { expected_revision: 4, op: "add_item", text: "paper towels", client_request_id: "legacy-item" },
    });
    expect(again.status).toBe(200);
    expect(again.body.idempotent).toBe(true);
    expect(leak(again.body)).toBe(false);
    const stored = sqlite.prepare(`SELECT requirement_id FROM household_shop_requirement`).all();
    expect(stored).toEqual([{ requirement_id: legacyId }]);
  });
});

describe("A2 database error responses", () => {
  it("hides SQL when a household id or a member id already exists", async () => {
    const sqlite = migrate();
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const created = await call(env, "POST", "/api/households", {
      body: { household_id: "hh_fixed", display_name: "The Parkers" },
    });
    expect(created.status).toBe(201);
    expect(created.body.data_origin).toBe("household");
    const duplicateHousehold = await call(env, "POST", "/api/households", {
      body: { household_id: "hh_fixed", display_name: "The Parkers" },
    });
    expect(duplicateHousehold.status).toBe(500);
    expect(duplicateHousehold.body.error).toBe("household_create_failed");
    expect(duplicateHousehold.body.detail).toBeUndefined();
    expect(leak(duplicateHousehold.body)).toBe(false);

    const member = await call(env, "POST", "/api/households/hh_fixed/members", {
      body: { member_id: "sam", display_name: "Sam", role: "owner" },
    });
    expect(member.status).toBe(201);
    const other = await call(env, "POST", "/api/households", {
      body: { household_id: "hh_other", display_name: "The Lees" },
    });
    expect(other.status).toBe(201);
    const duplicateMember = await call(env, "POST", "/api/households/hh_other/members", {
      body: { member_id: "sam", display_name: "Sam", role: "owner" },
    });
    expect(duplicateMember.status).toBe(409);
    expect(duplicateMember.body.error).toBe("member_exists");
    expect(duplicateMember.body.detail).toBeUndefined();
    expect(leak(duplicateMember.body)).toBe(false);
  });
});

describe("A3 actionable client errors", () => {
  it("keeps the raw count and excludes expected 401s, negative-path tests, and synthetic traffic", () => {
    const rows = [
      { message: "/api/sessions/me 401" },
      { message: "/api/events 401", data_origin: "synthetic", display_name: "[synthetic] E2E Kitchen" },
      { message: "/api/plans 403", data_origin: "synthetic", display_name: "[synthetic] E2E Kitchen" },
      { message: "/api/plans 500", data_origin: "household", acquisition_source: "synthetic_qa", display_name: "QA" },
      { message: "/api/plans 500", data_origin: "household", display_name: "[synthetic] old marker" },
      { message: "/api/dinner-plans 500", data_origin: "household", display_name: "The Parkers" },
    ];
    expect(rows.map(classifyClientError)).toEqual([
      "expected_logged_out",
      "expected_logged_out",
      "negative_path",
      "synthetic",
      "synthetic",
      "actionable",
    ]);
    const summary = summarizeClientErrors(rows);
    expect(summary.total).toBe(6);
    expect(summary.actionable).toBe(1);
  });

  it("reports both counts from health and does not store raw client text", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_real", "m_real", "The Parkers");
    seedHousehold(sqlite, "hh_syn", "m_syn", "[synthetic] E2E Kitchen");
    sqlite.prepare(`UPDATE household SET data_origin = 'synthetic', acquisition_source = 'synthetic_qa' WHERE household_id = 'hh_syn'`).run();
    const now = new Date().toISOString();
    const insert = sqlite.prepare(
      `INSERT INTO client_error (error_id, household_id, surface, code, message, path, created_at)
       VALUES (?, ?, 'api', ?, ?, '/shop', ?)`
    );
    insert.run("e1", null, "unauthorized", "/api/sessions/me 401", now);
    insert.run("e2", "hh_syn", "forbidden", "/api/household-shop 403", now);
    insert.run("e3", "hh_syn", null, "user typed a note", now);
    insert.run("e4", "hh_real", "internal", "/api/dinner-plans 500", now);
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const health = await call(env, "GET", "/api/health");
    expect(health.body.client_errors_24h).toBe(4);
    expect(health.body.client_errors_24h_actionable).toBe(1);
    expect(health.body.client_errors_24h_by_class).toEqual({
      actionable: 1,
      expected_logged_out: 1,
      expected_abort: 0,
      expected_guard: 0,
      negative_path: 1,
      synthetic: 1,
    });
    const session = await createMemberSession(env.DB, { household_id: "hh_real", member_id: "m_real" });
    const posted = await call(env, "POST", "/api/client-errors", {
      token: session.session_token,
      body: {
        surface: "api",
        code: "unauthorized",
        message: "/api/events 401",
        path: "/shop?note=secret",
        response: { note: "do not store" },
      },
    });
    expect(posted.status).toBe(201);
    const stored = sqlite.prepare(`SELECT message, path, props_json FROM client_error WHERE error_id = ?`).get(posted.body.error_id);
    expect(stored.message).toBe("/api/events 401");
    expect(stored.path).toBeNull();
    expect(stored.props_json).toBeNull();
    expect(JSON.stringify(stored)).not.toContain("secret");
    const after = await call(env, "GET", "/api/health");
    expect(after.body.client_errors_24h).toBe(5);
    expect(after.body.client_errors_24h_actionable).toBe(1);
    expect(after.body.client_errors_24h_by_class.expected_logged_out).toBe(2);
    expect(sqlite.prepare(`SELECT COUNT(*) AS c FROM client_error`).get().c).toBe(5);
  });

  it("classifies invite guards by code and summarizes them without identities", () => {
    const guard = { code: "wrong_household_logged_in", message: "/api/invites/join 409", surface: "api" };
    const blank = { code: "wrong_household_logged_in", message: null, surface: "invite" };
    expect(classifyClientError(guard)).toBe("expected_guard");
    expect(classifyClientError(blank)).toBe("expected_guard");
    expect(classifyClientError({ code: "invite_expired", message: "/api/invites/join 410" })).toBe("expected_guard");
    expect(classifyClientError({ code: "invite_inactive", message: "/api/invites/join 410" })).toBe("expected_guard");
    expect(classifyClientError({ code: "db_error", message: "/api/invites/join 500" })).toBe("actionable");
    const summary = summarizeClientErrors([guard, blank]);
    expect(summary.expected_guard).toBe(2);
    expect(summary.actionable).toBe(0);
    expect(summary.total).toBe(2);
  });

  it("groups health signatures without household ids, member ids, or page URLs", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_secret", "m_secret", "The Parkers");
    const first = new Date(Date.now() - 60_000).toISOString();
    const second = new Date(Date.now() - 30_000).toISOString();
    const insert = sqlite.prepare(
      `INSERT INTO client_error (error_id, household_id, member_id, surface, code, message, path, created_at)
       VALUES (?, 'hh_secret', 'm_secret', ?, ?, ?, '/invite/HE-INV-SECRET?x=1', ?)`
    );
    insert.run("g1", "api", "wrong_household_logged_in", "/api/invites/join 409", first);
    insert.run("g2", "api", "wrong_household_logged_in", "/api/invites/join 409", second);
    insert.run("g3", "invite", "wrong_household_logged_in", null, second);
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const health = await call(env, "GET", "/api/health");
    expect(health.body.client_errors_24h_actionable).toBe(0);
    expect(health.body.client_errors_24h_by_class.expected_guard).toBe(3);
    expect(health.body.client_errors_24h_signatures).toEqual([
      {
        surface: "api",
        code: "wrong_household_logged_in",
        message: "/api/invites/join 409",
        first_seen: first,
        count: 2,
      },
      {
        surface: "invite",
        code: "wrong_household_logged_in",
        message: null,
        first_seen: second,
        count: 1,
      },
    ]);
    const dumped = JSON.stringify(health.body.client_errors_24h_signatures);
    expect(dumped).not.toContain("hh_secret");
    expect(dumped).not.toContain("m_secret");
    expect(dumped).not.toContain("HE-INV");
    expect(dumped).not.toContain("/invite/");
    expect(clientErrorSignatures([{ surface: "api", code: "nope", message: "user typed onions", created_at: "2026-10-17T00:00:00.000Z" }])).toEqual([
      { surface: "api", code: "nope", message: null, first_seen: "2026-10-17T00:00:00.000Z", count: 1 },
    ]);
  });

  it("redacts ids that a stored request path carries before public health shows it", () => {
    const at = "2026-10-17T00:00:00.000Z";
    const rows = [
      { surface: "api", code: "member_exists", message: "/api/households/hh_83f3c645af7a/members 409", created_at: at },
      { surface: "api", code: "member_exists", message: "/api/households/hh_d74ad4933f3a/members 409", created_at: at },
      { surface: "api", code: "invite_expired", message: "/api/invites/HE-INV-7Q2K9/preview 410", created_at: at },
      { surface: "api", code: "conflict", message: "/api/dinner-plans/dp_1a2b3c/mutations 409", created_at: at },
      { surface: "api", code: "session_invalid", message: "/api/sessions/me 401", created_at: at },
    ];
    const out = clientErrorSignatures(rows);
    expect(out).toEqual([
      { surface: "api", code: "member_exists", message: "/api/households/:id/members 409", first_seen: at, count: 2 },
      { surface: "api", code: "invite_expired", message: "/api/invites/:id/preview 410", first_seen: at, count: 1 },
      { surface: "api", code: "conflict", message: "/api/dinner-plans/:id/mutations 409", first_seen: at, count: 1 },
      { surface: "api", code: "session_invalid", message: "/api/sessions/me 401", first_seen: at, count: 1 },
    ]);
    const dumped = JSON.stringify(out);
    expect(dumped).not.toMatch(/hh_|HE-INV|dp_/);
  });
});

describe("A4 onboarding origin and duplicate members", () => {
  it("stamps a [synthetic] kitchen as synthetic without a client origin field", async () => {
    const sqlite = migrate();
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const created = await call(env, "POST", "/api/households", {
      body: { display_name: "[synthetic] E2E Kitchen", acquisition_source: "organic" },
    });
    expect(created.status).toBe(201);
    expect(created.body.data_origin).toBe("synthetic");
    const row = sqlite.prepare(`SELECT data_origin, acquisition_source FROM household`).get();
    expect(row).toEqual({ data_origin: "synthetic", acquisition_source: "synthetic_qa" });
  });
});

describe("A5 superseded plans", () => {
  it("does not backfill superseded_at in any migration", () => {
    const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((name) => name.endsWith(".sql"));
    const sql = files.map((name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8")).join("\n");
    expect(sql).not.toMatch(/update\s+dinner_plan[\s\S]{0,200}set\s+superseded_at/i);
    expect(files.some((name) => name.startsWith("0019"))).toBe(false);
  });
});

describe("request-time grocery mode", () => {
  const preview = {
    ENVIRONMENT: "preview",
    DEPLOY_ENV: "preview",
    GROCERY_PROVIDERS: "instacart",
    GROCERY_FIXTURE: "instacart_mock",
    GROCERY_MOCK_MODE: "ok",
    INSTACART_API_KEY: "dev-key-not-for-logs",
  };

  it("switches mock modes and development from a header, and production ignores both", () => {
    const timeout = groceryEnvForRequest(preview, new Request("https://fw.test/api/grocery/capabilities", { headers: { "X-FlavorWeave-Grocery-Mode": "timeout" } }));
    expect(instacartActivation(timeout).mode).toBe("mock");
    expect(timeout.GROCERY_MOCK_MODE).toBe("timeout");
    const providerError = groceryEnvForRequest(preview, new Request("https://fw.test/api/grocery/capabilities", { headers: { "X-FlavorWeave-Grocery-Mode": "provider-error" } }));
    expect(providerError.GROCERY_MOCK_MODE).toBe("provider_error");
    const dev = groceryEnvForRequest(preview, new Request("https://fw.test/api/grocery/capabilities", { headers: { "X-FlavorWeave-Grocery-Mode": "dev" } }));
    expect(instacartActivation(dev)).toMatchObject({ mode: "live", channel: "development", reason: "dev" });
    expect(dev.INSTACART_API_KEY).toBe(preview.INSTACART_API_KEY);
    const production = {
      ...preview,
      ENVIRONMENT: "production",
      DEPLOY_ENV: "production",
    };
    expect(productionLocked(production)).toBe(true);
    const ignored = groceryEnvForRequest(production, new Request("https://fw.test/api/grocery/capabilities", { headers: { "X-FlavorWeave-Grocery-Mode": "timeout" } }));
    expect(ignored).toBe(production);
    expect(instacartActivation(production).mode).toBe("live");
    expect(instacartActivation(production).channel).toBe("consumer");
    expect(instacartActivation({ ...production, INSTACART_API_KEY: "" }).configured).toBe(false);
  });

  it("uses the dev host and a server bearer token, and logs only safe diagnostics", async () => {
    const logs = [];
    const original = console.error;
    console.error = (line) => logs.push(String(line));
    const seen = [];
    try {
      const adapter = createInstacartAdapter({
        env: groceryEnvForRequest(preview, new Request("https://fw.test/", { headers: { "X-FlavorWeave-Grocery-Mode": "dev" } })),
        fetch: async (url, init) => {
          seen.push({ url: String(url), authorization: init.headers.Authorization });
          return new Response(JSON.stringify({ products_link_url: "https://www.instacart.com/store/shopping-list/dev" }), {
            status: 201,
            headers: { "x-request-id": "req_safe_1", "content-type": "application/json" },
          });
        },
      });
      const result = await adapter.createListHandoff({
        title: "FlavorWeave list",
        linkback_url: "https://fw.test/shop",
        lines: [{ name: "banana", display_text: "1 banana", measurements: [{ quantity: 1, unit: "each" }] }],
        expires_in_days: 14,
      });
      expect(result.ok).toBe(true);
      expect(seen[0].url).toBe(`${INSTACART_API_HOSTS.development}/idp/v1/products/products_link`);
      expect(seen[0].authorization).toBe("Bearer dev-key-not-for-logs");
      expect(result.diagnostic).toEqual({ http_status: 201, request_id: "req_safe_1", timeout: false });
      expect(logs.join("\n")).toContain("req_safe_1");
      expect(logs.join("\n")).not.toContain("dev-key-not-for-logs");
    } finally {
      console.error = original;
    }
  });

  it("changes mock mode per request and refuses a production smoke", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_syn", "m_syn", "[synthetic] E2E Kitchen");
    sqlite.prepare(`UPDATE household SET data_origin = 'synthetic' WHERE household_id = 'hh_syn'`).run();
    const calls = [];
    const env = { DB: asD1(sqlite), ...preview };
    const session = await createMemberSession(env.DB, { household_id: "hh_syn", member_id: "m_syn" });
    const opened = await call(env, "POST", "/api/household-shop", {
      token: session.session_token,
      body: { expected_revision: 1, op: "add_item", text: "2 cups milk", client_request_id: "milk" },
    });
    const capsOk = await call(env, "GET", "/api/grocery/capabilities", { token: session.session_token });
    expect(capsOk.body.providers.find((row) => row.id === "instacart").mode).toBe("mock");
    const capsTimeout = await call(env, "GET", "/api/grocery/capabilities", {
      token: session.session_token,
      headers: { "X-FlavorWeave-Grocery-Mode": "timeout" },
    });
    expect(capsTimeout.body.providers.find((row) => row.id === "instacart").channel).toBe("mock");
    const review = await call(env, "POST", "/api/grocery/review", {
      token: session.session_token,
      headers: { "X-FlavorWeave-Grocery-Mode": "timeout" },
      body: { provider_id: "instacart" },
    });
    const timed = await call(env, "POST", "/api/grocery/handoff", {
      token: session.session_token,
      headers: { "X-FlavorWeave-Grocery-Mode": "timeout" },
      body: { provider_id: "instacart", expected_revision: opened.body.list.revision, reviewed_fingerprint: review.body.fingerprint },
    });
    expect(timed.body.code).toBe("timeout");
    expect(calls).toEqual([]);
    const states = sqlite.prepare(`SELECT list_state FROM household_shop_line`).all();
    expect(states.every((row) => row.list_state === "open")).toBe(true);

    env.GROCERY_FETCH = async () => {
      calls.push("live");
      return new Response(JSON.stringify({ products_link_url: "https://www.instacart.com/store/shopping-list/dev" }), {
        status: 200,
        headers: { "x-request-id": "req_preview", "content-type": "application/json" },
      });
    };
    const smoke = await call(env, "POST", "/api/grocery/dev-smoke", {
      token: session.session_token,
      headers: { "X-FlavorWeave-Grocery-Mode": "dev" },
      body: {},
    });
    expect(smoke.status).toBe(200);
    expect(smoke.body.called).toBe(true);
    expect(smoke.body.url_valid).toBe(true);
    expect(smoke.body.diagnostic.request_id).toBe("req_preview");
    expect(smoke.body.purchased).toBe(false);
    expect(smoke.text).not.toContain("dev-key-not-for-logs");
    expect(calls).toEqual(["live"]);
    expect(sqlite.prepare(`SELECT list_state FROM household_shop_line`).all().every((row) => row.list_state === "open")).toBe(true);

    const missing = await call(
      { ...env, INSTACART_API_KEY: "" },
      "POST",
      "/api/grocery/dev-smoke",
      { token: session.session_token, headers: { "X-FlavorWeave-Grocery-Mode": "dev" }, body: {} }
    );
    expect(missing.body.error).toBe("dev_key_missing");
    expect(missing.body.called).toBe(false);

    const production = await worker.fetch(
      new Request("https://fw.test/api/grocery/dev-smoke", { method: "POST", body: "{}" }),
      { ...env, ENVIRONMENT: "production", DEPLOY_ENV: "production" }
    );
    expect(production.status).toBe(404);
  });
});

describe("development calls require a synthetic household", () => {
  function livePreview(extra = {}) {
    return {
      ENVIRONMENT: "preview",
      DEPLOY_ENV: "preview",
      GROCERY_PROVIDERS: "instacart",
      GROCERY_FIXTURE: "",
      INSTACART_API_KEY: "dev-key-not-for-logs",
      ...extra,
    };
  }

  function countingEnv(sqlite, extra = {}) {
    const calls = [];
    const env = livePreview({
      DB: asD1(sqlite),
      GROCERY_FETCH: async () => {
        calls.push("live");
        return new Response(JSON.stringify({ products_link_url: "https://www.instacart.com/store/shopping-list/dev" }), {
          status: 200,
          headers: { "x-request-id": "req_blocked", "content-type": "application/json" },
        });
      },
      ...extra,
    });
    return { calls, env };
  }

  it("does not fetch for a non-synthetic household that sends the dev header", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_real", "m_real", "The Parkers");
    const { calls, env } = countingEnv(sqlite);
    const session = await createMemberSession(env.DB, { household_id: "hh_real", member_id: "m_real" });
    const headers = { "X-FlavorWeave-Grocery-Mode": "dev" };
    const smoke = await call(env, "POST", "/api/grocery/dev-smoke", { token: session.session_token, headers, body: {} });
    expect(smoke.status).toBe(403);
    expect(smoke.body.error).toBe("dev_not_allowed");
    expect(smoke.body.called).toBe(false);
    const handoff = await call(env, "POST", "/api/grocery/handoff", { token: session.session_token, headers, body: {} });
    expect(handoff.status).toBe(403);
    expect(handoff.body.error).toBe("dev_not_allowed");
    expect(handoff.body.called).toBe(false);
    expect(calls).toEqual([]);
    expect(smoke.text).not.toContain("dev-key-not-for-logs");
  });

  it("does not fetch for a non-synthetic household when GROCERY_RUNTIME is dev", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_real", "m_real", "The Parkers");
    const { calls, env } = countingEnv(sqlite, { GROCERY_RUNTIME: "dev" });
    const session = await createMemberSession(env.DB, { household_id: "hh_real", member_id: "m_real" });
    const smoke = await call(env, "POST", "/api/grocery/dev-smoke", { token: session.session_token, body: {} });
    expect(smoke.status).toBe(403);
    expect(smoke.body.error).toBe("dev_not_allowed");
    expect(smoke.body.called).toBe(false);
    const handoff = await call(env, "POST", "/api/grocery/handoff", { token: session.session_token, body: {} });
    expect(handoff.body.error).toBe("dev_not_allowed");
    expect(calls).toEqual([]);

    const autoLive = countingEnv(sqlite);
    const auto = await call(autoLive.env, "POST", "/api/grocery/dev-smoke", { token: session.session_token, body: {} });
    expect(auto.body.error).toBe("dev_not_allowed");
    expect(auto.body.called).toBe(false);
    expect(autoLive.calls).toEqual([]);
  });

  it("uses the mock and does not fetch when a non-synthetic household asks for dev and a fixture is set", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_real", "m_real", "The Parkers");
    const { calls, env } = countingEnv(sqlite, { GROCERY_FIXTURE: "instacart_mock", GROCERY_RUNTIME: "dev" });
    const session = await createMemberSession(env.DB, { household_id: "hh_real", member_id: "m_real" });
    const caps = await call(env, "GET", "/api/grocery/capabilities", {
      token: session.session_token,
      headers: { "X-FlavorWeave-Grocery-Mode": "dev" },
    });
    expect(caps.body.providers.find((row) => row.id === "instacart").mode).toBe("mock");
    const smoke = await call(env, "POST", "/api/grocery/dev-smoke", {
      token: session.session_token,
      headers: { "X-FlavorWeave-Grocery-Mode": "dev" },
      body: {},
    });
    expect(smoke.body.called).toBe(false);
    expect(calls).toEqual([]);
  });

  it("fetches once for a synthetic household in development and leaves production unchanged", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_syn", "m_syn", "[synthetic] E2E Kitchen");
    sqlite.prepare(`UPDATE household SET data_origin = 'synthetic' WHERE household_id = 'hh_syn'`).run();
    const { calls, env } = countingEnv(sqlite, { GROCERY_RUNTIME: "dev" });
    const session = await createMemberSession(env.DB, { household_id: "hh_syn", member_id: "m_syn" });
    const smoke = await call(env, "POST", "/api/grocery/dev-smoke", {
      token: session.session_token,
      headers: { "X-FlavorWeave-Grocery-Mode": "dev" },
      body: {},
    });
    expect(smoke.status).toBe(200);
    expect(smoke.body.called).toBe(true);
    expect(calls).toEqual(["live"]);

    const productionCalls = [];
    const production = await worker.fetch(
      new Request("https://fw.test/api/grocery/dev-smoke", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-FlavorWeave-Grocery-Mode": "dev" },
        body: "{}",
      }),
      {
        ...livePreview(),
        DB: asD1(sqlite),
        ENVIRONMENT: "production",
        DEPLOY_ENV: "production",
        GROCERY_PROVIDERS: "",
        INSTACART_API_KEY: "",
        GROCERY_FETCH: async () => {
          productionCalls.push("live");
          return new Response("{}", { status: 200 });
        },
      }
    );
    expect(production.status).toBe(404);
    expect(productionCalls).toEqual([]);
    const productionEnv = {
      ENVIRONMENT: "production",
      DEPLOY_ENV: "production",
      GROCERY_PROVIDERS: "instacart",
      GROCERY_FIXTURE: "instacart_mock",
      GROCERY_RUNTIME: "dev",
      INSTACART_API_KEY: "prod-key-not-for-logs",
    };
    const overlaid = groceryEnvForRequest(
      productionEnv,
      new Request("https://fw.test/api/grocery/capabilities", { headers: { "X-FlavorWeave-Grocery-Mode": "dev" } })
    );
    expect(overlaid).toBe(productionEnv);
    const gated = groceryEnvForHousehold(productionEnv, overlaid, { data_origin: "household" });
    expect(gated.blocked).toBe(false);
    expect(gated.env).toBe(productionEnv);
    expect(instacartActivation(gated.env)).toMatchObject({ mode: "live", channel: "consumer" });
    expect(productionLocked(productionEnv)).toBe(true);
  });
});

describe("shopping regressions", () => {
  it("covers household items, quantities, plan lines, scaling, revisions, fingerprints, exclusions, and export", async () => {
    const list = emptyHouseholdList({ shop_list_id: "hsl_reg", household_id: "hh_reg", now: "2026-10-16T12:00:00.000Z" });
    const added = addGeneralItem(list, "2 cups milk", { now: "2026-10-16T12:00:00.000Z", client_request_id: "milk" });
    expect(added.ok).toBe(true);
    const milk = added.list.lines.find((line) => line.display_name.toLowerCase().includes("milk"));
    expect(milk.quantity_manual).toBe(2);
    const edited = editLine(added.list, { line_id: milk.line_id, patch: { quantity: 3 } }, { now: "2026-10-16T12:01:00.000Z" });
    expect(edited.ok).toBe(true);
    expect(edited.content_changed).toBe(true);
    const editedMilk = edited.list.lines.find((line) => line.display_name.toLowerCase().includes("milk"));
    expect(editedMilk.quantity_manual).toBe(3);
    expect(edited.list.content_revision).toBe(added.list.content_revision);

    const version = plannerCatalog()[0].pkg.recipe_version_id;
    const created = createDinnerPlan(
      {
        household_id: "hh_reg",
        dinner_plan_id: "dp_reg",
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: ["a"],
        meals: [{ kind: "recipe", recipe_version_id: version }],
      },
      {
        now: "2026-10-16T12:00:00.000Z",
        actor_member_id: "a",
        household_member_ids: ["a"],
        constraints: [],
        tastes: [],
        catalog: plannerCatalog(),
        data_origin: "synthetic",
        id: (prefix) => `${prefix}_reg`,
      }
    );
    expect(created.ok).toBe(true);
    const projected = projectPlanIntoList(edited.list, created.plan, { now: "2026-10-16T12:02:00.000Z" });
    expect(projected.list.lines.some((line) => (line.requirements || []).some((req) => req.origin === "recipe"))).toBe(true);
    expect(recipeYieldLine({ dinerCount: 4, guestCount: 2 })).toBe("For 4 · 2 guests");

    const clove = {
      line_id: "hl_clove",
      display_name: "garlic",
      unit: "clove",
      quantity_required: 3,
      quantity_manual: null,
      quantity_override: null,
      override_stale: 0,
      list_state: "open",
      still_needed: 1,
      unparsed: 0,
    };
    const bought = { ...clove, line_id: "hl_bought", unit: "cup", display_name: "milk", list_state: "purchased" };
    const transfer = projectTransfer({ lines: [clove, bought, { ...clove, line_id: "hl_cup", unit: "cup", display_name: "milk", list_state: "open" }] });
    expect(transfer.staying.map((row) => row.line_id).sort()).toEqual(["hl_bought", "hl_clove"]);
    expect(transfer.included.map((row) => row.line_id)).toEqual(["hl_cup"]);
    const before = await fingerprint(contentFingerprintInput([{ line_id: "hl_cup", display_name: "milk", unit: "cup", buy_quantity: 2, override_stale: 0, still_needed: 1 }]));
    const after = await fingerprint(contentFingerprintInput([{ line_id: "hl_cup", display_name: "milk", unit: "cup", buy_quantity: 3, override_stale: 0, still_needed: 1 }]));
    expect(before).not.toBe(after);
    const csv = renderExportCsv(exportSections(projected.list));
    expect(csv.startsWith("section,name,quantity,unit,note")).toBe(true);
  });
});

describe("dev smoke script", () => {
  function run(args, env = {}) {
    return spawnSync("node", ["scripts/grocery/instacart-dev-smoke.mjs", ...args], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, ...env },
    });
  }

  it("refuses to call Instacart without confirmation or a key, and a dry run prints no secret", () => {
    const bare = run([]);
    expect(bare.status).toBe(2);
    expect(bare.stderr).toMatch(/No request was sent/);
    const missing = run(["--confirm-dev"]);
    expect(missing.status).toBe(2);
    expect(missing.stderr).toMatch(/INSTACART_API_KEY/);
    expect(missing.stderr).toMatch(/No Instacart call was made/);
    const dry = run(["--confirm-dev", "--dry-run"], { INSTACART_API_KEY: "not-a-real-key" });
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain("https://connect.dev.instacart.tools");
    expect(dry.stdout).toContain('"called":false');
    expect(dry.stdout).not.toContain("not-a-real-key");
    expect(`${dry.stdout}\n${dry.stderr}`).not.toContain("Bearer not-a-real-key");
  });
});
