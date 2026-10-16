/**
 * Household settings persisted on household row + settings_json blob.
 */

export const DEFAULT_MEAL_CHOICE_COUNT = 3;
export const MAX_MEAL_CHOICE_COUNT = 5;
export const DEFAULT_CADENCE = "on_demand";

/**
 * @param {Record<string, unknown>|null|undefined} row
 */
export function parseHouseholdSettings(row) {
  let prefs = {};
  if (row && row.settings_json) {
    try {
      prefs = JSON.parse(String(row.settings_json));
    } catch {
      prefs = {};
    }
  }
  const meal_choice_count = clampChoiceCount(
    row && row.meal_choice_count != null ? Number(row.meal_choice_count) : DEFAULT_MEAL_CHOICE_COUNT
  );
  const scheduling_cadence =
    (row && row.scheduling_cadence) || prefs.scheduling_cadence || DEFAULT_CADENCE;
  return {
    display_name: (row && row.display_name) || "",
    meal_choice_count,
    scheduling_cadence,
    prefs: {
      spice_level: prefs.spice_level || "medium",
      exploration_appetite: prefs.exploration_appetite || "balanced",
      ...prefs,
    },
  };
}

function cleanLabel(value, max) {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ").slice(0, max);
}

/**
 * Household shopping defaults. A typed store is a label, not a provider.
 * Missing values stay at the in-store default. Nothing here is inferred.
 */
export function parseShoppingSettings(prefs) {
  const raw = prefs && typeof prefs.shopping === "object" && prefs.shopping ? prefs.shopping : {};
  return {
    method: raw.method === "order_online" ? "order_online" : "instore",
    service: raw.service === "instacart" ? "instacart" : "none",
    usual_store: cleanLabel(raw.usual_store, 48),
    postal_code: cleanLabel(raw.postal_code, 12),
  };
}

export function shoppingSettingsPatch(currentPrefs, patch) {
  const current = parseShoppingSettings(currentPrefs);
  const next = { ...current };
  if (patch.method != null) next.method = patch.method === "order_online" ? "order_online" : "instore";
  if (patch.service != null) next.service = patch.service === "instacart" ? "instacart" : "none";
  if (patch.usual_store != null) next.usual_store = cleanLabel(patch.usual_store, 48);
  if (patch.postal_code != null) next.postal_code = cleanLabel(patch.postal_code, 12);
  return next;
}

export function parseMemberShopping(rawJson) {
  let raw = {};
  if (rawJson) {
    try {
      raw = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== "object") raw = {};
  return {
    method: raw.method === "order_online" || raw.method === "instore" ? raw.method : null,
    service: raw.service === "instacart" || raw.service === "none" ? raw.service : null,
    usual_store: cleanLabel(raw.usual_store, 48),
  };
}

export function clampChoiceCount(n) {
  const v = Number.isFinite(n) ? Math.round(n) : DEFAULT_MEAL_CHOICE_COUNT;
  return Math.min(MAX_MEAL_CHOICE_COUNT, Math.max(3, v));
}

/**
 * @param {object} patch
 */
export function mergeSettingsPatch(current, patch) {
  const next = { ...current };
  if (patch.display_name != null) {
    next.display_name = String(patch.display_name).trim().slice(0, 48);
  }
  if (patch.meal_choice_count != null) {
    next.meal_choice_count = clampChoiceCount(patch.meal_choice_count);
  }
  if (patch.scheduling_cadence != null) {
    const allowed = new Set(["on_demand", "weekly", "biweekly"]);
    next.scheduling_cadence = allowed.has(patch.scheduling_cadence)
      ? patch.scheduling_cadence
      : DEFAULT_CADENCE;
  }
  if (patch.prefs && typeof patch.prefs === "object") {
    next.prefs = { ...next.prefs, ...patch.prefs };
  }
  return next;
}
