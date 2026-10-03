import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { buildTasteProfile } from "../src/lib/taste-model.js";
import { deriveHouseholdState } from "../src/lib/household-state.js";
import {
  SYNTHETIC_ACQUISITION_SOURCES,
  TRACTION_EVENT_NAMES,
  alphaOpsQueries,
  completedMealLoopSql,
  funnelEventCountSql,
  learningRows,
  reviewedHouseholdStampSql,
} from "../src/lib/evidence-origin.js";
import { historyFromActivity } from "../src/lib/meal-identity.js";

const MIGRATION_FILES = readdirSync(new URL("../migrations/", import.meta.url))
  .filter((name) => name.endsWith(".sql"))
  .sort();

function sqlFile(name) {
  return readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
}

function applyThrough(db, lastInclusive) {
  for (const name of MIGRATION_FILES) {
    db.exec(sqlFile(name));
    if (name.startsWith(lastInclusive)) break;
  }
}

function applyNamed(db, name) {
  db.exec(sqlFile(name));
}

function seedLegacyKitchen(db, { id, acquisition, created, score }) {
  db.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at)
     VALUES (?, ?, 'active', 'America/Chicago', 2, ?, ?, ?)`
  ).run(id, id, acquisition, created, created);
  db.prepare(
    `INSERT INTO member
      (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES (?, ?, 'Ana', 'owner', 'active', ?, ?)`
  ).run(`${id}-m`, id, created, created);
  db.prepare(
    `INSERT INTO plan (plan_id, household_id, status, created_at, updated_at)
     VALUES (?, ?, 'Rated', ?, ?)`
  ).run(`${id}-p`, id, created, created);
  db.prepare(
    `INSERT INTO meal_option
      (meal_option_id, plan_id, letter, name, recipe_slug, created_at)
     VALUES (?, ?, 'A', 'Miso salmon', 'miso-ginger-salmon', ?)`
  ).run(`${id}-mo`, `${id}-p`, created);
  db.prepare(
    `INSERT INTO selection
      (selection_id, plan_id, meal_option_id, household_id, source, actor_member_id, created_at)
     VALUES (?, ?, ?, ?, 'app', ?, ?)`
  ).run(`${id}-sel`, `${id}-p`, `${id}-mo`, id, `${id}-m`, created);
  db.prepare(
    `INSERT INTO cook
      (cook_id, plan_id, meal_option_id, household_id, source, actor_member_id, cooked_at, created_at)
     VALUES (?, ?, ?, ?, 'app', ?, ?, ?)`
  ).run(`${id}-cook`, `${id}-p`, `${id}-mo`, id, `${id}-m`, created, created);
  db.prepare(
    `INSERT INTO rating
      (rating_id, plan_id, meal_option_id, household_id, member_id, score, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'app', ?, ?)`
  ).run(`${id}-rate`, `${id}-p`, `${id}-mo`, id, `${id}-m`, score, created, created);
  db.prepare(
    `INSERT INTO preference_evidence
      (evidence_id, household_id, member_id, source, kind, tag, weight, created_at)
     VALUES (?, ?, ?, 'onboarding_spark', 'like', 'fish', 1, ?)`
  ).run(`${id}-pe`, id, `${id}-m`, created);
  for (const eventName of ["plan_generated", "loop_completed"]) {
    db.prepare(
      `INSERT INTO event (event_id, event_name, household_id, member_id, plan_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(`${id}-${eventName}`, eventName, id, `${id}-m`, `${id}-p`, created);
  }
  db.prepare(
    `INSERT INTO meal_vote
      (vote_id, plan_id, meal_option_id, household_id, member_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(`${id}-vote`, `${id}-p`, `${id}-mo`, id, `${id}-m`, created);
}

function originOf(db, table, idColumn, id) {
  return db.prepare(`SELECT data_origin FROM ${table} WHERE ${idColumn} = ?`).get(id).data_origin;
}

function countSql(db, sql, ...params) {
  const row = db.prepare(sql).get(...params);
  return row ? row.c : 0;
}

describe("0009 unproven legacy origin", () => {
  const sql = sqlFile("0009_evidence_origin_unproven.sql");

  it("does not declare a household default", () => {
    const executable = sql.replace(/--[^\n]*/g, "");
    expect(executable).not.toMatch(/DEFAULT\s+'household'/i);
    expect(sql).toMatch(/DEFAULT 'unproven'/);
    for (const source of SYNTHETIC_ACQUISITION_SOURCES) {
      expect(sql).toContain(`'${source}'`);
    }
    expect(executable.toLowerCase()).not.toContain("pragma foreign_keys");
  });

  it("does not turn legacy rows into household, and keeps the three origin classes apart", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    applyThrough(db, "0007");

    seedLegacyKitchen(db, {
      id: "hh_oct",
      acquisition: null,
      created: "2026-10-01T12:00:00Z",
      score: 9,
    });
    seedLegacyKitchen(db, {
      id: "hh_real",
      acquisition: "organic",
      created: "2026-09-15T12:00:00Z",
      score: 8,
    });
    seedLegacyKitchen(db, {
      id: "hh_qa",
      acquisition: "synthetic_qa",
      created: "2026-10-01T18:00:00Z",
      score: 10,
    });
    db.prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, inviter_member_id, created_at, updated_at)
       VALUES ('hh_real-guest', 'hh_real', 'Sam', 'member', 'active', 'hh_real-m', '2026-09-16T00:00:00Z', '2026-09-16T00:00:00Z')`
    ).run();
    db.prepare(
      `INSERT INTO member_session
        (session_id, session_token, household_id, member_id, created_at, expires_at, last_seen_at)
       VALUES ('sess-real', 'token-real', 'hh_real', 'hh_real-m', '2026-09-16T00:00:00Z', '2026-12-16T00:00:00Z', '2026-09-16T00:00:00Z')`
    ).run();
    db.prepare(
      `INSERT INTO client_error (error_id, surface, message, created_at)
       VALUES ('cerr-1', 'client', 'kept', '2026-10-01T00:00:00Z')`
    ).run();

    applyNamed(db, "0008_evidence_origin.sql");
    expect(originOf(db, "rating", "rating_id", "hh_oct-rate")).toBe("household");
    expect(originOf(db, "household", "household_id", "hh_real")).toBe("household");
    expect(originOf(db, "household", "household_id", "hh_qa")).toBe("household");

    db.prepare(
      `INSERT INTO meal_option
        (meal_option_id, plan_id, letter, name, created_at)
       VALUES ('hh_oct-mo-b', 'hh_oct-p', 'B', 'Explicit synthetic', '2026-10-02T00:00:00Z')`
    ).run();
    db.prepare(
      `INSERT INTO rating
        (rating_id, plan_id, meal_option_id, household_id, member_id, score, source, created_at, updated_at, data_origin)
       VALUES ('hh_oct-rate-syn', 'hh_oct-p', 'hh_oct-mo-b', 'hh_oct', 'hh_oct-m', 4, 'app', '2026-10-02T00:00:00Z', '2026-10-02T00:00:00Z', 'synthetic')`
    ).run();
    db.prepare(
      `INSERT INTO plan
        (plan_id, household_id, status, created_at, updated_at, data_origin)
       VALUES ('hh_oct-explicit', 'hh_oct', 'Rated', '2026-10-02T00:00:00Z', '2026-10-02T00:00:00Z', 'household')`
    ).run();

    applyNamed(db, "0009_evidence_origin_unproven.sql");

    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS c FROM client_error").get().c).toBe(1);
    expect(db.prepare("SELECT inviter_member_id FROM member WHERE member_id = 'hh_real-guest'").get().inviter_member_id).toBe("hh_real-m");
    expect(db.prepare("SELECT session_token FROM member_session WHERE session_id = 'sess-real'").get().session_token).toBe("token-real");

    for (const table of ["plan", "selection", "cook", "rating", "preference_evidence", "event", "meal_vote"]) {
      const leaked = db.prepare(
        `SELECT COUNT(*) AS c FROM ${table} WHERE household_id IN ('hh_oct', 'hh_real', 'hh_qa') AND data_origin = 'household'`
      ).get().c;
      expect(leaked).toBe(0);
    }
    expect(originOf(db, "household", "household_id", "hh_oct")).toBe("unproven");
    expect(originOf(db, "household", "household_id", "hh_real")).toBe("unproven");
    expect(originOf(db, "rating", "rating_id", "hh_oct-rate")).toBe("unproven");
    expect(originOf(db, "rating", "rating_id", "hh_real-rate")).toBe("unproven");
    expect(originOf(db, "event", "event_id", "hh_oct-plan_generated")).toBe("unproven");
    expect(originOf(db, "plan", "plan_id", "hh_oct-explicit")).toBe("unproven");

    expect(originOf(db, "household", "household_id", "hh_qa")).toBe("synthetic");
    expect(originOf(db, "plan", "plan_id", "hh_qa-p")).toBe("synthetic");
    expect(originOf(db, "rating", "rating_id", "hh_qa-rate")).toBe("synthetic");
    expect(originOf(db, "event", "event_id", "hh_qa-loop_completed")).toBe("synthetic");
    expect(originOf(db, "rating", "rating_id", "hh_oct-rate-syn")).toBe("synthetic");
    expect(db.prepare("SELECT COUNT(*) AS c FROM household WHERE household_id = 'hh_oct' AND data_origin = 'synthetic'").get().c).toBe(0);

    const ratingDefault = db.prepare("PRAGMA table_info(rating)").all().find((col) => col.name === "data_origin");
    expect(ratingDefault.dflt_value).toBe("'unproven'");
    db.prepare(
      `INSERT INTO event (event_id, event_name, household_id, created_at)
       VALUES ('omitted', 'plan_generated', 'hh_oct', '2026-10-03T00:00:00Z')`
    ).run();
    expect(originOf(db, "event", "event_id", "omitted")).toBe("unproven");

    db.prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_live', 'Live kitchen', 'active', 'America/Chicago', 2, 'organic', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z', 'household')`
    ).run();
    db.prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('hh_live-m', 'hh_live', 'Ana', 'owner', 'active', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z')`
    ).run();
    db.prepare(
      `INSERT INTO plan (plan_id, household_id, status, created_at, updated_at, data_origin)
       VALUES ('hh_live-p', 'hh_live', 'Rated', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z', 'household')`
    ).run();
    db.prepare(
      `INSERT INTO meal_option (meal_option_id, plan_id, letter, name, recipe_slug, created_at)
       VALUES ('hh_live-mo', 'hh_live-p', 'A', 'Miso salmon', 'miso-ginger-salmon', '2026-10-03T00:00:00Z')`
    ).run();
    db.prepare(
      `INSERT INTO cook
        (cook_id, plan_id, meal_option_id, household_id, source, actor_member_id, cooked_at, created_at, data_origin)
       VALUES ('hh_live-cook', 'hh_live-p', 'hh_live-mo', 'hh_live', 'app', 'hh_live-m', '2026-10-03T01:00:00Z', '2026-10-03T01:00:00Z', 'household')`
    ).run();
    db.prepare(
      `INSERT INTO rating
        (rating_id, plan_id, meal_option_id, household_id, member_id, score, source, created_at, updated_at, data_origin)
       VALUES ('hh_live-rate', 'hh_live-p', 'hh_live-mo', 'hh_live', 'hh_live-m', 8, 'app', '2026-10-03T02:00:00Z', '2026-10-03T02:00:00Z', 'household')`
    ).run();
    for (const eventName of TRACTION_EVENT_NAMES) {
      db.prepare(
        `INSERT INTO event (event_id, event_name, household_id, plan_id, created_at, data_origin)
         VALUES (?, ?, 'hh_live', 'hh_live-p', '2026-10-03T02:00:00Z', 'household')`
      ).run(`hh_live-${eventName}`, eventName);
    }

    const liveHousehold = { household_id: "hh_live", data_origin: "household", acquisition_source: "organic" };
    const octHousehold = { household_id: "hh_oct", data_origin: "unproven", acquisition_source: null };
    const qaHousehold = { household_id: "hh_qa", data_origin: "synthetic", acquisition_source: "synthetic_qa" };

    const liveRatings = db.prepare(
      `SELECT score, member_id, data_origin FROM rating WHERE household_id = 'hh_live'`
    ).all().map((row) => ({ ...row, recipe_slug: "miso-ginger-salmon", tags: ["fish"] }));
    const octRatings = db.prepare(
      `SELECT score, member_id, data_origin FROM rating WHERE household_id = 'hh_oct'`
    ).all();
    const qaRatings = db.prepare(
      `SELECT score, member_id, data_origin FROM rating WHERE household_id = 'hh_qa'`
    ).all();

    expect(learningRows(octRatings, octHousehold).map((row) => row.score)).toEqual([]);
    expect(learningRows(qaRatings, qaHousehold)).toEqual([]);
    const liveLearning = learningRows(liveRatings, liveHousehold);
    expect(liveLearning.map((row) => row.score)).toEqual([8]);
    expect(buildTasteProfile([], liveLearning).meals_rated).toBe(1);
    expect(buildTasteProfile([], learningRows(octRatings, octHousehold)).meals_rated).toBe(0);

    const octHistory = historyFromActivity({
      household: octHousehold,
      plans: db.prepare(`SELECT plan_id, status, data_origin FROM plan WHERE household_id = 'hh_oct'`).all(),
      options: db.prepare(
        `SELECT mo.plan_id, mo.meal_option_id, mo.name, mo.recipe_slug
         FROM meal_option mo JOIN plan p ON p.plan_id = mo.plan_id WHERE p.household_id = 'hh_oct'`
      ).all(),
      selections: db.prepare(`SELECT plan_id, meal_option_id, created_at, data_origin FROM selection WHERE household_id = 'hh_oct'`).all(),
      cooks: db.prepare(`SELECT plan_id, meal_option_id, cooked_at, data_origin FROM cook WHERE household_id = 'hh_oct'`).all(),
      ratings: db.prepare(`SELECT plan_id, meal_option_id, member_id, score, data_origin FROM rating WHERE household_id = 'hh_oct'`).all(),
    });
    expect(octHistory).toEqual([]);

    const livePlans = db.prepare(
      `SELECT plan_id, status, data_origin, 1 AS active_member_count FROM plan WHERE household_id = 'hh_live'`
    ).all();
    const liveHistory = historyFromActivity({
      household: liveHousehold,
      plans: livePlans,
      options: db.prepare(`SELECT plan_id, meal_option_id, name, recipe_slug FROM meal_option WHERE plan_id = 'hh_live-p'`).all(),
      selections: [],
      cooks: db.prepare(`SELECT plan_id, meal_option_id, cooked_at, data_origin FROM cook WHERE household_id = 'hh_live'`).all(),
      ratings: db.prepare(`SELECT plan_id, meal_option_id, member_id, score, data_origin FROM rating WHERE household_id = 'hh_live'`).all(),
    });
    expect(liveHistory.map((row) => row.plan_id)).toEqual(["hh_live-p"]);
    const liveState = deriveHouseholdState({
      plan: { plan_id: "hh_live-p", status: "Rated" },
      selection: { meal_option_id: liveHistory[0].meal_option_id },
      cook: { cooked_at: liveHistory[0].cooked_at },
      ratings: liveHistory[0].ratings,
      active_member_count: 1,
      onboarded: true,
    });
    expect(liveState.cml_complete).toBe(true);

    expect(countSql(db, completedMealLoopSql(), "hh_oct")).toBe(0);
    expect(countSql(db, completedMealLoopSql(), "hh_qa")).toBe(0);
    expect(countSql(db, completedMealLoopSql(), "hh_real")).toBe(0);
    expect(countSql(db, completedMealLoopSql(), "hh_live")).toBe(1);

    for (const name of TRACTION_EVENT_NAMES) {
      expect(countSql(db, funnelEventCountSql(), "hh_oct", name)).toBe(0);
      expect(countSql(db, funnelEventCountSql(), "hh_qa", name)).toBe(0);
      expect(countSql(db, funnelEventCountSql(), "hh_live", name)).toBe(1);
    }

    const alpha = alphaOpsQueries();
    expect(countSql(db, alpha.households)).toBe(1);
    expect(countSql(db, alpha.ratings)).toBe(1);
    expect(countSql(db, alpha.plans)).toBe(1);
    expect(countSql(db, alpha.cooks)).toBe(1);
    expect(countSql(db, alpha.completed_meal_loops)).toBe(1);
    expect(countSql(db, alpha.plan_generated)).toBe(1);

    const stamped = new Date().toISOString();
    db.prepare(reviewedHouseholdStampSql("household")).run(stamped, "hh_real");
    for (const table of ["plan", "selection", "cook", "rating", "preference_evidence", "event", "meal_vote"]) {
      db.prepare(reviewedHouseholdStampSql(table)).run("hh_real");
    }
    expect(originOf(db, "household", "household_id", "hh_real")).toBe("household");
    expect(originOf(db, "rating", "rating_id", "hh_real-rate")).toBe("household");
    expect(originOf(db, "household", "household_id", "hh_oct")).toBe("unproven");
    expect(originOf(db, "rating", "rating_id", "hh_oct-rate")).toBe("unproven");
    expect(db.prepare(reviewedHouseholdStampSql("household")).run(stamped, "hh_qa").changes).toBe(0);
    expect(originOf(db, "household", "household_id", "hh_qa")).toBe("synthetic");
    expect(countSql(db, completedMealLoopSql(), "hh_real")).toBe(1);
    expect(countSql(db, alpha.completed_meal_loops)).toBe(2);
    expect(countSql(db, completedMealLoopSql(), "hh_oct")).toBe(0);
  });
});
