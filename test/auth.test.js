import { describe, expect, it } from "vitest";
import { assertSameHousehold } from "../src/lib/auth.js";

describe("assertSameHousehold", () => {
  const session = { household_id: "hh_a", member_id: "m1" };

  it("allows matching household", () => {
    expect(assertSameHousehold(session, "hh_a")).toBeNull();
  });

  it("denies cross household", () => {
    expect(assertSameHousehold(session, "hh_b")).toBe("forbidden_cross_household");
  });

  it("allows missing requested id (derive from session)", () => {
    expect(assertSameHousehold(session, null)).toBeNull();
  });
});
