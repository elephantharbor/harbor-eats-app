# FlavorWeave alpha remediation campaign

Long-lived integration branch: `feature/flavorweave-alpha-remediation`.
Cycle 1 children, merged in order:

1. `feature/fw-c1-identity-metadata` (already on this branch at `cda0dc75`)
2. `feature/fw-c1-catalog` at `2303898dbc2f9439d4f39fe0e682b69489f48949`
3. `feature/fw-c1-ux` at `8b3e2f793a5e39837720306063d2b02c11fbaf38`

Pull request: not opened. `ManagePullRequest` refused because the branch does not start with `cursor/`. The integration stays on `feature/flavorweave-alpha-remediation` and was not retargeted to `main`.
Production `main` is not a campaign base. This cycle does not merge to `main`, does not deploy Pages or Workers, and does not apply migrations to any D1 database.

**Integration SHA:** `acdb92f3794a70adcd89c1c15e73d2670544502b`
That commit holds the merged tree, the walnut tags, and `fw-sw-v6`. Later commits only write this SHA into the docs and record that no pull request was opened. Product code matches this commit.
**Integration model:** Grok 4.7 (`grok-4.7`).
Detail: `docs/CYCLE1-INTEGRATION.md`.

**Migration:** `migrations/0008_evidence_origin.sql` is committed. It was **not** applied to production D1, and it was not applied to any other D1 database in this integration. FW-01 and FW-02 do not add a migration.

**Preview validation:** not run. No preview was deployed to Cloudflare Pages or Worker URLs.

## Tracking

| ID | Title | Status | Branch / PR | Implementing SHA | Tests added | Preview validation | Model(s) | Unresolved risk | Dependencies |
|----|-------|--------|-------------|------------------|-------------|--------------------|----------|-----------------|--------------|
| FW-01 | Meal/rating identity (P0 release blocker) | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-identity-metadata`, prior integration `cda0dc75`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/meal-identity.test.js`; `test/household-state.test.js` (Rated survives a status rewrite) | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) on the child and on this integration | Client and server reducers are duplicated; parity covers inspect / cook / exit. | None. Root cause: `docs/FW-01-ROOT-CAUSE.md`. |
| FW-02 | Restored recommendation metadata loss | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-identity-metadata`, prior integration `cda0dc75`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/meal-option-view.test.js` (fresh, restored row, lossy share) | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) on the child and on this integration | Catalog hydration uses prep+cook minutes when a share dropped `minutes` (miso-ginger-salmon is 22, not the display chip “35 min”). | FW-01 read path returns projected options. |
| EVIDENCE-INTEGRITY | Synthetic QA evidence isolation | Resolved | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-identity-metadata`, prior integration `cda0dc75`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/evidence-origin.test.js` | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) on the child and on this integration | October 1 production rows are untagged. 0008's default would mark them `household`. Cycle 1B migration `0009` stores unproven legacy rows as `unproven` instead. See `docs/CYCLE1B-ORIGIN.md`. This cycle does not query, backfill, or migrate production D1. QA mode does not count as Household 001. | Migration `0008` then `0009` only when a later release is authorized. Not applied here. |
| FW-03 | Catalog completeness | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-catalog` `2303898d`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/catalog-recipe-completeness.test.js` (FW-03 gate, fish-taco regression, Oct 1 tofu/lime) | Not run (no preview deploy) | Composer 2.5 (`composer-2.5`) on `feature/fw-c1-catalog`; integrated by Grok 4.7 (`grok-4.7`) | Structural checks only. Not kitchen-tested cooking evidence. | None. Notes: `docs/CYCLE1-CATALOG-NOTES.md`. |
| FW-04 | Serving audit | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-catalog` `2303898d`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/catalog-recipe-completeness.test.js` (servings 1–4); `test/recipe-scaling.test.js` (singular cup grammar) | Not run (no preview deploy) | Composer 2.5 (`composer-2.5`) on `feature/fw-c1-catalog`; integrated by Grok 4.7 (`grok-4.7`) | Grammar and plausibility are structural. Servings outside 1–4 are not the alpha audit. | FW-03 recipe quantities. Notes: `docs/CYCLE1-CATALOG-NOTES.md`. |
| FW-05 | Invite navigation | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/nav-context.test.js`; `e2e/specs/cycle1-ux.spec.js` (invite household vs onboarding). E2e not re-run on this integration. | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; integrated by Grok 4.7 (`grok-4.7`) | Reloading mid-onboarding after adding a person still lands on Tonight. That was true before this cycle. The QA screen switcher can still force a step. | None. Notes: `docs/CYCLE1-UX-NOTES.md`. |
| FW-06 | Dietary copy | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. Walnut tags added on this integration. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/dietary-eligibility.test.js` (HH001, cashew exception, name guard, tags-only walnut exclusion); `test/catalog-recipe-completeness.test.js` (`validateNutAllergenTags`) | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; catalog tags and integration by Grok 4.7 (`grok-4.7`) | Cashews stay blocked until a diner stores an explicit cashew permission. Household 001 was not given that permission. The client keeps its own copy of the key/row map in `app.js`. "No meat" includes poultry. | Catalog allergen tags. Notes: `docs/CYCLE1-UX-NOTES.md`, `docs/CYCLE1-INTEGRATION.md`. |
| FW-07 | Next-dinner CTA | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/nav-context.test.js` (`previousCompletedMeal`, locked round); `e2e/specs/cycle1-ux.spec.js` (rate, then next dinner). E2e not re-run on this integration. | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; integrated by Grok 4.7 (`grok-4.7`) | A partly rated dinner still has no next-dinner action. This is not week planning. | FW-01 locked outcomes. Notes: `docs/CYCLE1-UX-NOTES.md`. |
| FW-08 | Images | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-catalog` `2303898d`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/meal-image-lookup.test.js` (24 meals: slug, version id, title, title-only) | Not run (no preview deploy) | Composer 2.5 (`composer-2.5`) on `feature/fw-c1-catalog`; integrated by Grok 4.7 (`grok-4.7`) | Lookup is unit-tested. Animated load and fade on a real Tonight grid were not browser-verified in this integration. | None. Notes: `docs/CYCLE1-CATALOG-NOTES.md`. |
| FW-09 | Explanation copy | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/explanation-evidence.test.js` (evidence tiers, plant-tag non-similarity, nut-tag non-similarity, dedupe) | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; integrated by Grok 4.7 (`grok-4.7`) | Stored explanation text on old plans stays until a new round. Synthetic QA households never feed learning, so evidence tiers are unit-tested rather than shown in e2e. | Taste Model v1. Notes: `docs/CYCLE1-UX-NOTES.md`. |
| FW-10 | Recipe nav/select | Accepted by Oversight | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/nav-context.test.js` (origin, Back, preview-not-select, locked-round parity); `e2e/specs/cycle1-ux.spec.js` (view, choose, history). E2e not re-run on this integration. | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; integrated by Grok 4.7 (`grok-4.7`) | Back is still an in-app button. D-04 native Back is not built. Reducer copies stay duplicated with FW-01. | FW-01. Notes: `docs/CYCLE1-UX-NOTES.md`. |
| D-01 | Multi-dinner planning | Approved / Not Yet Implemented | — | — | — | — | — | Title source: campaign prompt, not a repo design doc. No Oversight spec names D-01. | — |
| D-02 | Taste-vocabulary / dietary model expansion | In Progress | `feature/fw-c2-contract`. No PR. | Contract commit on that branch. See `docs/CYCLE2-CONTRACT.md`. | `test/taste-resolver.test.js`; `test/preference-concepts.test.js`; `test/migration-0010.test.js` | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) | Contract only. Onboarding UI is not built. Household 001 was not backfilled. | `docs/CYCLE2-CONTRACT.md` |
| D-03 | Catalog expansion workflow | In Progress | `feature/fw-c2-contract`. No PR. | Contract commit on that branch. See `docs/CYCLE2-CONTRACT.md`. | `test/recipe-package.test.js`; `test/migration-0010.test.js` | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) | Recipe package contract only. The 24 meal bodies were not rewritten. Provenance stays unknown. | `docs/CYCLE2-CONTRACT.md` |
| D-04 | Native-feeling Back | Approved / Not Yet Implemented | — | — | — | — | — | Title source: campaign prompt, not a repo design doc. FW-10 stores plain navigation context and does not build native Back. | — |
| D-05 | AI/LLM Interaction and Cost Architecture | Approved / Not Yet Implemented | — | — | — | — | — | No Oversight design doc in the repo. Title not invented. | — |
| D-06 | Natural-Language Meal Planning | Approved / Not Yet Implemented | — | — | — | — | — | No Oversight design doc in the repo. Title not invented. | — |
| GATE-OPUS-55 | Final Opus 5.5 integrated review | Not Started | — | — | — | — | Opus 5.5 (required later) | Mandatory campaign gate before any production release of this remediation. | FW-01 through FW-10 and EVIDENCE-INTEGRITY on this integration. |

## October 1 retest

Recorded from `docs/CYCLE1-CATALOG-NOTES.md` and `docs/CYCLE1-UX-NOTES.md`. UX checks used a fresh synthetic QA kitchen (`?qa=1`). Writes sent `X-FlavorWeave-Data-Origin: synthetic`. The household stored `data_origin = synthetic` and `acquisition_source = synthetic_qa`. That kitchen does not count as Household 001.

| Check | Result |
|-------|--------|
| Tofu/lime (`crispy-chipotle-tofu-tacos` lists 2 limes; lime step refs resolve) | **PASS** |
| Blank kitchen name | **FAIL** at `cda0dc7` (saved as “Our kitchen”), then **fixed**. Continue stays on step 1, inline error, `aria-invalid`. Whitespace-only is blank. No household is created. |
| Household name becomes the diner’s name | **FAIL** at `cda0dc7` (“The Parkers” became the first diner), then **fixed**. Step 1 asks for the kitchen name and “Your name” separately. Both are required. |
| Added member | **PASS** before and after. Sam stayed Invited across reload in the API and in Settings. |
| Empty first set of picks | **PASS** before and after. Three cards with HH001-style limits. An empty plan shows “Try again” instead of a blank grid. |

## Synthetic isolation

`data_origin` is `household` or `synthetic`. QA mode sends `X-FlavorWeave-Data-Origin: synthetic` on POST and PATCH. A body field `data_origin: synthetic` is also honored. Synthetic rows are excluded from taste evidence, real-household history, Completed Meal Loop counts, funnel traction, and alpha ops. QA mode does not count as Household 001.

`migrations/0008_evidence_origin.sql` is committed and **not** applied to production D1. Its column default is `household`, which would stamp existing rows. Cycle 1B adds `migrations/0009_evidence_origin_unproven.sql` so those rows become `unproven` instead of household. See `docs/CYCLE1B-ORIGIN.md`. Do not apply either file to production in this campaign.

## FW-01 (resolved)

Root cause, in short: viewing another recipe was implemented as selecting it. That rewrote which meal was selected and reset the plan to `Selected`. History and Home then attached the earlier rating to whichever meal was last selected, because ratings were stored per person for the whole plan rather than per meal instance and recipe version.

Opening a recipe now only previews it. Choosing a dinner is a separate explicit action. After a meal is cooked or rated, the server refuses to move that outcome. Cook mode for an unselected meal does not select or complete it. Reload reads the cooked or rated meal, not the last inspected one.

Full write-up: `docs/FW-01-ROOT-CAUSE.md`.

## FW-02 (resolved)

Fresh cards already had time, effort, and meal style. Restored, shared, and reloaded plans lost them: session restore returned raw rows whose chips lived only inside `attributes_json`, share creation overwrote that JSON with a lossy snapshot, and the client defaulted missing chips to `Shared` / `Shared pick`.

Canonical fields now survive generation, persistence, API retrieval, reload, session restore, share view, and navigation. `projectMealOption` reads stored attributes and fills gaps from the catalog via `recipe_slug`. `mergeCanonicalAttributes` fills missing keys only and will not replace chips or the personalization label with Shared. Share reads live `meal_option` rows first and uses a snapshot only as fallback. Display-only copies are not stored when the option or catalog row can supply the fields.

## EVIDENCE-INTEGRITY (resolved, forward only)

There was no reliable split between Household 001 learning and QA. `?qa=1` / `localStorage he_qa=1` only toggled debug chrome. Alpha metrics, funnel, taste, and history counted every row. HH001 is a diet profile, not a hardcoded `household_id`. October 1 production smoke wrote ordinary app rows with no origin tag. Those rows cannot be identified from the repository, and this cycle does not read or modify production D1.

Forward mechanism:

- `data_origin` is `household` (real) or `synthetic` on household, plan, selection, cook, rating, preference_evidence, event, and meal_vote (`migrations/0008_evidence_origin.sql`).
- A household is synthetic when `data_origin = synthetic` or `acquisition_source` is one of `synthetic_qa`, `qa`, `e2e`, `smoke`, `test`. Synthetic household creation stores `acquisition_source = synthetic_qa`.
- Clients in QA mode send `X-FlavorWeave-Data-Origin: synthetic` on POST and PATCH. `data_origin: synthetic` in the JSON body is also honored.
- Synthetic rows are stored and then excluded from taste evidence, history shown to a real household, Completed Meal Loop counts, funnel traction, and alpha ops (`sqlRealHousehold` / `sqlRealRow` / `learningRows` / `productRows`).
- A synthetic request does not overwrite an existing real rating or real vote.
- A fully synthetic household can still see its own session history. Its rows do not feed shared learning.

Real Household 001 learning is unchanged by campaign QA that uses this marker. Pre-marker October 1 rows are quarantined as `unproven` by migration 0009 when that migration is later authorized. See `docs/CYCLE1B-ORIGIN.md`.

## FW-03, FW-04, FW-08 (resolved)

Catalog slice from Composer 2.5. Structural QA only.

- FW-03 adds executable recipe checks: quantities, compound-ingredient notes, oil listed when a step uses it, and heat or doneness language. The October fish-taco shape and the October tofu/lime recipe are guarded.
- FW-04 scales servings 1–4 without `1 cups` unit grammar.
- FW-08 keeps a stable meal-image shell. A failed image stays in the layout and shows the fallback. Lookup resolves all 24 meals by slug, version id, and title.

## FW-05, FW-06, FW-07, FW-09, FW-10 (resolved)

UX slice from Claude Opus 5.5. Decisions and the October 1 app retest are in `docs/CYCLE1-UX-NOTES.md`.

- FW-05: one invite screen, two navigation contexts (onboarding vs household).
- FW-06: hard limits are separate from likes. "No nuts" includes cashews unless that diner has an explicit cashew permission. The name scan remains. This integration also puts real `nuts` and `walnut` tags on `mushroom-walnut-bolognese`, and the same allergen rule on any similar catalog dish.
- FW-07: one "Find our next dinner" action after a fully rated meal. It starts a new plan and leaves the finished plan in History.
- FW-09: explanation copy is gated on stored evidence. Diet tags, including nut allergens, are not taste similarity.
- FW-10: opening a recipe does not select it. Back returns to Tonight, History, or Home. FW-01 view-versus-choose stays in place.

## Cycle 2 contract

D-02 and D-03 are in progress on `feature/fw-c2-contract`. The shared vocabulary, the three preference types, and the recipe package are in `docs/CYCLE2-CONTRACT.md`. Taste UX, the 24 recipe bodies, and catalog publishing are not in this slice. Migration `0010_cycle2_taste_contract.sql` is local-only and was not applied to production D1.

## Out of scope

D-01, D-04, D-05 (AI/LLM Interaction and Cost Architecture), and D-06 (Natural-Language Meal Planning) stay approved and not implemented. The final Opus 5.5 integrated review is not started. Production deploy, production D1 migrations, production backfill, and any write to Household 001 are out of scope. HH001 hard eligibility was not loosened: no dairy, no shellfish, no meat other than fish, no poultry, and nuts prohibited except an explicit cashew permission that this integration does not turn on.
