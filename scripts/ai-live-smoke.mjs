#!/usr/bin/env node
/**
 * MANUAL, PAID D-05 live smoke. NEVER run in CI (refuses when CI is set; not wired into npm scripts).
 * Sends exactly ONE request to the token-gated internal endpoint, which runs ONE tiny
 * `explanation` task on gpt-6-luna (max 120 output tokens, ~$0.0001) through the normal gateway.
 *
 *   AI_SMOKE_TOKEN=<smoke token> node scripts/ai-live-smoke.mjs \
 *     --url https://harbor-eats-cycle1-preview.pages.dev --i-understand-this-costs-money [--nonce abc]
 *
 * Production hosts additionally require --confirm-production. This script never sees the OpenAI key.
 */
import { PROD_HOST_PATTERNS } from "./deploy/environments.mjs";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const die = (m) => { console.error(`ai-live-smoke: ${m}`); process.exit(2); };

if (process.env.CI) die("refusing to run in CI");
if (!flag("--i-understand-this-costs-money")) die("missing --i-understand-this-costs-money (this makes ONE paid OpenAI call)");
const target = opt("--url");
if (!target) die("missing --url <https://host>");
let url;
try { url = new URL(target); } catch { die("invalid --url"); }
if (url.protocol !== "https:") die("--url must be https");
if (PROD_HOST_PATTERNS.some((re) => re.test(url.hostname)) && !flag("--confirm-production")) die(`${url.hostname} is PRODUCTION; add --confirm-production to proceed`);
const token = process.env.AI_SMOKE_TOKEN;
if (!token) die("set AI_SMOKE_TOKEN in the environment (the smoke-endpoint token, NOT the OpenAI key)");

const health = await (await fetch(new URL("/api/ai/health", url))).json();
const expl = (health.tasks || []).find((t) => t.id === "explanation");
console.log(JSON.stringify({ provider: health.provider, key_present: health.openai_key_present, gateway_enabled: health.gateway_enabled, explanation: expl, pricing_version: health.pricing_version, budget: health.daily_budget_usd }));
if (!health.openai_key_present || !health.provider_configured) die("provider not configured on target (set the OPENAI_API_KEY secret and redeploy)");
if (!health.gateway_enabled || !expl?.enabled) die("gateway or explanation task not enabled on target");
if (expl.model !== "gpt-6-luna" || expl.max_output_tokens > 120) die(`unexpected routing ${expl.model}/${expl.max_output_tokens}; refusing`);

const smokeUrl = new URL("/api/ai/internal/smoke", url);
const nonce = opt("--nonce");
if (nonce) smokeUrl.searchParams.set("nonce", nonce);
const res = await fetch(smokeUrl, { method: "POST", headers: { "x-ai-smoke-token": token } });
const body = await res.json().catch(() => null);
console.log(JSON.stringify({ status: res.status, body }));
process.exit(res.status === 200 && body?.ok ? 0 : 1);
