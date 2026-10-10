import { HARD_LIMIT_IDS } from "../lib/cycle2-schema.js";
import { assessMealEligibility, plannerCatalog, featuresOf } from "../lib/dinner-planner.js";
import { canonicalIngredient } from "../lib/ingredient-identity.js";

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

const SHELLFISH_TOKENS = new Set(["shrimp", "shellfish"]);
const FISH_TOKENS = new Set(["fish", "salmon", "cod", "swordfish", "arctic-char"]);

function anyEligible(features, token, participantIds, constraints, tastes) {
  const matches = features.filter(
    (f) =>
      matchesRequest(f, token) ||
      f.styles.includes(token) ||
      f.ingredient === token ||
      f.entry.concept.primary_ingredient === token
  );
  if (!matches.length) return { eligible: false, coverage: false };
  const eligible = matches.some(
    (f) => assessMealEligibility(f.entry, participantIds, constraints, tastes).eligible
  );
  return { eligible, coverage: true };
}

function alternativeForToken(token) {
  if (SHELLFISH_TOKENS.has(token) || token === "shellfish") {
    return { kind: "category", token: "fish" };
  }
  if (FISH_TOKENS.has(token) || token === "fish") return { kind: "drop" };
  return { kind: "drop" };
}

function limitIdsForToken(token) {
  if (SHELLFISH_TOKENS.has(token)) return ["no_shellfish"];
  if (FISH_TOKENS.has(token)) return ["no_finfish"];
  return HARD_LIMIT_IDS.filter(() => false);
}

/**
 * Detect hard-ineligible tokens on planning state.
 * @returns {{ conflicts: object[], repaired: object, removed: string[] }}
 */
export function detectPlanningConflicts(state, { participantIds, constraints, tastes }) {
  const features = (plannerCatalog() || []).map(featuresOf);
  /** @type {object[]} */
  const conflicts = [];
  /** @type {string[]} */
  const removed = [];
  const repaired = JSON.parse(JSON.stringify(state));
  const tokens = new Set();
  for (const slug of repaired.include_ingredients || []) tokens.add(slug);
  for (const row of repaired.frequencies || []) tokens.add(row.token);
  for (const slot of repaired.slots || []) {
    if (slot.ingredient) tokens.add(slot.ingredient);
    if (slot.category) tokens.add(slot.category);
  }
  for (const token of tokens) {
    const check = anyEligible(features, token, participantIds, constraints, tastes);
    if (!check.coverage) continue;
    if (check.eligible) continue;
    const alternative = alternativeForToken(token);
    conflicts.push({
      code: "hard_ineligible",
      field: "include_ingredients",
      token,
      limit_ids: limitIdsForToken(token),
      alternative,
    });
    removed.push(token);
    repaired.include_ingredients = (repaired.include_ingredients || []).filter((t) => t !== token);
    repaired.frequencies = (repaired.frequencies || []).filter((f) => f.token !== token);
    repaired.slots = (repaired.slots || []).map((s) => {
      if (s.ingredient === token) return { ...s, ingredient: null };
      if (s.category === token) return { ...s, category: null };
      return s;
    });
  }
  return { conflicts, repaired, removed };
}

export function detectDiscoveryConflicts(state, ctx) {
  const features = (plannerCatalog() || []).map(featuresOf);
  const conflicts = [];
  const removed = [];
  const repaired = JSON.parse(JSON.stringify(state));
  const tokens = new Set([...(repaired.ingredients || [])]);
  for (const token of tokens) {
    const check = anyEligible(features, token, ctx.participantIds, ctx.constraints, ctx.tastes);
    if (!check.coverage) continue;
    if (check.eligible) continue;
    conflicts.push({
      code: "hard_ineligible",
      field: "ingredients",
      token,
      limit_ids: limitIdsForToken(token),
      alternative: alternativeForToken(token),
    });
    removed.push(token);
    repaired.ingredients = (repaired.ingredients || []).filter((t) => t !== token);
  }
  return { conflicts, repaired, removed };
}
