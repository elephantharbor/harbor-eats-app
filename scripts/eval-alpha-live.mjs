#!/usr/bin/env node
/**
 * Live alpha eval. NEVER run in CI. Preview only unless --confirm-production.
 * Ten cases. Hard cap of 15 provider-source calls. Luna only (gpt-6-luna).
 *
 *   node scripts/eval-alpha-live.mjs \
 *     --url https://harbor-eats-cycle1-preview.pages.dev \
 *     --i-understand-this-costs-money
 *
 * Optional: --max-calls 15 (cannot exceed 15) --delay 1500
 * Counts a provider-source call from usage.provider_calls, else source "provider".
 * Adaptation advice and explanation both report that. Cache, template, and
 * deterministic refusals count as zero. Repair retries inside one response
 * still count as one observed call. The script stops at 15 provider calls.
 */
import { parseArgs } from "node:util";

const MAX_PROVIDER_CALLS = 15;

if (process.env.CI) {
  console.error("eval:alpha:live refuses to run in CI");
  process.exit(2);
}

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    "max-calls": { type: "string", default: String(MAX_PROVIDER_CALLS) },
    delay: { type: "string", default: "1500" },
    "i-understand-this-costs-money": { type: "boolean", default: false },
    "confirm-production": { type: "boolean", default: false },
  },
});

function die(message) {
  console.error(`eval:alpha:live: ${message}`);
  process.exit(2);
}

if (!values["i-understand-this-costs-money"]) {
  die("missing --i-understand-this-costs-money (this makes paid Luna calls)");
}
const base = String(values.url || "").replace(/\/$/, "");
if (!base) die("missing --url");
let target;
try {
  target = new URL(base);
} catch {
  die("invalid --url");
}
if (target.protocol !== "https:") die("--url must be https");
if (/harbor-eats-app\.pages\.dev$/i.test(target.hostname) && !values["confirm-production"]) {
  die(`${target.hostname} is production; add --confirm-production to proceed`);
}
const maxCalls = Number(values["max-calls"]);
if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > MAX_PROVIDER_CALLS) {
  die(`--max-calls must be an integer from 1 to ${MAX_PROVIDER_CALLS}`);
}
const delayMs = Number(values.delay ?? "1500");
if (!Number.isFinite(delayMs) || delayMs < 0) die("invalid --delay");

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

function assertLuna(health) {
  const tasks = health?.tasks || [];
  for (const id of ["recipe_adaptation", "explanation"]) {
    const task = tasks.find((row) => row.id === id);
    if (!task?.enabled) die(`${id} is not enabled on the target`);
    if (task.model !== "gpt-6-luna") die(`${id} model is ${task.model}; Luna only`);
    if (task.reasoning_effort !== "none") die(`${id} reasoning_effort is ${task.reasoning_effort}`);
  }
  const adapt = tasks.find((row) => row.id === "recipe_adaptation");
  const explain = tasks.find((row) => row.id === "explanation");
  if (adapt.max_output_tokens > 520) die(`recipe_adaptation cap ${adapt.max_output_tokens} exceeds 520`);
  if (explain.max_output_tokens > 300) die(`explanation cap ${explain.max_output_tokens} exceeds 300`);
  const banned = tasks.filter((row) => /sol|astra/i.test(String(row.model || "")) && (row.id === "recipe_adaptation" || row.id === "explanation"));
  if (banned.length) die(`non-Luna model on an alpha task: ${banned.map((row) => row.model).join(",")}`);
}

const health = await api("/api/ai/health");
if (!health.data?.ok) die(`ai health failed: ${health.status}`);
assertLuna(health.data);

async function ensureHousehold(label, limits) {
  const created = await api("/api/households", {
    method: "POST",
    body: {
      display_name: `[synthetic] alpha-eval ${label} ${Date.now()}`,
      data_origin: "synthetic",
      timezone: "America/Chicago",
      servings_default: 1,
    },
  });
  if (!created.data?.household_id) die(`household create failed: ${created.status} ${JSON.stringify(created.data)}`);
  const householdId = created.data.household_id;
  const ownerId = `m_${label}_${Date.now().toString(36)}`;
  const owner = await api(`/api/households/${householdId}/members`, {
    method: "POST",
    body: { member_id: ownerId, display_name: label, role: "owner", data_origin: "synthetic" },
  });
  if (owner.status >= 400) die(`owner create failed: ${owner.status} ${JSON.stringify(owner.data)}`);
  const session = await api("/api/sessions", {
    method: "POST",
    body: { household_id: householdId, member_id: ownerId, data_origin: "synthetic" },
  });
  if (!session.cookie) die(`session missing: ${session.status} ${JSON.stringify(session.data)}`);
  if (limits?.length) {
    const saved = await api(`/api/members/${ownerId}/constraints`, {
      method: "POST",
      cookie: session.cookie,
      body: { keys: limits, replace: true, data_origin: "synthetic" },
    });
    if (saved.status >= 400) die(`constraints failed: ${saved.status} ${JSON.stringify(saved.data)}`);
  }
  return { householdId, cookie: session.cookie, ownerId };
}

async function setPlanIntent(cookie, prefs) {
  const created = await api("/api/dinner-plans", {
    method: "POST",
    cookie,
    body: { meal_count: 1, entry_point: "plan_dinners", fill: "planner", data_origin: "synthetic" },
  });
  if (!created.data?.plan?.dinner_plan_id) die(`plan create failed: ${created.status} ${JSON.stringify(created.data)}`);
  const id = created.data.plan.dinner_plan_id;
  const saved = await api(`/api/dinner-plans/${id}/mutations`, {
    method: "POST",
    cookie,
    body: {
      op: "set_planning_preferences",
      keep_it_easy: prefs.keep_it_easy === true,
      keep_ingredients_simple: prefs.keep_ingredients_simple === true,
      data_origin: "synthetic",
    },
  });
  if (saved.status >= 400) die(`plan intent failed: ${saved.status} ${JSON.stringify(saved.data)}`);
  return id;
}

const open = await ensureHousehold("open", []);
const noNuts = await ensureHousehold("nonuts", ["nuts"]);

const CASES = [
  {
    id: "adapt-less-spicy",
    task: "recipe_adaptation",
    cookie: () => open.cookie,
    path: "/api/recipes/adapt",
    body: { text: "Make this less spicy.", recipe_slug: "crispy-chipotle-tofu-tacos" },
    pass: (data) => data?.ok === true && data.kind === "flavor" && !/\d/.test(data.acknowledgement || ""),
  },
  {
    id: "adapt-cilantro-parsley",
    task: "recipe_adaptation",
    cookie: () => open.cookie,
    path: "/api/recipes/adapt",
    body: { text: "Swap the cilantro for parsley.", recipe_slug: "miso-ginger-salmon" },
    pass: (data) => data?.support === "advice" && (data.ingredient_ops || data.override?.ops || []).some((op) => /parsley/i.test(op.to_name || "") && op.policy === "keep_scaled"),
  },
  {
    id: "adapt-simplify",
    task: "recipe_adaptation",
    cookie: () => open.cookie,
    path: "/api/recipes/adapt",
    body: { text: "Make this simpler.", recipe_slug: "coconut-chickpea-curry" },
    pass: (data) => data?.ok === true && (data.kind === "simplify" || (data.step_notes || []).length > 0 || data.support === "fallback"),
  },
  {
    id: "adapt-air-fryer",
    task: "recipe_adaptation",
    cookie: () => open.cookie,
    path: "/api/recipes/adapt",
    body: { text: "I want to use the air fryer.", recipe_slug: "air-fried-vegetable-spring-rolls" },
    pass: (data) => data?.ok === true && data.equipment_supported === true,
  },
  {
    id: "adapt-no-pressure-cooker",
    task: "recipe_adaptation",
    cookie: () => open.cookie,
    path: "/api/recipes/adapt",
    body: { text: "Make this without the pressure cooker.", recipe_slug: "pressure-cooker-butter-chicken" },
    pass: (data) => data?.support === "unsupported" && !/stovetop method/i.test(data.acknowledgement || ""),
  },
  {
    id: "adapt-cashew-peanut-no-nuts",
    task: "recipe_adaptation",
    cookie: () => noNuts.cookie,
    path: "/api/recipes/adapt",
    body: { text: "Swap the cashews for peanuts.", recipe_slug: "cashew-pesto-pasta" },
    pass: (data) => data?.support === "rejected_safety",
  },
  {
    id: "explain-strong-chips",
    task: "explanation",
    cookie: () => open.cookie,
    prepare: () => setPlanIntent(open.cookie, { keep_it_easy: true, keep_ingredients_simple: true }),
    path: "/api/explain",
    body: { recipe_slug: "miso-ginger-salmon" },
    pass: (data) => data?.ok === true && !/smoky/i.test(data.text || "") && !data.packet && (data.source === "provider" || data.source === "cache" || data.source === "fallback"),
  },
  {
    id: "explain-weak",
    task: "explanation",
    cookie: () => noNuts.cookie,
    path: "/api/explain",
    body: { recipe_slug: "pressure-cooker-butter-chicken", cache_bust: `weak-${Date.now()}` },
    pass: (data) => data?.source === "template" && !/you (tend|love)/i.test(data.text || ""),
  },
  {
    id: "explain-cold",
    task: "explanation",
    cookie: () => noNuts.cookie,
    path: "/api/explain",
    body: { recipe_slug: "pressure-cooker-butter-chicken" },
    pass: (data) => data?.ok === true && !/you (tend|love|enjoy)/i.test(data.text || "") && !/smoky/i.test(data.text || ""),
  },
  {
    id: "explain-keep-it-easy",
    task: "explanation",
    cookie: () => open.cookie,
    prepare: () => setPlanIntent(open.cookie, { keep_it_easy: true, keep_ingredients_simple: true }),
    path: "/api/explain",
    body: { recipe_slug: "pressure-cooker-butter-chicken", cache_bust: `easy-${Date.now()}` },
    pass: (data) =>
      data?.ok === true &&
      data.source !== "template" &&
      /easy/i.test(data.text || "") &&
      !/you (tend|love)/i.test(data.text || "") &&
      !/smoky/i.test(data.text || ""),
  },
];

if (CASES.length !== 10) die(`expected 10 cases, found ${CASES.length}`);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let calls = 0;
let requests = 0;
const results = [];

for (const item of CASES) {
  if (calls >= maxCalls) {
    const row = { id: item.id, skipped: true, reason: "max_calls", calls, max_calls: maxCalls };
    results.push(row);
    console.log(JSON.stringify(row));
    continue;
  }
  if (requests > 0 && delayMs > 0) await wait(delayMs);
  if (item.prepare) await item.prepare();
  requests += 1;
  const res = await api(item.path, { method: "POST", cookie: item.cookie(), body: item.body });
  const model = res.data?.model || res.data?.metadata?.requested_model || null;
  if (model && /sol|astra/i.test(String(model))) die(`case ${item.id} used ${model}; Luna only`);
  const reported = Number(res.data?.usage?.provider_calls);
  if (Number.isFinite(reported) && reported > 0) calls += reported;
  else if (res.data?.source === "provider") calls += 1;
  if (calls > MAX_PROVIDER_CALLS) die(`provider calls ${calls} exceeded ${MAX_PROVIDER_CALLS}`);
  const row = {
    id: item.id,
    task: item.task,
    http: res.status,
    ok: res.data?.ok ?? false,
    source: res.data?.source ?? res.data?.support ?? null,
    support: res.data?.support ?? null,
    kind: res.data?.kind ?? null,
    basis: res.data?.basis ?? null,
    pass: item.pass(res.data) && res.status < 500,
    calls,
  };
  results.push(row);
  console.log(JSON.stringify(row));
}

const failed = results.filter((row) => row.pass === false);
console.log(JSON.stringify({
  cases: results.length,
  provider_calls: calls,
  max_provider_calls: MAX_PROVIDER_CALLS,
  failed: failed.map((row) => row.id),
}));
console.log("Reminder: provider_calls counts usage.provider_calls, else source=provider, for adaptation and explanation. Verify ai_usage before treating that count as spend.");
process.exit(failed.length || calls > MAX_PROVIDER_CALLS ? 1 : 0);
