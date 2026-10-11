/**
 * Deterministic dinner planner.
 * One recommended catalog meal per slot. Diversity is applied inside a taste
 * band so a hard limit is never broken and a liked meal is not dropped just
 * to vary cuisine. No model call. No meal outside the supplied catalog.
 */

import { planningPreferences, preferencesActive, preferenceTier, requirementTier } from "./classification.js";
import { isOptionEligibleForHousehold } from "./eligibility.js";
import { rulesFromLegacyKeys } from "./legacy-preference-audit.js";
import { decideEligibility } from "./preference-concepts.js";
import { MEAL_CONCEPTS } from "./recipe-store.js";
import { projectLegacyConcept } from "./recipe-package.js";
import { scoreDinerTastes } from "./diner-taste-rank.js";
import { canonicalIngredient } from "./ingredient-identity.js";
import { getTasteTerm } from "./taste-vocabulary.js";
import { PRACTICAL_HINT_KEYS } from "./cycle2-schema.js";
import { cueScoreForMeal } from "../weave/cues.js";
import { proteinGroupsFromSignals } from "../discovery/meal.js";
import { deriveCookingMethod, excludedByFrying, semanticScoreForMeal } from "../weave/semantics.js";
import { PLAN_TOKENS } from "../weave/constants.js";
import { isPlantMeal, mealSatisfiesSlot } from "../weave/slot-match.js";

const TASTE_BAND = 0.5;

/** @type {object[]|null} */
let cached = null;

export function resetPlannerCatalogCache() {
  cached = null;
}

/** The current 24-meal catalog projection. Not a published-package gate. */
export function plannerCatalog() {
  if (!cached) {
    cached = MEAL_CONCEPTS.map((concept) => ({
      concept,
      pkg: projectLegacyConcept(concept),
    }));
  }
  return cached;
}

export function featuresOf(entry) {
  const tags = entry.pkg.vocabulary_tag_ids || [];
  const styles = [];
  const flavors = [];
  const cuisines = [];
  const ingredients = [];
  for (const slug of tags) {
    const term = getTasteTerm(slug);
    if (!term) continue;
    if (term.category === "meal_style") styles.push(slug);
    else if (term.category === "flavor") flavors.push(slug);
    else if (term.category === "cuisine") cuisines.push(slug);
    else if (term.category === "ingredient") ingredients.push(slug);
  }
  return {
    slug: entry.concept.concept_id,
    recipe_version_id: entry.pkg.recipe_version_id,
    recipe_id: entry.pkg.recipe_id,
    version_number: entry.pkg.version_number,
    title: entry.pkg.title || entry.concept.title,
    cuisine: cuisines[0] || entry.concept.cuisine,
    styles,
    flavors,
    ingredient: ingredients[0] || entry.concept.primary_ingredient,
    minutes: entry.pkg.total_minutes,
    effort_level: entry.pkg.effort_level || null,
    ingredient_complexity: entry.pkg.ingredient_complexity || null,
    exploration: entry.pkg.exploration ?? entry.concept.exploration ?? 0,
    vocabulary_tag_ids: entry.pkg.vocabulary_tag_ids || [],
    equipment: entry.pkg.equipment || [],
    methods: [...(entry.pkg.methods || []), ...(entry.concept.current_version?.methods || [])],
    cooking: deriveCookingMethod({
      methods: [...(entry.pkg.methods || []), ...(entry.concept.current_version?.methods || [])],
      steps: entry.pkg.steps || [],
      description: entry.pkg.description || "",
      title: entry.pkg.title || entry.concept.title || "",
    }),
    dietary_labels: [...(entry.pkg.dietary_labels || []), ...(entry.pkg.dietary_tags || []), ...(entry.concept.tags || [])],
    eligibility_tags: entry.concept.tags || [],
    protein_groups: proteinGroupsFromSignals([...(entry.concept.tags || []), ...(entry.pkg.allergens || [])]),
    entry,
  };
}

function limitsFor(participantIds, constraints) {
  return (participantIds || []).map((member_id) => {
    /** @type {string[]} */
    const keys = [];
    for (const row of constraints || []) {
      if (row.member_id && row.member_id !== member_id) continue;
      if (!row.rule_key || row.rule_key === "none") continue;
      if (row.status === "permitted") {
        keys.push(row.rule_key === "cashew" ? "cashew_ok" : row.rule_key);
      } else {
        keys.push(row.rule_key);
      }
    }
    return { member_id, rules: rulesFromLegacyKeys(keys) };
  });
}

function recipeSignals(entry) {
  const ingredient_slugs = (entry.pkg.ingredients || []).map(
    (item) => canonicalIngredient(item.name, item.note).ingredient_id
  );
  return {
    allergens: entry.pkg.allergens || [],
    vocabulary_tag_ids: entry.pkg.vocabulary_tag_ids || [],
    ingredient_slugs,
  };
}

/**
 * Server eligibility for one catalog meal and one slot's diners.
 * Tastes, ratings, and hints are passed through and do not grant permission.
 */
export function assessMealEligibility(entry, participantIds, constraints, tastes = []) {
  const option = {
    name: entry.concept.title || entry.pkg.title,
    title: entry.concept.title || entry.pkg.title,
    tags: entry.concept.tags || [],
  };
  const rows = (constraints || []).filter((row) => !row.member_id || participantIds.includes(row.member_id));
  const live = isOptionEligibleForHousehold(option, rows);
  const decision = decideEligibility({
    limits: limitsFor(participantIds, constraints),
    recipe: recipeSignals(entry),
    tastes,
    ratings: [],
    practicalHints: [],
    inferred: tastes.filter((row) => row.stance === "inferred"),
  });
  return {
    eligible: live && decision.eligible,
    blocked: decision.blocked,
    live,
  };
}

export function matchesRequest(feature, slug) {
  if (!slug) return false;
  if (feature.ingredient === slug) return true;
  if (feature.entry.concept.primary_ingredient === slug) return true;
  if ((feature.entry.pkg.vocabulary_tag_ids || []).includes(slug)) return true;
  const ids = (feature.entry.pkg.ingredients || []).map(
    (item) => canonicalIngredient(item.name, item.note).ingredient_id
  );
  return ids.includes(slug);
}

function hintBoost(feature, intent) {
  let boost = 0;
  /** @type {string[]} */
  const unscored = [];
  for (const hint of intent.practical_hints || []) {
    if (!PRACTICAL_HINT_KEYS.includes(hint.hint_key)) continue;
    if (hint.hint_key === "under_30_minutes") {
      if (typeof feature.minutes === "number" && feature.minutes <= 30) boost += 0.2;
    } else if (hint.hint_key === "grill_friendly") {
      if (feature.equipment.includes("grill") || feature.methods.includes("grill")) boost += 0.2;
    } else if (hint.hint_key === "equipment") {
      const detail = hint.detail || "";
      const method = detail.replace(/-/g, "_");
      if (detail && (feature.equipment.includes(detail) || feature.methods.includes(method))) boost += 0.2;
    } else if (hint.hint_key !== "weeknight") {
      unscored.push(hint.hint_key);
    }
  }
  if (intent.max_cook_minutes != null && typeof feature.minutes === "number" && feature.minutes <= intent.max_cook_minutes) {
    boost += 0.2;
  }
  if (intent.requested_ingredient && matchesRequest(feature, intent.requested_ingredient)) boost += 2;
  for (const style of intent.meal_styles || []) {
    if (feature.styles.includes(style)) boost += 0.3;
  }
  return { boost, unscored };
}

function conflicts(feature, used) {
  if (used.cuisines.has(feature.cuisine)) return true;
  if (used.ingredients.has(feature.ingredient)) return true;
  if (feature.styles.some((style) => used.styles.has(style))) return true;
  if (feature.flavors.some((flavor) => used.flavors.has(flavor))) return true;
  return false;
}

function remember(used, feature) {
  used.slugs.add(feature.slug);
  if (feature.cuisine) used.cuisines.add(feature.cuisine);
  if (feature.ingredient) used.ingredients.add(feature.ingredient);
  feature.styles.forEach((style) => used.styles.add(style));
  feature.flavors.forEach((flavor) => used.flavors.add(flavor));
}

function emptyUsed() {
  return {
    slugs: new Set(),
    cuisines: new Set(),
    ingredients: new Set(),
    styles: new Set(),
    flavors: new Set(),
  };
}

function usedFromSlots(slots, catalogBySlug) {
  const used = emptyUsed();
  for (const slot of slots || []) {
    if (!slot?.recipe_slug) continue;
    const entry = catalogBySlug.get(slot.recipe_slug);
    if (!entry) {
      used.slugs.add(slot.recipe_slug);
      continue;
    }
    remember(used, featuresOf(entry));
    used.slugs.add(slot.recipe_slug);
  }
  return used;
}

export function mealMatchesCategory(feature, token) {
  if (token === "plant" || token === "vegetarian" || token === "plant_based") return isPlantMeal(feature);
  if (PLAN_TOKENS.includes(token) && feature.styles.includes(token)) return true;
  if (token === "fish" || token === "seafood" || token === "shellfish") {
    const tags = feature.entry?.pkg?.allergens || [];
    if (token === "fish" && tags.includes("finfish")) return true;
    if (token === "shellfish" && tags.includes("shellfish")) return true;
    if (token === "seafood" && (tags.includes("finfish") || tags.includes("shellfish"))) return true;
  }
  return matchesRequest(feature, token);
}

function passesPoolFilters(feature, intent, slotOverride = {}) {
  const effort = slotOverride.effort || intent.require_effort;
  if (effort && feature.effort_level !== effort) return false;
  const complexity = slotOverride.ingredient_complexity || intent.require_ingredient_complexity;
  if (complexity && feature.ingredient_complexity !== complexity) return false;
  const hardMinutes = slotOverride.max_minutes_hard ? slotOverride.max_minutes : intent.max_cook_minutes_hard ? intent.max_cook_minutes : null;
  if (hardMinutes != null && typeof feature.minutes === "number" && feature.minutes > hardMinutes) return false;
  for (const slug of intent.exclude_ingredients || []) {
    if (matchesRequest(feature, slug)) return false;
  }
  for (const cat of intent.exclude_categories || []) {
    if (mealMatchesCategory(feature, cat)) return false;
  }
  if (slotOverride.category && !mealMatchesCategory(feature, slotOverride.category)) return false;
  if ((intent.exclude_cooking || []).length && excludedByFrying(feature, intent.exclude_cooking)) return false;
  return true;
}

const SLOT_OVERRIDE_KEYS = [
  "effort",
  "ingredient_complexity",
  "max_minutes",
  "max_minutes_hard",
  "special",
  "cuisine",
  "meal_style",
  "ingredient",
  "category",
  "intent_cue",
];

/** Position match only. An unmatched slot must not fall through onto slots[index]. */
function slotOverrideFor(intent, index) {
  const position = index + 1;
  const hit = (intent.weave_slots || []).find((slot) => Number(slot?.position) === position);
  if (!hit) return {};
  const out = {};
  for (const key of SLOT_OVERRIDE_KEYS) {
    const value = hit[key];
    if (value == null || value === false) continue;
    out[key] = value;
  }
  return out;
}

function previousAt(previous, index) {
  if (!Array.isArray(previous)) return null;
  const position = index + 1;
  return previous.find((slot) => slot && Number(slot.position) === position) || previous[index] || null;
}

function slotParticipants(intent, index) {
  return intent.slots?.[index]?.participant_ids?.length
    ? intent.slots[index].participant_ids
    : intent.participant_ids;
}

function replacementDropsSlotRule(override, feature) {
  if (!override) return false;
  if (override.ingredient && !matchesRequest(feature, override.ingredient) && !mealMatchesCategory(feature, override.ingredient)) {
    return true;
  }
  if (override.category && !mealMatchesCategory(feature, override.category)) return true;
  if (override.cuisine && feature.cuisine !== override.cuisine) return true;
  return false;
}

function scoreFeature(feature, participantIds, tastes, intent, slotOverride = {}) {
  const taste = scoreDinerTastes(
    {
      recipe_slug: feature.slug,
      vocabulary_tag_ids: feature.entry?.pkg?.vocabulary_tag_ids || [],
    },
    (tastes || []).filter((row) => participantIds.includes(row.member_id))
  );
  const hints = hintBoost(feature, intent);
  const cues = slotOverride.intent_cue ? [slotOverride.intent_cue] : intent.intent_cues || [];
  const cue = cueScoreForMeal(feature, cues, { keep_it_easy: intent.keep_it_easy });
  const semantic = semanticScoreForMeal(feature, intent.semantic_rank);
  let total = taste.score + hints.boost + cue + semantic;
  if (slotOverride.special === true) {
    total += (feature.exploration || 0) >= 0.55 ? 0.25 : (feature.exploration || 0) * 0.1;
  }
  return { taste: taste.score, total, unscored: hints.unscored, excludes: taste.excludes, cue };
}

function catalogCount(features, slug) {
  if (!slug) return null;
  return features.filter((feature) => matchesRequest(feature, slug)).length;
}

function rankEligible(eligible, participantIds, tastes, intent, slotOverride = {}) {
  const active = preferencesActive(intent);
  const prefs = planningPreferences(intent);
  const ranked = eligible
    .map((feature) => {
      const score = scoreFeature(feature, participantIds, tastes, intent, slotOverride);
      return {
        feature,
        total: score.total,
        unscored: score.unscored,
        requirement: active ? requirementTier(feature, intent, matchesRequest) : 0,
        preference: active ? preferenceTier(feature.effort_level, feature.ingredient_complexity, prefs) : 0,
      };
    })
    .sort((a, b) => {
      if (active) {
        if (a.requirement !== b.requirement) return a.requirement - b.requirement;
        if (a.preference !== b.preference) return a.preference - b.preference;
      }
      return b.total - a.total || a.feature.slug.localeCompare(b.feature.slug);
    });
  return { ranked, active };
}

function pickFeature(ranked, used, recent, tiered, opts = {}) {
  const unused = ranked.filter((row) => !used.slugs.has(row.feature.slug));
  if (!unused.length) {
    return {
      feature: null,
      reason: used.slugs.size ? "no_unused_eligible_meal" : "no_eligible_meal",
      preference_tier: 0,
      preference_relaxed: false,
    };
  }
  let pool = unused;
  if (tiered) {
    const bestRequirement = unused[0].requirement;
    const bestPreference = unused[0].preference;
    pool = unused.filter((row) => row.requirement === bestRequirement && row.preference === bestPreference);
  }
  const best = pool[0].total;
  // A slot cue is clamped to 0.4, inside the usual 0.5 diversity band, so
  // diversity would ignore it. Hold the band tight when the slot named a cue.
  const bandWidth = opts.cueBound ? 0.05 : TASTE_BAND;
  const band = pool.filter((row) => row.total >= best - bandWidth);
  const diverse = band.find((row) => !conflicts(row.feature, used) && !recent.has(row.feature.slug))
    || band.find((row) => !conflicts(row.feature, used));
  const chosen = diverse || pool[0];
  return {
    feature: chosen.feature,
    reason: null,
    preference_tier: chosen.preference || 0,
    preference_relaxed: (chosen.preference || 0) > 0,
  };
}

function publicSlot(position, participantIds, picked) {
  if (!picked.feature) {
    return {
      position,
      result: "constrained",
      reason: picked.reason,
      recipe_slug: null,
      recipe_version_id: null,
      recipe_id: null,
      version_number: null,
      title: null,
      total_minutes: null,
      effort_level: null,
      ingredient_complexity: null,
      preference_tier: 0,
      preference_relaxed: false,
      participant_ids: participantIds,
    };
  }
  const feature = picked.feature;
  return {
    position,
    result: "recommended",
    reason: null,
    recipe_slug: feature.slug,
    recipe_version_id: feature.recipe_version_id,
    recipe_id: feature.recipe_id,
    version_number: feature.version_number,
    title: feature.title,
    total_minutes: feature.minutes ?? null,
    effort_level: feature.effort_level || null,
    ingredient_complexity: feature.ingredient_complexity || null,
    preference_tier: picked.preference_tier || 0,
    preference_relaxed: picked.preference_relaxed === true,
    participant_ids: participantIds,
  };
}

/**
 * @param {object} intent parsed intent
 * @param {{ catalog?: object[], constraints?: object[], tastes?: object[], recent_slugs?: string[] }} [context]
 */
export function planDinners(intent, context = {}) {
  const catalog = context.catalog || plannerCatalog();
  const features = catalog.map(featuresOf);
  const recent = new Set(context.recent_slugs || []);
  const requested = intent.requested_ingredient;
  const coverage = catalogCount(features, requested);
  /** @type {object[]} */
  const constrained_requests = [];
  if (requested && coverage === 0) {
    constrained_requests.push({
      field: "requested_ingredient",
      slug: requested,
      reason: "no_catalog_coverage",
      catalog_matches: 0,
      invented: false,
    });
  }
  const unscored = new Set();
  for (const hint of intent.practical_hints || []) {
    if (hint.hint_key === "low_cleanup" || hint.hint_key === "weeknight") unscored.add(hint.hint_key);
  }
  const used = emptyUsed();
  const slots = [];
  const preference_relaxations = [];
  const previous = context.previous_slots || null;
  const changed = new Set();
  const tastes = context.tastes || [];
  const constraints = context.constraints || [];

  function featureBySlug(slug) {
    if (!slug) return null;
    const entry = catalog.find((item) => item.concept.concept_id === slug);
    return entry ? featuresOf(entry) : null;
  }

  function countToken(token, replaceIndex = -1, candidate = null) {
    let n = 0;
    for (let i = 0; i < slots.length; i += 1) {
      const feature = i === replaceIndex ? candidate : featureBySlug(slots[i]?.recipe_slug);
      if (feature && mealMatchesCategory(feature, token)) n += 1;
    }
    if (replaceIndex === slots.length && candidate && mealMatchesCategory(candidate, token)) n += 1;
    return n;
  }

  function respectsMax(candidate, replaceIndex) {
    for (const row of intent.frequencies || []) {
      if (row?.max_count == null) continue;
      if (countToken(row.token, replaceIndex, candidate) > row.max_count) return false;
    }
    return true;
  }

  function markChange(index, prev, slot) {
    const position = index + 1;
    if (!prev || prev.recipe_version_id !== slot.recipe_version_id) changed.add(position);
    else changed.delete(position);
  }

  function eligibleFor(index, slotOverride, participantIds) {
    return features.filter(
      (feature) =>
        assessMealEligibility(feature.entry, participantIds, constraints, tastes).eligible &&
        passesPoolFilters(feature, intent, slotOverride)
    );
  }

  for (let index = 0; index < intent.dinner_count; index += 1) {
    const slotOverride = slotOverrideFor(intent, index);
    const participant_ids = slotParticipants(intent, index);
    const prev = previousAt(previous, index);
    const already = prev?.recipe_version_id && mealSatisfiesSlot(prev, slotOverride);
    if (prev?.recipe_version_id && (Object.keys(slotOverride).length === 0 || already)) {
      slots.push({
        ...prev,
        position: index + 1,
        participant_ids,
        result: prev.result || "recommended",
      });
      if (prev.recipe_slug) {
        used.slugs.add(prev.recipe_slug);
        const entry = catalog.find((item) => item.concept.concept_id === prev.recipe_slug);
        if (entry) remember(used, featuresOf(entry));
      }
      continue;
    }
    const eligible = eligibleFor(index, slotOverride, participant_ids);
    const pool = rankEligible(eligible, participant_ids, tastes, intent, slotOverride);
    pool.ranked.forEach((row) => row.unscored?.forEach((key) => unscored.add(key)));
    const legal = pool.ranked.filter((row) => respectsMax(row.feature, slots.length));
    const picked = legal.length
      ? pickFeature(legal, used, recent, pool.active, { cueBound: Boolean(slotOverride.intent_cue) })
      : {
          feature: null,
          reason: eligible.length ? "frequency_cap" : "no_eligible_meal",
          preference_tier: 0,
          preference_relaxed: false,
        };
    if (picked.feature) remember(used, picked.feature);
    const slot = publicSlot(index + 1, participant_ids, picked);
    if (prev?.scheduled_date) slot.scheduled_date = prev.scheduled_date;
    if (slot.preference_relaxed) {
      preference_relaxations.push({
        position: slot.position,
        recipe_slug: slot.recipe_slug,
        preference_tier: slot.preference_tier,
        effort_level: slot.effort_level,
        ingredient_complexity: slot.ingredient_complexity,
      });
    }
    slots.push(slot);
    markChange(index, prev, slot);
  }

  for (const row of intent.frequencies || []) {
    if (row?.min_count == null || row.min_count <= 0 || !row.token) continue;
    let guard = intent.dinner_count + 2;
    while (countToken(row.token) < row.min_count && guard > 0) {
      guard -= 1;
      const before = countToken(row.token);
      let replaced = false;
      for (let index = slots.length - 1; index >= 0 && !replaced; index -= 1) {
        const current = featureBySlug(slots[index]?.recipe_slug);
        if (current && mealMatchesCategory(current, row.token)) continue;
        const slotOverride = slotOverrideFor(intent, index);
        const participant_ids = slotParticipants(intent, index);
        const taken = new Set(
          slots.filter((_, slotIndex) => slotIndex !== index).map((slot) => slot.recipe_slug).filter(Boolean)
        );
        const options = features.filter(
          (feature) =>
            !taken.has(feature.slug) &&
            assessMealEligibility(feature.entry, participant_ids, constraints, tastes).eligible &&
            passesPoolFilters(feature, intent, slotOverride) &&
            mealMatchesCategory(feature, row.token) &&
            !replacementDropsSlotRule(slotOverride, feature) &&
            respectsMax(feature, index)
        );
        if (!options.length) continue;
        options.sort((a, b) => {
          const delta =
            scoreFeature(b, participant_ids, tastes, intent, slotOverride).total -
            scoreFeature(a, participant_ids, tastes, intent, slotOverride).total;
          return delta || a.slug.localeCompare(b.slug);
        });
        const slot = publicSlot(index + 1, participant_ids, {
          feature: options[0],
          reason: null,
          preference_tier: 0,
          preference_relaxed: false,
        });
        const prev = previousAt(previous, index);
        if (prev?.scheduled_date) slot.scheduled_date = prev.scheduled_date;
        slots[index] = slot;
        markChange(index, prev, slot);
        replaced = true;
      }
      if (!replaced || countToken(row.token) <= before) {
        constrained_requests.push({
          field: "frequency",
          token: row.token,
          min_count: row.min_count,
          placed: countToken(row.token),
          reason: "insufficient_eligible",
          invented: false,
        });
        break;
      }
    }
  }

  return {
    ok: true,
    model: null,
    source: "deterministic",
    catalog_size: catalog.length,
    intent,
    constrained_requests,
    unscored_hints: [...unscored],
    preference_relaxations,
    slots,
    changed_positions: [...changed].sort((a, b) => a - b),
  };
}

/**
 * Replace one slot. Other slot objects are left in place, including their
 * pinned version ids.
 * @param {object[]} slots
 * @param {number} index zero-based
 * @param {object} context
 */
export function swapSlot(slots, index, context = {}) {
  if (!Array.isArray(slots) || index < 0 || index >= slots.length) {
    return { ok: false, error: "meal_not_found", status: 404, slots };
  }
  const intent = context.intent || { dinner_count: slots.length, participant_ids: [], meal_styles: [], practical_hints: [] };
  const catalog = context.catalog || plannerCatalog();
  const bySlug = new Map(catalog.map((entry) => [entry.concept.concept_id, entry]));
  const current = slots[index];
  const participant_ids = current.participant_ids?.length
    ? current.participant_ids
    : intent.participant_ids || [];
  const used = usedFromSlots(slots.filter((_, slotIndex) => slotIndex !== index), bySlug);
  if (current.recipe_slug) used.slugs.add(current.recipe_slug);
  const features = catalog.map(featuresOf);
  const eligible = features.filter((feature) =>
    feature.slug !== current.recipe_slug &&
    assessMealEligibility(feature.entry, participant_ids, context.constraints || [], context.tastes || []).eligible
  );
  const pool = rankEligible(eligible, participant_ids, context.tastes || [], intent);
  const recent = new Set(context.recent_slugs || []);
  const picked = eligible.length
    ? pickFeature(pool.ranked, used, recent, pool.active)
    : { feature: null, reason: "no_eligible_meal", preference_tier: 0, preference_relaxed: false };
  if (!picked.feature) {
    return {
      ok: false,
      error: "constrained",
      reason: picked.reason || "no_eligible_meal",
      status: 409,
      slots,
    };
  }
  const next = slots.slice();
  next[index] = publicSlot(current.position, participant_ids, picked);
  return { ok: true, slots: next, changed_index: index };
}
