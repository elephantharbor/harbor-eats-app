import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeQuery } from "../src/discovery/query.js";

describe("D-07 soft vs hard discovery query", () => {
  it("keeps quick independent from effort_levels in normalized query", () => {
    const q = normalizeQuery({ criteria: { quick: true, effort_levels: ["easy"] } }).query;
    expect(q.criteria.quick).toBe(true);
    expect(q.criteria.effort_levels).toEqual(["easy"]);
  });

  it("distinguishes omitted soft from explicit off", () => {
    const omitted = normalizeQuery({}).query;
    const explicit = normalizeQuery({ soft: { keep_it_easy: false, keep_ingredients_simple: false } }).query;
    expect(omitted.soft_provided).toBe(false);
    expect(explicit.soft_provided).toBe(true);
  });

  it("serializes soft only when discovery UI marks soft_provided", () => {
    const discoveryUi = readFileSync(new URL("../public/discovery-ui.js", import.meta.url), "utf8");
    expect(discoveryUi).toContain("soft_provided");
    expect(discoveryUi).toContain("softTouched");
    expect(discoveryUi).toContain("keep_it_easy");
  });
});
