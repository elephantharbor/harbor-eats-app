/**
 * Canonical meal-option presentation.
 * Time, effort, and meal style come from persisted option attributes or,
 * when a share/restore payload dropped them, from the catalog row for recipe_slug.
 * Never invent a "Shared" chip or "Shared pick" label.
 */

import { getConceptBySlug } from "./recipe-store.js";

export function parseAttributes(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return { ...raw };
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function hasValue(value) {
  if (value == null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Keep canonical keys already stored on the option. Overlay only incoming
 * fields that actually carry a value so a display snapshot cannot wipe minutes,
 * effort, chips, cuisine, or recipe identity.
 */
export function mergeCanonicalAttributes(existingRaw, incoming) {
  const existing = parseAttributes(existingRaw);
  const inc = incoming && typeof incoming === "object" ? incoming : {};
  const merged = { ...existing };
  const fillIfMissing = [
    "title",
    "plate",
    "tone",
    "minutes",
    "effort",
    "recipe_slug",
    "recipe_version_id",
    "cuisine",
    "meal_format",
    "tags",
    "sparks",
    "score",
    "primary_ingredient",
    "exploration",
  ];
  for (const key of fillIfMissing) {
    if (!hasValue(merged[key]) && hasValue(inc[key])) merged[key] = inc[key];
  }
  const incomingChips = Array.isArray(inc.chips)
    ? inc.chips.filter((chip) => String(chip).toLowerCase() !== "shared")
    : [];
  if (!hasValue(merged.chips) && incomingChips.length) merged.chips = incomingChips;
  const incomingPers = inc.pers;
  const sharedLabel = incomingPers && /shared/i.test(String(incomingPers.label || ""));
  if (!hasValue(merged.pers) && incomingPers && !sharedLabel) merged.pers = incomingPers;
  return merged;
}

function catalogForSlug(slug) {
  if (!slug) return null;
  const concept = getConceptBySlug(slug);
  if (!concept) return null;
  const version = concept.current_version || {};
  const prep = Number(version.prep_minutes) || 0;
  const cook = Number(version.cook_minutes) || 0;
  return {
    recipe_slug: concept.concept_id,
    recipe_version_id: version.recipe_version_id || null,
    title: concept.title || concept.name,
    chips: concept.chips || [],
    plate: concept.plate || null,
    tone: concept.tone || null,
    minutes: prep + cook || null,
    effort: version.effort || null,
    cuisine: concept.cuisine || null,
    meal_format: concept.meal_format || null,
    tags: concept.tags || [],
  };
}

/**
 * @param {object} row meal_option row and/or API option
 */
export function projectMealOption(row) {
  const source = row || {};
  const attrs = parseAttributes(source.attributes_json);
  const slug = source.recipe_slug || attrs.recipe_slug || null;
  const catalog = catalogForSlug(slug);
  const minutes =
    source.minutes ||
    attrs.minutes ||
    (catalog && catalog.minutes) ||
    null;
  const time =
    (source.time && /\d/.test(String(source.time)) ? source.time : "") ||
    (minutes ? `${minutes} min` : "");
  const effort = source.effort || attrs.effort || (catalog && catalog.effort) || "";
  const storedChips = Array.isArray(source.chips) && source.chips.length
    ? source.chips
    : Array.isArray(attrs.chips) && attrs.chips.length
      ? attrs.chips
      : catalog && Array.isArray(catalog.chips)
        ? catalog.chips
        : [];
  const mealFormat = source.meal_format || attrs.meal_format || (catalog && catalog.meal_format) || "";
  const chips = storedChips.filter((chip) => String(chip).toLowerCase() !== "shared");
  if (
    mealFormat &&
    !chips.some((chip) => String(chip).toLowerCase() === String(mealFormat).toLowerCase())
  ) {
    chips.unshift(mealFormat);
  }
  const version =
    source.recipe_version_id ||
    source.recipe_version ||
    attrs.recipe_version_id ||
    (catalog && catalog.recipe_version_id) ||
    null;
  return {
    letter: source.letter || null,
    meal_option_id: source.meal_option_id || source.id || null,
    name: source.name || source.title || (attrs.title) || null,
    title: source.title || attrs.title || source.name || (catalog && catalog.title) || null,
    chips,
    plate: source.plate || attrs.plate || (catalog && catalog.plate) || null,
    tone: source.tone || attrs.tone || (catalog && catalog.tone) || null,
    time,
    minutes: minutes || null,
    effort,
    meal_format: mealFormat,
    cuisine: source.cuisine || attrs.cuisine || (catalog && catalog.cuisine) || "",
    pers: source.pers || attrs.pers || null,
    recipe_slug: slug,
    recipe_version_id: version,
    tags: attrs.tags || (catalog && catalog.tags) || [],
    score: typeof attrs.score === "number" ? attrs.score : source.score ?? null,
  };
}

export function projectMealOptions(rows) {
  return (rows || []).map((row) => projectMealOption(row));
}
