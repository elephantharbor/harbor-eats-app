/**
 * Server-authoritative dinner plan and shopping routes.
 * Household membership is checked here. Client eligibility flags are ignored.
 */

import { assertSameHousehold, requireSession } from "./auth.js";
import { planDinners } from "./dinner-planner.js";
import { catalogReadsFromD1, loadPublishedCatalog } from "./catalog-runtime.js";
import { applyPlanMutation, createDinnerPlan } from "./plan-mutations.js";
import {
  assertParticipants,
  parsePlanIntent,
  presentDinnerPlan,
  presentDinnerPlanSummary,
} from "./plan-contract.js";
import {
  findCurrentDinnerPlanId,
  householdConstraints,
  householdMemberIds,
  householdTastes,
  listHouseholdDinnerPlans,
  loadDinnerPlan,
  saveDinnerPlan,
} from "./dinner-plan-store.js";
import { projectSavedPlan, SHOP_PROJECTION_FAILED } from "./household-shop-routes.js";
import { logDatabaseError, stripDatabaseDetail } from "./db-error.js";

const COOK_OPS = new Set(["finish_cook", "mark_cooked", "undo_cook"]);

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function fail(error, status = 400, extra = {}) {
  return respond(stripDatabaseDetail({ ok: false, error, ...extra }), status);
}

async function savePlanAndProject(env, plan, now, saveOptions) {
  try {
    await saveDinnerPlan(env.DB, plan, saveOptions);
  } catch (error) {
    if (error && error.code === "revision_conflict") return fail("revision_conflict", 409);
    logDatabaseError("dinner_plan_save", error);
    return fail("dinner_plan_save_failed", 500);
  }
  let projected;
  try {
    projected = await projectSavedPlan(env.DB, plan, now);
  } catch (error) {
    logDatabaseError("shop_projection", error);
    return fail(SHOP_PROJECTION_FAILED, 500, { dinner_plan_id: plan.dinner_plan_id });
  }
  if (!projected.ok) return fail(SHOP_PROJECTION_FAILED, 500, { dinner_plan_id: plan.dinner_plan_id });
  return null;
}

function failureBody(result) {
  const extra = { ...result };
  delete extra.ok;
  delete extra.status;
  delete extra.error;
  return extra;
}

async function readJson(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

function planIdFrom(path, suffix) {
  const match = path.match(new RegExp(`^/api/dinner-plans/([^/]+)${suffix}$`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function contextFor(db, session, origin, now) {
  const [members, constraints, tastes] = await Promise.all([
    householdMemberIds(db, session.household_id),
    householdConstraints(db, session.household_id),
    householdTastes(db, session.household_id),
  ]);
  return {
    now,
    actor_member_id: session.member_id,
    household_member_ids: members,
    constraints,
    data_origin: origin,
    tastes,
  };
}

async function authorizePlan(db, session, dinnerPlanId) {
  const row = await db
    .prepare("SELECT dinner_plan_id, household_id FROM dinner_plan WHERE dinner_plan_id = ?")
    .bind(dinnerPlanId)
    .first();
  if (!row) return { error: fail("plan_not_found", 404) };
  if (row.household_id !== session.household_id) return { error: fail("forbidden_cross_household", 403) };
  return { row };
}

/**
 * @param {{ DB: any }} env
 * @param {Request} request
 * @param {string} path
 * @param {URL} url
 * @param {{ writeOrigin: Function }} deps
 */
export async function routeDinnerPlanRequest(env, request, path, url, deps) {
  const method = request.method;
  const isPreview = path === "/api/dinner-plans/preview" && method === "POST";
  const isCreate = path === "/api/dinner-plans" && method === "POST";
  const isList = method === "GET" && path === "/api/dinner-plans";
  const isCurrent = method === "GET" && path === "/api/dinner-plans/current";
  const isRead = method === "GET" && /^\/api\/dinner-plans\/[^/]+$/.test(path) && !isCurrent;
  const isShop = method === "GET" && /^\/api\/dinner-plans\/[^/]+\/shopping$/.test(path);
  const isMutate = method === "POST" && /^\/api\/dinner-plans\/[^/]+\/mutations$/.test(path);
  if (!isPreview && !isCreate && !isList && !isCurrent && !isRead && !isShop && !isMutate) return null;

  const auth = await requireSession(env.DB, request);
  if (auth.error) return auth.error;
  const session = auth.session;
  const body = method === "GET" ? {} : await readJson(request);
  if (body === null) return fail("invalid_json");
  if (body.household_id && body.household_id !== session.household_id) {
    return fail("forbidden_cross_household", 403);
  }

  const origin = await deps.writeOrigin(env, session.household_id, request, body);
  const now = new Date().toISOString();
  const ctx = await contextFor(env.DB, session, origin, now);
  if (catalogReadsFromD1(env) && (isPreview || isCreate || isMutate)) {
    const loaded = await loadPublishedCatalog(env.DB);
    if (!loaded.ok) return fail(loaded.error || "catalog_unavailable", 503, { detail: loaded.detail || null });
    ctx.catalog = loaded.planner;
    ctx.versions = loaded.versionsById;
  }

  if (isPreview) {
    const parsed = parsePlanIntent({
      ...body,
      ...(body.intent || {}),
      dinner_count: body.dinner_count ?? body.intent?.dinner_count,
      participant_ids: body.participant_ids || body.intent?.participant_ids || ctx.household_member_ids,
      keep_it_easy: body.keep_it_easy ?? body.intent?.keep_it_easy,
      keep_ingredients_simple: body.keep_ingredients_simple ?? body.intent?.keep_ingredients_simple,
    });
    if (!parsed.ok) return fail(parsed.error, parsed.status || 400);
    const mentioned = [
      ...(parsed.intent.participant_ids || []),
      ...(parsed.intent.slots || []).flatMap((slot) => slot.participant_ids || []),
    ];
    const members = assertParticipants([...new Set(mentioned)], ctx.household_member_ids);
    if (!members.ok) return fail(members.error, members.status || 403, { member_ids: members.member_ids });
    const preview = planDinners(parsed.intent, {
      catalog: ctx.catalog,
      constraints: ctx.constraints,
      tastes: ctx.tastes,
      recent_slugs: Array.isArray(body.recent_slugs) ? body.recent_slugs : [],
    });
    return respond({ ok: true, preview, votes_required: false });
  }

  if (isCreate) {
    const created = createDinnerPlan(
      {
        ...body,
        household_id: session.household_id,
        participant_ids: body.participant_ids || ctx.household_member_ids,
      },
      ctx
    );
    if (!created.ok) return fail(created.error, created.status || 400, failureBody(created));
    const saved = await savePlanAndProject(env, created.plan, now, {
      supersedeOtherUnfinished: true,
      supersededAt: now,
    });
    if (saved) return saved;
    return respond(
      {
        ok: true,
        plan: presentDinnerPlan(created.plan),
        unfilled: created.unfilled,
        votes_required: false,
      },
      201
    );
  }

  if (isList || isCurrent) {
    const requestedHousehold = url?.searchParams?.get("household_id");
    if (assertSameHousehold(session, requestedHousehold)) {
      return fail("forbidden_cross_household", 403);
    }
    const currentId = await findCurrentDinnerPlanId(env.DB, session.household_id);
    const current = currentId ? await loadDinnerPlan(env.DB, currentId) : null;
    const presented = current ? presentDinnerPlan(current) : null;
    if (isCurrent) return respond({ ok: true, plan: presented });
    const rows = await listHouseholdDinnerPlans(env.DB, session.household_id);
    return respond({
      ok: true,
      current: presented,
      plans: rows.map(presentDinnerPlanSummary),
    });
  }

  const dinnerPlanId = planIdFrom(path, isShop ? "/shopping" : isMutate ? "/mutations" : "");
  const access = await authorizePlan(env.DB, session, dinnerPlanId);
  if (access.error) return access.error;
  const plan = await loadDinnerPlan(env.DB, dinnerPlanId);
  if (!plan) return fail("plan_not_found", 404);

  if (isRead || isShop) {
    const presented = presentDinnerPlan(plan);
    if (isShop) {
      return respond({
        ok: true,
        dinner_plan_id: plan.dinner_plan_id,
        status: presented.status,
        status_label: presented.status_label,
        shopping_started: presented.shopping_started,
        shopping_started_at: plan.shopping_started_at,
        lines: plan.shop_lines,
        deltas: plan.shop_deltas,
      });
    }
    return respond({ ok: true, plan: presented });
  }

  if (
    COOK_OPS.has(body.op) &&
    body.expected_updated_at &&
    body.expected_updated_at !== plan.updated_at
  ) {
    return fail("revision_conflict", 409, { plan: presentDinnerPlan(plan) });
  }
  const mutated = applyPlanMutation(plan, body, ctx);
  if (!mutated.ok) return fail(mutated.error, mutated.status || 400, failureBody(mutated));
  if (mutated.unchanged) {
    return respond({
      ok: true,
      plan: presentDinnerPlan(plan),
      votes_required: false,
      votes_cast: mutated.votes_cast,
      shopping_started: mutated.shopping_started,
      completed: false,
      already_cooked: !!mutated.already_cooked,
      unchanged: true,
      prior_state: mutated.prior_state,
      undone: false,
    });
  }
  const saved = await savePlanAndProject(env, mutated.plan, now, {
    expectedUpdatedAt: COOK_OPS.has(body.op) ? body.expected_updated_at || null : null,
  });
  if (saved) return saved;
  return respond({
    ok: true,
    plan: presentDinnerPlan(mutated.plan),
    votes_required: false,
    votes_cast: mutated.votes_cast,
    shopping_started: mutated.shopping_started,
    completed: !!mutated.completed,
    already_cooked: false,
    unchanged: false,
    prior_state: mutated.prior_state,
    undone: !!mutated.undone,
  });
}
