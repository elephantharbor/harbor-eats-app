import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { classificationHistoryInsert } from "../src/lib/catalog-staging-sql.js";

const root = process.cwd();
const dedupeSql = readFileSync(join(root, "data/pending/dedupe-classification-history.sql"), "utf8");
const COLS = ["history_id", "recipe_version_id", "prior_effort_level", "prior_ingredient_complexity", "new_effort_level", "new_ingredient_complexity", "source", "reason", "created_at"];

function db() {
  const d = new DatabaseSync(":memory:");
  d.exec("PRAGMA foreign_keys = OFF;");
  d.exec(`CREATE TABLE catalog_classification_history (
    history_id TEXT PRIMARY KEY, recipe_version_id TEXT NOT NULL, prior_effort_level TEXT, prior_ingredient_complexity TEXT,
    new_effort_level TEXT NOT NULL, new_ingredient_complexity TEXT NOT NULL, source TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL);`);
  return d;
}
const row = (id, v, ne, nc, at, extra = {}) => ({
  history_id: id, recipe_version_id: v, prior_effort_level: null, prior_ingredient_complexity: null,
  new_effort_level: ne, new_ingredient_complexity: nc, source: "juniper", reason: id.split("_")[1], created_at: at, ...extra,
});
const insert = (d, r) => d.prepare(`INSERT INTO catalog_classification_history (${COLS.join(",")}) VALUES (${COLS.map(() => "?").join(",")})`).run(...COLS.map((c) => r[c]));

describe("classification history dedupe (data-only, pending)", () => {
  it("reproduces prod shape (25 dup of 100) and reduces to one row per transition, keeping earliest", () => {
    const d = db();
    for (let i = 0; i < 75; i++) insert(d, row(`clh_backfill_rv_${i}`, `rv_${i}`, "easy", "simple", "2026-10-04T00:00:00.000Z"));
    for (let i = 0; i < 25; i++) insert(d, row(`clh_wave12_rv_${i}`, `rv_${i}`, "easy", "simple", "2026-10-08T22:00:00.000Z"));
    // a REAL amendment must survive
    insert(d, row("clh_amend_rv_1", "rv_1", "moderate", "standard", "2026-10-09T00:00:00.000Z", { prior_effort_level: "easy", prior_ingredient_complexity: "simple" }));
    expect(d.prepare("SELECT COUNT(*) n FROM catalog_classification_history").get().n).toBe(101);
    d.exec(dedupeSql);
    expect(d.prepare("SELECT COUNT(*) n FROM catalog_classification_history").get().n).toBe(76);
    expect(d.prepare("SELECT COUNT(*) n FROM catalog_classification_history WHERE history_id LIKE 'clh_wave12%'").get().n).toBe(0);
    expect(d.prepare("SELECT COUNT(*) n FROM catalog_classification_history WHERE history_id = 'clh_amend_rv_1'").get().n).toBe(1);
    d.exec(dedupeSql); // idempotent
    expect(d.prepare("SELECT COUNT(*) n FROM catalog_classification_history").get().n).toBe(76);
  });
  it("rendered import inserts are append-only and idempotent across batches", () => {
    const d = db();
    insert(d, row("clh_backfill_rv_0", "rv_0", "easy", "simple", "2026-10-04T00:00:00.000Z"));
    const again = classificationHistoryInsert(COLS, row("clh_wave12_rv_0", "rv_0", "easy", "simple", "2026-10-08T22:00:00.000Z"));
    expect(again).not.toMatch(/DELETE/);
    d.exec(again);
    d.exec(again);
    expect(d.prepare("SELECT COUNT(*) n FROM catalog_classification_history").get().n).toBe(1);
    d.exec(classificationHistoryInsert(COLS, row("clh_amend_rv_0", "rv_0", "moderate", "simple", "2026-10-09T00:00:00.000Z", { prior_effort_level: "easy", prior_ingredient_complexity: "simple" })));
    expect(d.prepare("SELECT COUNT(*) n FROM catalog_classification_history").get().n).toBe(2);
  });
  it("is not a schema migration (lives outside migrations/)", () => {
    const code = dedupeSql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(code).not.toMatch(/\b(CREATE|ALTER|DROP)\b/i);
    expect(code).toMatch(/^DELETE FROM catalog_classification_history/m);
  });
});
