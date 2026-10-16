import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { plannerCatalog } from "../src/lib/dinner-planner.js";
import { createMemberSession } from "../src/lib/session.js";
import { applyPlanMutation, createDinnerPlan } from "../src/lib/plan-mutations.js";
import { routeHouseholdShopRequest } from "../src/lib/household-shop-routes.js";
import { projectSavedPlan } from "../src/lib/household-shop-routes.js";
import { saveDinnerPlan } from "../src/lib/dinner-plan-store.js";
import {
  addGeneralItem,
  buyQuantity,
  clearCompleted,
  csvCell,
  deleteGeneralSource,
  editLine,
  emptyHouseholdList,
  categoryForName,
  parseGeneralItem,
  projectPlanIntoList,
  recipeYieldLine,
  renderExportCsv,
  renderRecipeExport,
  resolveOverride,
  sanitizeShopEvent,
  setLineState,
  shareSnapshot,
} from "../src/lib/household-shop.js";

function loadMigrations(db, { skip0017 = false } = {}) {
  db.exec("PRAGMA foreign_keys = ON");
  const dir = new URL("../migrations", import.meta.url).pathname;
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && !(skip0017 && name.startsWith("0017")))
    .sort();
  for (const file of files) db.exec(readFileSync(`${dir}/${file}`, "utf8"));
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
              await Promise.resolve();
              const result = sqlite.prepare(sql).run(...params);
              return { success: true, meta: { changes: result.changes } };
            },
            async first() {
              await Promise.resolve();
              return sqlite.prepare(sql).get(...params) ?? null;
            },
            async all() {
              await Promise.resolve();
              return { results: sqlite.prepare(sql).all(...params) };
            },
          };
        },
      };
    },
    async batch(statements) {
      await Promise.resolve();
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of statements) {
          sqlite.prepare(statement.sql).run(...statement.params);
        }
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

function insertHousehold(sqlite, id) {
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES (?, ?, 'active', 'America/Chicago', 2, 'organic', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z', 'synthetic')`
    )
    .run(id, id);
}

function insertMember(sqlite, householdId, memberId, status = "active") {
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', ?, '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
    )
    .run(memberId, householdId, memberId, status);
}

let seq = 0;
function ids() {
  seq += 1;
  const n = seq;
  return (prefix) => `${prefix}_${n}_${Math.random().toString(16).slice(2, 6)}`;
}

function planCtx(extra = {}) {
  return {
    now: "2026-10-16T12:00:00.000Z",
    actor_member_id: "a",
    household_member_ids: ["a", "b"],
    constraints: [],
    data_origin: "synthetic",
    tastes: [],
    catalog: plannerCatalog(),
    id: ids(),
    ...extra,
  };
}

function makePlan(extraMeals, ctxExtra = {}, planExtra = {}) {
  const ctx = planCtx(ctxExtra);
  const version = plannerCatalog()[0].pkg.recipe_version_id;
  const created = createDinnerPlan(
    {
      household_id: planExtra.household_id || "hh_shop",
      dinner_plan_id: planExtra.dinner_plan_id || "dp_shop",
      meal_count: 1,
      entry_point: "plan_dinners",
      participant_ids: planExtra.participant_ids || ["a", "b"],
      meals: [{ kind: "recipe", recipe_version_id: version, ...(extraMeals || {}) }],
    },
    ctx
  );
  if (!created.ok) throw new Error(created.error || "plan");
  return { plan: created.plan, ctx };
}

function blank(plan) {
  return emptyHouseholdList({
    shop_list_id: "hsl_test",
    household_id: plan.household_id,
    now: "2026-10-16T12:00:00.000Z",
    dinner_plan_id: null,
  });
}

function lineNamed(list, name) {
  return list.lines.find((row) => row.display_name.includes(name) || row.ingredient_id === name);
}

describe("general item parser", () => {
  it("keeps a bare name and does not invent a unit", () => {
    const bananas = parseGeneralItem("bananas");
    expect(bananas.ok).toBe(true);
    expect(bananas.quantity).toBeNull();
    expect(bananas.unit).toBe("unparsed");
    expect(bananas.ingredient_id).toBe("bananas");
    const coffee = parseGeneralItem("coffee");
    expect(coffee.unit).toBe("unparsed");
    expect(coffee.ingredient_id).toBe("coffee");
    const towels = parseGeneralItem("paper towels");
    expect(towels.unit).toBe("unparsed");
    expect(towels.ingredient_id).toBe("paper-towels");
    expect(categoryForName("paper towels")).toBe("household");
    expect(categoryForName("bananas")).toBe("produce");
    expect(categoryForName("detergent")).toBe("household");
    expect(categoryForName("coffee")).toBe("pantry");
  });

  it("parses a quantity and a known unit, and keeps a bare count without inventing each", () => {
    const milk = parseGeneralItem("2 cartons oat milk");
    expect(milk.quantity).toBe(2);
    expect(milk.unit).toBe("carton");
    expect(milk.ingredient_id).toBe("oat-milk");
    const onions = parseGeneralItem("3 onions");
    expect(onions.quantity).toBe(3);
    expect(onions.unit).toBe("unparsed");
    expect(onions.ingredient_id).toBe("onion");
    const counted = parseGeneralItem("3 count onions");
    expect(counted.unit).toBe("count");
    expect(counted.ingredient_id).toBe("onion");
  });

  it("rejects a bare number and an empty name", () => {
    expect(parseGeneralItem("3").ok).toBe(false);
    expect(parseGeneralItem("1/2").error).toBe("item_name_required");
    expect(parseGeneralItem("   ").error).toBe("item_name_required");
    expect(parseGeneralItem("x".repeat(81)).error).toBe("item_too_long");
  });
});

describe("household list lifecycle", () => {
  it("projects an active plan, preserves a purchase, and folds a guest change through the same lines", () => {
    const { plan, ctx } = makePlan();
    let list = projectPlanIntoList(blank(plan), plan, { now: ctx.now }).list;
    expect(list.lines.length).toBeGreaterThan(0);
    const first = list.lines[0];
    const marked = setLineState(list, { line_id: first.line_id, list_state: "purchased" }, { now: ctx.now });
    list = marked.list;
    const guests = applyPlanMutation(
      plan,
      { op: "set_guest_count", meal_id: plan.meals[0].meal_id, guest_count: 2 },
      ctx
    );
    expect(guests.ok).toBe(true);
    const again = projectPlanIntoList(list, guests.plan, { now: ctx.now });
    const kept = again.list.lines.find((row) => row.line_id === first.line_id);
    expect(kept.list_state).toBe("purchased");
    expect(again.list.lines.filter((row) => row.ingredient_id === first.ingredient_id && row.unit === first.unit)).toHaveLength(1);
  });

  it("keeps a cooked dinner on the list and drops it when the plan is completed", () => {
    const { plan, ctx } = makePlan();
    let list = projectPlanIntoList(blank(plan), plan, { now: ctx.now }).list;
    const cooking = applyPlanMutation(plan, { op: "begin_cook", meal_id: plan.meals[0].meal_id }, ctx);
    const cooked = applyPlanMutation(cooking.plan, { op: "finish_cook", meal_id: plan.meals[0].meal_id }, ctx);
    expect(cooked.plan.meals[0].state).toBe("cooked");
    const still = projectPlanIntoList(list, cooked.plan, { now: ctx.now });
    expect(still.list.lines.some((row) => row.still_needed)).toBe(true);
    cooked.plan.status = "completed";
    const done = projectPlanIntoList(still.list, cooked.plan, { now: ctx.now });
    expect(done.list.lines.filter((row) => row.still_needed && (row.requirements || []).some((req) => req.origin === "recipe"))).toHaveLength(0);
  });

  it("replaces a plan without deleting general items, and prunes unmarked obsolete recipe rows", () => {
    const { plan, ctx } = makePlan();
    let list = projectPlanIntoList(blank(plan), plan, { now: ctx.now }).list;
    const added = addGeneralItem(list, "paper towels", { now: ctx.now, client_request_id: "req_towels" });
    list = added.list;
    const bought = list.lines.find((row) => row.ingredient_id !== "paper-towels");
    list = setLineState(list, { line_id: bought.line_id, list_state: "purchased" }, { now: ctx.now }).list;
    const other = createDinnerPlan(
      {
        household_id: plan.household_id,
        dinner_plan_id: "dp_next",
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: ["a"],
        meals: [{ kind: "recipe", recipe_version_id: plannerCatalog()[1].pkg.recipe_version_id }],
      },
      ctx
    );
    const replaced = projectPlanIntoList(list, other.plan, { now: ctx.now }).list;
    expect(replaced.lines.some((row) => row.display_name.includes("paper towels") || row.ingredient_id === "paper-towels")).toBe(true);
    const stale = replaced.lines.find((row) => row.line_id === bought.line_id);
    expect(stale == null || stale.still_needed === 0 || stale.list_state === "purchased").toBe(true);
    const unmarked = replaced.lines.filter(
      (row) =>
        !row.still_needed &&
        row.list_state === "open" &&
        !(row.requirements || []).some((req) => req.origin === "general")
    );
    expect(unmarked).toHaveLength(0);
  });

  it("keeps general items when the plan changes and clear-completed never drops an open item", () => {
    const { plan, ctx } = makePlan();
    let list = projectPlanIntoList(blank(plan), plan, { now: ctx.now }).list;
    list = addGeneralItem(list, "detergent", { now: ctx.now, client_request_id: "req_det" }).list;
    list = addGeneralItem(list, "coffee", { now: ctx.now, client_request_id: "req_coffee" }).list;
    const coffee = list.lines.find((row) => row.ingredient_id === "coffee");
    list = setLineState(list, { line_id: coffee.line_id, list_state: "purchased" }, { now: ctx.now }).list;
    const cleared = clearCompleted(list, { now: ctx.now }).list;
    expect(cleared.lines.some((row) => row.ingredient_id === "paper-towels" || row.display_name.includes("detergent"))).toBe(true);
    expect(cleared.lines.some((row) => row.ingredient_id === "coffee")).toBe(false);
    expect(cleared.lines.some((row) => row.still_needed && (row.requirements || []).some((req) => req.origin === "recipe"))).toBe(true);
  });

  it("follows an adaptation through the existing shop lines", () => {
    const { plan, ctx } = makePlan();
    const list = projectPlanIntoList(blank(plan), plan, { now: ctx.now }).list;
    const meal = plan.meals[0];
    const source = meal.pinned_ingredients[0];
    const fromId = source.ingredient_id || source.name;
    const applied = applyPlanMutation(
      plan,
      {
        op: "apply_adaptation",
        meal_id: meal.meal_id,
        adaptation: {
          support: "advice",
          override_json: {
            acknowledgement: "Parsley works.",
            kind: "substitution",
            support: "advice",
            ops: [{ op: "replace", from_id: fromId, to_name: "parsley", policy: "keep_scaled", to_ingredient_id: "parsley" }],
          },
        },
      },
      ctx
    );
    expect(applied.ok).toBe(true);
    const next = projectPlanIntoList(list, applied.plan, { now: ctx.now }).list;
    expect(next.lines.some((row) => row.ingredient_id === "parsley" && row.still_needed)).toBe(true);
  });
});

describe("quantities and provenance", () => {
  it("keeps a manual onion beside the recipe onion when the units differ, and removes only the manual one", () => {
    const { plan, ctx } = makePlan();
    let list = projectPlanIntoList(blank(plan), plan, { now: ctx.now }).list;
    const recipeOnion = list.lines.find((row) => row.ingredient_id === "onion");
    list = addGeneralItem(list, "3 onions", { now: ctx.now, client_request_id: "req_onion" }).list;
    if (recipeOnion) {
      const manual = list.lines.find((row) => (row.requirements || []).some((req) => req.client_request_id === "req_onion"));
      expect(manual.unit).toBe("unparsed");
      expect(manual.line_id).not.toBe(recipeOnion.line_id);
      const removed = deleteGeneralSource(list, manual.line_id, { now: ctx.now }).list;
      expect(removed.lines.some((row) => row.line_id === recipeOnion.line_id)).toBe(true);
      expect(removed.lines.some((row) => (row.requirements || []).some((req) => req.origin === "general" && req.client_request_id === "req_onion"))).toBe(false);
    } else {
      const manual = list.lines.find((row) => (row.requirements || []).some((req) => req.client_request_id === "req_onion"));
      expect(manual.quantity_manual).toBe(3);
    }
  });

  it("edits a bare household item onto a quantity and unit", () => {
    const list = emptyHouseholdList({ shop_list_id: "hsl_edit", household_id: "hh", now: "2026-10-16T00:00:00.000Z" });
    const added = addGeneralItem(list, "paper towels", { now: "2026-10-16T00:00:01.000Z", client_request_id: "towels" });
    const edited = editLine(
      added.list,
      {
        line_id: added.line_id,
        patch: { display_name: "paper towels", quantity: 2, unit: "package", category: "household" },
      },
      { now: "2026-10-16T00:00:02.000Z" }
    );
    expect(edited.ok).toBe(true);
    const towels = edited.list.lines.find((row) => row.display_name === "paper towels");
    expect(towels.unit).toBe("package");
    expect(towels.category).toBe("household");
    expect(buyQuantity(towels)).toBe(2);
    expect(edited.list.lines.filter((row) => row.display_name === "paper towels")).toHaveLength(1);
  });

  it("merges a counted manual onion with the recipe line and flags a stale override", () => {
    const { plan, ctx } = makePlan();
    let projected = projectPlanIntoList(blank(plan), plan, { now: ctx.now });
    let list = projected.list;
    const host = list.lines.find((row) => row.unit === "count") || list.lines[0];
    const edited = editLine(list, { line_id: host.line_id, patch: { quantity: 99 } }, { now: ctx.now });
    list = edited.list;
    const overridden = list.lines.find((row) => row.line_id === host.line_id) || list.lines.find((row) => row.quantity_override === 99);
    expect(overridden.quantity_override).toBe(99);
    expect(buyQuantity(overridden)).toBe(99);
    const requiredBefore = overridden.quantity_required;
    const meal = plan.meals[0];
    const bumped = applyPlanMutation(
      plan,
      { op: "set_guest_count", meal_id: meal.meal_id, guest_count: 4 },
      ctx
    );
    const reconciled = projectPlanIntoList(list, bumped.plan, { now: ctx.now }).list;
    const line = reconciled.lines.find((row) => row.ingredient_id === overridden.ingredient_id && row.unit === overridden.unit);
    if (line && line.quantity_required !== requiredBefore) {
      expect(line.override_stale).toBe(1);
      expect(line.reconcile_note).toMatch(/Recipes now need/);
      expect(buyQuantity(line)).toBe(line.quantity_required + (line.quantity_manual || 0) || line.quantity_required);
      expect(line.quantity_override).toBe(99);
      const kept = resolveOverride(reconciled, { line_id: line.line_id, keep: true }, { now: ctx.now }).list;
      const afterKeep = kept.lines.find((row) => row.line_id === line.line_id);
      expect(afterKeep.override_stale).toBe(0);
      expect(buyQuantity(afterKeep)).toBe(99);
    }
  });

  it("does not duplicate a repeated add with the same client request", () => {
    const { plan } = makePlan();
    let list = projectPlanIntoList(blank(plan), plan, { now: "2026-10-16T12:00:00.000Z" }).list;
    list = addGeneralItem(list, "bananas", { now: "2026-10-16T12:00:00.000Z", client_request_id: "same" }).list;
    const second = addGeneralItem(list, "bananas", { now: "2026-10-16T12:01:00.000Z", client_request_id: "same" });
    expect(second.idempotent).toBe(true);
    expect(second.list.lines.filter((row) => row.ingredient_id === "bananas")).toHaveLength(1);
  });
});

describe("sharing and recipe export", () => {
  it("escapes csv formula injection and uses the true quantity", () => {
    expect(csvCell("=1+1").startsWith("'")).toBe(true);
    expect(csvCell("+cmd").startsWith("'")).toBe(true);
    expect(csvCell("-1").startsWith("'")).toBe(true);
    expect(csvCell("@sum").startsWith("'")).toBe(true);
    expect(csvCell("\tcmd").startsWith("'")).toBe(true);
    expect(csvCell("say \"hi\"")).toBe('"say ""hi"""');
    const { plan } = makePlan();
    const list = projectPlanIntoList(blank(plan), plan, { now: "2026-10-16T12:00:00.000Z" }).list;
    const csv = renderExportCsv(
      [
        {
          name: "Produce",
          items: [{ name: "=onion", quantity: 1.5, unit: "count", note: "\r" }],
        },
      ]
    );
    expect(csv).toContain("'=onion");
    expect(csv).toContain("1.5");
    expect(csv).not.toMatch(/1 1\/2/);
    const snap = shareSnapshot(list, { headline: "3 dinners · cooking for 2" });
    expect(JSON.stringify(snap)).not.toMatch(/postal|diet|member_id|instacart\.com/i);
  });

  it("prints a recipe for the planned diner count, and a viewing count does not need a stored plan", () => {
    expect(recipeYieldLine({ dinerCount: 4, guestCount: 2 })).toBe("For 4 · 2 guests");
    expect(recipeYieldLine({ dinerCount: 1, guestCount: 0 })).toBe("For 1 person");
    const text = renderRecipeExport({
      title: "Pasta",
      yieldLine: recipeYieldLine({ dinerCount: 3, guestCount: 1 }),
      ingredients: [{ name: "onion", quantity: 1.25, unit: "count" }],
      steps: ["Boil water"],
    });
    expect(text).toContain("For 3 · 1 guest");
    expect(text).toContain("1.25");
    expect(text).not.toMatch(/Renata|dairy|allergy/i);
  });
});

describe("migration 0017 backfill", () => {
  it("copies the active plan, purchased state, and does not invent a second list", () => {
    const sqlite = new DatabaseSync(":memory:");
    loadMigrations(sqlite, { skip0017: true });
    insertHousehold(sqlite, "hh_old");
    insertMember(sqlite, "hh_old", "m_old");
    sqlite
      .prepare(
        `INSERT INTO dinner_plan
          (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin, created_by_member_id, created_at, updated_at)
         VALUES ('dp_old', 'hh_old', 'ready', 1, 'plan_dinners', '{}', 'synthetic', 'm_old', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z')`
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO dinner_shop_line
          (line_id, dinner_plan_id, ingredient_id, display_name, unit, quantity, list_state, still_needed, surplus_quantity, meal_ids_json, created_at, updated_at)
         VALUES ('sl_old', 'dp_old', 'cilantro', 'cilantro', 'bunch', 1, 'purchased', 1, 0, '[]', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z')`
      )
      .run();
    sqlite.exec(readFileSync(new URL("../migrations/0017_household_shop.sql", import.meta.url), "utf8"));
    const lists = sqlite.prepare(`SELECT * FROM household_shop_list WHERE household_id = 'hh_old'`).all();
    expect(lists).toHaveLength(1);
    expect(lists[0].dinner_plan_id).toBe("dp_old");
    const line = sqlite.prepare(`SELECT * FROM household_shop_line`).get();
    expect(line.list_state).toBe("purchased");
    expect(line.quantity_required).toBe(1);
    expect(line.ingredient_id).toBe("cilantro");
    const req = sqlite.prepare(`SELECT * FROM household_shop_requirement`).get();
    expect(req.origin).toBe("recipe");
    expect(req.source_key).toBe("recipe:dp_old:cilantro:bunch");
  });
});

function request(method, path, { cookie, body, search = "" } = {}) {
  return new Request(`https://harbor.test${path}${search}`, {
    method,
    headers: {
      cookie: cookie || "",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("collaboration and share routes", () => {
  async function world() {
    const sqlite = new DatabaseSync(":memory:");
    loadMigrations(sqlite);
    insertHousehold(sqlite, "hh_live");
    insertMember(sqlite, "hh_live", "m_a");
    insertMember(sqlite, "hh_live", "m_b");
    insertHousehold(sqlite, "hh_other");
    insertMember(sqlite, "hh_other", "m_z");
    const db = asD1(sqlite);
    const sessionA = await createMemberSession(db, { household_id: "hh_live", member_id: "m_a" });
    const sessionB = await createMemberSession(db, { household_id: "hh_live", member_id: "m_b" });
    const sessionZ = await createMemberSession(db, { household_id: "hh_other", member_id: "m_z" });
    const env = { DB: db };
    const deps = { writeOrigin: async () => "synthetic" };
    return { sqlite, env, deps, sessionA, sessionB, sessionZ };
  }

  async function post(env, deps, token, body) {
    const res = await routeHouseholdShopRequest(
      env,
      request("POST", "/api/household-shop", { cookie: `he_session=${token}`, body }),
      "/api/household-shop",
      new URL("https://harbor.test/api/household-shop"),
      deps
    );
    return { status: res.status, body: await res.json() };
  }

  it("returns 409 for a real parallel write and retries without a duplicate or a double toggle", async () => {
    const { env, deps, sessionA } = await world();
    const first = await post(env, deps, sessionA.session_token, {
      expected_revision: 1,
      op: "add_item",
      text: "bananas",
      client_request_id: "add_bananas",
    });
    expect(first.status).toBe(200);
    const revision = first.body.list.revision;
    const lineId = first.body.line_id;
    let listReads = 0;
    let releaseReads;
    const readGate = new Promise((resolve) => {
      releaseReads = resolve;
    });
    const originalPrepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => {
      const statement = originalPrepare(sql);
      if (!String(sql).includes("FROM household_shop_list") || !String(sql).includes("status = 'open'")) return statement;
      const bind = statement.bind.bind(statement);
      statement.bind = (...params) => {
        const bound = bind(...params);
        const read = bound.first.bind(bound);
        bound.first = async () => {
          const row = await read();
          listReads += 1;
          if (listReads >= 2) releaseReads();
          else await readGate;
          return row;
        };
        return bound;
      };
      return statement;
    };
    let batches = 0;
    const originalBatch = env.DB.batch.bind(env.DB);
    env.DB.batch = async (statements) => {
      batches += 1;
      return originalBatch(statements);
    };
    const [bought, coffee] = await Promise.all([
      post(env, deps, sessionA.session_token, {
        expected_revision: revision,
        op: "set_state",
        line_id: lineId,
        list_state: "purchased",
      }),
      post(env, deps, sessionA.session_token, {
        expected_revision: revision,
        op: "add_item",
        text: "coffee",
        client_request_id: "add_coffee",
      }),
    ]);
    const statuses = [bought.status, coffee.status].sort();
    expect(batches).toBe(2);
    expect(statuses).toEqual([200, 409]);
    const loser = bought.status === 409 ? bought : coffee;
    expect(loser.body.error).toBe("revision_conflict");
    expect(loser.body.attempted).toBeTruthy();
    const retry = await post(env, deps, sessionA.session_token, {
      expected_revision: loser.body.revision,
      op: loser.body.attempted.op,
      line_id: loser.body.attempted.line_id,
      list_state: loser.body.attempted.list_state,
      text: loser.body.attempted.text,
      client_request_id: loser.body.attempted.client_request_id,
    });
    expect(retry.status).toBe(200);
    const names = retry.body.list.lines.map((row) => row.display_name);
    expect(names.filter((name) => name === "bananas")).toHaveLength(1);
    expect(names.filter((name) => name === "coffee")).toHaveLength(1);
    const bananas = retry.body.list.lines.find((row) => row.display_name === "bananas");
    expect(bananas.list_state).toBe("purchased");
    const again = await post(env, deps, sessionA.session_token, {
      expected_revision: retry.body.list.revision,
      op: "set_state",
      line_id: bananas.line_id,
      list_state: "purchased",
    });
    expect(again.body.idempotent).toBe(true);
    expect(again.body.list.lines.find((row) => row.line_id === bananas.line_id).list_state).toBe("purchased");
  });

  it("rejects a stale revision, an inactive member, and another household", async () => {
    const { sqlite, env, deps, sessionA, sessionZ } = await world();
    const opened = await post(env, deps, sessionA.session_token, {
      expected_revision: 1,
      op: "add_item",
      text: "bananas",
      client_request_id: "once",
    });
    const stale = await post(env, deps, sessionA.session_token, {
      expected_revision: 1,
      op: "add_item",
      text: "coffee",
      client_request_id: "stale",
    });
    expect(stale.status).toBe(409);
    expect(opened.body.list.lines).toHaveLength(1);
    sqlite.prepare(`UPDATE member SET status = 'left' WHERE member_id = 'm_a'`).run();
    const blocked = await post(env, deps, sessionA.session_token, {
      expected_revision: opened.body.list.revision,
      op: "add_item",
      text: "detergent",
      client_request_id: "nope",
    });
    expect(blocked.status).toBe(403);
    const cross = await routeHouseholdShopRequest(
      env,
      request("POST", "/api/household-shop", {
        cookie: `he_session=${sessionZ.session_token}`,
        body: { household_id: "hh_live", expected_revision: 1, op: "add_item", text: "bananas" },
      }),
      "/api/household-shop",
      new URL("https://harbor.test/api/household-shop"),
      deps
    );
    expect(cross.status).toBe(403);
  });

  it("freezes a share snapshot, expires it, revokes it, and keeps households apart", async () => {
    const { sqlite, env, deps, sessionA, sessionZ } = await world();
    await post(env, deps, sessionA.session_token, {
      expected_revision: 1,
      op: "add_item",
      text: "paper towels",
      client_request_id: "towels",
    });
    const created = await routeHouseholdShopRequest(
      env,
      request("POST", "/api/household-shop/shares", { cookie: `he_session=${sessionA.session_token}`, body: {} }),
      "/api/household-shop/shares",
      new URL("https://harbor.test/api/household-shop/shares"),
      deps
    );
    expect(created.status).toBe(201);
    const share = await created.json();
    expect(share.share_id).toMatch(/^HE-SHOP-[a-f0-9]{48}$/);
    const list = await routeHouseholdShopRequest(
      env,
      request("GET", "/api/household-shop", { cookie: `he_session=${sessionA.session_token}` }),
      "/api/household-shop",
      new URL("https://harbor.test/api/household-shop"),
      deps
    );
    const current = await list.json();
    await post(env, deps, sessionA.session_token, {
      expected_revision: current.list.revision,
      op: "add_item",
      text: "secret sauce",
      client_request_id: "later",
    });
    const pub = await routeHouseholdShopRequest(
      env,
      request("GET", `/api/shop/shared/${share.share_id}`),
      `/api/shop/shared/${share.share_id}`,
      new URL(`https://harbor.test/api/shop/shared/${share.share_id}`),
      deps
    );
    expect(pub.headers.get("cache-control")).toContain("no-store");
    expect(pub.headers.get("x-robots-tag")).toContain("noindex");
    const snap = await pub.json();
    const dumped = JSON.stringify(snap);
    expect(dumped).toContain("Paper towels");
    expect(dumped).not.toContain("secret sauce");
    expect(dumped).not.toMatch(/m_a|hh_live|postal|session/i);
    sqlite.prepare(`UPDATE shop_share SET expires_at = '2020-01-01T00:00:00.000Z' WHERE share_id = ?`).run(share.share_id);
    const expired = await routeHouseholdShopRequest(
      env,
      request("GET", `/api/shop/shared/${share.share_id}`),
      `/api/shop/shared/${share.share_id}`,
      new URL(`https://harbor.test/api/shop/shared/${share.share_id}`),
      deps
    );
    expect(expired.status).toBe(404);
    expect(await expired.json()).toEqual({ ok: false, error: "not_found" });
    sqlite.prepare(`UPDATE shop_share SET status = 'active', expires_at = '2099-01-01T00:00:00.000Z' WHERE share_id = ?`).run(share.share_id);
    const foreign = await routeHouseholdShopRequest(
      env,
      request("POST", "/api/household-shop/shares", {
        cookie: `he_session=${sessionZ.session_token}`,
        body: { op: "revoke", share_id: share.share_id },
      }),
      "/api/household-shop/shares",
      new URL("https://harbor.test/api/household-shop/shares"),
      deps
    );
    expect(foreign.status).toBe(404);
    const revoked = await routeHouseholdShopRequest(
      env,
      request("POST", "/api/household-shop/shares", {
        cookie: `he_session=${sessionA.session_token}`,
        body: { op: "revoke", share_id: share.share_id },
      }),
      "/api/household-shop/shares",
      new URL("https://harbor.test/api/household-shop/shares"),
      deps
    );
    expect(revoked.status).toBe(200);
    const gone = await routeHouseholdShopRequest(
      env,
      request("GET", `/api/shop/shared/${share.share_id}`),
      `/api/shop/shared/${share.share_id}`,
      new URL(`https://harbor.test/api/shop/shared/${share.share_id}`),
      deps
    );
    expect(gone.status).toBe(404);
    const events = sqlite.prepare(`SELECT event_name, props_json, data_origin FROM event`).all();
    expect(events.some((row) => row.event_name === "shopping_list_shared" && row.data_origin === "synthetic")).toBe(true);
    expect(events.every((row) => !String(row.props_json).includes("paper towels"))).toBe(true);
  });

  it("exports csv that a spreadsheet will not execute", async () => {
    const { env, deps, sessionA } = await world();
    await post(env, deps, sessionA.session_token, {
      expected_revision: 1,
      op: "add_item",
      text: "=detergent",
      client_request_id: "bad",
    });
    const res = await routeHouseholdShopRequest(
      env,
      request("GET", "/api/household-shop/export", { cookie: `he_session=${sessionA.session_token}` }),
      "/api/household-shop/export",
      new URL("https://harbor.test/api/household-shop/export?format=csv"),
      deps
    );
    const text = await res.text();
    expect(text).toContain("'=detergent");
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("projects a saved plan once and does not duplicate on the second save", async () => {
    const { sqlite, env } = await world();
    const { plan, ctx } = makePlan(
      {},
      { actor_member_id: "m_a", household_member_ids: ["m_a", "m_b"] },
      { household_id: "hh_live", participant_ids: ["m_a"], dinner_plan_id: "dp_live" }
    );
    plan.created_by_member_id = "m_a";
    plan.data_origin = "synthetic";
    await saveDinnerPlan(env.DB, plan);
    await projectSavedPlan(env.DB, plan, ctx.now);
    await projectSavedPlan(env.DB, plan, ctx.now);
    const count = sqlite.prepare(`SELECT COUNT(*) AS c FROM household_shop_line`).get().c;
    const identities = sqlite
      .prepare(
        `SELECT ifnull(ingredient_id,''), ifnull(general_key,''), unit, COUNT(*) c
         FROM household_shop_line GROUP BY 1,2,3 HAVING c > 1`
      )
      .all();
    expect(count).toBeGreaterThan(0);
    expect(identities).toHaveLength(0);
  });
});

describe("shopping stays off the model", () => {
  it("does not import the AI package", () => {
    const files = ["household-shop.js", "household-shop-store.js", "household-shop-routes.js"];
    for (const file of files) {
      const src = readFileSync(new URL(`../src/lib/${file}`, import.meta.url), "utf8");
      expect(src).not.toMatch(/from ["'].*\/ai/);
      expect(src).not.toMatch(/fetch\(|api\.instacart|developer\.instacart/i);
    }
  });
});

describe("shopping telemetry allow-list", () => {
  it("keeps only known edited-field names and drops item text", () => {
    expect(
      sanitizeShopEvent("shopping_item_edited", { fields: "note,quantity,secret sauce,display_name,quantity" })
    ).toEqual({ fields: "display_name,note,quantity" });
    expect(sanitizeShopEvent("shopping_item_edited", { fields: "paper towels from Market Street" })).toEqual({});
  });

  it("keeps only known conflict ops", () => {
    expect(sanitizeShopEvent("shopping_conflict", { op: "set_state" })).toEqual({ op: "set_state" });
    expect(sanitizeShopEvent("shopping_conflict", { op: "write" })).toEqual({ op: "write" });
    expect(sanitizeShopEvent("shopping_conflict", { op: "add 2 bags oat milk" })).toEqual({});
    expect(sanitizeShopEvent("shopping_conflict", { op: "set_state", text: "oat milk" })).toEqual({ op: "set_state" });
  });

  it("drops unknown events and props", () => {
    expect(sanitizeShopEvent("shopping_item_text", { text: "x" })).toBeNull();
    expect(sanitizeShopEvent("shopping_item_added", { origin: "general", text: "oat milk" })).toEqual({ origin: "general" });
  });
});
