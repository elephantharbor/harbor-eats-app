/**
 * Creating a plan closes older unfinished plans for "current" selection.
 * It does not rewrite their meals, and a later write cannot steal the list.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createMemberSession } from "../src/lib/session.js";
import { plannerCatalog } from "../src/lib/dinner-planner.js";
import {
  findCurrentDinnerPlanId,
  listHouseholdDinnerPlans,
  loadDinnerPlan,
  saveDinnerPlan,
} from "../src/lib/dinner-plan-store.js";
import { projectSavedPlan } from "../src/lib/household-shop-routes.js";
import { routeDinnerPlanRequest } from "../src/lib/dinner-plan-routes.js";

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return sqlite;
}

function asD1(sqlite, batches) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
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
        },
      };
    },
    async batch(statements) {
      batches.push(statements.map((statement) => statement.sql));
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of statements) await statement.run();
        sqlite.exec("COMMIT");
        return statements.map(() => ({ success: true }));
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

function seed(sqlite) {
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_cur', 'Current', 'active', 'America/Chicago', 2, 'organic', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z', 'synthetic')`
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('m_a', 'hh_cur', 'Alex', 'owner', 'active', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
    )
    .run();
}

function barePlan(sqlite, row) {
  sqlite
    .prepare(
      `INSERT INTO dinner_plan
        (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json,
         data_origin, created_by_member_id, created_at, updated_at, superseded_at)
       VALUES (?, 'hh_cur', ?, 1, 'plan_dinners', '{}', 'synthetic', 'm_a', ?, ?, ?)`
    )
    .run(row.dinner_plan_id, row.status, row.created_at, row.updated_at, row.superseded_at || null);
}

describe("current dinner plan", () => {
  it("create supersedes older unfinished plans in the same write and a later write does not swap the list", async () => {
    const sqlite = migrate();
    const batches = [];
    const db = asD1(sqlite, batches);
    seed(sqlite);
    const auth = await createMemberSession(db, { household_id: "hh_cur", member_id: "m_a" }, { secure: false });
    const version = plannerCatalog()[0].pkg.recipe_version_id;
    const env = { DB: db };
    const deps = { writeOrigin: async () => "synthetic" };

    async function call(path, method, body) {
      const res = await routeDinnerPlanRequest(
        env,
        new Request(new URL(`https://fw.test${path}`), {
          method,
          headers: {
            Authorization: `Bearer ${auth.session_token}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        }),
        path,
        new URL(`https://fw.test${path}`),
        deps
      );
      return { status: res.status, body: await res.json() };
    }

    const planBody = {
      meal_count: 1,
      entry_point: "plan_dinners",
      participant_ids: ["m_a"],
      meals: [{ kind: "recipe", recipe_version_id: version }],
    };
    const first = await call("/api/dinner-plans", "POST", { ...planBody, dinner_plan_id: "dp_old" });
    expect(first.status).toBe(201);
    const mealId = first.body.plan.meals[0].meal_id;
    sqlite.prepare(`UPDATE dinner_plan SET status = 'active' WHERE dinner_plan_id = 'dp_old'`).run();
    sqlite.prepare(`UPDATE dinner_plan_meal SET state = 'cooked' WHERE meal_id = ?`).run(mealId);
    barePlan(sqlite, {
      dinner_plan_id: "dp_done",
      status: "completed",
      created_at: "2026-10-01T00:00:00.000Z",
      updated_at: "2026-10-15T00:00:00.000Z",
    });

    const before = sqlite.prepare(`SELECT status, updated_at FROM dinner_plan WHERE dinner_plan_id = 'dp_old'`).get();
    const second = await call("/api/dinner-plans", "POST", { ...planBody, dinner_plan_id: "dp_new" });
    expect(second.status).toBe(201);

    const createBatch = batches.filter((sqls) => sqls.some((sql) => /SET superseded_at = \?/.test(sql))).at(-1).join("\n");
    expect(createBatch).toMatch(/INSERT INTO dinner_plan/);
    expect(createBatch).toMatch(/SET superseded_at = \?/);
    expect(createBatch).not.toMatch(/SET status = \?/);

    const old = sqlite.prepare(`SELECT status, updated_at, superseded_at FROM dinner_plan WHERE dinner_plan_id = 'dp_old'`).get();
    const cooked = sqlite.prepare(`SELECT state FROM dinner_plan_meal WHERE meal_id = ?`).get(mealId);
    const done = sqlite.prepare(`SELECT superseded_at, status FROM dinner_plan WHERE dinner_plan_id = 'dp_done'`).get();
    const created = sqlite.prepare(`SELECT superseded_at FROM dinner_plan WHERE dinner_plan_id = 'dp_new'`).get();
    expect(old.superseded_at).toBeTruthy();
    expect(old.status).toBe(before.status);
    expect(old.updated_at).toBe(before.updated_at);
    expect(cooked.state).toBe("cooked");
    expect(done.superseded_at).toBeNull();
    expect(done.status).toBe("completed");
    expect(created.superseded_at).toBeNull();
    expect(await findCurrentDinnerPlanId(db, "hh_cur")).toBe("dp_new");
    const listed = await listHouseholdDinnerPlans(db, "hh_cur");
    expect(listed.map((row) => row.dinner_plan_id)).toContain("dp_new");
    expect(listed.map((row) => row.dinner_plan_id)).not.toContain("dp_old");
    expect(sqlite.prepare(`SELECT dinner_plan_id FROM household_shop_list WHERE household_id = 'hh_cur'`).get().dinner_plan_id).toBe("dp_new");

    const readable = await call("/api/dinner-plans/dp_old", "GET");
    expect(readable.status).toBe(200);
    expect(readable.body.plan.meals[0].state).toBe("cooked");

    const rated = await call(`/api/dinner-plans/dp_old/mutations`, "POST", {
      op: "rate_meal",
      meal_id: mealId,
      score: 8,
    });
    expect(rated.status).toBe(200);
    const afterWrite = sqlite.prepare(`SELECT updated_at, superseded_at, status FROM dinner_plan WHERE dinner_plan_id = 'dp_old'`).get();
    expect(afterWrite.updated_at).not.toBe(old.updated_at);
    expect(afterWrite.superseded_at).toBe(old.superseded_at);
    expect(await findCurrentDinnerPlanId(db, "hh_cur")).toBe("dp_new");
    expect(sqlite.prepare(`SELECT dinner_plan_id FROM household_shop_list WHERE household_id = 'hh_cur'`).get().dinner_plan_id).toBe("dp_new");
    const loaded = await loadDinnerPlan(db, "dp_old");
    expect(loaded.meals[0].ratings[0].score).toBe(8);
  });

  it("ignores a superseded plan even when its updated_at is newest", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite, []);
    seed(sqlite);
    barePlan(sqlite, {
      dinner_plan_id: "dp_open",
      status: "active",
      created_at: "2026-10-01T00:00:00.000Z",
      updated_at: "2026-10-02T00:00:00.000Z",
    });
    barePlan(sqlite, {
      dinner_plan_id: "dp_old",
      status: "active",
      created_at: "2026-10-03T00:00:00.000Z",
      updated_at: "2026-10-10T00:00:00.000Z",
      superseded_at: "2026-10-04T00:00:00.000Z",
    });
    expect(await findCurrentDinnerPlanId(db, "hh_cur")).toBe("dp_open");
    expect((await listHouseholdDinnerPlans(db, "hh_cur")).map((row) => row.dinner_plan_id)).toEqual(["dp_open"]);
  });

  it("keeps latest-updated_at behavior when superseded_at is null", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite, []);
    seed(sqlite);
    barePlan(sqlite, {
      dinner_plan_id: "dp_older",
      status: "active",
      created_at: "2026-10-01T00:00:00.000Z",
      updated_at: "2026-10-02T00:00:00.000Z",
    });
    barePlan(sqlite, {
      dinner_plan_id: "dp_newer",
      status: "draft",
      created_at: "2026-10-03T00:00:00.000Z",
      updated_at: "2026-10-04T00:00:00.000Z",
    });
    expect(await findCurrentDinnerPlanId(db, "hh_cur")).toBe("dp_newer");

    const older = await loadDinnerPlan(db, "dp_older");
    older.updated_at = "2026-10-12T00:00:00.000Z";
    await saveDinnerPlan(db, older);
    expect(await findCurrentDinnerPlanId(db, "hh_cur")).toBe("dp_older");
    await projectSavedPlan(db, older, older.updated_at);
    expect(sqlite.prepare(`SELECT dinner_plan_id FROM household_shop_list WHERE household_id = 'hh_cur'`).get().dinner_plan_id).toBe("dp_older");

    const newer = await loadDinnerPlan(db, "dp_newer");
    await projectSavedPlan(db, newer, "2026-10-13T00:00:00.000Z");
    expect(sqlite.prepare(`SELECT dinner_plan_id FROM household_shop_list WHERE household_id = 'hh_cur'`).get().dinner_plan_id).toBe("dp_older");
  });
});
