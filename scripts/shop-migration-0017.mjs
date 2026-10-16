/**
 * Rehearse migration 0017 against a SQLite copy of D1.
 * Does not talk to Cloudflare. Remote apply stays on the deploy box.
 *
 *   node scripts/shop-migration-0017.mjs --sqlite /tmp/preview.sqlite --dry-run
 *   node scripts/shop-migration-0017.mjs --sqlite /tmp/preview.sqlite --apply
 *   node scripts/shop-migration-0017.mjs --sqlite /tmp/preview.sqlite --verify
 */

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// The app's current-plan rule (DINNER_PLAN_RECENCY in dinner-plan-store.js).
const CURRENT_PLAN = `SELECT p2.dinner_plan_id FROM dinner_plan p2
  WHERE p2.household_id = p.household_id AND p2.status != 'completed'
  ORDER BY p2.updated_at DESC, p2.created_at DESC, p2.dinner_plan_id DESC
  LIMIT 1`;

// Informational: lines on older unfinished drafts that the backfill leaves out.
const EXCLUDED_SQL = `SELECT COUNT(l.line_id) AS lines, COUNT(DISTINCT p.household_id) AS households
  FROM dinner_plan p
  JOIN dinner_shop_line l ON l.dinner_plan_id = p.dinner_plan_id
  WHERE p.status != 'completed' AND p.dinner_plan_id != (${CURRENT_PLAN})`;

const VERIFY = [
  {
    name: "two open lists",
    sql: `SELECT household_id, COUNT(*) c FROM household_shop_list WHERE status = 'open' GROUP BY household_id HAVING c > 1`,
  },
  {
    // Current plan only: the latest unfinished plan, the same rule as
    // findCurrentDinnerPlanId. One open list per household points at it.
    // Older unfinished drafts keep their lines in dinner_shop_line and are
    // reported as excluded_older_draft_lines, not as failures.
    name: "current plan shop lines missing an open list",
    sql: `SELECT p.household_id, p.dinner_plan_id FROM dinner_plan p
          JOIN dinner_shop_line l ON l.dinner_plan_id = p.dinner_plan_id
          WHERE p.status != 'completed'
            AND p.dinner_plan_id = (${CURRENT_PLAN})
            AND NOT EXISTS (
              SELECT 1 FROM household_shop_list s
              WHERE s.household_id = p.household_id AND s.status = 'open' AND s.dinner_plan_id = p.dinner_plan_id
            )`,
  },
  {
    name: "purchased or already-have not preserved",
    sql: `SELECT l.line_id FROM dinner_shop_line l
          JOIN dinner_plan p ON p.dinner_plan_id = l.dinner_plan_id
          JOIN household_shop_list s ON s.dinner_plan_id = p.dinner_plan_id AND s.status = 'open'
          LEFT JOIN household_shop_line h
            ON h.shop_list_id = s.shop_list_id AND h.ingredient_id = l.ingredient_id AND h.unit = l.unit
          WHERE p.status != 'completed'
            AND l.list_state IN ('purchased', 'already_have')
            AND (h.line_id IS NULL OR h.list_state != l.list_state)`,
  },
  {
    name: "duplicate identity",
    sql: `SELECT shop_list_id, ifnull(ingredient_id,''), ifnull(general_key,''), unit, COUNT(*) c
          FROM household_shop_line GROUP BY 1,2,3,4 HAVING c > 1`,
  },
];

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return "";
  return process.argv[i + 1] || "";
}

function mode() {
  if (process.argv.includes("--apply")) return "apply";
  if (process.argv.includes("--verify")) return "verify";
  return "dry-run";
}

const sqlitePath = arg("--sqlite");
if (!sqlitePath) {
  console.error("Pass --sqlite /path/to/backup.sqlite");
  process.exit(2);
}

const sqlPath = fileURLToPath(new URL("../migrations/0017_household_shop.sql", import.meta.url));
const migrationSql = readFileSync(sqlPath, "utf8");
const selected = mode();
const db = new DatabaseSync(sqlitePath, { readOnly: selected !== "apply" });

function counts() {
  const plans = db
    .prepare(
      `SELECT COUNT(DISTINCT p.household_id) AS households, COUNT(l.line_id) AS lines
       FROM dinner_plan p
       JOIN dinner_shop_line l ON l.dinner_plan_id = p.dinner_plan_id
       WHERE p.status != 'completed'
         AND p.dinner_plan_id = (
           SELECT p2.dinner_plan_id FROM dinner_plan p2
           WHERE p2.household_id = p.household_id AND p2.status != 'completed'
           ORDER BY p2.updated_at DESC, p2.created_at DESC, p2.dinner_plan_id DESC
           LIMIT 1
         )`
    )
    .get();
  const purchased = db
    .prepare(
      `SELECT COUNT(*) AS c FROM dinner_shop_line l
       JOIN dinner_plan p ON p.dinner_plan_id = l.dinner_plan_id
       WHERE p.status != 'completed' AND l.list_state IN ('purchased', 'already_have')`
    )
    .get();
  const excluded = db.prepare(EXCLUDED_SQL).get();
  return {
    households: plans.households || 0,
    lines: plans.lines || 0,
    marked: purchased.c || 0,
    excluded_lines: excluded.lines || 0,
    excluded_households: excluded.households || 0,
  };
}

if (selected === "dry-run") {
  const before = counts();
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        file: "migrations/0017_household_shop.sql",
        would_backfill_households: before.households,
        would_backfill_lines: before.lines,
        marked_lines_to_preserve: before.marked,
        excluded_older_draft_lines: before.excluded_lines,
        excluded_older_draft_households: before.excluded_households,
        writes: false,
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (selected === "apply") {
  db.close();
  const writable = new DatabaseSync(sqlitePath);
  writable.exec("PRAGMA foreign_keys = ON");
  try {
    writable.exec(migrationSql);
  } catch (error) {
    console.error("apply failed:", error.message);
    console.error("0017 is one shot. Do not re-apply CREATE TABLE. Rehearse on a fresh backup copy.");
    process.exit(1);
  }
  console.log(JSON.stringify({ mode: "apply", ok: true }, null, 2));
  writable.close();
  process.exit(0);
}

let failed = 0;
const report = [];
for (const check of VERIFY) {
  let rows = [];
  try {
    rows = db.prepare(check.sql).all();
  } catch (error) {
    failed += 1;
    report.push({ name: check.name, error: error.message });
    continue;
  }
  if (rows.length) failed += 1;
  report.push({ name: check.name, rows: rows.length, sample: rows.slice(0, 5) });
}
const excluded = db.prepare(EXCLUDED_SQL).get();
console.log(
  JSON.stringify(
    {
      mode: "verify",
      ok: failed === 0,
      checks: report,
      excluded_older_draft_lines: excluded.lines || 0,
      excluded_older_draft_households: excluded.households || 0,
    },
    null,
    2
  )
);
process.exit(failed ? 1 : 0);
