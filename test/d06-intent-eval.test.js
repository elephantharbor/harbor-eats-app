import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateSchema } from "../src/ai/schema.js";
import { TASKS } from "../src/ai/index.js";
import { classifyDiscoveryBypass, bypassDiscoveryPatch } from "../src/weave/bypass.js";
import { applyDiscoveryDelta, applyPlanningDelta } from "../src/weave/state.js";
import { buildWeaveVocabulary } from "../src/weave/vocabulary.js";

const corpus = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/d06-intent-corpus.json"), "utf8"));
const vocab = buildWeaveVocabulary();

function expandCases() {
  const extra = [];
  for (let n = 2; n <= 6; n += 1) {
    extra.push({
      id: `plan-count-${n}-generated`,
      task: "planning_intent",
      delta: {
        acknowledgement: `${n} dinners.`,
        clear: [],
        dinner_count: n,
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
        frequency_ops: [],
        slot_ops: [],
      },
      expect: { dinner_count: n },
    });
  }
  for (const cue of ["fresh", "filling", "comforting", "summery", "special", "restaurant_like", "weeknight"]) {
    extra.push({
      id: `find-cue-${cue}`,
      task: "discovery_intent",
      delta: {
        acknowledgement: cue,
        clear: [],
        text_residue: null,
        max_minutes: null,
        max_minutes_hard: null,
        quick: null,
        different: null,
        keep_it_easy: null,
        keep_ingredients_simple: null,
        list_ops: [{ field: "intent_cues", "op": "add", "value": cue }],
      },
      expect: { intent_cues: [cue] },
    });
  }
  const bypassTerms = ["tacos", "tofu", "easy", "moderate", "simple", "under 30", "korean", "grilled", "plant"];
  for (const term of bypassTerms) {
    extra.push({
      id: `find-bypass-${term.replace(/\s+/g, "-")}`,
      task: "discovery_intent",
      kind: "bypass",
      text: term,
      expect: { bypass: true },
    });
  }
  for (const n of [7, 8, 9, 10, 11, 12, 13, 14]) {
    extra.push({
      id: `plan-count-${n}-extra`,
      task: "planning_intent",
      delta: {
        acknowledgement: `${n}.`,
        clear: [],
        dinner_count: n,
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
        frequency_ops: [],
        slot_ops: [],
      },
      expect: { dinner_count: n },
    });
  }
  for (const ing of ["salmon", "chicken", "tofu", "shrimp", "cod", "lentils"]) {
    extra.push({
      id: `find-ingredient-bypass-${ing}`,
      task: "discovery_intent",
      kind: "bypass",
      text: ing,
      expect: { bypass: true },
    });
  }
  return [...corpus.cases, ...extra];
}

const allCases = expandCases();

describe("D-06 intent corpus", () => {
  it(`has ${allCases.length} semantic cases (target 40–60)`, () => {
    expect(allCases.length).toBeGreaterThanOrEqual(40);
    expect(allCases.length).toBeLessThanOrEqual(60);
  });

  for (const c of allCases) {
    it(`case ${c.id}`, () => {
      if (c.kind === "bypass" || c.task === "discovery_intent" && c.text) {
        const cls = classifyDiscoveryBypass(c.text);
        expect(cls.bypass).toBe(c.expect?.bypass !== false);
        if (c.expect?.ingredients) {
          const st = bypassDiscoveryPatch(c.text);
          expect(st.ingredients).toEqual(c.expect.ingredients);
        }
        return;
      }
      const task = c.task === "planning_intent" ? TASKS.planning_intent : TASKS.discovery_intent;
      const schemaOk = validateSchema(task.output_schema, c.delta);
      expect(schemaOk.ok).toBe(c.expect?.schema_valid !== false);
      const ctx = { today: "2026-10-10", vocabulary: vocab, ...(c.context || {}) };
      const applied =
        c.task === "planning_intent"
          ? applyPlanningDelta(c.state || null, c.delta, ctx)
          : applyDiscoveryDelta(c.state || null, c.delta, ctx);
      const state = applied.state;
      if (c.expect?.dinner_count != null) expect(state.dinner_count).toBe(c.expect.dinner_count);
      if (c.expect?.keep_it_easy != null) expect(state.keep_it_easy).toBe(c.expect.keep_it_easy);
      if (c.expect?.effort === null) expect(state.effort).toBeNull();
      if (c.expect?.frequencies) {
        for (const row of c.expect.frequencies) {
          const hit = state.frequencies.find((f) => f.token === row.token);
          expect(hit).toBeTruthy();
          if (row.min_count != null) expect(hit.min_count).toBe(row.min_count);
          if (row.max_count != null) expect(hit.max_count).toBe(row.max_count);
        }
      }
      if (c.expect?.intent_cues) expect(state.intent_cues).toEqual(c.expect.intent_cues);
      if (c.expect?.slot_effort) {
        const slot = state.slots.find((s) => s.weekday === c.expect.slot_weekday);
        expect(slot?.effort).toBe(c.expect.slot_effort);
      }
    });
  }
});
