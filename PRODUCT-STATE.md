# Harbor Eats — product state (alpha hardening)

**Repo layout:** `public/` (Pages UI), `functions/api` (Pages Functions → Worker handler), `src/index.js` (Worker API + asset fallback), `migrations/` (D1).

## Core flows (1–10 rating scale)

| Flow | Behavior |
|------|----------|
| New household | Welcome → name kitchen → members → hard constraints → optional taste → invite/skip → live recommendations |
| Meal loop | Select option → recipe detail → cook steps → dual 1–10 ratings → loop complete (CML when all active diners rated) |
| PLG share | `HE-SHARE-*` durable in D1; guest view via `/share/{token}` (legacy `?share=`) |
| PLG invite | `HE-INV-*` durable; join via `/invite/{code}` → `POST /api/invites/join` → session → recommendations |
| **Returning user** | HttpOnly `he_session` → `GET /api/sessions/me` → server `deriveHouseholdState` → correct next view |
| **Recovery** | `POST /api/recovery/request` + one-time `/recover/{token}` → session cookie → `dest` preserved |
| **Household settings** | Post-onboarding: name, members, constraints, 3–5 picks, cadence (default on demand) via `PATCH /api/households/:id` |
| **Taste profile** | Human copy from evidence + ratings; corrections → `preference_evidence` |

## Architecture

- **Edge:** Cloudflare Pages (`harbor-eats-app.pages.dev`) + Worker (`harbor-eats-app.elephantharbor.workers.dev`)
- **Data:** D1 `harbor-eats-db` — households (**0005** settings columns), preference evidence, client errors, plans, ratings, events, share/invite, sessions (**0003–0006**)
- **Recommendations:** `POST /api/recommendations/plan` — Taste Model v1 (`src/lib/taste-model.js`) + catalog (`src/lib/meal-catalog.js`); eligibility from constraints
- **Client:** Static `public/app.js` — same-origin `/api/*`, `credentials: include`; network-first SW (`public/sw.js`)
- **Deep links:** See `docs/DEEP-LINKS.md`
- **Legacy:** `legacy/github-io/` — optional static mirror only; not authoritative

## Environments

| Env | URL | Notes |
|-----|-----|-------|
| Local | `wrangler dev` :8787 | D1 `--local`; apply migrations **0001–0006** |
| Alpha (persistent) | https://harbor-eats-app.pages.dev | D1 remote; apply migrations before deploy |
| Worker mirror | https://harbor-eats-app.elephantharbor.workers.dev | Same API + assets |

## Invariants

- Ratings **1–10** per diner; disagreement semantics unchanged (|Δ|≥4 or min≤4 and max≥8)
- Hard diet keys: dairy, meat, poultry, shellfish, nuts (cashew exception path in eligibility helper)
- No invented HH cook/rating metrics in docs or UI copy
- External recruitment **closed** — no stranger campaigns
- “Why” lines come from taste model factors or explicit low-evidence copy — no fabricated personalization

## Session / identity (Phase 2–3)

- **Session:** Random token in HttpOnly cookie; **SHA-256 hash at rest**; `POST /api/sessions` does **not** echo `session_token` in JSON (**0006** retires legacy plain token column values where hash exists).
- **AuthZ:** Protected reads/writes require valid session; cross-household → `403 forbidden_cross_household`.
- **Invite join:** `POST /api/invites/join` (public) — edge cases: expired/invalid, already member, wrong household logged in (`409`).
- **Observability:** `POST /api/client-errors`; `GET /api/health` includes `client_errors_24h` when D1 bound.

## Analytics (alpha funnel)

- Server-mirrored events in D1 `event` table: `household_created`, `onboarding_completed`, invite/share attribution, `plan_generated`, selection/cook/rating, `loop_completed`.
- `GET /api/households/:id/funnel` — counts + completed meal loops (no extra PII).

## Known limitations

- Recipe detail/cook steps still anchored on flagship taco demo content in UI; catalog drives **choice set** + why copy.
- Cadence weekly/biweekly stored only — scheduling automation not built.
- Single-plan-per-household “latest plan” heuristic for restore routing.

## Alpha readiness (honest)

| Area | Score (1–10) | Notes |
|------|----------------|-------|
| Persistence (D1) | 8 | Core paths + settings + evidence |
| Invite → join PLG | 8 | API + UI + E2E |
| Taste model in prod path | 7 | Deterministic v1; transparent why |
| Household settings | 7 | PATCH + UI; constraint changes affect next plan |
| CI / regression | 8 | Unit + Playwright incl. invite join |
| AuthZ | 7 | Phase 2 boundary preserved |
| PWA | 6 | Manifest + SW network-first; no offline requirement |

**Overall alpha hardening (Phase 3):** ~7–8 — suitable for household validation after coordinator applies migrations **0005–0006** on live D1.
