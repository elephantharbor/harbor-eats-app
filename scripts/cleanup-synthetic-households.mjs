#!/usr/bin/env node
/**
 * scripts/cleanup-synthetic-households.mjs — delete synthetic households and their test-only rows from D1.
 *
 * DRY-RUN BY DEFAULT: prints the targets and per-table row counts plus the SQL it would run. Pass --apply to execute.
 *
 *   node scripts/cleanup-synthetic-households.mjs --env preview --marker d06-eval            # dry run
 *   node scripts/cleanup-synthetic-households.mjs --env preview --marker d06-eval --apply
 *   node scripts/cleanup-synthetic-households.mjs --env production --ids hh_a,hh_b --apply --i-understand-production
 *   options: --older-than-days N (marker mode only)  --keep-ai-usage (default; --delete-ai-usage to drop)  --sql-out file
 *
 * Guards:
 *  - --env is required (preview | production); the DB id comes from deploy/pages/<env>/wrangler.toml, never from args.
 *  - production: --ids is required (markers are refused), and --apply also needs --i-understand-production.
 *  - PROTECTED ids (real households, e.g. HH001) are always refused; extend via CLEANUP_PROTECTED_IDS=hh_x,hh_y.
 *  - every target must look synthetic: data_origin='synthetic' OR the display_name matches a known synthetic pattern.
 *    A target that fails is refused (the whole run aborts) — no partial runs.
 *  - --apply on production runs `wrangler d1 time-travel info` first and prints the bookmark for restore.
 *  - all deletes go in ONE `wrangler d1 execute --file` (D1 applies a file atomically), children before parents.
 *  - ai_usage rows are kept by default (spend audit; they have no FK). ai_limit_counters buckets keyed by the
 *    targets' household_key are deleted (the global/spend buckets are untouched).
 *  - after --apply, it runs an orphan check across all household/member/plan/dinner_plan references.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const die = (m) => { console.error("ERROR: " + m); process.exit(2); };

const env = opt("--env");
if (!["preview", "production"].includes(env)) die("--env preview|production is required");
const apply = flag("--apply");
const toml = readFileSync(`deploy/pages/${env}/wrangler.toml`, "utf8");
const DB = (toml.match(/database_id\s*=\s*"([^"]+)"/) || [])[1];
if (!DB) die(`no database_id in deploy/pages/${env}/wrangler.toml`);

export const PROTECTED = new Set(["hh_3884c16f6606", ...(process.env.CLEANUP_PROTECTED_IDS || "").split(",").filter(Boolean)]);
// Name patterns produced by our own fixtures. A household is a candidate only if it matches one (or is data_origin=synthetic).
export const SYNTHETIC_NAME = [
  /^D06 Eval Synthetic (Clear|Shellfish|Dairy|Mixed|Allergen)$/, /^D06 eval (clear|dairy|shellfish|mixed|allergen)( [a-z0-9]+)?$/,
  /^D06 Prod Smoke Synthetic$/, /^D05 prod smoke \d{4}-\d{2}-\d{2}$/, /^E2E Kitchen$/, /^\[synthetic\]/,
];
export const MARKERS = {
  "d06-eval": "(display_name LIKE 'D06 Eval Synthetic %' OR display_name LIKE 'D06 eval %' OR display_name = 'D06 eval clear')",
  "synthetic-prefix": "(display_name LIKE '[synthetic]%' AND data_origin = 'synthetic')",
};

const wr = (args) => {
  const raw = execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
  return raw;
};
const q = (sql) => { const raw = wr(["d1", "execute", DB, "--remote", "--json", "--command", sql]); return JSON.parse(raw.slice(raw.indexOf("["))).map((r) => r.results); };
const hk = (id) => crypto.createHash("sha256").update("fw-d05:" + id).digest("hex").slice(0, 24);
const lit = (s) => { if (!/^[A-Za-z0-9_-]+$/.test(s)) die(`unsafe id ${s}`); return `'${s}'`; };

// ---- resolve targets
let ids;
if (opt("--ids")) ids = opt("--ids").split(",").map((s) => s.trim()).filter(Boolean);
else if (opt("--marker")) {
  if (env === "production") die("production requires explicit --ids (markers refused)");
  const m = MARKERS[opt("--marker")]; if (!m) die(`unknown marker; known: ${Object.keys(MARKERS).join(", ")}`);
  const days = opt("--older-than-days");
  const age = days ? ` AND created_at < '${new Date(Date.now() - Number(days) * 864e5).toISOString()}'` : "";
  ids = q(`SELECT household_id FROM household WHERE ${m}${age}`)[0].map((r) => r.household_id);
} else die("pass --ids or --marker");
ids = [...new Set(ids)];
if (!ids.length) { console.log("no targets"); process.exit(0); }
for (const id of ids) if (PROTECTED.has(id)) die(`${id} is PROTECTED (real household) — refusing`);

const IN = `(${ids.map(lit).join(",")})`;
const rows = q(`SELECT household_id, display_name, data_origin, created_at FROM household WHERE household_id IN ${IN}`)[0];
const missing = ids.filter((id) => !rows.find((r) => r.household_id === id));
if (missing.length) die(`not found: ${missing.join(",")}`);
const bad = rows.filter((r) => r.data_origin !== "synthetic" && !SYNTHETIC_NAME.some((re) => re.test(r.display_name)));
if (bad.length) die(`not provably synthetic: ${bad.map((r) => `${r.household_id} "${r.display_name}" (${r.data_origin})`).join("; ")}`);

// ---- SQL (children -> parents)
const DP = `(SELECT dinner_plan_id FROM dinner_plan WHERE household_id IN ${IN})`;
const PL = `(SELECT plan_id FROM plan WHERE household_id IN ${IN})`;
const MO = `(SELECT meal_option_id FROM meal_option WHERE plan_id IN ${PL})`;
const MB = `(SELECT member_id FROM member WHERE household_id IN ${IN})`;
const DPM = `(SELECT meal_id FROM dinner_plan_meal WHERE dinner_plan_id IN ${DP})`;
const KEYS = ids.map(hk);
const steps = [
  ["dinner_shop_line", `dinner_plan_id IN ${DP}`],
  ["dinner_shop_delta", `dinner_plan_id IN ${DP}`],
  ["dinner_plan_participant", `household_id IN ${IN} OR member_id IN ${MB} OR meal_id IN ${DPM}`],
  ["dinner_plan_rating", `household_id IN ${IN} OR dinner_plan_id IN ${DP}`],
  ["dinner_plan_vote", `household_id IN ${IN} OR dinner_plan_id IN ${DP}`],
  ["dinner_plan_meal", `dinner_plan_id IN ${DP}`],
  ["dinner_plan", `household_id IN ${IN}`],
  ["selection", `household_id IN ${IN} OR plan_id IN ${PL}`],
  ["cook", `household_id IN ${IN} OR plan_id IN ${PL}`],
  ["rating", `household_id IN ${IN} OR plan_id IN ${PL}`],
  ["meal_vote", `household_id IN ${IN} OR plan_id IN ${PL}`],
  ["shopped_plan_line", `plan_id IN ${PL}`],
  ["share_choice", `household_id IN ${IN} OR plan_id IN ${PL}`],
  ["meal_option", `plan_id IN ${PL}`],
  ["plan", `household_id IN ${IN}`],
  ["invite", `household_id IN ${IN}`],
  ["recovery_token", `household_id IN ${IN}`],
  ["member_session", `household_id IN ${IN}`],
  ["constraint_rule", `household_id IN ${IN}`],
  ["diner_taste", `household_id IN ${IN}`],
  ["diner_practical_hint", `household_id IN ${IN}`],
  ["preference_evidence", `household_id IN ${IN}`],
  ["targeted_feedback", `household_id IN ${IN}`],
  ["recipe_package_version", `household_id IN ${IN}`],
  ["recipe", `household_id IN ${IN}`],
  ["event", `household_id IN ${IN}`],
  ["client_error", `household_id IN ${IN}`],
  ["member", `household_id IN ${IN}`],
  ["household", `household_id IN ${IN}`],
  ["ai_limit_counters", KEYS.map((k) => `bucket LIKE '%:${k}:%'`).join(" OR ")],
];
if (flag("--delete-ai-usage")) steps.push(["ai_usage", `household_key IN (${KEYS.map(lit).join(",")})`]);

// Safety: refuse if any row in a household-scoped table that we'd delete via plan/member belongs to a different household.
const cross = q([
  `SELECT 'participant' t, count(*) n FROM dinner_plan_participant WHERE member_id IN ${MB} AND household_id NOT IN ${IN}`,
  `SELECT 'invite_member' t, count(*) n FROM invite WHERE (invited_member_id IN ${MB} OR inviter_member_id IN ${MB}) AND household_id NOT IN ${IN}`,
  `SELECT 'share_referrer' t, count(*) n FROM share_choice WHERE referrer_household_id IN ${IN} AND household_id NOT IN ${IN}`,
  `SELECT 'member_inviter' t, count(*) n FROM member WHERE inviter_member_id IN ${MB} AND household_id NOT IN ${IN}`,
].join("; ")).map((r) => r[0]).filter((r) => r.n > 0);
if (cross.length) die(`targets are referenced by other households: ${JSON.stringify(cross)}`);

const counts = q(steps.map(([t, w]) => `SELECT '${t}' t, count(*) n FROM ${t} WHERE ${w}`).join("; ")).map((r) => r[0]);
console.log(`env=${env} db=${DB} mode=${apply ? "APPLY" : "DRY-RUN"} targets=${ids.length}`);
for (const r of rows) console.log(`  ${r.household_id}  ${r.display_name}  [${r.data_origin}]  ${r.created_at}`);
console.log("rows per table:"); for (const c of counts) if (c.n) console.log(`  ${c.t}: ${c.n}`);

const sql = [
  `UPDATE member SET inviter_member_id = NULL WHERE household_id IN ${IN};`,
  ...steps.map(([t, w]) => `DELETE FROM ${t} WHERE ${w};`),
].join("\n");
if (opt("--sql-out")) writeFileSync(opt("--sql-out"), sql + "\n");
if (!apply) { console.log("\nDRY-RUN: nothing deleted. Re-run with --apply."); process.exit(0); }
if (env === "production" && !flag("--i-understand-production")) die("production --apply needs --i-understand-production");

console.log("time-travel bookmark (before):\n" + wr(["d1", "time-travel", "info", DB, "--json"]).trim());
const f = join(mkdtempSync(join(tmpdir(), "cleanup-")), "delete.sql"); writeFileSync(f, sql + "\n");
console.log(wr(["d1", "execute", DB, "--remote", "--yes", "--file", f]).split("\n").filter((l) => /rows|changes|Executed|success/i.test(l)).join("\n"));

// ---- orphan check
const orphan = [
  ...["member", "member_session", "recovery_token", "constraint_rule", "invite", "diner_taste", "diner_practical_hint", "preference_evidence", "targeted_feedback", "plan", "selection", "cook", "rating", "meal_vote", "share_choice", "recipe", "recipe_package_version", "dinner_plan", "dinner_plan_participant", "dinner_plan_rating", "dinner_plan_vote"]
    .map((t) => `SELECT '${t}.household_id' t, count(*) n FROM ${t} x WHERE x.household_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM household h WHERE h.household_id = x.household_id)`),
  ...["member_session", "recovery_token", "rating", "meal_vote", "diner_taste", "diner_practical_hint", "dinner_plan_participant", "dinner_plan_rating", "dinner_plan_vote"]
    .map((t) => `SELECT '${t}.member_id' t, count(*) n FROM ${t} x WHERE x.member_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM member m WHERE m.member_id = x.member_id)`),
  ...["meal_option", "selection", "cook", "rating", "meal_vote", "shopped_plan_line"]
    .map((t) => `SELECT '${t}.plan_id' t, count(*) n FROM ${t} x WHERE x.plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM plan p WHERE p.plan_id = x.plan_id)`),
  ...["dinner_plan_meal", "dinner_shop_line", "dinner_shop_delta", "dinner_plan_rating", "dinner_plan_vote"]
    .map((t) => `SELECT '${t}.dinner_plan_id' t, count(*) n FROM ${t} x WHERE NOT EXISTS (SELECT 1 FROM dinner_plan d WHERE d.dinner_plan_id = x.dinner_plan_id)`),
  `SELECT 'event.household_id(targets)' t, count(*) n FROM event WHERE household_id IN ${IN}`,
  `SELECT 'client_error.household_id(targets)' t, count(*) n FROM client_error WHERE household_id IN ${IN}`,
  `SELECT 'household(targets)' t, count(*) n FROM household WHERE household_id IN ${IN}`,
];
const res = q(orphan.join("; ")).map((r) => r[0]);
const bad2 = res.filter((r) => r.n > 0);
console.log(bad2.length ? "ORPHANS: " + JSON.stringify(bad2) : `orphan check: 0 across ${res.length} checks`);
process.exit(bad2.length ? 1 : 0);
