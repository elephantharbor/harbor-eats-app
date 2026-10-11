/**
 * D-06.1 shared semantics: cooking method, safety, composition, unknown adjectives,
 * and the backend contracts the UI will call.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { validateSchema } from "../src/ai/schema.js";
import { TASKS } from "../src/ai/tasks.js";
import { discoveryMeal } from "../src/discovery/meal.js";
import { runDiscoveryPipeline } from "../src/discovery/pipeline.js";
import { assessMealEligibility } from "../src/lib/dinner-planner.js";
import { createMemberSession } from "../src/lib/session.js";
import { detectDiscoveryConflicts } from "../src/weave/conflicts.js";
import { discoveryStateToQuery } from "../src/weave/discovery-map.js";
import { routeWeaveRequest } from "../src/weave/routes.js";
import {
  applySharedSemantics,
  explicitFryAvoidance,
  ambiguousTarget,
  applyDinnerCount,
  broadenDiscoveryState,
  buildSemanticTelemetry,
  canBroadenZero,
  classifyZeroResult,
  deriveCatalogCookingMethods,
  deriveCookingMethod,
  excludedByFrying,
  householdSafeStarterPrompts,
  normalizeModelConcepts,
} from "../src/weave/semantics.js";
import { applyDiscoveryDelta, applyPlanningDelta, emptyDiscoveryState, emptyPlanningState } from "../src/weave/state.js";
import { buildWeaveVocabulary } from "../src/weave/vocabulary.js";

const CATALOG = join(process.cwd(), "catalog");

function loadPackage(slug) {
  return JSON.parse(readFileSync(join(CATALOG, slug, "v1.json"), "utf8"));
}

function cookingOf(slug) {
  return deriveCatalogCookingMethods([loadPackage(slug)])[0];
}

function discoveryDelta(extra = {}) {
  return {
    acknowledgement: "",
    clear: [],
    text_residue: null,
    max_minutes: null,
    max_minutes_hard: null,
    quick: null,
    different: null,
    keep_it_easy: null,
    keep_ingredients_simple: null,
    list_ops: [],
    concepts: [],
    ...extra,
  };
}

function planningDelta(extra = {}) {
  return {
    acknowledgement: "",
    clear: [],
    dinner_count: null,
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
    concepts: [],
    ...extra,
  };
}

function hardSnapshot(state) {
  return {
    ingredients: [...(state.ingredients || [])],
    include_ingredients: [...(state.include_ingredients || [])],
    protein_groups: [...(state.protein_groups || [])],
    diet: [...(state.diet || [])],
    exclude_cooking: [...(state.exclude_cooking || [])],
    exclude_ingredients: [...(state.exclude_ingredients || [])],
    frequencies: JSON.parse(JSON.stringify(state.frequencies || [])),
    effort: state.effort ?? null,
    quick: state.quick ?? null,
  };
}

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
      protein_groups: ["fish"],
      steps: ["Bake until the salmon flakes."],
    }),
    discoveryMeal({
      recipe_slug: "pan-fish",
      title: "Weeknight Fish",
      effort_level: "easy",
      ingredient_complexity: "simple",
      total_minutes: 20,
      protein_groups: ["fish"],
      steps: ["Pan-fry the fillets in a little oil."],
    }),
  ];
}

function runFind(state) {
  const mapped = discoveryStateToQuery(state);
  expect(mapped.ok).toBe(true);
  return runDiscoveryPipeline(fixtureMeals(), mapped.query, {
    mode: "standalone",
    participant_ids: ["m1"],
    exclude_slugs: [],
    plan_slugs: [],
    recent_slugs: [],
    constraints: [],
    tastes: [],
    soft: mapped.query.soft || { keep_it_easy: false, keep_ingredients_simple: false },
  }, {
    isEligible: () => ({ eligible: true }),
  });
}

describe("cooking method", () => {
  it("derives frying from instructions and metadata, and leaves baked or air-fried crispy alone", () => {
    const tofu = cookingOf("crispy-chipotle-tofu-tacos");
    expect(tofu.cooking.frying).toEqual([]);
    expect(tofu.cooking.crispy_non_fry).toContain("air_fried");
    const titledTofu = deriveCookingMethod({ title: "Crispy Chipotle Tofu Tacos", methods: [], description: "", steps: [] });
    expect(titledTofu.frying).toEqual([]);
    expect(titledTofu.crispy_non_fry.length).toBeGreaterThan(0);
    const gnocchi = deriveCookingMethod({
      title: "Sheet-Pan Crispy Gnocchi with Brussels Sprouts and Apples",
      description: "Gnocchi roasted until golden.",
      methods: [],
      steps: [],
    });
    expect(gnocchi.frying).toEqual([]);
    expect(gnocchi.crispy_non_fry.length).toBeGreaterThan(0);
    expect(excludedByFrying({ cooking: tofu.cooking }, ["deep", "pan", "shallow"])).toBe(false);

    const fishTacos = cookingOf("crispy-fish-tacos-cabbage-slaw");
    expect(fishTacos.cooking.frying).toContain("pan");
    expect(excludedByFrying({ cooking: fishTacos.cooking }, ["deep", "pan", "shallow"])).toBe(true);

    const kimchi = cookingOf("kimchi-fried-rice");
    expect(kimchi.cooking.stir_fry).toBe(true);
    expect(kimchi.cooking.frying).toEqual([]);
    expect(kimchi.cooking.source).toBe("metadata");
    expect(excludedByFrying({ cooking: kimchi.cooking }, ["deep", "pan", "shallow"])).toBe(false);

    const cakes = cookingOf("thai-fish-cakes-cucumber-relish");
    expect(cakes.cooking.frying).toEqual(expect.arrayContaining(["pan", "shallow"]));
    expect(cakes.cooking.frying).not.toContain("deep");
    expect(excludedByFrying({ cooking: cakes.cooking }, ["deep"])).toBe(false);
    expect(excludedByFrying({ cooking: cakes.cooking }, ["deep", "pan", "shallow"])).toBe(true);

    const carrots = cookingOf("harissa-roasted-carrots-feta");
    expect(carrots.cooking.frying).toEqual([]);
    expect(excludedByFrying({ cooking: carrots.cooking }, ["deep", "pan", "shallow"])).toBe(false);
  });

  it("uses a title only when metadata and instructions do not already classify", () => {
    const titled = deriveCookingMethod({ title: "Pan-Fried Fish", methods: [], steps: [], description: "" });
    expect(titled.source).toBe("title");
    expect(titled.frying).toEqual(["pan"]);
    expect(excludedByFrying({ cooking: titled }, ["deep", "pan", "shallow"])).toBe(true);
    expect(excludedByFrying({ cooking: titled }, ["deep"])).toBe(false);

    const air = deriveCookingMethod({ title: "Air-Fryer Salmon", methods: [], steps: ["Roast until done."], description: "" });
    expect(air.frying).toEqual([]);
    expect(air.crispy_non_fry).toContain("air_fried");
    expect(excludedByFrying({ cooking: air }, ["deep", "pan", "shallow"])).toBe(false);

    const baked = deriveCookingMethod({
      title: "Crispy Potatoes",
      methods: [],
      steps: ["Bake until the edges are crispy."],
      description: "Oven potatoes.",
    });
    expect(baked.source).toBe("metadata");
    expect(baked.frying).toEqual([]);
    expect(baked.crispy_non_fry.length).toBeGreaterThan(0);
    expect(excludedByFrying({ cooking: baked }, ["deep", "pan", "shallow"])).toBe(false);

    const deep = deriveCookingMethod({ title: "Deep-Fried Calamari", methods: [], description: "", steps: [] });
    expect(deep.frying).toEqual(["deep"]);

    const stir = deriveCookingMethod({
      title: "Kimchi Fried Rice",
      description: "Rice stir-fried with kimchi.",
      steps: ["No fried egg on top."],
      methods: [],
    });
    expect(stir.frying).toEqual([]);
    expect(stir.stir_fry).toBe(true);
  });
});

describe("unknown concepts and broadening", () => {
  it("drops an unknown model concept and never stores the raw word", () => {
    const normalized = normalizeModelConcepts([
      { id: "snorfblat", polarity: "prefer" },
      { id: "healthy", polarity: "prefer" },
    ]);
    expect(normalized.unsupported_soft_count).toBe(1);
    expect(normalized.applied.map((row) => row.id)).toEqual(["healthy"]);
    expect(JSON.stringify(normalized)).not.toContain("snorfblat");
    const schema = validateSchema(TASKS.discovery_intent.output_schema, discoveryDelta({
      concepts: [{ id: "snorfblat", polarity: "prefer" }],
    }));
    expect(schema.ok).toBe(true);
  });

  it("broadens an unknown adjective and drops residue that is not a catalog term", () => {
    const applied = applyDiscoveryDelta(null, discoveryDelta({
      text_residue: "snorfblat",
      concepts: [{ id: "snorfblat", polarity: "prefer" }],
    }), { user_text: "Something snorfblat" });
    expect(applied.semantic.unsupported_soft_count).toBeGreaterThan(0);
    expect(applied.semantic.broadening).toBe(true);
    expect(applied.state.text_residue).toBeNull();
    expect(JSON.stringify(applied.state)).not.toContain("snorfblat");
    expect(applied.state.ingredients).toEqual([]);
    expect(applied.state.exclude_cooking).toEqual([]);

    const page = runFind(applied.state);
    expect(page.total).toBeGreaterThan(0);

    const noun = applyDiscoveryDelta(null, discoveryDelta({ text_residue: "xylophone" }), { user_text: "xylophone" });
    expect(noun.state.text_residue).toBeNull();
    expect(noun.semantic.unsupported_soft_count).toBeGreaterThan(0);
    expect(noun.semantic.broadening).toBe(true);
    const salmon = applyDiscoveryDelta(null, discoveryDelta({ text_residue: "salmon" }), { user_text: "salmon" });
    expect(salmon.state.text_residue).toBe("salmon");
  });
});

describe("safety", () => {
  it("does not let soft broadening touch eligibility or a shellfish request", () => {
    const asked = applyDiscoveryDelta(null, discoveryDelta({
      text_residue: "snorfblat",
      list_ops: [{ field: "ingredients", op: "add", value: "shrimp" }],
      concepts: [
        { id: "healthy", polarity: "prefer" },
        { id: "snorfblat", polarity: "prefer" },
      ],
    }), { user_text: "Something healthy with shrimp", vocabulary: buildWeaveVocabulary() });
    expect(asked.state.ingredients).toEqual(["shrimp"]);
    expect(asked.state.intent_cues).toEqual(["light"]);
    expect(asked.state.frequencies || []).toEqual([]);

    const pass = detectDiscoveryConflicts(asked.state, {
      participantIds: ["a"],
      constraints: [{ member_id: "a", rule_key: "shellfish", status: "prohibited" }],
      tastes: [],
      userText: "Something healthy with shrimp",
    });
    expect(pass.removed).toContain("shrimp");
    expect(pass.repaired.ingredients).not.toContain("shrimp");
    expect(pass.repaired.intent_cues).toEqual(["light"]);

    const repairedHard = hardSnapshot(pass.repaired);
    const broadened = broadenDiscoveryState(pass.repaired);
    expect(hardSnapshot(broadened.state)).toEqual(repairedHard);
    expect(broadened.state.intent_cues).toEqual(["light"]);
    expect(broadened.state.semantic_rank).toEqual(pass.repaired.semantic_rank);
    expect(JSON.stringify(broadened.state)).not.toContain("shrimp");
    expect(canBroadenZero({
      reason: "unsupported_soft_intent",
      state: asked.state,
      semantic: asked.semantic,
    })).toBe(false);

    const shellfishMeal = {
      concept: { title: "Shrimp Tacos", tags: ["shellfish", "shrimp"] },
      pkg: {
        title: "Shrimp Tacos",
        allergens: ["shellfish"],
        vocabulary_tag_ids: ["shellfish", "shrimp"],
        ingredients: [{ name: "shrimp", note: null }],
      },
    };
    const blocked = assessMealEligibility(shellfishMeal, ["a"], [
      { member_id: "a", rule_key: "shellfish", status: "prohibited" },
    ], []);
    expect(blocked.eligible).toBe(false);
    const scored = {
      ...shellfishMeal,
      protein_groups: ["shellfish"],
      dietary_labels: ["plant"],
      semantic_rank: asked.state.semantic_rank,
    };
    expect(assessMealEligibility(scored, ["a"], [
      { member_id: "a", rule_key: "shellfish", status: "prohibited" },
    ], []).eligible).toBe(false);
  });
});

describe("composition", () => {
  it("keeps fish twice hard when the week is also healthy", () => {
    const applied = applyPlanningDelta(null, planningDelta({
      dinner_count: 3,
      frequency_ops: [{ op: "set", token: "fish", min_count: 2, max_count: 2 }],
      concepts: [{ id: "healthy", polarity: "prefer" }],
    }), { user_text: "Three healthy dinners, fish twice" });
    const fish = applied.state.frequencies.find((row) => row.token === "fish");
    expect(fish).toMatchObject({ min_count: 2, max_count: 2 });
    expect(applied.state.dinner_count).toBe(3);
    expect(applied.state.intent_cues).toEqual(["light"]);
    expect(applied.state.semantic_rank).toEqual(["fewer_fried", "fish_forward", "vegetable_forward"]);
    expect(applied.semantic.primary_ack).toBe("Three lighter, veggie-forward dinners, with fish twice.");
    expect(applied.semantic.primary_ack).not.toMatch(/healthy/i);

    const softOnly = emptyPlanningState();
    applySharedSemantics(softOnly, { text: "Something healthy", concepts: [{ id: "healthy", polarity: "prefer" }], task: "planning_intent" });
    expect(softOnly.frequencies).toEqual([]);

    const widened = broadenDiscoveryState({
      ...emptyDiscoveryState(),
      text_residue: "snorfblat",
      frequencies: [{ token: "fish", min_count: 2, max_count: 2 }],
      exclude_cooking: ["deep", "pan", "shallow"],
    });
    expect(widened.state.frequencies).toEqual([{ token: "fish", min_count: 2, max_count: 2 }]);
    expect(widened.state.exclude_cooking).toEqual(["deep", "pan", "shallow"]);
  });
});

describe("zero results and telemetry", () => {
  it("classifies a zero page without storing the utterance", () => {
    expect(classifyZeroResult({
      total: 0,
      excluded: [{ code: "ineligible_hard_limit" }, { code: "ineligible_hard_limit" }],
      catalogSize: 2,
      state: emptyDiscoveryState(),
      semantic: {},
    })).toBe("hard_eligibility");
    expect(classifyZeroResult({
      total: 0,
      excluded: [{ code: "explicit_exclude_cooking" }],
      catalogSize: 3,
      state: { ...emptyDiscoveryState(), exclude_cooking: ["deep", "pan", "shallow"] },
      semantic: {},
    })).toBe("explicit_filters");
    expect(classifyZeroResult({
      total: 0,
      excluded: [{ code: "text_miss" }],
      catalogSize: 3,
      state: emptyDiscoveryState(),
      semantic: { unsupported_soft_count: 1 },
    })).toBe("unsupported_soft_intent");

    const telemetry = buildSemanticTelemetry({
      task: "discovery_intent",
      semantic: { canonical_intents: ["healthy", "snorfblat"], unsupported_soft_count: 1, broadening: true },
      source: "provider",
      resultCount: 4,
      zeroReason: null,
    });
    expect(telemetry).toEqual({
      task: "discovery_intent",
      canonical_intents: ["healthy"],
      unsupported_soft_count: 1,
      broadening: true,
      zero_result_reason: null,
      result_count_bucket: "4-12",
      route: "provider",
      downstream_success: null,
    });
    expect(JSON.stringify(telemetry)).not.toContain("snorfblat");
  });
});

describe("backend contracts", () => {
  it("returns candidate slots when the day is ambiguous and stays quiet when it is unique", () => {
    const weekend = ambiguousTarget({
      text: "Make the weekend special",
      dates: [
        { position: 6, date: "2026-10-17", weekday: "saturday" },
        { position: 7, date: "2026-10-18", weekday: "sunday" },
      ],
    });
    expect(weekend.reason).toBe("ambiguous_day");
    expect(weekend.prompt).toBe("Which dinner did you mean?");
    expect(weekend.candidates.map((row) => row.weekday)).toEqual(["saturday", "sunday"]);

    expect(ambiguousTarget({
      text: "Make Tuesday easier",
      dates: [{ position: 2, date: "2026-10-13", weekday: "tuesday" }],
    })).toBeNull();
    expect(ambiguousTarget({
      text: "Make Wednesday vegetarian",
      dinnerCount: 3,
      today: "2026-10-11",
    })).toBeNull();
  });

  it("changes a dinner count without inventing a concept", () => {
    const counted = applyDinnerCount(emptyPlanningState(), 4);
    expect(counted.ok).toBe(true);
    expect(counted.state.dinner_count).toBe(4);
    expect(applyDinnerCount(emptyPlanningState(), 0).error).toBe("dinner_count_invalid");
    expect(applyDinnerCount(emptyPlanningState(), 15).error).toBe("dinner_count_invalid");
  });

  it("hides fish and shrimp starters from a table that cannot have them", () => {
    const open = householdSafeStarterPrompts({ limits: [] }).map((row) => row.id);
    expect(open).toEqual([
      "plan_three_easy", "plan_fish_twice", "plan_lighter", "plan_special",
      "find_cozy", "find_fish", "find_lighter", "find_shrimp",
    ]);
    const shellfishFree = householdSafeStarterPrompts({ limits: ["no_shellfish"] }).map((row) => row.id);
    expect(shellfishFree).toContain("find_fish");
    expect(shellfishFree).toContain("find_lemony");
    expect(shellfishFree).not.toContain("find_shrimp");
    const closed = householdSafeStarterPrompts({ limits: ["no_shellfish", "no_finfish"] }).map((row) => row.id);
    expect(closed).not.toContain("plan_fish_twice");
    expect(closed).not.toContain("find_shrimp");
    expect(closed).not.toContain("find_fish");
    expect(closed).toContain("plan_two_veggie");
    expect(closed).toContain("find_tofu");
    expect(closed).toContain("find_lemony");
    expect(householdSafeStarterPrompts({ limits: [] }).find((row) => row.id === "find_shrimp").text).toBe("Garlicky shrimp");
  });
});

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return sqlite;
}

function asD1(sqlite) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              sqlite.prepare(sql).run(...params);
              return { success: true, meta: { changes: 1 } };
            },
            async first() {
              return sqlite.prepare(sql).get(...params) ?? null;
            },
            async all() {
              return { results: sqlite.prepare(sql).all(...params) };
            },
          };
        },
      };
    },
  };
}

describe("count and starter routes", () => {
  it("changes the count and lists starters with no provider call", async () => {
    const sqlite = migrate();
    sqlite.prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_d061', 'D061', 'active', 'America/Chicago', 2, 'synthetic_qa', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', 'synthetic')`
    ).run();
    sqlite.prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('m_a', 'hh_d061', 'A', 'owner', 'active', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run();
    sqlite.prepare(
      `INSERT INTO constraint_rule
        (constraint_id, household_id, member_id, rule_key, status, created_at, updated_at)
       VALUES ('cr_shell', 'hh_d061', 'm_a', 'shellfish', 'prohibited', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
    ).run();
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_d061", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ throw: { message: "provider should not run" } }] });
    const env = {
      DB: db,
      CATALOG_SOURCE: "d1",
      AI_PROVIDER: "fake",
      AI_FAKE_PROVIDER: provider,
      AI_GATEWAY_ENABLED: "1",
      AI_TASKS_ENABLED: "planning_intent,discovery_intent",
      AI_DAILY_BUDGET_USD: "5",
    };
    const countReq = new Request("https://example.test/api/plan/count", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.session_token}` },
      body: JSON.stringify({ schema_version: 1, dinner_count: 4, state: emptyPlanningState() }),
    });
    const counted = await routeWeaveRequest(env, countReq, "/api/plan/count");
    const countBody = await counted.json();
    expect(counted.status).toBe(200);
    expect(countBody.ok).toBe(true);
    expect(countBody.llm_called).toBe(false);
    expect(countBody.source).toBe("deterministic");
    expect(countBody.state.dinner_count).toBe(4);
    expect(countBody.telemetry.route).toBe("deterministic");
    expect(provider.calls).toHaveLength(0);

    const starterReq = new Request("https://example.test/api/weave/starters", {
      method: "GET",
      headers: { authorization: `Bearer ${session.session_token}` },
    });
    const starters = await routeWeaveRequest(env, starterReq, "/api/weave/starters");
    const starterBody = await starters.json();
    expect(starters.status).toBe(200);
    expect(starterBody.llm_called).toBe(false);
    expect(starterBody.starters.map((row) => row.id)).not.toContain("find_shrimp");
    expect(starterBody.starters.map((row) => row.id)).toContain("plan_fish_twice");
    expect(provider.calls).toHaveLength(0);
  });
});

describe("D-06.1 crispy + baked-not-fried (preview cycle 3 repro)", () => {
  it("'rather than fried' excludes every frying kind", () => {
    expect(explicitFryAvoidance("crispy, but baked rather than fried")).toBe("all");
    expect(explicitFryAvoidance("roasted instead of fried")).toBe("all");
  });
  it("a non-fry method in a crispy request ranks instead of hard-filtering", () => {
    const state = { ...emptyDiscoveryState(), methods: ["bake"], exclude_cooking: ["deep"] };
    applySharedSemantics(state, { text: "crispy, but baked rather than fried", concepts: [{ id: "deep_fried", polarity: "avoid" }], task: "discovery_intent" });
    expect(state.methods).toEqual([]);
    expect([...state.exclude_cooking].sort()).toEqual(["deep", "pan", "shallow"]);
    expect(state.semantic_rank).toContain("crispy_non_fry");
  });
  it("a plain method request without crispy is untouched", () => {
    const state = { ...emptyDiscoveryState(), methods: ["bake"] };
    applySharedSemantics(state, { text: "something baked", concepts: [], task: "discovery_intent" });
    expect(state.methods).toEqual(["bake"]);
  });
});
