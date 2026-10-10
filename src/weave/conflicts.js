import { HARD_LIMIT_IDS } from "../lib/cycle2-schema.js";
import { assessMealEligibility, plannerCatalog, featuresOf, mealMatchesCategory } from "../lib/dinner-planner.js";

const SHELLFISH_TOKENS = new Set(["shrimp", "shellfish"]);
const FISH_TOKENS = new Set(["fish", "salmon", "cod", "swordfish", "arctic-char"]);

function anyEligible(features, token, participantIds, constraints, tastes) {
  const matches = features.filter((f) => mealMatchesCategory(f, token));
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
    let alternative = alternativeForToken(token);
    if (alternative.kind === "category") {
      const altCheck = anyEligible(features, alternative.token, participantIds, constraints, tastes);
      if (!altCheck.eligible) alternative = { kind: "drop" };
    }
    conflicts.push({
      code: "hard_ineligible",
      field: "include_ingredients",
      token,
      limit_ids: limitIdsForToken(token),
      alternative,
    });
    removed.push(token);
    const priorFreq = (repaired.frequencies || []).find((row) => row.token === token);
    const slotHits = (repaired.slots || []).filter((slot) => slot.ingredient === token || slot.category === token);
    repaired.include_ingredients = (repaired.include_ingredients || []).filter((item) => item !== token);
    repaired.frequencies = (repaired.frequencies || []).filter((row) => row.token !== token);
    if (alternative.kind === "category" && alternative.token) {
      const alt = alternative.token;
      const already = (repaired.frequencies || []).some((row) => row.token === alt);
      if (!already) {
        const min = priorFreq?.min_count ?? Math.max(1, slotHits.length || 1);
        const max = priorFreq ? priorFreq.max_count : slotHits.length > 1 ? slotHits.length : null;
        repaired.frequencies = [...(repaired.frequencies || []), { token: alt, min_count: min, max_count: max }].sort((a, b) =>
          a.token.localeCompare(b.token)
        );
      }
      repaired.slots = (repaired.slots || []).map((slot) => {
        if (slot.ingredient === token) return { ...slot, ingredient: null, category: alt };
        if (slot.category === token) return { ...slot, category: alt };
        return slot;
      });
    } else {
      repaired.slots = (repaired.slots || []).map((slot) => {
        if (slot.ingredient === token) return { ...slot, ingredient: null };
        if (slot.category === token) return { ...slot, category: null };
        return slot;
      });
    }
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

/** Planner shortfalls the weave UI reads from `conflicts`. */
export function frequencyConflicts(preview) {
  return (preview?.constrained_requests || [])
    .filter((row) => row && row.field === "frequency")
    .map((row) => ({
      code: "frequency_unfilled",
      field: "frequencies",
      token: row.token,
      min_count: row.min_count,
      placed: row.placed,
      reason: row.reason || "insufficient_eligible",
    }));
}
