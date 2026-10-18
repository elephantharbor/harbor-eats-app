# S-07 Goal B: Outcome measurement (what current telemetry and schema can answer)

**Basis.** Code at `origin/main` e57f464, which is bc11084 plus a DEPLOYMENTS.md line. That is the S-06 Production build. Every citation is `file:line` at that commit.
**Rules followed.**
- I ran no Production query and read no backup.
- No household id, item text, recipe, dietary detail or rating value appears here.
- Proposed SQL lives in PROPOSED-AGGREGATE-QUERIES.md and has not been run.
**Frame.** Each outcome is read as **Experience → Evidence → Learning → Change** (section 8).

---

## 1. Who counts: the household population

### 1.1 Markers that exist today
| Marker | Where | Meaning |
|---|---|---|
| `household.data_origin` ∈ household / synthetic / unproven | `migrations/0009_evidence_origin_unproven.sql:73–106` (default `'unproven'`) | Stamped at creation by `writeOrigin`, `src/index.js:278`. A live request with no synthetic marker stamps `household`. |
| `household.acquisition_source` | same table | `synthetic_qa`, `qa`, `e2e`, `smoke` and `test` mark a whole household as QA (`src/lib/evidence-origin.js:21–27`). |
| Synthetic request marker | `evidence-origin.js:69` (`originFromRequest`) | The `x-flavorweave-data-origin: synthetic` header or `body.data_origin='synthetic'`. E2E helpers send it (`e2e/specs/helpers.js:154,161`), as does `scripts/eval-alpha-live.mjs:64`. |
| Name rule | `src/index.js:114` (`nameMarksSynthetic`) and `:311` | A display name starting `[synthetic]` forces synthetic, plus `acquisition_source='synthetic_qa'`. |
| Fixture name patterns | `scripts/cleanup-synthetic-households.mjs` (`SYNTHETIC_NAME`) | `E2E Kitchen`, `D06 Eval Synthetic …`, `D06 eval …`, `D06 Prod Smoke Synthetic`, `D05 prod smoke <date>`, `[synthetic]…`. |
| Row origin | `data_origin` on `dinner_plan`, `dinner_plan_meal`, `dinner_plan_rating` and `event` (`0011:35–130`, `0009:475–490`) | Activity rows carry their own origin. |
| Canonical predicates | `sqlRealHousehold` (`evidence-origin.js:129`); `sqlRealRow` (`:134`); `householdIsSynthetic` (`:82`); `countsTowardOps` (`:122`) | The household must be explicit `household` and not a QA source, and so must the activity row. |

### 1.2 Real vs synthetic (E2E/QA)
A household is **synthetic** when any of the following holds:
- `data_origin='synthetic'`
- `acquisition_source` is one of the five QA values
- the display name matches a fixture pattern. This is belt-and-braces: these households should already be synthetic through the header.

Each activity row must also be `data_origin='household'`. A real household's synthetic rows come from the eval scripts, which send the header, and must not count.

### 1.3 Real vs legacy/unverified
- **`unproven`:** rows created before migration 0009 (the default, `0009:89`), still waiting for the human-reviewed stamp (`reviewedHouseholdStampSql`, `evidence-origin.js:214`). They never count (`learningRows` `:98`, `countsTowardOps` `:122`).
- **New rows on an unproven household:** `writeOrigin` stamps them `household` whenever a request exists (`index.js:278–293`). The household join (`sqlRealHousehold`) is therefore what keeps them out. **Every count must join `household`.** Filtering on the row's origin alone is not enough.
- **"Confirmed real" is not observable.** `data_origin='household'` means only "created by a live request that was not marked synthetic". A teammate testing by hand without the header or the `[synthetic]` prefix counts as real. There is no verified or confirmed flag and no reviewed date. The count is "real-by-marker", and Oversight must reconcile it against its own pilot roster offline. That reconciliation is a human step, and its output is a number, never an id.

### 1.4 Definition used below
A **counted household** satisfies `sqlRealHousehold(h)`, does not match a fixture name pattern, and has at least one `household`-origin activity row in the window.

---

## 2. Answer table

| # | Question | Answerable now? | Source (tables, fields, events) | Gap |
|---|---|---|---|---|
| 1 | Confirmed real households using the app | **Partly**. Real-by-marker yes; *confirmed* no. | `household.data_origin` and `acquisition_source` (`0009:73–106`) via `sqlRealHousehold` (`evidence-origin.js:129`). "Using" means at least one `household`-origin `event` (`0009:475`, index `(household_id, created_at)` `:493`) or `dinner_plan` row in the window. | There is no human-confirmed flag (1.3). Internal manual use looks real. `alphaOpsQueries().households` (`evidence-origin.js:171`) counts every real-by-marker household ever, with no activity window. |
| 2 | How many create plans | **Yes** | `dinner_plan` (`0011:35`): `created_at`, `data_origin`, `created_by_member_id`, joined to a real household. | The existing ops metric `alphaOpsQueries().plans` counts the **legacy** `plan` table, not `dinner_plan`, so it under-reports Cycle 3. The `plan_finalized` event (`public/app.js:7353`) is client-only. |
| 3 | How many use Shopping | **Yes, with a definition**: "started shopping" | `dinner_plan.shopping_started_at` (`0011:44`), set once by `start_shopping`, `line_purchased` or `line_already_have` (`src/lib/plan-contract.js:46`, `plan-mutations.js:375–376`). Supporting signals: `shop_export` and the `shopping_*` events (`household-shop.js` `SHOP_EVENT_PROPS`), and `shopping_opened` (`app.js:1915`, client, fires when the view opens). | `household_shop_list` and its lines have **no `data_origin`** (`0017:7–17`), so origin comes from the household join. List state is current-only, with no history. "Opened the list" and "used it" differ; `shopping_opened` is a view event and fires on every visit. |
| 4 | How many mark a meal cooked | **Yes** from state; events as a cross-check | `dinner_plan_meal.state IN ('cooked','partially_rated','fully_rated')` (`0011:66`; `COOKED_STATES` `plan-mutations.js:729`). Undo restores the prior state (`:785–802`), so state is already net of Undo. Events: `cook_recorded` minus `cook_undone` per meal (`funnelCookCompletionSql`, `evidence-origin.js:149`; emitted at `app.js:2934–2939, 3023–3030`). | There is **no cook timestamp** on the meal: `saveDinnerPlan` rewrites the meal's `created_at`/`updated_at` to `plan.updated_at` on every save (`dinner-plan-store.js:337–364`). Time of cook comes only from the event `created_at`. A concurrent non-cook write can silently revert a cooked meal (Risk 5b). Cook events are client fire-and-forget (`app.js:496–520`, `.catch(()=>{})`). |
| 5 | Meals with at least one rating | **Yes** | `dinner_plan_rating` (`0011:113–130`): `data_origin='household'`, `member_id` among the meal's active participants (`dinner_plan_participant.active`, `0011:106`). Equivalent to `countableRatings` (`plan-mutations.js:812`). | Concurrent writes can **delete** ratings (Risk 5), which under-counts. Rating `created_at` survives saves (`dinner-plan-store.js:393–410`). |
| 6 | Meals with all diners rated | **Yes** | `dinnerCompletedLoopSql()` (`plan-contract.js:326`): every active participant has a household-origin rating; the household and the rows are real. | Same under-count as #5. `dinner_plan_participant.active` is always written as 1 (`dinner-plan-store.js:372`), so "active" equals "listed participant". |
| 7 | "We made this" (`mark_cooked`) vs guided Finish (`finish_cook`) | **No** | Both call `recordCookedMeal` (`plan-mutations.js:739, 746, 762`). Neither state nor `cooked_recipe_version_id` records the op. `cook_recorded`/`cook_completed` props carry only `dinner_plan_id` and `meal_id` (`app.js:2933–2939`). | Needs `completion_source` on cook events (INSTRUMENTATION-PLAN.md). History from before the change stays `unknown` and must not be back-filled or guessed. |
| 8 | Exports that succeed (`shop_export`) | **Yes, as "export completed on this device"** | `event.event_name='shop_export'`, with `props_json` holding the closed set {type, ok, surface, stage} (`household-shop.js:1044–1047, 1100`). A success is `stage='succeeded'`; a legacy row with no stage counts only when `surface='shop_sheet'` and `ok=true` (`:1122–1135`). The server's `surface='api', stage='generated'` row (`household-shop-routes.js:459–466`) is **not** a completion. Image vs file split: `summarizeShopExports` (`:1142`). | Success is client-reported: clipboard written, share sheet resolved, or file saved (`app.js:5511–5629, 8918–9071`). It says **nothing** about import, cart or order. There is no idempotency key, and an event is lost if its POST fails. |
| F1 | Plan→Shop→Cook→Rate funnel | **Yes**, per household and per plan | #2 → #3 → #4 → #5/#6 joined on `dinner_plan_id` | It inherits gaps 3–6. |
| F2 | Shopping List→Export→Consumer Import→Cart Review | **First two stages only** | List: `household_shop_list`/`_line` (`0017`). Export attempted/succeeded: `shop_export` stages. | **Consumer Import and Cart Review are UNKNOWN.** They happen in a third-party app and nothing reports back. Never infer a cart or an order from an export. `grocery_handoff` (`0018:6–30`) is the integrated-provider path; it is mock-only and not Production-enabled (Part A registry), so it is out of scope for real-household counts. |

---

## 3. Notes per question

1. **Households using the app.** Report two numbers: *real-by-marker households with any activity in the window* and *real-by-marker households ever*. Also report the synthetic and unproven bucket sizes as counts, so the exclusion is visible. Never list households.
2. **Plans.** Count `dinner_plan` rows and distinct households with at least one row. `superseded_at` (`0018:39`) separates abandoned drafts from plans that were kept. Report both.
3. **Shopping.** The primary signal is plans with `shopping_started_at`, because the server sets it. Secondary signals:
   - households with at least one `shop_export` attempt
   - households with at least one `shopping_item_completed` event

   Do not use `shopping_opened` as "use".
4. **Cooked.** Primary: meals in a cooked state (net of Undo by construction). Secondary: net cook events. A difference between the two is itself a signal (section 7; query Q12).
5. **At least one rating.** Count meals with at least one countable rating, not rating rows. Taste rule: section 6.
6. **All diners rated.** Use `dinnerCompletedLoopSql` exactly. Do not use the legacy `completedMealLoopSql` (`evidence-origin.js:163`, which reads `plan.status='Rated'`). It is the legacy table and misses Cycle 3.
7. **Completion source.** Not answerable today. After instrumentation, count by `completion_source` on net `cook_recorded`. Rows without it are `unknown`.
8. **Exports.** Count succeeded rows by type and surface. Report "copied/saved/shared", never "sent to store" or "ordered".

## 4. Avoiding double counting

| Risk | Mechanism today | Rule for counting |
|---|---|---|
| **Retries, generally** | `apiPost` does not retry (`app.js:410–440`). `createEvent` uses `body.event_id` or else generates one (`index.js:871`), and `persistEvent` sends no `event_id` (`app.js:496–520`). | A lost response loses the event rather than duplicating it (S-06 doc `S-06-COMPLETION.md:29`). Event counts are lower bounds. |
| **Shopping adds** | `household_shop_requirement.client_request_id` with a unique partial index per list (`0017:78, 88–90`) | Count requirements and lines, not `shopping_item_added` events, for item volume. A re-tap with the same id is one row (e2e `s06-meal-completion.spec.js:326`). |
| **Undo / re-completion** | State: Undo restores the prior state (`plan-mutations.js:785–802`). Events: `funnelCookCompletionSql` nets `cook_recorded − cook_undone` per meal and counts net > 0 once (`evidence-origin.js:149–161`; test `s06-meal-completion.test.js:626`). | Prefer state. For event counts, always net per meal and never sum raw `cook_recorded`. Mark, undo, mark = 1; mark, undo = 0. |
| **Phantom `cook_undone`** | `sendUndoCook` emits `cook_undone` after a `revision_conflict` whenever the meal is back in its prior state, even if this device's Undo did not write (`app.js:2993–3004`). | Rare, because only the device that cooked holds the Undo record. Netting tolerates an extra −1 unless the meal is later re-marked, in which case it under-counts by one. Use the state count as primary. |
| **409 retries on completion** | Finish / We made this retry once after `revision_conflict` (`app.js:2899–2924`). Events fire only when the response says `completed` (`:2932`). A partner's completion opens rating with no event (e2e `s06-meal-completion.spec.js:452`). | One completion produces one `cook_recorded`. No adjustment needed. |
| **Duplicate completion events** | `cook_completed` and `cook_recorded` both fire per completion (`app.js:2933–2939`). | Count one event name only: `cook_recorded`, which is the one the funnel nets. |
| **Export stages** | One action can emit attempted plus succeeded/failed/cancelled, and the server adds `generated`. | Count only `stage='succeeded'` (plus legacy `shop_sheet ok=true`). Never count `generated`. |
| **Ratings** | `UNIQUE(meal_id, member_id)` (`0011:125`). Re-scoring replaces that diner's row in place (`plan-mutations.js:847–857`). | One row per diner per meal by construction. |

## 5. Funnels

### F1: Plan → Shop → Cook → Rate (household-level and plan-level)
| Stage | Evidence | Notes |
|---|---|---|
| Plan | `dinner_plan` row | real household + `household` row origin |
| Shop | `dinner_plan.shopping_started_at IS NOT NULL` | Shopping can be skipped (cook from pantry). Cook without Shop is valid. |
| Cook | at least one meal on that plan in a cooked state | state-based |
| Rate (≥1) | at least one countable rating on a cooked meal | |
| Rate (all) | `dinnerCompletedLoopSql` meal on that plan | completed meal loop |

Report each stage as a count of plans and of distinct households. Do not report it as a per-household trail.

### F2: Shopping List → Export → Consumer Import → Cart Review
| Stage | Evidence | Status |
|---|---|---|
| Shopping List | open `household_shop_list` with at least one line | Known |
| Export attempted | `shop_export` `stage='attempted'` | Known (client) |
| Export succeeded | `shop_export` `stage='succeeded'` | Known (client) |
| Consumer Import | — | **UNKNOWN**. Happens in a third-party app. |
| Cart Review | — | **UNKNOWN**. Never inferred from an export. |

Any future evidence for the UNKNOWN stages must come from consented, human-reported study data (the Part A consumer test kit), recorded as aggregate counts. It must not come from telemetry.

## 6. Taste counts only real per-diner ratings
- Taste reads `dinner_plan_rating` when it queries (`src/lib/recommendations.js:264`; `plan-contract.js:345`) and filters through `learningRows` (`evidence-origin.js:98`). Synthetic and unproven rows contribute nothing.
- Completion never creates a rating (`plan-mutations.js:739–744`; `S-06-COMPLETION.md:9`; test `s06-meal-completion.test.js:64`). Neither "We made this" nor Finish is Taste evidence.
- A score is one diner's own row: `member_id` must be a participant (`plan-mutations.js:834–835`). A synthetic score cannot replace a household score (`:843–845`).
- Measurement rule: Taste-evidence counts are **countable rating rows** (household origin, participant diner, real household). They are not cooks, exports or events. Rating *values* are never reported, only counts.

## 7. Known distortions (state them next to every number)
1. **Rating loss (Risk 5, escalated).** Overlapping saves can delete a committed rating. #5 and #6 are lower bounds, and Taste may be missing rows.
2. **Cook reverted by a concurrent non-cook write (Risk 5b, same root cause).** State-based #4 can be lower than the user experienced. Event-based #4 can count a cook that state no longer shows. Q12 measures the divergence.
3. **Client telemetry loss.** All cook and export events are client POSTs that fail silently. Event counts are lower bounds.
4. **Real-by-marker is not confirmed.** See 1.3.
5. **Small numbers.** With very few real households, any breakdown can identify a household. Report totals only. A breakdown by type or surface is acceptable only as totals across all households.

## 8. Experience → Evidence → Learning → Change

| Experience (what the household did) | Evidence (what we can count today) | Learning (what it can tell us) | Change (what it can drive) |
|---|---|---|---|
| Set up and came back | #1 real-by-marker active households | Whether any real household is active in a window | Pilot outreach and roster reconciliation (human) |
| Planned dinners | #2 `dinner_plan` | Whether planning is the entry point; drafts vs kept plans | Planner UX priorities |
| Shopped from the plan | #3 `shopping_started_at`; F2 stages 1–3 | Whether the list is used, and which export type completes | Export copy and type order (the Part A copy edits) |
| Got the list into a grocery app | **UNKNOWN** past "export succeeded" | Nothing automated | Consumer test kit sessions only (human-reported) |
| Cooked | #4 state; #7 after instrumentation | Whether "We made this" (no guided cook) or guided Finish carries completions | Whether guided cook mode earns its complexity |
| Rated | #5, #6 countable ratings | Whether every diner rates or one person rates for the table | Rating prompts; multi-diner flow (and the Risk 5 fix) |
| Taste improved | Countable rating rows only | Evidence volume behind recommendations | Recommendation tuning gates |
