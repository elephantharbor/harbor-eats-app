/**
 * D-06 weave routes: interpret, deterministic apply, plan commit.
 */
import { createD1Store, createGenerationService, resolveProvider } from "../ai/index.js";
import { catalogReadsFromD1, loadPublishedCatalog } from "../lib/catalog-runtime.js";
import {
  householdConstraints,
  householdMemberIds,
  householdTastes,
  loadDinnerPlan,
} from "../lib/dinner-plan-store.js";
import { assertParticipants, presentDinnerPlan } from "../lib/plan-contract.js";
import { planDinners } from "../lib/dinner-planner.js";
import { requireSession } from "../lib/auth.js";
import { DISCOVERY_SCHEMA_VERSION } from "../discovery/constants.js";
import { canonicalQuery, normalizeQuery } from "../discovery/query.js";
import { projectDiscoveryMeal } from "../discovery/meal.js";
import { runDiscoveryPipeline } from "../discovery/pipeline.js";
import { resolveDiscoveryContext, selectionFor, publicContext, normalizeClientContext } from "../discovery/context.js";
import { loadDiscoveryRecentSlugs } from "../discovery/http.js";
import { buildPlanningChips, buildDiscoveryChips, reconcileAcknowledgement } from "./ack.js";
import { classifyDiscoveryBypass, bypassDiscoveryPatch, normalizeFindText } from "./bypass.js";
import { detectDiscoveryConflicts, detectPlanningConflicts } from "./conflicts.js";
import { discoveryStateToQuery } from "./discovery-map.js";
import { parsePlannerFromState } from "./plan-map.js";
import {
  applyDiscoveryDelta,
  applyPlanningDelta,
  emptyPlanningState,
  isEmptyDiscoveryDelta,
  isEmptyPlanningDelta,
} from "./state.js";
import { buildWeaveVocabulary } from "./vocabulary.js";
import { removeDiscoveryChip, removePlanningChip } from "./chip-ops.js";
import { createDinnerPlan } from "../lib/plan-mutations.js";
import { saveDinnerPlan } from "../lib/dinner-plan-store.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}

function fail(error, status = 400, extra = {}) {
  return json({ ok: false, error, ...extra }, status);
}

async function readJson(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

const TZ_RE = /^[A-Za-z0-9_+\-/]{1,64}$/;

function todayInTimezone(timezone) {
  const tz = TZ_RE.test(timezone || "") ? timezone : "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
      new Date()
    );
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    return `${y}-${m}-${d}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function buildPromptContext({ timezone, participantIds, dinnerPlan, today }) {
  const dates = [];
  if (dinnerPlan?.scheduled_dates?.length) {
    for (let i = 0; i < dinnerPlan.scheduled_dates.length; i += 1) {
      const date = dinnerPlan.scheduled_dates[i];
      if (!date) continue;
      const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
      dates.push({ position: i + 1, date, weekday });
    }
  }
  return {
    today,
    timezone: TZ_RE.test(timezone || "") ? timezone : "UTC",
    diners: participantIds.length,
    dinner_count_default: 4,
    dates: dates.length ? dates : undefined,
  };
}

function seedPlanningStateFromPlan(plan) {
  if (!plan?.intent) return null;
  const state = emptyPlanningState();
  state.dinner_count = plan.intent.dinner_count ?? null;
  state.keep_it_easy = plan.intent.keep_it_easy ? true : null;
  state.keep_ingredients_simple = plan.intent.keep_ingredients_simple ? true : null;
  return state;
}

async function runDiscoveryForQuery(env, session, query, clientContext) {
  const loaded = await loadPublishedCatalog(env.DB);
  if (!loaded.ok) return { error: fail(loaded.error || "catalog_unavailable", 503) };
  const [memberIds, constraints, tastes, recent] = await Promise.all([
    householdMemberIds(env.DB, session.household_id),
    householdConstraints(env.DB, session.household_id),
    householdTastes(env.DB, session.household_id),
    loadDiscoveryRecentSlugs(env.DB, session.household_id),
  ]);
  const resolved = await resolveDiscoveryContext(env.DB, session, clientContext, {
    memberIds,
    constraints,
    tastes,
    recent_slugs: recent.recent_slugs,
  });
  if (!resolved.ok) return { error: fail(resolved.error, resolved.status || 400) };
  const meals = loaded.planner.map(projectDiscoveryMeal);
  const ran = runDiscoveryPipeline(meals, query, resolved.context);
  return {
    payload: {
      schema_version: DISCOVERY_SCHEMA_VERSION,
      mode: resolved.context.mode,
      catalog_source: "d1",
      catalog_size: meals.length,
      query: canonicalQuery(query),
      context: publicContext(resolved.context),
      soft: resolved.context.soft,
      soft_source: resolved.context.soft_source,
      selection: selectionFor(resolved.context),
      excluded_counts: ran.excluded_counts,
      trace: ran.trace,
      results: ran.results,
      limit: query.limit,
      offset: query.offset,
      total: ran.total,
      recent_source: recent.recent_source,
    },
  };
}

/**
 * @param {{ DB: object, CATALOG_SOURCE?: string }} env
 */
async function executePlanning(env, session, { priorState, dinnerPlan, participantIds }) {
  const [constraints, tastes] = await Promise.all([
    householdConstraints(env.DB, session.household_id),
    householdTastes(env.DB, session.household_id),
  ]);
  const conflictPass = detectPlanningConflicts(priorState, {
    participantIds,
    constraints,
    tastes,
  });
  const executed = conflictPass.repaired;
  const ack = reconcileAcknowledgement({
    task: "planning_intent",
    modelAck: "",
    state: executed,
    conflicts: conflictPass.conflicts,
    dropped: [],
    removedTokens: conflictPass.removed,
  });
  const parsed = parsePlannerFromState(executed, { participant_ids: participantIds });
  if (!parsed.ok) {
    return {
      ok: true,
      task: "planning_intent",
      source: "deterministic",
      fallback_code: parsed.error,
      acknowledgement: null,
      state: priorState,
      chips: buildPlanningChips(executed),
      conflicts: conflictPass.conflicts,
      dropped: [],
      changed_positions: [],
      preview: null,
    };
  }
  let catalog = null;
  if (catalogReadsFromD1(env)) {
    const loaded = await loadPublishedCatalog(env.DB);
    if (loaded.ok) catalog = loaded.planner;
  }
  const t1 = Date.now();
  const preview = planDinners(parsed.intent, {
    catalog,
    constraints,
    tastes,
    previous_slots: dinnerPlan?.meals?.map((m) => m.slot) || null,
  });
  const deterministicMs = Date.now() - t1;
  return {
    ok: true,
    task: "planning_intent",
    source: "deterministic",
    ...ack,
    state: executed,
    chips: buildPlanningChips(executed),
    conflicts: conflictPass.conflicts,
    dropped: [],
    changed_positions: preview.changed_positions || [],
    preview,
    deterministic_latency_ms: deterministicMs,
    total_latency_ms: deterministicMs,
    fallback_code: null,
  };
}

async function executeDiscovery(env, session, { executedState, clientContext, conflicts, dropped, removed, modelAck, source, model, prompt_version, providerMs }) {
  const ack = reconcileAcknowledgement({
    task: "discovery_intent",
    modelAck,
    state: executedState,
    conflicts,
    dropped,
    removedTokens: removed,
  });
  const mapped = discoveryStateToQuery(executedState, {});
  if (!mapped.ok) return { error: fail(mapped.error, mapped.status || 400) };
  const t1 = Date.now();
  const ran = await runDiscoveryForQuery(env, session, mapped.query, clientContext);
  const deterministicMs = Date.now() - t1;
  if (ran.error) return { error: ran.error };
  return {
    payload: {
      ok: true,
      task: "discovery_intent",
      source,
      model,
      prompt_version,
      ...ack,
      state: executedState,
      chips: buildDiscoveryChips(executedState),
      conflicts,
      dropped,
      provider_latency_ms: providerMs,
      deterministic_latency_ms: deterministicMs,
      total_latency_ms: providerMs + deterministicMs,
      fallback_code: null,
      ...ran.payload,
    },
  };
}

export async function routeWeaveRequest(env, request, path) {
  const isPlanInterpret = path === "/api/plan/interpret" && request.method === "POST";
  const isFindInterpret = path === "/api/discovery/interpret" && request.method === "POST";
  const isPlanApply = path === "/api/plan/apply" && request.method === "POST";
  const isFindApply = path === "/api/discovery/apply" && request.method === "POST";
  const isPlanCommit = path === "/api/plan/commit" && request.method === "POST";
  if (!isPlanInterpret && !isFindInterpret && !isPlanApply && !isFindApply && !isPlanCommit) return null;

  const auth = await requireSession(env.DB, request);
  if (auth.error) return auth.error;
  const session = auth.session;
  const body = await readJson(request);
  if (body === null) return fail("invalid_json");
  if (body.schema_version != null && body.schema_version !== 1) return fail("schema_version_unsupported");
  if (body.constraints || body.eligible) return fail("client_constraints_forbidden");

  const vocabulary = buildWeaveVocabulary();
  const timezone = body.timezone || "UTC";
  const today = todayInTimezone(timezone);
  const participantIds =
    (body.participant_ids || body.context?.participant_ids || []).length
      ? body.participant_ids || body.context?.participant_ids
      : await householdMemberIds(env.DB, session.household_id);
  const members = assertParticipants(participantIds, await householdMemberIds(env.DB, session.household_id));
  if (!members.ok) return fail(members.error, members.status || 403);

  if (isPlanApply) {
    let priorState = body.state || emptyPlanningState();
    if (body.chip_id) priorState = removePlanningChip(priorState, body.chip_id);
    let dinnerPlan = null;
    if (body.dinner_plan_id) {
      dinnerPlan = await loadDinnerPlan(env.DB, body.dinner_plan_id);
      if (!dinnerPlan || dinnerPlan.household_id !== session.household_id) return fail("forbidden_cross_household", 403);
    }
    const result = await executePlanning(env, session, {
      priorState,
      dinnerPlan,
      participantIds,
    });
    return json(result);
  }

  if (isFindApply) {
    const client = normalizeClientContext({ mode: body.mode || "standalone", ...(body.context || {}) });
    if (!client.ok) return fail(client.error, client.status || 400);
    let priorState = body.state || applyDiscoveryDelta(null, {}, {}).state;
    if (body.chip_id) priorState = removeDiscoveryChip(priorState, body.chip_id);
    const [constraints, tastes] = await Promise.all([
      householdConstraints(env.DB, session.household_id),
      householdTastes(env.DB, session.household_id),
    ]);
    const conflictPass = detectDiscoveryConflicts(priorState, { participantIds, constraints, tastes });
    const executedState = conflictPass.repaired;
    const ran = await executeDiscovery(env, session, {
      executedState,
      clientContext: client.context,
      conflicts: conflictPass.conflicts,
      dropped: [],
      removed: conflictPass.removed,
      modelAck: "",
      source: "deterministic",
      model: null,
      prompt_version: null,
      providerMs: 0,
    });
    if (ran.error) return ran.error;
    return json(ran.payload);
  }

  if (isPlanCommit) {
    const preview = body.preview;
    const weaveState = body.state;
    if (!preview?.slots || !weaveState?.dinner_count) return fail("preview_invalid");
    const parsed = parsePlannerFromState(weaveState, { participant_ids: participantIds });
    if (!parsed.ok) return fail(parsed.error, parsed.status || 400);
    const now = new Date().toISOString();
    const [constraints, tastes, catalogLoad] = await Promise.all([
      householdConstraints(env.DB, session.household_id),
      householdTastes(env.DB, session.household_id),
      catalogReadsFromD1(env) ? loadPublishedCatalog(env.DB) : Promise.resolve({ ok: false }),
    ]);
    const ctx = {
      now,
      actor_member_id: session.member_id,
      household_member_ids: await householdMemberIds(env.DB, session.household_id),
      constraints,
      tastes,
      data_origin: "weave",
      catalog: catalogLoad.ok ? catalogLoad.planner : null,
      versions: catalogLoad.ok ? catalogLoad.versionsById : null,
    };
    const created = createDinnerPlan(
      {
        meal_count: weaveState.dinner_count,
        entry_point: body.entry_point || "plan_dinners",
        participant_ids: participantIds,
        fill: "from_preview",
        preview_slots: preview.slots,
        intent: parsed.intent,
        keep_it_easy: weaveState.keep_it_easy === true,
        keep_ingredients_simple: weaveState.keep_ingredients_simple === true,
      },
      ctx
    );
    if (!created.ok) return fail(created.error, created.status || 400, created);
    try {
      await saveDinnerPlan(env.DB, created.plan);
    } catch (error) {
      return fail("dinner_plan_save_failed", 500, { detail: String(error.message || error) });
    }
    return json({ ok: true, plan: presentDinnerPlan(created.plan), unfilled: created.unfilled });
  }

  const text = String(body.text || "").trim();
  const isFind = isFindInterpret;
  if (!text || text.length > (isFind ? 200 : 500)) return fail("text_invalid");

  const provider = resolveProvider(env);
  const service = createGenerationService({ provider, store: createD1Store(env.DB), env });

  if (isPlanInterpret) {
    let priorState = body.state;
    let dinnerPlan = null;
    if (priorState == null && body.dinner_plan_id) {
      dinnerPlan = await loadDinnerPlan(env.DB, body.dinner_plan_id);
      if (!dinnerPlan || dinnerPlan.household_id !== session.household_id) return fail("forbidden_cross_household", 403);
      priorState = seedPlanningStateFromPlan(dinnerPlan);
    }
    const context = buildPromptContext({ timezone, participantIds, dinnerPlan, today });
    context.vocabulary = vocabulary;
    const t0 = Date.now();
    const runInput = { text, state: priorState, context, vocabulary };
    const gen = await service.run("planning_intent", runInput, { householdId: session.household_id, fallback: null });
    const providerMs = Date.now() - t0;
    if (!gen.ok || isEmptyPlanningDelta(gen.output)) {
      return json({
        ok: true,
        task: "planning_intent",
        source: gen.source || "fallback",
        fallback_code: gen.error || "empty_delta",
        acknowledgement: null,
        acknowledgement_source: null,
        state: priorState || emptyPlanningState(),
        chips: [],
        conflicts: [],
        dropped: [],
        changed_positions: [],
        preview: null,
        model: gen.model ?? null,
        prompt_version: gen.prompt_version ?? null,
      });
    }
    const applied = applyPlanningDelta(priorState, gen.output, context);
    const [constraints, tastes] = await Promise.all([
      householdConstraints(env.DB, session.household_id),
      householdTastes(env.DB, session.household_id),
    ]);
    const conflictPass = detectPlanningConflicts(applied.state, {
      participantIds,
      constraints,
      tastes,
    });
    const executed = conflictPass.repaired;
    const ack = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: gen.output.acknowledgement,
      state: executed,
      conflicts: conflictPass.conflicts,
      dropped: applied.dropped,
      removedTokens: conflictPass.removed,
    });
    const parsed = parsePlannerFromState(executed, { participant_ids: participantIds });
    if (!parsed.ok) {
      return json({
        ok: true,
        task: "planning_intent",
        source: "fallback",
        fallback_code: parsed.error,
        acknowledgement: null,
        state: priorState || emptyPlanningState(),
        chips: buildPlanningChips(executed),
        conflicts: conflictPass.conflicts,
        dropped: applied.dropped,
        changed_positions: [],
        preview: null,
      });
    }
    let catalog = null;
    if (catalogReadsFromD1(env)) {
      const loaded = await loadPublishedCatalog(env.DB);
      if (loaded.ok) catalog = loaded.planner;
    }
    const t1 = Date.now();
    const preview = planDinners(parsed.intent, {
      catalog,
      constraints,
      tastes,
      previous_slots: dinnerPlan?.meals?.map((m) => m.slot) || null,
    });
    const deterministicMs = Date.now() - t1;
    return json({
      ok: true,
      task: "planning_intent",
      source: gen.source,
      model: gen.model,
      prompt_version: gen.prompt_version,
      ...ack,
      state: executed,
      chips: buildPlanningChips(executed),
      conflicts: conflictPass.conflicts,
      dropped: applied.dropped,
      changed_positions: preview.changed_positions || [],
      preview,
      provider_latency_ms: providerMs,
      deterministic_latency_ms: deterministicMs,
      total_latency_ms: providerMs + deterministicMs,
      fallback_code: null,
    });
  }

  if (!isFindInterpret) return null;

  // Discovery interpret
  const client = normalizeClientContext({ mode: body.mode || "standalone", ...(body.context || {}) });
  if (!client.ok) return fail(client.error, client.status || 400);
  const priorDiscovery = body.state;
  const bypass = classifyDiscoveryBypass(text);
  const t0 = Date.now();
  let source = "bypass";
  let model = null;
  let prompt_version = null;
  let fallback_code = null;
  let executedState;
  let dropped = [];
  let conflicts = [];
  let removed = [];
  let modelAck = "";
  if (bypass.bypass && bypass.reason === "lexicon") {
    executedState = bypassDiscoveryPatch(text);
  } else if (bypass.bypass && bypass.reason === "empty") {
    executedState = priorDiscovery || applyDiscoveryDelta(null, {}, {}).state;
  } else {
    source = "provider";
    const context = { today, timezone: contextTimezone(timezone), diners: participantIds.length, vocabulary };
    const gen = await service.run(
      "discovery_intent",
      { text, state: priorDiscovery, context, vocabulary },
      { householdId: session.household_id, fallback: null }
    );
    if (!gen.ok || isEmptyDiscoveryDelta(gen.output)) {
      const normText = normalizeFindText(text).slice(0, 200);
      const q = normalizeQuery({ text: normText });
      const ran = await runDiscoveryForQuery(env, session, q.ok ? q.query : normalizeQuery({}).query, client.context);
      if (ran.error) return ran.error;
      return json({
        ok: true,
        task: "discovery_intent",
        source: "fallback",
        fallback_code: gen.error || "empty_delta",
        acknowledgement: null,
        state: priorDiscovery,
        chips: [],
        conflicts: [],
        dropped: [],
        ...ran.payload,
      });
    }
    const applied = applyDiscoveryDelta(priorDiscovery, gen.output, { vocabulary, today });
    dropped = applied.dropped;
    const [constraints, tastes] = await Promise.all([
      householdConstraints(env.DB, session.household_id),
      householdTastes(env.DB, session.household_id),
    ]);
    const conflictPass = detectDiscoveryConflicts(applied.state, {
      participantIds,
      constraints,
      tastes,
    });
    conflicts = conflictPass.conflicts;
    removed = conflictPass.removed;
    executedState = conflictPass.repaired;
    model = gen.model;
    prompt_version = gen.prompt_version;
    source = gen.source;
    modelAck = gen.output.acknowledgement;
  }
  const providerMs = Date.now() - t0;
  const ack = reconcileAcknowledgement({
    task: "discovery_intent",
    modelAck,
    state: executedState,
    conflicts,
    dropped,
    removedTokens: removed,
  });
  const mapped = discoveryStateToQuery(executedState, {});
  if (!mapped.ok) return fail(mapped.error, mapped.status || 400);
  const t1 = Date.now();
  const ran = await runDiscoveryForQuery(env, session, mapped.query, client.context);
  const deterministicMs = Date.now() - t1;
  if (ran.error) return ran.error;
  return json({
    ok: true,
    task: "discovery_intent",
    source,
    model,
    prompt_version,
    ...ack,
    state: executedState,
    chips: buildDiscoveryChips(executedState),
    conflicts,
    dropped,
    provider_latency_ms: providerMs,
    deterministic_latency_ms: deterministicMs,
    total_latency_ms: providerMs + deterministicMs,
    fallback_code,
    ...ran.payload,
  });
}

function contextTimezone(timezone) {
  return TZ_RE.test(timezone || "") ? timezone : "UTC";
}
