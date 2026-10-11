/**
 * D-06 weave routes: interpret, deterministic apply, plan commit.
 */
import { UNAVAILABLE_GATEWAY_CODES } from "../ai/errors.js";
import { createD1Store, createGenerationService, resolveProvider } from "../ai/index.js";
import { catalogReadsFromD1, loadPublishedCatalog } from "../lib/catalog-runtime.js";
import {
  householdConstraints,
  householdMemberIds,
  householdTastes,
  latestHouseholdDinnerCount,
  loadDinnerPlan,
} from "../lib/dinner-plan-store.js";
import { elapsedMs, monotonicNow } from "../lib/clock.js";
import { assertParticipants, presentDinnerPlan } from "../lib/plan-contract.js";
import { planDinners } from "../lib/dinner-planner.js";
import { requireSession } from "../lib/auth.js";
import { DISCOVERY_SCHEMA_VERSION } from "../discovery/constants.js";
import { canonicalQuery, normalizeQuery } from "../discovery/query.js";
import { projectDiscoveryMeal } from "../discovery/meal.js";
import { runDiscoveryPipeline } from "../discovery/pipeline.js";
import { resolveDiscoveryContext, selectionFor, publicContext, normalizeClientContext } from "../discovery/context.js";
import { loadDiscoveryRecentSlugs } from "../discovery/http.js";
import { buildPlanningChips, buildDiscoveryChips, noResultsAcknowledgement, noResultsSuggestions, reconcileAcknowledgement, refinementAcknowledgement, FIND_UNAVAILABLE_ACK, PLAN_PICKER_ACK, planCountFallbackAck, withRelaxation } from "./ack.js";
import { classifyDiscoveryBypass, bypassDiscoveryPatch, normalizeFindText, keywordDiscoveryInput } from "./bypass.js";
import { applyNegationOverlay } from "./negation.js";
import {
  ambiguousTarget,
  applyDinnerCount,
  applySharedSemantics,
  broadenDiscoveryState,
  buildSemanticTelemetry,
  canBroadenZero,
  classifyZeroResult,
  householdSafeStarterPrompts,
} from "./semantics.js";
import { rulesFromLegacyKeys } from "../lib/legacy-preference-audit.js";
import { discoveryRelaxations } from "./relax.js";
import { detectDiscoveryConflicts, detectPlanningConflicts, frequencyConflicts } from "./conflicts.js";
import { applyPendingSlotChoice, choiceCopy, planSlotChoiceGate, reresolvePendingSlot } from "./plan-slot-choice.js";
import { discoveryStateToQuery } from "./discovery-map.js";
import { parsePlannerFromState } from "./plan-map.js";
import {
  applyDiscoveryDelta,
  applyPlanningDelta,
  datesFromPlanMeals,
  emptyPlanningState,
  isEmptyDiscoveryDelta,
  isEmptyPlanningDelta,
  usualDinnerCount,
} from "./state.js";
import { buildWeaveVocabulary } from "./vocabulary.js";
import { removeDiscoveryChip, removePlanningChip } from "./chip-ops.js";
import { enrichPreviousSlots } from "./slot-match.js";
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
const UNAVAILABLE_GATEWAY = new Set(UNAVAILABLE_GATEWAY_CODES);
const DINNER_COUNT_WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"];

function parseDinnerCount(text) {
  const norm = String(text || "").toLowerCase();
  const digit = norm.match(/\b([1-9]|1[0-4])\b/);
  if (digit) return Number(digit[1]);
  for (let n = DINNER_COUNT_WORDS.length; n >= 1; n -= 1) {
    if (new RegExp(`\\b${DINNER_COUNT_WORDS[n - 1]}\\b`).test(norm)) return n;
  }
  return null;
}

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

/**
 * Prompt context is household-free on purpose. It carries the clock, a diner
 * count, and plan dates — not member ids, names, allergens, tastes, or limits.
 * The interpret cache key is this payload. Conflicts are applied after the cache.
 */
function buildPromptContext({ timezone, participantIds, dinnerPlan, today, usual }) {
  const dates = datesFromPlanMeals(dinnerPlan?.meals);
  return {
    today,
    timezone: TZ_RE.test(timezone || "") ? timezone : "UTC",
    diners: participantIds.length,
    dinner_count_default: usual.count,
    dinner_count_usual: usual.usual === true,
    dates: dates.length ? dates : undefined,
  };
}

function previousSlotsFromMeals(meals) {
  if (!meals?.length) return null;
  return meals.map((meal) => ({
    position: meal.position,
    recipe_slug: meal.recipe_slug,
    recipe_version_id: meal.recipe_version_id,
    recipe_id: meal.recipe_id,
    version_number: meal.version_number,
    title: meal.title,
    scheduled_date: meal.scheduled_date,
    effort_level: meal.effort_level || null,
    ingredient_complexity: meal.ingredient_complexity || null,
    participant_ids: meal.participant_ids || [],
    tags: meal.tags || [],
    vocabulary_tag_ids: meal.vocabulary_tag_ids || [],
    dietary_labels: meal.dietary_labels || [],
    allergens: meal.allergens || [],
    cuisine: meal.cuisine || null,
    total_minutes: meal.total_minutes ?? null,
    result: meal.recipe_version_id ? "recommended" : "constrained",
  }));
}

async function loadPlanningAnchor(env, session, { priorState, dinnerPlanId }) {
  let dinnerPlan = null;
  if (dinnerPlanId) {
    dinnerPlan = await loadDinnerPlan(env.DB, dinnerPlanId);
    if (!dinnerPlan || dinnerPlan.household_id !== session.household_id) {
      return { error: fail("forbidden_cross_household", 403) };
    }
  }
  const latestCount = dinnerPlan?.meal_count ?? (await latestHouseholdDinnerCount(env.DB, session.household_id));
  const usual = usualDinnerCount(latestCount);
  const state = priorState == null && dinnerPlan ? seedPlanningStateFromPlan(dinnerPlan) : priorState;
  return { dinnerPlan, usual, priorState: state };
}

function seedPlanningStateFromPlan(plan) {
  if (!plan?.intent) return null;
  const state = emptyPlanningState();
  state.dinner_count = plan.intent.dinner_count ?? null;
  state.keep_it_easy = plan.intent.keep_it_easy ? true : null;
  state.keep_ingredients_simple = plan.intent.keep_ingredients_simple ? true : null;
  return state;
}

async function runDiscoveryForQuery(env, session, query, clientContext, preloaded = null) {
  const loaded = preloaded?.catalog?.ok ? preloaded.catalog : await loadPublishedCatalog(env.DB);
  if (!loaded.ok) return { error: fail(loaded.error || "catalog_unavailable", 503) };
  const [memberIds, constraints, tastes, recent] = preloaded
    ? [preloaded.memberIds, preloaded.constraints, preloaded.tastes, preloaded.recent]
    : await Promise.all([
        householdMemberIds(env.DB, session.household_id),
        householdConstraints(env.DB, session.household_id),
        householdTastes(env.DB, session.household_id),
        loadDiscoveryRecentSlugs(env.DB, session.household_id),
      ]);
  const resolved = resolveDiscoveryContext(clientContext, {
    household_id: session.household_id,
    member_ids: memberIds,
    constraints,
    tastes,
    recent_slugs: recent.recent_slugs,
    recent_source: recent.recent_source,
  }, query);
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
async function executePlanning(env, session, { priorState, dinnerPlan, participantIds, preloaded = null, routeStarted = Date.now() }) {
  const [constraints, tastes] = preloaded
    ? [preloaded.constraints, preloaded.tastes]
    : await Promise.all([
        householdConstraints(env.DB, session.household_id),
        householdTastes(env.DB, session.household_id),
      ]);
  const conflictPass = detectPlanningConflicts(priorState, {
    participantIds,
    constraints,
    tastes,
  });
  const executed = conflictPass.repaired;
  let dinnerCountDefaulted = false;
  let dinnerCountUsual = false;
  if (executed.dinner_count == null) {
    const latestCount = dinnerPlan?.meal_count ?? (await latestHouseholdDinnerCount(env.DB, session.household_id));
    const usual = usualDinnerCount(latestCount);
    executed.dinner_count = usual.count;
    dinnerCountDefaulted = true;
    dinnerCountUsual = usual.usual;
  }
  const parsed = parsePlannerFromState(executed, { participant_ids: participantIds });
  if (!parsed.ok) {
    const ack = reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: "",
      state: executed,
      conflicts: conflictPass.conflicts,
      dropped: [],
      removedTokens: conflictPass.removed,
      dinnerCountDefaulted,
      dinnerCountUsual,
    });
    return {
      ok: true,
      task: "planning_intent",
      source: "deterministic",
      fallback_code: parsed.error,
      ...ack,
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
    const loaded = preloaded?.catalog || (await loadPublishedCatalog(env.DB));
    if (loaded.ok) catalog = loaded.planner;
  }
  const previousSlots = enrichPreviousSlots(previousSlotsFromMeals(dinnerPlan?.meals), catalog);
  const preview = planDinners(parsed.intent, {
    catalog,
    constraints,
    tastes,
    previous_slots: previousSlots,
  });
  // planDinners is synchronous. Workers freeze both clocks during CPU, so this is n/a.
  const deterministicMs = null;
  const conflicts = [...conflictPass.conflicts, ...frequencyConflicts(preview)];
  const refinement = refinementAcknowledgement({ preview, previousSlots, slots: executed.slots });
  const ack = reconcileAcknowledgement({
    task: "planning_intent",
    modelAck: "",
    state: executed,
    conflicts,
    dropped: [],
    removedTokens: conflictPass.removed,
    dinnerCountDefaulted,
    dinnerCountUsual,
    refinement,
  });
  return {
    ok: true,
    task: "planning_intent",
    source: "deterministic",
    ...ack,
    state: executed,
    chips: buildPlanningChips(executed),
    conflicts,
    dropped: [],
    changed_positions: preview.changed_positions || [],
    preview,
    suggestions: ack.suggestions || [],
    ...latencyFields({ routeStarted, providerMs: 0, deterministicMs }),
    fallback_code: null,
  };
}

async function executeDiscovery(env, session, { executedState, clientContext, conflicts, dropped, removed, modelAck, source, model, prompt_version, providerMs, preloaded = null, routeStarted = Date.now(), userText = "" }) {
  let ack = reconcileAcknowledgement({
    task: "discovery_intent",
    modelAck,
    state: executedState,
    conflicts,
    dropped,
    removedTokens: removed,
    userText,
  });
  const mapped = discoveryStateToQuery(executedState, {});
  if (!mapped.ok) return { error: fail(mapped.error, mapped.status || 400) };
  const t1 = monotonicNow();
  const ran = await runDiscoveryForQuery(env, session, mapped.query, clientContext, preloaded);
  const deterministicMs = elapsedMs(t1);
  if (ran.error) return { error: ran.error };
  let suggestions = ack.suggestions || [];
  if ((ran.payload.total || 0) === 0) {
    ack = {
      acknowledgement: noResultsAcknowledgement(conflicts, executedState),
      acknowledgement_source: "reconciled",
      suggestions: noResultsSuggestions(executedState, tableLimitIds(preloaded?.memberIds || [], preloaded?.constraints || [])),
    };
    suggestions = ack.suggestions;
  }
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
      suggestions,
      ...latencyFields({ routeStarted, providerMs, deterministicMs }),
      fallback_code: null,
      ...ran.payload,
    },
  };
}

function tableLimitIds(participantIds, constraints) {
  const ids = new Set();
  for (const memberId of participantIds || []) {
    const keys = [];
    for (const row of constraints || []) {
      if (row.member_id && row.member_id !== memberId) continue;
      if ((row.status || "prohibited") === "permitted") continue;
      if (row.rule_key) keys.push(row.rule_key);
    }
    for (const rule of rulesFromLegacyKeys(keys)) {
      if (rule.status === "prohibited") ids.add(rule.id);
    }
  }
  return [...ids];
}

function semanticAck(ack, semantic, conflicts) {
  if (!semantic?.force_ack || !semantic.primary_ack) return ack;
  if ((conflicts || []).length) return ack;
  return { ...ack, acknowledgement: semantic.primary_ack, acknowledgement_source: "reconciled" };
}

function attachTelemetry(payload, { task, semantic, source, resultCount, zeroReason }) {
  return {
    ...payload,
    telemetry: buildSemanticTelemetry({
      task,
      semantic,
      source,
      resultCount,
      zeroReason,
    }),
  };
}

function latencyFields({ routeStarted, providerMs, deterministicMs }) {
  const total = Math.max(0, Date.now() - routeStarted);
  const provider = Number(providerMs) || 0;
  const deterministic = typeof deterministicMs === "number" ? deterministicMs : null;
  const overhead = Math.max(0, total - provider - (deterministic || 0));
  return {
    provider_latency_ms: provider,
    server_overhead_ms: overhead,
    deterministic_latency_ms: deterministic,
    total_latency_ms: total,
  };
}

export async function routeWeaveRequest(env, request, path, deps = {}) {
  const routeStarted = Date.now();
  const isPlanInterpret = path === "/api/plan/interpret" && request.method === "POST";
  const isFindInterpret = path === "/api/discovery/interpret" && request.method === "POST";
  const isPlanApply = path === "/api/plan/apply" && request.method === "POST";
  const isFindApply = path === "/api/discovery/apply" && request.method === "POST";
  const isPlanCommit = path === "/api/plan/commit" && request.method === "POST";
  const isPlanCount = path === "/api/plan/count" && request.method === "POST";
  const isPlanReresolve = path === "/api/plan/reresolve-slot" && request.method === "POST";
  const isStarters = path === "/api/weave/starters" && request.method === "GET";
  if (!isPlanInterpret && !isFindInterpret && !isPlanApply && !isFindApply && !isPlanCommit && !isPlanCount && !isPlanReresolve && !isStarters) {
    return null;
  }

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
  const householdIds = await householdMemberIds(env.DB, session.household_id);
  const requestedIds = body.participant_ids || body.context?.participant_ids || [];
  const participantIds = requestedIds.length ? requestedIds : householdIds;
  const members = assertParticipants(participantIds, householdIds);
  if (!members.ok) return fail(members.error, members.status || 403);
  const reads = {
    constraints: householdConstraints(env.DB, session.household_id),
    tastes: householdTastes(env.DB, session.household_id),
    catalog: catalogReadsFromD1(env) ? loadPublishedCatalog(env.DB) : Promise.resolve({ ok: false }),
    recent: isFindInterpret || isFindApply
      ? loadDiscoveryRecentSlugs(env.DB, session.household_id)
      : Promise.resolve({ recent_slugs: [], recent_source: null }),
  };
  const settleReads = () => Promise.allSettled([reads.constraints, reads.tastes, reads.catalog, reads.recent]);

  if (isStarters) {
    const constraints = await reads.constraints;
    return json({
      ok: true,
      llm_called: false,
      starters: householdSafeStarterPrompts({ limits: tableLimitIds(participantIds, constraints) }),
    });
  }

  if (isPlanCount) {
    const counted = applyDinnerCount(body.state || emptyPlanningState(), body.dinner_count);
    if (!counted.ok) {
      await settleReads();
      return fail(counted.error);
    }
    let dinnerPlan = null;
    if (body.dinner_plan_id) {
      dinnerPlan = await loadDinnerPlan(env.DB, body.dinner_plan_id);
      if (!dinnerPlan || dinnerPlan.household_id !== session.household_id) return fail("forbidden_cross_household", 403);
    }
    const [constraints, tastes, catalog] = await Promise.all([reads.constraints, reads.tastes, reads.catalog]);
    const result = await executePlanning(env, session, {
      priorState: counted.state,
      dinnerPlan,
      participantIds,
      preloaded: { constraints, tastes, catalog },
      routeStarted,
    });
    return json(attachTelemetry({ ...result, llm_called: false }, {
      task: "planning_intent",
      semantic: {},
      source: "deterministic",
      resultCount: result.preview?.slots?.length ?? 0,
      zeroReason: null,
    }));
  }

  if (isPlanReresolve) {
    const priorState = body.state || emptyPlanningState();
    if (!body.dinner_plan_id) return fail("dinner_plan_id_required");
    const dinnerPlan = await loadDinnerPlan(env.DB, body.dinner_plan_id);
    if (!dinnerPlan || dinnerPlan.household_id !== session.household_id) return fail("forbidden_cross_household", 403);
    const resolved = reresolvePendingSlot({
      state: priorState,
      userText: body.text || "",
      dinnerPlan,
    });
    if (!resolved) {
      return json({ ok: true, llm_called: false, action: "noop" });
    }
    if (resolved.type === "apply") {
      return json({
        ok: true,
        llm_called: false,
        action: "apply",
        positions: resolved.positions,
      });
    }
    return json({
      ok: true,
      llm_called: false,
      action: "choice",
      choice: resolved.conflict,
      choice_copy: resolved.choice_copy,
      state: resolved.state,
    });
  }

  if (isPlanApply) {
    let priorState = body.state || emptyPlanningState();
    if (body.slot_choice?.positions?.length) {
      const chosen = applyPendingSlotChoice(priorState, body.slot_choice.positions);
      if (!chosen.ok) return fail(chosen.error);
      priorState = chosen.state;
    }
    if (body.chip_id) priorState = removePlanningChip(priorState, body.chip_id);
    let dinnerPlan = null;
    if (body.dinner_plan_id) {
      dinnerPlan = await loadDinnerPlan(env.DB, body.dinner_plan_id);
      if (!dinnerPlan || dinnerPlan.household_id !== session.household_id) return fail("forbidden_cross_household", 403);
    }
    const [constraints, tastes, catalog] = await Promise.all([reads.constraints, reads.tastes, reads.catalog]);
    const result = await executePlanning(env, session, {
      priorState,
      dinnerPlan,
      participantIds,
      preloaded: { constraints, tastes, catalog },
      routeStarted,
    });
    return json(result);
  }

  if (isFindApply) {
    const client = normalizeClientContext({ mode: body.mode || "standalone", ...(body.context || {}) });
    if (!client.ok) return fail(client.error, client.status || 400);
    let priorState = body.state || applyDiscoveryDelta(null, {}, {}).state;
    if (body.chip_id) priorState = removeDiscoveryChip(priorState, body.chip_id);
    const [constraints, tastes, recent, catalog] = await Promise.all([reads.constraints, reads.tastes, reads.recent, reads.catalog]);
    const conflictPass = detectDiscoveryConflicts(priorState, { participantIds, constraints, tastes, userText: body.text || "" });
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
      userText: body.text || "",
      routeStarted,
      preloaded: { memberIds: householdIds, constraints, tastes, recent, catalog },
    });
    if (ran.error) return ran.error;
    return json(ran.payload);
  }

  if (isPlanCommit) {
    const preview = body.preview;
    const weaveState = body.state;
    if (!preview?.slots || !weaveState?.dinner_count) {
      await settleReads();
      return fail("preview_invalid");
    }
    const parsed = parsePlannerFromState(weaveState, { participant_ids: participantIds });
    if (!parsed.ok) return fail(parsed.error, parsed.status || 400);
    const now = new Date().toISOString();
    const [constraints, tastes, catalogLoad] = await Promise.all([reads.constraints, reads.tastes, reads.catalog]);
    const ctx = {
      now,
      actor_member_id: session.member_id,
      household_member_ids: householdIds,
      constraints,
      tastes,
      data_origin: deps.writeOrigin ? await deps.writeOrigin(env, session.household_id, request, body) : "unproven",
      catalog: catalogLoad.ok ? catalogLoad.planner : null,
      versions: catalogLoad.ok ? catalogLoad.versionsById : null,
    };
    const created = createDinnerPlan(
      {
        household_id: session.household_id,
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
  if (!text || text.length > (isFind ? 200 : 500)) {
    await settleReads();
    return fail("text_invalid");
  }

  const provider = resolveProvider(env);
  const service = createGenerationService({ provider, store: createD1Store(env.DB), env });

  if (isPlanInterpret) {
    const anchor = await loadPlanningAnchor(env, session, {
      priorState: body.state,
      dinnerPlanId: body.dinner_plan_id,
    });
    if (anchor.error) {
      await settleReads();
      return anchor.error;
    }
    const { dinnerPlan, usual } = anchor;
    const priorState = anchor.priorState;
    const context = buildPromptContext({ timezone, participantIds, dinnerPlan, today, usual });
    context.vocabulary = vocabulary;
    const amb = body.target_position
      ? null
      : ambiguousTarget({
          text,
          dates: context.dates || datesFromPlanMeals(dinnerPlan?.meals),
          dinnerCount: priorState?.dinner_count || context.dinner_count_default,
          today,
        });
    if (amb) {
      await settleReads();
      return json(attachTelemetry({
        ok: true,
        task: "planning_intent",
        source: "deterministic",
        llm_called: false,
        ambiguous_target: amb,
        acknowledgement: amb.prompt,
        acknowledgement_source: "reconciled",
        state: priorState || emptyPlanningState(),
        chips: priorState ? buildPlanningChips(priorState) : [],
        conflicts: [],
        dropped: [],
        changed_positions: [],
        preview: null,
        fallback_code: null,
      }, {
        task: "planning_intent",
        semantic: {},
        source: "deterministic",
        resultCount: 0,
        zeroReason: null,
      }));
    }
    const runInput = { text, state: priorState, context, vocabulary };
    const gen = await service.run("planning_intent", runInput, { householdId: session.household_id, fallback: null });
    const providerMs = Number(gen.provider_latency_ms) || 0;
    if (!gen.ok || isEmptyPlanningDelta(gen.output)) {
      if (UNAVAILABLE_GATEWAY.has(gen.error)) {
        const count = parseDinnerCount(text);
        if (count) {
          const [constraints, tastes, catalogLoad] = await Promise.all([reads.constraints, reads.tastes, reads.catalog]);
          const state = emptyPlanningState();
          state.dinner_count = count;
          const parsed = parsePlannerFromState(state, { participant_ids: participantIds });
          const catalog = catalogLoad?.ok ? catalogLoad.planner : null;
          const preview = parsed.ok
            ? planDinners(parsed.intent, {
                catalog,
                constraints,
                tastes,
                previous_slots: previousSlotsFromMeals(dinnerPlan?.meals),
              })
            : null;
          return json({
            ok: true,
            task: "planning_intent",
            source: "fallback",
            fallback_code: gen.error,
            acknowledgement: planCountFallbackAck(count),
            acknowledgement_source: "reconciled",
            state,
            chips: buildPlanningChips(state),
            conflicts: [],
            dropped: [],
            changed_positions: preview?.changed_positions || [],
            preview,
            suggestions: [],
            metadata: { estimated_cost_usd: Number(gen.estimated_cost_usd) || 0 },
          });
        }
        await settleReads();
        return json({
          ok: true,
          task: "planning_intent",
          source: "fallback",
          fallback_code: gen.error,
          acknowledgement: PLAN_PICKER_ACK,
          acknowledgement_source: "reconciled",
          state: priorState || emptyPlanningState(),
          chips: [],
          conflicts: [],
          dropped: [],
          changed_positions: [],
          preview: null,
          model: gen.model ?? null,
          prompt_version: gen.prompt_version ?? null,
          metadata: { estimated_cost_usd: Number(gen.estimated_cost_usd) || 0 },
        });
      }
      await settleReads();
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
        metadata: { estimated_cost_usd: Number(gen.estimated_cost_usd) || 0 },
      });
    }
    const undatedMealCount =
      dinnerPlan?.meals?.length && !datesFromPlanMeals(dinnerPlan.meals).length ? dinnerPlan.meals.length : 0;
    const applied = applyPlanningDelta(priorState, gen.output, {
      ...context,
      user_text: text,
      undated_meal_count: undatedMealCount,
      target_position: body.target_position,
    });
    const slotGate = planSlotChoiceGate({
      priorState,
      appliedState: applied.state,
      delta: gen.output,
      dinnerPlan,
      userText: text,
    });
    if (slotGate) {
      const copy = choiceCopy(slotGate.conflict);
      const [constraints, tastes] = await Promise.all([reads.constraints, reads.tastes]);
      void constraints;
      void tastes;
      return json(attachTelemetry({
        ok: true,
        task: "planning_intent",
        source: gen.source,
        model: gen.model,
        prompt_version: gen.prompt_version,
        llm_called: true,
        acknowledgement: null,
        acknowledgement_source: "reconciled",
        state: slotGate.state,
        chips: buildPlanningChips(slotGate.state),
        conflicts: [slotGate.conflict],
        choice: slotGate.conflict,
        choice_copy: copy,
        dropped: applied.dropped,
        changed_positions: [],
        preview: null,
        fallback_code: null,
        metadata: { estimated_cost_usd: Number(gen.estimated_cost_usd) || 0 },
      }, {
        task: "planning_intent",
        semantic: applied.semantic || {},
        source: gen.source || "provider",
        resultCount: 0,
        zeroReason: null,
      }));
    }
    const [constraints, tastes, catalogLoad] = await Promise.all([reads.constraints, reads.tastes, reads.catalog]);
    const conflictPass = detectPlanningConflicts(applied.state, {
      participantIds,
      constraints,
      tastes,
      userText: text,
    });
    const executed = conflictPass.repaired;
    const parsed = parsePlannerFromState(executed, { participant_ids: participantIds });
    if (!parsed.ok) {
      const ack = reconcileAcknowledgement({
        task: "planning_intent",
        modelAck: gen.output.acknowledgement,
        state: executed,
        conflicts: conflictPass.conflicts,
        dropped: applied.dropped,
        removedTokens: conflictPass.removed,
        userText: text,
        dinnerCountDefaulted: applied.dinner_count_defaulted === true,
        dinnerCountUsual: usual.usual === true,
      });
      return json({
        ok: true,
        task: "planning_intent",
        source: "fallback",
        fallback_code: parsed.error,
        ...ack,
        state: priorState || emptyPlanningState(),
        chips: buildPlanningChips(executed),
        conflicts: conflictPass.conflicts,
        dropped: applied.dropped,
        changed_positions: [],
        preview: null,
        metadata: { estimated_cost_usd: Number(gen.estimated_cost_usd) || 0 },
      });
    }
    const catalog = catalogLoad?.ok ? catalogLoad.planner : null;
    const previousSlots = enrichPreviousSlots(previousSlotsFromMeals(dinnerPlan?.meals), catalog);
    const preview = planDinners(parsed.intent, {
      catalog,
      constraints,
      tastes,
      previous_slots: previousSlots,
    });
    // Synchronous CPU. Workers freeze both clocks until an await, so this is n/a.
    const deterministicMs = null;
    const conflicts = [...conflictPass.conflicts, ...frequencyConflicts(preview)];
    const refinement = refinementAcknowledgement({ preview, previousSlots, slots: executed.slots });
    const ack = semanticAck(reconcileAcknowledgement({
      task: "planning_intent",
      modelAck: gen.output.acknowledgement,
      state: executed,
      conflicts,
      dropped: applied.dropped,
      removedTokens: conflictPass.removed,
      userText: text,
      dinnerCountDefaulted: applied.dinner_count_defaulted === true,
      dinnerCountUsual: usual.usual === true,
      refinement,
    }), applied.semantic, conflicts);
    return json(attachTelemetry({
      ok: true,
      task: "planning_intent",
      source: gen.source,
      model: gen.model,
      prompt_version: gen.prompt_version,
      ...ack,
      state: executed,
      chips: buildPlanningChips(executed),
      conflicts,
      dropped: applied.dropped,
      changed_positions: preview.changed_positions || [],
      preview,
      suggestions: ack.suggestions || [],
      ...latencyFields({ routeStarted, providerMs, deterministicMs }),
      fallback_code: null,
      metadata: { estimated_cost_usd: Number(gen.estimated_cost_usd) || 0 },
    }, {
      task: "planning_intent",
      semantic: applied.semantic,
      source: gen.source,
      resultCount: preview?.slots?.length ?? 0,
      zeroReason: null,
    }));
  }

  if (!isFindInterpret) {
    await settleReads();
    return null;
  }

  // Discovery interpret. Household reads already in flight overlap the provider call.
  const client = normalizeClientContext({ mode: body.mode || "standalone", ...(body.context || {}) });
  if (!client.ok) {
    await settleReads();
    return fail(client.error, client.status || 400);
  }
  const priorDiscovery = body.state;
  const bypass = classifyDiscoveryBypass(text);
  const providerPromise = bypass.bypass
    ? null
    : service.run(
        "discovery_intent",
        { text, state: priorDiscovery, context: { today, timezone: contextTimezone(timezone), diners: participantIds.length, vocabulary }, vocabulary },
        { householdId: session.household_id, fallback: null }
      );
  const [constraints, tastes, recent, catalog] = await Promise.all([reads.constraints, reads.tastes, reads.recent, reads.catalog]);
  const preloaded = { memberIds: householdIds, constraints, tastes, recent, catalog };
  let source = "bypass";
  let model = null;
  let prompt_version = null;
  let fallback_code = null;
  let executedState;
  let dropped = [];
  let conflicts = [];
  let removed = [];
  let modelAck = "";
  let estimatedCost = 0;
  let providerMs = 0;
  let semantic = {};
  if (bypass.bypass && bypass.reason === "lexicon") {
    executedState = bypassDiscoveryPatch(text);
  } else if (bypass.bypass && bypass.reason === "empty") {
    executedState = priorDiscovery || applyDiscoveryDelta(null, {}, {}).state;
  } else {
    const gen = await providerPromise;
    providerMs = Number(gen.provider_latency_ms) || 0;
    estimatedCost = Number(gen.estimated_cost_usd) || 0;
    if (!gen.ok || isEmptyDiscoveryDelta(gen.output)) {
      const unavailable = UNAVAILABLE_GATEWAY.has(gen.error);
      const extracted = keywordDiscoveryInput(text);
      const base = extracted.state;
      if (extracted.text) base.text_residue = extracted.text;
      applyNegationOverlay(base, text);
      semantic = applySharedSemantics(base, { text, concepts: [], task: "discovery_intent" });
      const conflictPass = detectDiscoveryConflicts(base, { participantIds, constraints, tastes, userText: text });
      if (conflictPass.conflicts.length) {
        const repaired = conflictPass.repaired;
        const mapped = discoveryStateToQuery(repaired, {});
        const ran = await runDiscoveryForQuery(env, session, mapped.ok ? mapped.query : normalizeQuery({}).query, client.context, preloaded);
        if (ran.error) return ran.error;
        const ack = reconcileAcknowledgement({
          task: "discovery_intent",
          modelAck: "",
          state: repaired,
          conflicts: conflictPass.conflicts,
          dropped: [],
          removedTokens: conflictPass.removed,
          userText: text,
        });
        return json({
          ok: true,
          task: "discovery_intent",
          source: "fallback",
          fallback_code: gen.error || "empty_delta",
          ...ack,
          state: repaired,
          chips: buildDiscoveryChips(repaired),
          conflicts: conflictPass.conflicts,
          dropped: [],
          suggestions: (ran.payload.total || 0) === 0 ? noResultsSuggestions(repaired) : ack.suggestions || [],
          ...latencyFields({ routeStarted, providerMs, deterministicMs: null }),
          metadata: { estimated_cost_usd: estimatedCost },
          ...ran.payload,
          acknowledgement: ack.acknowledgement,
          acknowledgement_source: "reconciled",
        });
      }
      const normText = normalizeFindText(text).slice(0, 200);
      const searched = extracted.state;
      const hasFilter = searched.text_residue || (searched.ingredients || []).length || (searched.protein_groups || []).length || (searched.exclude_terms || []).length;
      const q = hasFilter
        ? discoveryStateToQuery(searched, { text: searched.text_residue || undefined })
        : normalizeQuery({ text: normText });
      const ran = await runDiscoveryForQuery(env, session, q.ok ? q.query : normalizeQuery({}).query, client.context, preloaded);
      if (ran.error) return ran.error;
      const gentle = unavailable ? FIND_UNAVAILABLE_ACK : null;
      const emptyAck = gentle || ((ran.payload.total || 0) === 0 ? noResultsAcknowledgement([], searched) : null);
      return json({
        ok: true,
        task: "discovery_intent",
        source: "fallback",
        fallback_code: gen.error || "empty_delta",
        acknowledgement_source: emptyAck ? "reconciled" : null,
        state: unavailable ? extracted.state : priorDiscovery,
        chips: unavailable ? buildDiscoveryChips(extracted.state) : [],
        conflicts: [],
        dropped: [],
        suggestions: gentle ? [] : emptyAck ? noResultsSuggestions(searched) : [],
        ...latencyFields({ routeStarted, providerMs, deterministicMs: null }),
        metadata: { estimated_cost_usd: estimatedCost },
        ...ran.payload,
        acknowledgement: emptyAck,
      });
    }
    const applied = applyDiscoveryDelta(priorDiscovery, gen.output, { vocabulary, today, user_text: text });
    dropped = applied.dropped;
    executedState = applied.state;
    applyNegationOverlay(executedState, text);
    semantic = applySharedSemantics(executedState, {
      text,
      concepts: gen.output?.concepts || [],
      task: "discovery_intent",
    });
    model = gen.model;
    prompt_version = gen.prompt_version;
    source = gen.source;
    modelAck = gen.output.acknowledgement;
  }
  const conflictPass = detectDiscoveryConflicts(executedState, { participantIds, constraints, tastes, userText: text });
  conflicts = conflictPass.conflicts;
  removed = conflictPass.removed;
  executedState = conflictPass.repaired;
  let ack = semanticAck(reconcileAcknowledgement({
    task: "discovery_intent",
    modelAck,
    state: executedState,
    conflicts,
    dropped,
    removedTokens: removed,
    userText: text,
  }), semantic, conflicts);
  const mapped = discoveryStateToQuery(executedState, {});
  if (!mapped.ok) return fail(mapped.error, mapped.status || 400);
  const t1 = monotonicNow();
  let ran = await runDiscoveryForQuery(env, session, mapped.query, client.context, preloaded);
  if (ran.error) return ran.error;
  if ((ran.payload.total || 0) === 0) {
    const reason = classifyZeroResult({
      total: 0,
      excludedCounts: ran.payload.excluded_counts,
      state: executedState,
      semantic,
      catalogSize: ran.payload.catalog_size,
    });
    if (canBroadenZero({ reason, state: executedState, semantic })) {
      const broadened = broadenDiscoveryState(executedState);
      const againQuery = discoveryStateToQuery(broadened.state, {});
      if (againQuery.ok) {
        const again = await runDiscoveryForQuery(env, session, againQuery.query, client.context, preloaded);
        if (again.error) return again.error;
        if ((again.payload.total || 0) > 0) {
          executedState = broadened.state;
          ran = again;
          semantic = { ...semantic, broadening: true };
          ack = semanticAck(ack, semantic, conflicts);
        }
      }
    }
  }
  if ((ran.payload.total || 0) === 0 && conflicts.length) {
    for (const step of discoveryRelaxations(executedState)) {
      const relaxedQuery = discoveryStateToQuery(step.state, {});
      if (!relaxedQuery.ok) continue;
      const again = await runDiscoveryForQuery(env, session, relaxedQuery.query, client.context, preloaded);
      if (again.error) return again.error;
      if ((again.payload.total || 0) === 0) continue;
      executedState = step.state;
      ran = again;
      const dish = (step.state.meal_styles || [])[0] || null;
      ack = {
        acknowledgement: withRelaxation(ack.acknowledgement, { relaxed: step.relaxed, dish }),
        acknowledgement_source: "reconciled",
        suggestions: [],
      };
      break;
    }
  }
  const deterministicMs = elapsedMs(t1);
  let suggestions = ack.suggestions || [];
  if ((ran.payload.total || 0) === 0) {
    ack = {
      acknowledgement: noResultsAcknowledgement(conflicts, executedState),
      acknowledgement_source: "reconciled",
      suggestions: noResultsSuggestions(executedState),
    };
    suggestions = ack.suggestions;
  }
  const zeroReason = (ran.payload.total || 0) === 0
    ? classifyZeroResult({
      total: 0,
      excludedCounts: ran.payload.excluded_counts,
      state: executedState,
      semantic,
      catalogSize: ran.payload.catalog_size,
    })
    : null;
  return json(attachTelemetry({
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
    suggestions,
    ...latencyFields({ routeStarted, providerMs, deterministicMs }),
    fallback_code,
    metadata: { estimated_cost_usd: estimatedCost },
    ...ran.payload,
  }, {
    task: "discovery_intent",
    semantic,
    source,
    resultCount: ran.payload.total,
    zeroReason,
  }));
}

function contextTimezone(timezone) {
  return TZ_RE.test(timezone || "") ? timezone : "UTC";
}
