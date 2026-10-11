#!/usr/bin/env node
/**
 * Live D-06 eval (NEVER run in CI). Bounded spend via --max-usd.
 * Creates one synthetic household per corpus profile, then runs every corpus case.
 * Usage: npm run eval:d06:live -- --url <preview> --max-usd 0.05 --max-calls 6 --delay 1500
 *
 * Cost is summed from each response's metadata.estimated_cost_usd. That figure is
 * not a substitute for the ai_usage ledger; the script prints a reminder to check it.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

if (process.env.CI) {
  console.error("eval:d06:live refuses to run in CI");
  process.exit(2);
}

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    "max-usd": { type: "string", default: "0.05" },
    "max-calls": { type: "string" },
    delay: { type: "string", default: "1500" },
  },
});

const base = String(values.url || "").replace(/\/$/, "");
if (!base) {
  console.error("Missing --url");
  process.exit(2);
}
const cap = Number(values["max-usd"] || "0.05");
if (!Number.isFinite(cap) || cap < 0) {
  console.error("Invalid --max-usd");
  process.exit(2);
}
const maxCalls = values["max-calls"] == null || values["max-calls"] === "" ? null : Number(values["max-calls"]);
if (maxCalls != null && (!Number.isInteger(maxCalls) || maxCalls < 0)) {
  console.error("Invalid --max-calls");
  process.exit(2);
}
const delayMs = Number(values.delay ?? "1500");
if (!Number.isFinite(delayMs) || delayMs < 0) {
  console.error("Invalid --delay");
  process.exit(2);
}

import { memberIdForRun, newRunId, profileKeys } from "./eval-d06-households.mjs";

const corpus = JSON.parse(readFileSync(new URL("../test/fixtures/d06-intent-corpus.json", import.meta.url), "utf8"));
const runId = newRunId();

const RULE_KEY = {
  no_dairy: "dairy",
  no_shellfish: "shellfish",
  no_finfish: "fish",
  no_meat: "meat",
  no_nuts: "nuts",
  dairy: "dairy",
  shellfish: "shellfish",
  fish: "fish",
  meat: "meat",
  nuts: "nuts",
};

const SYNTH = {
  "content-type": "application/json",
  "x-flavorweave-data-origin": "synthetic",
};

async function api(path, { method = "GET", body, cookie } = {}) {
  const headers = { ...SYNTH };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
  const raw = setCookies.find((value) => value && value.includes("he_session=")) || "";
  const match = raw.match(/he_session=([^;]+)/);
  return { status: res.status, data, cookie: match ? `he_session=${decodeURIComponent(match[1])}` : cookie || null };
}

function costOf(data) {
  const meta = data?.metadata?.estimated_cost_usd;
  const direct = data?.estimated_cost_usd ?? data?.cost_usd;
  const n = Number(meta ?? direct ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function idsFor(key) {
  const spec = corpus.households[key];
  const map = new Map();
  for (const localId of spec?.members || []) map.set(localId, memberIdForRun(runId, key, localId));
  return map;
}

async function ensureHousehold(key) {
  const spec = corpus.households[key];
  if (!spec) throw new Error(`corpus household ${key} is not defined`);
  const ids = idsFor(key);
  const created = await api("/api/households", {
    method: "POST",
    body: { display_name: `D06 eval ${key} ${runId}`, data_origin: "synthetic", timezone: "America/Chicago", servings_default: spec.members.length },
  });
  if (!created.data?.household_id) throw new Error(`household create failed for ${key}: ${created.status} ${JSON.stringify(created.data)}`);
  const householdId = created.data.household_id;
  const [ownerLocal, ...rest] = spec.members;
  const ownerId = ids.get(ownerLocal);
  const ownerRes = await api(`/api/households/${householdId}/members`, {
    method: "POST",
    body: { member_id: ownerId, display_name: ownerLocal, role: "owner", data_origin: "synthetic" },
  });
  if (ownerRes.status >= 400) throw new Error(`owner create failed for ${key}: ${ownerRes.status} ${JSON.stringify(ownerRes.data)}`);
  const session = await api("/api/sessions", {
    method: "POST",
    body: { household_id: householdId, member_id: ownerId, data_origin: "synthetic" },
  });
  if (!session.cookie) throw new Error(`session cookie missing for ${key}: ${session.status} ${JSON.stringify(session.data)}`);
  let cookie = session.cookie;
  for (const localId of rest) {
    const memberId = ids.get(localId);
    const added = await api(`/api/households/${householdId}/members`, {
      method: "POST",
      cookie,
      body: { member_id: memberId, display_name: localId, role: "member", data_origin: "synthetic" },
    });
    if (added.status >= 400) throw new Error(`member ${memberId} failed: ${added.status} ${JSON.stringify(added.data)}`);
  }
  for (const [localId, limits] of Object.entries(spec.limits || {})) {
    const memberId = ids.get(localId);
    const keys = (limits || []).map((limit) => RULE_KEY[limit] || String(limit).replace(/^no_/, "")).filter(Boolean);
    if (!keys.length) continue;
    const saved = await api(`/api/members/${memberId}/constraints`, {
      method: "POST",
      cookie,
      body: { keys, replace: true, data_origin: "synthetic" },
    });
    if (saved.status >= 400) throw new Error(`constraints for ${memberId} failed: ${saved.status} ${JSON.stringify(saved.data)}`);
  }
  return { householdId, cookie };
}

const sessions = new Map();
let spent = 0;
let calls = 0;
let requests = 0;
const results = [];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const c of corpus.cases) {
  if (!c.text || !c.household) {
    console.error(`corpus case ${c.id} is missing text or household`);
    process.exit(1);
  }
}

for (const key of profileKeys(corpus)) {
  if (!sessions.has(key)) sessions.set(key, await ensureHousehold(key));
}

for (const c of corpus.cases) {
  if (spent >= cap) {
    results.push({ id: c.id, skipped: true, reason: "max_usd" });
    console.log(JSON.stringify({ id: c.id, skipped: true, reason: "max_usd", spent_usd: spent, cap_usd: cap }));
    continue;
  }
  if (maxCalls != null && calls >= maxCalls) {
    results.push({ id: c.id, skipped: true, reason: "max_calls" });
    console.log(JSON.stringify({ id: c.id, skipped: true, reason: "max_calls", calls, max_calls: maxCalls }));
    continue;
  }
  if (requests > 0 && delayMs > 0) await wait(delayMs);
  requests += 1;
  if (!sessions.has(c.household)) sessions.set(c.household, await ensureHousehold(c.household));
  const session = sessions.get(c.household);
  const path = c.task === "planning_intent" ? "/api/plan/interpret" : "/api/discovery/interpret";
  const body = {
    schema_version: 1,
    text: c.text,
    state: c.state ?? null,
    mode: c.task === "discovery_intent" ? "standalone" : undefined,
    timezone: "America/Chicago",
  };
  const res = await api(path, { method: "POST", cookie: session.cookie, body });
  if (res.data?.source === "provider") calls += 1;
  const rowCost = costOf(res.data);
  spent += rowCost;
  const row = {
    id: c.id,
    path,
    http: res.status,
    ok: res.data?.ok ?? false,
    source: res.data?.source ?? null,
    error: res.data?.error ?? null,
    fallback_code: res.data?.fallback_code ?? null,
    cost_usd: rowCost,
    spent_usd: spent,
  };
  results.push(row);
  console.log(JSON.stringify(row));
  if (spent >= cap) break;
}

console.log(JSON.stringify({ spent_usd: spent, cap_usd: cap, cases: results.length, households: [...sessions.keys()] }));
console.log("Reminder: spent_usd is summed from response metadata. Verify it against ai_usage.estimated_cost_usd for these households before treating the total as authoritative.");
process.exit(spent > cap ? 1 : 0);
