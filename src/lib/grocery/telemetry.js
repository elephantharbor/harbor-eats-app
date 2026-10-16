/**
 * Privacy-safe grocery telemetry. Closed names and props.
 * Never payloads, item names, restrictions, notes, credentials, or URLs.
 */

export const GROCERY_EVENT_PROPS = Object.freeze({
  shop_provider_selected: ["provider_id"],
  shop_review_opened: ["provider_id", "line_count", "revision_sent"],
  shop_handoff_requested: ["provider_id", "line_count", "revision_sent"],
  shop_handoff_created: ["provider_id", "capability", "revision_sent", "line_count", "lifecycle_state"],
  shop_handoff_failed: ["provider_id", "capability", "code", "provider_code", "revision_sent", "line_count", "lifecycle_state"],
  shop_handoff_stale: ["provider_id", "revision_sent", "lifecycle_state"],
  shop_handoff_returned: ["provider_id", "lifecycle_state"],
  shop_handoff_cancelled: ["provider_id", "capability", "code"],
});

const PROVIDERS = new Set(["instacart", "instore"]);
const CODES = new Set([
  "capability_unsupported",
  "not_configured",
  "auth_failed",
  "rate_limited",
  "provider_rejected",
  "invalid_request",
  "timeout",
  "cancelled",
  "revision_conflict",
]);
const STATES = new Set(["prepared", "link_created", "stale", "expired", "failed", "cancelled", "rejected"]);

function clean(key, value) {
  if (value == null) return null;
  if (key === "provider_id") return PROVIDERS.has(value) ? value : null;
  if (key === "capability") {
    return ["in_store", "retailer_discovery", "list_handoff", "cart_create", "price", "availability"].includes(value)
      ? value
      : null;
  }
  if (key === "code") return CODES.has(value) ? value : null;
  if (key === "provider_code") return /^\d{3,4}x?$/.test(String(value)) ? String(value) : null;
  if (key === "lifecycle_state") return STATES.has(value) ? value : null;
  if (key === "line_count" || key === "revision_sent") {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n < 100000 ? n : null;
  }
  return null;
}

export function sanitizeGroceryEvent(name, props) {
  const allow = GROCERY_EVENT_PROPS[name];
  if (!allow) return null;
  const out = {};
  for (const key of allow) {
    const value = clean(key, props ? props[key] : null);
    if (value != null) out[key] = value;
  }
  return out;
}

export async function recordGroceryEvent(env, session, request, deps, name, props) {
  const safe = sanitizeGroceryEvent(name, props);
  if (!safe || !env?.DB || typeof deps?.writeOrigin !== "function") return;
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
