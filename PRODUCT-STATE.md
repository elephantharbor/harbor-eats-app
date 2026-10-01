# Harbor Eats — product state (alpha hardening)

**Repo layout:** `public/` (Pages UI), `functions/api` (Pages Functions → Worker handler), `src/index.js` (Worker API + asset fallback), `migrations/` (D1).

## Core flows (1–10 rating scale)

| Flow | Behavior |
|------|----------|
| New household | Welcome → name kitchen → members → hard constraints → optional taste → invite/skip → three choices |
| Meal loop | Select option → recipe detail → cook steps → dual 1–10 ratings → loop complete (CML when all active diners rated) |
| PLG share | `HE-SHARE-*` durable in D1; guest view via `?share=` |
| PLG invite | `HE-INV-*` durable; join via `?invite=` (does not bind owner session) |
| **Returning user** | Valid `he_session` cookie (D1 `member_session`) → restore household state → **not** Welcome / Get Started |

## Architecture

- **Edge:** Cloudflare Pages (`harbor-eats-app.pages.dev`) + Worker (`harbor-eats-app.elephantharbor.workers.dev`)
- **Data:** D1 `harbor-eats-db` — households, members, constraints, plans, selections, cooks, ratings, events, share/invite, **sessions (0003)**
- **Client:** Static `public/app.js` — same-origin `/api/*`, `credentials: include` for session cookies
- **Legacy:** `legacy/github-io/` — optional static mirror only (in-memory); not authoritative

## Environments

| Env | URL | Notes |
|-----|-----|-------|
| Local | `wrangler dev` :8787 | D1 `--local`; session cookies without `Secure` on HTTP |
| Alpha (persistent) | https://harbor-eats-app.pages.dev | D1 remote; apply migrations before deploy |
| Worker mirror | https://harbor-eats-app.elephantharbor.workers.dev | Same API + assets |

## Invariants

- Ratings **1–10** per diner; disagreement semantics unchanged (|Δ|≥4 or min≤4 and max≥8)
- Hard diet keys: dairy, meat, poultry, shellfish, nuts (cashew exception path in eligibility helper)
- No invented HH cook/rating metrics in docs or UI copy
- External recruitment **closed** — no stranger campaigns

## Session / identity (alpha)

- **Hypothesis (verified):** Returning users hit Welcome because boot always called `show("welcome")` with no server session.
- **Fix:** `POST /api/sessions`, `GET /api/sessions/me`, migration `0003_member_sessions.sql`, client restore + localStorage fallback for household/member re-bind.
- **Limitation:** API routes beyond session restore are still unauthenticated (household ID knowledge = write access). Alpha documented; not production auth.

## Known limitations

- Recommendation eligibility filter is implemented for API check + unit tests; client still uses fixed demo meals for options presentation.
- Taste sparks are client-only (not persisted to D1 in MVO).
- Single-plan-per-household “latest plan” heuristic for restore routing.

## Alpha readiness (honest)

| Area | Score (1–10) | Notes |
|------|----------------|-------|
| Persistence (D1) | 8 | Core write paths + share/invite durable |
| Returning session | 7 | Cookie + regression E2E; needs remote migration 0003 on deploy |
| CI / regression | 7 | Unit + Playwright on PR |
| AuthZ | 3 | Session identifies member; APIs mostly open |
| Deploy discipline | 6 | Docs + DEPLOYMENTS log; manual CF token |

**Overall alpha hardening candidate:** ~6–7 — suitable for controlled pilot after migration 0003 applied to live D1.
