import { describe, expect, it } from "vitest";
import { classifyDiscoveryBypass } from "../src/weave/bypass.js";
import { applyPlanningDelta } from "../src/weave/state.js";
import { reconcileAcknowledgement } from "../src/weave/ack.js";
import { cueScoreForMeal } from "../src/weave/cues.js";

describe("D-06 weave", () => {
  it("bypasses simple Find terms", () => {
    expect(classifyDiscoveryBypass("salmon").bypass).toBe(true);
    expect(classifyDiscoveryBypass("something cozy").bypass).toBe(false);
    expect(classifyDiscoveryBypass("easy fish").bypass).toBe(false);
  });

  it("applies fish twice frequency", () => {
    const { state } = applyPlanningDelta(null, {
      acknowledgement: "Fish twice.",
      clear: [],
      dinner_count: 4,
      date_start: null,
      date_end: null,
      keep_it_easy: null,
      keep_ingredients_simple: null,
      max_minutes: null,
      max_minutes_hard: null,
      effort: null,
      ingredient_complexity: null,
      ingredient_complexity_hard: null,
      special_count: null,
      list_ops: [],
      frequency_ops: [{ op: "set", token: "fish", min_count: 2, max_count: 2 }],
      slot_ops: [],
    }, { today: "2026-10-10", vocabulary: { plan_tokens: ["fish"] } });
    expect(state.frequencies[0]).toMatchObject({ token: "fish", min_count: 2, max_count: 2 });
  });

  it("reconciles acknowledgement on conflict", () => {
    const ack = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "Shrimp tonight!",
      state: { dinner_count: 3 },
      conflicts: [{ token: "shrimp", alternative: { kind: "category", token: "fish" } }],
      dropped: [],
      removedTokens: ["shrimp"],
    });
    expect(ack.acknowledgement_source).toBe("reconciled");
    expect(ack.acknowledgement).toMatch(/seafood dinner/);
  });

  it("scores intent cues deterministically", () => {
    const score = cueScoreForMeal(
      { vocabulary_tag_ids: ["rich", "savory"], effort_level: "easy", total_minutes: 25, exploration: 0.2 },
      ["cozy", "weeknight"]
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(0.4);
  });
});
