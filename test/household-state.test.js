import { describe, expect, it } from "vitest";
import { deriveHouseholdState } from "../src/lib/household-state.js";

describe("deriveHouseholdState", () => {
  it("routes returning user with selection to cook", () => {
    const s = deriveHouseholdState({
      onboarded: true,
      plan: { plan_id: "p1", status: "Selected" },
      selection: { meal_option_id: "m1" },
      cook: null,
      ratings: [],
      active_member_count: 2,
    });
    expect(s.next_action).toBe("cook_meal");
    expect(s.next_view).toBe("detail");
  });

  it("routes new household to onboarding", () => {
    const s = deriveHouseholdState({
      onboarded: false,
      plan: null,
      selection: null,
      cook: null,
      ratings: [],
      active_member_count: 0,
    });
    expect(s.next_action).toBe("onboarding");
    expect(s.next_view).toBe("create");
  });

  it("routes rated plan to home", () => {
    const s = deriveHouseholdState({
      onboarded: true,
      plan: { plan_id: "p1", status: "Rated" },
      selection: { meal_option_id: "m1" },
      cook: { cook_id: "c1" },
      ratings: [
        { member_id: "a", score: 8 },
        { member_id: "b", score: 7 },
      ],
      active_member_count: 2,
    });
    expect(s.lifecycle).toBe("Rated");
    expect(s.next_action).toBe("loop_complete");
    expect(s.cml_complete).toBe(true);
  });

  it("allows partial ratings without blocking home", () => {
    const s = deriveHouseholdState({
      onboarded: true,
      plan: { plan_id: "p1", status: "Cooked" },
      selection: { meal_option_id: "m1" },
      cook: { cook_id: "c1" },
      ratings: [{ member_id: "a", score: 8 }],
      active_member_count: 3,
    });
    expect(s.rating_state).toBe("partial");
    expect(s.next_action).toBe("rate_meal");
    expect(s.cml_complete).toBe(false);
  });
});
