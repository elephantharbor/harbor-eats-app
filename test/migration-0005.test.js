import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("0005 D1-safe meal_option migration", () => {
  const sql = readFileSync(
    new URL("../migrations/0005_phase3_household_intel.sql", import.meta.url),
    "utf8"
  );

  it("drops FK dependents before meal_option", () => {
    const dropSelection = sql.indexOf("DROP TABLE selection");
    const dropCook = sql.indexOf("DROP TABLE cook");
    const dropRating = sql.indexOf("DROP TABLE rating");
    const dropMeal = sql.indexOf("DROP TABLE meal_option");
    expect(dropSelection).toBeGreaterThan(-1);
    expect(dropCook).toBeGreaterThan(-1);
    expect(dropRating).toBeGreaterThan(-1);
    expect(dropMeal).toBeGreaterThan(-1);
    expect(dropSelection).toBeLessThan(dropMeal);
    expect(dropCook).toBeLessThan(dropMeal);
    expect(dropRating).toBeLessThan(dropMeal);
  });

  it("does not execute PRAGMA foreign_keys OFF", () => {
    const statements = sql
      .split(";")
      .map((s) => s.replace(/--[^\n]*/g, "").trim())
      .filter(Boolean);
    const hasFkOff = statements.some((s) => /^PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(s));
    expect(hasFkOff).toBe(false);
  });

  it("recreates selection, cook, and rating after meal_option", () => {
    const createMeal = sql.indexOf("CREATE TABLE meal_option (");
    const createSelection = sql.lastIndexOf("CREATE TABLE selection (");
    const createCook = sql.lastIndexOf("CREATE TABLE cook (");
    const createRating = sql.lastIndexOf("CREATE TABLE rating (");
    expect(createMeal).toBeGreaterThan(-1);
    expect(createSelection).toBeGreaterThan(createMeal);
    expect(createCook).toBeGreaterThan(createMeal);
    expect(createRating).toBeGreaterThan(createMeal);
  });
});
