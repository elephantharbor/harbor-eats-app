import { describe, expect, it } from "vitest";
import { deriveHouseholdState } from "../src/lib/household-state.js";
import {
  membersWithoutVote,
  resolveMealSelection,
} from "../src/lib/selection-resolution.js";

const options = [
  { meal_option_id: "p-A", letter: "A", household_score: 7.0 },
  { meal_option_id: "p-B", letter: "B", household_score: 8.5 },
  { meal_option_id: "p-C", letter: "C", household_score: 6.0 },
];

describe("multi-diner household journey (state machine)", () => {
  it("3-diner partial ratings keep rate_meal without blocking home path", () => {
    const partial = deriveHouseholdState({
      onboarded: true,
      plan: { plan_id: "p1", status: "Cooked" },
      selection: { meal_option_id: "m1" },
      cook: { cook_id: "c1" },
      ratings: [
        { member_id: "a", score: 9 },
        { member_id: "b", score: 7 },
      ],
      active_member_count: 3,
    });
    expect(partial.rating_state).toBe("partial");
    expect(partial.next_action).toBe("rate_meal");
    expect(partial.cml_complete).toBe(false);

    const full = deriveHouseholdState({
      onboarded: true,
      plan: { plan_id: "p1", status: "Rated" },
      selection: { meal_option_id: "m1" },
      cook: { cook_id: "c1" },
      ratings: [
        { member_id: "a", score: 9 },
        { member_id: "b", score: 7 },
        { member_id: "c", score: 8 },
      ],
      active_member_count: 3,
    });
    expect(full.rating_state).toBe("full");
    expect(full.cml_complete).toBe(true);
    expect(full.next_action).toBe("loop_complete");
  });

  it("4-diner CML requires all four ratings", () => {
    const threeOfFour = deriveHouseholdState({
      onboarded: true,
      plan: { plan_id: "p1", status: "Cooked" },
      selection: { meal_option_id: "m1" },
      cook: { cook_id: "c1" },
      ratings: [
        { member_id: "a", score: 8 },
        { member_id: "b", score: 8 },
        { member_id: "c", score: 8 },
      ],
      active_member_count: 4,
    });
    expect(threeOfFour.rating_state).toBe("partial");
    expect(threeOfFour.cml_complete).toBe(false);
  });
});

describe("multi-diner voting scenarios", () => {
  it("4-person 2-1-1 plurality picks B", () => {
    const votes = [
      { member_id: "m1", meal_option_id: "p-A" },
      { member_id: "m2", meal_option_id: "p-B" },
      { member_id: "m3", meal_option_id: "p-B" },
      { member_id: "m4", meal_option_id: "p-C" },
    ];
    const r = resolveMealSelection(votes, options);
    expect(r.winner.meal_option_id).toBe("p-B");
    expect(r.rule).toBe("plurality");
  });

  it("4-person 2-2 resolves via taste tie-break (not consumer-facing jargon)", () => {
    const votes = [
      { member_id: "m1", meal_option_id: "p-A" },
      { member_id: "m2", meal_option_id: "p-A" },
      { member_id: "m3", meal_option_id: "p-B" },
      { member_id: "m4", meal_option_id: "p-B" },
    ];
    const r = resolveMealSelection(votes, options);
    expect(r.winner.meal_option_id).toBe("p-B");
    expect(r.rule).toBe("taste_tiebreak");
  });

  it("3-way tie at 3 votes uses taste then letter", () => {
    const votes = [
      { member_id: "m1", meal_option_id: "p-A" },
      { member_id: "m2", meal_option_id: "p-B" },
      { member_id: "m3", meal_option_id: "p-C" },
    ];
    const r = resolveMealSelection(votes, options);
    expect(r.winner.meal_option_id).toBe("p-B");
    expect(r.rule).toBe("taste_tiebreak");
  });

  it("tracks outstanding voters for 4-member household", () => {
    const missing = membersWithoutVote(
      ["a", "b", "c", "d"],
      [
        { member_id: "a", meal_option_id: "p-A" },
        { member_id: "c", meal_option_id: "p-B" },
      ]
    );
    expect(missing).toEqual(["b", "d"]);
  });
});
