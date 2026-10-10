/**
 * D-05 provider completion: OpenAI adapter (mocked fetch only — CI makes NO live calls),
 * routing/denylist, pricing, the single limiter, ceilings, no escalation, kill switch, secrecy.
 */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider, createGenerationService, createMemoryStore, createD1Store, resolveProvider, aiHealth, TASKS, handleAiSmoke } from "../src/ai/index.js";
import { createOpenAIProvider, buildResponsesRequest, toStrictSchema, parseUsage, OPENAI_RESPONSES_URL } from "../src/ai/providers/openai.js";
import { MODEL_ALIASES, MODEL_DENYLIST, validateRoutingTable, resolveAlias, modelForTask, routeModels, isDeniedModel } from "../src/ai/routing.js";
import { PRICING_VERSION, costUsd, worstCaseCostUsd, effectiveMaxOutputTokens, MODEL_OUTPUT_CEILINGS } from "../src/ai/pricing.js";
import { readAiConfig, assertAiConfig } from "../src/ai/config.js";
import { validateAiVars } from "../scripts/deploy/environments.mjs";

const KEY = "sk-test-NEVER-LEAK-0123456789abcdef";
const fixedNow = () => new Date("2026-10-10T15:00:30.000Z");
const ON = { AI_GATEWAY_ENABLED: "1", AI_TASKS_ENABLED: "explanation,recipe_draft,concept_generation,discovery_intent", AI_DAILY_BUDGET_USD: "5", AI_PROVIDER: "openai" };
const EXPL = (i = 0) => ({ meal: `meal ${i}`, reasons: ["quick"] });

function okBody(obj, usage = { input_tokens: 120, output_tokens: 30, input_tokens_details: { cached_tokens: 20 } }) {
  return { id: "resp_1", status: "completed", model: "gpt-6-luna", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(obj) }] }], usage };
}
function mockFetch(responder) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = await responder(calls.length - 1, init);
    return { status: r.status ?? 200, ok: (r.status ?? 200) < 400, headers: new Map([["x-request-id", "req_x"]]), json: async () => r.body };
  });
  fn.calls = calls;
  return fn;
}
function openai(responder, env = {}) {
  const fetchImpl = mockFetch(responder);
  const provider = createOpenAIProvider({ env: { OPENAI_API_KEY: KEY, ...env }, fetchImpl });
  return { provider, fetchImpl };
}
const req = (over = {}) => ({ model: "gpt-6-luna", schema_name: "explanation", system: "S", user: "U", max_output_tokens: 120, response_schema: TASKS.explanation.output_schema, ...over });

afterEach(() => vi.restoreAllMocks());

describe("OpenAI adapter: request shape + Structured Outputs", () => {
  it("POSTs the Responses API with Bearer auth, no org/project header, strict json_schema", async () => {
    const { provider, fetchImpl } = openai(() => ({ body: okBody({ text: "Quick." }) }));
    const r = await provider.generate(req());
    const c = fetchImpl.calls[0];
    expect(c.url).toBe("https://api.openai.com/v1/responses");
    expect(OPENAI_RESPONSES_URL).toBe(c.url);
    expect(c.init.method).toBe("POST");
    expect(c.init.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(Object.keys(c.init.headers).map((h) => h.toLowerCase())).not.toEqual(expect.arrayContaining(["openai-organization"]));
    expect(Object.keys(c.init.headers).join(",")).not.toMatch(/organization|project/i);
    expect(c.body).toMatchObject({ model: "gpt-6-luna", max_output_tokens: 120, store: false });
    expect(c.body.input).toEqual([{ role: "system", content: "S" }, { role: "user", content: "U" }]);
    expect(c.body.text.format).toMatchObject({ type: "json_schema", name: "explanation", strict: true });
    expect(c.body.text.format.schema).toEqual({ type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false });
    expect(JSON.parse(r.text)).toEqual({ text: "Quick." });
    expect(r.metadata.request_id).toBe("resp_1");
  });
  it("strict schema: all props required, optionals nullable, nested objects closed; nulls dropped on the way back", async () => {
    const s = toStrictSchema(TASKS.planning_intent.output_schema);
    expect(s.required.sort()).toEqual(["keep_ingredients_simple", "keep_it_easy", "nights", "notes"]);
    expect(s.properties.notes.type).toEqual(["string", "null"]);
    expect(s.additionalProperties).toBe(false);
    const c = toStrictSchema(TASKS.concept_generation.output_schema);
    expect(c.properties.concepts.items).toMatchObject({ additionalProperties: false, required: ["title", "pitch"] });
    const { provider } = openai(() => ({ body: okBody({ nights: 3, keep_it_easy: true, keep_ingredients_simple: null, notes: null }) }));
    const r = await provider.generate(req({ response_schema: TASKS.planning_intent.output_schema }));
    expect(JSON.parse(r.text)).toEqual({ nights: 3, keep_it_easy: true });
  });
  it("max_output_tokens never exceeds the model ceiling", () => {
    expect(buildResponsesRequest(req({ max_output_tokens: 5000 })).max_output_tokens).toBe(600);
    expect(buildResponsesRequest(req({ model: "gpt-6.1-sol", max_output_tokens: 5000 })).max_output_tokens).toBe(1500);
  });
  it("parses usage: input, cached (input_tokens_details.cached_tokens), output", async () => {
    expect(parseUsage({ input_tokens: 100, output_tokens: 7, input_tokens_details: { cached_tokens: 40 } })).toEqual({ input_tokens: 100, cached_input_tokens: 40, output_tokens: 7, cache_write_tokens: 0 });
    expect(parseUsage(undefined)).toEqual({ input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, cache_write_tokens: 0 });
    const { provider } = openai(() => ({ body: okBody({ text: "x" }) }));
    expect((await provider.generate(req())).usage).toMatchObject({ input_tokens: 120, cached_input_tokens: 20, output_tokens: 30 });
  });
});

describe("OpenAI adapter: error mapping", () => {
  const code = async (responder, opts) => {
    const { provider } = openai(responder);
    try { await provider.generate(req(), opts); return "no-error"; } catch (e) { return e.code; }
  };
  it("429 => rate_limited, 5xx => provider_outage, 4xx => provider_outage", async () => {
    expect(await code(() => ({ status: 429, body: { error: { message: "slow down" } } }))).toBe("rate_limited");
    expect(await code(() => ({ status: 503, body: {} }))).toBe("provider_outage");
    expect(await code(() => ({ status: 500, body: null }))).toBe("provider_outage");
    expect(await code(() => ({ status: 401, body: { error: { message: "bad key" } } }))).toBe("provider_outage");
  });
  it("refusal and incomplete status => malformed_output (with usage attached)", async () => {
    const refusal = { id: "r", status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }], usage: { input_tokens: 50, output_tokens: 5 } };
    const { provider } = openai(() => ({ body: refusal }));
    const e = await provider.generate(req()).catch((x) => x);
    expect(e.code).toBe("malformed_output");
    expect(e.detail).toBe("refusal");
    expect(e.usage.input_tokens).toBe(50);
    expect(await code(() => ({ body: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, usage: {} } }))).toBe("malformed_output");
    expect(await code(() => ({ body: { status: "failed" } }))).toBe("provider_outage");
  });
  it("timeout via AbortController => timeout; network error => provider_outage", async () => {
    const hang = (i, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("a"), { name: "AbortError" }))));
    expect(await code(hang, { timeoutMs: 10 })).toBe("timeout");
    const ext = new AbortController();
    const p = code(hang, { signal: ext.signal, timeoutMs: 10000 });
    ext.abort();
    expect(await p).toBe("timeout");
    expect(await code(() => { throw new TypeError("fetch failed"); })).toBe("provider_outage");
  });
  it("refuses a denylisted model before any network call", async () => {
    const { provider, fetchImpl } = openai(() => ({ body: okBody({}) }));
    await expect(provider.generate(req({ model: "gpt-6-astra" }))).rejects.toMatchObject({ code: "disabled" });
    expect(() => buildResponsesRequest(req({ model: "gpt-6-astra" }))).toThrow(/denylisted/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("provider selection (index.js)", () => {
  it("openai only when AI_PROVIDER=openai AND key present; otherwise unconfigured", () => {
    expect(resolveProvider({ AI_PROVIDER: "openai", OPENAI_API_KEY: KEY }).id).toBe("openai");
    expect(resolveProvider({ AI_PROVIDER: "openai", OPENAI_API_KEY: KEY }).configured()).toBe(true);
    for (const env of [{ AI_PROVIDER: "openai" }, { AI_PROVIDER: "openai", OPENAI_API_KEY: "  " }, { OPENAI_API_KEY: KEY }, { AI_PROVIDER: "none", OPENAI_API_KEY: KEY }]) {
      expect(resolveProvider(env).configured(env)).toBe(false);
    }
  });
  it("adapter resolves aliases to the routed models", () => {
    const p = createOpenAIProvider({ env: {} });
    expect([p.resolveModel("fast-small"), p.resolveModel("balanced"), p.resolveModel("strong")]).toEqual(["gpt-6-luna", "gpt-6-luna", "gpt-6.1-sol"]);
    expect(p.configured()).toBe(false);
  });
});

describe("routing + Astra ban", () => {
  it("fast-small and balanced -> gpt-6-luna; strong -> gpt-6.1-sol", () => {
    expect(MODEL_ALIASES).toEqual({ "fast-small": "gpt-6-luna", balanced: "gpt-6-luna", strong: "gpt-6.1-sol" });
    expect(modelForTask(TASKS.discovery_intent)).toBe("gpt-6-luna");
    expect(modelForTask(TASKS.concept_generation)).toBe("gpt-6-luna");
    expect(modelForTask(TASKS.recipe_draft)).toBe("gpt-6.1-sol");
  });
  it("gpt-6-astra is denylisted at config load", () => {
    expect(MODEL_DENYLIST).toContain("gpt-6-astra");
    expect(() => validateRoutingTable({ ...MODEL_ALIASES, strong: "gpt-6-astra" })).toThrow(/denylisted/);
    expect(isDeniedModel("GPT-6-Astra-2026")).toBe(true);
    const cfg = readAiConfig({ ...ON, AI_MODEL_OVERRIDE: "gpt-6-astra" });
    expect(cfg.enabled).toBe(false);
    expect(cfg.config_errors[0]).toMatch(/denylisted/);
    expect(() => assertAiConfig({ AI_X: "gpt-6-astra" })).toThrow(/rejected/);
    expect(() => validateAiVars('AI_MODEL = "gpt-6-astra"')).toThrow(/astra/);
  });
  it("gpt-6-astra is refused at call time even if a provider maps to it", async () => {
    const provider = { ...createFakeProvider({ script: [{ json: { text: "x" } }] }), resolveModel: () => "gpt-6-astra" };
    const service = createGenerationService({ provider, store: createMemoryStore(), env: ON, now: fixedNow });
    const r = await service.run("explanation", EXPL());
    expect(r.error).toBe("disabled");
    expect(provider.calls).toHaveLength(0);
  });
});

describe("pricing", () => {
  it("is versioned and costs uncached + cached + output (+ cache writes)", () => {
    expect(PRICING_VERSION).toBe("openai-standard-2026-10-10");
    // Luna: 800 uncached * 0.10 + 200 cached * 0.01 + 100 out * 0.50 = 80 + 2 + 50 = 132 / 1e6
    expect(costUsd("gpt-6-luna", { input_tokens: 1000, cached_input_tokens: 200, output_tokens: 100 })).toBeCloseTo(0.000132, 9);
    // Sol: 1000 * 2 + 0 + 500 * 10 = 7000 / 1e6; + 100 cache-write * 2.5 = 250
    expect(costUsd("gpt-6.1-sol", { input_tokens: 1000, output_tokens: 500 })).toBeCloseTo(0.007, 9);
    expect(costUsd("gpt-6.1-sol", { input_tokens: 1000, output_tokens: 500, cache_write_tokens: 100 })).toBeCloseTo(0.00725, 9);
    expect(costUsd("gpt-6-astra", { input_tokens: 1 })).toBe(Infinity);
    expect(worstCaseCostUsd("gpt-6-luna", 1000, 600)).toBeCloseTo((1000 * 0.125 + 600 * 0.5) / 1e6, 9);
  });
  it("usage rows carry provider-reported tokens, real cost and pricing_version", async () => {
    const { provider } = openai(() => ({ body: okBody({ text: "Fast and simple." }, { input_tokens: 300, output_tokens: 40, input_tokens_details: { cached_tokens: 100 } }) }));
    const store = createMemoryStore();
    const service = createGenerationService({ provider, store, env: ON, now: fixedNow });
    expect((await service.run("explanation", EXPL(), { householdId: "hh_1" })).ok).toBe(true);
    const row = store.usage.at(-1);
    expect(row).toMatchObject({ provider: "openai", model: "gpt-6-luna", input_tokens: 300, cached_input_tokens: 100, output_tokens: 40, pricing_version: PRICING_VERSION });
    expect(row.estimated_cost_usd).toBeCloseTo((200 * 0.1 + 100 * 0.01 + 40 * 0.5) / 1e6, 9);
    // spend counter settled to actual (micro-USD, ceil)
    expect(await store.counterValue("spend_day:2026-10-10")).toBe(Math.ceil(row.estimated_cost_usd * 1e6));
  });
});

describe("ceilings, retries, no escalation", () => {
  it("max_output_tokens = min(task cap, model ceiling); lower task caps unchanged", () => {
    expect(MODEL_OUTPUT_CEILINGS).toEqual({ "gpt-6-luna": 600, "gpt-6.1-sol": 1500 });
    expect(effectiveMaxOutputTokens(TASKS.explanation.limits.max_output_tokens, "gpt-6-luna")).toBe(120);
    expect(effectiveMaxOutputTokens(TASKS.discovery_intent.limits.max_output_tokens, "gpt-6-luna")).toBe(250);
    expect(effectiveMaxOutputTokens(TASKS.planning_intent.limits.max_output_tokens, "gpt-6-luna")).toBe(400);
    expect(effectiveMaxOutputTokens(TASKS.concept_generation.limits.max_output_tokens, "gpt-6-luna")).toBe(600);
    expect(effectiveMaxOutputTokens(TASKS.recipe_draft.limits.max_output_tokens, "gpt-6.1-sol")).toBe(1500);
    expect(effectiveMaxOutputTokens(5000, "gpt-6.1-sol")).toBe(1500);
  });
  it("gateway sends the min() cap to the provider", async () => {
    const provider = createFakeProvider({ script: () => ({ json: { concepts: [{ title: "x" }] } }) });
    const service = createGenerationService({ provider, store: createMemoryStore(), env: ON, now: fixedNow });
    await service.run("concept_generation", { text: "autumn" });
    expect(provider.calls[0].max_output_tokens).toBe(600);
  });
  it("at most one repair retry, always on models[0], never escalates", async () => {
    const provider = createFakeProvider({ script: [{ text: "bad" }] });
    const service = createGenerationService({ provider, store: createMemoryStore(), env: ON, now: fixedNow });
    const r = await service.run("concept_generation", { text: "autumn" });
    expect(r.error).toBe("malformed_output");
    expect(provider.calls).toHaveLength(2);
    expect(new Set(provider.calls.map((c) => c.model))).toEqual(new Set(["fake-balanced"]));
    expect(routeModels(TASKS.concept_generation)).toEqual(["balanced", "strong"]);
    for (const t of Object.values(TASKS)) expect(t.limits.max_retries).toBeLessThanOrEqual(1);
  });
  it("429 is not retried and does not escalate", async () => {
    const { provider, fetchImpl } = openai(() => ({ status: 429, body: {} }));
    const service = createGenerationService({ provider, store: createMemoryStore(), env: ON, now: fixedNow });
    expect((await service.run("explanation", EXPL())).error).toBe("rate_limited");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("refusal usage is still accounted", async () => {
    const refusal = { id: "r", status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }], usage: { input_tokens: 50, output_tokens: 5 } };
    const { provider, fetchImpl } = openai(() => ({ body: refusal }));
    const store = createMemoryStore();
    const service = createGenerationService({ provider, store, env: ON, now: fixedNow });
    expect((await service.run("explanation", EXPL())).error).toBe("malformed_output");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.usage.at(-1)).toMatchObject({ status: "fallback:malformed_output", input_tokens: 50, output_tokens: 5 });
    expect(store.usage.at(-1).estimated_cost_usd).toBeGreaterThan(0);
  });
});

describe("single limiter (UTC windows, D1/counter backed)", () => {
  const text = () => ({ json: { text: "Fits." } });
  const make = (env = {}, store = createMemoryStore(), now = fixedNow) => {
    const provider = createFakeProvider({ script: text });
    return { service: createGenerationService({ provider, store, env: { ...ON, ...env }, now }), provider, store };
  };
  it("household per minute (default 5)", async () => {
    const { service } = make();
    for (let i = 0; i < 5; i++) expect((await service.run("explanation", EXPL(i), { householdId: "hh_a" })).ok).toBe(true);
    expect((await service.run("explanation", EXPL(9), { householdId: "hh_a" })).error).toBe("rate_limited");
    expect((await service.run("explanation", EXPL(9), { householdId: "hh_b" })).ok).toBe(true);
    // next UTC minute frees the minute bucket
    let t = fixedNow();
    const store = createMemoryStore();
    const m = make({}, store, () => t);
    for (let i = 0; i < 5; i++) await m.service.run("explanation", EXPL(i), { householdId: "hh_a" });
    t = new Date("2026-10-10T15:01:00.000Z");
    expect((await m.service.run("explanation", EXPL(7), { householdId: "hh_a" })).ok).toBe(true);
  });
  it("household per day counts ACROSS tasks", async () => {
    let t = new Date("2026-10-10T01:00:00.000Z");
    const { service } = make({ AI_HOUSEHOLD_PER_DAY: "3", AI_HOUSEHOLD_PER_MINUTE: "100" }, createMemoryStore(), () => t);
    expect((await service.run("explanation", EXPL(1), { householdId: "hh_a" })).ok).toBe(true);
    expect((await service.run("concept_generation", { text: "x" }, { householdId: "hh_a" })).ok).toBe(false); // fake returns wrong shape but still consumes
    expect((await service.run("explanation", EXPL(2), { householdId: "hh_a" })).ok).toBe(true);
    expect((await service.run("explanation", EXPL(3), { householdId: "hh_a" })).error).toBe("rate_limited");
    t = new Date("2026-10-11T00:00:01.000Z"); // new UTC day
    expect((await service.run("explanation", EXPL(4), { householdId: "hh_a" })).ok).toBe(true);
  });
  it("global per day", async () => {
    const { service } = make({ AI_GLOBAL_PER_DAY: "2" });
    expect((await service.run("explanation", EXPL(1), { householdId: "h1" })).ok).toBe(true);
    expect((await service.run("explanation", EXPL(2), { householdId: "h2" })).ok).toBe(true);
    expect((await service.run("explanation", EXPL(3), { householdId: "h3" })).error).toBe("rate_limited");
  });
  it("Sol per household per day (default 5) only counts gpt-6.1-sol", async () => {
    const provider = createFakeProvider({ script: () => ({ json: { title: "Draft", status: "draft_unreviewed" } }) });
    const service = createGenerationService({ provider, store: createMemoryStore(), env: { ...ON, AI_HOUSEHOLD_PER_MINUTE: "100" }, now: fixedNow });
    for (let i = 0; i < 5; i++) expect((await service.run("recipe_draft", { text: `c${i}` }, { householdId: "hh_s" })).ok).toBe(true);
    const r = await service.run("recipe_draft", { text: "c6" }, { householdId: "hh_s" });
    expect(r.error).toBe("rate_limited");
    expect(provider.calls).toHaveLength(5);
  });
  it("daily budget uses real model prices for the worst case (Sol blocked where Luna fits)", async () => {
    // Sol worst case: ~(prompt tokens * 2.5 + 1500 * 10) * 2 attempts / 1e6 ≈ $0.031+; Luna ≈ $0.0003
    const { service, provider } = make({ AI_DAILY_BUDGET_USD: "0.02" });
    expect((await service.run("recipe_draft", { text: "c" }, { householdId: "h" })).error).toBe("budget_exceeded");
    expect((await service.run("explanation", EXPL(), { householdId: "h" })).ok).toBe(true);
    expect(provider.calls).toHaveLength(1);
  });
  it("budget: default 0 blocks all spend; failed reservations are released", async () => {
    const { service, store, provider } = make({ AI_DAILY_BUDGET_USD: undefined });
    expect((await service.run("explanation", EXPL(), { householdId: "h" })).error).toBe("budget_exceeded");
    expect(provider.calls).toHaveLength(0);
    expect(await store.counterValue("hh_min:" + "x")).toBe(0);
    for (const [, c] of store.counters) expect(c.count).toBe(0);
  });
  it("concurrent requests cannot both take the last slot (D1 conditional increment)", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readFileSync("migrations/0014_ai_gateway.sql", "utf8"));
    db.exec(readFileSync("migrations/0015_ai_provider_limits.sql", "utf8"));
    const shim = { prepare(sql) { let a = []; const api = { bind(...x) { a = x; return api; }, async run() { db.prepare(sql).run(...a); return {}; }, async first() { return db.prepare(sql).get(...a) ?? null; } }; return api; } };
    const store = createD1Store(shim);
    const provider = createFakeProvider({ script: text });
    const service = createGenerationService({ provider, store, env: { ...ON, AI_GLOBAL_PER_DAY: "3" }, now: fixedNow });
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => service.run("explanation", EXPL(i), { householdId: `h${i}` })));
    expect(rs.filter((r) => r.ok)).toHaveLength(3);
    expect(rs.filter((r) => r.error === "rate_limited")).toHaveLength(5);
    expect(await store.counterValue("global_day:2026-10-10")).toBe(3);
    expect(db.prepare("SELECT count FROM ai_limit_counters WHERE bucket LIKE 'hh_min:%' AND count > 0").all()).toHaveLength(3);
  });
  it("hour-only system is gone", () => {
    const cfg = readAiConfig({ AI_GLOBAL_PER_HOUR: "1" });
    expect(cfg).not.toHaveProperty("global_per_hour");
    expect(cfg.limits).toEqual({ household_per_minute: 5, household_per_day: 30, global_per_day: 50, sol_household_per_day: 5 });
    expect(cfg.max_repair_retries).toBe(1);
    expect(() => validateAiVars(readFileSync("deploy/pages/preview/wrangler.toml", "utf8") + '\nAI_GLOBAL_PER_HOUR = "200"')).toThrow(/retired/);
  });
});

describe("kill switch, config, secrecy", () => {
  it("kill switch: AI_GATEWAY_ENABLED=0 => no fetch even with a key", async () => {
    const { provider, fetchImpl } = openai(() => ({ body: okBody({ text: "x" }) }));
    const service = createGenerationService({ provider, store: createMemoryStore(), env: { ...ON, AI_GATEWAY_ENABLED: "0" }, now: fixedNow });
    expect((await service.run("explanation", EXPL())).error).toBe("disabled");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("committed configs: gateway OFF, tasks empty, limits present, no astra/secret", () => {
    for (const [env, budget, global] of [["preview", "0.25", "50"], ["production", "1.00", "100"]]) {
      const vars = validateAiVars(readFileSync(`deploy/pages/${env}/wrangler.toml`, "utf8"));
      expect(vars).toMatchObject({ AI_PROVIDER: "openai", AI_GATEWAY_ENABLED: "0", AI_TASKS_ENABLED: "", AI_DAILY_BUDGET_USD: budget, AI_GLOBAL_PER_DAY: global, AI_HOUSEHOLD_PER_MINUTE: "5", AI_HOUSEHOLD_PER_DAY: "30", AI_SOL_HOUSEHOLD_PER_DAY: "5" });
    }
    expect(() => validateAiVars('AI_PROVIDER = "openai"')).toThrow(/missing AI_DAILY_BUDGET_USD/);
    expect(() => validateAiVars(readFileSync("deploy/pages/preview/wrangler.toml", "utf8") + `\nOPENAI_API_KEY = "${KEY}"`)).toThrow(/secret/);
  });
  it("health: provider, key presence boolean, models, limits, pricing version; never the key; no fetch", () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("no network in health"); });
    const env = { ...ON, OPENAI_API_KEY: KEY };
    const h = aiHealth(env, resolveProvider(env));
    expect(h).toMatchObject({ provider: "openai", provider_id: "openai", provider_configured: true, openai_key_present: true, pricing_version: PRICING_VERSION });
    expect(h.models.aliases.strong).toBe("gpt-6.1-sol");
    expect(h.limits).toMatchObject({ household_per_minute: 5, household_per_day: 30, global_per_day: 50, sol_household_per_day: 5, max_repair_retries: 1 });
    expect(h.tasks.find((t) => t.id === "explanation")).toMatchObject({ model: "gpt-6-luna", max_output_tokens: 120 });
    expect(JSON.stringify(h)).not.toContain(KEY);
    expect(spy).not.toHaveBeenCalled();
  });
  it("the key never appears in logs, usage rows, results or error details", async () => {
    const logs = [];
    const consoleSpies = ["log", "warn", "error", "info", "debug"].map((m) => vi.spyOn(console, m).mockImplementation((...a) => logs.push(a)));
    const responders = [() => ({ status: 401, body: { error: { message: `bad key ${KEY}` } } }), () => ({ status: 429, body: {} }), () => ({ body: okBody({ text: "ok" }) })];
    for (const responder of responders) {
      const { provider } = openai(responder);
      const store = createMemoryStore();
      const service = createGenerationService({ provider, store, env: ON, now: fixedNow, log: (...a) => logs.push(a) });
      const r = await service.run("explanation", EXPL(), { householdId: "h" });
      expect(JSON.stringify(r)).not.toContain(KEY);
      expect(JSON.stringify(store.usage)).not.toContain(KEY);
      const e = await provider.generate(req()).catch((x) => x);
      expect(JSON.stringify({ m: e?.message, d: e?.detail, c: e?.code })).not.toContain(KEY);
    }
    expect(JSON.stringify(logs)).not.toContain(KEY);
    expect(consoleSpies.length).toBe(5);
  });
  it("only providers/openai.js reads OPENAI_API_KEY in src/ai (others only test presence)", () => {
    const src = readFileSync("src/ai/providers/openai.js", "utf8");
    expect(src).toMatch(/Bearer \$\{env\.OPENAI_API_KEY/);
    expect(src).not.toMatch(/console\./);
    for (const f of ["gateway.js", "config.js", "routing.js", "pricing.js", "limits.js", "store.js", "smoke.js"]) {
      expect(readFileSync(`src/ai/${f}`, "utf8"), f).not.toMatch(/OPENAI_API_KEY/);
    }
  });
});

describe("internal smoke endpoint (token-gated, disabled by default)", () => {
  const request = (headers = {}) => new Request("https://x.test/api/ai/internal/smoke", { method: "POST", headers });
  it("404 without AI_SMOKE_TOKEN, 403 on wrong token, no provider call", async () => {
    const provider = createFakeProvider({ script: [{ json: { text: "x" } }] });
    expect((await handleAiSmoke(request(), {}, provider)).status).toBe(404);
    expect((await handleAiSmoke(request({ "x-ai-smoke-token": "nope" }), { AI_SMOKE_TOKEN: "right-token" }, provider)).status).toBe(403);
    expect(provider.calls).toHaveLength(0);
  });
  it("with the token it runs exactly one Luna explanation through the gateway (still gated by the kill switch)", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readFileSync("migrations/0014_ai_gateway.sql", "utf8"));
    db.exec(readFileSync("migrations/0015_ai_provider_limits.sql", "utf8"));
    const DB = { prepare(sql) { let a = []; const api = { bind(...x) { a = x; return api; }, async run() { db.prepare(sql).run(...a); return {}; }, async first() { return db.prepare(sql).get(...a) ?? null; } }; return api; } };
    const provider = createFakeProvider({ script: [{ json: { text: "Quick and simple." } }] });
    const off = await handleAiSmoke(request({ "x-ai-smoke-token": "tok" }), { AI_SMOKE_TOKEN: "tok", DB }, provider);
    expect(off.body).toMatchObject({ ok: false, error: "disabled" });
    const on = await handleAiSmoke(request({ "x-ai-smoke-token": "tok" }), { ...ON, AI_TASKS_ENABLED: "explanation", AI_SMOKE_TOKEN: "tok", DB }, provider);
    expect(on.body).toMatchObject({ ok: true, source: "provider", model: "gpt-6-luna" });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].max_output_tokens).toBe(120);
  });
  it("live smoke script is never wired into CI or npm test", () => {
    const pkg = readFileSync("package.json", "utf8");
    const ci = readFileSync(".github/workflows/ci.yml", "utf8") + readFileSync(".github/workflows/hosted-e2e.yml", "utf8");
    expect(ci).not.toMatch(/ai-live-smoke/);
    expect(pkg).not.toMatch(/ai-live-smoke/);
    const script = readFileSync("scripts/ai-live-smoke.mjs", "utf8");
    expect(script).toMatch(/--i-understand-this-costs-money/);
    expect(script).toMatch(/--confirm-production/);
  });
});
