import { describe, expect, it } from "vitest";
import { buildTasteProfile } from "../src/lib/taste-model.js";
import { deriveHouseholdState } from "../src/lib/household-state.js";
import {
  countsTowardOps,
  householdIsSynthetic,
  learningRows,
  normalizeOrigin,
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

function activity(origin) {
  return {
    household: hh001,
    plans: [{ plan_id: "p", status: "Rated", active_member_count: 1, data_origin: origin }],
    options: [{ plan_id: "p", meal_option_id: "a", name: "Miso salmon", recipe_slug: "miso-ginger-salmon" }],
    selections: [{ plan_id: "p", meal_option_id: "a", created_at: "2026-10-01T00:00:00Z", data_origin: origin }],
    cooks: [{ plan_id: "p", meal_option_id: "a", cooked_at: "2026-10-01T01:00:00Z", data_origin: origin }],
    ratings: [{
      plan_id: "p",
      meal_option_id: "a",
      member_id: "m1",
      score: 8,
      recipe_slug: "miso-ginger-salmon",
      tags: ["fish"],
      data_origin: origin,
    }],
  };
}

function tasteAndLoop(origin) {
  const rows = activity(origin);
  const learning = learningRows(rows.ratings, rows.household);
  const profile = buildTasteProfile([], learning);
  const history = historyFromActivity(rows);
  const state = history.length
    ? deriveHouseholdState({
        plan: { plan_id: "p", status: "Rated" },
        selection: { meal_option_id: history[0].meal_option_id },
        cook: { cooked_at: "2026-10-01T01:00:00Z" },
        ratings: history[0].ratings,
        active_member_count: 1,
        onboarded: true,
      })
    : { cml_complete: false };
  return {
    meals_rated: profile.meals_rated,
    history: history.map((row) => row.plan_id),
    cml_complete: state.cml_complete,
    ops: countsTowardOps(rows.household, rows.ratings[0]),
  };
}

describe("unproven legacy origin", () => {
  it("does not treat an unknown value as household", () => {
    expect(normalizeOrigin(undefined)).toBe("unproven");
    expect(normalizeOrigin(null)).toBe("unproven");
    expect(normalizeOrigin("unknown")).toBe("unproven");
    expect(normalizeOrigin("household")).toBe("household");
    expect(normalizeOrigin("synthetic")).toBe("synthetic");
  });

  it("excludes unknown and unproven rows from taste learning and the completed meal loop", () => {
    for (const origin of ["unproven", undefined, null, "unknown"]) {
      expect(tasteAndLoop(origin)).toEqual({
        meals_rated: 0,
        history: [],
        cml_complete: false,
        ops: false,
      });
    }
  });

  it("keeps a row that is explicitly marked household", () => {
    expect(tasteAndLoop("household")).toEqual({
      meals_rated: 1,
      history: ["p"],
      cml_complete: true,
      ops: true,
    });
  });

  it("keeps a row that is explicitly marked synthetic out of learning and the loop", () => {
    expect(tasteAndLoop("synthetic")).toEqual({
      meals_rated: 0,
      history: [],
      cml_complete: false,
      ops: false,
    });
  });
});
