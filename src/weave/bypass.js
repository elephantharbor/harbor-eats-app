/**
 * Deterministic Find bypass (architecture card §4).
 */
import { EFFORT_LEVELS, INGREDIENT_COMPLEXITIES } from "../lib/classification.js";
import { listVocabulary, normalizeTasteTerm } from "../lib/taste-vocabulary.js";
import { INTENT_CUES } from "./constants.js";
import { emptyDiscoveryState } from "./state.js";

const FUNCTION_WORDS = new Set([
  "something",
  "and",
  "with",
  "without",
  "but",
  "not",
  "too",
  "for",
  "like",
  "under",
  "over",
  "more",
  "less",
  "very",
  "really",
  "make",
  "find",
  "show",
  "give",
  "us",
  "me",
  "a",
  "an",
  "the",
  "of",
  "to",
  "that",
  "feels",
  "feel",
  "food",
  "dinner",
  "dinners",
  "meal",
  "meals",
  "style",
  "styled",
  "restaurant",
  ...INTENT_CUES,
]);

const QUICK_PHRASES = new Map([
  ["quick", { quick: true }],
  ["under 30", { quick: true }],
  ["under 30 minutes", { quick: true }],
  ["30 minutes", { quick: true }],
]);

const DIET_ALIASES = new Map([
  ["dairy free", "dairy_free"],
  ["plant", "plant"],
  ["vegetarian", "vegetarian"],
  ["plant based", "plant_based"],
]);

function buildLexicon() {
  /** @type {Map<string, { kind: string, slug: string, extra?: object }>} */
  const map = new Map();
  for (const term of listVocabulary()) {
    if (!term.active) continue;
    const slug = term.slug;
    const kind =
      term.category === "cuisine"
        ? "cuisines"
        : term.category === "meal_style"
          ? "meal_styles"
          : term.category === "flavor"
            ? "flavors"
            : term.category === "texture"
              ? "textures"
              : term.category === "ingredient"
                ? "ingredients"
                : null;
    if (!kind) continue;
    const keys = [slug, term.display_name, ...(term.synonyms || [])].map((k) => normalizeTasteTerm(k)).filter(Boolean);
    for (const key of keys) map.set(key, { kind, slug });
  }
  for (const slug of ["fish", "seafood", "shellfish"]) map.set(slug, { kind: "protein_groups", slug });
  for (const slug of EFFORT_LEVELS) map.set(slug, { kind: "effort_levels", slug });
  for (const slug of INGREDIENT_COMPLEXITIES) map.set(slug, { kind: "ingredient_complexities", slug });
  for (const [phrase, extra] of QUICK_PHRASES) map.set(phrase, { kind: "quick_phrase", slug: "quick", extra });
  for (const [alias, slug] of DIET_ALIASES) map.set(alias, { kind: "diet", slug });
  return map;
}

let lexiconCache = null;
function lexicon() {
  if (!lexiconCache) lexiconCache = buildLexicon();
  return lexiconCache;
}

export function normalizeFindText(text) {
  return normalizeTasteTerm(text || "");
}

/**
 * @returns {{ bypass: boolean, reason: string, patch?: object }}
 */
export function classifyDiscoveryBypass(text) {
  const normalized = normalizeFindText(text);
  if (!normalized) return { bypass: true, reason: "empty" };
  if (QUICK_PHRASES.has(normalized)) return { bypass: true, reason: "lexicon" };
  const hit = lexicon().get(normalized);
  if (hit) return { bypass: true, reason: "lexicon" };
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.some((t) => FUNCTION_WORDS.has(t))) return { bypass: false, reason: "function_word" };
  return { bypass: false, reason: "not_lexicon" };
}

/**
 * Apply bypass patch onto discovery canonical state (delta-shaped write).
 * @param {string} text
 */
export function bypassDiscoveryPatch(text) {
  const normalized = normalizeFindText(text);
  const state = emptyDiscoveryState();
  if (!normalized) return state;
  const quick = QUICK_PHRASES.get(normalized);
  if (quick) return { ...state, ...quick };
  const hit = lexicon().get(normalized);
  if (!hit) return state;
  if (hit.kind === "quick_phrase") return { ...state, ...hit.extra };
  const listKey = hit.kind;
  return { ...state, [listKey]: [hit.slug] };
}
