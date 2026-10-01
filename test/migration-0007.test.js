import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("0007 phase4 additive migration", () => {
  const sql = readFileSync(
    new URL("../migrations/0007_phase4_recipe_versioning.sql", import.meta.url),
    "utf8"
  );

  it("adds recipe tables and meal_vote without dropping plan", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS meal_concept");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS recipe_version");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS meal_vote");
    expect(sql).toContain("ALTER TABLE rating ADD COLUMN recipe_version_id");
    expect(sql.toLowerCase()).not.toContain("drop table plan");
  });

  it("does not use PRAGMA foreign_keys OFF", () => {
    const statements = sql
      .split(";")
      .map((s) => s.replace(/--[^\n]*/g, "").trim())
      .filter(Boolean);
    const hasFkOff = statements.some((s) => /^PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(s));
    expect(hasFkOff).toBe(false);
  });
});
