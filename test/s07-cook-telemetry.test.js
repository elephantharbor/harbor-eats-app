/**
 * S-07 cook telemetry. completion_source is a closed enum on cook events only.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { cleanCookEventProps } from "../src/lib/cook-telemetry.js";
import { funnelCookCompletionSql } from "../src/lib/evidence-origin.js";
import { storedEventProps } from "../src/lib/household-shop.js";
import { createMemberSession } from "../src/lib/session.js";

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

function seedHousehold(sqlite, id, memberId) {
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES (?, ?, 'active', 'America/Chicago', 2, 'organic', '2026-10-17T00:00:00Z', '2026-10-17T00:00:00Z', 'household')`
    )
    .run(id, id);
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', 'active', '2026-10-17T00:00:00Z', '2026-10-17T00:00:00Z')`
    )
    .run(memberId, id, memberId);
}

async function call(env, method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await worker.fetch(
    new Request(new URL(`https://fw.test${path}`), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env
  );
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

function trackProps(source, name) {
  const needle = `track("${name}"`;
  const calls = [];
  let from = 0;
  while (from < source.length) {
    const start = source.indexOf(needle, from);
    if (start < 0) break;
    const brace = source.indexOf("{", start);
    let depth = 0;
    let end = brace;
    for (; end < source.length; end++) {
      if (source[end] === "{") depth += 1;
      else if (source[end] === "}") {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    calls.push(source.slice(brace, end));
    from = end;
  }
  return calls;
}

describe("cleanCookEventProps", () => {
  it("keeps known sources and drops anything else", () => {
    for (const eventName of ["cook_completed", "cook_recorded", "cook_undone"]) {
      expect(cleanCookEventProps(eventName, { completion_source: "mark_cooked", meal_id: "m" })).toEqual({
        completion_source: "mark_cooked",
        meal_id: "m",
      });
      expect(cleanCookEventProps(eventName, { completion_source: "finish_cook" }).completion_source).toBe("finish_cook");
      for (const bad of ["guided", "", null, {}, "nut allergy"]) {
        const cleaned = cleanCookEventProps(eventName, { completion_source: bad, meal_id: "m" });
        expect(cleaned).toEqual({ meal_id: "m" });
        expect(JSON.stringify(cleaned)).not.toContain("nut allergy");
      }
    }
    const shop = { type: "copy_app", ok: true, surface: "shop_sheet", completion_source: "mark_cooked" };
    expect(cleanCookEventProps("shop_export", shop)).toEqual(shop);
    const plan = { completion_source: "finish_cook", dinner_plan_id: "dp" };
    expect(cleanCookEventProps("plan_finalized", plan)).toEqual(plan);
  });
});

describe("POST /api/events completion_source", () => {
  it("stores a known source on cook events", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_s07", "m_s07");
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const session = await createMemberSession(env.DB, { household_id: "hh_s07", member_id: "m_s07" });
    const recorded = await call(env, "POST", "/api/events", {
      token: session.session_token,
      body: {
        event_name: "cook_recorded",
        meal_option_id: "meal_a",
        completion_source: "mark_cooked",
      },
    });
    expect(recorded.status).toBe(201);
    const stored = sqlite.prepare("SELECT props_json FROM event WHERE event_name = 'cook_recorded'").get();
    expect(JSON.parse(stored.props_json).completion_source).toBe("mark_cooked");

    const undone = await call(env, "POST", "/api/events", {
      token: session.session_token,
      body: {
        event_name: "cook_undone",
        meal_option_id: "meal_a",
        completion_source: "finish_cook",
      },
    });
    expect(undone.status).toBe(201);
    const undoRow = sqlite.prepare("SELECT props_json FROM event WHERE event_name = 'cook_undone'").get();
    expect(JSON.parse(undoRow.props_json).completion_source).toBe("finish_cook");
    sqlite.close();
  });

  it("drops an unknown completion_source and still keeps the event", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_s07b", "m_s07b");
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const session = await createMemberSession(env.DB, { household_id: "hh_s07b", member_id: "m_s07b" });
    const accepted = await call(env, "POST", "/api/events", {
      token: session.session_token,
      body: {
        event_name: "cook_recorded",
        meal_option_id: "meal_b",
        completion_source: "nut allergy",
      },
    });
    expect(accepted.status).toBe(201);
    const stored = sqlite.prepare("SELECT props_json FROM event WHERE event_name = 'cook_recorded'").get();
    const props = stored.props_json ? JSON.parse(stored.props_json) : {};
    expect(props.completion_source).toBeUndefined();
    expect(JSON.stringify(stored.props_json)).not.toContain("nut allergy");
    sqlite.close();
  });

  it("leaves shop_export closed-field gating unchanged", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_s07c", "m_s07c");
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const session = await createMemberSession(env.DB, { household_id: "hh_s07c", member_id: "m_s07c" });
    const accepted = await call(env, "POST", "/api/events", {
      token: session.session_token,
      body: {
        event_name: "shop_export",
        type: "copy_app",
        ok: true,
        surface: "shop_sheet",
        completion_source: "mark_cooked",
        ingredient: "secret onions",
      },
    });
    expect(accepted.status).toBe(201);
    const stored = sqlite.prepare("SELECT props_json FROM event WHERE event_name = 'shop_export'").get();
    expect(JSON.parse(stored.props_json)).toEqual({ type: "copy_app", ok: true, surface: "shop_sheet" });
    expect(storedEventProps("shop_export", { type: "copy_app", ok: true, surface: "shop_sheet" }).props).toEqual({
      type: "copy_app",
      ok: true,
      surface: "shop_sheet",
    });
    sqlite.close();
  });
});

describe("cook funnel netting", () => {
  it("still counts one meal after mark, undo, and a guided finish", () => {
    const sqlite = migrate();
    const insert = sqlite.prepare(
      `INSERT INTO event (event_id, event_name, household_id, meal_option_id, props_json, created_at, data_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const rows = [
      ["e1", "cook_recorded", "hh_tel", "meal_a", JSON.stringify({ completion_source: "mark_cooked" })],
      ["e2", "cook_undone", "hh_tel", "meal_a", JSON.stringify({ completion_source: "mark_cooked" })],
      ["e3", "cook_recorded", "hh_tel", "meal_a", JSON.stringify({ completion_source: "finish_cook" })],
    ];
    for (const row of rows) insert.run(...row, "t", "household");
    expect(sqlite.prepare(funnelCookCompletionSql()).get("hh_tel").c).toBe(1);
    sqlite.close();
  });
});

describe("client cook events", () => {
  it("forwards completion_source on every cook track call", () => {
    const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    for (const name of ["cook_completed", "cook_recorded", "cook_undone"]) {
      const calls = trackProps(source, name);
      expect(calls.length).toBeGreaterThan(0);
      for (const props of calls) expect(props).toContain("completion_source");
    }
    expect(source).toMatch(/completion_source:\s*p\.completion_source/);
  });
});
