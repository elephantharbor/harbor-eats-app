# Harbor Eats — product state (alpha hardening)

**Repo layout:** `public/` (Pages UI), `functions/api` (Pages Functions → Worker handler), `src/index.js` (Worker API + asset fallback), `migrations/` (D1).

## Core flows (1–10 rating scale)

| Flow | Behavior |
|------|----------|
| New household | Welcome → name kitchen → members (2–4) → hard constraints → optional taste → invite/skip → live recommendations |
| Meal loop | Vote/select option → recipe detail (API) → cook steps → individual 1–10 ratings → CML when all active diners rated |
| PLG share | `HE-SHARE-*` durable in D1; guest view via `/share/{token}` (legacy `?share=`) |
| PLG invite | `HE-INV-*` durable; join via `/invite/{code}` → `POST /api/invites/join` → session → recommendations |
| **Returning user** | HttpOnly `he_session` → `GET /api/sessions/me` → server `deriveHouseholdState` → correct next view |
| **Recovery** | `POST /api/recovery/request` + one-time `/recover/{token}` → session cookie → `dest` preserved |
| **Household settings** | Post-onboarding: name, members, constraints, 3–5 picks, cadence (default on demand) via `PATCH /api/households/:id` |
| **Taste profile** | Human copy from evidence + ratings; corrections → `preference_evidence` |

## Architecture

- **Edge:** Cloudflare Pages (`harbor-eats-app.pages.dev`) — authoritative consumer surface. Legacy `*.workers.dev` mirror retired (see `docs/DEPLOYMENT.md`).
- **Data:** D1 `harbor-eats-db` — households (**0005** settings), preference evidence, client errors, plans, ratings (**0007** `recipe_version_id`), votes, events, share/invite, sessions (**0003–0007**)
- **Recommendations:** `POST /api/recommendations/plan` — pipeline (`candidate-providers` → eligibility → Taste Model → diversity) + catalog (`recipe-store` / `meal-catalog`)
- **Recipes:** `GET /api/recipes/:slug`, `GET /api/recipes/version/:id` — structured ingredients + steps; client cook/detail bind to selected `meal_option`
- **Selection (2–4):** `POST /api/plans/:plan_id/votes` with auto-resolve when all active members voted
- **Client:** Static `public/app.js` — same-origin `/api/*`, `credentials: include`; network-first SW (`public/sw.js`)
- **Deep links:** See `docs/DEEP-LINKS.md`
- **Legacy:** `legacy/github-io/` — optional static mirror only; not authoritative

## Environments

| Env | URL | Notes |
|-----|-----|-------|
| Local | `wrangler dev` :8787 | D1 `--local`; apply migrations **0001–0007** |
| Alpha (persistent) | https://harbor-eats-app.pages.dev | D1 remote; apply migrations before deploy |
| Worker mirror | https://harbor-eats-app.elephantharbor.workers.dev | **Retired** — returns `410`; use Pages |

## Completed Meal Loop (CML)

**Rule:** `cook` recorded for the selected meal **and** every **active** member has a `rating` for that `meal_option_id` → plan status **`Rated`**.  
Partial ratings (`rating_state`: `partial`) do not complete the loop and do not block other flows.

## Selection / ties

Documented in `docs/ALPHA-READINESS.md`: plurality → Taste score tie-break → letter tie-break.

## Invariants

- Ratings **1–10** per diner; disagreement semantics unchanged (|Δ|≥4 or min≤4 and max≥8)
- Hard diet keys: dairy, meat, poultry, shellfish, nuts (cashew/peanut exception paths in eligibility helper)
- No invented HH cook/rating metrics in docs or UI copy
- External recruitment **closed** — no stranger campaigns
- “Why” lines come from taste model factors or explicit low-evidence copy — no fabricated personalization

## Session / identity (Phase 2–4)

- **Session:** Random token in HttpOnly cookie; **SHA-256 hash at rest**; `POST /api/sessions` does **not** echo `session_token` in JSON (**0006**).
- **AuthZ:** Protected reads/writes require valid session; cross-household → `403 forbidden_cross_household`.
- **Invite join:** `POST /api/invites/join` (public) — edge cases: expired/invalid, already member, wrong household logged in (`409`).
- **Observability:** `POST /api/client-errors`; `GET /api/health` includes `client_errors_24h`, `catalog_coverage`, optional `?metrics=alpha`; `GET /api/ops/alpha-metrics` (authenticated).

## Analytics (alpha funnel)

- Server-mirrored events in D1 `event` table: household lifecycle, invite/share attribution, `plan_generated`, `meal_vote_recorded`, `selection_resolved`, `recipe_opened`, cook/rating, `loop_completed`.
- `GET /api/households/:id/funnel` — counts + completed meal loops (no extra PII).

## Household size

- **2–4 active diners** supported in onboarding, voting, ratings, copy, and Taste aggregation context (`active_member_count`).

## Known limitations

- Cadence weekly/biweekly stored only — scheduling automation not built.
- Recipe content authoritative in code catalog until imported into D1 `recipe_version` rows.
- Single-plan-per-household “latest plan” heuristic for restore routing.

## Alpha readiness (Phase 4 RC)

| Area | Score (1–10) | Notes |
|------|----------------|-------|
| Persistence (D1) | 8 | Core paths + settings + evidence + votes |
| Recipe ↔ rating integrity | 8 | `recipe_version_id` on ratings |
| Invite → join PLG | 8 | API + UI + E2E |
| Taste model in prod path | 8 | Pipeline + transparent why |
| Catalog / quality gates | 8 | CI catalog-quality tests |
| Household settings | 7 | PATCH + UI |
| CI / regression | 9 | Unit + Playwright |
| AuthZ | 7 | Phase 2 boundary preserved |
| PWA | 7 | Manifest + SW network-first |

**Overall alpha hardening (Phase 4):** ~8 — closed-alpha RC after migrations **0007** on live D1. See `docs/ALPHA-READINESS.md`.
