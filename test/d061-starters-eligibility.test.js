/**
 * D-06.1 §4.1.8 — each surviving starter has ≥3 catalog-eligible dinners per limit set.
 */
import { describe, expect, it } from "vitest";
import { runDiscoveryPipeline } from "../src/discovery/pipeline.js";
import { projectDiscoveryMeal } from "../src/discovery/meal.js";
import { discoveryStateToQuery } from "../src/weave/discovery-map.js";
import { constraintRowsFromKeys } from "../src/lib/eligibility.js";
import { assessMealEligibility, featuresOf, matchesRequest, plannerCatalog } from "../src/lib/dinner-planner.js";
import { cueScoreForMeal } from "../src/weave/cues.js";
import { householdSafeStarterPrompts, semanticScoreForMeal } from "../src/weave/semantics.js";

const PARTICIPANT = ["m1"];

const LIMIT_SETS = [
  { name: "clear", limits: [] },
  { name: "shellfish-free", limits: ["no_shellfish"] },
  { name: "no-fish", limits: ["no_finfish"] },
];

function limitIdsToConstraintRows(limitIds) {
  const keys = [];
  for (const id of limitIds || []) {
    if (id === "no_finfish") keys.push("fish");
    else if (id === "no_shellfish") keys.push("shellfish");
    else if (id === "no_meat") keys.push("meat");
    else if (id === "no_poultry") keys.push("poultry");
    else if (id === "no_dairy") keys.push("dairy");
    else if (id === "no_nuts") keys.push("nuts");
  }
  return constraintRowsFromKeys(keys).map((row) => ({ ...row, member_id: PARTICIPANT[0] }));
}

function eligibleFeatures(constraints) {
  return plannerCatalog()
    .map(featuresOf)
    .filter((feature) => assessMealEligibility(feature.entry, PARTICIPANT, constraints, []).eligible);
}

function discoveryCountForState(state, constraints) {
  const mapped = discoveryStateToQuery(state, { limit: 50 });
  if (!mapped.ok) return 0;
  const meals = plannerCatalog().map(projectDiscoveryMeal);
  const context = {
    mode: "standalone",
    household_id: "hh_test",
    member_ids: PARTICIPANT,
    constraints,
    tastes: [],
    recent_slugs: [],
    recent_source: null,
    soft: {},
    soft_source: null,
  };
  const ran = runDiscoveryPipeline(meals, mapped.query, context);
  return ran.total;
}

function countForStarter(starterId, constraints) {
  const eligible = eligibleFeatures(constraints);
  switch (starterId) {
    case "plan_three_easy":
    case "plan_weeknight":
      return eligible.filter(
        (f) => f.effort_level === "easy" || (typeof f.minutes === "number" && f.minutes <= 35)
      ).length;
    case "plan_fish_twice":
      return eligible.filter((f) => (f.protein_groups || []).includes("fish")).length;
    case "plan_lighter":
      return eligible.filter((f) => semanticScoreForMeal(f, ["vegetable_forward", "fewer_fried"]) > 0).length;
    case "find_cozy":
      return eligible.filter((f) => cueScoreForMeal(f, ["cozy"], {}) > 0.05).length;
    case "find_fresh":
      return eligible.filter((f) => cueScoreForMeal(f, ["fresh"], {}) > 0.05).length;
    case "find_lighter":
      return eligible.filter((f) => cueScoreForMeal(f, ["light"], {}) > 0.05).length;
    case "find_shrimp":
      return eligible.filter((f) =>
        (f.protein_groups || []).some((g) => g === "shellfish" || g === "fish" || g === "seafood") ||
        matchesRequest(f, "shrimp")
      ).length;
    default:
      return discoveryCountForState({ intent_cues: [] }, constraints);
  }
}

describe("D-06.1 starter catalog eligibility", () => {
  for (const set of LIMIT_SETS) {
    it(`≥3 eligible dinners per starter for ${set.name} limits`, () => {
      const constraints = limitIdsToConstraintRows(set.limits);
      const starters = householdSafeStarterPrompts({ limits: set.limits });
      expect(starters.length).toBeGreaterThan(0);
      for (const starter of starters) {
        const count = countForStarter(starter.id, constraints);
        expect(count, `${starter.id} on ${set.name}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
