/**
 * D-05 s1 follow-up: per-task reasoning effort, explanation cap 300, output_limit code, and
 * safe usage metadata on EVERY OpenAI call (success and failure). Mocked fetch only.
 */
import { describe, expect, it, vi } from "vitest";
import { createGenerationService, createMemoryStore, TASKS } from "../src/ai/index.js";
import { createOpenAIProvider, buildResponsesRequest } from "../src/ai/providers/openai.js";
import { REASONING_EFFORTS } from "../src/ai/tasks.js";
import { PRICING_VERSION, costUsd } from "../src/ai/pricing.js";

const KEY = "sk-test-NEVER-LEAK-0123456789abcdef";
const ON = { AI_GATEWAY_ENABLED: "1", AI_TASKS_ENABLED: "explanation", AI_DAILY_BUDGET_USD: "5", AI_PROVIDER: "openai" };
const now = () => new Date("2026-10-10T15:00:30.000Z");
const SECRET_OUTPUT = "Ready in twenty minutes with pantry staples.";
const SECRET_REASONING = "internal chain of thought do not store";
const MEAL = "Private Household Meal Name";

function run(body, { status = 200, headers = [["x-request-id", "req_abc123"]] } = {}) {
  const sent = [];
  const fetchImpl = vi.fn(async (_u, init) => {
    sent.push(JSON.parse(init.body));
    return { status, ok: status < 400, headers: new Map(headers), json: async () => body };
  });
  const provider = createOpenAIProvider({ env: { OPENAI_API_KEY: KEY }, fetchImpl });
  const store = createMemoryStore();
  const service = createGenerationService({ provider, store, env: ON, now });
  return { service, store, sent, fetchImpl };
}
const usage = { input_tokens: 130, output_tokens: 60, input_tokens_details: { cached_tokens: 10 }, output_tokens_details: { reasoning_tokens: 0 } };
const completed = (text = SECRET_OUTPUT) => ({
  id: "resp_ok1", status: "completed", model: "gpt-6-luna-2026-10-01",
  output: [{ type: "reasoning", summary: [{ text: SECRET_REASONING }] }, { type: "message", content: [{ type: "output_text", text: JSON.stringify({ text }) }] }],
  usage,
});
const meta = (store) => JSON.parse(store.usage.at(-1).usage_metadata_json);

describe("per-task reasoning effort + explanation cap", () => {
  it("every task sets reasoning_effort explicitly; explanation is none; caps otherwise unchanged", () => {
    for (const t of Object.values(TASKS)) expect(REASONING_EFFORTS).toContain(t.reasoning_effort);
    expect(TASKS.explanation.reasoning_effort).toBe("none");
    expect(TASKS.explanation.limits.max_output_tokens).toBe(300);
    expect(TASKS.discovery_intent.limits.max_output_tokens).toBe(360);
    expect(TASKS.planning_intent.limits.max_output_tokens).toBe(600);
    expect(TASKS.recipe_draft.limits.max_output_tokens).toBe(1500);
  });
  it("adapter sends reasoning: {effort}, keeps strict json_schema", () => {
    const b = buildResponsesRequest({ model: "gpt-6-luna", schema_name: "explanation", system: "S", user: "U", max_output_tokens: 300, reasoning_effort: "none", response_schema: TASKS.explanation.output_schema });
    expect(b.reasoning).toEqual({ effort: "none" });
    expect(b.max_output_tokens).toBe(300);
    expect(b.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(b).not.toHaveProperty("temperature");
  });
  it("gateway passes explanation reasoning effort none and cap 300 on the wire", async () => {
    const { service, sent } = run(completed());
    expect((await service.run("explanation", { meal: MEAL, reasons: ["quick"], cache_bust: null })).ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ model: "gpt-6-luna", max_output_tokens: 300, reasoning: { effort: "none" } });
  });
});

describe("output_limit", () => {
  it("incomplete/max_output_tokens => output_limit, one attempt, usage + metadata recorded", async () => {
    const { service, store, fetchImpl } = run({ id: "resp_inc", status: "incomplete", model: "gpt-6-luna", incomplete_details: { reason: "max_output_tokens" }, usage: { input_tokens: 124, output_tokens: 300, output_tokens_details: { reasoning_tokens: 250 } } });
    const r = await service.run("explanation", { meal: MEAL, reasons: ["quick"], cache_bust: null });
    expect(r.error).toBe("output_limit");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const row = store.usage.at(-1);
    expect(row).toMatchObject({ status: "fallback:output_limit", input_tokens: 124, output_tokens: 300, attempts: 1 });
    expect(meta(store)).toMatchObject({ response_status: "incomplete", incomplete_reason: "max_output_tokens", error_code: "output_limit", error_detail: "incomplete:max_output_tokens", reasoning_tokens: 250, request_id: "req_abc123", response_id: "resp_inc", reported_model: "gpt-6-luna" });
  });
});

describe("usage metadata on every call", () => {
  it("success: requested/reported model, status, all tokens, pricing, cost, request ids", async () => {
    const { service, store } = run(completed());
    await service.run("explanation", { meal: MEAL, reasons: ["quick"], cache_bust: null });
    const m = meta(store);
    const cost = costUsd("gpt-6-luna", { input_tokens: 130, cached_input_tokens: 10, output_tokens: 60 });
    expect(m).toEqual({
      requested_model: "gpt-6-luna", reported_model: "gpt-6-luna-2026-10-01", http_status: 200, response_status: "completed", incomplete_reason: null,
      error_code: null, error_detail: null, reasoning_effort: "none", max_output_tokens: 300,
      input_tokens: 130, cached_input_tokens: 10, reasoning_tokens: 0, output_tokens: 60,
      pricing_version: PRICING_VERSION, estimated_cost_usd: cost, attempts: 1, attempt_latencies_ms: [0],
      request_id: "req_abc123", response_id: "resp_ok1",
      error_message: null, error_type: null, error_param: null,
    });
    expect(store.usage.at(-1).status).toBe("ok");
  });
  it("HTTP 400 is provider_config, not retried, and records sanitized error message/type/param", async () => {
    const { service, store, fetchImpl } = run({ error: { message: "bad param " + KEY, type: "invalid_request_error", param: "reasoning.effort" } }, { status: 400 });
    const r = await service.run("explanation", { meal: MEAL, reasons: ["quick"], cache_bust: null });
    expect(r.error).toBe("provider_config");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.usage.at(-1).attempts).toBe(1);
    const m = meta(store);
    expect(m).toMatchObject({ http_status: 400, error_code: "provider_config", error_detail: "status_400", error_type: "invalid_request_error", error_param: "reasoning.effort", request_id: "req_abc123", requested_model: "gpt-6-luna" });
    expect(m.error_message).toMatch(/bad param/);
    expect(m.error_message).not.toMatch(/sk-/);
    expect(JSON.stringify(m)).not.toContain(KEY);
  });
  it("schema failure records malformed_output with schema detail", async () => {
    const { service, store } = run({ ...completed(), output: [{ type: "message", content: [{ type: "output_text", text: '{"nope":1}' }] }] });
    const r = await service.run("explanation", { meal: MEAL, reasons: ["quick"], cache_bust: null });
    expect(r.error).toBe("malformed_output");
    const m = meta(store);
    expect(m.error_code).toBe("malformed_output");
    expect(m.error_detail).toMatch(/^schema:/);
    expect(m.response_status).toBe("completed");
  });
  it("never stores prompts, outputs, reasoning text, the key or household input", async () => {
    for (const body of [completed(), { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, usage }, { error: { message: KEY } }]) {
      const { service, store } = run(body, { status: body.error ? 401 : 200 });
      await service.run("explanation", { meal: MEAL, reasons: ["quick"], cache_bust: null });
      const j = store.usage.at(-1).usage_metadata_json;
      for (const bad of [KEY, SECRET_OUTPUT, SECRET_REASONING, MEAL, "Private"]) expect(j).not.toContain(bad);
      expect(() => JSON.parse(j)).not.toThrow();
    }
  });
  it("hostile provider strings are sanitized/truncated", async () => {
    const { service, store } = run({ ...completed(), id: "x".repeat(500), model: 'luna"<script>' + KEY });
    await service.run("explanation", { meal: MEAL, reasons: ["quick"], cache_bust: null });
    const m = meta(store);
    expect(m.response_id.length).toBeLessThanOrEqual(80);
    expect(m.reported_model).not.toMatch(/[<>"]/);
  });
});
