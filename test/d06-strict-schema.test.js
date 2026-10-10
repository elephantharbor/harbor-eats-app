import { describe, expect, it } from "vitest";
import { TASKS } from "../src/ai/index.js";
import { buildResponsesRequest, toStrictSchema } from "../src/ai/providers/openai.js";
import { effectiveMaxOutputTokens, outputCeiling } from "../src/ai/pricing.js";
import { modelForTask, reasoningEffortsForModel } from "../src/ai/routing.js";
import { validateStrictSchema } from "../src/ai/strict-schema.js";

describe("OpenAI strict-mode output schemas", () => {
  for (const task of Object.values(TASKS)) {
    it(`${task.id} wire schema, name, effort, and output cap are accepted`, () => {
      const model = modelForTask(task);
      const wire = buildResponsesRequest({
        model,
        schema_name: task.id,
        system: "S",
        user: "U",
        max_output_tokens: task.limits.max_output_tokens,
        reasoning_effort: task.reasoning_effort,
        response_schema: task.output_schema,
      });
      const problems = validateStrictSchema(toStrictSchema(task.output_schema), { name: wire.text.format.name });
      expect(problems).toEqual([]);
      expect(wire.text.format).toMatchObject({ type: "json_schema", strict: true, name: task.id });
      expect(reasoningEffortsForModel(model)).toContain(task.reasoning_effort);
      expect(wire.reasoning).toEqual({ effort: task.reasoning_effort });
      const cap = effectiveMaxOutputTokens(task.limits.max_output_tokens, model);
      expect(cap).toBeGreaterThan(0);
      expect(cap).toBeLessThanOrEqual(outputCeiling(model));
      expect(wire.max_output_tokens).toBe(cap);
    });
  }

  it("rejects the strict-mode mistakes that return HTTP 400", () => {
    const bad = validateStrictSchema({
      anyOf: [{ type: "object", additionalProperties: false, properties: {}, required: [] }],
    }, { name: "bad name" });
    expect(bad.some((p) => p.startsWith("name:"))).toBe(true);
    expect(bad.some((p) => p.includes("anyOf"))).toBe(true);

    const open = validateStrictSchema({
      type: "object",
      properties: {
        effort: { type: "string", enum: ["easy", null], default: "easy", format: "uri" },
        extra: { type: ["string", "number"] },
      },
      required: ["effort"],
    });
    expect(open.some((p) => p.includes("additionalProperties"))).toBe(true);
    expect(open.some((p) => p.includes("required missing"))).toBe(true);
    expect(open.some((p) => p.includes("enum value"))).toBe(true);
    expect(open.some((p) => p.includes("unsupported keyword default"))).toBe(true);
    expect(open.some((p) => p.includes("unsupported format"))).toBe(true);
    expect(open.some((p) => p.includes("type union"))).toBe(true);

    const pattern = validateStrictSchema({
      type: "object",
      additionalProperties: false,
      required: ["bag"],
      properties: { bag: { type: "object", patternProperties: { "^x": { type: "string" } }, additionalProperties: false, properties: {}, required: [] } },
    });
    expect(pattern.some((p) => p.includes("patternProperties"))).toBe(true);
  });

  it("refuses reasoning.effort minimal for gpt-6-luna before any network call", () => {
    expect(() => buildResponsesRequest({
      model: "gpt-6-luna",
      schema_name: "planning_intent",
      max_output_tokens: 560,
      reasoning_effort: "minimal",
      response_schema: TASKS.planning_intent.output_schema,
    })).toThrow(/provider_config|reasoning_effort/);
  });
});
