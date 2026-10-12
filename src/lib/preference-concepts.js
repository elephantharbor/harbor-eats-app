/**
 * Three different ideas, kept apart:
 * - Hard limits decide whether a meal is eligible.
 * - Personal tastes only rank meals for one diner.
 * - Practical hints are planning notes a plan may override.
 *
 * Ratings, tastes, inferred notes, and hints never override a hard limit.
 * A high rating does not mean the diner likes every ingredient on the plate.
 */

import {
  CASHEW_PERMITTED,
  DATA_ORIGINS,
  EVIDENCE_STANCES,
  HARD_LIMIT_IDS,
  PRACTICAL_HINT_KEYS,
  STANCE_LABELS,
  TARGETED_FEEDBACK,
  TASTE_RANKS,
  TASTE_REMOVE,
} from "./cycle2-schema.js";
import { learningRows } from "./evidence-origin.js";
import { RULE_TO_TAGS } from "./eligibility.js";
import { CATALOG_ALLERGEN_TOKENS, FACTORY_PACKAGE_ALLERGEN_TOKENS } from "./factory-package-tokens.js";
import { getTasteTerm } from "./taste-vocabulary.js";

const NUT_SPECIFICS = [
  "cashew",
  "walnut",
  "peanut",
  "almond",
  "pecan",
  "hazelnut",
  "pistachio",
  "macadamia",
  "pine_nut",
];

const ALLERGEN_LIMITS = {
  meat: ["no_meat"],
  poultry: ["no_meat", "no_poultry"],
  shellfish: ["no_shellfish"],
  finfish: ["no_finfish"],
  dairy: ["no_dairy"],
  milk: ["no_dairy"],
  nuts: ["no_nuts"],
  walnut: ["no_nuts"],
  peanut: ["no_nuts"],
  almond: ["no_nuts"],
  pecan: ["no_nuts"],
  hazelnut: ["no_nuts"],
  pistachio: ["no_nuts"],
  macadamia: ["no_nuts"],
  pine_nut: ["no_nuts"],
  cashew: ["no_nuts"],
};

/** Ingredient tastes that also name a hard-limit substance. */
const INGREDIENT_LIMITS = {
  chicken: ["no_meat", "no_poultry"],
  shrimp: ["no_shellfish"],
  salmon: ["no_finfish"],
  cod: ["no_finfish"],
  "arctic-char": ["no_finfish"],
  swordfish: ["no_finfish"],
};

function addLexiconKey(map, key, value) {
  const norm = String(key || "").trim().toLowerCase();
  if (!norm) return;
  const forms = new Set([
    norm,
    norm.replace(/[-\s]+/g, "_"),
    norm.replace(/[_-]+/g, " "),
    norm.replace(/[_\s]+/g, "-"),
  ]);
  for (const form of forms) {
    if (!map.has(form)) map.set(form, value);
  }
}

function allergenTokenFor(rule, word) {
  const slug = String(word || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (ALLERGEN_LIMITS[slug]) return slug;
  if (rule === "fish") return "finfish";
  if (rule === "dairy") return "dairy";
  if (rule === "shellfish") return "shellfish";
  if (rule === "poultry") return "poultry";
  if (rule === "meat") {
    if (slug === "poultry" || slug === "chicken" || slug === "turkey" || slug === "duck") return "poultry";
    return "meat";
  }
  if (rule === "nuts") return "nuts";
  return null;
}

function buildSubstituteLexicon() {
  const allergens = new Map();
  const ingredients = new Map();
  const diet = new Map();
  const tags = new Map();
  for (const key of Object.keys(ALLERGEN_LIMITS)) addLexiconKey(allergens, key, key);
  for (const key of Object.keys(INGREDIENT_LIMITS)) addLexiconKey(ingredients, key, key);
  for (const token of FACTORY_PACKAGE_ALLERGEN_TOKENS) {
    addLexiconKey(allergens, token, token === "tree_nut" ? "nuts" : token);
  }
  for (const token of CATALOG_ALLERGEN_TOKENS) {
    addLexiconKey(allergens, token, token);
  }
  for (const [rule, words] of Object.entries(RULE_TO_TAGS)) {
    for (const word of words) {
      addLexiconKey(diet, word, rule);
      const allergen = allergenTokenFor(rule, word);
      if (allergen) addLexiconKey(allergens, word, allergen);
      addLexiconKey(tags, word, word);
    }
  }
  return { allergens, ingredients, diet, tags };
}

const SUBSTITUTE_LEXICON = buildSubstituteLexicon();

function singularizeToken(token) {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) return token.slice(0, -1);
  return token;
}

function substituteCandidates(name) {
  const cleaned = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const set = new Set();
  const add = (value) => {
    if (!value) return;
    set.add(value);
    set.add(value.replace(/ /g, "_"));
    set.add(value.replace(/ /g, "-"));
    const singular = singularizeToken(value);
    set.add(singular);
    set.add(singular.replace(/ /g, "_"));
    set.add(singular.replace(/ /g, "-"));
  };
  add(cleaned);
  for (const word of words) add(word);
  for (let i = 0; i < words.length - 1; i += 1) {
    add(`${singularizeToken(words[i])} ${singularizeToken(words[i + 1])}`);
  }
  return set;
}

/**
 * Allergen and diet tokens for a proposed substitute.
 * Unknown names stay unknown so callers can fail closed.
 * @param {string} name
 */
export function classifySubstituteName(name) {
  const candidates = substituteCandidates(name);
  const allergens = new Set();
  const ingredient_slugs = new Set();
  const diet_tokens = new Set();
  const tags = new Set();
  let known = false;
  for (const token of candidates) {
    if (SUBSTITUTE_LEXICON.allergens.has(token)) {
      known = true;
      allergens.add(SUBSTITUTE_LEXICON.allergens.get(token));
    }
    if (SUBSTITUTE_LEXICON.ingredients.has(token)) {
      known = true;
      ingredient_slugs.add(SUBSTITUTE_LEXICON.ingredients.get(token));
    }
    if (SUBSTITUTE_LEXICON.diet.has(token)) {
      known = true;
      diet_tokens.add(SUBSTITUTE_LEXICON.diet.get(token));
    }
    if (SUBSTITUTE_LEXICON.tags.has(token)) tags.add(SUBSTITUTE_LEXICON.tags.get(token));
  }
  return {
    known,
    allergens: [...allergens],
    ingredient_slugs: [...ingredient_slugs],
    diet_tokens: [...diet_tokens],
    tags: [...tags],
  };
}

/**
 * @typedef {{ id: string, status?: string, substance?: string|null }} HardRule
 * @typedef {{ member_id: string, rules: HardRule[] }} MemberLimits
 * @typedef {{
 *   allergens?: string[],
 *   vocabulary_tag_ids?: string[],
 *   ingredient_slugs?: string[],
 * }} RecipeSignals
 */

export function tasteRankEffect(rank) {
  if (!TASTE_RANKS.includes(rank)) {
    throw new Error(`unknown taste rank: ${rank}`);
  }
  return {
    rank,
    excludes: false,
    allergy: false,
    ban: false,
    ordering: rank === "less_often" ? "lower" : "higher",
  };
}

/**
 * One standing taste for one diner. Inferred notes do not replace
 * something that diner already stated.
 * @param {object[]} tastes
 * @param {{
 *   member_id: string,
 *   vocabulary_slug: string,
 *   rank: string,
 *   stance?: string,
 *   confidence?: number|null,
 *   data_origin?: string,
 * }} next
 */
export function setTaste(tastes, next) {
  if (!next || !next.member_id) throw new Error("a taste belongs to one diner");
  if (!TASTE_RANKS.includes(next.rank)) throw new Error(`unknown taste rank: ${next.rank}`);
  const stance = next.stance || "explicit";
  if (!EVIDENCE_STANCES.includes(stance)) throw new Error(`unknown stance: ${stance}`);
  const concept = getTasteTerm(next.vocabulary_slug);
  if (!concept || !concept.active) throw new Error(`unknown taste: ${next.vocabulary_slug}`);
  let confidence = null;
  if (stance === "inferred") {
    confidence = Number(next.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error("inferred taste needs an internal confidence between 0 and 1");
    }
  } else if (next.confidence != null) {
    throw new Error("an explicit taste does not carry a confidence");
  }
  const origin = next.data_origin || "unproven";
  if (!DATA_ORIGINS.includes(origin)) throw new Error(`unknown data origin: ${origin}`);
  const row = {
    member_id: next.member_id,
    vocabulary_slug: concept.slug,
    rank: next.rank,
    stance,
    confidence,
    data_origin: origin,
    household_average: false,
  };
  const prior = (tastes || []).find(
    (item) => item.member_id === row.member_id && item.vocabulary_slug === row.vocabulary_slug
  );
  if (prior && prior.stance === "explicit" && stance === "inferred") {
    return { tastes: tastes || [], rejected: "explicit_wins", taste: prior };
  }
  const rest = (tastes || []).filter(
    (item) => !(item.member_id === row.member_id && item.vocabulary_slug === row.vocabulary_slug)
  );
  return { tastes: [...rest, row], rejected: null, taste: row };
}

export function removeTaste(tastes, memberId, vocabularySlug) {
  if (!memberId) throw new Error("a taste belongs to one diner");
  return {
    action: TASTE_REMOVE,
    tastes: (tastes || []).filter(
      (item) => !(item.member_id === memberId && item.vocabulary_slug === vocabularySlug)
    ),
    hard_limit_written: false,
  };
}

export function combineTasteRanks() {
  throw new Error("Taste ranks stay with one diner");
}

export function rankFor(tastes, memberId, vocabularySlug) {
  return (
    (tastes || []).find(
      (item) => item.member_id === memberId && item.vocabulary_slug === vocabularySlug
    ) || null
  );
}

/**
 * Consumer copy. Internal confidence stays off this object.
 * @param {{ stance?: string, confidence?: number|null }} record
 */
export function presentStance(record) {
  const stance = record && record.stance === "inferred" ? "inferred" : "explicit";
  if (stance === "explicit") {
    return { stance, label: STANCE_LABELS.explicit, editable: true, correctable: true };
  }
  return { stance, label: STANCE_LABELS.inferred, editable: true, correctable: true };
}

/** A meal rating never fans out into ingredient or attribute tastes. */
export function attributeTastesFromMealRating() {
  return [];
}

function memberClearsNuts(rules, allergens) {
  const permitted = rules.some((rule) => rule.id === CASHEW_PERMITTED && rule.status !== "prohibited");
  if (!permitted) return false;
  const specifics = allergens.filter((tag) => NUT_SPECIFICS.includes(tag));
  if (!specifics.length) return false;
  return specifics.every((tag) => tag === "cashew");
}

/**
 * @param {HardRule[]} rules
 * @param {RecipeSignals} recipe
 */
export function blockedLimitIds(rules, recipe) {
  const allergens = recipe?.allergens || [];
  const ingredients = [...(recipe?.ingredient_slugs || []), ...(recipe?.vocabulary_tag_ids || [])];
  /** @type {Set<string>} */
  const hits = new Set();
  for (const tag of allergens) {
    for (const id of ALLERGEN_LIMITS[tag] || []) hits.add(id);
  }
  for (const slug of ingredients) {
    for (const id of INGREDIENT_LIMITS[slug] || []) hits.add(id);
  }
  if (hits.has("no_nuts") && memberClearsNuts(rules, allergens)) hits.delete("no_nuts");

  /** @type {string[]} */
  const blocked = [];
  for (const rule of rules || []) {
    if (!rule || rule.status === "permitted") continue;
    if (rule.id === "allergy" || rule.id === "prohibited_ingredient") {
      const substance = String(rule.substance || "").trim().toLowerCase();
      if (!substance) continue;
      const present =
        allergens.includes(substance) ||
        ingredients.includes(substance) ||
        (recipe?.vocabulary_tag_ids || []).includes(substance);
      if (present) blocked.push(rule.id);
      continue;
    }
    if (hits.has(rule.id)) blocked.push(rule.id);
  }
  return blocked;
}

/**
 * Eligibility ignores tastes, ratings, inferred rows, and practical hints
 * on purpose. Pass them anyway; the result does not change.
 * @param {{
 *   limits: MemberLimits[],
 *   recipe: RecipeSignals,
 *   tastes?: object[],
 *   ratings?: object[],
 *   practicalHints?: object[],
 *   inferred?: object[],
 * }} input
 */
export function decideEligibility(input) {
  const limits = input?.limits || [];
  /** @type {{ member_id: string, limit_ids: string[] }[]} */
  const blocked = [];
  for (const member of limits) {
    const ids = blockedLimitIds(member.rules || [], input.recipe || {});
    if (ids.length) blocked.push({ member_id: member.member_id, limit_ids: ids });
  }
  return {
    eligible: blocked.length === 0,
    blocked,
    taste_count_ignored: (input.tastes || []).length + (input.inferred || []).length,
    rating_count_ignored: (input.ratings || []).length,
    hint_count_ignored: (input.practicalHints || []).length,
  };
}

export function setPracticalHint(hints, next) {
  if (!next || !next.member_id) throw new Error("a planning hint belongs to one diner");
  if (!PRACTICAL_HINT_KEYS.includes(next.hint_key)) {
    throw new Error(`unknown planning hint: ${next.hint_key}`);
  }
  const detail = next.hint_key === "equipment" ? String(next.detail || "").trim() : "";
  if (next.hint_key === "equipment" && !detail) {
    throw new Error("an equipment hint needs a detail");
  }
  const stance = next.stance || "explicit";
  if (!EVIDENCE_STANCES.includes(stance)) throw new Error(`unknown stance: ${stance}`);
  const origin = next.data_origin || "unproven";
  if (!DATA_ORIGINS.includes(origin)) throw new Error(`unknown data origin: ${origin}`);
  const row = {
    member_id: next.member_id,
    hint_key: next.hint_key,
    detail,
    stance,
    data_origin: origin,
    overridden: false,
    overridable: true,
    affects_eligibility: false,
    taste_evidence: false,
  };
  const rest = (hints || []).filter(
    (item) =>
      !(
        item.member_id === row.member_id &&
        item.hint_key === row.hint_key &&
        (item.detail || "") === row.detail
      )
  );
  return [...rest, row];
}

export function overridePracticalHint(hints, memberId, hintKey, detail = "") {
  const wanted = hintKey === "equipment" ? detail : "";
  return (hints || []).map((item) => {
    if (item.member_id !== memberId || item.hint_key !== hintKey) return item;
    if ((item.detail || "") !== wanted) return item;
    return { ...item, overridden: true, affects_eligibility: false, taste_evidence: false };
  });
}

export function activePracticalHints(hints) {
  return (hints || []).filter((item) => !item.overridden);
}

/**
 * A hint can describe a fit. It cannot block the meal.
 * @param {object} hint
 * @param {{ total_minutes?: number|null, equipment?: string[], vocabulary_tag_ids?: string[] }} recipe
 */
export function planningNote(hint, recipe) {
  if (!hint || hint.overridden) return { applies: false, blocks: false };
  let applies = false;
  if (hint.hint_key === "under_30_minutes") {
    applies = recipe?.total_minutes != null && recipe.total_minutes <= 30;
  } else if (hint.hint_key === "grill_friendly") {
    const equipment = recipe?.equipment || [];
    const tags = recipe?.vocabulary_tag_ids || [];
    applies = equipment.includes("grill") || tags.includes("grilled");
  } else if (hint.hint_key === "equipment") {
    applies = (recipe?.equipment || []).includes(hint.detail);
  } else if (hint.hint_key === "weeknight" || hint.hint_key === "low_cleanup") {
    applies = false;
  }
  return { applies, blocks: false, taste_evidence: false };
}

/**
 * @param {{
 *   member_id: string,
 *   recipe_version_id: string,
 *   code: string,
 *   data_origin?: string,
 * }} input
 */
export function recordTargetedFeedback(input) {
  const def = TARGETED_FEEDBACK[input?.code];
  if (!def) throw new Error(`unknown targeted feedback: ${input?.code}`);
  if (!input.member_id || !input.recipe_version_id) {
    throw new Error("targeted feedback belongs to one diner and one recipe version");
  }
  const origin = input.data_origin || "unproven";
  if (!DATA_ORIGINS.includes(origin)) throw new Error(`unknown data origin: ${origin}`);
  return {
    member_id: input.member_id,
    recipe_version_id: input.recipe_version_id,
    code: def.code,
    label: def.label,
    signal: def.signal,
    vocabulary_slug: def.vocabulary_slug,
    stance: "explicit",
    data_origin: origin,
    required: false,
    writes_taste_rank: false,
    writes_hard_limit: false,
  };
}

/** New taste rows use the same household / synthetic / unproven gate as Cycle 1. */
export function learningTasteRows(rows, household) {
  return learningRows(rows, household);
}

export function isHardLimitId(id) {
  return HARD_LIMIT_IDS.includes(id) || id === CASHEW_PERMITTED;
}
