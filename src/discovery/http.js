/**
 * POST and GET /api/discovery/search.
 * Read-only. The published D1 catalog is the only candidate source.
 * Household eligibility and tastes are loaded here. The client does not
 * send them. Choosing a result is a later dinner-plan mutation; this
 * route does not write a plan.
 */

import { requireSession } from "../lib/auth.js";
import { catalogReadsFromD1, loadPublishedCatalog } from "../lib/catalog-runtime.js";
import {
  householdConstraints,
  householdMemberIds,
  householdTastes,
  loadDinnerPlan,
} from "../lib/dinner-plan-store.js";
import { householdIsSynthetic, sqlRealRow } from "../lib/evidence-origin.js";
import { selectionFor, normalizeClientContext, publicContext, resolveDiscoveryContext } from "./context.js";
import { DISCOVERY_SCHEMA_VERSION } from "./constants.js";
import { projectDiscoveryMeal } from "./meal.js";
import { canonicalQuery, parseQuery, queryFromSearchParams } from "./query.js";
import { runDiscoveryPipeline } from "./pipeline.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
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

const BODY_KEYS = new Set(["schema_version", "mode", "context", "query"]);

function clientContextFromParams(params) {
  /** @type {Record<string, unknown>} */
  const input = {};
  if (params.has("mode")) input.mode = params.get("mode");
  if (params.has("dinner_plan_id")) input.dinner_plan_id = params.get("dinner_plan_id");
  if (params.has("meal_id")) input.meal_id = params.get("meal_id");
  if (params.has("position")) input.position = Number(params.get("position"));
  const participants = params.getAll("participant_id").filter(Boolean);
  if (participants.length) input.participant_ids = participants;
  const exclude = params.getAll("exclude_slug").flatMap((value) => String(value).split(",")).filter((value) => value.trim());
  if (exclude.length) input.exclude_slugs = exclude;
  return input;
}

/**
 * @param {Request} request
 * @param {URL} url
 */
export async function parseDiscoveryHttp(request, url) {
  if (request.method === "GET") {
    const params = url.searchParams;
    const built = queryFromSearchParams(params);
    if (!built.ok) return built;
    const query = parseQuery(built.input);
    if (!query.ok) return query;
    const client = normalizeClientContext(clientContextFromParams(params));
    if (!client.ok) return client;
    return { ok: true, query: query.query, client: client.context };
  }
  if (request.method !== "POST") return { ok: false, error: "method_not_allowed", status: 405 };
  const body = await readJson(request);
  if (body === null) return { ok: false, error: "invalid_json", status: 400 };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "query_invalid", status: 400 };
  const unknown = Object.keys(body).find((key) => !BODY_KEYS.has(key));
  if (unknown) return { ok: false, error: "unknown_field", status: 400 };
  if (body.schema_version != null && body.schema_version !== DISCOVERY_SCHEMA_VERSION && body.schema_version !== "1") {
    return { ok: false, error: "schema_version_unsupported", status: 400 };
  }
  const query = parseQuery(body.query || {});
  if (!query.ok) return query;
  const contextInput = { ...(body.context || {}) };
  if (body.mode != null) contextInput.mode = body.mode;
  const client = normalizeClientContext(contextInput);
  if (!client.ok) return client;
  return { ok: true, query: query.query, client: client.context };
}

/**
 * Same recent-cook window as loadRecommendationContext. Dinner-plan history
 * is not a second list. A missing cook table leaves recency empty and says so.
 * @param {object} db
 * @param {string} householdId
 */
export async function loadDiscoveryRecentSlugs(db, householdId) {
  try {
    const household = await db
      .prepare("SELECT household_id, data_origin, acquisition_source FROM household WHERE household_id = ?")
      .bind(householdId)
      .first();
    const realOnly = household ? !householdIsSynthetic(household) : true;
    const cookOriginSql = realOnly ? `AND ${sqlRealRow("c")}` : "";
    const recentCooks = await db
      .prepare(
        `SELECT mo.recipe_slug FROM cook c
         JOIN meal_option mo ON mo.meal_option_id = c.meal_option_id
         WHERE c.household_id = ? ${cookOriginSql}
         ORDER BY c.cooked_at DESC LIMIT 8`
      )
      .bind(householdId)
      .all();
    return {
      recent_slugs: (recentCooks.results || []).map((row) => row.recipe_slug).filter(Boolean),
      recent_source: "cook",
    };
  } catch {
    return { recent_slugs: [], recent_source: "unavailable" };
  }
}

function discoveryResponse(loaded, query, context, recentSource) {
  const meals = loaded.planner.map(projectDiscoveryMeal);
  const ran = runDiscoveryPipeline(meals, query, context);
  return {
    ok: true,
    schema_version: DISCOVERY_SCHEMA_VERSION,
    mode: context.mode,
    catalog_source: "d1",
    catalog_size: meals.length,
    query: canonicalQuery(query),
    context: publicContext(context),
    soft: context.soft,
    soft_source: context.soft_source,
    selection: selectionFor(context),
    excluded_counts: ran.excluded_counts,
    trace: ran.trace,
    results: ran.results,
    limit: query.limit,
    offset: query.offset,
    total: ran.total,
    recent_source: recentSource,
  };
}

/**
 * @param {{ DB: object, CATALOG_SOURCE?: string }} env
 * @param {Request} request
 * @param {string} path
 * @param {URL} url
 * @returns {Promise<Response|null>}
 */
export async function routeDiscoveryRequest(env, request, path, url) {
  if (path !== "/api/discovery/search") return null;
  if (request.method !== "GET" && request.method !== "POST") return fail("method_not_allowed", 405);
  if (!catalogReadsFromD1(env)) return fail("catalog_source_required", 503, { catalog_source: "d1" });

  const auth = await requireSession(env.DB, request);
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsed = await parseDiscoveryHttp(request, url);
  if (!parsed.ok) return fail(parsed.error, parsed.status || 400);

  const loaded = await loadPublishedCatalog(env.DB);
  if (!loaded.ok) return fail(loaded.error || "catalog_unavailable", 503, { detail: loaded.detail || null });

  const [memberIds, constraints, tastes, recent] = await Promise.all([
    householdMemberIds(env.DB, session.household_id),
    householdConstraints(env.DB, session.household_id),
    householdTastes(env.DB, session.household_id),
    loadDiscoveryRecentSlugs(env.DB, session.household_id),
  ]);

  let plan = null;
  if (parsed.client.dinner_plan_id) {
    plan = await loadDinnerPlan(env.DB, parsed.client.dinner_plan_id);
    if (!plan) return fail("plan_not_found", 404);
    if (plan.household_id !== session.household_id) return fail("forbidden_cross_household", 403);
  }

  const resolved = resolveDiscoveryContext(parsed.client, {
    household_id: session.household_id,
    member_ids: memberIds,
    constraints,
    tastes,
    recent_slugs: recent.recent_slugs,
    recent_source: recent.recent_source,
    plan,
  }, parsed.query);
  if (!resolved.ok) return fail(resolved.error, resolved.status || 400);

  return json(discoveryResponse(loaded, parsed.query, resolved.context, recent.recent_source));
}
