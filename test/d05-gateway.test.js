import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  aiHealth, createD1Store, createFakeProvider, createGenerationService, createMemoryStore,
  intentToDiscoveryQuery, TASKS, TASK_IDS, buildHouseholdContext, redactText, assertAdapter, unconfiguredProvider, resolveProvider,
} from "../src/ai/index.js";
import { PROMPTS, renderPrompt } from "../src/ai/prompts.js";
import { routeModels, estimateCostUsd, COST_CLASSES } from "../src/ai/routing.js";
import { validateSchema, parseJsonOutput } from "../src/ai/schema.js";
import { normalizeError, AI_ERROR_CODES } from "../src/ai/errors.js";

const ON = { AI_GATEWAY_ENABLED: "1", AI_TASKS_ENABLED: "discovery_intent,explanation", AI_DAILY_BUDGET_USD: "5" };
const VOCAB = { cuisines: ["korean", "thai", "italian"], methods: ["grill", "pressure-cook"], equipment: ["grill"] };
const fixedNow = () => new Date("2026-10-10T15:00:00.000Z");

function svc({ script, env = ON, store = createMemoryStore(), now = fixedNow } = {}) {
  const provider = createFakeProvider({ script });
  return { service: createGenerationService({ provider, store, env, now }), provider, store };
}
const good = { json: { facets: { cuisines: ["Korean", "klingon"], methods: ["grill"] }, quick: true } };

describe("D-05 task registry", () => {
  it("registers all eight tasks with schema, prompt version, models, cost class, cache, limits, post-validation", () => {
    expect([...TASK_IDS].sort()).toEqual(["concept_generation", "discovery_intent", "explanation", "feedback_extraction", "planning_intent", "recipe_adaptation", "recipe_draft", "semantic_search_assist"]);
    for (const t of Object.values(TASKS)) {
      expect(t.input_schema.type).toBe("object");
      expect(t.output_schema.type).toBe("object");
      expect(t.prompt_version).toBe(PROMPTS[t.id].version);
      expect(t.prompt_version).toMatch(/^[a-z_]+@\d+$/);
      expect(routeModels(t).length).toBeGreaterThan(0);
      expect(COST_CLASSES[t.cost_class]).toBeTruthy();
      expect(typeof t.post_validate).toBe("function");
      for (const k of ["max_retries", "max_output_tokens", "timeout_ms", "per_household_per_hour"]) expect(t.limits[k]).toBeGreaterThan(-1);
      expect(t.limits.max_retries).toBeLessThanOrEqual(2);
    }
  });
  it("routes cheap models to extraction/classification and strong models only to creative tasks", () => {
    for (const id of ["planning_intent", "discovery_intent", "feedback_extraction", "semantic_search_assist"]) {
      expect(TASKS[id].cost_class).toBe("cheap");
      expect(routeModels(TASKS[id])).not.toContain("strong");
    }
    for (const t of Object.values(TASKS)) if (routeModels(t).includes("strong")) expect(t.cost_class).toBe("creative");
    expect(estimateCostUsd("cheap", 1e6, 0)).toBeLessThan(estimateCostUsd("creative", 1e6, 0));
  });
  it("creative drafts are never cached and draft outputs are marked unreviewed", () => {
    for (const id of ["concept_generation", "recipe_draft", "recipe_adaptation"]) expect(TASKS[id].cache.enabled).toBe(false);
    expect(TASKS.recipe_draft.output_schema.properties.status.enum).toEqual(["draft_unreviewed"]);
  });
  it("prompts never request chain-of-thought and declare deterministic authority", () => {
    for (const p of Object.values(PROMPTS)) {
      expect(p.system).toMatch(/never decide allergens/);
      expect(`${p.system} ${p.user}`).not.toMatch(/step by step|think|reasoning:/i);
    }
    expect(renderPrompt("explanation", { meal: "Stew", reasons: ["quick"] }).user).toContain('["quick"]');
  });
});

describe("D-05 gateway behaviour", () => {
  it("is OFF by default (kill switch) and returns the deterministic fallback without calling the provider", async () => {
    const { service, provider, store } = svc({ script: [good], env: {} });
    const r = await service.run("discovery_intent", { text: "korean", vocabulary: VOCAB }, { fallback: "FB" });
    expect(r).toEqual({ ok: false, error: "disabled", fallback: "FB" });
    expect(provider.calls).toHaveLength(0);
    expect(store.usage[0].status).toBe("fallback:disabled");
  });
  it("per-task flags gate tasks individually", async () => {
    const { service, provider } = svc({ script: [good] });
    expect((await service.run("feedback_extraction", { text: "too salty" })).error).toBe("disabled");
    expect(provider.calls).toHaveLength(0);
  });
  it("unknown task and invalid input are normalized", async () => {
    const { service } = svc({ script: [good] });
    expect((await service.run("nope", {})).error).toBe("unknown_task");
    expect((await service.run("discovery_intent", { text: "x".repeat(500) })).error).toBe("invalid_input");
  });
  it("unconfigured provider => provider_unconfigured fallback, no call", async () => {
    const service = createGenerationService({ provider: unconfiguredProvider(), store: createMemoryStore(), env: ON });
    expect((await service.run("discovery_intent", { text: "thai" })).error).toBe("provider_unconfigured");
  });
  it("validates output, post-filters to deterministic vocabulary, records usage, caches", async () => {
    const { service, provider, store } = svc({ script: [good] });
    const r = await service.run("discovery_intent", { text: "Korean grill", vocabulary: VOCAB }, { householdId: "hh_abc12345" });
    expect(r.ok).toBe(true);
    expect(r.output.facets).toEqual({ cuisines: ["korean"], methods: ["grill"] });
    const row = store.usage.at(-1);
    expect(row).toMatchObject({ task: "discovery_intent", provider: "fake", model: "fast-small", status: "ok", prompt_version: "discovery_intent@1", attempts: 1 });
    expect(row.input_tokens).toBeGreaterThan(0);
    expect(row.output_tokens).toBeGreaterThan(0);
    expect(row.estimated_cost_usd).toBeGreaterThan(0);
    expect(row.household_key).toMatch(/^[0-9a-f]{24}$/);
    expect(JSON.stringify(row)).not.toMatch(/hh_abc12345|korean grill/i);
    const again = await service.run("discovery_intent", { text: "  korean   GRILL ", vocabulary: VOCAB });
    expect(again.source).toBe("cache");
    expect(provider.calls).toHaveLength(1);
  });
  it("cache key includes prompt version and model", async () => {
    const store = createMemoryStore();
    const { service } = svc({ script: [good], store });
    await service.run("discovery_intent", { text: "thai", vocabulary: VOCAB });
    const [key] = [...store.cache.keys()];
    expect(store.cache.get(key)).toMatchObject({ prompt_version: "discovery_intent@1", model: "fast-small" });
  });
  it("bounded repair: one malformed output then valid => ok with attempts 2", async () => {
    const { service, provider, store } = svc({ script: [{ text: "not json" }, good] });
    const r = await service.run("discovery_intent", { text: "thai", vocabulary: VOCAB });
    expect(r.ok).toBe(true);
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1].user).toMatch(/previous output was invalid/);
    expect(store.usage.at(-1).attempts).toBe(2);
  });
  it("persistent malformed output stops at max_retries and falls back", async () => {
    const { service, provider, store } = svc({ script: [{ text: "{\"facets\":1}" }] });
    const r = await service.run("discovery_intent", { text: "thai", vocabulary: VOCAB }, { fallback: [] });
    expect(r).toEqual({ ok: false, error: "malformed_output", fallback: [] });
    expect(provider.calls).toHaveLength(TASKS.discovery_intent.limits.max_retries + 1);
    expect(store.usage.at(-1).status).toBe("fallback:malformed_output");
  });
  it("explanation post-validation rejects allergen / eligibility claims", async () => {
    const { service } = svc({ script: [{ json: { text: "This is nut-free and safe for your family." } }] });
    const r = await service.run("explanation", { meal: "Sabich", reasons: ["quick"] }, { fallback: "Quick weeknight pick." });
    expect(r).toEqual({ ok: false, error: "malformed_output", fallback: "Quick weeknight pick." });
  });
  it("timeout is enforced, retried once (bounded), normalized and falls back", async () => {
    const provider = createFakeProvider({ script: [{ hang: true }] });
    const store = createMemoryStore();
    const service = createGenerationService({ provider, store, env: ON, maxTimeoutMs: 20 });
    const r = await service.run("discovery_intent", { text: "thai" }, { fallback: "FB" });
    expect(r).toEqual({ ok: false, error: "timeout", fallback: "FB" });
    expect(provider.calls).toHaveLength(TASKS.discovery_intent.limits.max_retries + 1);
    expect(store.usage.at(-1).status).toBe("fallback:timeout");
  });
  it("rate limit (429) and outage (5xx) are normalized", async () => {
    const a = svc({ script: [{ throw: { status: 429 } }] });
    expect((await a.service.run("discovery_intent", { text: "thai" })).error).toBe("rate_limited");
    expect(a.provider.calls).toHaveLength(1);
    const b = svc({ script: [{ throw: { status: 503 } }] });
    expect((await b.service.run("discovery_intent", { text: "thai" })).error).toBe("provider_outage");
    expect(b.provider.calls).toHaveLength(2);
    expect(AI_ERROR_CODES).toEqual(expect.arrayContaining(["timeout", "rate_limited", "malformed_output", "provider_outage", "disabled", "budget_exceeded"]));
  });
  it("per-household rate limit", async () => {
    const store = createMemoryStore();
    const { service } = svc({ script: () => ({ json: { text: "Fits a quick night." } }), store });
    const limit = TASKS.explanation.limits.per_household_per_hour;
    for (let i = 0; i < limit; i++) expect((await service.run("explanation", { meal: `m${i}`, reasons: ["quick"] }, { householdId: "hh_one11111" })).ok).toBe(true);
    expect((await service.run("explanation", { meal: "next", reasons: ["quick"] }, { householdId: "hh_one11111" })).error).toBe("rate_limited");
    expect((await service.run("explanation", { meal: "next", reasons: ["quick"] }, { householdId: "hh_two22222" })).ok).toBe(true);
  });
  it("global hourly ceiling", async () => {
    const { service } = svc({ script: () => ({ json: { text: "ok" } }), env: { ...ON, AI_GLOBAL_PER_HOUR: "2" } });
    await service.run("explanation", { meal: "a", reasons: [] });
    await service.run("explanation", { meal: "b", reasons: [] });
    expect((await service.run("explanation", { meal: "c", reasons: [] })).error).toBe("rate_limited");
  });
  it("budget: zero budget (default) blocks spend", async () => {
    const { service, provider } = svc({ script: [good], env: { AI_GATEWAY_ENABLED: "1", AI_TASKS_ENABLED: "discovery_intent" } });
    expect((await service.run("discovery_intent", { text: "thai" })).error).toBe("budget_exceeded");
    expect(provider.calls).toHaveLength(0);
  });
  it("redacts PII and secrets before the provider sees input", async () => {
    const { service, provider } = svc({ script: [good] });
    await service.run("discovery_intent", { text: "email a@b.com key sk-abcdef123456 hh_abcdef99 +1 312 555 0100", vocabulary: VOCAB });
    const sent = provider.calls[0].user;
    expect(sent).not.toMatch(/a@b\.com|sk-abcdef|hh_abcdef99|555 0100/);
    expect(redactText("https://x.y/z")).toBe("[url]");
  });
});

describe("D-05 privacy, context, adapter, health", () => {
  it("household context is compact and carries no identifiers or restriction detail", () => {
    const ctx = buildHouseholdContext({ active_member_count: 3, settings: { prefs: { keep_it_easy: true } }, recent_recipe_slugs: ["a", "b"], household_id: "hh_x", constraints: [{ allergen: "peanut" }] });
    expect(ctx).toEqual({ diners: 3, keep_it_easy: true, keep_ingredients_simple: false, recent_count: 2 });
  });
  it("NaturalLanguageIntent -> D-07 DiscoveryQuery via the existing normalizer", () => {
    const r = intentToDiscoveryQuery({ facets: { cuisines: ["korean"], methods: ["grill"], bogus: ["x"] }, max_minutes: 30, quick: true, keep_it_easy: true });
    expect(r.ok).toBe(true);
    expect(r.query.criteria.cuisines).toContain("korean");
    expect(r.query.criteria.max_minutes).toBe(30);
    expect(r.query.criteria.quick).toBe(true);
    expect(r.query.soft).toEqual({ keep_it_easy: true, keep_ingredients_simple: false });
    expect(r.dropped).toContain("bogus");
    const empty = intentToDiscoveryQuery({});
    expect(empty.ok).toBe(true);
  });
  it("health makes no provider call and leaks no secrets", () => {
    const h = aiHealth({ AI_PROVIDER_KEY: "sk-secret-123456789" }, resolveProvider({}));
    expect(h).toMatchObject({ ok: true, gateway_enabled: false, provider_configured: false, consumer_ui: false });
    expect(h.tasks).toHaveLength(8);
    expect(JSON.stringify(h)).not.toContain("sk-secret");
  });
  it("adapter contract", () => {
    expect(() => assertAdapter({})).toThrow();
    expect(assertAdapter(createFakeProvider())).toBeTruthy();
    expect(assertAdapter(unconfiguredProvider())).toBeTruthy();
  });
  it("schema helpers", () => {
    expect(validateSchema({ type: "object", required: ["a"], additionalProperties: false, properties: { a: { type: "integer", maximum: 2 } } }, { a: 3, b: 1 }).errors).toHaveLength(2);
    expect(parseJsonOutput("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
    expect(parseJsonOutput("nope")).toBeNull();
  });
});

describe("D-05 boundaries (static)", () => {
  function files(dir) {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : p.endsWith(".js") ? [p] : [];
    });
  }
  it("only src/ai talks to providers; no provider SDK or URL in feature code", () => {
    for (const f of [...files("src"), ...files("functions")]) {
      if (f.startsWith(join("src", "ai"))) continue;
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/api\.openai\.com|api\.x\.ai|anthropic\.com|generativelanguage|providers\/fake|from ["'].*ai\/(gateway|providers)/);
    }
  });
  it("no consumer AI UI and no gateway code in public/", () => {
    for (const f of files("public")) expect(readFileSync(f, "utf8"), f).not.toMatch(/\/api\/ai\/|GenerationService|AI_GATEWAY/);
  });
  it("Plan/Find/Shop/Cook/Rate modules do not import the gateway", () => {
    for (const f of files("src")) {
      if (f.startsWith(join("src", "ai")) || f.endsWith("index.js") && f === join("src", "index.js")) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/from ["'][./]*ai\//);
    }
  });
});

describe("D-05 migration + D1 store", () => {
  it("0014 applies and the D1 store records usage, counts, spend, cache", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readFileSync("migrations/0014_ai_gateway.sql", "utf8"));
    const shim = {
      prepare(sql) {
        let args = [];
        const api = {
          bind(...a) { args = a; return api; },
          async run() { db.prepare(sql).run(...args); return { success: true }; },
          async first() { return db.prepare(sql).get(...args) ?? null; },
        };
        return api;
      },
    };
    const store = createD1Store(shim);
    const service = createGenerationService({ provider: createFakeProvider({ script: [good] }), store, env: ON, now: fixedNow });
    expect((await service.run("discovery_intent", { text: "thai", vocabulary: VOCAB }, { householdId: "hh_zz" })).ok).toBe(true);
    expect((await service.run("discovery_intent", { text: "thai", vocabulary: VOCAB })).source).toBe("cache");
    const rows = db.prepare("SELECT task, status, model, prompt_version FROM ai_usage ORDER BY created_at").all();
    expect(rows.map((r) => r.status)).toEqual(["ok", "cache_hit"]);
    const cols = db.prepare("PRAGMA table_info(ai_usage)").all().map((c) => c.name);
    for (const c of ["task", "provider", "model", "input_tokens", "output_tokens", "usage_metadata_json", "estimated_cost_usd", "created_at", "status", "prompt_version"]) expect(cols).toContain(c);
    expect(cols.join(",")).not.toMatch(/prompt_text|output_text|reasoning/);
    expect(await store.countSince({ since: "2026-10-10T00:00:00.000Z" })).toBe(1);
    expect(await store.spendSince("2026-10-10T00:00:00.000Z")).toBeGreaterThan(0);
  });
});
