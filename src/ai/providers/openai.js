/**
 * OpenAI adapter (Responses API + Structured Outputs). The ONLY module that reads
 * env.OPENAI_API_KEY; the key is used for the Authorization header and nothing else:
 * never logged, returned, put in errors or metadata. No organization/project headers.
 *
 * Errors thrown are AiError (normalized codes) or carry { status } / AbortError, which the
 * gateway normalizes. Usage reported by the provider is authoritative and is attached to
 * errors too (refusal / incomplete still cost tokens).
 */
import { AiError } from "../errors.js";
import { resolveAlias, assertModelAllowed, isDeniedModel, reasoningEffortsForModel } from "../routing.js";
import { outputCeiling } from "../pricing.js";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Convert a task output schema into an OpenAI strict json_schema: every object gets
 * additionalProperties:false and lists ALL properties as required; originally-optional
 * properties become nullable. Length/count/range keywords are dropped from the wire schema
 * (the gateway's own validator still enforces them on the parsed output).
 */
export function toStrictSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  if (schema.type) out.type = schema.type;
  if (schema.enum) out.enum = [...schema.enum];
  if (schema.type === "array" || (Array.isArray(schema.type) && schema.type.includes("array"))) {
    out.items = toStrictSchema(schema.items || { type: "string" });
  }
  if (schema.type === "object" || schema.properties) {
    const props = schema.properties || {};
    const required = new Set(schema.required || []);
    out.type = "object";
    out.properties = {};
    for (const [k, v] of Object.entries(props)) {
      const strict = toStrictSchema(v);
      if (!required.has(k)) {
        const types = Array.isArray(strict.type) ? strict.type : strict.type ? [strict.type] : [];
        if (types.length && !types.includes("null")) strict.type = [...types, "null"];
        if (strict.enum && !strict.enum.includes(null)) strict.enum = [...strict.enum, null];
      }
      out.properties[k] = strict;
    }
    out.required = Object.keys(props);
    out.additionalProperties = false;
  }
  return out;
}

/** Remove nulls that strict mode forced onto originally-optional properties. */
export function dropNullOptionals(value, schema) {
  if (!schema || value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => dropNullOptionals(v, schema.items));
  const required = new Set(schema.required || []);
  const props = schema.properties || {};
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === null && !required.has(k)) continue;
    out[k] = dropNullOptionals(v, props[k]);
  }
  return out;
}

export function buildResponsesRequest(req) {
  const model = assertModelAllowed(req.model);
  const ceiling = outputCeiling(model);
  const max = Math.min(Number(req.max_output_tokens) || ceiling, ceiling || Infinity);
  const effort = req.reasoning_effort ? String(req.reasoning_effort) : "";
  if (effort) {
    const allowed = reasoningEffortsForModel(model);
    if (allowed && !allowed.includes(effort)) {
      throw new AiError("provider_config", `reasoning_effort:${effort}`);
    }
  }
  return {
    model,
    input: [
      { role: "system", content: String(req.system || "") },
      { role: "user", content: String(req.user || "") },
    ],
    max_output_tokens: max,
    ...(effort ? { reasoning: { effort } } : {}),
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: String(req.schema_name || "output").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64),
        schema: toStrictSchema(req.response_schema),
        strict: true,
      },
    },
  };
}

/** Provider usage -> normalized usage. Provider numbers are authoritative. */
export function parseUsage(usage) {
  const u = usage || {};
  return {
    input_tokens: Number(u.input_tokens) || 0,
    cached_input_tokens: Number(u.input_tokens_details?.cached_tokens) || 0,
    output_tokens: Number(u.output_tokens) || 0,
    reasoning_tokens: Number(u.output_tokens_details?.reasoning_tokens) || 0,
    cache_write_tokens: Number(u.input_tokens_details?.cache_write_tokens ?? u.input_tokens_details?.cache_creation_tokens) || 0,
  };
}

/** Pull output text / refusal from a Responses API body. */
export function extractOutput(body) {
  let text = typeof body?.output_text === "string" ? body.output_text : "";
  let refusal = null;
  for (const item of body?.output || []) {
    if (item?.type !== "message") continue;
    for (const c of item.content || []) {
      if (c?.type === "refusal") refusal = String(c.refusal || "refused");
      else if (c?.type === "output_text" && !text) text = String(c.text || "");
    }
  }
  return { text, refusal };
}

function err(code, detail, usage, providerMeta) {
  const e = new AiError(code, detail);
  if (usage) e.usage = usage;
  if (providerMeta) e.provider_meta = providerMeta;
  return e;
}

const safeStr = (v, n = 80) => (v == null ? null : String(v).replace(/[^\w.:-]/g, "").slice(0, n) || null);

/**
 * Diagnosable OpenAI error text. Truncated, secrets stripped, and long quoted
 * spans (schema or prompt echoes) collapsed so the 400 reason survives without
 * storing request content.
 */
function safeErrorField(value, max) {
  if (value == null) return null;
  let s = String(value);
  s = s.replace(/sk-[A-Za-z0-9_-]+/gi, "");
  s = s.replace(/\bBearer\s+\S+/gi, "");
  s = s.replace(/"[^"]{40,}"/g, '"…"');
  s = s.replace(/'[^']{40,}'/g, "'…'");
  s = s.replace(/[^\w\s.,:;_'"()/=+-]/g, "");
  s = s.replace(/\s+/g, " ").trim().slice(0, max);
  return s || null;
}

/** Safe, non-content provider metadata (no prompt, output, reasoning text or key). */
export function providerMetadata(res, json) {
  const apiError = json?.error && typeof json.error === "object" ? json.error : null;
  return {
    http_status: Number(res?.status) || null,
    response_status: safeStr(json?.status, 20),
    incomplete_reason: safeStr(json?.incomplete_details?.reason, 40),
    reported_model: safeStr(json?.model, 64),
    request_id: safeStr(res?.headers?.get?.("x-request-id"), 80),
    response_id: safeStr(json?.id, 80),
    error_message: safeErrorField(apiError?.message, 160),
    error_type: safeErrorField(apiError?.type, 64),
    error_param: safeErrorField(apiError?.param, 80),
  };
}

export function createOpenAIProvider({ env = {}, fetchImpl = (...a) => globalThis.fetch(...a), defaultTimeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const hasKey = () => typeof env.OPENAI_API_KEY === "string" && env.OPENAI_API_KEY.trim().length > 0;
  return {
    id: "openai",
    configured: () => hasKey(),
    resolveModel: (alias) => {
      const m = resolveAlias(alias);
      return m && !isDeniedModel(m) ? m : null;
    },
    async generate(req, { signal, timeoutMs } = {}) {
      if (!hasKey()) throw err("provider_unconfigured");
      if (isDeniedModel(req.model)) throw err("disabled", "denylisted_model");
      const body = buildResponsesRequest(req);
      const ctrl = new AbortController();
      const onAbort = () => ctrl.abort();
      if (signal) {
        if (signal.aborted) ctrl.abort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }
      const timer = setTimeout(() => ctrl.abort(), timeoutMs ?? defaultTimeoutMs);
      let res;
      let json;
      try {
        res = await fetchImpl(OPENAI_RESPONSES_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY.trim()}` },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        json = await res.json().catch(() => null);
      } catch (e) {
        if (e?.name === "AbortError" || e?.name === "TimeoutError" || ctrl.signal.aborted) throw err("timeout");
        throw err("provider_outage", "network");
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener?.("abort", onAbort);
      }
      const usage = parseUsage(json?.usage);
      const pm = providerMetadata(res, json);
      if (res.status === 429) throw err("rate_limited", "status_429", usage, pm);
      if (res.status === 400) throw err("provider_config", "status_400", usage, pm);
      if (res.status >= 500) throw err("provider_outage", `status_${res.status}`, usage, pm);
      if (!res.ok) throw err("provider_outage", `status_${res.status}`, usage, pm); // 401/403/404: config problem, no body echo
      if (json?.error) throw err("provider_outage", "response_error", usage, pm);
      if (json?.status === "incomplete" && json?.incomplete_details?.reason === "max_output_tokens") throw err("output_limit", "incomplete:max_output_tokens", usage, pm);
      if (json?.status === "incomplete") throw err("malformed_output", `incomplete:${String(json?.incomplete_details?.reason || "unknown").slice(0, 40)}`, usage, pm);
      if (json?.status === "failed") throw err("provider_outage", "failed", usage, pm);
      if (json?.status && json.status !== "completed") throw err("provider_outage", `status:${String(json.status).slice(0, 20)}`, usage, pm);
      const { text, refusal } = extractOutput(json);
      if (refusal) throw err("malformed_output", "refusal", usage, pm);
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      return {
        text: parsed ? JSON.stringify(dropNullOptionals(parsed, req.response_schema)) : text,
        model: String(json?.model || body.model),
        usage,
        metadata: { finish_reason: json?.status || null, ...pm },
      };
    },
  };
}
