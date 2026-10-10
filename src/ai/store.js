/** Usage + cache stores. D1 store for runtime; memory store for tests/local. */

export function createMemoryStore() {
  const usage = [];
  const cache = new Map();
  return {
    usage,
    cache,
    async recordUsage(row) { usage.push({ ...row }); },
    async countSince({ task = null, household_key = null, since }) {
      return usage.filter((r) => r.created_at >= since && !r.status.startsWith("fallback:disabled")
        && (task == null || r.task === task) && (household_key == null || r.household_key === household_key)
        && r.status !== "cache_hit").length;
    },
    async spendSince(since) { return usage.filter((r) => r.created_at >= since).reduce((s, r) => s + r.estimated_cost_usd, 0); },
    async cacheGet(key, nowIso) { const row = cache.get(key); return row && row.expires_at > nowIso ? JSON.parse(row.output_json) : null; },
    async cachePut(row) { cache.set(row.cache_key, row); },
  };
}

export function createD1Store(db) {
  return {
    async recordUsage(r) {
      await db.prepare(
        `INSERT INTO ai_usage (usage_id, task, prompt_version, provider, model, household_key, status, input_tokens, output_tokens, attempts, latency_ms, estimated_cost_usd, usage_metadata_json, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(r.usage_id, r.task, r.prompt_version, r.provider, r.model, r.household_key, r.status, r.input_tokens, r.output_tokens, r.attempts, r.latency_ms, r.estimated_cost_usd, r.usage_metadata_json, r.created_at).run();
    },
    async countSince({ task = null, household_key = null, since }) {
      const row = await db.prepare(
        `SELECT COUNT(*) AS c FROM ai_usage WHERE created_at >= ? AND status NOT IN ('cache_hit','fallback:disabled')
           AND (? IS NULL OR task = ?) AND (? IS NULL OR household_key = ?)`
      ).bind(since, task, task, household_key, household_key).first();
      return Number(row?.c || 0);
    },
    async spendSince(since) {
      const row = await db.prepare(`SELECT COALESCE(SUM(estimated_cost_usd),0) AS s FROM ai_usage WHERE created_at >= ?`).bind(since).first();
      return Number(row?.s || 0);
    },
    async cacheGet(key, nowIso) {
      const row = await db.prepare(`SELECT output_json FROM ai_cache WHERE cache_key = ? AND expires_at > ?`).bind(key, nowIso).first();
      return row ? JSON.parse(row.output_json) : null;
    },
    async cachePut(r) {
      await db.prepare(
        `INSERT OR REPLACE INTO ai_cache (cache_key, task, prompt_version, model, output_json, created_at, expires_at) VALUES (?,?,?,?,?,?,?)`
      ).bind(r.cache_key, r.task, r.prompt_version, r.model, r.output_json, r.created_at, r.expires_at).run();
    },
  };
}
