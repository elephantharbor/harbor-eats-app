# FlavorWeave alpha remediation campaign

Long-lived integration branch: `feature/flavorweave-alpha-remediation`.
Cycle 1 child branch: `feature/fw-c1-identity-metadata`.
Production `main` is not a campaign base. This cycle does not merge to `main`, does not deploy Pages or Workers, and does not apply migrations to production D1.

**Session model:** Grok 4.7 (`grok-4.7`).

**Migration this cycle:** `migrations/0008_evidence_origin.sql` is committed for isolated dev/test databases only. It was **not** applied to production D1. FW-01 and FW-02 do not add a migration.

**Preview validation:** not run. No preview was deployed to Cloudflare Pages or Worker URLs.

**Implementing SHA:** `__FOUNDATION_SHA__` (commit that introduces the FW-01, FW-02, and evidence-isolation code on the child branch).

## Tracking

| ID | Title | Status | Branch / PR | Implementing SHA | Tests added | Preview validation | Model(s) | Unresolved risk | Dependencies |
|----|-------|--------|-------------|------------------|-------------|--------------------|----------|-----------------|--------------|
| FW-01 | Meal/rating identity (P0 release blocker) | Fixed | `feature/fw-c1-identity-metadata` → `feature/flavorweave-alpha-remediation` | `__FOUNDATION_SHA__` | `test/meal-identity.test.js`; `test/household-state.test.js` (Rated survives a status rewrite) | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) | Client and server reducers are duplicated; parity test covers inspect / cook / exit only. FW-10 recipe nav/select UX stays open. | None. Root cause: `docs/FW-01-ROOT-CAUSE.md`. |
| FW-02 | Restored recommendation metadata loss | Fixed | `feature/fw-c1-identity-metadata` → `feature/flavorweave-alpha-remediation` | `__FOUNDATION_SHA__` | `test/meal-option-view.test.js` (fresh, restored row, lossy share) | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) | Catalog hydration uses prep+cook minutes when a share dropped `minutes` (miso-ginger-salmon is 22, not the display chip “35 min”). | FW-01 read path now returns projected options. |
| EVIDENCE-INTEGRITY | Synthetic QA evidence isolation | Fixed (forward) | `feature/fw-c1-identity-metadata` → `feature/flavorweave-alpha-remediation` | `__FOUNDATION_SHA__` | `test/evidence-origin.test.js` | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) | October 1 production rows are untagged. Applying 0008 later defaults them to `household`, so they would still count until a reviewed quarantine. This cycle does not query, backfill, or migrate production D1. | Migration `0008` on any non-production database that runs this code. |
| FW-03 | Catalog completeness | Open / Not Yet Implemented | — | — | — | — | — | — | — |
| FW-04 | Serving audit | Open / Not Yet Implemented | — | — | — | — | — | — | — |
| FW-05 | Invite navigation | Open / Not Yet Implemented | — | — | — | — | — | — | — |
| FW-06 | Dietary copy | Open / Not Yet Implemented | — | — | — | — | — | — | — |
| FW-07 | Next-dinner CTA | Open / Not Yet Implemented | — | — | — | — | — | — | — |
| FW-08 | Images | Open / Not Yet Implemented | — | — | — | — | — | — | — |
| FW-09 | Explanation copy | Open / Not Yet Implemented | — | — | — | — | — | — | — |
| FW-10 | Recipe nav/select | Open / Not Yet Implemented | — | — | — | — | — | FW-01 stops view-from-selecting and locks outcomes. It does not close the broader recipe navigation item. | FW-01 |
| D-01 | Multi-dinner planning | Approved / Not Yet Implemented | — | — | — | — | — | Title source: campaign prompt, not a repo design doc. No Oversight spec names D-01. | — |
| D-02 | Taste-vocabulary / dietary model expansion | Approved / Not Yet Implemented | — | — | — | — | — | Title source: campaign prompt, not a repo design doc. HH001 eligibility rules were not changed. | — |
| D-03 | Catalog expansion workflow | Approved / Not Yet Implemented | — | — | — | — | — | Title source: campaign prompt, not a repo design doc. | — |
| D-04 | Native-feeling Back | Approved / Not Yet Implemented | — | — | — | — | — | Title source: campaign prompt, not a repo design doc. | — |
| D-05 | Approved design (title not in repo yet) | Approved / Not Yet Implemented | — | — | — | — | — | No Oversight design doc in the repo. Title not invented. | — |
| D-06 | Approved design (title not in repo yet) | Approved / Not Yet Implemented | — | — | — | — | — | No Oversight design doc in the repo. Title not invented. | — |
| GATE-OPUS-55 | Final Opus 5.5 integrated review | Not Started | — | — | — | — | Opus 5.5 (required later) | Mandatory campaign gate before any production release of this remediation. | FW-01, FW-02, EVIDENCE-INTEGRITY, and remaining FW items as scoped later. |

## FW-01 (fixed)

Root cause, in short: viewing another recipe was implemented as selecting it. That rewrote which meal was selected and reset the plan to `Selected`. History and Home then attached the earlier rating to whichever meal was last selected, because ratings were stored per person for the whole plan rather than per meal instance and recipe version.

Opening a recipe now only previews it. Choosing a dinner is a separate explicit action. After a meal is cooked or rated, the server refuses to move that outcome. Cook mode for an unselected meal does not select or complete it. Reload reads the cooked or rated meal, not the last inspected one.

Full write-up: `docs/FW-01-ROOT-CAUSE.md`.

## FW-02 (fixed)

Fresh cards already had time, effort, and meal style. Restored, shared, and reloaded plans lost them: session restore returned raw rows whose chips lived only inside `attributes_json`, share creation overwrote that JSON with a lossy snapshot, and the client defaulted missing chips to `Shared` / `Shared pick`.

Canonical fields now survive generation, persistence, API retrieval, reload, session restore, share view, and navigation. `projectMealOption` reads stored attributes and fills gaps from the catalog via `recipe_slug`. `mergeCanonicalAttributes` fills missing keys only and will not replace chips or the personalization label with Shared. Share reads live `meal_option` rows first and uses a snapshot only as fallback. Display-only copies are not stored when the option or catalog row can supply the fields.

## EVIDENCE-INTEGRITY (fixed forward)

There was no reliable split between Household 001 learning and QA. `?qa=1` / `localStorage he_qa=1` only toggled debug chrome. Alpha metrics, funnel, taste, and history counted every row. HH001 is a diet profile, not a hardcoded `household_id`. October 1 production smoke wrote ordinary app rows with no origin tag. Those rows cannot be identified from the repository, and this cycle does not read or modify production D1.

Forward mechanism:

- `data_origin` is `household` (real) or `synthetic` on household, plan, selection, cook, rating, preference_evidence, event, and meal_vote (`migrations/0008_evidence_origin.sql`).
- A household is synthetic when `data_origin = synthetic` or `acquisition_source` is one of `synthetic_qa`, `qa`, `e2e`, `smoke`, `test`. Synthetic household creation stores `acquisition_source = synthetic_qa`.
- Clients in QA mode send `X-FlavorWeave-Data-Origin: synthetic` on POST and PATCH. `data_origin: synthetic` in the JSON body is also honored.
- Synthetic rows are stored and then excluded from taste evidence, history shown to a real household, Completed Meal Loop counts, funnel traction, and alpha ops (`sqlRealHousehold` / `sqlRealRow` / `learningRows` / `productRows`).
- A synthetic request does not overwrite an existing real rating or real vote.
- A fully synthetic household can still see its own session history. Its rows do not feed shared learning.

Real Household 001 learning is unchanged by campaign QA that uses this marker. Pre-marker October 1 rows stay an unresolved production-data risk until a separate, reviewed quarantine. Do not apply 0008 to production as part of cycle 1.

## Out of scope this cycle

FW-03 through FW-10 implementation, D-01 through D-06 implementation, production deploy, production D1 migrations, and any change to HH001 hard eligibility (no dairy, no shellfish, no meat other than fish, no poultry; nuts prohibited except cashews).
