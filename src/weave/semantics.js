/**
 * D-06.1 shared fuzzy intent.
 * Planning and Find both call this module. The model may name a concept.
 * This file decides what that concept means, which signals it may touch,
 * and which ones it must leave alone. It never writes eligibility, taste
 * evidence, or a health claim.
 */

import { getTasteTerm } from "../lib/taste-vocabulary.js";
import { INTENT_CUES } from "./constants.js";

export const SUPPORT_STATUS = Object.freeze([
  "canonical",
  "derived",
  "unsupported_soft",
  "explicit_hard",
]);

export const SEMANTIC_ROLES = Object.freeze([
  "preference",
  "ranking_boost",
  "soft_exclusion",
  "hard_filter",
]);

export const ZERO_RESULT_REASONS = Object.freeze([
  "no_catalog_match",
  "hard_eligibility",
  "explicit_filters",
  "unsupported_soft_intent",
  "combined_constraints",
  "unknown",
]);

export const FRYING_KINDS = Object.freeze(["deep", "pan", "shallow"]);

/** Closed ranking tokens this module may attach. Not a second ontology. */
export const SEMANTIC_RANK_TOKENS = Object.freeze([
  "vegetable_forward",
  "fish_forward",
  "fewer_fried",
  "avoid_comforting",
  "adventurous",
  "indulgent",
  "crispy_non_fry",
]);

/**
 * Compact canonical vocabulary. Surface phrases live in PHRASES / ALIASES.
 * `signals` are the deterministic fields this concept may set.
 * A concept never means the items in `not`.
 */
export const CANONICAL_CONCEPTS = Object.freeze({
  light: {
    id: "light",
    support: "canonical",
    role: "ranking_boost",
    cues: ["light"],
    not: ["calories", "a nutrition score", "a medical diet", "a hard filter"],
  },
  hearty: {
    id: "hearty",
    support: "canonical",
    role: "ranking_boost",
    cues: ["filling"],
    not: ["a guaranteed portion", "a hard style filter"],
  },
  fresh: {
    id: "fresh",
    support: "canonical",
    role: "ranking_boost",
    cues: ["fresh"],
    not: ["raw-only", "a safety claim"],
  },
  comforting: {
    id: "comforting",
    support: "canonical",
    role: "ranking_boost",
    cues: ["comforting"],
    not: ["a required soup", "a health judgment"],
  },
  cozy: {
    id: "cozy",
    support: "canonical",
    role: "ranking_boost",
    cues: ["cozy"],
    not: ["a temperature", "a hard style filter"],
  },
  filling: {
    id: "filling",
    support: "canonical",
    role: "ranking_boost",
    cues: ["filling"],
    not: ["calories", "a hard style filter"],
  },
  summery: {
    id: "summery",
    support: "canonical",
    role: "ranking_boost",
    cues: ["summery"],
    not: ["a season lock"],
  },
  special: {
    id: "special",
    support: "canonical",
    role: "preference",
    cues: ["special"],
    not: ["a named dish", "an eligibility bypass"],
  },
  restaurant_like: {
    id: "restaurant_like",
    support: "canonical",
    role: "ranking_boost",
    cues: ["restaurant_like"],
    not: ["a restaurant name", "a hard effort filter"],
  },
  weeknight: {
    id: "weeknight",
    support: "canonical",
    role: "preference",
    cues: ["weeknight"],
    preference: { keep_it_easy: true },
    not: ["criteria.quick", "a hard clock"],
  },
  quick: {
    id: "quick",
    support: "canonical",
    role: "preference",
    cues: ["weeknight"],
    preference: { keep_it_easy: true },
    not: ["a hard minute cap", "the bare-word quick bypass"],
  },
  simple: {
    id: "simple",
    support: "canonical",
    role: "preference",
    preference: { keep_ingredients_simple: true },
    not: ["a hard ingredient-complexity filter", "only simple"],
  },
  adventurous: {
    id: "adventurous",
    support: "canonical",
    role: "ranking_boost",
    rank: ["adventurous"],
    not: ["a hard complexity filter"],
  },
  indulgent: {
    id: "indulgent",
    support: "canonical",
    role: "ranking_boost",
    rank: ["indulgent"],
    not: ["a health judgment", "a hard filter"],
  },
  vegetable_forward: {
    id: "vegetable_forward",
    support: "canonical",
    role: "ranking_boost",
    rank: ["vegetable_forward"],
    not: ["a vegetarian requirement", "a stored diet label"],
  },
  fish_forward: {
    id: "fish_forward",
    support: "canonical",
    role: "ranking_boost",
    rank: ["fish_forward"],
    not: ["a fish frequency", "shellfish", "an eligibility change"],
  },
  healthy: {
    id: "healthy",
    support: "derived",
    role: "preference",
    cues: ["light"],
    rank: ["vegetable_forward", "fish_forward", "fewer_fried"],
    not: ["a health claim", "calories", "a nutrition score", "a hard filter", "a fish frequency"],
  },
  fried: {
    id: "fried",
    support: "explicit_hard",
    role: "hard_filter",
    cooking: ["deep", "pan", "shallow"],
    not: ["baked crispy", "roasted crispy", "air-fried crispy", "stir-fry", "a title word alone"],
  },
  deep_fried: {
    id: "deep_fried",
    support: "explicit_hard",
    role: "hard_filter",
    cooking: ["deep"],
    not: ["pan-fried", "shallow-fried", "baked crispy", "air-fried crispy"],
  },
});

const ALIASES = Object.freeze({
  healthier: "healthy",
  healthful: "healthy",
  wholesome: "healthy",
  clean: "healthy",
  lighter: "light",
  heartier: "hearty",
  refreshing: "fresh",
  cozy: "cozy",
  "comfort-food": "comforting",
  comfort: "comforting",
  summer: "summery",
  summery: "summery",
  "restaurant-like": "restaurant_like",
  "restaurant-style": "restaurant_like",
  restaurant_like: "restaurant_like",
  "weeknight-friendly": "weeknight",
  "kid-friendly": "weeknight",
  "family-friendly": "weeknight",
  quick: "quick",
  simple: "simple",
  indulgent: "indulgent",
  fried: "fried",
  frying: "fried",
  "deep-fried": "deep_fried",
  deep_fried: "deep_fried",
  "pan-fried": "fried",
  "shallow-fried": "fried",
});

/** Longer phrases win. Polarity overrides the concept default. */
const PHRASES = Object.freeze([
  ["crispy but not deep fried", { id: "deep_fried", polarity: "avoid", also: "crispy_non_fry" }],
  ["not deep fried", { id: "deep_fried", polarity: "avoid" }],
  ["nothing deep fried", { id: "deep_fried", polarity: "avoid" }],
  ["nothing fried", { id: "fried", polarity: "avoid" }],
  ["no fried", { id: "fried", polarity: "avoid" }],
  ["not fried", { id: "fried", polarity: "avoid" }],
  ["without fried", { id: "fried", polarity: "avoid" }],
  ["avoid fried", { id: "fried", polarity: "avoid" }],
  ["nothing too heavy", { id: "light", polarity: "prefer" }],
  ["not too heavy", { id: "light", polarity: "prefer" }],
  ["not heavy", { id: "light", polarity: "prefer" }],
  ["nothing too rich", { id: "indulgent", polarity: "avoid" }],
  ["not too rich", { id: "indulgent", polarity: "avoid" }],
  ["no comfort food", { id: "comforting", polarity: "avoid" }],
  ["comfort food", { id: "comforting", polarity: "prefer" }],
  ["restaurant style", { id: "restaurant_like", polarity: "prefer" }],
  ["restaurant like", { id: "restaurant_like", polarity: "prefer" }],
  ["kid friendly", { id: "weeknight", polarity: "prefer" }],
  ["family friendly", { id: "weeknight", polarity: "prefer" }],
  ["clean and simple", { id: "simple", polarity: "prefer", also: "light" }],
  ["weeknight friendly", { id: "weeknight", polarity: "prefer" }],
]);

const FUZZY_TOKENS = new Set([
  "healthy",
  "healthier",
  "healthful",
  "wholesome",
  "clean",
  "light",
  "lighter",
  "fresh",
  "filling",
  "comforting",
  "comfort",
  "cozy",
  "hearty",
  "heartier",
  "summery",
  "summer",
  "special",
  "indulgent",
  "simple",
  "quick",
  "refreshing",
  "adventurous",
  "easy",
  "easier",
  "weeknight",
  "restaurant",
  "style",
  "friendly",
  "food",
  "heavy",
  "rich",
  "crispy",
  "fried",
  "frying",
  "fry",
  "deep",
]);

const ADJECTIVE_STOP = new Set([
  "dinner",
  "dinners",
  "meal",
  "meals",
  "food",
  "night",
  "tonight",
  "week",
  "easy",
  "easier",
  "with",
  "and",
  "but",
  "for",
  "fish",
  "shrimp",
]);

const STARTERS = Object.freeze([
  { id: "plan_three_easy", task: "planning_intent", text: "Plan three easy dinners", requires: [] },
  { id: "plan_fish_twice", task: "planning_intent", text: "Fish twice this week", requires: ["finfish"] },
  { id: "plan_lighter", task: "planning_intent", text: "Three lighter dinners", requires: [] },
  { id: "find_fresh", task: "discovery_intent", text: "Something fresh", requires: [] },
  { id: "find_lighter", task: "discovery_intent", text: "Something lighter", requires: [] },
  { id: "find_cozy", task: "discovery_intent", text: "Something cozy", requires: [] },
  { id: "find_shrimp", task: "discovery_intent", text: "Shrimp tacos", requires: ["shellfish"] },
  { id: "plan_weeknight", task: "planning_intent", text: "Keep this week easy", requires: [] },
]);

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const WEEKEND = new Set(["saturday", "sunday"]);

function uniqueSorted(list) {
  return [...new Set((list || []).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function conceptById(id) {
  if (CANONICAL_CONCEPTS[id]) return CANONICAL_CONCEPTS[id];
  const alias = ALIASES[id];
  if (alias && CANONICAL_CONCEPTS[alias]) return CANONICAL_CONCEPTS[alias];
  return null;
}

function isVocabularyToken(token) {
  const term = getTasteTerm(String(token || "").toLowerCase());
  return Boolean(term && term.active);
}

function emptySemantic() {
  return {
    applied: [],
    canonical_intents: [],
    unsupported_soft_count: 0,
    broadening: false,
    explicit_hard: [],
    primary_ack: null,
    force_ack: false,
  };
}

export function emptySemanticResult() {
  return emptySemantic();
}

/**
 * Deterministic normalization. Unknown ids are counted and dropped.
 * The raw unknown string is not returned.
 */
export function normalizeModelConcepts(concepts) {
  const applied = [];
  let unsupported = 0;
  for (const raw of concepts || []) {
    const polarity = raw?.polarity === "avoid" ? "avoid" : "prefer";
    const id = String(raw?.id || "")
      .toLowerCase()
      .trim()
      .replace(/[\s]+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 32);
    if (!id) {
      unsupported += 1;
      continue;
    }
    const concept = conceptById(id);
    if (!concept) {
      unsupported += 1;
      continue;
    }
    applied.push(resolveConcept(concept, polarity, id === concept.id ? concept.support : "derived"));
  }
  return { applied, unsupported_soft_count: unsupported };
}

function resolveConcept(concept, polarity, support) {
  const avoid = polarity === "avoid";
  const role = avoid && concept.id === "comforting" ? "soft_exclusion" : concept.role;
  return {
    id: concept.id,
    support: support || concept.support,
    role,
    polarity: avoid ? "avoid" : "prefer",
    cues: avoid ? [] : [...(concept.cues || [])],
    rank: avoid && concept.id === "indulgent" ? [] : [...(concept.rank || [])],
    preference: avoid ? null : concept.preference || null,
    cooking: avoid && concept.cooking ? [...concept.cooking] : [],
    soft_exclusion: avoid && (concept.id === "comforting" || concept.id === "indulgent"),
  };
}

function phraseHits(text) {
  const norm = ` ${String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
  const found = [];
  const covered = [];
  for (const [phrase, spec] of PHRASES) {
    const needle = ` ${phrase} `;
    if (!norm.includes(needle)) continue;
    if (covered.some((span) => phrase.includes(span) || span.includes(phrase))) continue;
    covered.push(phrase);
    const concept = conceptById(spec.id);
    if (!concept) continue;
    found.push(resolveConcept(concept, spec.polarity || "prefer", concept.support === "canonical" ? "canonical" : "derived"));
    if (spec.also === "crispy_non_fry") {
      found.push({
        id: "crispy_non_fry",
        support: "derived",
        role: "ranking_boost",
        polarity: "prefer",
        cues: [],
        rank: ["crispy_non_fry"],
        preference: null,
        cooking: [],
        soft_exclusion: false,
      });
    }
    if (spec.also === "light") {
      const light = conceptById("light");
      found.push(resolveConcept(light, "prefer", "derived"));
    }
  }
  return { found, norm };
}

function tokenHits(norm) {
  const tokens = norm.trim().split(" ").filter(Boolean);
  const found = [];
  for (const token of tokens) {
    const hyphen = token;
    const concept = conceptById(hyphen) || conceptById(ALIASES[hyphen] || "");
    if (!concept) continue;
    if (token === "fried" || token === "frying" || token === "fry") continue;
    const support = concept.id === "healthy" ? "derived" : concept.id === token ? "canonical" : "derived";
    found.push(resolveConcept(concept, "prefer", concept.support === "explicit_hard" ? "explicit_hard" : support));
  }
  return found;
}

function unknownAdjectives(text) {
  const source = String(text || "").toLowerCase();
  const found = [];
  const re = /\b(?:something|really|very|quite)\s+([a-z][a-z-]{2,})\b/g;
  for (const match of source.matchAll(re)) {
    const word = match[1];
    if (!word || ADJECTIVE_STOP.has(word) || FUZZY_TOKENS.has(word) || isVocabularyToken(word) || conceptById(word)) continue;
    found.push(word);
  }
  return found;
}

/**
 * Read subjective language out of the utterance. Explicit ingredient words
 * are left for the existing hard path.
 */
export function interpretFuzzyText(text) {
  const { found, norm } = phraseHits(text);
  const tokens = tokenHits(norm);
  const applied = [];
  const seen = new Set();
  for (const row of [...found, ...tokens]) {
    const key = `${row.id}:${row.polarity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    applied.push(row);
  }
  return { applied, unsupported_soft_count: unknownAdjectives(text).length, broadening: unknownAdjectives(text).length > 0 };
}

function mergeResolved(textRows, modelRows) {
  const applied = [];
  const seen = new Set();
  for (const row of [...textRows, ...modelRows]) {
    const key = `${row.id}:${row.polarity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    applied.push(row);
  }
  return applied;
}

function addCue(state, cue) {
  if (!INTENT_CUES.includes(cue)) return;
  state.intent_cues = uniqueSorted([...(state.intent_cues || []), cue]).slice(0, 4);
}

function addRank(state, token) {
  if (!SEMANTIC_RANK_TOKENS.includes(token)) return;
  state.semantic_rank = uniqueSorted([...(state.semantic_rank || []), token]);
}

function addCooking(state, kinds) {
  const next = new Set(state.exclude_cooking || []);
  for (const kind of kinds) if (FRYING_KINDS.includes(kind)) next.add(kind);
  state.exclude_cooking = [...next].sort();
}

const FRY_TERM = /^(?:fried|frying|fry|deep-fried|pan-fried|shallow-fried)$/;

function stripFryTerms(state) {
  for (const field of ["exclude_terms", "methods", "ingredients", "exclude_ingredients"]) {
    if (!Array.isArray(state[field])) continue;
    state[field] = state[field].filter((item) => !FRY_TERM.test(String(item || "").toLowerCase()));
  }
}

function residueTokens(residue) {
  return String(residue || "").toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
}

function stripSoftResidue(state, dropTokens) {
  if (!state.text_residue) return false;
  const drop = dropTokens || new Set();
  const kept = residueTokens(state.text_residue).filter((token) => {
    if (drop.has(token)) return false;
    if (FUZZY_TOKENS.has(token)) return false;
    if (conceptById(token) || ALIASES[token]) return false;
    return true;
  });
  const next = kept.length ? kept.join(" ").slice(0, 40) : null;
  const changed = next !== state.text_residue;
  state.text_residue = next;
  return changed;
}

function mappingAck(task, state, applied) {
  const healthy = applied.some((row) => row.id === "healthy" && row.polarity !== "avoid");
  if (!healthy) return null;
  const fish = (state.frequencies || []).find((row) => row.token === "fish" && row.min_count === 2 && row.max_count === 2);
  if (task === "planning_intent") {
    const count = state.dinner_count;
    const head = count ? `${count === 3 ? "Three" : count} lighter, veggie-forward dinners` : "Lighter, veggie-forward dinners";
    return fish ? `${head}, with fish twice.` : `${head}.`;
  }
  return "Here are some lighter, veggie-forward ideas.";
}

/**
 * Apply one normalized concept list onto planning or discovery state.
 * Hard frequencies, ingredients, and eligibility fields are not written here
 * except for an explicit frying-method exclusion.
 */
export function applySharedSemantics(state, { text = "", concepts = [], task = "discovery_intent" } = {}) {
  if (!state || typeof state !== "object") return emptySemantic();
  state.semantic_rank = uniqueSorted(state.semantic_rank || []);
  state.exclude_cooking = uniqueSorted(state.exclude_cooking || []).filter((kind) => FRYING_KINDS.includes(kind));
  const fromText = text ? interpretFuzzyText(text) : { applied: [], unsupported_soft_count: 0, broadening: false };
  const fromModel = normalizeModelConcepts(concepts);
  const dropTokens = new Set(unknownAdjectives(text));
  for (const raw of concepts || []) {
    const id = String(raw?.id || "").toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (id) dropTokens.add(id);
    const underscored = String(raw?.id || "").toLowerCase().replace(/[\s-]+/g, "_");
    if (underscored) dropTokens.add(underscored);
  }
  const applied = mergeResolved(fromText.applied, fromModel.applied);
  const unsupported = fromText.unsupported_soft_count + fromModel.unsupported_soft_count;
  for (const row of applied) {
    if (row.polarity === "avoid" && row.id === "fried") {
      addCooking(state, row.cooking.length ? row.cooking : [...FRYING_KINDS]);
      continue;
    }
    if (row.polarity === "avoid" && row.id === "deep_fried") {
      addCooking(state, ["deep"]);
      continue;
    }
    if (row.polarity === "avoid" && row.id === "comforting") {
      addRank(state, "avoid_comforting");
      state.intent_cues = (state.intent_cues || []).filter((cue) => cue !== "comforting");
      continue;
    }
    if (row.polarity === "avoid" && row.id === "indulgent") {
      addCue(state, "light");
      continue;
    }
    for (const cue of row.cues || []) addCue(state, cue);
    for (const token of row.rank || []) addRank(state, token);
    if (row.preference?.keep_it_easy === true && state.keep_it_easy == null) state.keep_it_easy = true;
    if (row.preference?.keep_ingredients_simple === true && state.keep_ingredients_simple == null) {
      state.keep_ingredients_simple = true;
    }
  }
  if (text && /\beasy\b/i.test(text) && state.keep_it_easy == null && !/\bonly easy\b|\bnothing but easy\b/i.test(text)) {
    state.keep_it_easy = true;
  }
  const hasFryExclusion = (state.exclude_cooking || []).length > 0;
  if (hasFryExclusion) stripFryTerms(state);
  const stripped = stripSoftResidue(state, dropTokens);
  const explicitHard = applied
    .filter((row) => row.role === "hard_filter" || row.support === "explicit_hard")
    .map((row) => row.id);
  const canonical = uniqueSorted(applied.filter((row) => row.support !== "unsupported_soft").map((row) => row.id));
  const primary = mappingAck(task, state, applied);
  return {
    applied,
    canonical_intents: canonical,
    unsupported_soft_count: unsupported,
    broadening: unsupported > 0 || stripped,
    explicit_hard: uniqueSorted(explicitHard),
    primary_ack: primary,
    force_ack: Boolean(primary),
  };
}

export function hasExplicitHardFilters(state) {
  if (!state) return false;
  const lists = [
    "ingredients",
    "include_ingredients",
    "protein_groups",
    "cuisines",
    "meal_styles",
    "exclude_cooking",
    "exclude_ingredients",
    "exclude_terms",
    "exclude_categories",
    "diet",
    "methods",
    "equipment",
    "effort_levels",
    "frequencies",
  ];
  if (lists.some((key) => (state[key] || []).length > 0)) return true;
  if (state.max_minutes_hard === true && state.max_minutes != null) return true;
  if (state.quick === true) return true;
  if (state.effort) return true;
  return false;
}

/**
 * Broadening order:
 * 1. Eligibility is never in this object and is never changed.
 * 2. Explicit hard lists stay (ingredients, proteins, cooking exclusions, frequencies).
 * 3. Drop leftover text that is not a vocabulary term.
 * 4. Ranking cues stay; they do not filter.
 */
export function broadenDiscoveryState(state) {
  const next = JSON.parse(JSON.stringify(state || {}));
  const before = next.text_residue;
  stripSoftResidue(next);
  return { state: next, broadened: next.text_residue !== before };
}

export function classifyZeroResult({ total, excluded = [], excludedCounts = null, state = {}, semantic = {}, catalogSize = 0 } = {}) {
  if (total > 0) return null;
  const counts = { ...(excludedCounts || {}) };
  if (!excludedCounts) {
    for (const row of excluded || []) counts[row.code] = (counts[row.code] || 0) + 1;
  }
  const hard = counts.ineligible_hard_limit || 0;
  const explicit = Object.entries(counts)
    .filter(([code]) => code.startsWith("explicit_"))
    .reduce((sum, [, n]) => sum + n, 0);
  const textMiss = counts.text_miss || 0;
  if (catalogSize > 0 && hard >= catalogSize) return "hard_eligibility";
  if (hard > 0 && explicit > 0) return "combined_constraints";
  if (explicit > 0 && !hard) return "explicit_filters";
  if (hard > 0 && !explicit) return "hard_eligibility";
  if ((semantic.unsupported_soft_count || 0) > 0 && !hasExplicitHardFilters(state)) return "unsupported_soft_intent";
  if (textMiss > 0 || catalogSize === 0) return "no_catalog_match";
  return "unknown";
}

export function canBroadenZero({ reason, state, semantic }) {
  if (reason !== "unsupported_soft_intent" && reason !== "no_catalog_match") return false;
  if (hasExplicitHardFilters(state)) return false;
  if ((semantic?.unsupported_soft_count || 0) > 0) return true;
  return semantic?.broadening === true;
}

export function resultCountBucket(count) {
  if (count == null) return null;
  const n = Number(count) || 0;
  if (n <= 0) return "0";
  if (n <= 3) return "1-3";
  if (n <= 12) return "4-12";
  return "13+";
}

/**
 * Privacy-safe telemetry. No utterance, acknowledgement, residue, or unknown string.
 */
export function buildSemanticTelemetry({
  task,
  semantic = {},
  source = "provider",
  resultCount = null,
  zeroReason = null,
  downstreamSuccess = null,
} = {}) {
  const allowed = new Set(Object.keys(CANONICAL_CONCEPTS));
  const intents = uniqueSorted((semantic.canonical_intents || []).filter((id) => allowed.has(id)));
  const route = source === "bypass" ? "bypass" : source === "provider" || source === "cache" ? "provider" : source === "deterministic" ? "deterministic" : "fallback";
  const reason = zeroReason && ZERO_RESULT_REASONS.includes(zeroReason) ? zeroReason : zeroReason == null ? null : "unknown";
  return {
    task: task === "planning_intent" || task === "discovery_intent" ? task : null,
    canonical_intents: intents,
    unsupported_soft_count: Math.max(0, Number(semantic.unsupported_soft_count) || 0),
    broadening: semantic.broadening === true,
    zero_result_reason: reason,
    result_count_bucket: resultCountBucket(resultCount),
    route,
    downstream_success: downstreamSuccess == null ? null : downstreamSuccess === true,
  };
}

const NEGATED_FRIED = /\b(?:no|not|without|never)\s+(?:a\s+|the\s+|any\s+)?(?:\w+\s+){0,3}?fried\b/gi;
const STIR = /\bstir[-\s]?fr(?:y|ied|ying)\b/i;
const AIR = /\bair[-\s]?fr(?:y|ied|ying|yer)\b/i;
const DEEP = /\bdeep[-\s]?fr(?:y|ied|ying)\b/i;
const SHALLOW = /\bshallow[-\s]?fr(?:y|ied|ying)\b/i;
const PAN = /\bpan[-\s]?fr(?:y|ied|ying)\b/i;
const BARE_FRY = /\b(?:fry|fried|frying)\b/i;
const BAKED_CRISP = /\b(?:bake[ds]?|baking|roast(?:ed|ing)?|oven)\b/i;
const CRISP = /\bcrisp(?:y|ed)?\b/i;

function classifyEvidence(text) {
  let src = String(text || "").replace(NEGATED_FRIED, " ");
  const frying = new Set();
  const crispy = new Set();
  const sawStir = STIR.test(src);
  src = src.replace(/\bstir[-\s]?fr(?:y|ied|ying)\b/gi, " ");
  if (AIR.test(src)) crispy.add("air_fried");
  src = src.replace(/\bair[-\s]?fr(?:y|ied|ying|yer)\b/gi, " ");
  if (DEEP.test(src)) frying.add("deep");
  if (SHALLOW.test(src)) frying.add("shallow");
  if (PAN.test(src)) frying.add("pan");
  src = src.replace(/\b(?:deep|shallow|pan)[-\s]?fr(?:y|ied|ying)\b/gi, " ");
  if (BARE_FRY.test(src)) {
    if (/\bshallow\b/i.test(src) || /\bshimmers\b/i.test(src)) frying.add("shallow");
    else frying.add("pan");
  }
  const original = String(text || "");
  if (BAKED_CRISP.test(original) && CRISP.test(original)) crispy.add("baked");
  if (/\broast(?:ed|ing)?\b/i.test(original) && CRISP.test(original)) crispy.add("roasted");
  return {
    frying: [...frying].sort(),
    crispy_non_fry: [...crispy].sort(),
    stir_fry: sawStir,
    classified: frying.size > 0 || crispy.size > 0 || sawStir,
  };
}

const METHOD_FRY = Object.freeze({
  deep_fry: "deep",
  "deep-fry": "deep",
  deepfry: "deep",
  pan_fry: "pan",
  "pan-fry": "pan",
  panfry: "pan",
  shallow_fry: "shallow",
  "shallow-fry": "shallow",
  fry: "pan",
  fried: "pan",
});

const METHOD_CRISP = Object.freeze({
  air_fry: "air_fried",
  "air-fry": "air_fried",
  airfry: "air_fried",
  air_fried: "air_fried",
});

/**
 * Cooking method from metadata and instructions. Title is used only when
 * those sources do not already classify the dish.
 */
export function deriveCookingMethod(source = {}) {
  const methods = [...(source.methods || []), ...(source.method ? [source.method] : [])].map((item) => String(item || "").toLowerCase());
  const steps = (source.steps || []).map((step) => (typeof step === "string" ? step : step?.body || "")).join("\n");
  const description = source.description || "";
  const meta = classifyEvidence(`${methods.join(" ")}\n${description}\n${steps}`);
  for (const method of methods) {
    if (METHOD_FRY[method]) meta.frying.push(METHOD_FRY[method]);
    if (METHOD_CRISP[method]) meta.crispy_non_fry.push(METHOD_CRISP[method]);
    if (method === "stir_fry" || method === "stir-fry") meta.stir_fry = true;
  }
  meta.frying = uniqueSorted(meta.frying);
  meta.crispy_non_fry = uniqueSorted(meta.crispy_non_fry);
  meta.classified = meta.frying.length > 0 || meta.crispy_non_fry.length > 0 || meta.stir_fry === true;
  if (meta.classified) {
    return {
      frying: meta.frying,
      crispy_non_fry: meta.crispy_non_fry,
      stir_fry: meta.stir_fry === true,
      source: "metadata",
    };
  }
  const title = classifyEvidence(source.title || "");
  return {
    frying: title.frying,
    crispy_non_fry: title.crispy_non_fry,
    stir_fry: title.stir_fry === true,
    source: title.classified ? "title" : "none",
  };
}

export function mealCooking(meal) {
  if (meal?.cooking?.frying || meal?.cooking?.crispy_non_fry) return meal.cooking;
  return deriveCookingMethod({
    methods: meal?.methods,
    steps: meal?.steps,
    description: meal?.description,
    title: meal?.title,
  });
}

export function excludedByFrying(meal, kinds) {
  const wanted = new Set(kinds || []);
  if (!wanted.size) return false;
  const cooking = mealCooking(meal);
  return (cooking.frying || []).some((kind) => wanted.has(kind));
}

export function deriveCatalogCookingMethods(packages) {
  return (packages || []).map((pkg) => {
    const version = pkg.recipe_version || pkg;
    const dish = pkg.dish || {};
    const cooking = deriveCookingMethod({
      methods: version.methods || pkg.methods || [],
      steps: version.steps || pkg.steps || [],
      description: version.description || dish.description || pkg.description || "",
      title: version.title || dish.title || pkg.title || "",
    });
    return {
      slug: dish.slug || dish.dish_id || version.dish_id || pkg.slug || null,
      cooking,
    };
  });
}

export function semanticScoreForMeal(meal, rankTokens) {
  const rank = new Set(rankTokens || []);
  if (!rank.size) return 0;
  let total = 0;
  const labels = new Set([...(meal?.dietary_labels || []), ...(meal?.eligibility_tags || [])]);
  const proteins = new Set(meal?.protein_groups || []);
  const cooking = mealCooking(meal);
  if (rank.has("vegetable_forward") && (labels.has("plant") || labels.has("vegetarian") || labels.has("plant_based"))) total += 0.15;
  if (rank.has("fish_forward") && proteins.has("fish")) total += 0.12;
  if (rank.has("fewer_fried") && (cooking.frying || []).length) total -= 0.12;
  if (rank.has("avoid_comforting")) total -= 0.05;
  if (rank.has("indulgent")) total += 0.08;
  if (rank.has("crispy_non_fry") && (cooking.crispy_non_fry || []).length) total += 0.1;
  if (rank.has("adventurous") && (meal?.ingredient_complexity === "adventurous" || Number(meal?.exploration) >= 0.55)) total += 0.1;
  return Math.max(-0.25, Math.min(0.25, total));
}

export function householdSafeStarterPrompts({ limits = [] } = {}) {
  const blocked = new Set(limits || []);
  return STARTERS.filter((row) => {
    if (row.requires.includes("finfish") && blocked.has("no_finfish")) return false;
    if (row.requires.includes("shellfish") && blocked.has("no_shellfish")) return false;
    if (row.requires.includes("meat") && (blocked.has("no_meat") || blocked.has("no_poultry"))) return false;
    if (row.requires.includes("dairy") && blocked.has("no_dairy")) return false;
    if (row.requires.includes("nuts") && blocked.has("no_nuts")) return false;
    return true;
  }).map(({ id, task, text }) => ({ id, task, text }));
}

function weekdayOf(date) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return WEEKDAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
}

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function candidateFrom(row) {
  const weekday = row.weekday || (row.date ? weekdayOf(row.date) : null);
  const label = weekday ? weekday.slice(0, 1).toUpperCase() + weekday.slice(1, 3) : `Dinner ${row.position}`;
  return {
    position: row.position ?? null,
    weekday: weekday || null,
    date: row.date || null,
    label,
  };
}

/**
 * The model must not guess a slot. Weekend language, or a weekday that is
 * not a single date in range, returns candidate slots and no target.
 */
export function ambiguousTarget({ text = "", dates = [], dinnerCount = null, today = null } = {}) {
  const named = WEEKDAYS.find((day) => new RegExp(`\\b${day}\\b`, "i").test(text));
  const weekend = /\b(?:the\s+)?weekend\b/i.test(text);
  if (!named && !weekend) return null;
  let rows = (dates || []).filter((row) => row && (row.date || row.weekday || row.position));
  if (!rows.length && today && dinnerCount) {
    const count = Math.min(Math.max(Number(dinnerCount) || 0, 1), 14);
    rows = [];
    for (let position = 1; position <= count; position += 1) {
      const date = addDays(today, position - 1);
      rows.push({ position, date, weekday: weekdayOf(date) });
    }
  }
  const pool = weekend ? rows.filter((row) => WEEKEND.has(row.weekday)) : rows.filter((row) => row.weekday === named);
  if (pool.length < 2) return null;
  const candidates = pool.map(candidateFrom);
  if (!candidates.length) return null;
  return {
    reason: "ambiguous_day",
    prompt: "Which dinner did you mean?",
    candidates,
  };
}

export function applyDinnerCount(state, dinnerCount) {
  const count = Number(dinnerCount);
  if (!Number.isInteger(count) || count < 1 || count > 14) return { ok: false, error: "dinner_count_invalid" };
  const next = JSON.parse(JSON.stringify(state || {}));
  next.dinner_count = count;
  return { ok: true, state: next };
}

/**
 * Usefulness atoms for the local corpus run. Schema validity is separate.
 */
export function usefulnessForCase(entry, observed) {
  const expect = entry?.usefulness || entry?.expect?.usefulness;
  if (!expect) return { scored: false };
  const state = observed.state || {};
  const nonEmpty = expect.non_empty === false ? observed.result_count === 0 : (observed.result_count || 0) > 0;
  const direction = (expect.direction || []).every((token) => {
    if ((state.intent_cues || []).includes(token)) return true;
    if ((state.semantic_rank || []).includes(token)) return true;
    if (token === "fish_frequency") {
      return (state.frequencies || []).some((row) => row.token === "fish" && row.min_count === 2);
    }
    if (token === "exclude_frying") return (state.exclude_cooking || []).length === 3;
    if (token === "exclude_deep") return (state.exclude_cooking || []).includes("deep") && !(state.exclude_cooking || []).includes("pan");
    return false;
  });
  const eligibilityKept = expect.eligibility_kept === false
    ? true
    : !(state.include_ingredients || []).includes("shrimp")
      && !(state.ingredients || []).includes("shrimp")
      && observed.eligibility_relaxed !== true;
  const ack = String(observed.acknowledgement || "");
  const ackOk = expect.ack_includes ? expect.ack_includes.every((part) => ack.toLowerCase().includes(String(part).toLowerCase())) : true;
  const ackClean = expect.ack_excludes ? expect.ack_excludes.every((part) => !ack.toLowerCase().includes(String(part).toLowerCase())) : !/\bhealthy\b/i.test(ack);
  return {
    scored: true,
    non_empty: Boolean(nonEmpty),
    direction_alignment: Boolean(direction),
    eligibility_kept: Boolean(eligibilityKept),
    ack_matches: Boolean(ackOk && ackClean),
  };
}
