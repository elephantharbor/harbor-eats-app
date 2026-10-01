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
