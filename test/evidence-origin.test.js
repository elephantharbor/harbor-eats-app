import { describe, expect, it } from "vitest";
import { buildTasteProfile } from "../src/lib/taste-model.js";
import {
  countsTowardOps,
  householdIsSynthetic,
  learningRows,
  originFromRequest,
} from "../src/lib/evidence-origin.js";
import { historyFromActivity } from "../src/lib/meal-identity.js";

const hh001 = { household_id: "hh001", data_origin: "household", acquisition_source: "organic" };

describe("synthetic evidence isolation", () => {
  it("identifies QA requests and synthetic households", () => {
    const request = { headers: { get: (name) => (name.toLowerCase() === "x-flavorweave-data-origin" ? "synthetic" : null) } };
    expect(originFromRequest(request, {})).toBe("synthetic");
    expect(originFromRequest({ headers: { get: () => null } }, {})).toBe("household");
    expect(householdIsSynthetic({ acquisition_source: "synthetic_qa", data_origin: "household" })).toBe(true);
    expect(householdIsSynthetic(hh001)).toBe(false);
  });

  it("drops a synthetic 8/10 from HH001 taste evidence and history", () => {
    const ratings = [
      { score: 7, recipe_slug: "miso-ginger-salmon", tags: ["fish"], data_origin: "household", meal_option_id: "a", member_id: "m1" },
      { score: 8, recipe_slug: "crispy-tofu-tacos", tags: ["tacos"], data_origin: "synthetic", meal_option_id: "b", member_id: "m1" },
    ];
    const learning = learningRows(ratings, hh001);
    expect(learning.map((row) => row.score)).toEqual([7]);
    const profile = buildTasteProfile([], learning);
    expect(profile.meals_rated).toBe(1);
    expect(profile.lines.find((line) => line.kind === "history").text).toContain("7.0/10");

    const history = historyFromActivity({
      household: hh001,
      plans: [
        { plan_id: "real", status: "Rated", active_member_count: 1, data_origin: "household" },
        { plan_id: "qa", status: "Rated", active_member_count: 1, data_origin: "synthetic" },
      ],
      options: [
        { plan_id: "real", meal_option_id: "a", name: "Miso salmon", recipe_slug: "miso-ginger-salmon", recipe_version: "rv_miso-ginger-salmon_v1" },
        { plan_id: "qa", meal_option_id: "b", name: "Tofu tacos", recipe_slug: "crispy-tofu-tacos", recipe_version: "rv_crispy-tofu-tacos_v1" },
      ],
      selections: [],
      cooks: [
        { plan_id: "real", meal_option_id: "a", cooked_at: "2026-10-03T00:00:00Z", data_origin: "household" },
        { plan_id: "qa", meal_option_id: "b", cooked_at: "2026-10-01T00:00:00Z", data_origin: "synthetic" },
      ],
      ratings: [
        { plan_id: "real", meal_option_id: "a", member_id: "m1", score: 7, data_origin: "household" },
        { plan_id: "qa", meal_option_id: "b", member_id: "m1", score: 8, data_origin: "synthetic" },
      ],
    });
    expect(history.map((row) => row.plan_id)).toEqual(["real"]);
    expect(history[0].avg_score).toBe(7);
  });

  it("does not let a synthetic household or row count toward ops", () => {
    expect(countsTowardOps(hh001, { data_origin: "household" })).toBe(true);
    expect(countsTowardOps(hh001, { data_origin: "synthetic" })).toBe(false);
    expect(countsTowardOps({ data_origin: "synthetic", acquisition_source: "synthetic_qa" }, { data_origin: "synthetic" })).toBe(false);
    expect(learningRows(
      [{ score: 8, data_origin: "synthetic" }],
      { data_origin: "synthetic", acquisition_source: "e2e" }
    )).toEqual([]);
  });
});
