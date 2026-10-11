/**
 * Usage, limiter-counter and cache stores. D1 store for runtime; memory store for tests/local.
 *   reserve({key, amount, limit, expires_at, now}) -> boolean   atomic conditional increment
 *   adjust(key, delta)                                         release / settle (floored at 0)
 *   reservePlan / finishRun batch the remote round trips when db.batch exists
 */
import { MICRO } from "./limits.js";

export function createMemoryStore() {
  const usage = [];
  const cache = new Map();
  const counters = new Map();
  return {
    usage,
    cache,
    counters,
    async recordUsage(row) { usage.push({ ...row }); },
    async reserve({ key, amount, limit, expires_at, now }) {
      for (const [k, c] of counters) if (now && c.expires_at < now) counters.delete(k);
      const cur = counters.get(key)?.count || 0;
      if (cur + amount > limit) return false;
      counters.set(key, { count: cur + amount, expires_at });
      return true;
    },
    async adjust(key, delta) {
      const c = counters.get(key);
      if (c) c.count = Math.max(0, c.count + delta);
    },
    async counterValue(key) { return counters.get(key)?.count || 0; },
    async spendSince(since) { return usage.filter((r) => r.created_at >= since).reduce((s, r) => s + r.estimated_cost_usd, 0); },
    async cacheGet(key, nowIso) { const row = cache.get(key); return row && row.expires_at > nowIso ? JSON.parse(row.output_json) : null; },
    async cachePut(row) { cache.set(row.cache_key, row); },
  };
}

export function createD1Store(db) {
  return {
    async recordUsage(r) {
      await db.prepare(
        `INSERT INTO ai_usage (usage_id, task, prompt_version, provider, model, household_key, status, input_tokens, cached_input_tokens, output_tokens, attempts, latency_ms, estimated_cost_usd, pricing_version, usage_metadata_json, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(r.usage_id, r.task, r.prompt_version, r.provider, r.model, r.household_key, r.status, r.input_tokens, r.cached_input_tokens ?? 0, r.output_tokens, r.attempts, r.latency_ms, r.estimated_cost_usd, r.pricing_version ?? null, r.usage_metadata_json, r.created_at).run();
    },
    async reserve({ key, amount, limit, expires_at, now }) {
      if (now) await db.prepare(`DELETE FROM ai_limit_counters WHERE expires_at < ?`).bind(now).run();
      // Single statement => atomic in D1/SQLite. No row returned => limit reached.
      const row = await db.prepare(
        `INSERT INTO ai_limit_counters (bucket, count, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(bucket) DO UPDATE SET count = count + excluded.count
           WHERE ai_limit_counters.count + excluded.count <= ?
         RETURNING count`
      ).bind(key, amount, expires_at, limit).first();
      return Boolean(row);
    },
    async adjust(key, delta) {
      const amount = Number(delta) || 0;
      if (!amount) return;
      // Bind a positive magnitude. Some D1 drivers reject a negative bound
      // parameter, which used to leave the worst-case reservation in place.
      if (amount < 0) {
        await db.prepare(`UPDATE ai_limit_counters SET count = MAX(0, count - ?) WHERE bucket = ?`).bind(-amount, key).run();
        return;
      }
      await db.prepare(`UPDATE ai_limit_counters SET count = count + ? WHERE bucket = ?`).bind(amount, key).run();
    },
    async counterValue(key) {
      const row = await db.prepare(`SELECT count FROM ai_limit_counters WHERE bucket = ?`).bind(key).first();
      return Number(row?.count || 0);
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
    async reservePlan(plan, nowIso) {
      const valid = (plan || []).filter((r) => Number.isFinite(r.amount) && r.limit > 0 && r.amount <= r.limit);
      if (valid.length !== (plan || []).length) {
        const failed = (plan || []).find((r) => !(Number.isFinite(r.amount) && r.limit > 0 && r.amount <= r.limit)) || plan?.[0];
        return { ok: false, code: failed?.code || "rate_limited", name: failed?.name || "limit" };
      }
      if (typeof db.batch !== "function") {
        const held = [];
        for (const r of valid) {
          const ok = await this.reserve({ ...r, now: nowIso });
          if (!ok) {
            for (const h of held) await this.adjust(h.key, -h.amount).catch(() => {});
            return { ok: false, code: r.code, name: r.name };
          }
          held.push(r);
        }
        return { ok: true, held };
      }
      const statements = [];
      if (nowIso) statements.push(db.prepare(`DELETE FROM ai_limit_counters WHERE expires_at < ?`).bind(nowIso));
      for (const r of valid) {
        statements.push(
          db.prepare(
            `INSERT INTO ai_limit_counters (bucket, count, expires_at) VALUES (?, ?, ?)
               ON CONFLICT(bucket) DO UPDATE SET count = count + excluded.count
               WHERE ai_limit_counters.count + excluded.count <= ?
             RETURNING count`
          ).bind(r.key, r.amount, r.expires_at, r.limit)
        );
      }
      const results = await db.batch(statements);
      const offset = nowIso ? 1 : 0;
      const held = [];
      for (let i = 0; i < valid.length; i += 1) {
        const row = resultRows(results[offset + i])[0];
        if (!row) {
          if (held.length) {
            await db.batch(
              held.map((h) => db.prepare(`UPDATE ai_limit_counters SET count = MAX(0, count - ?) WHERE bucket = ?`).bind(h.amount, h.key))
            );
          }
          return { ok: false, code: valid[i].code, name: valid[i].name };
        }
        held.push(valid[i]);
      }
      return { ok: true, held };
    },
    async finishRun({ held, cost, usage, cache }) {
      const spend = (held || []).find((h) => h.name === "daily_budget_usd");
      if (spend) {
        const actual = Math.ceil(Math.max(0, Number(cost) || 0) * MICRO);
        await this.adjust(spend.key, actual - spend.amount);
      }
      const statements = [];
      if (usage) {
        statements.push(
          db.prepare(
            `INSERT INTO ai_usage (usage_id, task, prompt_version, provider, model, household_key, status, input_tokens, cached_input_tokens, output_tokens, attempts, latency_ms, estimated_cost_usd, pricing_version, usage_metadata_json, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(
            usage.usage_id, usage.task, usage.prompt_version, usage.provider, usage.model, usage.household_key, usage.status,
            usage.input_tokens, usage.cached_input_tokens ?? 0, usage.output_tokens, usage.attempts, usage.latency_ms,
            usage.estimated_cost_usd, usage.pricing_version ?? null, usage.usage_metadata_json, usage.created_at
          )
        );
      }
      if (cache) {
        statements.push(
          db.prepare(
            `INSERT OR REPLACE INTO ai_cache (cache_key, task, prompt_version, model, output_json, created_at, expires_at) VALUES (?,?,?,?,?,?,?)`
          ).bind(cache.cache_key, cache.task, cache.prompt_version, cache.model, cache.output_json, cache.created_at, cache.expires_at)
        );
      }
      if (!statements.length) return;
      try {
        if (typeof db.batch === "function") {
          await db.batch(statements);
          return;
        }
        for (const statement of statements) await statement.run();
      } catch {
        // The spend refund above already committed. A usage or cache write
        // must not put the worst-case reservation back.
      }
    },
  };
}

function resultRows(result) {
  if (!result) return [];
  if (Array.isArray(result.results)) return result.results;
  if (Array.isArray(result)) return result;
  return [];
}
