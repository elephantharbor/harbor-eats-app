# FlavorWeave Alpha — Accepted State (HOLD)

**Oversight accepted** the FlavorWeave Alpha Readiness release on **2026-10-12** and placed Harbor Eats on **HOLD**.

## Accepted release
- `main` `0786a1d` (PR #57; runtime PR #56 → `e41c942`)
- Production Pages deploy `8dbf56b6` (2026-10-11 ~9:15 PM CT), D1 `23aa3db3-1090-471b-8c8a-b6fe71f5c053`, migration `0016_alpha_diner_adaptation`
- Service worker `fw-sw-v61`; catalog 85 meals
- Handoff: [`HANDOFF.md`](HANDOFF.md). Retro: [`PREVIEW-RETRO.md`](PREVIEW-RETRO.md).

## AI config and budgets (preserved, unchanged)
Copied verbatim from the `[vars]` AI block at `0786a1d`. These values are frozen for the HOLD; this document changes nothing.

### Production — `deploy/pages/production/wrangler.toml`
```toml
# D-05 AI gateway (non-secret). OPENAI_API_KEY is a Pages SECRET, never in this file.
# planning_intent and discovery_intent enabled 2026-10-10.
# recipe_adaptation and explanation enabled for alpha readiness (Luna, per-task caps).
AI_PROVIDER = "openai"
AI_GATEWAY_ENABLED = "1"
AI_TASKS_ENABLED = "planning_intent,discovery_intent,recipe_adaptation,explanation"
AI_DAILY_BUDGET_USD = "1.00"
AI_GLOBAL_PER_DAY = "100"
AI_HOUSEHOLD_PER_MINUTE = "5"
AI_HOUSEHOLD_PER_DAY = "30"
AI_SOL_HOUSEHOLD_PER_DAY = "5"
```

### Preview — `deploy/pages/preview/wrangler.toml`
```toml
# D-05 AI gateway (non-secret). OPENAI_API_KEY is a Pages SECRET, never in this file.
# Gateway stays OFF until the key is set and the preview smoke passes: see docs/D05-DECISION-CARD.md.
AI_PROVIDER = "openai"
AI_GATEWAY_ENABLED = "1"
AI_TASKS_ENABLED = "planning_intent,discovery_intent,recipe_adaptation,explanation"
AI_DAILY_BUDGET_USD = "0.25"
AI_GLOBAL_PER_DAY = "250"
AI_HOUSEHOLD_PER_MINUTE = "5"
AI_HOUSEHOLD_PER_DAY = "30"
AI_SOL_HOUSEHOLD_PER_DAY = "5"
```

## HOLD terms
- No feature expansion, no catalog expansion, no AI expansion (tasks, models, caps or budgets).
- No deploys (Preview or Production) until Oversight returns with real-use evidence.
- Evidence target: **at least 3 genuine Plan → Shop → Cook → Rate loops by Tom and Renata**, cooked in a real kitchen. Never simulated; synthetic or scripted households do not count. Report the count honestly, including zero.

## Deferred (not to be fixed during HOLD)
- Decimal shop amounts like `0.188 tsp`
- "Hard limits" wording on the How-it-works screen
- "Back to your plan" goes to Tonight
- "For 3" as its own control
- Find-origin swap Escape edge
- Multi-dinner shop eyebrow picker
- Pending `dedupe-classification-history` cleanup

