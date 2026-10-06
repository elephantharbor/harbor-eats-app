/**
 * DiscoveryQuery. Stable schema, normalization, and serialization.
 * This module does not rank meals and does not read a sentence.
 */

import { EFFORT_LEVELS, INGREDIENT_COMPLEXITIES } from "../lib/classification.js";
import {
  CRITERIA_KEYS,
  CRITERIA_LIST_FIELDS,
  DIET_FILTERS,
  DISCOVERY_DEFAULT_LIMIT,
  DISCOVERY_MAX_LIMIT,
  DISCOVERY_MAX_LIST,
  DISCOVERY_MAX_TEXT,
  DISCOVERY_SCHEMA_VERSION,
  FORBIDDEN_QUERY_KEYS,
  PROTEIN_GROUP_FILTERS,
  QUERY_KEYS,
  SOFT_KEYS,
  TEXTURE_FILTERS,
} from "./constants.js";

const SLUG_RE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

function fail(error, status = 400) {
  return { ok: false, error, status };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unknownKey(keys, allowed) {
  return keys.find((key) => !allowed.includes(key)) || null;
}

/**
 * @param {unknown} value
 * @param {string} name
 * @param {{ enum?: readonly string[] }} [opts]
 */
function normalizeSlugList(value, name, opts = {}) {
  if (value == null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return fail(`${name}_invalid`);
  if (value.length > DISCOVERY_MAX_LIST) return fail(`${name}_invalid`);
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") return fail(`${name}_invalid`);
    const slug = item.trim().toLowerCase();
    if (!slug || !SLUG_RE.test(slug)) return fail(`${name}_invalid`);
    if (opts.enum && !opts.enum.includes(slug)) return fail(`${name}_invalid`);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  out.sort((a, b) => a.localeCompare(b));
  return { ok: true, value: out };
}

function normalizeText(value) {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return fail("text_invalid");
  const text = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return { ok: true, value: null };
  if (text.length > DISCOVERY_MAX_TEXT) return fail("text_invalid");
  return { ok: true, value: text };
}

function normalizeBool(value, name) {
  if (typeof value !== "boolean") return fail(`${name}_invalid`);
  return { ok: true, value };
}

function normalizeLimit(value) {
  if (value == null) return { ok: true, value: DISCOVERY_DEFAULT_LIMIT };
  if (typeof value !== "number" || !Number.isInteger(value)) return fail("limit_invalid");
  if (value < 1 || value > DISCOVERY_MAX_LIMIT) return fail("limit_invalid");
  return { ok: true, value };
}

function normalizeOffset(value) {
  if (value == null) return { ok: true, value: 0 };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return fail("offset_invalid");
  return { ok: true, value };
}

function normalizeMaxMinutes(value) {
  if (value == null) return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fail("max_minutes_invalid");
  return { ok: true, value };
}

const INSPIRED_SUFFIX = "-inspired";

const LIST_ENUMS = Object.freeze({
  effort_levels: EFFORT_LEVELS,
  ingredient_complexities: INGREDIENT_COMPLEXITIES,
  protein_groups: PROTEIN_GROUP_FILTERS,
  diet: DIET_FILTERS,
  textures: TEXTURE_FILTERS,
});

/**
 * A base cuisine token also matches the stored `{token}-inspired` form.
 * `italian` therefore hits `italian-inspired`. A token that already ends
 * in `-inspired` is left alone, so the inspired form does not invent the
 * base. This is not a synonym table: `greek` does not become `mediterranean`.
 * @param {string[]} list
 */
export function expandCuisineTokens(list) {
  const out = new Set(list);
  for (const token of list) {
    if (!token.endsWith(INSPIRED_SUFFIX)) out.add(`${token}${INSPIRED_SUFFIX}`);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/**
 * `plant` is the plant-forward collection. It matches stored labels
 * `plant`, `plant_based`, and `vegetarian`. A lone `vegetarian` or
 * `plant_based` stays exact. `dairy_free` does not imply plant.
 * @param {string[]} list
 */
export function expandDietTokens(list) {
  const out = new Set(list);
  if (out.has("plant")) {
    out.add("plant_based");
    out.add("vegetarian");
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

const DIET_KEYS = new Set(["constraints", "eligible"]);
const PANTRY_KEYS = new Set(["pantry", "already_have"]);

/**
 * Diet flags are refused outright. Pantry is not a filter. Old names such
 * as `effort` and `simple` are unknown so they are not silently remapped
 * onto Easy, Quick, or ingredient_complexity.
 * @param {object} input
 */
function rejectKey(key) {
  if (DIET_KEYS.has(key)) return fail("client_constraints_forbidden");
  if (PANTRY_KEYS.has(key)) return fail("pantry_not_a_filter");
  if (FORBIDDEN_QUERY_KEYS.includes(key)) return fail("unknown_field");
  return null;
}

function rejectForbidden(input) {
  for (const key of Object.keys(input)) {
    const rejected = rejectKey(key);
    if (rejected) return rejected;
  }
  if (input.criteria && isPlainObject(input.criteria)) {
    for (const key of Object.keys(input.criteria)) {
      const rejected = rejectKey(key);
      if (rejected) return rejected;
    }
  }
  return { ok: true };
}

export function emptyCriteria() {
  return {
    cuisines: [],
    meal_styles: [],
    flavors: [],
    ingredients: [],
    exclude_ingredients: [],
    effort_levels: [],
    ingredient_complexities: [],
    max_minutes: null,
    methods: [],
    equipment: [],
    quick: false,
    protein_groups: [],
    diet: [],
    textures: [],
    different: false,
  };
}

export function emptySoft() {
  return { keep_it_easy: false, keep_ingredients_simple: false };
}

/** A browse of the eligible catalog. Both D-01 chips off. Quick off. */
export function emptyQuery() {
  return {
    schema_version: DISCOVERY_SCHEMA_VERSION,
    text: null,
    criteria: emptyCriteria(),
    soft: emptySoft(),
    soft_provided: false,
    limit: DISCOVERY_DEFAULT_LIMIT,
    offset: 0,
  };
}

/**
 * @param {object} [input]
 * @returns {{ ok: true, query: object } | { ok: false, error: string, status: number }}
 */
export function validateQuery(input) {
  return normalizeQuery(input);
}

/**
 * Canonical DiscoveryQuery. Lists are lowercase, unique, and sorted.
 * `quick` is not copied onto `effort_levels`. `simple` is not accepted
 * as a field. Omitted `soft` stays `soft_provided: false` so a plan mode
 * can inherit the run's chips.
 * @param {object} [input]
 */
export function normalizeQuery(input = {}) {
  if (input == null) return { ok: true, query: emptyQuery() };
  if (!isPlainObject(input)) return fail("query_invalid");
  const forbidden = rejectForbidden(input);
  if (!forbidden.ok) return forbidden;
  const unknown = unknownKey(Object.keys(input), QUERY_KEYS);
  if (unknown) return fail("unknown_field", 400);

  let schema = input.schema_version == null ? DISCOVERY_SCHEMA_VERSION : input.schema_version;
  if (typeof schema === "string" && schema.trim() === String(DISCOVERY_SCHEMA_VERSION)) {
    schema = DISCOVERY_SCHEMA_VERSION;
  }
  if (schema !== DISCOVERY_SCHEMA_VERSION) return fail("schema_version_unsupported");

  const text = normalizeText(input.text);
  if (!text.ok) return text;

  const criteriaInput = input.criteria == null ? {} : input.criteria;
  if (!isPlainObject(criteriaInput)) return fail("criteria_invalid");
  const criteriaUnknown = unknownKey(Object.keys(criteriaInput), CRITERIA_KEYS);
  if (criteriaUnknown) return fail("unknown_field");

  const criteria = emptyCriteria();
  for (const field of CRITERIA_LIST_FIELDS) {
    const enums = LIST_ENUMS[field] || null;
    const list = normalizeSlugList(criteriaInput[field], field, enums ? { enum: enums } : {});
    if (!list.ok) return list;
    criteria[field] = list.value;
  }
  criteria.cuisines = expandCuisineTokens(criteria.cuisines);
  criteria.diet = expandDietTokens(criteria.diet);
  const maxMinutes = normalizeMaxMinutes(criteriaInput.max_minutes);
  if (!maxMinutes.ok) return maxMinutes;
  criteria.max_minutes = maxMinutes.value;
  if (criteriaInput.quick == null) criteria.quick = false;
  else {
    const quick = normalizeBool(criteriaInput.quick, "quick");
    if (!quick.ok) return quick;
    criteria.quick = quick.value;
  }
  if (criteriaInput.different == null) criteria.different = false;
  else {
    const different = normalizeBool(criteriaInput.different, "different");
    if (!different.ok) return different;
    criteria.different = different.value;
  }

  const soft = emptySoft();
  let soft_provided = false;
  if (Object.prototype.hasOwnProperty.call(input, "soft") && input.soft != null) {
    if (!isPlainObject(input.soft)) return fail("soft_invalid");
    const softUnknown = unknownKey(Object.keys(input.soft), SOFT_KEYS);
    if (softUnknown) return fail("unknown_field");
    soft_provided = true;
    for (const key of SOFT_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(input.soft, key) || input.soft[key] == null) continue;
      const flag = normalizeBool(input.soft[key], key);
      if (!flag.ok) return flag;
      soft[key] = flag.value;
    }
  }

  const limit = normalizeLimit(input.limit);
  if (!limit.ok) return limit;
  const offset = normalizeOffset(input.offset);
  if (!offset.ok) return offset;

  return {
    ok: true,
    query: {
      schema_version: DISCOVERY_SCHEMA_VERSION,
      text: text.value,
      criteria,
      soft,
      soft_provided,
      limit: limit.value,
      offset: offset.value,
    },
  };
}

/** Object form stored in fixtures and POST bodies. Key order is part of the contract. */
export function canonicalQuery(query) {
  const criteria = query.criteria;
  return {
    schema_version: query.schema_version,
    text: query.text,
    criteria: {
      cuisines: [...criteria.cuisines],
      meal_styles: [...criteria.meal_styles],
      flavors: [...criteria.flavors],
      ingredients: [...criteria.ingredients],
      exclude_ingredients: [...criteria.exclude_ingredients],
      effort_levels: [...criteria.effort_levels],
      ingredient_complexities: [...criteria.ingredient_complexities],
      max_minutes: criteria.max_minutes,
      methods: [...criteria.methods],
      equipment: [...criteria.equipment],
      quick: criteria.quick,
      protein_groups: [...criteria.protein_groups],
      diet: [...criteria.diet],
      textures: [...criteria.textures],
      different: criteria.different,
    },
    soft: query.soft_provided
      ? { keep_it_easy: query.soft.keep_it_easy, keep_ingredients_simple: query.soft.keep_ingredients_simple }
      : null,
    limit: query.limit,
    offset: query.offset,
  };
}

const LIST_PARAMS = Object.freeze({
  cuisine: "cuisines",
  style: "meal_styles",
  flavor: "flavors",
  ingredient: "ingredients",
  exclude_ingredient: "exclude_ingredients",
  effort: "effort_levels",
  complexity: "ingredient_complexities",
  method: "methods",
  equipment: "equipment",
  protein: "protein_groups",
  diet: "diet",
  texture: "textures",
});

function readListParam(params, name) {
  if (!params.getAll(name).length) return undefined;
  const parts = [];
  for (const value of params.getAll(name)) {
    for (const piece of String(value).split(",")) {
      if (piece.trim()) parts.push(piece.trim());
    }
  }
  return parts;
}

function readBoolParam(params, name) {
  if (!params.has(name)) return undefined;
  const raw = params.get(name);
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return { invalid: true };
}

/**
 * GET /api/discovery/search query string → the same object normalizeQuery accepts.
 * `q` is an alias of `text`. When both are present, `text` wins.
 * @param {URLSearchParams|string} input
 */
export function queryFromSearchParams(input) {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  /** @type {Record<string, unknown>} */
  const query = {};
  if (params.has("schema")) query.schema_version = Number(params.get("schema"));
  if (params.has("text")) query.text = params.get("text");
  else if (params.has("q")) query.text = params.get("q");
  /** @type {Record<string, unknown>} */
  const criteria = {};
  let anyCriteria = false;
  for (const [param, field] of Object.entries(LIST_PARAMS)) {
    const list = readListParam(params, param);
    if (list) {
      criteria[field] = list;
      anyCriteria = true;
    }
  }
  if (params.has("max_minutes")) {
    const raw = params.get("max_minutes");
    const num = raw == null || raw === "" ? NaN : Number(raw);
    criteria.max_minutes = num;
    anyCriteria = true;
  }
  if (params.has("quick")) {
    const quick = readBoolParam(params, "quick");
    if (quick && quick.invalid) return fail("quick_invalid");
    criteria.quick = quick;
    anyCriteria = true;
  }
  if (params.has("different")) {
    const different = readBoolParam(params, "different");
    if (different && different.invalid) return fail("different_invalid");
    criteria.different = different;
    anyCriteria = true;
  }
  if (anyCriteria) query.criteria = criteria;
  const keepEasy = params.has("keep_it_easy") ? readBoolParam(params, "keep_it_easy") : undefined;
  const keepSimple = params.has("keep_ingredients_simple") ? readBoolParam(params, "keep_ingredients_simple") : undefined;
  if (keepEasy && keepEasy.invalid) return fail("keep_it_easy_invalid");
  if (keepSimple && keepSimple.invalid) return fail("keep_ingredients_simple_invalid");
  if (keepEasy !== undefined || keepSimple !== undefined) {
    query.soft = {};
    if (keepEasy !== undefined) query.soft.keep_it_easy = keepEasy;
    if (keepSimple !== undefined) query.soft.keep_ingredients_simple = keepSimple;
  }
  if (params.has("limit")) query.limit = Number(params.get("limit"));
  if (params.has("offset")) query.offset = Number(params.get("offset"));
  return { ok: true, input: query };
}

/**
 * Canonical query string. Parameter order is fixed. False soft flags are
 * written only when the caller provided `soft`, so an omitted chip still
 * inherits on the way back in.
 * @param {object} query normalized query
 */
export function serializeQueryString(query) {
  const params = new URLSearchParams();
  params.set("schema", String(query.schema_version));
  if (query.text) params.set("text", query.text);
  const criteria = query.criteria;
  const pairs = [
    ["cuisine", criteria.cuisines],
    ["style", criteria.meal_styles],
    ["flavor", criteria.flavors],
    ["ingredient", criteria.ingredients],
    ["exclude_ingredient", criteria.exclude_ingredients],
    ["effort", criteria.effort_levels],
    ["complexity", criteria.ingredient_complexities],
    ["method", criteria.methods],
    ["equipment", criteria.equipment],
    ["protein", criteria.protein_groups],
    ["diet", criteria.diet],
    ["texture", criteria.textures],
  ];
  for (const [name, list] of pairs) {
    if (list && list.length) params.set(name, list.join(","));
  }
  if (criteria.max_minutes != null) params.set("max_minutes", String(criteria.max_minutes));
  if (criteria.quick) params.set("quick", "1");
  if (criteria.different) params.set("different", "1");
  if (query.soft_provided) {
    params.set("keep_it_easy", query.soft.keep_it_easy ? "1" : "0");
    params.set("keep_ingredients_simple", query.soft.keep_ingredients_simple ? "1" : "0");
  }
  params.set("limit", String(query.limit));
  params.set("offset", String(query.offset));
  return params.toString();
}

/**
 * @param {object|string|URLSearchParams} input
 */
export function parseQuery(input) {
  if (typeof input === "string" || input instanceof URLSearchParams) {
    const built = queryFromSearchParams(input);
    if (!built.ok) return built;
    return normalizeQuery(built.input);
  }
  return normalizeQuery(input);
}
