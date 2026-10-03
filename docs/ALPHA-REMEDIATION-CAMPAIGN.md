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
| FW-01 | Meal/rating identity (P0 release blocker) | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-identity-metadata`, prior integration `cda0dc75`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/meal-identity.test.js`; `test/household-state.test.js` (Rated survives a status rewrite) | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) on the child and on this integration | Client and server reducers are duplicated; parity covers inspect / cook / exit. | None. Root cause: `docs/FW-01-ROOT-CAUSE.md`. |
| FW-02 | Restored recommendation metadata loss | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-identity-metadata`, prior integration `cda0dc75`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/meal-option-view.test.js` (fresh, restored row, lossy share) | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) on the child and on this integration | Catalog hydration uses prep+cook minutes when a share dropped `minutes` (miso-ginger-salmon is 22, not the display chip “35 min”). | FW-01 read path returns projected options. |
| EVIDENCE-INTEGRITY | Synthetic QA evidence isolation | Resolved | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-identity-metadata`, prior integration `cda0dc75`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/evidence-origin.test.js` | Not run (no preview deploy) | Grok 4.7 (`grok-4.7`) on the child and on this integration | October 1 production rows are untagged. 0008's default would mark them `household`. Cycle 1B migration `0009` stores unproven legacy rows as `unproven` instead. See `docs/CYCLE1B-ORIGIN.md`. This cycle does not query, backfill, or migrate production D1. QA mode does not count as Household 001. | Migration `0008` then `0009` only when a later release is authorized. Not applied here. |
| FW-03 | Catalog completeness | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-catalog` `2303898d`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/catalog-recipe-completeness.test.js` (FW-03 gate, fish-taco regression, Oct 1 tofu/lime) | Not run (no preview deploy) | Composer 2.5 (`composer-2.5`) on `feature/fw-c1-catalog`; integrated by Grok 4.7 (`grok-4.7`) | Structural checks only. Not kitchen-tested cooking evidence. | None. Notes: `docs/CYCLE1-CATALOG-NOTES.md`. |
| FW-04 | Serving audit | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-catalog` `2303898d`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/catalog-recipe-completeness.test.js` (servings 1–4); `test/recipe-scaling.test.js` (singular cup grammar) | Not run (no preview deploy) | Composer 2.5 (`composer-2.5`) on `feature/fw-c1-catalog`; integrated by Grok 4.7 (`grok-4.7`) | Grammar and plausibility are structural. Servings outside 1–4 are not the alpha audit. | FW-03 recipe quantities. Notes: `docs/CYCLE1-CATALOG-NOTES.md`. |
| FW-05 | Invite navigation | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/nav-context.test.js`; `e2e/specs/cycle1-ux.spec.js` (invite household vs onboarding). E2e not re-run on this integration. | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; integrated by Grok 4.7 (`grok-4.7`) | Reloading mid-onboarding after adding a person still lands on Tonight. That was true before this cycle. The QA screen switcher can still force a step. | None. Notes: `docs/CYCLE1-UX-NOTES.md`. |
| FW-06 | Dietary copy | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. Walnut tags added on this integration. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/dietary-eligibility.test.js` (HH001, cashew exception, name guard, tags-only walnut exclusion); `test/catalog-recipe-completeness.test.js` (`validateNutAllergenTags`) | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; catalog tags and integration by Grok 4.7 (`grok-4.7`) | Cashews stay blocked until a diner stores an explicit cashew permission. Household 001 was not given that permission. The client keeps its own copy of the key/row map in `app.js`. "No meat" includes poultry. | Catalog allergen tags. Notes: `docs/CYCLE1-UX-NOTES.md`, `docs/CYCLE1-INTEGRATION.md`. |
| FW-07 | Next-dinner CTA | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/nav-context.test.js` (`previousCompletedMeal`, locked round); `e2e/specs/cycle1-ux.spec.js` (rate, then next dinner). E2e not re-run on this integration. | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; integrated by Grok 4.7 (`grok-4.7`) | A partly rated dinner still has no next-dinner action. This is not week planning. | FW-01 locked outcomes. Notes: `docs/CYCLE1-UX-NOTES.md`. |
| FW-08 | Images | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-catalog` `2303898d`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/meal-image-lookup.test.js` (24 meals: slug, version id, title, title-only) | Not run (no preview deploy) | Composer 2.5 (`composer-2.5`) on `feature/fw-c1-catalog`; integrated by Grok 4.7 (`grok-4.7`) | Lookup is unit-tested. Animated load and fade on a real Tonight grid were not browser-verified in this integration. | None. Notes: `docs/CYCLE1-CATALOG-NOTES.md`. |
| FW-09 | Explanation copy | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/explanation-evidence.test.js` (evidence tiers, plant-tag non-similarity, nut-tag non-similarity, dedupe) | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; integrated by Grok 4.7 (`grok-4.7`) | Stored explanation text on old plans stays until a new round. Synthetic QA households never feed learning, so evidence tiers are unit-tested rather than shown in e2e. | Taste Model v1. Notes: `docs/CYCLE1-UX-NOTES.md`. |
| FW-10 | Recipe nav/select | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c1-ux` `8b3e2f79`. No PR to `main`. | `acdb92f3794a70adcd89c1c15e73d2670544502b` | `test/nav-context.test.js` (origin, Back, preview-not-select, locked-round parity); `e2e/specs/cycle1-ux.spec.js` (view, choose, history). E2e not re-run on this integration. | Not run (no preview deploy) | Claude Opus 5.5 (`claude-opus-5-5`) on `feature/fw-c1-ux`; integrated by Grok 4.7 (`grok-4.7`) | Back is still an in-app button. D-04 native Back is not built. Reducer copies stay duplicated with FW-01. | FW-01. Notes: `docs/CYCLE1-UX-NOTES.md`. |
| D-01 | Multi-dinner planning | In Progress | `feature/flavorweave-alpha-remediation`. Cycle 3 children plus fix branches `feature/fw-c3-shoplines` `c6a8d34a`, `feature/fw-c3-uxfix` `668c1752`, `feature/fw-c3-fix2` `e7fcb849`. No pull request. Not accepted. | Product runtime `e7fcb849fd848dfd9bd131ff9a544f783c95952a`. See the Cycle 3 section. Shopping line ids are plan-scoped (`sl_{dinner_plan_id}_{ingredient}_{unit}`). | `test/shop-display.test.js` (7); `test/cycle3-contract.test.js` (23); `test/nav-context.test.js` (21); `test/brand-smoke.test.js` (`fw-sw-v12`); broad unit/lint/Playwright on this integration | No new preview deploy. A preview recheck of the prior build failed quantity fractions, Added tags, and Who's eating. No browser re-check of this integration. Hosted GitHub Actions was not run. | Grok 4.7 (`grok-4.7`) on prior integration; fix branches by Cursor Agent. | Opus integrated preview review rejected the earlier preview (line loss, unreachable list, participants, toast HTML, headers, card actions, title box, new-kitchen entry). Quantity display, delta tags, and participant sheet were addressed in `feature/fw-c3-fix2` but are not claimed re-verified in a browser here. Migration 0011 was not applied to any D1 database. | Cycle 2. Contract: `docs/CYCLE3-CONTRACT.md`. UX: `docs/CYCLE3-UX.md`. |
| D-02 | Taste-vocabulary / dietary model expansion | Accepted | `feature/flavorweave-alpha-remediation`. Children `feature/fw-c2-contract` `3f734a5147411cc163db4d4ea4af1556a32ecd37`, `feature/fw-c2-taste` `dd97bc7d762fee9032065b2a13b41ae7b29db017`. No PR. | Cycle 2 integration tip. See the Cycle 2 section. | `test/diner-taste-rank.test.js`; `test/taste-resolver.test.js`; `test/preference-concepts.test.js`; `test/taste-profile.test.js`; `test/taste-ui.test.js`; `test/migration-0010.test.js` | Not run (no preview deploy). Hosted GitHub Actions was not run. | Grok 4.7 (`grok-4.7`) on the children and on this integration | Legacy `dislike` and `neutral` evidence is not rewritten. `recordInferredTaste` is a hook and nothing calls it from a meal rating. Household 001 was not backfilled. | Hard limits stay in `src/lib/eligibility.js`. Contract: `docs/CYCLE2-CONTRACT.md`. |
| D-03 | Catalog expansion workflow | Accepted | `feature/flavorweave-alpha-remediation`. Child `feature/fw-c2-catalog` `e6a9e8e9986cc3dc83b1a0f237105ca7d021c964`. No PR. | Cycle 2 integration tip. See the Cycle 2 section. | `test/cycle2-catalog.test.js`; `test/recipe-package.test.js`; `test/migration-0010.test.js` | Not run (no preview deploy). Hosted GitHub Actions was not run. | Grok 4.7 (`grok-4.7`) on the child and on this integration | 24 packages are structurally valid. Provenance stays `unknown_unverified`. Image provenance stays `unknown` and rights stay `not_cleared_for_external_release`. `kitchen_tested` stays false. Tonight still uses `recipe-store.js`. | `docs/CYCLE2-CONTRACT.md`. |
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

## Cycle 2 integration

FW-01 through FW-10 stay Accepted. D-02 and D-03 are Accepted. At the time of that integration, D-01, D-04, D-05 (AI/LLM Interaction and Cost Architecture), and D-06 (Natural-Language Meal Planning) were Approved / Not Yet Implemented. D-01 later moved to In Progress on `feature/fw-c3-contract`. D-04, D-05, and D-06 stay Approved / Not Yet Implemented.

Merged onto `feature/flavorweave-alpha-remediation` in order, starting from `35b19159643c017ed407bcda4ac5c2f72b2f09ba`:

| Order | Branch | Child SHA | Merge commit |
|-------|--------|-----------|--------------|
| 1 | `feature/fw-c2-contract` | `3f734a5147411cc163db4d4ea4af1556a32ecd37` | `f5eed16c50785fb3dbf841f438acdef68853e49c` |
| 2 | `feature/fw-c2-catalog` | `e6a9e8e9986cc3dc83b1a0f237105ca7d021c964` | `f03e30a2047e6b84a050759d1a043050e73fe66b` |
| 3 | `feature/fw-c2-taste` | `dd97bc7d762fee9032065b2a13b41ae7b29db017` | `c48fba5348c2e5cbf78e83c0a7e6b335a1859f63` |

No pull request. Not merged to `main`. `main` was not pushed. Pages and the Worker were not deployed. Production D1 `23aa3db3-1090-471b-8c8a-b6fe71f5c053` and Household 001 were not written.

**Migration:** `migrations/0010_cycle2_taste_contract.sql` is in the tree. The migration check includes it, and `test/migration-0010.test.js` still refuses to apply 0010 to a database stopped after 0008. 0010 was not applied to production D1.

**Integration SHA:** `23b78f0a4d98fae463744f9e0c317c3287473ebb`

Clean-tree suite on that SHA, from `npm ci` with `node_modules` removed first:

- Migration check: `OK: 10 migration file(s)`, including `migrations/0010_cycle2_taste_contract.sql`. `test/migration-0010.test.js` still refuses 0010 when the database stopped after 0008.
- Unit tests: 35 files, 397 passed (`npx vitest run`).
- Lint: `eslint --max-warnings=0`, clean.
- Playwright: `CI=true npm run test:e2e`, 27 passed. The desktop recipe-tab check passed on the first try.

**Hosted GitHub Actions:** not run.

The commit that writes this paragraph does not change product code. Product behavior matches `23b78f0a4d98fae463744f9e0c317c3287473ebb`.

Tonight still lists meals from `recipe-store.js`. Ranking reads `diner_taste` for that household and matches Cycle 2 vocabulary tags on the same dishes. Love and Like raise a matching meal. Less often lowers it and does not ban it, write a hard limit, or override eligibility. Hard limits still win in `eligibility.js` on the server. Tastes stay per diner. A slug with no package match does not count as a match. Synthetic and unproven rows stay out of ranking, taste learning, Completed Meal Loop counts, funnel, alpha ops, and traction. A meal rating does not mark every ingredient as liked. An inferred row does not replace an explicit one. Nothing in the recommender writes inferred rows.

Unwired on purpose: `recordInferredTaste` has no caller in the meal loop. Legacy `dislike` and `neutral` rows stay in `preference_evidence`. Practical hints have no planner UI. The 24 packages are not the live menu. Unpublished, draft, invalid, and household-only packages are not recommended. No package was marked kitchen-tested, and no provenance or image right was invented.

Service worker cache remains `fw-sw-v8`. The profile grid no longer spills one pixel past a 375px phone. The settings taste check looks for Tacos, the vocabulary name, instead of the old spark line "taco night". Opening a recipe pins that meal's tab before the recipe request returns, so a keyboard move is not snapped back to Overview when the recipe arrives.

## Cycle 3 integration

FW-01 through FW-10 stay Accepted. D-02 is Accepted. D-03 is Accepted. D-01 is **In Progress**. It is not accepted. D-04, D-05 (AI/LLM Interaction and Cost Architecture), and D-06 (Natural-Language Meal Planning) stay Approved / Not Yet Implemented. The planner seam accepts a structured intent and does not call a model.

Fast-forward of `feature/fw-c3-ui` onto `feature/flavorweave-alpha-remediation`, from `aa6596a4baa83d1f8d6756da1ac005f2ab2f341f` to `ac9e520a442fd460f7e2880ef55ac8ca93d9a4aa`. No merge commit. No pull request. Not merged to `main`. `main` was not pushed. Pages and the Worker were not deployed. No preview was deployed. Production D1 `23aa3db3-1090-471b-8c8a-b6fe71f5c053` and Household 001 were not written. Migration 0011 was not applied to any remote D1.

**Cycle 3 fix integration** (from prior tip `94a67dd5ccd5162a948324cf85e85bc270c394b2`):

| Order | Branch | Child SHA | How it landed |
|-------|--------|-----------|---------------|
| 5 | `feature/fw-c3-shoplines` | `c6a8d34aee5de753b4f1151b8275178b28696e21` | Fast-forward. Plan-scoped shopping line ids; `saveDinnerPlan` line rebuild inside `db.batch`. |
| 6 | `feature/fw-c3-uxfix` | `668c1752b0771bc3bd698a29356e2df5d32eb823` | Merge commit `f3f6d0e29bd009c778dfcf5e9d7b78a606927b74`. Consumer UI fixes in `public/app.js`, `index.html`, `styles.css`, `sw.js`. |

No merge conflicts. Shopping-started rules, FW-01, and Cycle 2 taste behavior were not changed in conflict resolution.

**Branch tip (integration):** `f3f6d0e29bd009c778dfcf5e9d7b78a606927b74` after the merges above. A later docs-only commit may advance the tip without changing product files.

**Product runtime SHA:** `f3f6d0e29bd009c778dfcf5e9d7b78a606927b74`

**Service worker:** `fw-sw-v11` (`public/sw.js`). `test/brand-smoke.test.js` expects v11.

**Shopping line ids:** `sl_{dinner_plan_id}_{ingredient}_{unit}` (plan-scoped; see `docs/CYCLE3-CONTRACT.md`).

**Opus preview review:** The prior integrated preview was rejected for line loss, unreachable list, participants, toast HTML, headers, quantity display, delta tags, card actions, title box, and new-kitchen entry. This integration does not claim those were re-verified in a browser.

**Node:** v22.14.0, after `npm ci`.

Targeted unit on the product runtime tree: `test/cycle3-contract.test.js` 23 passed; `test/migration-0011.test.js` 4; `test/nav-context.test.js` 21; `test/brand-smoke.test.js` 7 (55 total).

Broad suite on the product runtime tree:

- Migration check: `OK: 11 migration file(s)`.
- Unit tests: 37 files, 427 passed (`npx vitest run`).
- Lint: `eslint --max-warnings=0`, clean.
- Playwright: `CI=true npm run test:e2e`, 26 passed, 1 failed (`e2e/specs/responsive.spec.js` mobile Tonight nav). E2e helpers were updated for Cycle 3 onboarding landing on Home; the responsive spec was re-run and passed (3/3). Full Playwright was not re-run after that e2e-only fix. Hosted GitHub Actions was not run.

**Cycle 3 fix2 integration** (from prior tip `b1c566464d51afbdb0037cbce13a5cb46a4146a9`):

| Order | Branch | Child SHA | How it landed |
|-------|--------|-----------|---------------|
| 7 | `feature/fw-c3-fix2` | `e7fcb849fd848dfd9bd131ff9a544f783c95952a` | Fast-forward. Shop quantity display (`src/lib/shop-display.js`), shopping delta Added tags, participant (“Who's eating”) sheet, PATCH to activate invited members, service worker `fw-sw-v12`. |

No merge conflicts. Shopping-started rules, FW-01, and Cycle 2 taste behavior were not changed.

**Branch tip (integration):** `e7fcb849fd848dfd9bd131ff9a544f783c95952a` after the fast-forward above. A later docs-only commit may advance the tip without changing product files.

**Product runtime SHA:** `e7fcb849fd848dfd9bd131ff9a544f783c95952a`

**Service worker:** `fw-sw-v12` (`public/sw.js`). `test/brand-smoke.test.js` expects v12.

**Preview recheck (prior build):** Quantity fractions, Added tags, and Who's eating failed on the build before this fix. This integration does not claim a new browser re-check.

**Node:** v22.14.0, after `npm ci`.

Targeted unit on the product runtime tree: `test/shop-display.test.js` 7 passed; `test/cycle3-contract.test.js` 23; `test/nav-context.test.js` 21; `test/brand-smoke.test.js` 7 (58 total).

Broad suite on the product runtime tree:

- Migration check: `OK: 11 migration file(s)`.
- Unit tests: 38 files, 434 passed (`npx vitest run`).
- Lint: `eslint --max-warnings=0`, clean.
- Playwright: `CI=true npm run test:e2e`, 27 passed. Hosted GitHub Actions was not run.

The UI branch already contained the contract, the shop slice, and the UX document:

| Order | Branch | Child SHA | How it landed |
|-------|--------|-----------|---------------|
| 1 | `feature/fw-c3-contract` | `d605032c0cb954cb6366c62306740eeeb96b56b3` | Fast-forward. Workstream A: contract, persistence, server domain. |
| 2 | `feature/fw-c3-shop` | `58442be725de63b584f212c3867126ffa9aa586b` | Fast-forward. Shopping aliases, quantity scaling, swap-after-shop. |
| 3 | `feature/fw-c3-ux` | `aeb737012bf9aa6ccadc2bb0fef3aa5f2551cb7c` | Cherry-picked as `4db657e016317132d0598dc786fa828a8b664de0`. `docs/CYCLE3-UX.md` matches the branch tip. |
| 4 | `feature/fw-c3-ui` | `ac9e520a442fd460f7e2880ef55ac8ca93d9a4aa` | Fast-forward. Plan → Shop → Cook → Rate UI. Service worker `fw-sw-v10`. |

**Product runtime SHA:** `ac9e520a442fd460f7e2880ef55ac8ca93d9a4aa`

**Migration:** `migrations/0011_cycle3_dinner_plan.sql` is in the tree. The migration check reports `OK: 11 migration file(s)`, including this file. `test/migration-0011.test.js` still refuses 0011 when 0009 or 0010 has not run. 0011 was not applied to production D1 or any other remote D1.

**Service worker (initial Cycle 3 UI merge):** `fw-sw-v10` (`public/sw.js`). Later bumped to `fw-sw-v11` in the fix integration above.

**Integration model:** Grok 4.7 (`grok-4.7`). Child commits are authored by Cursor Agent and do not name a model.

**Node:** v22.14.0, after `npm ci`.

Broad suite on `f0c52085b4b9658cdd67b8a7c8ede77a8ee15503`. That commit changes only `test/brand-smoke.test.js` so the smoke check expects `fw-sw-v10`. Product files match `ac9e520a442fd460f7e2880ef55ac8ca93d9a4aa`.

- Migration check: `OK: 11 migration file(s)`.
- Unit tests: 37 files, 424 passed (`npx vitest run`).
- Lint: `eslint --max-warnings=0`, clean.
- Playwright: `CI=true npm run test:e2e`, 26 passed, 1 failed. `e2e/specs/cycle1-ux.spec.js` (“full loop keeps origins straight and starts a fresh round”) timed out looking for a Home `next-dinner` button. After a rated legacy round, Home is already the no-plan hero.

The spec was corrected on `66533fea4629da4c2f4763878353a3d7d730441f`. “Find our next dinner” on the loop screen opens that hero and does not start a legacy round. The rated plan stays current, so `previous_meal` stays null. That one spec was re-run and passed. The other 26 Playwright specs were not re-run. No product file changed between the broad suite and that re-run. Hosted GitHub Actions was not run.

The commit that writes this paragraph does not change product code. Product behavior matches `ac9e520a442fd460f7e2880ef55ac8ca93d9a4aa`.

### Definition of done

| Check | Status |
|-------|--------|
| Multi-meal plan with an explicit count | Met. A missing count is `dinner_count_required`. “This week” is not stored as 7. |
| One meal per slot | Met. The planner fills one slot per count. |
| Swaps | Met. `swap_meal` changes one pin and leaves the others. |
| Dated and undated meals | Met. `set_date` assigns or clears a date and does not rebuild the list. |
| Leftovers and eating out | Met. Those slots add no ingredients and do not take a recipe rating. |
| Per-meal participants | Met. A diner whose hard limit fails is rejected. The meal is not swapped for them. |
| Hard limits on the server | Met. A client `eligible` flag does not grant permission. |
| Finalize without every vote | Met. `votes_required` stays false. |
| One shopping list, with aggregation | Met. Same ingredient and unit add together. Yellow onion aggregates with onion. Tablespoon does not add to cup. |
| Already have | Met. |
| Purchased marks persist | Met, including across a swap after shopping has started. |
| Deltas after shopping starts | Met. The list is not silently rebuilt. Added and no-longer-needed rows keep earlier marks. |
| Cook in any order | Met. |
| Planned, selected, cooked, and rated stay distinct | Met. |
| Independent ratings | Met. One participant’s score does not finish the meal. A non-participant does not block it. |
| Recipe version pin | Met. A later catalog version does not rewrite a pin. |
| Find a dinner | Met. `meal_count` 1, entry `find_dinner` or `tonight`. |
| Tonight is plan-aware | Met. An open dinner plan replaces the legacy three-pick grid. |
| Authorization | Met. A session is required. Another household, a missing plan, and a foreign participant are denied. |
| FW-01 still green | Met. Preview still does not select. A cooked Tonight outcome stays locked. |
| Cycle 2 intact | Met. Taste ranking and the catalog package tests passed in the 424. |
| Synthetic rows stay isolated | Met. A synthetic dinner plan does not count toward the Completed Meal Loop. |

### Carry-forward

These were still true after the merge. They are not part of the definition of done above.

- Tonight has no overflow menu. The UX asks for “Tonight options” with Edit plan, Shopping list, and Start a new plan. Plan review and the shopping list have their own overflow menus.
- A participant change that hits a hard limit toasts and leaves the meal. It does not open a swap so the table can pick another dinner.
- The shopping overflow does not include Mark everything bought or Copy list.
- A shopping check waits for the server. There is no optimistic fill and no delayed move into Bought.
- Kitchen mode can leave with `exit_cook`. It does not offer `abandon_meal` (“We stopped partway”).
- Plan cards always say “Fits everyone’s limits”. They do not add the other evidence lines, and they do not hide that line when nobody has a limit.
- There is no household dinner-plan list API. The client stores `fw_dinner_plan:{household_id}` and up to five recent ids. Another device sees the plan from `/?dinner_plan=` only.
- There is no unpick from Tonight’s pick back to planned. The contract has no such mutation.
- Still carried from earlier cycles, and not fixed here: the QA phone status pill, Fine-tune whitespace on desktop, the sticky recipe bar over recipe tabs, the legacy “Your pick” overlay on Tonight option cards, and image rights remaining `not_cleared_for_external_release`.

## Out of scope

D-04, D-05 (AI/LLM Interaction and Cost Architecture), and D-06 (Natural-Language Meal Planning) stay approved and not implemented. D-01 is in progress on this branch and is not accepted. The final Opus 5.5 integrated review is not started. Production deploy, production D1 migrations, production backfill, and any write to Household 001 are out of scope. HH001 hard eligibility was not loosened: no dairy, no shellfish, no meat other than fish, no poultry, and nuts prohibited except an explicit cashew permission that this integration does not turn on.
