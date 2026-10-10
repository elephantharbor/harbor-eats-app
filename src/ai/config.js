/**
 * Runtime flags from env (wrangler vars). Default posture: OFF.
 *   AI_GATEWAY_ENABLED   "1" to allow any provider call (global kill switch when absent/"0")
 *   AI_TASKS_ENABLED     comma list of task ids allowed (default none)
 *   AI_PROVIDER          adapter id (default "none")
 *   AI_DAILY_BUDGET_USD  global estimated-spend ceiling per UTC day (default 0 => no spend)
 *   AI_GLOBAL_PER_HOUR   global request ceiling per hour (default 200)
 * Secrets (e.g. provider API key) are read only inside the adapter and never surfaced.
 */
export function readAiConfig(env = {}) {
  const tasks = String(env.AI_TASKS_ENABLED || "").split(",").map((s) => s.trim()).filter(Boolean);
  const budget = Number(env.AI_DAILY_BUDGET_USD);
  const perHour = Number(env.AI_GLOBAL_PER_HOUR);
  return {
    enabled: env.AI_GATEWAY_ENABLED === "1" || env.AI_GATEWAY_ENABLED === "true",
    tasks_enabled: tasks,
    provider: String(env.AI_PROVIDER || "none"),
    daily_budget_usd: Number.isFinite(budget) && budget >= 0 ? budget : 0,
    global_per_hour: Number.isFinite(perHour) && perHour > 0 ? perHour : 200,
  };
}
