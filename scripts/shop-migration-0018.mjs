/**
 * Rehearse migration 0018 against a SQLite copy of D1.
 * Does not talk to Cloudflare. Remote apply stays on the deploy box.
 *
 *   node scripts/shop-migration-0018.mjs --sqlite /tmp/preview.sqlite --dry-run
 *   node scripts/shop-migration-0018.mjs --sqlite /tmp/preview.sqlite --apply
 *   node scripts/shop-migration-0018.mjs --sqlite /tmp/preview.sqlite --verify
 */

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const VERIFY = [
  {
    name: "handoff household does not match its list",
    sql: `SELECT h.handoff_id FROM grocery_handoff h
          JOIN household_shop_list s ON s.shop_list_id = h.shop_list_id
          WHERE h.household_id != s.household_id`,
  },
  {
    name: "handoff list is missing",
    sql: `SELECT h.handoff_id FROM grocery_handoff h
          LEFT JOIN household_shop_list s ON s.shop_list_id = h.shop_list_id
          WHERE s.shop_list_id IS NULL`,
  },
  {
    name: "handoff uses a purchase status",
    sql: `SELECT handoff_id FROM grocery_handoff
          WHERE status IN ('purchased', 'ordered', 'delivered')`,
  },
  {
    name: "live link is missing an https url",
    sql: `SELECT handoff_id FROM grocery_handoff
          WHERE status = 'link_created'
            AND (products_link_url IS NULL OR products_link_url = '' OR products_link_url NOT LIKE 'https://%')`,
  },
  {
    name: "stored url is outside the Instacart host allowlist",
    sql: `SELECT handoff_id FROM grocery_handoff
          WHERE products_link_url IS NOT NULL
            AND products_link_url NOT LIKE 'https://www.instacart.com/%'
            AND products_link_url NOT LIKE 'https://instacart.com/%'
            AND products_link_url NOT IN (
              'https://www.instacart.com',
              'https://www.instacart.com/',
              'https://instacart.com',
              'https://instacart.com/'
            )`,
  },
  {
    name: "failed or rejected handoff kept a url",
    sql: `SELECT handoff_id FROM grocery_handoff
          WHERE status IN ('failed', 'rejected', 'prepared')
            AND products_link_url IS NOT NULL`,
  },
  {
    name: "order cart or payment column",
    sql: `SELECT name FROM pragma_table_info('grocery_handoff')
          WHERE name IN ('order_id', 'cart_id', 'payment_id', 'payment')`,
  },
  {
    name: "initiating member is in another household",
    sql: `SELECT h.handoff_id FROM grocery_handoff h
          JOIN member m ON m.member_id = h.created_by_member_id
          WHERE m.household_id != h.household_id`,
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

const sqlPath = fileURLToPath(new URL("../migrations/0018_grocery_handoff.sql", import.meta.url));
const migrationSql = readFileSync(sqlPath, "utf8");
const selected = mode();
const updatesExisting = /^\s*UPDATE\b/im.test(migrationSql);
const probe = new DatabaseSync(sqlitePath, { readOnly: true });
probe.close();

if (selected === "dry-run") {
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        file: "migrations/0018_grocery_handoff.sql",
        creates: "grocery_handoff",
        updates_existing_rows: updatesExisting,
        backfill: false,
        writes: false,
      },
      null,
      2
    )
  );
  process.exit(updatesExisting ? 1 : 0);
}

if (selected === "apply") {
  const writable = new DatabaseSync(sqlitePath);
  writable.exec("PRAGMA foreign_keys = ON");
  try {
    writable.exec(migrationSql);
  } catch (error) {
    console.error("apply failed:", error.message);
    console.error("0018 is one shot. Do not re-apply CREATE TABLE. Rehearse on a fresh backup copy.");
    process.exit(1);
  }
  console.log(JSON.stringify({ mode: "apply", ok: true, updates_existing_rows: false }, null, 2));
  writable.close();
  process.exit(0);
}

const db = new DatabaseSync(sqlitePath, { readOnly: true });
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
console.log(JSON.stringify({ mode: "verify", ok: failed === 0, checks: report }, null, 2));
process.exit(failed ? 1 : 0);
