/**
 * Grocery HTTP. Session required. A handoff never edits the household list.
 */

import { requireSession } from "../auth.js";
import { logDatabaseError, stripDatabaseDetail } from "../db-error.js";
import { householdIsSynthetic } from "../evidence-origin.js";
import { parseMemberShopping, parseShoppingSettings } from "../household-settings.js";
import { buyQuantity, presentLine } from "../household-shop.js";
import { isActiveMember, loadOpenList } from "../household-shop-store.js";
import { linkbackUrl } from "./allowlist.js";
import { INSTACART_CTA_LABEL, INSTACART_LOGO_PRESENT } from "./branding.js";
import { groceryEnvForRequest, instacartActivation, productionLocked } from "./config.js";
import { groceryError } from "./errors.js";
import { contentFingerprintInput, fingerprint, requestFingerprintInput } from "./fingerprint.js";
import {
  findReusableHandoff,
  getHandoff,
  insertHandoff,
  latestHandoff,
  newHandoffId,
  refreshHandoffStates,
  updateHandoff,
} from "./handoff-store.js";
import { instacartFetchIsMock } from "./instacart.js";
import { projectTransfer } from "./projection.js";
import { adapterFor, createGroceryAdapters } from "./registry.js";
import { recordGroceryEvent } from "./telemetry.js";

const LINK_DAYS = 14;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function fail(error, status) {
  const body =
    error && typeof error === "object" && error.code
      ? error
      : groceryError({ code: typeof error === "string" ? error : "invalid_request", message: "That didn’t work." });
  return json(stripDatabaseDetail(body), status || body.status || 400);
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

async function usualStore(db, session) {
  const household = await db.prepare(`SELECT settings_json FROM household WHERE household_id = ?`).bind(session.household_id).first();
  let prefs = {};
  if (household?.settings_json) {
    try {
      prefs = JSON.parse(household.settings_json);
    } catch {
      prefs = {};
    }
  }
  const member = await memberRow(db, session);
  const householdShop = parseShoppingSettings(prefs);
  const memberShop = parseMemberShopping(member?.shopping_prefs_json);
  return memberShop.usual_store || householdShop.usual_store || "";
}

function publicHandoff(row, { includeUrl }) {
  if (!row) return null;
  return {
    handoff_id: row.handoff_id,
    provider_id: row.provider_id,
    status: row.status,
    expires_at: row.expires_at,
    error_code: row.error_code,
    provider_code: row.provider_code,
    line_count: row.line_count,
    products_link_url: includeUrl && row.status === "link_created" ? row.products_link_url : undefined,
  };
}

function reviewBody({ list, projection, requestHash, contentHash, store, activation, handoff }) {
  const storeNote = store
    ? `You usually shop at ${store}. You’ll confirm the store on Instacart.`
    : null;
  return {
    ok: true,
    provider_id: "instacart",
    destination: "Instacart",
    destination_note: "Continues on Instacart. They choose the store and the products.",
    usual_store_note: storeNote,
    transferable_count: projection.transferable_count,
    included: projection.included.map((line) => ({
      line_id: line.line_id,
      display_text: line.display_text,
      quantity_label: line.quantity_label,
    })),
    staying: projection.staying,
    fingerprint: requestHash,
    revision: list.revision,
    content_revision: list.content_revision,
    launch_enabled: INSTACART_LOGO_PRESENT,
    cta_label: INSTACART_CTA_LABEL,
    mode: activation.mode,
    channel: activation.channel,
    can_prepare: activation.mode === "mock" || INSTACART_LOGO_PRESENT,
    copy: {
      availability: "Instacart will show what’s at the store you pick. FlavorWeave doesn’t see that stock.",
      substitutions: "You’ll confirm products on Instacart. FlavorWeave won’t swap items for you.",
      cta_disabled_reason: "The official Instacart logo isn’t in this app yet, so the button stays off.",
      staying_title: "Staying on your FlavorWeave list",
      going_title: "Going to Instacart",
      return: "Your list is still here.",
    },
    handoff: publicHandoff(handoff, { includeUrl: false }),
    content_fingerprint: contentHash,
  };
}

async function hashesFor(list, projection) {
  const contentHash = await fingerprint(
    contentFingerprintInput(
      (list.lines || [])
        .filter((line) => line.still_needed === 1 || line.still_needed === true)
        .map((line) => ({
          line_id: line.line_id,
          display_name: line.display_name,
          unit: line.unit,
          buy_quantity: buyQuantity(line),
          override_stale: line.override_stale,
          still_needed: 1,
        }))
    )
  );
  const requestHash = await fingerprint(requestFingerprintInput("instacart", projection.included));
  return { contentHash, requestHash };
}

function listSnapshot(list) {
  return {
    shop_list_id: list.shop_list_id,
    revision: list.revision,
    content_revision: list.content_revision,
    lines: (list.lines || []).map((line) => presentLine(line)),
  };
}

async function requireShopper(env, request) {
  const auth = await requireSession(env.DB, request);
  if (auth.error) return { error: auth.error };
  const member = await memberRow(env.DB, auth.session);
  if (!isActiveMember(member)) return { error: fail(groceryError({ code: "auth_failed", message: "Sign in again to shop.", status: 403 }), 403) };
  return { session: auth.session };
}

function publicDiagnostic(diagnostic) {
  return {
    http_status: diagnostic?.http_status ?? null,
    request_id: diagnostic?.request_id ?? null,
  };
}

async function devSmoke(env, request, session) {
  const household = await env.DB.prepare(
    `SELECT data_origin, display_name, acquisition_source FROM household WHERE household_id = ?`
  )
    .bind(session.household_id)
    .first();
  const synthetic =
    householdIsSynthetic(household) || /^\[synthetic\]/i.test(String(household?.display_name || "").trim());
  if (!synthetic) {
    return json(
      {
        ok: false,
        error: "synthetic_household_required",
        called: false,
        blocker: "Development smoke only runs for a synthetic household. No Instacart call was made.",
      },
      403
    );
  }
  const activation = instacartActivation(env);
  if (activation.mode !== "live" || activation.channel !== "development") {
    const missing = activation.reason === "dev_key_missing";
    return json(
      {
        ok: false,
        error: missing ? "dev_key_missing" : "not_configured",
        called: false,
        channel: activation.channel,
        blocker: missing
          ? "INSTACART_API_KEY is not set on this server. No Instacart call was made."
          : "Development mode is not selected. Set the GROCERY_RUNTIME secret to dev, or send X-FlavorWeave-Grocery-Mode: dev. No Instacart call was made.",
      },
      409
    );
  }
  if (instacartFetchIsMock(env)) {
    return json(
      {
        ok: false,
        error: "mock_not_live",
        called: false,
        blocker: "Development smoke will not treat the mock as a real Instacart call. No Instacart call was made.",
      },
      409
    );
  }
  const linkback = linkbackUrl(request.url) || "https://harbor-eats-app.pages.dev/shop";
  const adapter = adapterFor("instacart", { env });
  const result = await adapter.createListHandoff({
    title: "FlavorWeave list",
    linkback_url: linkback,
    lines: [{ name: "banana", display_text: "1 banana", measurements: [{ quantity: 1, unit: "each" }] }],
    expires_in_days: LINK_DAYS,
  });
  const urlOk = !!(result.ok && result.products_link_url);
  const body = stripDatabaseDetail({
    ok: urlOk,
    called: true,
    channel: "development",
    host_class: "development",
    error: result.ok ? null : result.code || "provider_rejected",
    url_valid: urlOk,
    products_link_url: urlOk ? result.products_link_url : undefined,
    diagnostic: publicDiagnostic(result.diagnostic),
    purchased: false,
    message: urlOk
      ? "Development link created. Nothing was marked bought."
      : "Instacart did not return a usable development link. Nothing was marked bought.",
  });
  return json(body, urlOk ? 200 : result.status || 502);
}

export async function routeGroceryRequest(env, request, path, url, deps = {}) {
  if (!path.startsWith("/api/grocery")) return null;
  if (path === "/api/grocery/dev-smoke" && productionLocked(env)) {
    return json({ ok: false, error: "not_found" }, 404);
  }
  env = groceryEnvForRequest(env, request);
  const method = request.method;
  const gate = await requireShopper(env, request);
  if (gate.error) return gate.error;
  const session = gate.session;
  const now = new Date().toISOString();

  if (path === "/api/grocery/capabilities" && method === "GET") {
    const adapters = createGroceryAdapters({ env });
    const providers = [];
    const instore = adapters.instore;
    providers.push({
      id: instore.id,
      display_name: "Shop in store",
      capabilities: [...instore.capabilities()],
      fulfillment_methods: [...instore.fulfillmentMethods()],
      configured: true,
    });
    const activation = instacartActivation(env);
    if (activation.configured) {
      const instacart = adapters.instacart;
      providers.push({
        id: instacart.id,
        display_name: "Instacart",
        capabilities: [...instacart.capabilities()],
        fulfillment_methods: [...instacart.fulfillmentMethods()],
        configured: true,
        mode: activation.mode,
        channel: activation.channel,
        launch_enabled: INSTACART_LOGO_PRESENT,
      });
    }
    return json({ ok: true, providers });
  }

  if (path === "/api/grocery/dev-smoke" && method === "POST") {
    return devSmoke(env, request, session);
  }

  if (path === "/api/grocery/select" && method === "POST") {
    const body = await readJson(request);
    if (body === null) return fail("invalid_json");
    await recordGroceryEvent(env, session, request, deps, "shop_provider_selected", { provider_id: body.provider_id });
    return json({ ok: true });
  }

  if (path === "/api/grocery/return" && method === "POST") {
    const body = await readJson(request);
    if (body === null) return fail("invalid_json");
    await recordGroceryEvent(env, session, request, deps, "shop_handoff_returned", {
      provider_id: body.provider_id === "instacart" ? "instacart" : null,
      lifecycle_state: "link_created",
    });
    return json({ ok: true, message: "Your list is still here." });
  }

  if (path === "/api/grocery/operation" && method === "POST") {
    const body = await readJson(request);
    if (body === null) return fail("invalid_json");
    const adapter = adapterFor(body.provider_id, { env });
    if (!adapter) return fail(groceryError({ code: "invalid_request", provider_id: body.provider_id || null, message: "That shop isn’t available." }));
    // A list handoff only goes through review → /api/grocery/handoff, which checks the
    // revision and the reviewed fingerprint, stores the row, and keeps the URL behind the
    // logo gate. This generic probe never sends client-supplied lines to a provider.
    if (body.capability === "list_handoff") {
      return fail(
        groceryError({
          code: "invalid_request",
          provider_id: body.provider_id,
          capability: "list_handoff",
          message: "Review the list before sending it.",
        })
      );
    }
    const result = await adapter.invoke(body.capability, body);
    if (!result.ok) return fail(result);
    return json(result);
  }

  if (path === "/api/grocery/retailers" && method === "POST") {
    const body = await readJson(request);
    if (body === null) return fail("invalid_json");
    const adapter = adapterFor("instacart", { env });
    const result = await adapter.invoke("retailer_discovery", {
      postal_code: body.postal_code,
      country_code: body.country_code,
    });
    if (!result.ok) return fail(result);
    return json({ ok: true, retailers: result.retailers });
  }

  if (path === "/api/grocery/review" && method === "POST") {
    return review(env, request, session, deps, now);
  }
  if (path === "/api/grocery/handoff" && method === "POST") {
    return create(env, request, session, deps, now, url);
  }
  if (path === "/api/grocery/handoff/cancel" && method === "POST") {
    return cancel(env, request, session, deps, now);
  }
  return fail(groceryError({ code: "capability_unsupported", message: "That grocery action isn’t available." }), 404);
}

async function loadShop(env, session) {
  const list = await loadOpenList(env.DB, session.household_id);
  if (!list) return null;
  return list;
}

async function review(env, request, session, deps, now) {
  const body = await readJson(request);
  if (body === null) return fail("invalid_json");
  if (body.provider_id !== "instacart") {
    return fail(groceryError({ code: "invalid_request", message: "Choose Instacart or shop in store." }));
  }
  const activation = instacartActivation(env);
  if (!activation.configured) return fail(groceryError({ code: "not_configured", provider_id: "instacart", capability: "list_handoff", message: "Online ordering is not connected." }));
  const list = await loadShop(env, session);
  if (!list) return fail(groceryError({ code: "invalid_request", message: "The list isn’t open yet." }), 404);
  const projection = projectTransfer(list);
  const { contentHash, requestHash } = await hashesFor(list, projection);
  if (body.expected_revision != null && Number(body.expected_revision) !== Number(list.revision)) {
    return json(
      {
        ok: false,
        code: "revision_conflict",
        error: "revision_conflict",
        retryable: false,
        provider_id: "instacart",
        message: "The list changed. Review it again before sending.",
        revision: list.revision,
        list: listSnapshot(list),
        review: reviewBody({
          list,
          projection,
          requestHash,
          contentHash,
          store: await usualStore(env.DB, session),
          activation,
          handoff: null,
        }),
      },
      409
    );
  }
  const staleChanges = await refreshHandoffStates(env.DB, {
    shopListId: list.shop_list_id,
    providerId: "instacart",
    contentFingerprint: contentHash,
    now,
  });
  if (staleChanges) {
    await recordGroceryEvent(env, session, request, deps, "shop_handoff_stale", {
      provider_id: "instacart",
      revision_sent: list.revision,
      lifecycle_state: "stale",
    });
  }
  const handoff = await latestHandoff(env.DB, { shopListId: list.shop_list_id, providerId: "instacart" });
  await recordGroceryEvent(env, session, request, deps, "shop_review_opened", {
    provider_id: "instacart",
    line_count: projection.transferable_count,
    revision_sent: list.revision,
  });
  return json(
    reviewBody({
      list,
      projection,
      requestHash,
      contentHash,
      store: await usualStore(env.DB, session),
      activation,
      handoff,
    })
  );
}

async function create(env, request, session, deps, now, url) {
  const body = await readJson(request);
  if (body === null) return fail("invalid_json");
  const activation = instacartActivation(env);
  if (!activation.configured) {
    return fail(groceryError({ code: "not_configured", provider_id: "instacart", capability: "list_handoff", message: "Online ordering is not connected." }));
  }
  const list = await loadShop(env, session);
  if (!list) return fail(groceryError({ code: "invalid_request", message: "The list isn’t open yet." }), 404);
  const projection = projectTransfer(list);
  const { contentHash, requestHash } = await hashesFor(list, projection);
  if (Number(body.expected_revision) !== Number(list.revision)) {
    await recordGroceryEvent(env, session, request, deps, "shop_handoff_failed", {
      provider_id: "instacart",
      capability: "list_handoff",
      code: "revision_conflict",
      revision_sent: list.revision,
      line_count: projection.transferable_count,
      lifecycle_state: "prepared",
    });
    return json(
      {
        ok: false,
        code: "revision_conflict",
        error: "revision_conflict",
        retryable: false,
        provider_id: "instacart",
        message: "The list changed. Review it again before sending.",
        revision: list.revision,
        list: listSnapshot(list),
      },
      409
    );
  }
  if (body.reviewed_fingerprint !== requestHash) {
    return fail(
      groceryError({
        code: "invalid_request",
        provider_id: "instacart",
        capability: "list_handoff",
        message: "Review the list again before sending.",
      })
    );
  }
  if (!projection.included.length) {
    return fail(
      groceryError({
        code: "invalid_request",
        provider_id: "instacart",
        capability: "list_handoff",
        message: "Nothing on this list can go to Instacart yet.",
      })
    );
  }
  const linkback = linkbackUrl(url?.toString() || request.url);
  if (!linkback) {
    return fail(groceryError({ code: "invalid_request", provider_id: "instacart", message: "The return link isn’t ready." }));
  }
  await recordGroceryEvent(env, session, request, deps, "shop_handoff_requested", {
    provider_id: "instacart",
    line_count: projection.transferable_count,
    revision_sent: list.revision,
  });
  const staleChanges = await refreshHandoffStates(env.DB, {
    shopListId: list.shop_list_id,
    providerId: "instacart",
    contentFingerprint: contentHash,
    now,
  });
  if (staleChanges) {
    await recordGroceryEvent(env, session, request, deps, "shop_handoff_stale", {
      provider_id: "instacart",
      revision_sent: list.revision,
      lifecycle_state: "stale",
    });
  }
  const existing = await findReusableHandoff(env.DB, {
    shopListId: list.shop_list_id,
    providerId: "instacart",
    requestHash,
  });
  if (existing) {
    await recordGroceryEvent(env, session, request, deps, "shop_handoff_created", {
      provider_id: "instacart",
      capability: "list_handoff",
      revision_sent: list.revision,
      line_count: existing.line_count,
      lifecycle_state: "link_created",
    });
    return json(createdBody(existing, { reused: true }));
  }
  const handoffId = newHandoffId();
  const base = {
    handoff_id: handoffId,
    shop_list_id: list.shop_list_id,
    household_id: session.household_id,
    provider_id: "instacart",
    link_type: "shopping_list",
    revision_sent: list.revision,
    content_revision_sent: list.content_revision,
    request_hash: requestHash,
    content_fingerprint: contentHash,
    line_count: projection.transferable_count,
    excluded_count: projection.staying.length,
    created_by_member_id: session.member_id,
    created_at: now,
    updated_at: now,
    retailer_key: null,
  };
  await insertHandoff(env.DB, { ...base, status: "prepared" });
  const adapter = adapterFor("instacart", { env });
  const result = await adapter.createListHandoff({
    title: "FlavorWeave list",
    linkback_url: linkback,
    lines: projection.included,
    expires_in_days: LINK_DAYS,
  });
  if (!result.ok) {
    const status = result.destination_rejected ? "rejected" : "failed";
    await updateHandoff(env.DB, handoffId, {
      status,
      error_code: result.code,
      provider_code: result.provider_code,
      updated_at: new Date().toISOString(),
    });
    await recordGroceryEvent(env, session, request, deps, "shop_handoff_failed", {
      provider_id: "instacart",
      capability: "list_handoff",
      code: result.code,
      provider_code: result.provider_code,
      revision_sent: list.revision,
      line_count: projection.transferable_count,
      lifecycle_state: status,
    });
    return fail(result);
  }
  try {
    await updateHandoff(env.DB, handoffId, {
      status: "link_created",
      products_link_url: result.products_link_url,
      expires_at: result.expires_at,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    logDatabaseError("grocery_handoff", error);
    if (!/UNIQUE/i.test(String(error.message || error))) {
      return fail(
        groceryError({
          code: "provider_rejected",
          provider_id: "instacart",
          capability: "list_handoff",
          message: "The list link could not be saved. Your list was not changed.",
        })
      );
    }
    const winner = await findReusableHandoff(env.DB, {
      shopListId: list.shop_list_id,
      providerId: "instacart",
      requestHash,
    });
    await updateHandoff(env.DB, handoffId, { status: "failed", error_code: "provider_rejected", updated_at: new Date().toISOString() });
    if (winner && winner.products_link_url === result.products_link_url) return json(createdBody(winner, { reused: true }));
    if (winner) {
      await updateHandoff(env.DB, winner.handoff_id, {
        status: "stale",
        products_link_url: winner.products_link_url,
        expires_at: winner.expires_at,
        updated_at: new Date().toISOString(),
      });
    }
    await recordGroceryEvent(env, session, request, deps, "shop_handoff_failed", {
      provider_id: "instacart",
      capability: "list_handoff",
      code: "provider_rejected",
      revision_sent: list.revision,
      line_count: projection.transferable_count,
      lifecycle_state: "stale",
    });
    return fail(
      groceryError({
        code: "provider_rejected",
        provider_id: "instacart",
        capability: "list_handoff",
        message: "Instacart sent two links. Send the list again when you want a fresh one.",
      })
    );
  }
  const stored = await getHandoff(env.DB, handoffId);
  await recordGroceryEvent(env, session, request, deps, "shop_handoff_created", {
    provider_id: "instacart",
    capability: "list_handoff",
    revision_sent: list.revision,
    line_count: projection.transferable_count,
    lifecycle_state: "link_created",
  });
  return json(createdBody(stored, { reused: false }));
}

function createdBody(row, { reused }) {
  const launch = INSTACART_LOGO_PRESENT && row.status === "link_created";
  return {
    ok: true,
    handoff_id: row.handoff_id,
    status: row.status,
    expires_at: row.expires_at,
    reused,
    launch_enabled: INSTACART_LOGO_PRESENT,
    destination_accepted: row.status === "link_created",
    purchased: false,
    message: "Your list is still here. Nothing was marked bought.",
    products_link_url: launch ? row.products_link_url : undefined,
  };
}

async function cancel(env, request, session, deps, now) {
  const body = await readJson(request);
  if (body === null) return fail("invalid_json");
  const row = await getHandoff(env.DB, body.handoff_id);
  if (!row || row.household_id !== session.household_id) {
    return fail(groceryError({ code: "invalid_request", message: "That link isn’t on this list." }), 404);
  }
  if (row.status === "link_created" || row.status === "prepared") {
    await updateHandoff(env.DB, row.handoff_id, {
      status: "cancelled",
      products_link_url: row.products_link_url,
      expires_at: row.expires_at,
      updated_at: now,
    });
  }
  await recordGroceryEvent(env, session, request, deps, "shop_handoff_cancelled", {
    provider_id: "instacart",
    capability: "list_handoff",
    code: "cancelled",
  });
  return json({ ok: true, status: "cancelled", message: "Your list is still here." });
}
