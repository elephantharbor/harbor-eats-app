/** D-05 health/config. Makes NO provider call and exposes no secret values. */
import { readAiConfig } from "./config.js";
import { TASKS } from "./tasks.js";
import { COST_CLASSES } from "./routing.js";

export const D05_VERSION = "d05-foundation-1";

export function aiHealth(env = {}, provider = null) {
  const cfg = readAiConfig(env);
  return {
    ok: true,
    d05_version: D05_VERSION,
    gateway_enabled: cfg.enabled,
    provider: cfg.provider,
    provider_configured: Boolean(provider && provider.configured(env)),
    daily_budget_usd: cfg.daily_budget_usd,
    consumer_ui: false,
    tasks: Object.values(TASKS).map((t) => ({
      id: t.id,
      prompt_version: t.prompt_version,
      cost_class: t.cost_class,
      executable: t.executable,
      enabled: cfg.enabled && cfg.tasks_enabled.includes(t.id),
      cache: t.cache.enabled,
    })),
    cost_classes: Object.keys(COST_CLASSES),
  };
}
