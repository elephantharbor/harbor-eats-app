/**
 * S-04A.1: plan-save must not hide a failed shopping projection,
 * expected revision conflicts are not db_error, and provider-review
 * quantities use the list formatter. No Instacart network call.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { classifyClientError, summarizeClientErrors } from "../src/lib/client-error-class.js";
import { databaseLeakText } from "../src/lib/db-error.js";
import { routeDinnerPlanRequest } from "../src/lib/dinner-plan-routes.js";
import { loadDinnerPlan } from "../src/lib/dinner-plan-store.js";
import { plannerCatalog } from "../src/lib/dinner-planner.js";
import { instacartRequestBody, projectTransfer } from "../src/lib/grocery/projection.js";
import { INSTACART_UNIT_MAP } from "../src/lib/grocery/units.js";
import { presentLine } from "../src/lib/household-shop.js";
import { projectSavedPlan, routeHouseholdShopRequest } from "../src/lib/household-shop-routes.js";
import { commitList, isExpectedRevisionConflict, loadOpenList } from "../src/lib/household-shop-store.js";
import { createMemberSession } from "../src/lib/session.js";
import { formatShopQty, presentShopQuantity, SHOP_QTY_UNICODE } from "../src/lib/shop-display.js";

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

function seed(sqlite, householdId, memberId) {
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES (?, ?, 'active', 'America/Chicago', 2, 'organic', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z', 'household')`
    )
    .run(householdId, householdId);
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', 'active', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
    )
    .run(memberId, householdId, memberId);
}

function captureLogs() {
  const lines = [];
  const spy = vi.spyOn(console, "error").mockImplementation((line) => {
    lines.push(String(line));
  });
  return {
    lines,
    events() {
      return lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    },
    restore() {
      spy.mockRestore();
    },
  };
}

function sqlOf(statements) {
  return statements.map((statement) => statement.sql).join("\n");
}

async function world() {
  const sqlite = migrate();
  seed(sqlite, "hh_a", "m_a");
  seed(sqlite, "hh_b", "m_b");
  const db = asD1(sqlite);
  const sessionA = await createMemberSession(db, { household_id: "hh_a", member_id: "m_a" });
  const env = { DB: db, ENVIRONMENT: "test" };
  const deps = { writeOrigin: async () => "synthetic" };
  const version = plannerCatalog()[0].pkg.recipe_version_id;
  return { sqlite, db, env, deps, sessionA, version };
}

function planBody(version, dinnerPlanId) {
  return {
    dinner_plan_id: dinnerPlanId,
    meal_count: 1,
    entry_point: "plan_dinners",
    participant_ids: ["m_a"],
    meals: [{ kind: "recipe", recipe_version_id: version }],
  };
}

async function callPlan(env, deps, token, path, method, body) {
  const res = await routeDinnerPlanRequest(
    env,
    new Request(new URL(`https://fw.test${path}`), {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    path,
    new URL(`https://fw.test${path}`),
    deps
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

async function callShop(env, deps, token) {
  const res = await routeHouseholdShopRequest(
    env,
    new Request("https://fw.test/api/household-shop", { headers: { Authorization: `Bearer ${token}` } }),
    "/api/household-shop",
    new URL("https://fw.test/api/household-shop"),
    deps
  );
  return { status: res.status, body: await res.json() };
}

function planCount(sqlite, householdId) {
  return sqlite.prepare(`SELECT COUNT(*) AS c FROM dinner_plan WHERE household_id = ?`).get(householdId).c;
}

function shopLineCount(sqlite, householdId) {
  return sqlite
    .prepare(
      `SELECT COUNT(*) AS c FROM household_shop_line line
       JOIN household_shop_list list ON list.shop_list_id = line.shop_list_id
       WHERE list.household_id = ?`
    )
    .get(householdId).c;
}

function duplicateIdentities(sqlite, householdId) {
  return sqlite
    .prepare(
      `SELECT ifnull(line.ingredient_id,''), ifnull(line.general_key,''), line.unit, COUNT(*) AS c
       FROM household_shop_line line
       JOIN household_shop_list list ON list.shop_list_id = line.shop_list_id
       WHERE list.household_id = ?
       GROUP BY 1, 2, 3
       HAVING c > 1`
    )
    .all(householdId);
}

function installBatch(db, decide) {
  const original = db.batch.bind(db);
  const calls = [];
  db.batch = async (statements) => {
    const sql = sqlOf(statements);
    calls.push(sql);
    const outcome = decide(sql, calls.length);
    if (outcome) throw outcome;
    return original(statements);
  };
  return {
    calls,
    restore() {
      db.batch = original;
    },
  };
}

const CAS_CONFLICT = new Error("NOT NULL constraint failed: household_shop_cas.shop_list_id");
const SECRET = "secret-token-do-not-log@example.com";
const SHOP_FAULT = new Error(`NOT NULL constraint failed: household_shop_line.display_name ${SECRET} INSERT INTO household_shop_line`);

describe("plan-save projection", () => {
  it("saves a plan and projects one shopping list", async () => {
    const { sqlite, env, deps, sessionA, version } = await world();
    const created = await callPlan(env, deps, sessionA.session_token, "/api/dinner-plans", "POST", planBody(version, "dp_ok"));
    expect(created.status).toBe(201);
    expect(created.body.ok).toBe(true);
    expect(planCount(sqlite, "hh_a")).toBe(1);
    expect(shopLineCount(sqlite, "hh_a")).toBeGreaterThan(0);
    expect(shopLineCount(sqlite, "hh_b")).toBe(0);
    expect(duplicateIdentities(sqlite, "hh_a")).toHaveLength(0);
    const again = await projectSavedPlan(env.DB, created.body.plan, "2026-10-17T00:00:00.000Z");
    expect(again.ok).toBe(true);
    expect(planCount(sqlite, "hh_a")).toBe(1);
    expect(duplicateIdentities(sqlite, "hh_a")).toHaveLength(0);
  });

  it("retries one revision conflict and does not log it as db_error", async () => {
    const { sqlite, db, env, deps, sessionA, version } = await world();
    let conflicts = 0;
    const batch = installBatch(db, (sql) => {
      if (!sql.includes("household_shop_cas")) return null;
      if (conflicts < 1) {
        conflicts += 1;
        return CAS_CONFLICT;
      }
      return null;
    });
    const logs = captureLogs();
    const created = await callPlan(env, deps, sessionA.session_token, "/api/dinner-plans", "POST", planBody(version, "dp_conflict"));
    logs.restore();
    batch.restore();
    expect(created.status).toBe(201);
    expect(created.body.ok).toBe(true);
    expect(conflicts).toBe(1);
    expect(shopLineCount(sqlite, "hh_a")).toBeGreaterThan(0);
    expect(planCount(sqlite, "hh_a")).toBe(1);
    expect(duplicateIdentities(sqlite, "hh_a")).toHaveLength(0);
    const events = logs.events();
    expect(events.filter((event) => event.event === "revision_conflict")).toHaveLength(1);
    expect(events.some((event) => event.event === "db_error")).toBe(false);
    expect(logs.lines.join("\n")).not.toContain("household_shop_cas");
  });

  it("stops after one conflict retry and does not report success", async () => {
    const { sqlite, db, env, deps, sessionA, version } = await world();
    let conflicts = 0;
    const batch = installBatch(db, (sql) => {
      if (!sql.includes("household_shop_cas")) return null;
      conflicts += 1;
      return CAS_CONFLICT;
    });
    const logs = captureLogs();
    const created = await callPlan(env, deps, sessionA.session_token, "/api/dinner-plans", "POST", planBody(version, "dp_stuck"));
    logs.restore();
    batch.restore();
    expect(conflicts).toBe(2);
    expect(created.status).toBe(500);
    expect(created.body).toEqual({ ok: false, error: "shop_projection_failed", dinner_plan_id: "dp_stuck" });
    expect(databaseLeakText(created.text)).toBe(false);
    expect(planCount(sqlite, "hh_a")).toBe(1);
    expect(shopLineCount(sqlite, "hh_a")).toBe(0);
    expect(logs.events().every((event) => event.event === "revision_conflict")).toBe(true);
    expect(logs.events()).toHaveLength(2);
  });

  it("surfaces an unexpected shopping failure once, without SQL, then recovers in place", async () => {
    const { sqlite, db, env, deps, sessionA, version } = await world();
    let faults = 0;
    const batch = installBatch(db, (sql) => {
      if (!sql.includes("household_shop_cas")) return null;
      faults += 1;
      return SHOP_FAULT;
    });
    const logs = captureLogs();
    const created = await callPlan(env, deps, sessionA.session_token, "/api/dinner-plans", "POST", planBody(version, "dp_fault"));
    logs.restore();
    expect(faults).toBe(1);
    expect(created.status).toBe(500);
    expect(created.body.error).toBe("shop_projection_failed");
    expect(created.body.dinner_plan_id).toBe("dp_fault");
    expect(created.text).not.toContain(SECRET);
    expect(created.text).not.toContain("INSERT");
    expect(created.text).not.toContain("display_name");
    expect(databaseLeakText(created.text)).toBe(false);
    expect(planCount(sqlite, "hh_a")).toBe(1);
    expect(shopLineCount(sqlite, "hh_a")).toBe(0);
    expect(shopLineCount(sqlite, "hh_b")).toBe(0);
    const events = logs.events();
    expect(events).toEqual([{ event: "db_error", scope: "household_shop_commit", kind: "not_null" }]);
    expect(logs.lines.join("\n")).not.toContain(SECRET);
    expect(logs.lines.join("\n")).not.toContain("INSERT");

    const blocked = await callShop(env, deps, sessionA.session_token);
    expect(blocked.status).toBe(200);
    expect(blocked.body.ok).toBe(true);
    expect(blocked.body.list.lines).toHaveLength(0);
    expect(planCount(sqlite, "hh_a")).toBe(1);

    batch.restore();
    const recovered = await callShop(env, deps, sessionA.session_token);
    expect(recovered.status).toBe(200);
    expect(recovered.body.list.lines.length).toBeGreaterThan(0);
    expect(planCount(sqlite, "hh_a")).toBe(1);
    expect(shopLineCount(sqlite, "hh_b")).toBe(0);
    expect(duplicateIdentities(sqlite, "hh_a")).toHaveLength(0);
    const stored = await loadDinnerPlan(env.DB, "dp_fault");
    const replay = await projectSavedPlan(env.DB, stored, "2026-10-17T00:00:00.000Z");
    expect(replay.ok).toBe(true);
    expect(planCount(sqlite, "hh_a")).toBe(1);
    expect(duplicateIdentities(sqlite, "hh_a")).toHaveLength(0);
  });

  it("keeps a dinner-plan write failure distinct from a projection failure", async () => {
    const { sqlite, db, env, deps, sessionA, version } = await world();
    const batch = installBatch(db, (sql) => {
      if (/INSERT INTO dinner_plan\b/.test(sql)) return new Error(`no such table: dinner_plan ${SECRET}`);
      return null;
    });
    const logs = captureLogs();
    const created = await callPlan(env, deps, sessionA.session_token, "/api/dinner-plans", "POST", planBody(version, "dp_plan"));
    logs.restore();
    batch.restore();
    expect(created.status).toBe(500);
    expect(created.body).toEqual({ ok: false, error: "dinner_plan_save_failed" });
    expect(created.text).not.toContain(SECRET);
    expect(created.text).not.toContain("no such table");
    expect(planCount(sqlite, "hh_a")).toBe(0);
    expect(logs.events()).toEqual([{ event: "db_error", scope: "dinner_plan_save", kind: "schema" }]);
  });

  it("keeps a saved guest change when projection fails, then reconciles without a second plan", async () => {
    const { sqlite, db, env, deps, sessionA, version } = await world();
    const created = await callPlan(env, deps, sessionA.session_token, "/api/dinner-plans", "POST", planBody(version, "dp_guest"));
    expect(created.status).toBe(201);
    const before = shopLineCount(sqlite, "hh_a");
    const mealId = created.body.plan.meals[0].meal_id;
    const batch = installBatch(db, (sql) => (sql.includes("household_shop_cas") ? SHOP_FAULT : null));
    const mutated = await callPlan(env, deps, sessionA.session_token, "/api/dinner-plans/dp_guest/mutations", "POST", {
      op: "set_guest_count",
      meal_id: mealId,
      guest_count: 2,
    });
    batch.restore();
    expect(mutated.status).toBe(500);
    expect(mutated.body.error).toBe("shop_projection_failed");
    expect(mutated.body.dinner_plan_id).toBe("dp_guest");
    expect(databaseLeakText(mutated.text)).toBe(false);
    expect(planCount(sqlite, "hh_a")).toBe(1);
    expect(sqlite.prepare(`SELECT guest_count AS c FROM dinner_plan_meal WHERE meal_id = ?`).get(mealId).c).toBe(2);
    expect(shopLineCount(sqlite, "hh_a")).toBe(before);
    const recovered = await callShop(env, deps, sessionA.session_token);
    expect(recovered.body.ok).toBe(true);
    expect(planCount(sqlite, "hh_a")).toBe(1);
    expect(shopLineCount(sqlite, "hh_b")).toBe(0);
    expect(duplicateIdentities(sqlite, "hh_a")).toHaveLength(0);
  });
});

describe("revision conflict logging", () => {
  it("classifies the compare-and-swap miss and a real NOT NULL differently", () => {
    expect(isExpectedRevisionConflict("NOT NULL constraint failed: household_shop_cas.shop_list_id")).toBe(true);
    expect(isExpectedRevisionConflict("NOT NULL constraint failed")).toBe(true);
    expect(isExpectedRevisionConflict("NOT NULL constraint failed: household_shop_line.display_name")).toBe(false);
    expect(isExpectedRevisionConflict("UNIQUE constraint failed: household_shop_requirement.requirement_id")).toBe(false);
  });

  it("logs a real stale commit as revision_conflict and a real column fault as db_error", async () => {
    const { sqlite, db, env, deps, sessionA, version } = await world();
    const created = await callPlan(env, deps, sessionA.session_token, "/api/dinner-plans", "POST", planBody(version, "dp_log"));
    expect(created.status).toBe(201);
    const list = await loadOpenList(db, "hh_a");
    const logs = captureLogs();
    const stale = await commitList(db, list, list.revision - 1, false);
    const events = logs.events();
    logs.restore();
    expect(stale).toMatchObject({ ok: false, error: "revision_conflict", status: 409 });
    expect(events).toEqual([{ event: "revision_conflict", scope: "household_shop_commit" }]);
    expect(shopLineCount(sqlite, "hh_a")).toBeGreaterThan(0);

    const faultLogs = captureLogs();
    const original = db.batch.bind(db);
    db.batch = async () => {
      throw SHOP_FAULT;
    };
    const failed = await commitList(db, list, list.revision, false);
    db.batch = original;
    expect(failed).toMatchObject({ ok: false, error: "shop_save_failed", status: 500 });
    expect(faultLogs.events()).toEqual([{ event: "db_error", scope: "household_shop_commit", kind: "not_null" }]);
    expect(faultLogs.lines.join("\n")).not.toContain(SECRET);
    expect(faultLogs.lines.join("\n")).not.toContain("INSERT");
    faultLogs.restore();
  });

  it("keeps the actionable client-error classes", () => {
    const rows = [
      { message: "/api/household-shop 409", data_origin: "household", display_name: "The Parkers" },
      { message: "/api/dinner-plans 500", data_origin: "household", display_name: "The Parkers" },
      { message: "/api/sessions/me 401", data_origin: "household", display_name: "The Parkers" },
    ];
    expect(rows.map(classifyClientError)).toEqual(["actionable", "actionable", "expected_logged_out"]);
    expect(summarizeClientErrors(rows)).toMatchObject({ total: 3, actionable: 2, expected_logged_out: 1 });
  });
});

describe("quantity presentation", () => {
  it("shows the list fractions and leaves uncommon decimals alone", () => {
    expect(formatShopQty({ quantity: 0.125, unit: "cup" })).toBe("1/8 cup");
    expect(formatShopQty({ quantity: 0.5, unit: "cup" })).toBe("1/2 cup");
    expect(presentShopQuantity({ quantity: 0.125, unit: "tsp" })).toEqual({
      display: "⅛ teaspoon",
      accessible: "1/8 teaspoon",
      unicode: true,
    });
    expect(presentShopQuantity({ quantity: 0.125, unit: "teaspoon" }).display).toBe("⅛ teaspoon");
    expect(presentShopQuantity({ quantity: 0.5, unit: "cup" })).toEqual({
      display: "½ cup",
      accessible: "1/2 cup",
      unicode: true,
    });
    expect(presentShopQuantity({ quantity: 0.5, unit: "each", name: "lime" })).toEqual({
      display: "½ lime",
      accessible: "1/2 lime",
      unicode: true,
    });
    expect(presentShopQuantity({ quantity: 0.5, unit: "count", name: "lime" }).display).toBe("½ lime");
    expect(presentShopQuantity({ quantity: 5, unit: "each", name: "yellow onion" }).display).toBe("5 yellow onions");
    expect(presentShopQuantity({ quantity: 1, unit: "each", name: "lime" }).display).toBe("1 lime");
    expect(presentShopQuantity({ quantity: 1.5, unit: "cup" })).toEqual({
      display: "1 ½ cup",
      accessible: "1 1/2 cup",
      unicode: true,
    });
    expect(presentShopQuantity({ quantity: 1 / 3, unit: "cup" }).display).toBe("⅓ cup");
    expect(presentShopQuantity({ quantity: 0.2, unit: "cup" })).toEqual({
      display: "0.2 cup",
      accessible: "0.2 cup",
      unicode: false,
    });
    expect(presentShopQuantity({ quantity: 0.126, unit: "teaspoon" }).display).toBe("0.126 teaspoon");
    expect(presentShopQuantity({ quantity: 0.333, unit: "cup" }).display).toBe("0.333 cup");
    expect(presentShopQuantity({ quantity: 0.5, unit: "each", name: "2% milk" }).display).toBe("½ each");
  });

  it("uses the same words on the native list and the provider review", () => {
    const line = {
      line_id: "hl_salt",
      display_name: "salt",
      unit: "tsp",
      quantity_required: 0.125,
      quantity_manual: null,
      quantity_override: null,
      override_stale: 0,
      still_needed: 1,
      list_state: "open",
      unparsed: 0,
      requirements: [],
      meal_ids: [],
    };
    const listed = presentLine(line);
    expect(listed.buy_quantity).toBe(0.125);
    expect(listed.quantity_label).toBe("⅛ teaspoon");
    expect(listed.quantity_accessible).toBe("1/8 teaspoon");
    const review = projectTransfer({ lines: [line] }).included[0];
    expect(review.quantity_label).toBe(listed.quantity_label);
    expect(review.quantity_accessible).toBe(listed.quantity_accessible);
  });

  it("keeps canonical quantities and the provider payload byte-identical", () => {
    expect(INSTACART_UNIT_MAP.tsp).toBe("teaspoon");
    expect(INSTACART_UNIT_MAP.cup).toBe("cup");
    expect(INSTACART_UNIT_MAP.count).toBe("each");
    const lines = [
      { line_id: "hl_lime", display_name: "lime", unit: "count", quantity: 0.5 },
      { line_id: "hl_milk", display_name: "milk", unit: "cup", quantity: 0.5 },
      { line_id: "hl_salt", display_name: "salt", unit: "tsp", quantity: 0.125 },
    ].map((row) => ({
      line_id: row.line_id,
      display_name: row.display_name,
      unit: row.unit,
      quantity_required: row.quantity,
      quantity_manual: null,
      quantity_override: null,
      override_stale: 0,
      still_needed: 1,
      list_state: "open",
      unparsed: 0,
    }));
    const projection = projectTransfer({ lines });
    expect(projection.included.map((row) => [row.line_id, row.our_quantity, row.measurements, row.quantity_label])).toEqual([
      ["hl_lime", 0.5, [{ quantity: 0.5, unit: "each" }], "½ lime"],
      ["hl_milk", 0.5, [{ quantity: 0.5, unit: "cup" }], "½ cup"],
      ["hl_salt", 0.125, [{ quantity: 0.125, unit: "teaspoon" }], "⅛ teaspoon"],
    ]);
    const payload = instacartRequestBody({
      title: projection.title,
      included: projection.included,
      linkback: "https://fw.test/list",
    });
    const expected = {
      title: "FlavorWeave list",
      link_type: "shopping_list",
      expires_in: 14,
      line_items: [
        { name: "lime", display_text: "Lime", line_item_measurements: [{ quantity: 0.5, unit: "each" }] },
        { name: "milk", display_text: "Milk", line_item_measurements: [{ quantity: 0.5, unit: "cup" }] },
        { name: "salt", display_text: "Salt", line_item_measurements: [{ quantity: 0.125, unit: "teaspoon" }] },
      ],
      landing_page_configuration: { partner_linkback_url: "https://fw.test/list" },
    };
    expect(JSON.stringify(payload)).toBe(JSON.stringify(expected));
    expect(JSON.stringify(payload)).not.toContain("½");
    expect(JSON.stringify(payload)).not.toContain("⅛");
    expect(JSON.stringify(payload)).not.toContain("1/8");
    expect(JSON.stringify(payload)).not.toContain("quantity_label");
  });

  it("keeps the client unicode map aligned with the formatter", () => {
    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    for (const [ascii, glyph] of Object.entries(SHOP_QTY_UNICODE)) {
      expect(app).toContain(`"${ascii}": "${glyph}"`);
    }
    expect(app).toContain("escapeHtml(qtyAccess)");
  });
});
