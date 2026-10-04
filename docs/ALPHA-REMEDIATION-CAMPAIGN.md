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
| D-01 | Multi-dinner planning | **Implementation complete / awaiting Oversight acceptance** | `feature/flavorweave-alpha-remediation`. Through Cycle 3B toast-noop `feature/fw-c3b-toast-noop` `991db9e`. No pull request. **Cycle 3B closure complete for implementation verification — not Oversight-accepted.** | Product runtime SHA `991db9e4770df6b460d3f9594ce29a114101c33e`. Shopping line ids are plan-scoped (`sl_{dinner_plan_id}_{ingredient}_{unit}`). Discovery: `GET /api/dinner-plans`, `GET /api/dinner-plans/current`. | `test/cycle3b-remediation.test.js` (5); `test/shop-display.test.js` (10); `test/brand-smoke.test.js` (`fw-sw-v16`); broad unit/lint/Playwright on `991db9e` (447 tests, 27 e2e). | Preview `27e5d6fe-41a8-4bf0-8e34-7cb6c61e2531`, SW `fw-sw-v16`, https://harbor-eats-cycle1-preview.pages.dev — synthetic hosted evidence **PASS** (see Cycle 3B closure). Production untouched. Hosted GitHub Actions was not run. | Cursor Agent on Cycle 3B toast-noop merge and Cycle 3B closure docs. | Oversight acceptance still pending. Opus preview polish gaps remain in carry-forward. Migration 0011 was not applied to any D1 database. | Cycle 2. Contract: `docs/CYCLE3-CONTRACT.md`. UX: `docs/CYCLE3-UX.md`. |
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

FW-01 through FW-10 stay Accepted. D-02 is Accepted. D-03 is Accepted. D-01 is **implementation complete / awaiting Oversight acceptance**. Cycle 3B implementation verification is closed; D-01 is not Oversight-accepted. D-04, D-05 (AI/LLM Interaction and Cost Architecture), and D-06 (Natural-Language Meal Planning) stay Approved / Not Yet Implemented. The planner seam accepts a structured intent and does not call a model.

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

**Cycle 3 toast integration** (from prior tip `9980a05b438e372960403c7ccb5fa17f2e0206aa`):

| Order | Branch | Child SHA | How it landed |
|-------|--------|-----------|---------------|
| 8 | `feature/fw-c3-toast` | `b1504aa622aba1826cbad26f10771bd25b4db9aa` | Fast-forward. Suppresses the shopping-list toast when a participant save is a no-op; plan mutation helpers and shop display tests; service worker `fw-sw-v13`. |

No merge conflicts. Shopping-started rules, FW-01, and Cycle 2 taste behavior were not changed.

**Branch tip (integration):** `b1504aa622aba1826cbad26f10771bd25b4db9aa` after the fast-forward above. A later docs-only commit may advance the tip without changing product files.

**Product runtime SHA (tested):** `b1504aa622aba1826cbad26f10771bd25b4db9aa`

**Toast child SHA:** `b1504aa622aba1826cbad26f10771bd25b4db9aa`

**Service worker:** `fw-sw-v13` (`public/sw.js`). `test/brand-smoke.test.js` expects v13.

**Preview recheck (fix2 build):** Quantity fractions **PASS**, Added tags **PASS**, Who's eating **FAIL** only for a false list toast on no-op participant save. This integration does not claim a new browser toast recheck. D-01 stays **In Progress** until that recheck.

**Node:** v22.14.0, after `npm ci`.

Targeted unit on the product runtime tree: `test/shop-display.test.js` 9 passed; `test/cycle3-contract.test.js` 24; `test/nav-context.test.js` 21; `test/brand-smoke.test.js` 7 (61 total).

Broad suite on the product runtime tree:

- Migration check: `OK: 11 migration file(s)`.
- Unit tests: 38 files, 437 passed (`npx vitest run`).
- Lint: `eslint --max-warnings=0`, clean.
- Playwright: `CI=true npm run test:e2e`, 27 passed. Hosted GitHub Actions was not run.

**Cycle 3B integration** (from prior tip `50b336050dea600837b65aa9b3542dd28a67d7c1`):

| Order | Branch | Child SHA | How it landed |
|-------|--------|-----------|---------------|
| 9 | `feature/fw-c3b-authority` | `0be864113a7afe5664540064e8f2e4fdd3d226d7` | Fast-forward (first commit on client branch). Household dinner-plan discovery on the server: list and current plan. |
| 10 | `feature/fw-c3b-client` | `3bf261fa97015479e192a0ad451d48add600fe0e` | Fast-forward onto `feature/flavorweave-alpha-remediation`. Home and Tonight load `GET /api/dinner-plans/current`; localStorage pointer is cache-only; service worker `fw-sw-v14`. |

No merge commit. No pull request. `main` was not pushed. Nothing was deployed. Production D1 and Household 001 were not written. Migration 0011 was not changed and was not applied.

**Authority child SHA:** `0be864113a7afe5664540064e8f2e4fdd3d226d7`

**Client child SHA:** `3bf261fa97015479e192a0ad451d48add600fe0e`

**Discovery endpoints:** `GET /api/dinner-plans` (household list + `current` summary), `GET /api/dinner-plans/current` (authoritative current plan or null with HTTP 200).

**Service worker:** `fw-sw-v14` (`public/sw.js`). `test/brand-smoke.test.js` expects v14.

D-01 stays **In Progress**. Cycle 3B is closure work only and is **not** accepted. This integration does **not** claim the hosted golden path or a new browser toast recheck.

**Node:** v22.14.0, after `npm ci`.

Targeted unit on the tested runtime tree: `test/cycle3-contract.test.js` 26; `test/dinner-plan-discovery-client.test.js` 2; `test/brand-smoke.test.js` 7; `test/nav-context.test.js` 21; `test/shop-display.test.js` 9 (65 total).

Broad suite on the tested runtime tree:

- Migration check: `OK: 11 migration file(s)`.
- Unit tests: 39 files, 441 passed (`npx vitest run`).
- Lint: `eslint --max-warnings=0`, clean.
- Playwright: `CI=true npm run test:e2e` (with `PLAYWRIGHT_SKIP_WEBSERVER=1` and local `wrangler dev` on Node 22), 27 passed. `e2e/specs/helpers.js` seeds a legacy `/api/recommendations/plan` round when Cycle 3B no-plan Tonight does not auto-fetch picks. Hosted GitHub Actions was not run.

**Branch tip (integration):** `c726db6391f5f1b5263e45be326838f7c4beeaa9` (product files match `3bf261f`).

**Product runtime SHA:** `3bf261fa97015479e192a0ad451d48add600fe0e`

**Tested runtime SHA:** `db528ee9f036c2b149c5980b84db3e549e20b7c0` (product files match `3bf261f`; this commit adds `e2e/specs/helpers.js` and this doc section only).

**Cycle 3B remediation integration** (from tip `8848d88fc898d3e8f9e3aae92bb4f9a0561b868c`):

| Order | Branch | Child SHA | How it landed |
|-------|--------|-----------|---------------|
| 11 | `feature/fw-c3b-authority-fix` | `93eb03738995181f48c6cd2519faf495343104ea` | Fast-forward. Second-member sign-in and dinner-plan history; invite-join and session alignment; recommendations history for multi-member households; service worker `fw-sw-v15`. |

No merge commit. No pull request. `main` was not pushed. Nothing was deployed. Production D1 was not written.

**Remediation child SHA:** `93eb03738995181f48c6cd2519faf495343104ea`

**Service worker:** `fw-sw-v15` (`public/sw.js`). `test/brand-smoke.test.js` expects v15.

D-01 stays **In Progress**. Cycle 3B remediation is merged and is **not** accepted. This integration does **not** claim the hosted golden path or golden **PASS**; hosted golden recheck is still pending.

**Node:** v22.14.0, after `npm ci`.

Targeted unit on the tested runtime tree: `test/cycle3b-remediation.test.js` 4; `test/dinner-plan-discovery-client.test.js` 2; `test/cycle3-contract.test.js` 26; `test/brand-smoke.test.js` 7; `test/taste-profile.test.js` 31 (70 total).

Broad suite on the tested runtime tree:

- Migration check: `OK: 11 migration file(s)`.
- Unit tests: 40 files, 445 passed (`npx vitest run`).
- Lint: `eslint --max-warnings=0`, clean.
- Playwright: `CI=true npm run test:e2e`, 27 passed. Hosted GitHub Actions was not run.

**Product runtime SHA:** `93eb03738995181f48c6cd2519faf495343104ea`

**Tested runtime SHA:** `93eb03738995181f48c6cd2519faf495343104ea` (no follow-up runtime commits before the suite).

**Branch tip (integration):** `337c696c46a45ec7bdc509619ef18c240b4e27dc`.

**Cycle 3B toast-noop integration** (from tip `8f245238a8e590bfb1f52b98b23ffee2353dc65a`):

| Order | Branch | Child SHA | How it landed |
|-------|--------|-----------|---------------|
| 12 | `feature/fw-c3b-toast-noop` | `991db9e4770df6b460d3f9594ce29a114101c33e` | Fast-forward. Suppresses the shopping-list toast when a participant (“Who’s eating”) save is a no-op after shopping has started; `planMutationChanged` helper; service worker `fw-sw-v16`. |

No merge commit. No pull request. `main` was not pushed. Nothing was deployed. Production D1 was not written.

**Toast-noop child SHA:** `991db9e4770df6b460d3f9594ce29a114101c33e`

**Service worker:** `fw-sw-v16` (`public/sw.js`). `test/brand-smoke.test.js` expects v16.

D-01 was **In Progress** at merge time. Cycle 3B toast-noop landed at product runtime `991db9e`. Hosted verification on the Cycle 1 preview is recorded under **Cycle 3B closure (implementation verification)** below; that closure does not constitute Oversight acceptance.

**Node:** v22.14.0, after `npm ci`.

Targeted unit on the tested runtime tree: `test/shop-display.test.js` 10; `test/cycle3b-remediation.test.js` 5; `test/brand-smoke.test.js` 7 (22 total).

Broad suite on the tested runtime tree:

- Migration check: `OK: 11 migration file(s)`.
- Unit tests: 40 files, 447 passed (`npx vitest run`).
- Lint: `eslint --max-warnings=0`, clean.
- Playwright: `npm run test:e2e`, 27 passed (Chromium installed in this environment after a missing-browser launch failure; not a product defect). Hosted GitHub Actions was not run.

**Product runtime SHA:** `991db9e4770df6b460d3f9594ce29a114101c33e`

**Tested runtime SHA:** `991db9e4770df6b460d3f9594ce29a114101c33e` (no follow-up runtime commits before the suite).

**Branch tip (integration):** `782ad3f93575609bd0d2b704bbc101a3d12d808e` before the Cycle 3B closure docs commit (product files match `991db9e`). A docs-only commit recording closure advances the tip without changing product files.

**Cycle 3B closure (implementation verification)** — recorded after toast-noop integration; no new product deploy in this step; Playwright was not re-run for this closure.

No merge commit. No pull request. `main` was not pushed. Production D1 `23aa3db3-1090-471b-8c8a-b6fe71f5c053` and Household 001 were not written. D-04, D-05, and D-06 were not implemented.

**Product runtime SHA:** `991db9e4770df6b460d3f9594ce29a114101c33e`

**Tested runtime SHA:** `991db9e4770df6b460d3f9594ce29a114101c33e`

**Preview:** deployment `27e5d6fe-41a8-4bf0-8e34-7cb6c61e2531`, service worker `fw-sw-v16`, URL https://harbor-eats-cycle1-preview.pages.dev

**Hosted evidence (synthetic only):** QA kitchens with `X-FlavorWeave-Data-Origin: synthetic` on the preview above.

| Check | Result |
|-------|--------|
| Server discovery `GET /api/dinner-plans` and `GET /api/dinner-plans/current` | **PASS** |
| Context B via invite join without share URL (recheck #2) | **PASS** |
| Shared shopping list and shopping deltas | **PASS** |
| `localStorage` clear recovery | **PASS** |
| Plan → Shop → Cook → partial rate → full rate (recheck #2) | **PASS** |
| Toast no-op after shopping started on v16 (`CYCLE3B-TOAST-HISTORY`) | **PASS** |
| History pinned recipe on v16 (and earlier recheck) | **PASS** |

**Suite on `991db9e` (already run on integration; not re-run for this docs commit):**

- Migration check: `OK: 11 migration file(s)`.
- Unit tests: 40 files, 447 passed (`npx vitest run`).
- Lint: `eslint --max-warnings=0`, clean.
- Playwright: 27 passed. Hosted GitHub Actions was not run.

**D-01 status after closure:** **Implementation complete / awaiting Oversight acceptance.** Not accepted by Oversight. GATE-OPUS-55 remains not started.

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

These remain after Cycle 3B implementation verification. They are not part of the definition of done above and are not blockers for the implementation-complete record.

- Mark all bought (shopping overflow).
- Copy list (shopping overflow).
- Shop check animation polish (server-round-trip today; no delayed move into Bought).
- Richer evidence copy on plan cards (still “Fits everyone’s limits” only).
- Unpick from Tonight’s pick back to planned (no contract mutation).
- QA phone status pill.
- Fine-tune whitespace on desktop.
- Sticky recipe bar over recipe tabs.
- Legacy “Your pick” overlay on Tonight option cards.
- Image rights remain `not_cleared_for_external_release`.
- Kitchen abandon (`abandon_meal` / “We stopped partway”; only `exit_cook` today).
- Ask the table (participant hard-limit flow toasts but does not open swap).
- Tonight overflow menu shape (UX spec “Tonight options” vs current chrome).

## Out of scope

D-04, D-05 (AI/LLM Interaction and Cost Architecture), and D-06 (Natural-Language Meal Planning) stay approved and not implemented. D-01 is implementation complete on this branch and awaits Oversight acceptance; it is not Oversight-accepted. The final Opus 5.5 integrated review is not started. Production deploy, production D1 migrations, production backfill, and any write to Household 001 are out of scope. HH001 hard eligibility was not loosened: no dairy, no shellfish, no meat other than fish, no poultry, and nuts prohibited except an explicit cashew permission that this integration does not turn on.
