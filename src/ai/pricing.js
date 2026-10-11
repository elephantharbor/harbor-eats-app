/**
 * Central, versioned provider pricing (USD per 1M tokens, OpenAI standard tier).
 * Bump PRICING_VERSION on any change; every usage row records the version it was costed with.
 * Provider-reported usage is authoritative; these prices only convert tokens to USD.
 */
export const PRICING_VERSION = "openai-standard-2026-10-10";

export const MODEL_PRICING = Object.freeze({
  "gpt-6-luna": Object.freeze({ input: 0.10, cached_input: 0.01, cache_write: 0.125, output: 0.50 }),
  "gpt-6.1-sol": Object.freeze({ input: 2.00, cached_input: 0.10, cache_write: 2.50, output: 10.00 }),
});

/** Per-model OUTER output ceilings. Task caps below these stay as they are: effective = min(task, model). */
export const MODEL_OUTPUT_CEILINGS = Object.freeze({ "gpt-6-luna": 600, "gpt-6.1-sol": 1500 });

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Cost from the token columns a usage row stores: input, cached input, and output.
 * `input_tokens` is the provider's TOTAL input (OpenAI includes cached tokens in it).
 * Automatic prompt caching does not add a write surcharge on top of that total:
 * a reported `cache_write_tokens` count that is already inside `input_tokens`
 * must not be billed again. Only a write count beyond the input total is added,
 * at `cache_write`. Unknown model => Infinity so a budget check fails closed.
 */
export function costUsd(model, { input_tokens = 0, cached_input_tokens = 0, output_tokens = 0, cache_write_tokens = 0 } = {}) {
  const p = MODEL_PRICING[model];
  if (!p) return Infinity;
  const input = Math.max(0, input_tokens);
  const cached = Math.min(Math.max(0, cached_input_tokens), input);
  const uncached = input - cached;
  const extraWrite = Math.max(0, Math.max(0, cache_write_tokens) - input);
  return round6((uncached * p.input + cached * p.cached_input + Math.max(0, output_tokens) * p.output + extraWrite * p.cache_write) / 1e6);
}

/** Worst case for one attempt: every input token at the dearest input rate, output at the cap. */
export function worstCaseCostUsd(model, inputTokens, maxOutputTokens) {
  const p = MODEL_PRICING[model];
  if (!p) return Infinity;
  return round6((inputTokens * Math.max(p.input, p.cache_write) + maxOutputTokens * p.output) / 1e6);
}

export function outputCeiling(model) {
  return MODEL_OUTPUT_CEILINGS[model] ?? 0;
}

/** max_output_tokens actually sent: min(task cap, model ceiling). */
export function effectiveMaxOutputTokens(taskCap, model) {
  return Math.max(0, Math.min(Number(taskCap) || 0, outputCeiling(model)));
}
