import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { dinnerCompletedLoopSql } from "../src/lib/plan-contract.js";

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

function tableNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
}

function insertKitchen(db, id, origin, acquisition) {
  db.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES (?, ?, 'active', 'America/Chicago', 2, ?, '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z', ?)`
  ).run(id, id, acquisition, origin);
  db.prepare(
    `INSERT INTO member
      (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES (?, ?, 'Ana', 'owner', 'active', '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z')`
  ).run(`${id}-a`, id);
  db.prepare(
    `INSERT INTO member
      (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES (?, ?, 'Bo', 'member', 'active', '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z')`
  ).run(`${id}-b`, id);
}

describe("migration 0011", () => {
  it("refuses to run when the database stopped after 0008", () => {
    const db = new DatabaseSync(":memory:");
    applyThrough(db, "0008");
    expect(() => db.exec(sqlFile("0011_cycle3_dinner_plan.sql"))).toThrow();
    expect(tableNames(db)).not.toContain("dinner_plan");
    db.close();
  });

  it("refuses to run when 0010 has not been applied", () => {
    const db = new DatabaseSync(":memory:");
    applyThrough(db, "0009");
    expect(() => db.exec(sqlFile("0011_cycle3_dinner_plan.sql"))).toThrow();
    expect(tableNames(db)).not.toContain("dinner_plan");
    expect(db.prepare("SELECT COUNT(*) AS c FROM household WHERE household_id = '__fw_c3_0009_guard__'").get().c).toBe(0);
    db.close();
  });

  it("opens on a database that already has 0010 without rewriting origin or the legacy plan", () => {
    const db = new DatabaseSync(":memory:");
    applyThrough(db, "0010");
    insertKitchen(db, "hh_pre", "unproven", null);
    db.prepare(
      `INSERT INTO plan (plan_id, household_id, status, created_at, updated_at, data_origin)
       VALUES ('plan_pre', 'hh_pre', 'Generated', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', 'unproven')`
    ).run();
    db.prepare(
      `INSERT INTO preference_evidence
        (evidence_id, household_id, member_id, source, kind, tag, weight, created_at, data_origin)
       VALUES ('pe_pre', 'hh_pre', 'hh_pre-a', 'onboarding_spark', 'dislike', 'spicy', 1, '2026-10-01T00:00:00Z', 'unproven')`
    ).run();
    const planSql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'plan'").get().sql;
    db.exec(sqlFile("0011_cycle3_dinner_plan.sql"));
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'plan'").get().sql).toBe(planSql);
    expect(db.prepare("SELECT data_origin FROM household WHERE household_id = 'hh_pre'").get().data_origin).toBe("unproven");
    expect(db.prepare("SELECT status, data_origin FROM plan WHERE plan_id = 'plan_pre'").get()).toEqual({
      status: "Generated",
      data_origin: "unproven",
    });
    expect(db.prepare("SELECT kind FROM preference_evidence WHERE evidence_id = 'pe_pre'").get().kind).toBe("dislike");
    expect(db.prepare("SELECT COUNT(*) AS c FROM dinner_plan").get().c).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS c FROM household WHERE household_id = '__fw_c3_0009_guard__'").get().c).toBe(0);
    const origin = db.prepare("PRAGMA table_info(dinner_plan)").all().find((col) => col.name === "data_origin");
    expect(String(origin.dflt_value)).toContain("unproven");
    db.close();
  });

  it("keeps synthetic and unproven dinner plans out of the completed meal loop", () => {
    const db = new DatabaseSync(":memory:");
    applyThrough(db, "0011");
    expect(tableNames(db)).toEqual(expect.arrayContaining([
      "dinner_plan",
      "dinner_plan_meal",
      "dinner_plan_participant",
      "dinner_plan_rating",
      "dinner_shop_line",
      "dinner_shop_delta",
      "dinner_plan_vote",
    ]));
    const kitchens = [
      ["hh_live", "household", "organic"],
      ["hh_syn", "synthetic", "synthetic_qa"],
      ["hh_old", "unproven", null],
    ];
    for (const [id, origin, acquisition] of kitchens) {
      insertKitchen(db, id, origin, acquisition);
      db.prepare(
        `INSERT INTO dinner_plan
          (dinner_plan_id, household_id, status, meal_count, entry_point, intent_json, data_origin,
           created_by_member_id, created_at, updated_at)
         VALUES (?, ?, 'completed', 1, 'plan_dinners', '{}', ?, ?, '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z')`
      ).run(`${id}-dp`, id, origin, `${id}-a`);
      db.prepare(
        `INSERT INTO dinner_plan_meal
          (meal_id, dinner_plan_id, position, kind, state, recipe_slug, recipe_id, recipe_version_id,
           version_number, title, data_origin, created_at, updated_at)
         VALUES (?, ?, 1, 'recipe', 'fully_rated', 'miso-ginger-salmon', 'rcp_salmon', 'rv_miso-ginger-salmon_v1',
           1, 'Miso salmon', ?, '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z')`
      ).run(`${id}-meal`, `${id}-dp`, origin);
      db.prepare(
        `INSERT INTO dinner_plan_participant (meal_id, member_id, household_id, active)
         VALUES (?, ?, ?, 1)`
      ).run(`${id}-meal`, `${id}-a`, id);
      db.prepare(
        `INSERT INTO dinner_plan_rating
          (rating_id, meal_id, dinner_plan_id, household_id, member_id, recipe_version_id, score, data_origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'rv_miso-ginger-salmon_v1', 8, ?, '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z')`
      ).run(`${id}-rate`, `${id}-meal`, `${id}-dp`, id, `${id}-a`, origin);
    }
    db.prepare(
      `INSERT INTO dinner_plan_meal
        (meal_id, dinner_plan_id, position, kind, state, recipe_slug, recipe_id, recipe_version_id,
         version_number, title, data_origin, created_at, updated_at)
       VALUES ('hh_live-planned', 'hh_live-dp', 2, 'recipe', 'planned', 'miso-ginger-salmon', 'rcp_salmon',
         'rv_miso-ginger-salmon_v1', 1, 'Miso salmon', 'household', '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z')`
    ).run();
    db.prepare(
      "UPDATE dinner_plan SET meal_count = 2 WHERE dinner_plan_id = 'hh_live-dp'"
    ).run();
    const counted = db.prepare(dinnerCompletedLoopSql()).get().c;
    expect(counted).toBe(1);
    db.close();
  });
});
