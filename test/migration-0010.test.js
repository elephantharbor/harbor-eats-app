import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  TRACTION_EVENT_NAMES,
  alphaOpsQueries,
  completedMealLoopSql,
  funnelEventCountSql,
} from "../src/lib/evidence-origin.js";
import { learningTasteRows } from "../src/lib/preference-concepts.js";

const MIGRATION_FILES = readdirSync(new URL("../migrations/", import.meta.url))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const MIGRATION_0010 = "0010_cycle2_taste_contract.sql";

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

function countSql(db, sql, ...params) {
  const row = db.prepare(sql).get(...params);
  return row ? row.c : 0;
}

function tableNames(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);
}

describe("migration 0010", () => {
  it("refuses to run when 0008 has not been followed by 0009", () => {
    const db = new DatabaseSync(":memory:");
    applyThrough(db, "0008");
    expect(() => applyNamed(db, MIGRATION_0010)).toThrow();
    expect(tableNames(db)).not.toContain("taste_vocabulary");
    expect(tableNames(db)).not.toContain("recipe_package_version");
    db.close();
  });

  it("opens on a pre-Cycle-2 database without rewriting origin or recipes", () => {
    const db = new DatabaseSync(":memory:");
    applyThrough(db, "0009");
    db.prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_pre', 'Pre cycle', 'active', 'America/Chicago', 2, 'organic', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', 'household')`
    ).run();
    db.prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('hh_pre-m', 'hh_pre', 'Ana', 'owner', 'active', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`
    ).run();
    db.prepare(
      `INSERT INTO preference_evidence
        (evidence_id, household_id, member_id, source, kind, tag, weight, created_at, data_origin)
       VALUES ('hh_pre-pe', 'hh_pre', 'hh_pre-m', 'onboarding_spark', 'like', 'crispy', 1, '2026-10-01T00:00:00Z', 'household')`
    ).run();
    db.prepare(
      `INSERT INTO client_error (error_id, surface, created_at)
       VALUES ('err-pre', 'tonight', '2026-10-01T00:00:00Z')`
    ).run();

    applyNamed(db, MIGRATION_0010);

    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(db.prepare("SELECT data_origin FROM household WHERE household_id = 'hh_pre'").get().data_origin).toBe(
      "household"
    );
    expect(db.prepare("SELECT tag FROM preference_evidence WHERE evidence_id = 'hh_pre-pe'").get().tag).toBe("crispy");
    expect(db.prepare("SELECT COUNT(*) AS c FROM client_error").get().c).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS c FROM household WHERE household_id = '__fw_c2_0009_guard__'").get().c).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS c FROM taste_vocabulary").get().c).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS c FROM recipe_package_version").get().c).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS c FROM recipe_package_version WHERE kitchen_tested = 1").get().c).toBe(0);
    db.close();
  });

  it("keeps synthetic and unproven rows out of taste, CML, funnel, alpha ops, and traction", () => {
    const db = new DatabaseSync(":memory:");
    applyThrough(db, "0010");
    expect(tableNames(db)).toEqual(expect.arrayContaining([
      "taste_vocabulary",
      "diner_taste",
      "diner_practical_hint",
      "recipe",
      "recipe_package_version",
      "shopped_plan_line",
      "targeted_feedback",
    ]));

    db.prepare(
      `INSERT INTO taste_vocabulary (slug, display_name, category, synonyms_json, created_at)
       VALUES ('crispy', 'Crispy', 'texture', '[]', '2026-10-03T00:00:00Z')`
    ).run();
    db.prepare(
      `INSERT INTO taste_vocabulary (slug, display_name, category, synonyms_json, created_at)
       VALUES ('spicy', 'Spicy', 'flavor', '[]', '2026-10-03T00:00:00Z')`
    ).run();

    const kitchens = [
      ["hh_live", "household", "organic"],
      ["hh_syn", "synthetic", "synthetic_qa"],
      ["hh_old", "unproven", null],
    ];
    for (const [id, origin, acquisition] of kitchens) {
      db.prepare(
        `INSERT INTO household
          (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
         VALUES (?, ?, 'active', 'America/Chicago', 2, ?, '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z', ?)`
      ).run(id, id, acquisition, origin);
      db.prepare(
        `INSERT INTO member
          (member_id, household_id, display_name, role, status, created_at, updated_at)
         VALUES (?, ?, 'Ana', 'owner', 'active', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z')`
      ).run(`${id}-m`, id);
      db.prepare(
        `INSERT INTO plan (plan_id, household_id, status, created_at, updated_at, data_origin)
         VALUES (?, ?, 'Rated', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z', ?)`
      ).run(`${id}-p`, id, origin);
      db.prepare(
        `INSERT INTO meal_option (meal_option_id, plan_id, letter, name, recipe_slug, created_at)
         VALUES (?, ?, 'A', 'Miso salmon', 'miso-ginger-salmon', '2026-10-03T00:00:00Z')`
      ).run(`${id}-mo`, `${id}-p`);
      db.prepare(
        `INSERT INTO rating
          (rating_id, plan_id, meal_option_id, household_id, member_id, score, source, created_at, updated_at, data_origin)
         VALUES (?, ?, ?, ?, ?, 8, 'app', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z', ?)`
      ).run(`${id}-rate`, `${id}-p`, `${id}-mo`, id, `${id}-m`, origin);
      db.prepare(
        `INSERT INTO preference_evidence
          (evidence_id, household_id, member_id, source, kind, tag, weight, created_at, data_origin)
         VALUES (?, ?, ?, 'onboarding_spark', 'like', 'crispy', 1, '2026-10-03T00:00:00Z', ?)`
      ).run(`${id}-pe`, id, `${id}-m`, origin);
      for (const eventName of TRACTION_EVENT_NAMES) {
        db.prepare(
          `INSERT INTO event (event_id, event_name, household_id, plan_id, created_at, data_origin)
           VALUES (?, ?, ?, ?, '2026-10-03T00:00:00Z', ?)`
        ).run(`${id}-${eventName}`, eventName, id, `${id}-p`, origin);
      }
      db.prepare(
        `INSERT INTO diner_taste
          (taste_id, household_id, member_id, vocabulary_slug, rank, stance, confidence, data_origin, created_at, updated_at)
         VALUES (?, ?, ?, 'crispy', 'like', 'explicit', NULL, ?, '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z')`
      ).run(`${id}-taste`, id, `${id}-m`, origin);
    }

    const liveHousehold = { data_origin: "household", acquisition_source: "organic" };
    const tastes = db.prepare(
      "SELECT vocabulary_slug, data_origin, member_id, household_id FROM diner_taste"
    ).all();
    const forHousehold = (id) => tastes.filter((row) => row.household_id === id);
    expect(learningTasteRows(forHousehold("hh_live"), liveHousehold).map((row) => row.vocabulary_slug)).toEqual([
      "crispy",
    ]);
    expect(
      learningTasteRows(forHousehold("hh_syn"), { data_origin: "synthetic", acquisition_source: "synthetic_qa" })
    ).toEqual([]);
    expect(
      learningTasteRows(forHousehold("hh_old"), { data_origin: "unproven", acquisition_source: null })
    ).toEqual([]);
    expect(learningTasteRows(tastes, liveHousehold).map((row) => row.data_origin)).toEqual(["household"]);

    expect(countSql(db, completedMealLoopSql(), "hh_live")).toBe(1);
    expect(countSql(db, completedMealLoopSql(), "hh_syn")).toBe(0);
    expect(countSql(db, completedMealLoopSql(), "hh_old")).toBe(0);
    for (const name of TRACTION_EVENT_NAMES) {
      expect(countSql(db, funnelEventCountSql(), "hh_live", name)).toBe(1);
      expect(countSql(db, funnelEventCountSql(), "hh_syn", name)).toBe(0);
      expect(countSql(db, funnelEventCountSql(), "hh_old", name)).toBe(0);
    }
    const alpha = alphaOpsQueries();
    for (const sql of Object.values(alpha)) {
      expect(sql).not.toMatch(/diner_taste|diner_practical_hint|targeted_feedback|recipe_package_version/);
    }
    expect(countSql(db, alpha.households)).toBe(1);
    expect(countSql(db, alpha.ratings)).toBe(1);
    expect(countSql(db, alpha.plans)).toBe(1);
    expect(countSql(db, alpha.completed_meal_loops)).toBe(1);
    expect(countSql(db, alpha.plan_generated)).toBe(1);

    expect(() =>
      db.prepare(
        `INSERT INTO diner_taste
          (taste_id, household_id, member_id, vocabulary_slug, rank, stance, data_origin, created_at, updated_at)
         VALUES ('bad-rank', 'hh_live', 'hh_live-m', 'spicy', 'ban', 'explicit', 'household', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z')`
      ).run()
    ).toThrow();

    expect(() =>
      db.prepare(
        `INSERT INTO recipe (recipe_id, dish_id, visibility, household_id, created_at)
         VALUES ('rcp_private', 'miso-ginger-salmon', 'household', 'hh_live', '2026-10-03T00:00:00Z')`
      ).run()
    ).not.toThrow();
    expect(() =>
      db.prepare(
        `INSERT INTO recipe_package_version (
          recipe_version_id, recipe_id, version_number, title, ingredients_json, base_servings,
          steps_json, provenance, image_provenance, publication_status, rights_state,
          visibility, household_id, data_origin, created_at
        ) VALUES (
          'rv_private_v1', 'rcp_private', 1, 'Our salmon', '[]', 2,
          '[]', 'household_submitted', 'unknown', 'published', 'not_cleared_for_external_release',
          'household', 'hh_live', 'synthetic', '2026-10-03T00:00:00Z'
        )`
      ).run()
    ).toThrow();

    db.close();
  });
});
