/**
 * GenerationService: the ONLY path from feature code to an LLM provider.
 *
 * run(taskId, input, { householdId, fallback }) always resolves (never throws) to:
 *   { ok: true, output, source: "provider"|"cache", model, prompt_version }
 *   { ok: false, error: <code>, fallback }   // caller-supplied deterministic fallback value
 *
 * Order: task lookup -> kill switch / task flag -> provider configured -> input schema ->
 * cache -> rate limits (household, task, global) -> budget -> provider call with timeout ->
 * parse -> output schema -> post-validate -> bounded repair retry -> cache + usage row.
 */
import { AiError, normalizeError } from "./errors.js";
import { getTask } from "./tasks.js";
import { renderPrompt } from "./prompts.js";
import { routeModels, estimateCostUsd } from "./routing.js";
import { validateSchema, parseJsonOutput } from "./schema.js";
import { redactValue, householdKey, normalizeInput, sha256Hex } from "./privacy.js";
import { readAiConfig } from "./config.js";

const HOUR = 3600e3;

export function createGenerationService({ provider, store, env = {}, now = () => new Date(), log = () => {}, idFactory = null, maxTimeoutMs = Infinity }) {
  const config = readAiConfig(env);
  let seq = 0;
  const newId = idFactory || (() => `aiu_${now().getTime().toString(36)}_${(seq++).toString(36)}`);

  async function record(task, fields) {
    const row = {
      usage_id: newId(),
      task: task.id,
      prompt_version: task.prompt_version,
      provider: provider?.id || "none",
      model: fields.model || "none",
      household_key: fields.household_key ?? null,
      status: fields.status,
      input_tokens: fields.input_tokens || 0,
      output_tokens: fields.output_tokens || 0,
      attempts: fields.attempts || 0,
      latency_ms: fields.latency_ms ?? null,
      estimated_cost_usd: fields.estimated_cost_usd || 0,
      usage_metadata_json: fields.metadata ? JSON.stringify(fields.metadata).slice(0, 500) : null,
      created_at: now().toISOString(),
    };
    try { await store.recordUsage(row); } catch (e) { log("ai_usage_write_failed", { task: task.id, code: String(e?.message || e).slice(0, 80) }); }
    return row;
  }

  function fail(code, fallback) {
    return { ok: false, error: code, fallback: fallback === undefined ? null : fallback };
  }

  async function callWithTimeout(req, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await provider.generate(req, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function run(taskId, input, opts = {}) {
    const { householdId = null, fallback } = opts;
    const task = getTask(taskId);
    if (!task) return fail("unknown_task", fallback);
    const hk = await householdKey(householdId);

    if (!config.enabled || !config.tasks_enabled.includes(task.id)) {
      await record(task, { status: "fallback:disabled", household_key: hk });
      return fail("disabled", fallback);
    }
    if (!provider || !provider.configured(env)) {
      await record(task, { status: "fallback:provider_unconfigured", household_key: hk });
      return fail("provider_unconfigured", fallback);
    }
    const inputCheck = validateSchema(task.input_schema, input);
    if (!inputCheck.ok) return fail("invalid_input", fallback);

    const models = routeModels(task);
    const model = models[0];
    const safeInput = redactValue(input);
    const cacheKey = await sha256Hex(`${task.id}|${task.prompt_version}|${model}|${JSON.stringify(normalizeInput(safeInput))}`);
    const nowIso = now().toISOString();

    if (task.cache.enabled) {
      const hit = await store.cacheGet(cacheKey, nowIso).catch(() => null);
      if (hit) {
        await record(task, { status: "cache_hit", model, household_key: hk });
        return { ok: true, output: hit, source: "cache", model, prompt_version: task.prompt_version };
      }
    }

    const hourAgo = new Date(now().getTime() - HOUR).toISOString();
    const [hhCount, globalCount] = await Promise.all([
      hk ? store.countSince({ task: task.id, household_key: hk, since: hourAgo }) : 0,
      store.countSince({ since: hourAgo }),
    ]);
    if ((hk && hhCount >= task.limits.per_household_per_hour) || globalCount >= config.global_per_hour) {
      await record(task, { status: "fallback:rate_limited", model, household_key: hk });
      return fail("rate_limited", fallback);
    }
    const dayStart = nowIso.slice(0, 10) + "T00:00:00.000Z";
    const spent = await store.spendSince(dayStart);
    const worst = estimateCostUsd(task.cost_class, 2000, task.limits.max_output_tokens);
    if (spent + worst > config.daily_budget_usd) {
      await record(task, { status: "fallback:budget_exceeded", model, household_key: hk });
      return fail("budget_exceeded", fallback);
    }

    const prompt = renderPrompt(task.id, safeInput);
    let attempts = 0;
    let inTok = 0;
    let outTok = 0;
    let lastCode = "malformed_output";
    let repairNote = "";
    const started = now().getTime();
    let meta = null;
    while (attempts <= task.limits.max_retries) {
      attempts += 1;
      try {
        const res = await callWithTimeout({
          model: provider.resolveModel(model) || model,
          system: prompt.system,
          user: prompt.user + repairNote,
          max_output_tokens: task.limits.max_output_tokens,
          response_schema: task.output_schema,
          temperature: task.cost_class === "creative" ? 0.7 : 0,
        }, Math.min(task.limits.timeout_ms, maxTimeoutMs));
        inTok += res.usage?.input_tokens || 0;
        outTok += res.usage?.output_tokens || 0;
        meta = res.metadata ? { finish_reason: res.metadata.finish_reason ?? null, request_id: res.metadata.request_id ?? null } : null;
        const parsed = parseJsonOutput(res.text);
        const check = parsed == null ? { ok: false, errors: ["not_json"] } : validateSchema(task.output_schema, parsed);
        if (!check.ok) {
          lastCode = "malformed_output";
          repairNote = `\nYour previous output was invalid (${check.errors.slice(0, 3).join("; ")}). Return only valid JSON for the schema.`;
          continue;
        }
        const post = task.post_validate(parsed, safeInput);
        if (!post.ok) { lastCode = "malformed_output"; repairNote = "\nPrevious output violated policy. Do not make safety, allergen or eligibility claims."; continue; }
        const cost = estimateCostUsd(task.cost_class, inTok, outTok);
        await record(task, { status: "ok", model, household_key: hk, input_tokens: inTok, output_tokens: outTok, attempts, latency_ms: now().getTime() - started, estimated_cost_usd: cost, metadata: meta });
        if (task.cache.enabled) {
          await store.cachePut({
            cache_key: cacheKey, task: task.id, prompt_version: task.prompt_version, model,
            output_json: JSON.stringify(post.value), created_at: nowIso,
            expires_at: new Date(now().getTime() + task.cache.ttl_seconds * 1000).toISOString(),
          }).catch(() => {});
        }
        return { ok: true, output: post.value, source: "provider", model, prompt_version: task.prompt_version };
      } catch (error) {
        const norm = error instanceof AiError ? error : normalizeError(error);
        lastCode = norm.code;
        if (norm.code !== "timeout" && norm.code !== "provider_outage") break; // rate limits etc. are not retried
      }
    }
    log("ai_task_fallback", { task: task.id, code: lastCode, attempts });
    await record(task, { status: `fallback:${lastCode}`, model, household_key: hk, input_tokens: inTok, output_tokens: outTok, attempts, latency_ms: now().getTime() - started, estimated_cost_usd: estimateCostUsd(task.cost_class, inTok, outTok), metadata: meta });
    return fail(lastCode, fallback);
  }

  return { run, config };
}
