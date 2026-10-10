/**
 * The ONE limiter for D-05. Every provider-bound run() reserves, atomically and in order:
 *   household / UTC minute, household / UTC day (all tasks), global / UTC day,
 *   Sol / household / UTC day (only when the task routes to gpt-6.1-sol),
 *   daily budget (worst-case micro-USD, settled to actual cost after the call).
 * Reservations are conditional increments on a counter table (store.reserve), so concurrent
 * requests cannot both take the last slot. If any reservation fails, earlier ones are released.
 * Cache hits and disabled/unconfigured fallbacks never reserve. A run with repair retry is one
 * request against the count limits; its budget reservation covers every attempt.
 */
import { SOL_MODELS } from "./routing.js";

export const MICRO = 1e6;

export function utcWindows(date) {
  const iso = date.toISOString();
  const day = iso.slice(0, 10);
  const minute = iso.slice(0, 16);
  const dayEnd = new Date(`${day}T00:00:00.000Z`).getTime() + 86400e3;
  const minuteEnd = new Date(`${minute}:00.000Z`).getTime() + 60e3;
  return { day, minute, dayStartIso: `${day}T00:00:00.000Z`, dayExpires: new Date(dayEnd + 3600e3).toISOString(), minuteExpires: new Date(minuteEnd + 60e3).toISOString() };
}

/** Ordered reservations for one run. `code` is the normalized error when that bucket is full. */
export function planReservations({ config, householdKey, model, worstCaseUsd, now }) {
  const w = utcWindows(now);
  const L = config.limits;
  const plan = [];
  if (householdKey) {
    plan.push({ key: `hh_min:${householdKey}:${w.minute}`, amount: 1, limit: L.household_per_minute, expires_at: w.minuteExpires, code: "rate_limited", name: "household_per_minute" });
    plan.push({ key: `hh_day:${householdKey}:${w.day}`, amount: 1, limit: L.household_per_day, expires_at: w.dayExpires, code: "rate_limited", name: "household_per_day" });
  }
  plan.push({ key: `global_day:${w.day}`, amount: 1, limit: L.global_per_day, expires_at: w.dayExpires, code: "rate_limited", name: "global_per_day" });
  if (SOL_MODELS.includes(model)) {
    // Sol calls must be attributable to a household; anonymous Sol calls share one bucket.
    plan.push({ key: `sol_hh_day:${householdKey || "anon"}:${w.day}`, amount: 1, limit: L.sol_household_per_day, expires_at: w.dayExpires, code: "rate_limited", name: "sol_household_per_day" });
  }
  plan.push({ key: `spend_day:${w.day}`, amount: Math.ceil(worstCaseUsd * MICRO), limit: Math.floor(config.daily_budget_usd * MICRO), expires_at: w.dayExpires, code: "budget_exceeded", name: "daily_budget_usd" });
  return plan;
}

/** Reserve all or nothing. Returns { ok:true, held } or { ok:false, code, name }. */
export async function reserveAll(store, plan, nowIso) {
  const held = [];
  for (const r of plan) {
    const ok = Number.isFinite(r.amount) && r.limit > 0 && r.amount <= r.limit && (await store.reserve({ ...r, now: nowIso }));
    if (!ok) {
      for (const h of held) await store.adjust(h.key, -h.amount).catch(() => {});
      return { ok: false, code: r.code, name: r.name };
    }
    held.push(r);
  }
  return { ok: true, held };
}

/** After the call: replace the worst-case spend reservation with the actual cost. */
export async function settleSpend(store, held, actualUsd) {
  const spend = held.find((h) => h.name === "daily_budget_usd");
  if (!spend) return;
  const actual = Math.ceil(Math.max(0, actualUsd) * MICRO);
  await store.adjust(spend.key, actual - spend.amount).catch(() => {});
}
