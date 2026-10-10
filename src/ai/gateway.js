/**
 * GenerationService: the ONLY path from feature code to an LLM provider.
 *
 * run(taskId, input, { householdId, fallback }) always resolves (never throws) to:
 *   { ok: true, output, source: "provider"|"cache", model, prompt_version }
 *   { ok: false, error: <code>, fallback }   // caller-supplied deterministic fallback value
 *
 * Order: task lookup -> kill switch / config errors / task flag -> provider configured ->
 * input schema -> route (models[0] only, denylist re-checked) -> cache -> single limiter
 * (household/minute, household/day, global/day, Sol/household/day, worst-case budget) ->
 * provider call with timeout -> parse -> output schema -> post-validate -> at most ONE repair
 * retry on the SAME model (never escalates) -> settle spend -> cache + usage row.
 */
import { AiError, normalizeError } from "./errors.js";
import { getTask } from "./tasks.js";
import { renderPrompt } from "./prompts.js";
import { routeModels, resolveAlias, isDeniedModel } from "./routing.js";
import { PRICING_VERSION, costUsd, worstCaseCostUsd, effectiveMaxOutputTokens } from "./pricing.js";
import { validateSchema, parseJsonOutput } from "./schema.js";
import { redactValue, householdKey, normalizeInput, sha256Hex } from "./privacy.js";
import { readAiConfig, MAX_REPAIR_RETRIES } from "./config.js";
import { planReservations, reserveAll, settleSpend } from "./limits.js";

/** Conservative token estimate for the worst-case budget check (~3 chars/token + framing). */
export function estimateInputTokens(prompt) {
  return Math.ceil((prompt.system.length + prompt.user.length) / 3) + 64;
}

/** Whitelist of non-content provider metadata fields allowed into usage_metadata_json. */
const PROVIDER_META_KEYS = ["http_status", "response_status", "incomplete_reason", "reported_model", "request_id", "response_id", "error_message", "error_type", "error_param"];
const PROVIDER_META_LIMITS = { error_message: 160, error_type: 64, error_param: 80 };
export function safeProviderMeta(m) {
  if (!m || typeof m !== "object") return null;
  const out = {};
  for (const k of PROVIDER_META_KEYS) {
    const v = m[k] ?? (k === "response_status" ? m.finish_reason : undefined);
    const limit = PROVIDER_META_LIMITS[k] || 80;
    out[k] = v == null ? null : typeof v === "number" ? v : String(v).slice(0, limit);
  }
  return out;
}

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
      cached_input_tokens: fields.cached_input_tokens || 0,
      output_tokens: fields.output_tokens || 0,
      attempts: fields.attempts || 0,
      latency_ms: fields.latency_ms ?? null,
      estimated_cost_usd: fields.estimated_cost_usd || 0,
      pricing_version: PRICING_VERSION,
      usage_metadata_json: fields.metadata ? JSON.stringify(fields.metadata).slice(0, 2000) : null,
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
      return await provider.generate(req, { signal: ctrl.signal, timeoutMs });
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

    // Selection by task class only: models[0], never escalated.
    const alias = routeModels(task)[0];
    const model = resolveAlias(alias);
    const wireModel = provider.resolveModel(alias) || model;
    if (!model || isDeniedModel(model) || isDeniedModel(wireModel)) {
      await record(task, { status: "fallback:disabled", model: "denied", household_key: hk });
      return fail("disabled", fallback);
    }
    const safeInput = redactValue(input);
    const cacheKey = await sha256Hex(`${task.id}|${task.prompt_version}|${model}|${JSON.stringify(normalizeInput(safeInput))}`);
    const nowDate = now();
    const nowIso = nowDate.toISOString();

    if (task.cache.enabled) {
      const hit = await store.cacheGet(cacheKey, nowIso).catch(() => null);
      if (hit) {
        await record(task, { status: "cache_hit", model, household_key: hk });
        return { ok: true, output: hit, source: "cache", model, prompt_version: task.prompt_version };
      }
    }

    const prompt = renderPrompt(task.id, safeInput);
    const maxOut = effectiveMaxOutputTokens(task.limits.max_output_tokens, model);
    const maxRetries = Math.min(task.limits.max_retries, MAX_REPAIR_RETRIES);
    const worst = worstCaseCostUsd(model, estimateInputTokens(prompt), maxOut) * (maxRetries + 1);
    const plan = planReservations({ config, householdKey: hk, model, worstCaseUsd: worst, now: nowDate });
    let reservation;
    try {
      reservation = await reserveAll(store, plan, nowIso);
    } catch {
      reservation = { ok: false, code: "rate_limited", name: "store_error" }; // fail closed
    }
    if (!reservation.ok) {
      await record(task, { status: `fallback:${reservation.code}`, model, household_key: hk, metadata: { limit: reservation.name } });
      return fail(reservation.code, fallback);
    }

    let attempts = 0;
    let inTok = 0;
    let cachedTok = 0;
    let outTok = 0;
    let writeTok = 0;
    let lastCode = "malformed_output";
    let repairNote = "";
    const started = now().getTime();
    let meta = null;
    let reasonTok = 0;
    let errCode = null;
    let errDetail = null;
    const addUsage = (u) => {
      if (!u) return;
      inTok += u.input_tokens || 0;
      cachedTok += u.cached_input_tokens || 0;
      outTok += u.output_tokens || 0;
      writeTok += u.cache_write_tokens || 0;
      reasonTok += u.reasoning_tokens || 0;
    };
    const spent = () => costUsd(model, { input_tokens: inTok, cached_input_tokens: cachedTok, output_tokens: outTok, cache_write_tokens: writeTok });
    let result = null;
    while (attempts <= maxRetries) {
      attempts += 1;
      try {
        const res = await callWithTimeout({
          model: wireModel,
          schema_name: task.id,
          system: prompt.system,
          user: prompt.user + repairNote,
          max_output_tokens: maxOut,
          response_schema: task.output_schema,
          temperature: task.cost_class === "creative" ? 0.7 : 0,
          reasoning_effort: task.reasoning_effort,
        }, Math.min(task.limits.timeout_ms, maxTimeoutMs));
        addUsage(res.usage);
        meta = safeProviderMeta(res.metadata);
        errCode = null; errDetail = null;
        const parsed = parseJsonOutput(res.text);
        const check = parsed == null ? { ok: false, errors: ["not_json"] } : validateSchema(task.output_schema, parsed);
        if (!check.ok) {
          lastCode = "malformed_output"; errCode = lastCode; errDetail = `schema:${check.errors.slice(0, 2).join(";")}`.replace(/[^\w.:;\- ]/g, "").slice(0, 120);
          repairNote = `\nYour previous output was invalid (${check.errors.slice(0, 3).join("; ")}). Return only valid JSON for the schema.`;
          continue;
        }
        const post = task.post_validate(parsed, safeInput);
        if (!post.ok) { lastCode = "malformed_output"; errCode = lastCode; errDetail = `post_validate:${String(post.reason || "").slice(0, 40)}`; repairNote = "\nPrevious output violated policy. Do not make safety, allergen or eligibility claims."; continue; }
        result = post.value;
        break;
      } catch (error) {
        const norm = error instanceof AiError ? error : normalizeError(error);
        addUsage(error?.usage);
        lastCode = norm.code;
        errCode = norm.code;
        errDetail = norm.detail ? String(norm.detail).slice(0, 120) : null;
        meta = safeProviderMeta(error?.provider_meta) || meta;
        // Only transient timeout/outage get the single retry (same model). 429, refusals, incomplete: stop.
        if (norm.code !== "timeout" && norm.code !== "provider_outage") break;
      }
    }
    const cost = spent();
    await settleSpend(store, reservation.held, cost);
    const metadata = {
      requested_model: wireModel,
      reported_model: meta?.reported_model ?? null,
      http_status: meta?.http_status ?? null,
      response_status: meta?.response_status ?? null,
      incomplete_reason: meta?.incomplete_reason ?? null,
      error_code: result !== null ? null : (errCode || lastCode),
      error_detail: result !== null ? null : errDetail,
      reasoning_effort: task.reasoning_effort,
      max_output_tokens: maxOut,
      input_tokens: inTok,
      cached_input_tokens: cachedTok,
      reasoning_tokens: reasonTok,
      output_tokens: outTok,
      pricing_version: PRICING_VERSION,
      estimated_cost_usd: cost,
      request_id: meta?.request_id ?? null,
      response_id: meta?.response_id ?? null,
      error_message: meta?.error_message ?? null,
      error_type: meta?.error_type ?? null,
      error_param: meta?.error_param ?? null,
    };
    const base = { model, household_key: hk, input_tokens: inTok, cached_input_tokens: cachedTok, output_tokens: outTok, attempts, latency_ms: now().getTime() - started, estimated_cost_usd: cost, metadata };
    if (result !== null) {
      await record(task, { status: "ok", ...base });
      if (task.cache.enabled) {
        await store.cachePut({
          cache_key: cacheKey, task: task.id, prompt_version: task.prompt_version, model,
          output_json: JSON.stringify(result), created_at: nowIso,
          expires_at: new Date(now().getTime() + task.cache.ttl_seconds * 1000).toISOString(),
        }).catch(() => {});
      }
      return { ok: true, output: result, source: "provider", model, prompt_version: task.prompt_version, estimated_cost_usd: cost, metadata };
    }
    log("ai_task_fallback", { task: task.id, code: lastCode, attempts });
    await record(task, { status: `fallback:${lastCode}`, ...base });
    return { ok: false, error: lastCode, fallback: fallback === undefined ? null : fallback, estimated_cost_usd: cost, metadata };
  }

  return { run, config };
}
