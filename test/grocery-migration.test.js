import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

function sqliteWithPriorMigrations() {
  const dir = mkdtempSync(join(tmpdir(), "he-0018-"));
  const file = join(dir, "shop.sqlite");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql") && name < "0018")
    .sort();
  for (const name of files) db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  db.close();
  return file;
}

function run(file, flag) {
  return execFileSync("node", ["scripts/shop-migration-0018.mjs", "--sqlite", file, flag], { encoding: "utf8" });
}

describe("migration 0018 rehearsal", () => {
  it("dry-runs, applies once, and verifies zero-row checks", () => {
    const file = sqliteWithPriorMigrations();
    const dry = JSON.parse(run(file, "--dry-run"));
    expect(dry.writes).toBe(false);
    expect(dry.updates_existing_rows).toBe(false);
    expect(dry.backfill).toBe(false);
    const applied = JSON.parse(run(file, "--apply"));
    expect(applied.ok).toBe(true);
    const verified = JSON.parse(run(file, "--verify"));
    expect(verified.ok).toBe(true);
    expect(verified.checks.every((check) => check.rows === 0)).toBe(true);
    expect(() => run(file, "--apply")).toThrow(/apply failed/);
  });
});
