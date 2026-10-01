import { describe, expect, it } from "vitest";
import {
  filterEligibleOptions,
  isOptionEligible,
  prohibitedRuleKeys,
} from "../src/lib/eligibility.js";

describe("eligibility", () => {
  it("collects prohibited rule keys", () => {
    const keys = prohibitedRuleKeys([
      { rule_key: "dairy", status: "prohibited" },
      { rule_key: "none", status: "prohibited" },
      { rule_key: "fish", status: "permitted" },
    ]);
    expect(keys.has("dairy")).toBe(true);
    expect(keys.has("none")).toBe(false);
  });

  it("rejects dairy-tagged options when dairy prohibited", () => {
    const constraints = [{ rule_key: "dairy", status: "prohibited" }];
    const bad = { meal_option_id: "x", name: "Cream pasta", attributes_json: { tags: ["dairy"] } };
    const good = { meal_option_id: "y", name: "Tofu tacos", attributes_json: { tags: ["plant"] } };
    expect(isOptionEligible(bad, prohibitedRuleKeys(constraints))).toBe(false);
    expect(isOptionEligible(good, prohibitedRuleKeys(constraints))).toBe(true);
    expect(filterEligibleOptions([bad, good], constraints).map((o) => o.meal_option_id)).toEqual(["y"]);
  });
});
