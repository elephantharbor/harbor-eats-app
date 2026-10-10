/** D-05 health/config. Makes NO provider call and exposes no secret values (key presence is a boolean). */
import { readAiConfig } from "./config.js";
import { TASKS } from "./tasks.js";
import { COST_CLASSES, MODEL_ALIASES, MODEL_DENYLIST, modelForTask } from "./routing.js";
import { PRICING_VERSION, MODEL_PRICING, MODEL_OUTPUT_CEILINGS, effectiveMaxOutputTokens } from "./pricing.js";

export const D05_VERSION = "d05-provider-1";

export function aiHealth(env = {}, provider = null) {
  const cfg = readAiConfig(env);
  return {
    ok: true,
    d05_version: D05_VERSION,
    gateway_enabled: cfg.enabled,
    config_errors: cfg.config_errors,
    provider: cfg.provider,
    provider_id: provider?.id || "none",
    provider_configured: Boolean(provider && provider.configured(env)),
    openai_key_present: typeof env.OPENAI_API_KEY === "string" && env.OPENAI_API_KEY.trim().length > 0,
    daily_budget_usd: cfg.daily_budget_usd,
    limits: { ...cfg.limits, max_repair_retries: cfg.max_repair_retries },
    models: { aliases: { ...MODEL_ALIASES }, denylist: [...MODEL_DENYLIST], output_ceilings: { ...MODEL_OUTPUT_CEILINGS } },
    pricing_version: PRICING_VERSION,
    pricing_usd_per_mtok: MODEL_PRICING,
    consumer_ui: false,
    tasks: Object.values(TASKS).map((t) => ({
      id: t.id,
      prompt_version: t.prompt_version,
      cost_class: t.cost_class,
      model: modelForTask(t),
      max_output_tokens: effectiveMaxOutputTokens(t.limits.max_output_tokens, modelForTask(t)),
      executable: t.executable,
      enabled: cfg.enabled && cfg.tasks_enabled.includes(t.id),
      cache: t.cache.enabled,
    })),
    cost_classes: Object.keys(COST_CLASSES),
  };
}
