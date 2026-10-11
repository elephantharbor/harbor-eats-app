import { rulesFromLegacyKeys } from "../lib/legacy-preference-audit.js";
import { assessMealEligibility, plannerCatalog, featuresOf, mealMatchesCategory } from "../lib/dinner-planner.js";
import { stripFillerResidue } from "./residue.js";

const SHELLFISH_TOKENS = new Set(["shrimp", "prawn", "prawns", "shellfish", "crab", "lobster", "scallop"]);
const FISH_TOKENS = new Set(["fish", "salmon", "cod", "swordfish", "arctic-char", "finfish", "tuna"]);

/**
 * Closed hazard list. A requested dish the model drops (steak, peanut) still
 * conflicts when any diner's hard limit covers it.
 */
const HAZARDS = [
  {
    token: "arctic-char",
    phrases: ["arctic char"],
    tokens: [],
    limits: ["no_finfish"],
    alternative: { kind: "drop" },
  },
  {
    tokens: ["shrimp", "prawns", "prawn", "shellfish", "crab", "lobster", "scallop"],
    canon: { prawn: "shrimp", prawns: "shrimp" },
    limits: ["no_shellfish"],
    alternative: { kind: "category", token: "fish" },
  },
  {
    tokens: ["salmon", "cod", "swordfish", "arctic-char", "finfish", "tuna", "fish"],
    limits: ["no_finfish"],
    alternative: { kind: "drop" },
  },
  {
    tokens: ["steak", "steaks", "beef", "pork", "lamb", "bacon", "sausage", "meat"],
    canon: { steaks: "steak" },
    limits: ["no_meat"],
    alternative: { kind: "drop" },
  },
  {
    tokens: ["chicken", "turkey", "duck", "poultry"],
    limits: ["no_meat", "no_poultry"],
    alternative: { kind: "drop" },
  },
  {
    tokens: ["peanut", "peanuts", "satay", "nuts", "almond", "walnut", "cashew", "pecan", "hazelnut", "pistachio"],
    canon: { peanuts: "peanut", satay: "peanut" },
    limits: ["no_nuts"],
    alternative: { kind: "drop" },
  },
  {
    tokens: ["dairy", "cheese", "milk", "yogurt", "yoghurt", "butter", "cream"],
    limits: ["no_dairy"],
    alternative: { kind: "drop" },
  },
];

function anyEligible(features, token, participantIds, constraints, tastes) {
  const matches = features.filter((feature) => mealMatchesCategory(feature, token));
  if (!matches.length) return { eligible: false, coverage: false };
  const eligible = matches.some(
    (feature) => assessMealEligibility(feature.entry, participantIds, constraints, tastes).eligible
  );
  return { eligible, coverage: true };
}

function alternativeForToken(token) {
  if (SHELLFISH_TOKENS.has(token)) return { kind: "category", token: "fish" };
  if (FISH_TOKENS.has(token)) return { kind: "drop" };
  return { kind: "drop" };
}

function limitIdsForToken(token) {
  if (SHELLFISH_TOKENS.has(token)) return ["no_shellfish"];
  if (FISH_TOKENS.has(token)) return ["no_finfish"];
  return [];
}

function dinerLimitIds(participantIds, constraints) {
  const ids = new Set();
  for (const memberId of participantIds || []) {
    const keys = [];
    for (const row of constraints || []) {
      if (row.member_id && row.member_id !== memberId) continue;
      if ((row.status || "prohibited") === "permitted") continue;
      if (row.rule_key) keys.push(row.rule_key);
    }
    for (const rule of rulesFromLegacyKeys(keys)) {
      if (rule.status === "prohibited") ids.add(rule.id);
    }
  }
  return ids;
}

function hazardForToken(token) {
  const key = String(token || "").toLowerCase();
  for (const hazard of HAZARDS) {
    if (hazard.token === key) return hazard;
    if ((hazard.tokens || []).includes(key)) return hazard;
    if (hazard.canon && Object.values(hazard.canon).includes(key)) return hazard;
  }
  return null;
}

function hazardsInText(text) {
  const source = String(text || "");
  if (!source.trim()) return [];
  const found = [];
  const seen = new Set();
  for (const hazard of HAZARDS) {
    let matched = null;
    for (const phrase of hazard.phrases || []) {
      if (new RegExp(`\\b${phrase}\\b`, "i").test(source)) matched = hazard.token || phrase;
    }
    if (!matched) {
      for (const token of hazard.tokens || []) {
        if (!new RegExp(`\\b${token}\\b`, "i").test(source)) continue;
        matched = hazard.canon?.[token] || token;
        break;
      }
    }
    if (!matched || seen.has(matched)) continue;
    seen.add(matched);
    found.push({ token: matched, hazard });
  }
  return found;
}

function pushToken(rows, seen, token, field) {
  const key = String(token || "").trim().toLowerCase();
  if (!key || seen.has(key)) return;
  seen.add(key);
  rows.push({ token: key, field });
}

function positiveTokens(state, kind, userText) {
  const rows = [];
  const seen = new Set();
  if (kind === "plan") {
    for (const token of state.include_ingredients || []) pushToken(rows, seen, token, "include_ingredients");
    for (const row of state.frequencies || []) {
      if (row?.max_count === 0) continue;
      pushToken(rows, seen, row?.token, "frequencies");
    }
    for (const slot of state.slots || []) {
      pushToken(rows, seen, slot.ingredient, "slots");
      pushToken(rows, seen, slot.category, "slots");
      pushToken(rows, seen, slot.cuisine, "cuisines");
      pushToken(rows, seen, slot.meal_style, "meal_styles");
    }
    for (const token of state.cuisines || []) pushToken(rows, seen, token, "cuisines");
    for (const token of state.meal_styles || []) pushToken(rows, seen, token, "meal_styles");
  } else {
    for (const field of ["ingredients", "protein_groups", "cuisines", "meal_styles", "flavors", "diet"]) {
      for (const token of state[field] || []) pushToken(rows, seen, token, field);
    }
    for (const hit of hazardsInText(state.text_residue)) pushToken(rows, seen, hit.token, "text_residue");
  }
  for (const hit of hazardsInText(userText)) pushToken(rows, seen, hit.token, "request");
  return rows;
}

const DISCOVERY_LISTS = ["ingredients", "protein_groups", "cuisines", "meal_styles", "flavors", "diet"];

function scrubToken(repaired, token, kind) {
  if (kind === "discovery") {
    for (const field of DISCOVERY_LISTS) {
      repaired[field] = (repaired[field] || []).filter((item) => item !== token);
    }
    return;
  }
  repaired.include_ingredients = (repaired.include_ingredients || []).filter((item) => item !== token);
  repaired.frequencies = (repaired.frequencies || []).filter((row) => row.token !== token);
  repaired.cuisines = (repaired.cuisines || []).filter((item) => item !== token);
  repaired.meal_styles = (repaired.meal_styles || []).filter((item) => item !== token);
  repaired.slots = (repaired.slots || []).map((slot) => {
    const next = { ...slot };
    if (next.ingredient === token) next.ingredient = null;
    if (next.category === token) next.category = null;
    if (next.cuisine === token) next.cuisine = null;
    if (next.meal_style === token) next.meal_style = null;
    return next;
  });
}

function applyFish(repaired, token, kind) {
  const alt = "fish";
  if (kind === "discovery") {
    scrubToken(repaired, token, kind);
    const groups = (repaired.protein_groups || []).filter((item) => item !== "shellfish" && item !== "seafood");
    if (!groups.includes(alt)) groups.push(alt);
    repaired.protein_groups = groups.sort((a, b) => a.localeCompare(b));
    return;
  }
  const priorFreq = (repaired.frequencies || []).find((row) => row.token === token);
  const slotHits = (repaired.slots || []).filter((slot) => slot.ingredient === token || slot.category === token);
  const inState = Boolean(priorFreq) || slotHits.length > 0 || (repaired.include_ingredients || []).includes(token);
  repaired.include_ingredients = (repaired.include_ingredients || []).filter((item) => item !== token);
  repaired.frequencies = (repaired.frequencies || []).filter((row) => row.token !== token);
  repaired.cuisines = (repaired.cuisines || []).filter((item) => item !== token);
  repaired.meal_styles = (repaired.meal_styles || []).filter((item) => item !== token);
  if (!inState) {
    scrubToken(repaired, token, kind);
    return;
  }
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
    if (slot.cuisine === token) return { ...slot, cuisine: null };
    if (slot.meal_style === token) return { ...slot, meal_style: null };
    return slot;
  });
}

function detectConflicts(state, ctx, kind) {
  const features = (plannerCatalog() || []).map(featuresOf);
  const participantIds = ctx.participantIds || [];
  const constraints = ctx.constraints || [];
  const tastes = ctx.tastes || [];
  const limits = dinerLimitIds(participantIds, constraints);
  const conflicts = [];
  const removed = [];
  const repaired = JSON.parse(JSON.stringify(state || {}));
  for (const field of DISCOVERY_LISTS) repaired[field] = repaired[field] || [];
  repaired.include_ingredients = repaired.include_ingredients || [];
  repaired.frequencies = repaired.frequencies || [];
  repaired.slots = repaired.slots || [];
  repaired.cuisines = repaired.cuisines || [];
  repaired.meal_styles = repaired.meal_styles || [];

  for (const { token, field } of positiveTokens(repaired, kind, ctx.userText)) {
    const hazard = hazardForToken(token);
    const catalog = anyEligible(features, token, participantIds, constraints, tastes);
    const limitIds = hazard ? hazard.limits.filter((id) => limits.has(id)) : [];
    const catalogConflict = catalog.coverage && !catalog.eligible;
    if (!limitIds.length && !catalogConflict) continue;
    let alternative = hazard?.alternative ? { ...hazard.alternative } : alternativeForToken(token);
    if (alternative.kind === "category") {
      const fishBlocked = limits.has("no_finfish");
      const altCheck = anyEligible(features, alternative.token, participantIds, constraints, tastes);
      if (fishBlocked || (altCheck.coverage && !altCheck.eligible)) alternative = { kind: "drop" };
    }
    const resolvedLimits = limitIds.length ? limitIds : limitIdsForToken(token);
    conflicts.push({
      code: "hard_ineligible",
      field,
      token,
      limit_ids: resolvedLimits,
      alternative,
    });
    removed.push(token);
    if (alternative.kind === "category" && alternative.token === "fish") applyFish(repaired, token, kind);
    else scrubToken(repaired, token, kind);
  }

  if (kind === "discovery") {
    if (conflicts.some((row) => (row.limit_ids || []).includes("no_shellfish"))) {
      repaired.protein_groups = (repaired.protein_groups || []).filter((item) => item !== "shellfish" && item !== "seafood");
    }
    // A repaired query must not keep leftover words from the dropped request.
    repaired.text_residue = removed.length ? null : stripFillerResidue(repaired.text_residue);
  }
  return { conflicts, repaired, removed };
}

/**
 * Detect hard-ineligible tokens on planning state.
 * @returns {{ conflicts: object[], repaired: object, removed: string[] }}
 */
export function detectPlanningConflicts(state, ctx) {
  return detectConflicts(state, ctx, "plan");
}

export function detectDiscoveryConflicts(state, ctx) {
  return detectConflicts(state, ctx, "discovery");
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
