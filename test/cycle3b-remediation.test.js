import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { countsTowardCompletedMealLoop, dinnerCompletedLoopSql } from "../src/lib/plan-contract.js";
import { loadMealHistory } from "../src/lib/recommendations.js";
import { getCurrentVersionIdForSlug } from "../src/lib/recipe-store.js";

const TS = "2026-10-03T18:00:00.000Z";
const COOKED_AT = "2026-10-03T22:10:00.000Z";
const PIN = "rv_maple-mustard-glazed-salmon_v0";
const CATALOG = getCurrentVersionIdForSlug("maple-mustard-glazed-salmon");
const SALMON = "Maple Mustard Glazed Salmon";

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
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  return sqlite;
}

function tokenFrom(res) {
  const raw = res.headers.get("Set-Cookie") || "";
  const match = raw.match(/he_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function call(env, method, path, { token, body, synthetic } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (synthetic) headers["X-FlavorWeave-Data-Origin"] = "synthetic";
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
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed, token: tokenFrom(res) };
}

function insertHousehold(sqlite, id, { name, origin, source }) {
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES (?, ?, 'active', 'America/Chicago', 2, ?, ?, ?, ?)`
    )
    .run(id, name, source, TS, TS, origin);
}

function insertMember(sqlite, householdId, memberId, name, status = "active") {
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'member', ?, ?, ?)`
    )
    .run(memberId, householdId, name, status, TS, TS);
}

function insertPlan(sqlite, row) {
  sqlite
    .prepare(
      `INSERT INTO dinner_plan
        (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
         created_by_member_id, created_at, updated_at)
       VALUES (?, ?, 'active', 1, 'tonight', '{}', ?, ?, ?, ?)`
    )
    .run(row.planId, row.householdId, row.origin, row.createdBy, TS, row.updatedAt || COOKED_AT);
}

function insertRecipeMeal(sqlite, row) {
  sqlite
    .prepare(
      `INSERT INTO dinner_plan_meal
        (meal_id, dinner_plan_id, position, kind, state, recipe_slug, recipe_id, recipe_version_id,
         version_number, cooked_recipe_version_id, title, base_servings, allergens_json, vocabulary_json,
         tags_json, data_origin, created_at, updated_at)
       VALUES (?, ?, 1, 'recipe', ?, ?, ?, ?, 1, ?, ?, 4, '[]', '[]', '[]', ?, ?, ?)`
    )
    .run(
      row.mealId,
      row.planId,
      row.state,
      "maple-mustard-glazed-salmon",
      "maple-mustard-glazed-salmon",
      CATALOG,
      row.cookedPin || null,
      row.title || SALMON,
      row.origin,
      TS,
      row.updatedAt || COOKED_AT
    );
  for (const memberId of row.members || []) {
    sqlite
      .prepare(
        `INSERT INTO dinner_plan_participant (meal_id, member_id, household_id, active)
         VALUES (?, ?, ?, 1)`
      )
      .run(row.mealId, memberId, row.householdId);
  }
  for (const [memberId, score] of Object.entries(row.scores || {})) {
    sqlite
      .prepare(
        `INSERT INTO dinner_plan_rating
          (rating_id, meal_id, dinner_plan_id, household_id, member_id, recipe_version_id, score, data_origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        `rt_${row.mealId}_${memberId}`,
        row.mealId,
        row.planId,
        row.householdId,
        memberId,
        row.cookedPin || CATALOG,
        score,
        row.origin,
        TS,
        row.updatedAt || COOKED_AT
      );
  }
}

describe("Cycle 3B second member can sign in and see the current dinner plan", () => {
  it("adopts an existing diner from the invite code and serves that household's plan", async () => {
    const sqlite = migrate();
    const env = { DB: asD1(sqlite) };
    const hh = "hh_c3b_qa";

    const created = await call(env, "POST", "/api/households", {
      synthetic: true,
      body: { display_name: "QA Golden C3B Oct3", household_id: hh },
    });
    expect(created.status).toBe(201);

    const owner = await call(env, "POST", `/api/households/${hh}/members`, {
      synthetic: true,
      body: { display_name: "Alex", member_id: "owner-fcy9", role: "owner", status: "active" },
    });
    expect(owner.status).toBe(201);

    const ownerSession = await call(env, "POST", "/api/sessions", {
      body: { household_id: ` ${hh} `, member_id: " owner-fcy9 " },
    });
    expect(ownerSession.status).toBe(201);
    expect(ownerSession.body.member_id).toBe("owner-fcy9");
    expect(ownerSession.token).toBeTruthy();

    const jordan = await call(env, "POST", `/api/households/${hh}/members`, {
      token: ownerSession.token,
      synthetic: true,
      body: { display_name: "Jordan", member_id: "jordan-5x9", status: "active" },
    });
    expect(jordan.status).toBe(201);

    const casey = await call(env, "POST", `/api/households/${hh}/members`, {
      token: ownerSession.token,
      synthetic: true,
      body: { display_name: "Casey", member_id: "casey-2ab", status: "invited" },
    });
    expect(casey.status).toBe(201);

    const beforePublish = await call(env, "POST", "/api/invites/join", {
      body: { invite_code: "HE-INV-GEZDB2", display_name: "Jordan" },
    });
    expect(beforePublish.status).toBe(404);
    expect(beforePublish.body.error).toBe("invite_not_found");

    const published = await call(env, "POST", "/api/invites", {
      token: ownerSession.token,
      synthetic: true,
      body: { household_id: hh, channel: "copy", invite_code: "HE-INV-GEZDB2" },
    });
    expect(published.status).toBe(201);
    expect(published.body.invite_code).toBe("HE-INV-GEZDB2");
    expect(published.body.inviter_member_id).toBe("owner-fcy9");

    sqlite
      .prepare(
        `INSERT INTO dinner_plan
          (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
           created_by_member_id, created_at, updated_at)
         VALUES ('dp_c3b_current', ?, 'active', 1, 'tonight', '{}', 'synthetic', 'owner-fcy9', ?, ?)`
      )
      .run(hh, TS, TS);

    const joined = await call(env, "POST", "/api/invites/join", {
      body: { invite_code: "HE-INV-GEZDB2", display_name: " jordan " },
    });
    expect(joined.status).toBe(200);
    expect(joined.body.ok).toBe(true);
    expect(joined.body.already_member).toBe(true);
    expect(joined.body.member_id).toBe("jordan-5x9");
    expect(joined.body.household_id).toBe(hh);
    expect(joined.token).toBeTruthy();
    expect(sqlite.prepare("SELECT COUNT(*) AS c FROM member WHERE household_id = ? AND lower(display_name) = 'jordan'").get(hh).c).toBe(1);

    const jordanDirect = await call(env, "POST", "/api/sessions", {
      body: { household_id: hh, member_id: "jordan-5x9" },
    });
    expect(jordanDirect.status).toBe(201);
    expect(jordanDirect.body.member_id).toBe("jordan-5x9");

    const mine = await call(env, "GET", "/api/dinner-plans/current", { token: joined.token });
    const alex = await call(env, "GET", "/api/dinner-plans/current", { token: ownerSession.token });
    expect(mine.status).toBe(200);
    expect(mine.body.plan.dinner_plan_id).toBe("dp_c3b_current");
    expect(mine.body.plan.dinner_plan_id).toBe(alex.body.plan.dinner_plan_id);

    const caseyCode = await call(env, "POST", "/api/invites", {
      token: ownerSession.token,
      body: { channel: "copy", invite_code: "HE-INV-CASEY1" },
    });
    expect(caseyCode.status).toBe(201);
    const caseyBlocked = await call(env, "POST", "/api/sessions", {
      body: { household_id: hh, member_id: "casey-2ab" },
    });
    expect(caseyBlocked.status).toBe(404);
    expect(caseyBlocked.body.error).toBe("member_not_found");
    const caseyJoin = await call(env, "POST", "/api/invites/join", {
      body: { invite_code: "HE-INV-CASEY1", display_name: "Casey" },
    });
    expect(caseyJoin.status).toBe(200);
    expect(caseyJoin.body.member_id).toBe("casey-2ab");
    expect(caseyJoin.body.already_member).toBe(false);
    expect(sqlite.prepare("SELECT status FROM member WHERE member_id = 'casey-2ab'").get().status).toBe("active");

    const sam = await call(env, "POST", "/api/invites/join", {
      body: { invite_code: "HE-INV-GEZDB2", display_name: "Sam" },
    });
    expect(sam.status).toBe(200);
    expect(sam.body.member_id).not.toBe("jordan-5x9");
    expect(sam.body.already_member).toBe(false);

    const otherHh = await call(env, "POST", "/api/households", {
      body: { display_name: "Other kitchen", household_id: "hh_c3b_other" },
    });
    expect(otherHh.status).toBe(201);
    const otherMember = await call(env, "POST", "/api/households/hh_c3b_other/members", {
      body: { display_name: "Quinn", member_id: "quinn-9zz", role: "owner" },
    });
    expect(otherMember.status).toBe(201);
    const otherSession = await call(env, "POST", "/api/sessions", {
      body: { household_id: "hh_c3b_other", member_id: "quinn-9zz" },
    });
    expect(otherSession.status).toBe(201);

    const crossed = await call(env, "GET", `/api/dinner-plans/current?household_id=${hh}`, {
      token: otherSession.token,
    });
    expect(crossed.status).toBe(403);
    expect(crossed.body.error).toBe("forbidden_cross_household");

    const guessed = await call(env, "GET", "/api/dinner-plans/dp_guessed", { token: joined.token });
    expect(guessed.status).toBe(404);
    expect(guessed.body.error).toBe("plan_not_found");

    const foreignPlan = await call(env, "GET", "/api/dinner-plans/dp_c3b_current", {
      token: otherSession.token,
    });
    expect(foreignPlan.status).toBe(403);
    expect(foreignPlan.body.error).toBe("forbidden_cross_household");

    const mismatched = await call(env, "POST", "/api/sessions", {
      body: { household_id: "hh_c3b_other", member_id: "jordan-5x9" },
    });
    expect(mismatched.status).toBe(404);
    expect(mismatched.body.error).toBe("member_not_found");

    const emptyCurrent = await call(env, "GET", "/api/dinner-plans/current", { token: otherSession.token });
    expect(emptyCurrent.status).toBe(200);
    expect(emptyCurrent.body).toEqual({ ok: true, plan: null });

    const foreignHistory = await call(env, "GET", `/api/households/${hh}/meals/history`, {
      token: otherSession.token,
    });
    expect(foreignHistory.status).toBe(403);
  });
});

describe("Cycle 3B history lists cooked and fully rated dinner-plan meals", () => {
  it("shows the pinned recipe for the household and keeps synthetic rows out of the completed loop", async () => {
    expect(CATALOG).toBe("rv_maple-mustard-glazed-salmon_v1");
    expect(PIN).not.toBe(CATALOG);

    const sqlite = migrate();
    const env = { DB: asD1(sqlite) };
    insertHousehold(sqlite, "hh_c3b_synth", {
      name: "QA Golden C3B Oct3",
      origin: "synthetic",
      source: "synthetic_qa",
    });
    insertMember(sqlite, "hh_c3b_synth", "owner-fcy9", "Alex");
    insertMember(sqlite, "hh_c3b_synth", "jordan-5x9", "Jordan");
    insertPlan(sqlite, {
      planId: "dp_c3b_salmon",
      householdId: "hh_c3b_synth",
      origin: "synthetic",
      createdBy: "owner-fcy9",
    });
    insertRecipeMeal(sqlite, {
      planId: "dp_c3b_salmon",
      mealId: "ml_salmon_done",
      householdId: "hh_c3b_synth",
      origin: "synthetic",
      state: "fully_rated",
      cookedPin: PIN,
      members: ["owner-fcy9", "jordan-5x9"],
      scores: { "owner-fcy9": 8, "jordan-5x9": 7 },
    });
    insertPlan(sqlite, {
      planId: "dp_c3b_partial",
      householdId: "hh_c3b_synth",
      origin: "synthetic",
      createdBy: "owner-fcy9",
      updatedAt: "2026-10-03T21:00:00.000Z",
    });
    insertRecipeMeal(sqlite, {
      planId: "dp_c3b_partial",
      mealId: "ml_salmon_partial",
      householdId: "hh_c3b_synth",
      origin: "synthetic",
      state: "partially_rated",
      title: "Still waiting on a score",
      cookedPin: PIN,
      updatedAt: "2026-10-03T21:00:00.000Z",
      members: ["owner-fcy9"],
      scores: { "owner-fcy9": 8 },
    });
    insertPlan(sqlite, {
      planId: "dp_c3b_cooked",
      householdId: "hh_c3b_synth",
      origin: "synthetic",
      createdBy: "owner-fcy9",
      updatedAt: "2026-10-03T20:00:00.000Z",
    });
    insertRecipeMeal(sqlite, {
      planId: "dp_c3b_cooked",
      mealId: "ml_salmon_cooked",
      householdId: "hh_c3b_synth",
      origin: "synthetic",
      state: "cooked",
      title: "Cooked only",
      updatedAt: "2026-10-03T20:00:00.000Z",
      members: ["owner-fcy9", "jordan-5x9"],
    });

    const synthHistory = await loadMealHistory(env.DB, "hh_c3b_synth");
    expect(synthHistory.map((meal) => meal.meal_name)).toEqual([SALMON]);
    expect(synthHistory[0]).toMatchObject({
      plan_id: "dp_c3b_salmon",
      dinner_plan_id: "dp_c3b_salmon",
      meal_option_id: "ml_salmon_done",
      status: "Rated",
      recipe_slug: "maple-mustard-glazed-salmon",
      recipe_version_id: PIN,
      source: "dinner_plan",
      rating_state: "full",
      avg_score: 7.5,
      favorite: false,
    });

    expect(sqlite.prepare(dinnerCompletedLoopSql()).get().c).toBe(0);
    expect(
      countsTowardCompletedMealLoop(
        { data_origin: "synthetic" },
        {
          kind: "recipe",
          state: "fully_rated",
          participant_ids: ["owner-fcy9", "jordan-5x9"],
          ratings: [
            { member_id: "owner-fcy9", data_origin: "synthetic", score: 8 },
            { member_id: "jordan-5x9", data_origin: "synthetic", score: 7 },
          ],
        },
        { data_origin: "synthetic", acquisition_source: "synthetic_qa" }
      )
    ).toBe(false);

    insertHousehold(sqlite, "hh_c3b_real", {
      name: "Weeknight kitchen",
      origin: "household",
      source: "organic",
    });
    insertMember(sqlite, "hh_c3b_real", "owner-real", "Alex");
    insertMember(sqlite, "hh_c3b_real", "jordan-real", "Jordan");
    insertPlan(sqlite, {
      planId: "dp_c3b_hidden",
      householdId: "hh_c3b_real",
      origin: "synthetic",
      createdBy: "owner-real",
      updatedAt: "2026-10-03T23:00:00.000Z",
    });
    insertRecipeMeal(sqlite, {
      planId: "dp_c3b_hidden",
      mealId: "ml_hidden",
      householdId: "hh_c3b_real",
      origin: "synthetic",
      state: "fully_rated",
      title: "Synthetic leak",
      cookedPin: PIN,
      updatedAt: "2026-10-03T23:00:00.000Z",
      members: ["owner-real", "jordan-real"],
      scores: { "owner-real": 9, "jordan-real": 9 },
    });
    insertPlan(sqlite, {
      planId: "dp_c3b_real",
      householdId: "hh_c3b_real",
      origin: "household",
      createdBy: "owner-real",
      updatedAt: "2026-10-03T19:00:00.000Z",
    });
    insertRecipeMeal(sqlite, {
      planId: "dp_c3b_real",
      mealId: "ml_real_done",
      householdId: "hh_c3b_real",
      origin: "household",
      state: "fully_rated",
      cookedPin: PIN,
      updatedAt: "2026-10-03T19:00:00.000Z",
      members: ["owner-real", "jordan-real"],
      scores: { "owner-real": 9, "jordan-real": 8 },
    });

    const realHistory = await loadMealHistory(env.DB, "hh_c3b_real");
    expect(realHistory.map((meal) => meal.meal_name)).toEqual([SALMON]);
    expect(realHistory[0].recipe_version_id).toBe(PIN);
    expect(realHistory[0].plan_id).toBe("dp_c3b_real");
    expect(realHistory[0].avg_score).toBe(8.5);

    const otherHistory = await loadMealHistory(env.DB, "hh_c3b_synth");
    expect(otherHistory.map((meal) => meal.plan_id)).toEqual(["dp_c3b_salmon"]);

    expect(sqlite.prepare(dinnerCompletedLoopSql()).get().c).toBe(1);
    expect(
      countsTowardCompletedMealLoop(
        { data_origin: "household" },
        {
          kind: "recipe",
          state: "fully_rated",
          participant_ids: ["owner-real", "jordan-real"],
          ratings: [
            { member_id: "owner-real", data_origin: "household", score: 9 },
            { member_id: "jordan-real", data_origin: "household", score: 8 },
          ],
        },
        { data_origin: "household", acquisition_source: "organic" }
      )
    ).toBe(true);
  });
});

describe("Cycle 3B client invite publish and list-change toast", () => {
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

  it("persists the invite code when the invite screen opens, without a client inviter id", () => {
    const inviteView = app.slice(app.indexOf('if (name === "invite")'), app.indexOf('if (name === "join")'));
    expect(inviteView).toContain("publishInviteCode()");
    const publish = app.slice(app.indexOf("async function publishInviteCode"), app.indexOf("async function copyText"));
    expect(publish).toContain('apiPost("/api/invites"');
    expect(publish).not.toContain("inviter_member_id");
    expect(publish).toContain("invite_code: state.inviteCode");
  });

  it("toasts a list change only after the shop lines actually differ", () => {
    const mutate = app.slice(
      app.indexOf("async function mutateDinnerPlan"),
      app.indexOf("function dinnerPlanErrorToast")
    );
    const gate = mutate.indexOf("if (listChanged)");
    expect(gate).toBeGreaterThan(-1);
    expect(mutate.indexOf('toast("List updated.")')).toBeGreaterThan(gate);
    expect(mutate.indexOf("toastListChangeCounts(")).toBeGreaterThan(gate);
    expect(mutate.slice(0, gate)).not.toMatch(/toast\(/);
    expect(mutate.slice(0, gate)).not.toContain("toastListChangeCounts");
  });
});
