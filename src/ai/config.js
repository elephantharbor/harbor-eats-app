/**
 * Runtime flags from env (wrangler [vars]). Default posture: OFF, zero spend.
 *   AI_GATEWAY_ENABLED        "1" to allow any provider call (global kill switch when absent/"0")
 *   AI_TASKS_ENABLED          comma list of task ids allowed (default none)
 *   AI_PROVIDER               adapter id: "openai" or "none" (default "none")
 *   AI_DAILY_BUDGET_USD       global spend ceiling per UTC day (default 0 => no spend)
 *   AI_HOUSEHOLD_PER_MINUTE   provider requests per household per UTC minute (default 5)
 *   AI_HOUSEHOLD_PER_DAY      provider requests per household per UTC day, across ALL tasks (default 30)
 *   AI_GLOBAL_PER_DAY         provider requests per UTC day, all households (default 50)
 *   AI_SOL_HOUSEHOLD_PER_DAY  gpt-6.1-sol requests per household per UTC day (default 5)
 * Secrets (the provider API key) are read only inside the adapter and never surfaced here.
 *
 * Any AI_* value naming a denylisted model (gpt-6-astra) is a config error: the gateway
 * refuses to run (config_errors non-empty => enabled=false).
 */
import { isDeniedModel } from "./routing.js";

export const LIMIT_DEFAULTS = Object.freeze({
  household_per_minute: 5,
  household_per_day: 30,
  global_per_day: 50,
  sol_household_per_day: 5,
});

export const MAX_REPAIR_RETRIES = 1;

function posInt(v, dflt) {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isInteger(n) && n >= 0 ? n : dflt;
}

export function readAiConfig(env = {}) {
  const config_errors = [];
  for (const [k, v] of Object.entries(env || {})) {
    if (k.startsWith("AI_") && typeof v === "string" && v.split(/[\s,]+/).some(isDeniedModel)) config_errors.push(`${k}: denylisted model`);
  }
  const tasks = String(env.AI_TASKS_ENABLED || "").split(",").map((s) => s.trim()).filter(Boolean);
  const budget = Number(env.AI_DAILY_BUDGET_USD);
  const switchOn = env.AI_GATEWAY_ENABLED === "1" || env.AI_GATEWAY_ENABLED === "true";
  return {
    enabled: switchOn && config_errors.length === 0,
    tasks_enabled: tasks,
    provider: String(env.AI_PROVIDER || "none"),
    daily_budget_usd: Number.isFinite(budget) && budget >= 0 ? budget : 0,
    limits: {
      household_per_minute: posInt(env.AI_HOUSEHOLD_PER_MINUTE, LIMIT_DEFAULTS.household_per_minute),
      household_per_day: posInt(env.AI_HOUSEHOLD_PER_DAY, LIMIT_DEFAULTS.household_per_day),
      global_per_day: posInt(env.AI_GLOBAL_PER_DAY, LIMIT_DEFAULTS.global_per_day),
      sol_household_per_day: posInt(env.AI_SOL_HOUSEHOLD_PER_DAY, LIMIT_DEFAULTS.sol_household_per_day),
    },
    max_repair_retries: MAX_REPAIR_RETRIES,
    config_errors,
  };
}

/** Strict variant for config load sites that should fail loudly (preflight, tests). */
export function assertAiConfig(env = {}) {
  const cfg = readAiConfig(env);
  if (cfg.config_errors.length) throw new Error(`AI config rejected: ${cfg.config_errors.join("; ")}`);
  return cfg;
}
