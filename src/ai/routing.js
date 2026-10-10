/**
 * Centralized routing table. Tasks reference a cost class and logical aliases; aliases are bound
 * to concrete OpenAI models HERE (one place). Selection is by task class only: the gateway always
 * uses models[0] and never escalates to another model on failure.
 */
import { MODEL_PRICING, MODEL_OUTPUT_CEILINGS, costUsd } from "./pricing.js";

export const COST_CLASSES = Object.freeze({
  cheap: { models: ["fast-small"] },
  standard: { models: ["fast-small", "balanced"] },
  creative: { models: ["balanced", "strong"] },
});

/** Logical alias -> concrete provider model. */
export const MODEL_ALIASES = Object.freeze({
  "fast-small": "gpt-6-luna",
  balanced: "gpt-6-luna",
  strong: "gpt-6.1-sol",
});

/** Models that must never be called, whatever config or code says. */
export const MODEL_DENYLIST = Object.freeze(["gpt-6-astra"]);

/** The "Sol" tier, subject to its own per-household daily cap. */
export const SOL_MODELS = Object.freeze(["gpt-6.1-sol"]);

export function isDeniedModel(model) {
  const m = String(model || "").toLowerCase();
  return MODEL_DENYLIST.some((d) => m === d || m.startsWith(`${d}-`) || m.includes("astra"));
}

export function assertModelAllowed(model) {
  if (isDeniedModel(model)) throw new Error(`model ${model} is denylisted`);
  return model;
}

/** Validate a routing table (run at module load and by tests). Throws on any denylisted/unpriced binding. */
export function validateRoutingTable(aliases = MODEL_ALIASES) {
  for (const [alias, model] of Object.entries(aliases)) {
    assertModelAllowed(model);
    if (!MODEL_PRICING[model]) throw new Error(`alias ${alias} -> ${model} has no pricing`);
    if (!MODEL_OUTPUT_CEILINGS[model]) throw new Error(`alias ${alias} -> ${model} has no output ceiling`);
  }
  return true;
}
validateRoutingTable();

export function resolveAlias(alias) {
  const model = MODEL_ALIASES[alias] || null;
  return model ? assertModelAllowed(model) : null;
}

/** Ordered list for a task; ONLY the first entry is ever used (no escalation). */
export function routeModels(task) {
  const cls = COST_CLASSES[task.cost_class];
  if (!cls) throw new Error(`unknown cost class ${task.cost_class}`);
  return task.allowed_models.filter((m) => cls.models.includes(m));
}

/** Concrete model a task runs on. */
export function modelForTask(task) {
  return resolveAlias(routeModels(task)[0]);
}

/** Back-compat helper: cost of a usage on a model (see pricing.js). */
export function estimateCostUsd(model, inputTokens, outputTokens, cachedInputTokens = 0) {
  return costUsd(model, { input_tokens: inputTokens, output_tokens: outputTokens, cached_input_tokens: cachedInputTokens });
}
