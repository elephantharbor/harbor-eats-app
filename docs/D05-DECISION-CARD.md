# D-05 Decision Card — AI/LLM Gateway Foundation (ships invisibly)

**Boundary.** Deterministic systems decide; LLMs interpret, create and explain. LLMs are never authoritative for allergens, eligibility, membership, voting, servings, shopping math, version identity, plan constraints, taste scores or final eligibility. Plan, Find, Shop, Cook and Rate do not import `src/ai` (enforced by `test/d05-gateway.test.js`).

| Area | Decision | Where |
|---|---|---|
| Single path | `createGenerationService` is the only caller of provider adapters; `run()` never throws, returns output or `{error, fallback}` | `src/ai/gateway.js` |
| Task registry | 8 tasks with input/output schema, prompt version, allowed models, cost class, cache policy, limits, deterministic post-validator. Executable in foundation: `discovery_intent`, `explanation`; the rest are contracts | `src/ai/tasks.js` |
| Prompts | Versioned, source-controlled (`task@N`); bump the version on any change; no chain-of-thought requested | `src/ai/prompts.js` |
| Routing | Cost classes cheap/standard/creative → aliases; **`fast-small` and `balanced` → `gpt-6-luna`, `strong` → `gpt-6.1-sol`**. Selection by task class only; the gateway uses `models[0]` and **never escalates** on failure. **Denylist: `gpt-6-astra`** rejected at config load (routing table validated at module load; any `AI_*` var naming it disables the gateway; preflight fails) and at call time (gateway + adapter) | `src/ai/routing.js`, `config.js` |
| Structured output | OpenAI Structured Outputs (`text.format` json_schema, `strict:true`, built from the task output schema; optionals sent as nullable and stripped back) + local schema validation + **max 1 repair retry** on the same model (malformed/timeout/outage; not on 429, refusal or incomplete) | `providers/openai.js`, `gateway.js` |
| Post-validation | Discovery facets filtered to the caller's deterministic vocabulary; explanations reject allergen/eligibility claims; drafts typed `draft_unreviewed` | `tasks.js` |
| Accounting | `ai_usage` (task, prompt_version, provider, concrete model, hashed household_key, status, input/cached-input/output tokens, attempts, latency, cost, **pricing_version**, usage metadata, created_at). Provider-reported usage is authoritative (also recorded on refusal/incomplete). No prompts, outputs or reasoning stored | `0014`, `0015_ai_provider_limits.sql` |
| Cache | `ai_cache` keyed by sha256(task, prompt_version, model, normalized redacted input); TTL per task; creative tasks are not cached | `0014`, `store.js` |
| Pricing | `PRICING_VERSION = openai-standard-2026-10-10`, USD/1M tokens: Luna in 0.10 / cached 0.01 / cache-write 0.125 / out 0.50; Sol in 2.00 / cached 0.10 / cache-write 2.50 / out 10.00. Cost = uncached in + cached in + out (+ cache writes if reported) | `src/ai/pricing.js` |
| Limits (one limiter) | Household/UTC-minute (5), household/UTC-day across all tasks (30), global/UTC-day (50 preview / 100 prod), Sol/household/day (5), daily budget USD (worst case at real model prices × attempts, reserved up front then settled to actual). Atomic conditional increments on `ai_limit_counters`; all-or-nothing with release. The old hour-only system (`AI_GLOBAL_PER_HOUR`, per-task per-hour) is removed and preflight rejects it. Output: min(task cap, model ceiling Luna 600 / Sol 1500); task caps (120/250/400/…) unchanged | `limits.js`, `store.js`, `config.js`, `pricing.js` |
| Flags | `AI_GATEWAY_ENABLED` kill switch (committed **"0"** in both envs), `AI_TASKS_ENABLED` (committed empty), `AI_PROVIDER=openai`, `AI_DAILY_BUDGET_USD` (0.25 / 1.00), `AI_GLOBAL_PER_DAY`, `AI_HOUSEHOLD_PER_MINUTE`, `AI_HOUSEHOLD_PER_DAY`, `AI_SOL_HOUSEHOLD_PER_DAY`. Preflight/deploy guard requires all, rejects astra, retired vars and secrets in config | `config.js`, `deploy/pages/*/wrangler.toml`, `scripts/deploy/environments.mjs` |
| Privacy | Redaction of email, phone, secrets, hh ids, URLs before prompt rendering; compact household context (diners, two soft prefs, recent count); salted household hash; minimal logs (task, code, attempts); secrets stay in the adapter, never sent to the client | `privacy.js` |
| Errors | timeout, rate_limited, malformed_output, provider_outage, disabled, budget_exceeded (+ invalid_input, unknown_task, provider_unconfigured) → caller's deterministic fallback | `errors.js` |
| D-06 seam | text → `run("discovery_intent")` → `intentToDiscoveryQuery` → existing D-07 `normalizeQuery`/pipeline. No new recommendation engine | `intent-adapter.js` |
| Health | `GET /api/ai/health`: provider, `openai_key_present` (boolean), models/denylist/ceilings, limits, budget, pricing version, per-task model + effective cap; no provider call, no secrets | `health.js`, `src/index.js` |
| Live smoke | `POST /api/ai/internal/smoke`: 404 unless the `AI_SMOKE_TOKEN` secret is set; header token required; one fixed Luna `explanation` through the normal gateway (all gates apply). Driver `scripts/ai-live-smoke.mjs` needs `--i-understand-this-costs-money` + `--url`, refuses CI, refuses prod without `--confirm-production`; not in npm scripts or CI | `smoke.js`, `scripts/ai-live-smoke.mjs` |
| Providers | Contract, deterministic fake, and **OpenAI adapter** (`POST https://api.openai.com/v1/responses`, Bearer `OPENAI_API_KEY` read only in the adapter, no org/project header, AbortController timeout, 429→rate_limited, 5xx/4xx/network→provider_outage, refusal/incomplete→malformed_output). Selected only when `AI_PROVIDER=openai` and the key secret is present | `providers/`, `index.js` |
| UI | None. No consumer AI surface in `public/` (test-enforced) | — |

**Status (2026-10-10): Oversight-approved provider completion implemented.** Provider OpenAI; Luna for fast-small/balanced, Sol for strong; Astra banned. Shipped **OFF**: no key is configured and `AI_GATEWAY_ENABLED="0"` in both envs, so nothing calls OpenAI. CI uses only the fake provider and mocked fetch.

**Turning it on (per environment, preview first):**
1. Apply migration `0015_ai_provider_limits.sql` to that env's D1 (`wrangler d1 migrations apply <db> --remote --config deploy/pages/<env>/wrangler.toml`).
2. Set the secret: `wrangler pages secret put OPENAI_API_KEY --project-name <project>` (or Dashboard → Workers & Pages → project → Settings → Variables and Secrets → Production environment → Add → type *Secret*). Never commit it.
3. In `deploy/pages/<env>/wrangler.toml` set `AI_GATEWAY_ENABLED = "1"` and `AI_TASKS_ENABLED = "explanation"` (first; add `discovery_intent` later — the two executable tasks). Commit, PR, CI green, deploy that env with the guarded deploy script.
4. Check `GET /api/ai/health`: `openai_key_present:true`, `gateway_enabled:true`, `pricing_version`, limits.
5. Kill switch: set `AI_GATEWAY_ENABLED = "0"` and redeploy, or delete the secret (falls back to `provider_unconfigured`).

**Still open:** consumer wiring (D-06) is out of scope; no AI is wired into Plan/Find/Shop/Cook/Rate.
