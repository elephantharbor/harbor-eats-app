/**
 * Typed task registry. Each task declares: input/output schema, prompt version, allowed models,
 * cost class, cache policy, limits, and a deterministic post-validator that strips or rejects
 * anything the LLM is not authoritative for. `executable` marks tasks wired end-to-end in the
 * D-05 foundation; others are registered contracts for later releases.
 */
import { PROMPTS } from "./prompts.js";

const str = (max) => ({ type: "string", maxLength: max });
const strList = (max, items = 120) => ({ type: "array", maxItems: max, items: str(items) });
const textInput = (max = 500) => ({ type: "object", required: ["text"], properties: { text: str(max) } });

/** Phrases an LLM must never assert: safety/eligibility claims belong to deterministic systems. */
const AUTHORITY_CLAIMS = /\b(allergen[- ]?free|safe for (?:your|people|those|anyone)|nut[- ]?free|gluten[- ]?free|dairy[- ]?free|guaranteed|certified|eligible for)\b/i;

function stripAuthorityClaims(text) {
  return AUTHORITY_CLAIMS.test(text) ? { ok: false, reason: "authority_claim" } : { ok: true };
}

/** Keep only facet values present in the deterministic vocabulary the caller supplied. */
function filterToVocabulary(output, input) {
  const vocab = input.vocabulary || {};
  const facets = {};
  for (const [key, values] of Object.entries(output.facets || {})) {
    const allowed = new Set((vocab[key] || []).map((v) => String(v).toLowerCase()));
    const kept = (values || []).map((v) => String(v).toLowerCase()).filter((v) => allowed.has(v));
    if (kept.length) facets[key] = [...new Set(kept)].sort();
  }
  const out = { ...output, facets };
  if (out.max_minutes != null && !(Number.isInteger(out.max_minutes) && out.max_minutes >= 5 && out.max_minutes <= 240)) {
    delete out.max_minutes;
  }
  return { ok: true, value: out };
}

const FACET_KEYS = ["cuisines", "meal_styles", "flavors", "ingredients", "exclude_ingredients", "methods", "equipment", "textures", "effort_levels"];
const facetsSchema = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(FACET_KEYS.map((k) => [k, strList(10, 40)])),
};

// Rate limits live in config.js/limits.js (household/minute, household/day, global/day, Sol/day);
// tasks only carry max_retries (<=1), the output cap (outer model ceiling applies) and timeout.
const DEFAULT_LIMITS = { max_retries: 1, max_output_tokens: 400, timeout_ms: 8000 };

function task(id, spec) {
  if (!PROMPTS[id]) throw new Error(`task ${id} has no prompt`);
  const { limits = {}, ...rest } = spec;
  return Object.freeze({
    id,
    prompt_version: PROMPTS[id].version,
    executable: false,
    cache: { enabled: true, ttl_seconds: 86400 },
    post_validate: (output) => ({ ok: true, value: output }),
    ...rest,
    limits: Object.freeze({ ...DEFAULT_LIMITS, ...limits }),
  });
}

export const TASKS = Object.freeze({
  planning_intent: task("planning_intent", {
    cost_class: "cheap",
    allowed_models: ["fast-small"],
    input_schema: textInput(),
    output_schema: {
      type: "object",
      required: ["nights", "keep_it_easy"],
      additionalProperties: false,
      properties: {
        nights: { type: ["integer", "null"], minimum: 1, maximum: 7 },
        keep_it_easy: { type: "boolean" },
        keep_ingredients_simple: { type: "boolean" },
        notes: str(200),
      },
    },
  }),
  discovery_intent: task("discovery_intent", {
    executable: true,
    cost_class: "cheap",
    allowed_models: ["fast-small"],
    input_schema: {
      type: "object",
      required: ["text"],
      properties: { text: str(200), vocabulary: { type: "object" } },
    },
    output_schema: {
      type: "object",
      required: ["facets"],
      additionalProperties: false,
      properties: {
        facets: facetsSchema,
        max_minutes: { type: ["integer", "null"] },
        quick: { type: "boolean" },
        different: { type: "boolean" },
        keep_it_easy: { type: "boolean" },
        keep_ingredients_simple: { type: "boolean" },
      },
    },
    post_validate: filterToVocabulary,
    limits: { max_output_tokens: 250, timeout_ms: 5000 },
  }),
  feedback_extraction: task("feedback_extraction", {
    cost_class: "cheap",
    allowed_models: ["fast-small"],
    input_schema: { type: "object", required: ["text"], properties: { text: str(1000), meal: str(120) } },
    output_schema: {
      type: "object",
      required: ["themes"],
      additionalProperties: false,
      properties: { themes: strList(8, 40), sentiment: { type: "string", enum: ["positive", "mixed", "negative", "neutral"] } },
    },
    // Never produces a taste score: themes are advisory text only.
  }),
  concept_generation: task("concept_generation", {
    cost_class: "creative",
    allowed_models: ["balanced", "strong"],
    cache: { enabled: false, ttl_seconds: 0 },
    input_schema: textInput(),
    output_schema: {
      type: "object",
      required: ["concepts"],
      additionalProperties: false,
      properties: { concepts: { type: "array", maxItems: 5, items: { type: "object", required: ["title"], properties: { title: str(80), pitch: str(240) } } } },
    },
    limits: { max_output_tokens: 800, timeout_ms: 20000 },
  }),
  recipe_draft: task("recipe_draft", {
    cost_class: "creative",
    allowed_models: ["strong"],
    cache: { enabled: false, ttl_seconds: 0 },
    input_schema: textInput(300),
    output_schema: { type: "object", required: ["title", "status"], properties: { title: str(80), status: { type: "string", enum: ["draft_unreviewed"] } } },
    limits: { max_output_tokens: 1500, timeout_ms: 30000 },
  }),
  recipe_adaptation: task("recipe_adaptation", {
    cost_class: "creative",
    allowed_models: ["balanced", "strong"],
    cache: { enabled: false, ttl_seconds: 0 },
    input_schema: { type: "object", required: ["text", "recipe"], properties: { text: str(300), recipe: str(120) } },
    output_schema: { type: "object", required: ["suggestion", "status"], properties: { suggestion: str(600), status: { type: "string", enum: ["draft_unreviewed"] } } },
    limits: { max_output_tokens: 600, timeout_ms: 15000 },
  }),
  explanation: task("explanation", {
    executable: true,
    cost_class: "standard",
    allowed_models: ["fast-small", "balanced"],
    input_schema: {
      type: "object",
      required: ["meal", "reasons"],
      properties: { meal: str(120), reasons: strList(6, 60) },
    },
    output_schema: { type: "object", required: ["text"], additionalProperties: false, properties: { text: str(280) } },
    post_validate: (output) => {
      const check = stripAuthorityClaims(output.text);
      return check.ok ? { ok: true, value: output } : { ok: false, reason: check.reason };
    },
    limits: { max_output_tokens: 120, timeout_ms: 5000 },
  }),
  semantic_search_assist: task("semantic_search_assist", {
    cost_class: "cheap",
    allowed_models: ["fast-small"],
    input_schema: textInput(200),
    output_schema: { type: "object", required: ["phrasings"], additionalProperties: false, properties: { phrasings: strList(5, 80) } },
  }),
});

export const TASK_IDS = Object.freeze(Object.keys(TASKS));

export function getTask(id) {
  return Object.prototype.hasOwnProperty.call(TASKS, id) ? TASKS[id] : null;
}
