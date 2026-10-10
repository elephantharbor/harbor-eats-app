# D-05 Decision Card — AI/LLM Gateway Foundation (ships invisibly)

**Boundary.** Deterministic systems decide; LLMs interpret, create and explain. LLMs are never authoritative for allergens, eligibility, membership, voting, servings, shopping math, version identity, plan constraints, taste scores or final eligibility. Plan, Find, Shop, Cook and Rate do not import `src/ai` (enforced by `test/d05-gateway.test.js`).

| Area | Decision | Where |
|---|---|---|
| Single path | `createGenerationService` is the only caller of provider adapters; `run()` never throws, returns output or `{error, fallback}` | `src/ai/gateway.js` |
| Task registry | 8 tasks with input/output schema, prompt version, allowed models, cost class, cache policy, limits, deterministic post-validator. Executable in foundation: `discovery_intent`, `explanation`; the rest are contracts | `src/ai/tasks.js` |
| Prompts | Versioned, source-controlled (`task@N`); bump the version on any change; no chain-of-thought requested | `src/ai/prompts.js` |
| Routing | Cost classes cheap/standard/creative → logical model aliases (`fast-small`, `balanced`, `strong`); cheap for extraction/classification, strong only for creative | `src/ai/routing.js` |
| Structured output | JSON schema validation + 1 bounded repair retry (retry on malformed/timeout/outage; not on 429) | `gateway.js`, `schema.js` |
| Post-validation | Discovery facets filtered to the caller's deterministic vocabulary; explanations reject allergen/eligibility claims; drafts typed `draft_unreviewed` | `tasks.js` |
| Accounting | `ai_usage` (task, prompt_version, provider, model, hashed household_key, status, in/out tokens, attempts, latency, estimated cost, usage metadata, created_at). No prompts, outputs or reasoning stored | `migrations/0014_ai_gateway.sql` |
| Cache | `ai_cache` keyed by sha256(task, prompt_version, model, normalized redacted input); TTL per task; creative tasks are not cached | `0014`, `store.js` |
| Limits | Per task: max_retries ≤1, max_output_tokens, timeout_ms, per-household/hour. Global: hourly ceiling, daily estimated-USD budget (default **0**, so no spend) | `tasks.js`, `config.js` |
| Flags | `AI_GATEWAY_ENABLED` global kill switch (default off), `AI_TASKS_ENABLED` per-task allowlist, `AI_PROVIDER` | `config.js` |
| Privacy | Redaction of email, phone, secrets, hh ids, URLs before prompt rendering; compact household context (diners, two soft prefs, recent count); salted household hash; minimal logs (task, code, attempts); secrets stay in the adapter, never sent to the client | `privacy.js` |
| Errors | timeout, rate_limited, malformed_output, provider_outage, disabled, budget_exceeded (+ invalid_input, unknown_task, provider_unconfigured) → caller's deterministic fallback | `errors.js` |
| D-06 seam | text → `run("discovery_intent")` → `intentToDiscoveryQuery` → existing D-07 `normalizeQuery`/pipeline. No new recommendation engine | `intent-adapter.js` |
| Health | `GET /api/ai/health`: version, flags, provider_configured, tasks; no provider call, no secrets | `health.js`, `src/index.js` |
| Providers | Adapter contract + deterministic fake. **No real adapter**: no credential is configured in either Pages project or the box | `providers/` |
| UI | None. No consumer AI surface in `public/` (test-enforced) | — |

**Open decision (Oversight):** choose the provider, the model bindings for the aliases, a credential (Cloudflare Pages secret per environment), and a daily budget. Until then the gateway stays off and fails closed (`provider_unconfigured` / `budget_exceeded`) with zero spend.
