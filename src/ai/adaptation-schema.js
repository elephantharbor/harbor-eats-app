const str = (max) => ({ type: "string", maxLength: max });

export const recipeAdaptationInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "recipe"],
  properties: {
    text: str(300),
    recipe: {
      type: "object",
      additionalProperties: false,
      required: ["recipe_version_id", "title", "equipment", "ingredients", "steps"],
      properties: {
        recipe_version_id: str(80),
        title: str(120),
        equipment: { type: "array", maxItems: 12, items: str(80) },
        ingredients: {
          type: "array",
          maxItems: 40,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["ingredient_id", "name"],
            properties: {
              ingredient_id: str(40),
              name: str(60),
            },
          },
        },
        steps: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["step_number", "title"],
            properties: {
              step_number: { type: "integer", minimum: 1, maximum: 30 },
              title: str(80),
            },
          },
        },
      },
    },
  },
};

export const recipeAdaptationOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "acknowledgement",
    "kind",
    "support",
    "ingredient_ops",
    "step_notes",
    "equipment_supported",
    "flavor_impact",
    "warning",
  ],
  properties: {
    acknowledgement: str(120),
    kind: {
      type: "string",
      enum: ["substitution", "omit", "flavor", "simplify", "filling", "equipment", "prep", "unsupported"],
    },
    support: { type: "string", enum: ["advice", "unsupported"] },
    ingredient_ops: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op", "from_id", "to_name", "policy"],
        properties: {
          op: { type: "string", enum: ["replace", "remove", "add"] },
          from_id: { type: ["string", "null"], maxLength: 40 },
          to_name: { type: ["string", "null"], maxLength: 40 },
          policy: { type: "string", enum: ["keep_scaled", "omit", "to_taste"] },
        },
      },
    },
    step_notes: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step_number", "note"],
        properties: {
          step_number: { type: "integer", minimum: 1, maximum: 30 },
          note: str(160),
        },
      },
    },
    equipment_supported: { type: ["boolean", "null"] },
    flavor_impact: {
      type: ["string", "null"],
      enum: ["milder", "richer", "fresher", "similar", "unknown", null],
    },
    warning: { type: ["string", "null"], maxLength: 120 },
  },
};

const AUTHORITY_CLAIMS = /\b(allergen[- ]?free|safe for (?:your|people|those|anyone)|nut[- ]?free|gluten[- ]?free|dairy[- ]?free|guaranteed|certified|eligible for)\b/i;

function hasDigit(text) {
  return /\d/.test(text || "");
}

export function postValidateRecipeAdaptation(output) {
  if (!output.acknowledgement || !String(output.acknowledgement).trim()) {
    return { ok: false, reason: "empty_ack" };
  }
  if (AUTHORITY_CLAIMS.test(output.acknowledgement || "")) return { ok: false, reason: "authority_claim" };
  if (hasDigit(output.acknowledgement)) return { ok: false, reason: "digit_ack" };
  if (output.warning && (AUTHORITY_CLAIMS.test(output.warning) || hasDigit(output.warning))) {
    return { ok: false, reason: "digit_warning" };
  }
  for (const note of output.step_notes || []) {
    if (hasDigit(note.note)) return { ok: false, reason: "digit_step" };
  }
  return { ok: true, value: output };
}
