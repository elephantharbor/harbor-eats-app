# Harbor Eats — Alpha Readiness (Phase 4 RC)

**Recruitment:** CLOSED — no external acquisition campaigns.

## Oversight checklist

| Area | Status | Evidence |
|------|--------|----------|
| No demo-anchored cook/detail | ✅ | Client loads `GET /api/recipes/:slug`; cook steps from `recipe_version_id` |
| Structured recommendations | ✅ | Candidate providers → pipeline → Taste Model v1 |
| Catalog breadth (≥20 meals) | ✅ | `catalogCoverageMetrics()` on `GET /api/health?metrics=alpha` |
| Recipe versioning | ✅ | `meal_concept` + `recipe_version` tables; ratings store `recipe_version_id` |
| HH001 eligibility | ✅ | `catalog-quality` CI + `eligibility.js` |
| 2–4 diners | ✅ | UI copy + votes + partial ratings |
| Selection / ties | ✅ | `selection-resolution.js` + `POST /api/plans/:id/votes` |
| Completed Meal Loop (CML) | ✅ | See PRODUCT-STATE.md |
| Funnel events | ✅ | Extended `GET /api/households/:id/funnel` |
| Ops metrics | ✅ | `GET /api/ops/alpha-metrics`, health alpha block |
| PWA | ✅ | manifest + network-first SW |
| Migrations | ✅ | Apply **0001–0007** on live D1 before deploy |

## Completed Meal Loop (North Star)

A **Completed Meal Loop** is recorded when:

1. A plan has a **cook** row for the selected `meal_option_id`, and  
2. **Every active member** has a **rating** (1–10) for that same `meal_option_id`, and  
3. Plan status transitions to **`Rated`** (server-side on last rating).

Partial ratings do **not** block other app usage; CML requires all active diners.

## Selection rules (default)

1. **Plurality / majority** of votes wins.  
2. **Tie** → highest Taste Model household score among tied options (`attributes_json.score`).  
3. **Still tied** → deterministic letter sort (A before B …).

Single-active-member households use direct `POST /api/selections`.

## Known stubs (non-critical)

- Cadence weekly/biweekly stored only — no scheduler.  
- D1 `recipe_version` table is schema-ready; authoritative content lives in `src/lib/recipe-store.js` until ops tooling imports versions.  
- Grocery, marketplace, LLM candidate sources — seams only (`candidate-providers.js`).

## Verification commands

```bash
npm run ci
npm run db:migrate:local   # includes 0007
curl -s 'http://127.0.0.1:8787/api/health?metrics=alpha' | jq .
```
