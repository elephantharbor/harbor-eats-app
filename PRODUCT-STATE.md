# Harbor Eats — product state (alpha hardening)

**Repo layout:** `public/` (Pages UI), `functions/api` (Pages Functions → Worker handler), `src/index.js` (Worker API + asset fallback), `migrations/` (D1).

## Core flows (1–10 rating scale)

| Flow | Behavior |
|------|----------|
| New household | Welcome → name kitchen → members → hard constraints → optional taste → invite/skip → three choices |
| Meal loop | Select option → recipe detail → cook steps → dual 1–10 ratings → loop complete (CML when all active diners rated) |
| PLG share | `HE-SHARE-*` durable in D1; guest view via `/share/{token}` (legacy `?share=`) |
| PLG invite | `HE-INV-*` durable; join via `/invite/{code}` (legacy `?invite=`) |
| **Returning user** | HttpOnly `he_session` → `GET /api/sessions/me` → server `deriveHouseholdState` → correct next view |
| **Recovery** | `POST /api/recovery/request` + one-time `/recover/{token}` → session cookie → `dest` preserved |

## Architecture

- **Edge:** Cloudflare Pages (`harbor-eats-app.pages.dev`) + Worker (`harbor-eats-app.elephantharbor.workers.dev`)
- **Data:** D1 `harbor-eats-db` — households, members, constraints, plans, selections, cooks, ratings, events, share/invite, sessions (**0003**), recovery + token hashing (**0004**)
- **Client:** Static `public/app.js` — same-origin `/api/*`, `credentials: include` (no localStorage session token)
- **Deep links:** See `docs/DEEP-LINKS.md`
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

## Session / identity (Phase 2)

- **Session:** Random token in HttpOnly cookie; **SHA-256 hash at rest** (`0004_auth_security.sql`); 90-day expiry; legacy plain rows still resolve until rotated.
- **AuthZ:** Protected reads/writes require valid session; `household_id` / `member_id` in body must match session (or omitted and derived). Cross-household → `403 forbidden_cross_household`.
- **Bootstrap:** First member on empty household or valid `invite_code` may join without session; all other mutations require session.
- **Recovery:** Passwordless magic-link architecture with `MAIL_TRANSPORT=dev|test` for CI; real email provider is coordinator-only.
- **Regression:** `e2e/specs/auth-boundary.spec.js` — permanent cross-household contract in CI.

## Known limitations

- Recommendation eligibility filter is implemented for API check + unit tests; client still uses fixed demo meals for options presentation.
- Taste sparks are client-only (not persisted to D1 in MVO).
- Single-plan-per-household “latest plan” heuristic for restore routing.

## Alpha readiness (honest)

| Area | Score (1–10) | Notes |
|------|----------------|-------|
| Persistence (D1) | 8 | Core write paths + share/invite durable |
| Returning session | 8 | Cookie + recovery + regression E2E; deploy needs migration **0004** on live D1 |
| CI / regression | 8 | Unit + Playwright incl. auth boundary |
| AuthZ | 7 | Server-enforced household boundary; invite/share resolve public by design |
| Deep links | 7 | Canonical paths + recover `dest`; rating path reserved |
| Deploy discipline | 6 | Docs + DEPLOYMENTS log; manual CF token |

**Overall alpha hardening candidate:** ~7 — suitable for external alpha after coordinator applies migration **0004** and smoke-tests auth boundary.
