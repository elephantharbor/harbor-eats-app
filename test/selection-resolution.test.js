import { describe, expect, it } from "vitest";
import {
  membersWithoutVote,
  resolveMealSelection,
} from "../src/lib/selection-resolution.js";

const options = [
  { meal_option_id: "p-A", letter: "A", household_score: 7.2 },
  { meal_option_id: "p-B", letter: "B", household_score: 8.1 },
  { meal_option_id: "p-C", letter: "C", household_score: 6.5 },
];

describe("selection resolution", () => {
  it("unanimous vote wins", () => {
    const votes = [
      { member_id: "m1", meal_option_id: "p-B" },
      { member_id: "m2", meal_option_id: "p-B" },
    ];
    const r = resolveMealSelection(votes, options);
    expect(r.winner.meal_option_id).toBe("p-B");
    expect(r.rule).toBe("plurality");
  });

  it("plurality wins on split", () => {
    const votes = [
      { member_id: "m1", meal_option_id: "p-A" },
      { member_id: "m2", meal_option_id: "p-B" },
      { member_id: "m3", meal_option_id: "p-B" },
    ];
    const r = resolveMealSelection(votes, options);
    expect(r.winner.meal_option_id).toBe("p-B");
  });

  it("tie breaks on taste score", () => {
    const votes = [
      { member_id: "m1", meal_option_id: "p-A" },
      { member_id: "m2", meal_option_id: "p-B" },
    ];
    const r = resolveMealSelection(votes, options);
    expect(r.winner.meal_option_id).toBe("p-B");
    expect(r.rule).toBe("taste_tiebreak");
  });

  it("equal taste tie breaks by letter", () => {
    const tiedOpts = [
      { meal_option_id: "p-A", letter: "A", household_score: 8 },
      { meal_option_id: "p-B", letter: "B", household_score: 8 },
    ];
    const votes = [
      { member_id: "m1", meal_option_id: "p-A" },
      { member_id: "m2", meal_option_id: "p-B" },
    ];
    const r = resolveMealSelection(votes, tiedOpts);
    expect(r.winner.letter).toBe("A");
    expect(r.rule).toBe("letter_tiebreak");
  });

  it("tracks members without vote", () => {
    const missing = membersWithoutVote(["a", "b", "c"], [{ member_id: "a", meal_option_id: "p-A" }]);
    expect(missing).toEqual(["b", "c"]);
  });
});
