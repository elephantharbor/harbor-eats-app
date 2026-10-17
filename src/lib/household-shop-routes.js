/**
 * Household shopping HTTP.
 * Members share one open list. External HE-SHOP links are snapshots.
 * No grocery provider is called from this module.
 */

import { requireSession } from "./auth.js";
import { findCurrentDinnerPlanId, loadDinnerPlan, saveDinnerPlan } from "./dinner-plan-store.js";
import { shopCookingHeadline } from "./diner-count.js";
import {
  parseMemberShopping,
  parseShoppingSettings,
  shoppingSettingsPatch,
} from "./household-settings.js";
import {
  addGeneralItem,
  clearCompleted,
  deleteGeneralSource,
  editLine,
  exportSections,
  presentLine,
  projectPlanIntoList,
  renderExportCsv,
  renderExportTextFromSections,
  renderRecipeExport,
  recipeYieldLine,
  resolveOverride,
  sanitizeShopEvent,
  setLineState,
  setTripMethod,
  shareSnapshot,
} from "./household-shop.js";
import { renderAppExport } from "./shop-app-export.js";
import { logDatabaseError, stripDatabaseDetail } from "./db-error.js";
import { commitList, insertOpenList, isActiveMember, loadOpenList } from "./household-shop-store.js";
import { applyPlanMutation } from "./plan-mutations.js";

const PRIVATE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Access-Control-Allow-Origin": "*",
      ...headers,
    },
  });
}

function fail(error, status = 400, extra = {}) {
  return json(stripDatabaseDetail({ ok: false, error, ...extra }), status);
}

function shopToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return `HE-SHOP-${hex}`;
}

async function readJson(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

async function memberRow(db, session) {
  return db
    .prepare(`SELECT member_id, status, shopping_prefs_json FROM member WHERE member_id = ? AND household_id = ?`)
    .bind(session.member_id, session.household_id)
    .first();
}

async function householdPrefs(db, householdId) {
  const row = await db.prepare(`SELECT settings_json FROM household WHERE household_id = ?`).bind(householdId).first();
  let prefs = {};
  if (row?.settings_json) {
    try {
      prefs = JSON.parse(row.settings_json);
    } catch {
      prefs = {};
    }
  }
  return prefs;
}

function mealTitleMap(plan) {
  const titles = {};
  for (const meal of plan?.meals || []) {
    if (meal?.meal_id && meal.title) titles[meal.meal_id] = meal.title;
  }
  return titles;
}

function headlineFor(plan, householdCount) {
  if (!plan) return "";
  const recipeMeals = (plan.meals || []).filter((meal) => meal.kind === "recipe");
  return shopCookingHeadline({
    mealCount: plan.meal_count || recipeMeals.length || 0,
    householdCount: householdCount || 1,
    exceptions: [],
  });
}

async function activeMemberCount(db, householdId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS c FROM member WHERE household_id = ? AND status = 'active'`)
    .bind(householdId)
    .first();
  return Number(row?.c) || 1;
}

export const SHOP_PROJECTION_FAILED = "shop_projection_failed";
const SHOP_PROJECTION_CONFLICT_RETRIES = 1;

function projectionFailure(plan) {
  return {
    ok: false,
    error: SHOP_PROJECTION_FAILED,
    status: 500,
    dinner_plan_id: plan?.dinner_plan_id || null,
  };
}

async function openListForPlan(db, plan, now) {
  let list = await loadOpenList(db, plan.household_id);
  if (list) return list;
  try {
    return await insertOpenList(db, plan.household_id, now);
  } catch (error) {
    list = await loadOpenList(db, plan.household_id);
    if (list) return list;
    logDatabaseError("shop_projection", error);
    return null;
  }
}

async function writeProjection(db, list, plan, now, conflictsLeft) {
  const projected = projectPlanIntoList(list, plan, { now });
  if (!projected.changed) return { ok: true, projected: false, unchanged: true, list };
  const saved = await commitList(db, projected.list, list.revision, projected.content_changed);
  if (saved.ok) return { ok: true, projected: true, list: saved.list };
  if (saved.error === "revision_conflict" && conflictsLeft > 0) {
    const fresh = await loadOpenList(db, plan.household_id);
    if (!fresh) return projectionFailure(plan);
    return writeProjection(db, fresh, plan, now, conflictsLeft - 1);
  }
  return projectionFailure(plan);
}

/**
 * Project the current plan onto the household list.
 * The dinner-plan write and this projection are separate batches. A projection
 * failure can leave the plan saved and the list unchanged. That result is
 * `shop_projection_failed`. It is not success.
 * A revision conflict is retried once against the reloaded list. Any other
 * database failure is not retried.
 * Recovery is idempotent and does not insert another plan: call this again
 * for the same plan, or open the household list, which hydrates through here.
 * @returns {Promise<{ ok: boolean, error?: string, status?: number, dinner_plan_id?: string|null, projected?: boolean, list?: object }>}
 */
export async function projectSavedPlan(db, plan, now) {
  if (!plan?.household_id || !plan.dinner_plan_id) return { ok: true, projected: false };
  const stored = await db
    .prepare(`SELECT superseded_at FROM dinner_plan WHERE dinner_plan_id = ?`)
    .bind(plan.dinner_plan_id)
    .first();
  if (stored?.superseded_at) return { ok: true, projected: false };
  const currentId = await findCurrentDinnerPlanId(db, plan.household_id);
  if (currentId !== plan.dinner_plan_id) return { ok: true, projected: false };
  const list = await openListForPlan(db, plan, now);
  if (!list) return projectionFailure(plan);
  return writeProjection(db, list, plan, now, SHOP_PROJECTION_CONFLICT_RETRIES);
}

async function ensureList(db, householdId, now) {
  let list = await loadOpenList(db, householdId);
  if (list) return list;
  try {
    return await insertOpenList(db, householdId, now);
  } catch (error) {
    list = await loadOpenList(db, householdId);
    if (list) return list;
    throw error;
  }
}

async function hydrate(db, list, now) {
  const planId = await findCurrentDinnerPlanId(db, list.household_id);
  if (!planId) return { list, plan: null };
  const plan = await loadDinnerPlan(db, planId);
  if (!plan) return { list, plan: null };
  const projected = await projectSavedPlan(db, plan, now);
  if (!projected.ok) {
    const fresh = await loadOpenList(db, list.household_id);
    return { list: fresh || list, plan };
  }
  return { list: projected.list || list, plan };
}

function present(list, plan) {
  const titles = mealTitleMap(plan);
  return {
    shop_list_id: list.shop_list_id,
    household_id: list.household_id,
    status: list.status,
    revision: list.revision,
    content_revision: list.content_revision,
    dinner_plan_id: list.dinner_plan_id,
    trip_method: list.trip_method,
    updated_at: list.updated_at,
    lines: (list.lines || []).map((line) => presentLine(line, titles)),
  };
}

async function recordShop(env, session, request, deps, name, props) {
  const safe = sanitizeShopEvent(name, props);
  if (!safe || typeof deps.writeOrigin !== "function") return;
  try {
    const origin = await deps.writeOrigin(env, session.household_id, request, {});
    const eventId = `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await env.DB.prepare(
      `INSERT INTO event
        (event_id, event_name, household_id, member_id, plan_id, meal_option_id,
         invite_code, share_object_id, channel, attribution_last_touch, props_json, created_at, data_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        eventId,
        name,
        session.household_id,
        session.member_id,
        null,
        null,
        null,
        null,
        null,
        null,
        JSON.stringify(safe),
        new Date().toISOString(),
        origin
      )
      .run();
  } catch {
    /* telemetry must not block shopping */
  }
}

async function maybeStartShopping(db, list, now) {
  if (!list?.dinner_plan_id) return;
  const touched = (list.lines || []).some((line) => line.list_state === "purchased" || line.list_state === "already_have");
  if (!touched) return;
  const plan = await loadDinnerPlan(db, list.dinner_plan_id);
  if (!plan || plan.shopping_started_at) return;
  const mutated = applyPlanMutation(plan, { op: "start_shopping" }, { now, actor_member_id: plan.created_by_member_id });
  if (mutated.ok) await saveDinnerPlan(db, mutated.plan);
}

function attemptedFrom(body) {
  return {
    op: body.op,
    line_id: body.line_id || null,
    text: body.op === "add_item" ? body.text : undefined,
    client_request_id: body.client_request_id || null,
    list_state: body.list_state || body.patch?.list_state || null,
    patch: body.patch || null,
    trip_method: body.trip_method ?? null,
    keep: body.keep,
  };
}

function conflict(list, plan, attempted) {
  return fail("revision_conflict", 409, {
    revision: list.revision,
    list: present(list, plan),
    attempted: attempted || null,
  });
}

async function mutate(env, session, list, plan, body, now, request, deps) {
  if (Number(body.expected_revision) !== Number(list.revision)) {
    await recordShop(env, session, request, deps, "shopping_conflict", { op: body.op || "write" });
    return conflict(list, plan, attemptedFrom(body));
  }
  const ctx = { now, client_request_id: body.client_request_id || null, id: body.client_request_id || null };
  let result;
  switch (body.op) {
    case "add_item":
      result = addGeneralItem(list, body.text, ctx);
      break;
    case "set_state":
      result = setLineState(list, body, ctx);
      break;
    case "edit_line":
      result = editLine(list, body, ctx);
      break;
    case "delete_general":
      result = deleteGeneralSource(list, body.line_id, ctx);
      break;
    case "resolve_override":
      result = resolveOverride(list, body, ctx);
      break;
    case "clear_completed":
      result = clearCompleted(list, ctx);
      break;
    case "set_trip_method":
      result = setTripMethod(list, body.trip_method ?? null, ctx);
      break;
    default:
      return fail("unknown_mutation");
  }
  if (!result.ok) return fail(result.error, result.status || 400);
  if (!result.changed) {
    return json({ ok: true, list: present(result.list, plan), idempotent: !!result.idempotent });
  }
  const saved = await commitList(env.DB, result.list, list.revision, !!result.content_changed);
  if (!saved.ok) {
    if (saved.error === "shop_save_failed") return fail("shop_save_failed", 500);
    const fresh = await loadOpenList(env.DB, session.household_id);
    if (body.op === "add_item" && body.client_request_id && fresh) {
      const replay = addGeneralItem(fresh, body.text, ctx);
      if (replay.ok && replay.idempotent) {
        return json({ ok: true, list: present(replay.list, plan), idempotent: true, line_id: replay.line_id || null });
      }
    }
    await recordShop(env, session, request, deps, "shopping_conflict", { op: body.op || "write" });
    return conflict(fresh || list, plan, attemptedFrom(body));
  }
  if (body.op === "set_state" || body.op === "edit_line") {
    try {
      await maybeStartShopping(env.DB, saved.list, now);
    } catch {
      /* the list write already committed */
    }
  }
  if (body.op === "add_item") {
    const line = saved.list.lines.find((row) => row.line_id === result.line_id);
    await recordShop(env, session, request, deps, "shopping_item_added", {
      origin: line && (line.requirements || []).some((req) => req.origin === "recipe") ? "mixed" : "general",
      unparsed: line?.unparsed ? 1 : 0,
      has_quantity: line && line.quantity_manual != null ? 1 : 0,
    });
  } else if (body.op === "edit_line") {
    await recordShop(env, session, request, deps, "shopping_item_edited", {
      fields: Object.keys(body.patch || {}).sort().join(","),
    });
  } else if (body.op === "set_state" && body.list_state && body.list_state !== "open") {
    await recordShop(env, session, request, deps, "shopping_item_completed", { list_state: body.list_state });
  } else if (body.op === "set_trip_method") {
    await recordShop(env, session, request, deps, "shopping_mode_selected", {
      mode: body.trip_method || "household",
      scope: "trip",
    });
  }
  const titles = mealTitleMap(plan);
  return json({
    ok: true,
    list: present(saved.list, plan),
    line_id: result.line_id || body.line_id || null,
    meal_titles: titles,
  });
}

async function publicShare(env, token) {
  if (!/^HE-SHOP-[a-f0-9]{48}$/.test(token)) {
    return json({ ok: false, error: "not_found" }, 404, PRIVATE_HEADERS);
  }
  const row = await env.DB.prepare(
    `SELECT share_id, status, expires_at, snapshot_json FROM shop_share WHERE share_id = ?`
  )
    .bind(token)
    .first();
  const now = Date.now();
  const expired = !row || row.status !== "active" || new Date(row.expires_at).getTime() <= now;
  if (expired) return json({ ok: false, error: "not_found" }, 404, PRIVATE_HEADERS);
  let snapshot = {};
  try {
    snapshot = JSON.parse(row.snapshot_json);
  } catch {
    return json({ ok: false, error: "not_found" }, 404, PRIVATE_HEADERS);
  }
  return json({ ok: true, snapshot }, 200, PRIVATE_HEADERS);
}

/**
 * @param {{ DB: any }} env
 * @param {Request} request
 * @param {string} path
 * @param {URL} url
 * @param {{ writeOrigin?: Function }} deps
 */
export async function routeHouseholdShopRequest(env, request, path, url, deps = {}) {
  const method = request.method;
  const publicMatch = path.match(/^\/api\/shop\/shared\/(HE-SHOP-[A-Za-z0-9]+)$/);
  if (publicMatch && method === "GET") return publicShare(env, publicMatch[1]);

  const isShop =
    path === "/api/household-shop" ||
    path === "/api/household-shop/preferences" ||
    path === "/api/household-shop/export" ||
    path === "/api/household-shop/shares" ||
    path === "/api/household-shop/recipe-export";
  if (!isShop) return null;

  const auth = await requireSession(env.DB, request);
  if (auth.error) return auth.error;
  const session = auth.session;
  const member = await memberRow(env.DB, session);
  if (!isActiveMember(member)) return fail("forbidden_member", 403);

  const body = method === "GET" ? {} : await readJson(request);
  if (body === null) return fail("invalid_json");
  if (body.household_id && body.household_id !== session.household_id) return fail("forbidden_cross_household", 403);

  const now = new Date().toISOString();

  if (path === "/api/household-shop/recipe-export" && method === "POST") {
    const dinerCount = Number(body.diner_count);
    const guestCount = Number(body.guest_count) || 0;
    const text = renderRecipeExport({
      title: body.title,
      yieldLine: recipeYieldLine({ dinerCount, guestCount }),
      ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
      steps: Array.isArray(body.steps) ? body.steps : [],
    });
    return json({ ok: true, text, yield_line: recipeYieldLine({ dinerCount, guestCount }) });
  }

  if (path === "/api/household-shop/preferences" && method === "POST") {
    return savePreferences(env, session, member, body, now, request, deps);
  }

  let list = await ensureList(env.DB, session.household_id, now);
  const hydrated = await hydrate(env.DB, list, now);
  list = hydrated.list;
  const plan = hydrated.plan;
  const householdCount = await activeMemberCount(env.DB, session.household_id);
  const headline = headlineFor(plan, householdCount);
  const titles = mealTitleMap(plan);

  if (path === "/api/household-shop/export" && method === "GET") {
    const format = url.searchParams.get("format") || "txt";
    const includeSkipped = url.searchParams.get("skipped") === "1";
    if (format === "app") {
      const payload = renderAppExport(list);
      await recordShop(env, session, request, deps, "shop_export", {
        type: "copy_app",
        ok: true,
        surface: "api",
      });
      return json({
        ok: true,
        format: "app",
        parts: payload.parts,
        part_count: payload.part_count,
        line_count: payload.line_count,
        rows: payload.rows,
      });
    }
    const sections = exportSections(list, { includeSkipped, mealTitles: titles });
    await recordShop(env, session, request, deps, "shopping_list_exported", {
      format: format === "csv" ? "csv" : format === "print" ? "print" : "copy",
    });
    if (format === "csv") {
      return new Response(renderExportCsv(sections), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=\"flavorweave-list.csv\"",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (format === "json") return json({ ok: true, headline, sections });
    return new Response(renderExportTextFromSections(sections, headline), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"flavorweave-list.txt\"",
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (path === "/api/household-shop/shares" && method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT share_id, status, expires_at, created_at, revoked_at
       FROM shop_share
       WHERE household_id = ? AND shop_list_id = ?
       ORDER BY created_at DESC
       LIMIT 20`
    )
      .bind(session.household_id, list.shop_list_id)
      .all();
    const shares = (rows?.results || []).map((row) => ({
      share_id: row.share_id,
      status: new Date(row.expires_at).getTime() <= Date.now() && row.status === "active" ? "expired" : row.status,
      expires_at: row.expires_at,
      created_at: row.created_at,
      revoked_at: row.revoked_at,
    }));
    return json({ ok: true, shares });
  }

  if (path === "/api/household-shop/shares" && method === "POST") {
    if (body.op === "revoke") {
      const row = await env.DB.prepare(
        `SELECT share_id, household_id, status FROM shop_share WHERE share_id = ?`
      )
        .bind(body.share_id)
        .first();
      if (!row || row.household_id !== session.household_id) return fail("not_found", 404);
      await env.DB.prepare(
        `UPDATE shop_share SET status = 'revoked', revoked_at = ? WHERE share_id = ? AND household_id = ?`
      )
        .bind(now, body.share_id, session.household_id)
        .run();
      await recordShop(env, session, request, deps, "shopping_list_shared", { channel: "revoke" });
      return json({ ok: true, share_id: body.share_id, status: "revoked" });
    }
    const shareId = shopToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const snapshot = shareSnapshot(list, { headline, mealTitles: titles });
    await env.DB.prepare(
      `INSERT INTO shop_share
        (share_id, shop_list_id, household_id, created_by_member_id, status, expires_at, created_at, revoked_at, snapshot_json, snapshot_revision)
       VALUES (?, ?, ?, ?, 'active', ?, ?, NULL, ?, ?)`
    )
      .bind(
        shareId,
        list.shop_list_id,
        session.household_id,
        session.member_id,
        expires,
        now,
        JSON.stringify(snapshot),
        list.revision
      )
      .run();
    await recordShop(env, session, request, deps, "shopping_list_shared", { channel: "link" });
    return json({ ok: true, share_id: shareId, expires_at: expires, snapshot }, 201);
  }

  if (path === "/api/household-shop" && method === "GET") {
    const prefs = await householdPrefs(env.DB, session.household_id);
    return json({
      ok: true,
      list: present(list, plan),
      headline,
      preferences: {
        household: parseShoppingSettings(prefs),
        member: parseMemberShopping(member.shopping_prefs_json),
        trip_method: list.trip_method,
      },
    });
  }

  if (path === "/api/household-shop" && method === "POST") {
    return mutate(env, session, list, plan, body, now, request, deps);
  }

  return null;
}

async function savePreferences(env, session, member, body, now, request, deps) {
  const scope = body.scope;
  if (scope === "member") {
    const current = parseMemberShopping(member.shopping_prefs_json);
    const method = body.method === "order_online" || body.method === "instore"
      ? body.method
      : body.method == null || body.method === ""
        ? null
        : current.method;
    const service = body.service === "instacart" || body.service === "none"
      ? body.service
      : body.service == null || body.service === ""
        ? null
        : current.service;
    const next = {
      method,
      service,
      usual_store: body.usual_store != null ? String(body.usual_store).trim().slice(0, 48) : current.usual_store,
    };
    await env.DB.prepare(`UPDATE member SET shopping_prefs_json = ?, updated_at = ? WHERE member_id = ? AND household_id = ?`)
      .bind(JSON.stringify(next), now, session.member_id, session.household_id)
      .run();
    await recordShop(env, session, request, deps, "shopping_mode_selected", {
      mode: next.method || "household",
      scope: "member",
    });
    return json({ ok: true, member: next });
  }
  if (scope !== "household") return fail("scope_invalid");
  const prefs = await householdPrefs(env.DB, session.household_id);
  const shopping = shoppingSettingsPatch(prefs, body);
  const nextPrefs = { ...prefs, shopping };
  await env.DB.prepare(`UPDATE household SET settings_json = ?, updated_at = ? WHERE household_id = ?`)
    .bind(JSON.stringify(nextPrefs), now, session.household_id)
    .run();
  await recordShop(env, session, request, deps, "shopping_mode_selected", {
    mode: shopping.method,
    scope: "household",
  });
  return json({ ok: true, household: shopping });
}
