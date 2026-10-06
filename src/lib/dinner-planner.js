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

function featuresOf(entry) {
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
    equipment: entry.pkg.equipment || [],
    methods: entry.concept.current_version?.methods || [],
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

function matchesRequest(feature, slug) {
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
    } else {
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

function scoreFeature(feature, participantIds, tastes, intent) {
  const taste = scoreDinerTastes(
    {
      recipe_slug: feature.slug,
      vocabulary_tag_ids: feature.entry?.pkg?.vocabulary_tag_ids || [],
    },
    (tastes || []).filter((row) => participantIds.includes(row.member_id))
  );
  const hints = hintBoost(feature, intent);
  return { taste: taste.score, total: taste.score + hints.boost, unscored: hints.unscored, excludes: taste.excludes };
}

function catalogCount(features, slug) {
  if (!slug) return null;
  return features.filter((feature) => matchesRequest(feature, slug)).length;
}

function rankEligible(eligible, participantIds, tastes, intent) {
  const active = preferencesActive(intent);
  const prefs = planningPreferences(intent);
  const ranked = eligible
    .map((feature) => {
      const score = scoreFeature(feature, participantIds, tastes, intent);
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

function pickFeature(ranked, used, recent, tiered) {
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
  const band = pool.filter((row) => row.total >= best - TASTE_BAND);
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
  for (let index = 0; index < intent.dinner_count; index += 1) {
    const participant_ids = intent.slots?.[index]?.participant_ids?.length
      ? intent.slots[index].participant_ids
      : intent.participant_ids;
    const eligible = features.filter((feature) =>
      assessMealEligibility(feature.entry, participant_ids, context.constraints || [], context.tastes || []).eligible
    );
    const pool = rankEligible(eligible, participant_ids, context.tastes || [], intent);
    pool.ranked.forEach((row) => row.unscored?.forEach((key) => unscored.add(key)));
    const picked = eligible.length
      ? pickFeature(pool.ranked, used, recent, pool.active)
      : { feature: null, reason: "no_eligible_meal", preference_tier: 0, preference_relaxed: false };
    if (picked.feature) remember(used, picked.feature);
    const slot = publicSlot(index + 1, participant_ids, picked);
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
