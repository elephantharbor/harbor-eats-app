/**
 * S-06 meal completion. Explicit cooked, no rating, no fabricated cook progress,
 * undo that cannot erase a score, and a historical write that leaves shopping alone.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createMemberSession } from "../src/lib/session.js";
import { plannerCatalog } from "../src/lib/dinner-planner.js";
import { routeDinnerPlanRequest } from "../src/lib/dinner-plan-routes.js";
import {
  findCurrentDinnerPlanId,
  loadDinnerPlan,
  saveDinnerPlan,
} from "../src/lib/dinner-plan-store.js";
import { applyPlanMutation, createDinnerPlan } from "../src/lib/plan-mutations.js";
import { countsTowardCompletedMealLoop, dinnerHistoryIncludes } from "../src/lib/plan-contract.js";
import { summarizeShopExports } from "../src/lib/household-shop.js";
import { loadMealHistory } from "../src/lib/recommendations.js";

function sequencer() {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

function ctx() {
  return {
    now: "2026-10-18T12:00:00.000Z",
    actor_member_id: "ana",
    household_member_ids: ["ana", "bo"],
    constraints: [],
    data_origin: "household",
    tastes: [],
    id: sequencer(),
    versions: {},
  };
}

function recipePlan(extraMeals = []) {
  const version = plannerCatalog()[0].pkg;
  const made = createDinnerPlan(
    {
      household_id: "hh_s06",
      meal_count: 1 + extraMeals.length,
      entry_point: "plan_dinners",
      participant_ids: ["ana", "bo"],
      meals: [
        { kind: "recipe", recipe_version_id: version.recipe_version_id, participant_ids: ["ana", "bo"] },
        ...extraMeals,
      ],
    },
    { ...ctx(), versions: Object.fromEntries(plannerCatalog().map((row) => [row.pkg.recipe_version_id, row])) }
  );
  expect(made.ok).toBe(true);
  return made.plan;
}

function mutate(plan, action, now = "2026-10-18T13:00:00.000Z") {
  return applyPlanMutation(plan, action, { ...ctx(), now });
}

describe("mark_cooked and finish_cook share one write", () => {
  it("marks a planned meal cooked without a rating or a cook duration", () => {
    const plan = recipePlan();
    const meal = plan.meals[0];
    meal.adaptation = { note: "from memory" };
    meal.pinned_steps = [{ step_number: 1, title: "Boil", body: "Boil the pasta." }];
    const steps = JSON.stringify(meal.pinned_steps);
    const marked = mutate(plan, { op: "mark_cooked", meal_id: meal.meal_id, expected_state: "planned" });
    expect(marked.ok).toBe(true);
    expect(marked.completed).toBe(true);
    expect(marked.prior_state).toBe("planned");
    expect(marked.plan.meals[0].state).toBe("cooked");
    expect(marked.plan.meals[0].cooked_recipe_version_id).toBe(meal.recipe_version_id);
    expect(marked.plan.meals[0].ratings).toEqual([]);
    expect(marked.plan.meals[0].adaptation).toEqual({ note: "from memory" });
    expect(JSON.stringify(marked.plan.meals[0].pinned_steps)).toBe(steps);
    expect(marked.plan.meals[0]).not.toHaveProperty("cook_duration");
    expect(marked.plan.meals[0]).not.toHaveProperty("equipment_used");
    expect(countsTowardCompletedMealLoop(marked.plan, marked.plan.meals[0])).toBe(false);
  });

  it("marks selected and cooking, and still refuses finish_cook before cooking", () => {
    const plan = recipePlan();
    const mealId = plan.meals[0].meal_id;
    expect(mutate(plan, { op: "finish_cook", meal_id: mealId }).error).toBe("illegal_transition");
    const selected = mutate(plan, { op: "select_meal", meal_id: mealId });
    const fromSelected = mutate(selected.plan, { op: "mark_cooked", meal_id: mealId });
    expect(fromSelected.plan.meals[0].state).toBe("cooked");
    expect(fromSelected.prior_state).toBe("selected");

    const cooking = mutate(plan, { op: "begin_cook", meal_id: mealId });
    const guided = mutate(cooking.plan, { op: "finish_cook", meal_id: mealId, expected_state: "cooking" });
    expect(guided.completed).toBe(true);
    expect(guided.prior_state).toBe("cooking");
    expect(guided.plan.meals[0].state).toBe("cooked");
    const direct = mutate(cooking.plan, { op: "mark_cooked", meal_id: mealId });
    expect(direct.plan.meals[0].state).toBe("cooked");
    expect(direct.plan.meals[0].pinned_steps).toEqual(cooking.plan.meals[0].pinned_steps);
  });

  it("treats a second mark as unchanged and does not cook leftovers, eating out, skipped, or abandoned", () => {
    const plan = recipePlan([
      { kind: "leftovers", participant_ids: ["ana"] },
      { kind: "eating_out", participant_ids: ["ana"] },
    ]);
    const mealId = plan.meals[0].meal_id;
    const once = mutate(plan, { op: "mark_cooked", meal_id: mealId });
    const twice = mutate(once.plan, { op: "mark_cooked", meal_id: mealId }, "2026-10-18T14:00:00.000Z");
    expect(twice.unchanged).toBe(true);
    expect(twice.already_cooked).toBe(true);
    expect(twice.completed).toBe(false);
    expect(twice.plan.updated_at).toBe(once.plan.updated_at);
    expect(twice.plan.meals[0].ratings).toEqual([]);

    const rated = mutate(once.plan, { op: "rate_meal", meal_id: mealId, member_id: "ana", score: 9 });
    const third = mutate(rated.plan, { op: "mark_cooked", meal_id: mealId });
    expect(third.already_cooked).toBe(true);
    expect(third.plan.meals[0].state).toBe("partially_rated");
    expect(third.plan.meals[0].ratings).toHaveLength(1);

    expect(mutate(plan, { op: "mark_cooked", meal_id: plan.meals[1].meal_id }).error).toBe("illegal_transition");
    expect(mutate(plan, { op: "mark_cooked", meal_id: plan.meals[2].meal_id }).error).toBe("illegal_transition");
    const skipped = mutate(plan, { op: "skip_meal", meal_id: mealId });
    expect(mutate(skipped.plan, { op: "mark_cooked", meal_id: mealId }).error).toBe("illegal_transition");
    const abandoned = mutate(plan, { op: "abandon_meal", meal_id: mealId });
    expect(mutate(abandoned.plan, { op: "mark_cooked", meal_id: mealId }).error).toBe("illegal_transition");
  });

  it("refuses a stale expected state", () => {
    const plan = recipePlan();
    const mealId = plan.meals[0].meal_id;
    const conflict = mutate(plan, { op: "mark_cooked", meal_id: mealId, expected_state: "cooking" });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toBe("revision_conflict");
    expect(plan.meals[0].state).toBe("planned");
  });
});

describe("undo_cook", () => {
  it("restores the prior state and clears the cooked version", () => {
    const plan = recipePlan();
    const mealId = plan.meals[0].meal_id;
    const selected = mutate(plan, { op: "select_meal", meal_id: mealId });
    const cooked = mutate(selected.plan, { op: "mark_cooked", meal_id: mealId });
    expect(cooked.plan.meals[0].cooked_recipe_version_id).toBeTruthy();
    const undone = mutate(cooked.plan, { op: "undo_cook", meal_id: mealId, prior_state: "selected", expected_state: "cooked" });
    expect(undone.undone).toBe(true);
    expect(undone.plan.meals[0].state).toBe("selected");
    expect(undone.plan.meals[0].cooked_recipe_version_id).toBeNull();
    const again = mutate(undone.plan, { op: "undo_cook", meal_id: mealId, prior_state: "selected" });
    expect(again.unchanged).toBe(true);
    expect(again.undone).toBe(false);
    expect(again.plan.meals[0].state).toBe("selected");
  });

  it("keeps a rating and refuses to undo it", () => {
    const plan = recipePlan();
    const mealId = plan.meals[0].meal_id;
    const cooked = mutate(plan, { op: "mark_cooked", meal_id: mealId });
    const rated = mutate(cooked.plan, { op: "rate_meal", meal_id: mealId, member_id: "ana", score: 7 });
    const blocked = mutate(rated.plan, { op: "undo_cook", meal_id: mealId, prior_state: "planned" });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe("undo_blocked_rating");
    expect(rated.plan.meals[0].ratings).toHaveLength(1);
    expect(rated.plan.meals[0].state).toBe("partially_rated");
  });

  it("does not reverse a newer state when the expected state is stale", () => {
    const plan = recipePlan();
    const mealId = plan.meals[0].meal_id;
    const cooking = mutate(plan, { op: "begin_cook", meal_id: mealId });
    const conflict = mutate(cooking.plan, {
      op: "undo_cook",
      meal_id: mealId,
      prior_state: "planned",
      expected_state: "cooked",
    });
    expect(conflict.error).toBe("revision_conflict");
    expect(cooking.plan.meals[0].state).toBe("cooking");
  });
});

describe("image export counts", () => {
  it("counts an image download fallback as an image export", () => {
    const summary = summarizeShopExports([
      { props: { type: "image", stage: "succeeded", surface: "shop_sheet" } },
      { props: { type: "download", stage: "succeeded", surface: "shop_sheet" } },
      { props: { type: "download", stage: "succeeded", surface: "shop_menu" } },
      { props: { type: "image", stage: "cancelled", surface: "shop_sheet" } },
    ]);
    expect(summary.completed).toBe(3);
    expect(summary.image_exports).toBe(2);
    expect(summary.file_downloads).toBe(1);
    expect(summary.by_type.download).toBe(2);
  });
});

describe("history visibility", () => {
  it("keeps tonight's planned meals out and keeps a superseded cooking meal in", () => {
    expect(dinnerHistoryIncludes("planned", null)).toBe(false);
    expect(dinnerHistoryIncludes("selected", null)).toBe(false);
    expect(dinnerHistoryIncludes("planned", "2026-10-18T12:00:00.000Z")).toBe(true);
    expect(dinnerHistoryIncludes("cooking", null)).toBe(true);
    expect(dinnerHistoryIncludes("cooked", null)).toBe(true);
    expect(dinnerHistoryIncludes("skipped", "2026-10-18T12:00:00.000Z")).toBe(false);
  });
});

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

function seed(sqlite) {
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_s06', 'S06', 'active', 'America/Chicago', 2, 'organic', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z', 'synthetic')`
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('m_a', 'hh_s06', 'Alex', 'owner', 'active', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
    )
    .run();
}

describe("saved completion", () => {
  it("rolls back a stale cook write and accepts the matching timestamp", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite);
    seed(sqlite);
    const auth = await createMemberSession(db, { household_id: "hh_s06", member_id: "m_a" }, { secure: false });
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

    const created = await call("/api/dinner-plans", "POST", {
      meal_count: 1,
      entry_point: "plan_dinners",
      participant_ids: ["m_a"],
      meals: [{ kind: "recipe", recipe_version_id: version, participant_ids: ["m_a"] }],
    });
    expect(created.status).toBe(201);
    const plan = created.body.plan;
    const mealId = plan.meals[0].meal_id;
    const loaded = await loadDinnerPlan(db, plan.dinner_plan_id);
    loaded.meals[0].state = "cooked";
    loaded.meals[0].cooked_recipe_version_id = loaded.meals[0].recipe_version_id;
    loaded.updated_at = "2026-10-18T15:00:00.000Z";
    await expect(saveDinnerPlan(db, loaded, { expectedUpdatedAt: "1999-01-01T00:00:00.000Z" })).rejects.toMatchObject({
      code: "revision_conflict",
    });
    expect(sqlite.prepare(`SELECT state FROM dinner_plan_meal WHERE meal_id = ?`).get(mealId).state).toBe("planned");

    await saveDinnerPlan(db, loaded, { expectedUpdatedAt: plan.updated_at });
    expect(sqlite.prepare(`SELECT state, cooked_recipe_version_id FROM dinner_plan_meal WHERE meal_id = ?`).get(mealId).state).toBe("cooked");

    const stale = await call(`/api/dinner-plans/${plan.dinner_plan_id}/mutations`, "POST", {
      op: "mark_cooked",
      meal_id: mealId,
      expected_updated_at: plan.updated_at,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe("revision_conflict");

    const fresh = await loadDinnerPlan(db, plan.dinner_plan_id);
    const undo = await call(`/api/dinner-plans/${plan.dinner_plan_id}/mutations`, "POST", {
      op: "undo_cook",
      meal_id: mealId,
      prior_state: "planned",
      expected_state: "cooked",
      expected_updated_at: fresh.updated_at,
    });
    expect(undo.status).toBe(200);
    expect(undo.body.undone).toBe(true);
    expect(undo.body.plan.meals[0].state).toBe("planned");
    expect(undo.body.plan.meals[0].cooked_recipe_version_id).toBeNull();
  });

  it("completes a superseded cooking meal without moving the current plan or the shopping list", async () => {
    const sqlite = migrate();
    const db = asD1(sqlite);
    seed(sqlite);
    const auth = await createMemberSession(db, { household_id: "hh_s06", member_id: "m_a" }, { secure: false });
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
    const body = {
      meal_count: 1,
      entry_point: "plan_dinners",
      participant_ids: ["m_a"],
      meals: [{ kind: "recipe", recipe_version_id: version, participant_ids: ["m_a"] }],
    };
    const first = await call("/api/dinner-plans", "POST", body);
    expect(first.status).toBe(201);
    const oldId = first.body.plan.dinner_plan_id;
    const mealId = first.body.plan.meals[0].meal_id;
    const cooking = await call(`/api/dinner-plans/${oldId}/mutations`, "POST", { op: "begin_cook", meal_id: mealId });
    expect(cooking.status).toBe(200);
    const second = await call("/api/dinner-plans", "POST", body);
    expect(second.status).toBe(201);
    const currentId = second.body.plan.dinner_plan_id;
    expect(await findCurrentDinnerPlanId(db, "hh_s06")).toBe(currentId);
    const shopBefore = sqlite.prepare(`SELECT dinner_plan_id, revision FROM household_shop_list WHERE household_id = 'hh_s06'`).get();
    const linesBefore = sqlite.prepare(`SELECT display_name, quantity_required FROM household_shop_line ORDER BY display_name`).all();

    const marked = await call(`/api/dinner-plans/${oldId}/mutations`, "POST", {
      op: "mark_cooked",
      meal_id: mealId,
      expected_state: "cooking",
      expected_updated_at: cooking.body.plan.updated_at,
    });
    expect(marked.status).toBe(200);
    expect(marked.body.completed).toBe(true);
    expect(marked.body.plan.meals[0].state).toBe("cooked");
    expect(marked.body.plan.meals[0].ratings).toEqual([]);
    const again = await call(`/api/dinner-plans/${oldId}/mutations`, "POST", {
      op: "mark_cooked",
      meal_id: mealId,
      expected_updated_at: marked.body.plan.updated_at,
    });
    expect(again.status).toBe(200);
    expect(again.body.already_cooked).toBe(true);
    expect(again.body.unchanged).toBe(true);
    expect(sqlite.prepare(`SELECT COUNT(*) AS c FROM dinner_plan_rating`).get().c).toBe(0);

    const oldRow = sqlite.prepare(`SELECT superseded_at FROM dinner_plan WHERE dinner_plan_id = ?`).get(oldId);
    expect(oldRow.superseded_at).toBeTruthy();
    expect(await findCurrentDinnerPlanId(db, "hh_s06")).toBe(currentId);
    const shopAfter = sqlite.prepare(`SELECT dinner_plan_id, revision FROM household_shop_list WHERE household_id = 'hh_s06'`).get();
    const linesAfter = sqlite.prepare(`SELECT display_name, quantity_required FROM household_shop_line ORDER BY display_name`).all();
    expect(shopAfter).toEqual(shopBefore);
    expect(linesAfter).toEqual(linesBefore);

    const history = await loadMealHistory(db, "hh_s06");
    const recovered = history.find((row) => row.meal_id === mealId);
    expect(recovered.meal_state).toBe("cooked");
    expect(recovered.can_rate).toBe(true);
    expect(recovered.recoverable).toBe(false);
    const cookingOnly = history.find((row) => row.dinner_plan_id === currentId);
    expect(cookingOnly).toBeUndefined();
  });
});
