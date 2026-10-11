/**
 * D-06.1 weave controls: stepper, chip removal, and slot choice make no provider calls.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { createMemberSession } from "../src/lib/session.js";
import { applyPendingSlotChoice } from "../src/weave/plan-slot-choice.js";
import { routeWeaveRequest } from "../src/weave/routes.js";
import { emptyPlanningState } from "../src/weave/state.js";

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
              return { success: true };
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
    async batch(statements) {
      return statements.map((s) => ({ success: true, results: sqlite.prepare(s.sql).all(...s.params) }));
    },
  };
}

describe("D-06.1 no-AI weave controls", () => {
  it("count, chip apply, and slot choice never call the provider", async () => {
    const sqlite = migrate();
    sqlite.prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_ctrl', '[synthetic] ctrl', 'active', 'America/Chicago', 2, 'synthetic_qa', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', 'synthetic')`
    ).run();
    sqlite.prepare(
      `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('m_a', 'hh_ctrl', 'A', 'owner', 'active', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run();
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_ctrl", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ throw: { message: "provider should not run" } }] });
    const env = {
      DB: db,
      CATALOG_SOURCE: "d1",
      AI_PROVIDER: "fake",
      AI_FAKE_PROVIDER: provider,
      AI_GATEWAY_ENABLED: "1",
      AI_TASKS_ENABLED: "planning_intent,discovery_intent",
      AI_DAILY_BUDGET_USD: "5",
    };

    const countReq = new Request("https://example.test/api/plan/count", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.session_token}` },
      body: JSON.stringify({ schema_version: 1, dinner_count: 4, state: emptyPlanningState() }),
    });
    expect((await routeWeaveRequest(env, countReq, "/api/plan/count")).status).toBe(200);

    const chipReq = new Request("https://example.test/api/plan/apply", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.session_token}` },
      body: JSON.stringify({
        schema_version: 1,
        state: { ...emptyPlanningState(), dinner_count: 3, intent_cues: ["cozy"] },
        chip_id: "cue:cozy",
      }),
    });
    expect((await routeWeaveRequest(env, chipReq, "/api/plan/apply")).status).toBe(200);

    const withPending = {
      ...emptyPlanningState(),
      dinner_count: 3,
      pending_slot: { effort: "easy" },
    };
    const slotReq = new Request("https://example.test/api/plan/apply", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.session_token}` },
      body: JSON.stringify({
        schema_version: 1,
        state: withPending,
        slot_choice: { positions: [2] },
      }),
    });
    expect((await routeWeaveRequest(env, slotReq, "/api/plan/apply")).status).toBe(200);
    expect(applyPendingSlotChoice(withPending, [2]).ok).toBe(true);
    expect(provider.calls).toHaveLength(0);
  });
});
