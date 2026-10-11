import { EFFORT_LEVELS, INGREDIENT_COMPLEXITIES } from "../lib/classification.js";
import { PLAN_TOKENS, PLANNING_CLEAR_FIELDS, DISCOVERY_CLEAR_FIELDS } from "./constants.js";

const str = (max) => ({ type: "string", maxLength: max });
const nul = (schema) => (Array.isArray(schema.type) ? schema : { ...schema, type: [schema.type, "null"] });

function listOpFields(planning) {
  return planning
    ? ["cuisines", "meal_styles", "include_ingredients", "exclude_ingredients", "exclude_categories", "intent_cues"]
    : [
        "cuisines",
        "meal_styles",
        "flavors",
        "ingredients",
        "exclude_ingredients",
        "methods",
        "equipment",
        "textures",
        "effort_levels",
        "ingredient_complexities",
        "protein_groups",
        "diet",
        "intent_cues",
      ];
}

function listOpSchema(planning) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["field", "op", "value"],
    properties: {
      field: { type: "string", enum: listOpFields(planning) },
      op: { type: "string", enum: ["add", "remove"] },
      value: str(40),
    },
  };
}

const frequencyOpSchema = {
  type: "object",
  additionalProperties: false,
  required: ["op", "token", "min_count", "max_count"],
  properties: {
    op: { type: "string", enum: ["set", "clear"] },
    token: { type: "string", enum: [...PLAN_TOKENS] },
    min_count: nul({ type: "integer", minimum: 0, maximum: 14 }),
    max_count: nul({ type: "integer", minimum: 0, maximum: 14 }),
  },
};

const slotOpSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "target_kind",
    "target",
    "op",
    "effort",
    "ingredient_complexity",
    "max_minutes",
    "max_minutes_hard",
    "special",
    "cuisine",
    "meal_style",
    "ingredient",
    "category",
  ],
  properties: {
    target_kind: { type: "string", enum: ["weekday", "date", "position"] },
    target: str(10),
    op: { type: "string", enum: ["set", "clear"] },
    effort: { type: ["string", "null"], enum: [...EFFORT_LEVELS, null] },
    ingredient_complexity: { type: ["string", "null"], enum: [...INGREDIENT_COMPLEXITIES, null] },
    max_minutes: nul({ type: "integer", minimum: 5, maximum: 240 }),
    max_minutes_hard: nul({ type: "boolean" }),
    special: nul({ type: "boolean" }),
    cuisine: nul(str(40)),
    meal_style: nul(str(40)),
    ingredient: nul(str(40)),
    category: { type: ["string", "null"], enum: [...PLAN_TOKENS, null] },
  },
};

export const planningIntentInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "state", "context"],
  properties: {
    text: str(500),
    state: { type: ["object", "null"] },
    context: { type: "object" },
    vocabulary: { type: "object" },
  },
};

export const planningIntentOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "acknowledgement",
    "clear",
    "dinner_count",
    "date_start",
    "date_end",
    "keep_it_easy",
    "keep_ingredients_simple",
    "max_minutes",
    "max_minutes_hard",
    "effort",
    "ingredient_complexity",
    "ingredient_complexity_hard",
    "special_count",
    "list_ops",
    "frequency_ops",
    "slot_ops",
  ],
  properties: {
    acknowledgement: str(120),
    clear: { type: "array", maxItems: 6, items: { type: "string", enum: [...PLANNING_CLEAR_FIELDS] } },
    dinner_count: nul({ type: "integer", minimum: 1, maximum: 14 }),
    date_start: nul(str(10)),
    date_end: nul(str(10)),
    keep_it_easy: nul({ type: "boolean" }),
    keep_ingredients_simple: nul({ type: "boolean" }),
    max_minutes: nul({ type: "integer", minimum: 5, maximum: 240 }),
    max_minutes_hard: nul({ type: "boolean" }),
    effort: { type: ["string", "null"], enum: [...EFFORT_LEVELS, null] },
    ingredient_complexity: { type: ["string", "null"], enum: [...INGREDIENT_COMPLEXITIES, null] },
    ingredient_complexity_hard: nul({ type: "boolean" }),
    special_count: nul({ type: "integer", minimum: 0, maximum: 14 }),
    list_ops: { type: "array", maxItems: 4, items: listOpSchema(true) },
    frequency_ops: { type: "array", maxItems: 3, items: frequencyOpSchema },
    slot_ops: { type: "array", maxItems: 3, items: slotOpSchema },
  },
};

export const discoveryIntentInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "state", "context"],
  properties: {
    text: str(200),
    state: { type: ["object", "null"] },
    context: { type: "object" },
    vocabulary: { type: "object" },
  },
};

export const discoveryIntentOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "acknowledgement",
    "clear",
    "text_residue",
    "max_minutes",
    "max_minutes_hard",
    "quick",
    "different",
    "keep_it_easy",
    "keep_ingredients_simple",
    "list_ops",
  ],
  properties: {
    acknowledgement: str(120),
    clear: { type: "array", maxItems: 6, items: { type: "string", enum: [...DISCOVERY_CLEAR_FIELDS] } },
    text_residue: nul(str(40)),
    max_minutes: nul({ type: "integer", minimum: 5, maximum: 240 }),
    max_minutes_hard: nul({ type: "boolean" }),
    quick: nul({ type: "boolean" }),
    different: nul({ type: "boolean" }),
    keep_it_easy: nul({ type: "boolean" }),
    keep_ingredients_simple: nul({ type: "boolean" }),
    list_ops: { type: "array", maxItems: 6, items: listOpSchema(false) },
  },
};

export function postValidatePlanningDelta(output) {
  const ack = String(output?.acknowledgement ?? "").trim();
  // The model's acknowledgement is optional. An empty string is valid;
  // the route composes one from the applied intent. Never burn a retry on it.
  let acknowledgement = ack;
  if (ack && /\b(allergen[- ]?free|safe for|guaranteed|certified)\b/i.test(ack)) acknowledgement = "Got it.";
  return { ok: true, value: { ...output, acknowledgement } };
}

export function postValidateDiscoveryDelta(output, input) {
  const base = postValidatePlanningDelta(output);
  if (!base.ok) return base;
  const vocabulary = input?.vocabulary || {};
  const dropped = [];
  const list_ops = [];
  for (const op of base.value.list_ops || []) {
    const allowed = vocabulary[op.field];
    if (Array.isArray(allowed) && !allowed.map((v) => String(v).toLowerCase()).includes(String(op.value).toLowerCase())) {
      if (op.field === "methods" || op.field === "equipment") {
        if (/^[a-z0-9_-]{1,40}$/.test(op.value)) list_ops.push(op);
        else dropped.push(op.value);
      } else dropped.push(op.value);
    } else list_ops.push(op);
  }
  return { ok: true, value: { ...base.value, list_ops }, dropped };
}
