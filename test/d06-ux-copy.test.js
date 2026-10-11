/**
 * Consumer copy for Weave replies and chips: whole sentences, food words, no filter notation.
 */
import { describe, expect, it } from "vitest";
import {
  buildDiscoveryChips,
  buildPlanningChips,
  noResultsAcknowledgement,
  reconcileAcknowledgement,
  withRelaxation,
} from "../src/weave/ack.js";

const PLAN = { slots: [], frequencies: [], intent_cues: [], exclude_ingredients: [], exclude_categories: [], include_ingredients: [], cuisines: [], meal_styles: [] };
const FIND = { flavors: [], protein_groups: [], ingredients: [], cuisines: [], exclude_ingredients: [], intent_cues: [], meal_styles: [] };
const NOTATION = /[·×≥≤]|\bI\b/;
const HEALTH = /\b(health(y|ier|iest)?|nutri\w*|balanced|clean|wholesome|guilt[- ]free|good for you|lean|calori\w*|low[- ](fat|carb|cal)\w*|superfood|detox|diet[- ]friendly)\b/i;

function plan(state, extra = {}) {
  return reconcileAcknowledgement({ task: "planning_intent", modelAck: "4 dinners", state: { ...PLAN, ...state }, conflicts: [], dropped: [], removedTokens: [], userText: "", ...extra }).acknowledgement;
}

function find(state, extra = {}) {
  return reconcileAcknowledgement({ task: "discovery_intent", modelAck: "Got it.", state: { ...FIND, ...state }, conflicts: [], dropped: [], removedTokens: [], userText: "", ...extra }).acknowledgement;
}

describe("Weave reply copy", () => {
  it("restates a plan as one sentence", () => {
    const text = plan({ dinner_count: 3, keep_it_easy: true, frequencies: [{ token: "fish", min_count: 2, max_count: 2 }], slots: [{ weekday: "friday", special: true }] });
    expect(text).toBe("Got it — three dinners, mostly easy, fish twice, with something special on Friday.");
  });

  it("uses weeknight-friendly wording for the soft weeknight cue", () => {
    const slots = [1, 2, 3].map((position) => ({ position, intent_cue: position === 3 ? "cozy" : "weeknight" }));
    expect(plan({ dinner_count: 3, slots })).toBe("Got it — three dinners: two weeknight-friendly and one cozy.");
    expect(plan({ dinner_count: 3, intent_cues: ["weeknight"] })).toBe("Got it — three weeknight dinners.");
  });

  it("says what still stands after a hard limit, in its own sentence", () => {
    const text = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "4 dinners",
      state: { ...PLAN, dinner_count: 4, intent_cues: ["special"] },
      conflicts: [{ token: "shrimp", field: "exclude_ingredients", code: "hard_limit" }],
      dropped: [],
      removedTokens: ["shrimp"],
      userText: "shrimp, something special",
    }).acknowledgement;
    expect(text).toBe("Shellfish doesn't work for everyone at your table, so we left it out — still one special night.");
  });

  it("describes a find request as food, not filters", () => {
    expect(find({ intent_cues: ["cozy", "light"], quick: true, exclude_ingredients: ["mushrooms"] })).toBe("Something cozy, not too heavy and quick — no mushrooms.");
    expect(find({ cuisines: ["korean"], flavors: ["spicy"], ingredients: ["tofu"] })).toBe("Something Korean and spicy with tofu.");
    expect(find({ protein_groups: ["fish"] }, { modelAck: "Fresh and easy, with fish.", userText: "something zesty" })).toBe("Zesty, fresh and easy, with fish.");
  });

  it("keeps a model sentence but not a bare fragment", () => {
    expect(plan({ dinner_count: 3 }, { modelAck: "Got it — three easy dinners." })).toBe("Got it — three easy dinners.");
    expect(plan({ dinner_count: 4, intent_cues: ["cozy"] }, { modelAck: "4 dinners" })).toBe("Got it — four cozy dinners.");
  });

  it("never uses health claims in consumer copy", () => {
    const samples = [
      plan({ dinner_count: 3, intent_cues: ["light"], semantic_rank: ["vegetable_forward"] }),
      find({ intent_cues: ["light"], semantic_rank: ["vegetable_forward"] }),
      buildPlanningChips({ ...PLAN, dinner_count: 3, intent_cues: ["light"], semantic_rank: ["vegetable_forward"] }).map((c) => c.label).join(" "),
    ];
    for (const text of samples) expect(String(text)).not.toMatch(HEALTH);
  });

  it("never uses filter notation or a first-person voice", () => {
    const samples = [
      plan({ dinner_count: 4, frequencies: [{ token: "pasta", min_count: null, max_count: 1 }, { token: "fish", min_count: 2, max_count: null }] }),
      plan({ dinner_count: 3, keep_it_easy: true }, { dinnerCountDefaulted: true }),
      find({ meal_styles: ["tacos"], quick: true, protein_groups: ["fish"] }),
      withRelaxation("Shellfish doesn't work for everyone at your table, so we looked for fish instead.", { relaxed: "the time limit", dish: "tacos" }),
      noResultsAcknowledgement([{ token: "shrimp" }]),
    ];
    for (const text of samples) {
      expect(text).not.toMatch(NOTATION);
      expect(text.length).toBeLessThanOrEqual(120);
    }
  });
});

describe("Weave chip labels", () => {
  it("reads like the decision card", () => {
    const labels = buildPlanningChips({
      ...PLAN,
      dinner_count: 3,
      keep_it_easy: true,
      frequencies: [{ token: "fish", min_count: 2, max_count: 2 }, { token: "pasta", min_count: null, max_count: 1 }],
      intent_cues: ["weeknight"],
      slots: [{ weekday: "friday", special: true }, { weekday: "tuesday", effort: "easy" }],
    }).map((chip) => chip.label);
    expect(labels).toEqual(["3 dinners", "Keep it easy", "Fish twice", "Pasta once at most", "Weeknight-friendly", "Fri: special", "Tue: easy"]);
    expect(buildDiscoveryChips({ ...FIND, effort_levels: ["easy"], quick: true }).map((chip) => chip.label)).toEqual(["Quick", "Easy"]);
  });
});
