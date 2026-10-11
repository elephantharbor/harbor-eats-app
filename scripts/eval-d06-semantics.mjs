#!/usr/bin/env node
/**
 * Local D-06.1 usefulness eval. Fake provider only. No network and no OpenAI.
 * Applies each corpus delta, then scores non-empty, direction, eligibility, and ack.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createFakeProvider, createGenerationService, createMemoryStore } from "../src/ai/index.js";
import { discoveryMeal } from "../src/discovery/meal.js";
import { runDiscoveryPipeline } from "../src/discovery/pipeline.js";
import { detectDiscoveryConflicts } from "../src/weave/conflicts.js";
import { discoveryStateToQuery } from "../src/weave/discovery-map.js";
import { buildSemanticTelemetry, usefulnessForCase } from "../src/weave/semantics.js";
import { applyDiscoveryDelta, applyPlanningDelta } from "../src/weave/state.js";
import { buildWeaveVocabulary } from "../src/weave/vocabulary.js";

const corpus = JSON.parse(readFileSync(new URL("../test/fixtures/d06-intent-corpus.json", import.meta.url), "utf8"));
const vocabulary = buildWeaveVocabulary();
const env = {
  AI_GATEWAY_ENABLED: "1",
  AI_TASKS_ENABLED: "planning_intent,discovery_intent",
  AI_DAILY_BUDGET_USD: "5",
};

function fixtureMeals() {
  return [
    discoveryMeal({
      recipe_slug: "roasted-veg",
      title: "Roasted Vegetables",
      effort_level: "easy",
      ingredient_complexity: "simple",
      total_minutes: 30,
      dietary_labels: ["plant", "vegetarian"],
      steps: ["Roast until the edges are crispy."],
      description: "Oven roasted vegetables.",
    }),
    discoveryMeal({
      recipe_slug: "baked-salmon",
      title: "Baked Salmon",
      effort_level: "easy",
      ingredient_complexity: "simple",
      total_minutes: 25,
      eligibility_tags: ["finfish", "fish"],
      steps: ["Bake until the salmon flakes."],
    }),
    discoveryMeal({
      recipe_slug: "pan-fish",
      title: "Weeknight Fish",
      effort_level: "easy",
      ingredient_complexity: "simple",
      total_minutes: 20,
      eligibility_tags: ["finfish", "fish"],
      steps: ["Pan-fry the fillets in a little oil."],
    }),
    discoveryMeal({
      recipe_slug: "air-tofu",
      title: "Air-Fryer Tofu",
      effort_level: "easy",
      ingredient_complexity: "simple",
      total_minutes: 25,
      dietary_labels: ["plant"],
      methods: ["air_fry"],
      steps: ["Air-fry until crisp."],
    }),
  ];
}

function resultCount(task, state) {
  if (task === "planning_intent") return state.dinner_count || 3;
  const mapped = discoveryStateToQuery(state);
  if (!mapped.ok) return 0;
  const page = runDiscoveryPipeline(fixtureMeals(), mapped.query, {
    mode: "standalone",
    participant_ids: ["m1"],
    exclude_slugs: [],
    plan_slugs: [],
    recent_slugs: [],
    constraints: [],
    tastes: [],
    soft: mapped.query.soft || { keep_it_easy: false, keep_ingredients_simple: false },
  }, { isEligible: () => ({ eligible: true }) });
  return page.total;
}

const meals = fixtureMeals();
const rows = [];
let providerCalls = 0;

for (const entry of corpus.cases) {
  if (!entry.usefulness && !entry.expect?.usefulness) continue;
  const store = createMemoryStore();
  const provider = createFakeProvider({ script: [{ json: entry.delta }] });
  const service = createGenerationService({ provider, store, env, now: () => new Date("2026-10-10T15:00:00.000Z") });
  const gen = await service.run(entry.task, {
    text: entry.text,
    state: entry.state || null,
    context: { today: "2026-10-10", ...(entry.context || {}) },
    vocabulary,
  }, { householdId: "hh_eval" });
  providerCalls += provider.calls.length;
  if (!gen.ok) {
    rows.push({ id: entry.id, ok: false, error: gen.error || "provider_failed" });
    continue;
  }
  const ctx = {
    today: "2026-10-10",
    vocabulary,
    user_text: entry.apply_text ? entry.text : undefined,
    ...(entry.context || {}),
  };
  const applied = entry.task === "planning_intent"
    ? applyPlanningDelta(entry.state || null, gen.output, ctx)
    : applyDiscoveryDelta(entry.state || null, gen.output, ctx);
  let state = applied.state;
  let conflicts = [];
  if (entry.household === "shellfish") {
    const pass = detectDiscoveryConflicts(state, {
      participantIds: ["a"],
      constraints: [{ member_id: "a", rule_key: "shellfish", status: "prohibited" }],
      tastes: [],
      userText: entry.text,
    });
    state = pass.repaired;
    conflicts = pass.conflicts;
  }
  const acknowledgement = conflicts.length ? "" : (applied.semantic?.primary_ack || gen.output.acknowledgement || "");
  const count = resultCount(entry.task, state);
  const usefulness = usefulnessForCase(entry, {
    state,
    result_count: count,
    acknowledgement,
    eligibility_relaxed: false,
  });
  const telemetry = buildSemanticTelemetry({
    task: entry.task,
    semantic: applied.semantic,
    source: "provider",
    resultCount: count,
    zeroReason: count === 0 ? "unknown" : null,
    downstreamSuccess: usefulness.scored && usefulness.non_empty && usefulness.direction_alignment && usefulness.eligibility_kept && usefulness.ack_matches,
  });
  rows.push({
    id: entry.id,
    ok: true,
    usefulness,
    telemetry,
    state: {
      dinner_count: state.dinner_count ?? null,
      intent_cues: state.intent_cues || [],
      semantic_rank: state.semantic_rank || [],
      exclude_cooking: state.exclude_cooking || [],
      ingredients: state.ingredients || [],
      include_ingredients: state.include_ingredients || [],
      protein_groups: state.protein_groups || [],
      frequencies: state.frequencies || [],
      text_residue: state.text_residue ?? null,
      keep_it_easy: state.keep_it_easy ?? null,
      keep_ingredients_simple: state.keep_ingredients_simple ?? null,
    },
    acknowledgement,
    result_count: count,
    fixture_meals: meals.length,
  });
}

const scored = rows.filter((row) => row.ok && row.usefulness?.scored);
const summary = {
  provider: "fake",
  cases: rows.length,
  provider_calls: providerCalls,
  scored: scored.length,
  non_empty: scored.filter((row) => row.usefulness.non_empty).length,
  direction_alignment: scored.filter((row) => row.usefulness.direction_alignment).length,
  eligibility_kept: scored.filter((row) => row.usefulness.eligibility_kept).length,
  ack_matches: scored.filter((row) => row.usefulness.ack_matches).length,
  failed: rows.filter((row) => !row.ok || !row.usefulness?.non_empty || !row.usefulness?.direction_alignment || !row.usefulness?.eligibility_kept || !row.usefulness?.ack_matches).map((row) => row.id),
};

const report = { summary, rows };
writeFileSync("/tmp/d061-usefulness.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (summary.failed.length) {
  console.error(`usefulness misses: ${summary.failed.join(", ")}`);
  process.exitCode = 1;
}
