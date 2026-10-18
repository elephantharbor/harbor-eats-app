# S-07: Technical risk register (S-06 concurrency caveats plus escalated entry 5)

**Basis.** I checked every claim against `origin/main` e57f464 (S-06 Production build, main bc11084; #95 changed only DEPLOYMENTS.md).
- Behaviour claims marked **(reproduced)** were run locally against in-memory SQLite with synthetic ids: `repro/s07-concurrent-rating-repro.test.js`, five cases.
- No Production query was run and no backup was read.

| # | Risk | Severity | Status |
|---|---|---|---|
| 1 | Undo is bound to the plan-level `updated_at` (3-minute server window, `expected_updated_at` CAS) | Low | Accepted (S-06) |
| 2 | Non-cook plan operations are last-writer-wins | **Medium → High** (it causes 5 and 5b) | Resolved in S-07 (remediated) |
| 3 | A stale rating can interact with Undo, and the rating is preserved (`undo_blocked_rating`) | Low | Resolved in S-07 (remediated) |
| 4 | Guided-cook progress lives in `sessionStorage` | Low | Accepted (S-06) |
| 5 | **Concurrent rating loss**: overlapping saves delete a committed rating. 5b: a cooked meal can be reverted the same way. | **High** (data loss, Taste evidence) | Resolved in S-07 (remediated) |

---

## Risk 1: Undo uses the plan-level `updated_at` (3-minute window, CAS)

**Verified in code.**
- **Window.** `UNDO_COOK_WINDOW_MS = 3 * 60 * 1000` (`src/lib/plan-mutations.js:732`).
  - `cookUndoStillOpen` measures the age of **`plan.updated_at`**, not the cook time, and allows 60 s of clock skew (`:804–810`).
  - `undoCook` refuses in this order (`:785–802`):
    1. `undo_blocked_rating` (`:791–793`)
    2. `undo_requires_revision` (`:794`)
    3. `revision_conflict` (`:795–796`)
    4. `undo_not_cooked` (`:797`)
    5. `undo_expired` (`:798`)
- **Pre-check.** `src/lib/dinner-plan-routes.js:239–245` returns a 409 with the current plan.
- **CAS.** `routes:262–264` passes `expectedUpdatedAt` for cook ops only. `src/lib/dinner-plan-store.js:276–286` puts the CAS inside the batch: a stale stamp makes `household_id` NULL and aborts the transaction. `:472–480` maps that to `revision_conflict` and calls `logRevisionConflict`.
- **Client.** It offers Undo for about 9 s, and a score tap seals it (`public/app.js` around 8481–8483). On a 409 it applies the returned plan and does not resend (`app.js:2993–3011`). The doc matches this at `docs/meal-loop/S-06-COMPLETION.md:40–46`.

**Affected workflows.**
- Undo after "We made this" on Home, Tonight or History (`app.js:7583, 3068`).
- Undo after guided Finish (`app.js:3090`).

**Realistic user impact.**
- In a multi-member household, any other write to the same plan during the about-9 s offer makes Undo fail with "Someone else already updated this dinner." Examples of such a write: a swap, a date change, a shopping check-off on the plan, or a rating.
  - The meal stays cooked. There is no "un-cook" later, except by hand through History, which offers no Undo.
- Because the window keys off the plan stamp, a later write also *reopens* the server window. The client bounds that to about 9 s, so this is not user-visible.
- No data loss. The only effect is an unwanted "cooked" state that stays.

**Detection signals.**
- 409 codes on `undo_cook`: `revision_conflict`, `undo_expired`, `undo_requires_revision`, `undo_not_cooked`.
  - The client reports API failures as `client_error` (`app.js` `noteApiFailure` → `reportClientError("api", code, "<path> <status>")`).
  - These appear, sanitised and aggregated, in `/api/health` `client_error_summary.signatures` over 24 h (`src/index.js:177–205`; `src/lib/client-error-class.js:130–159`).
- Server log `logRevisionConflict("dinner_plan_save")` (`dinner-plan-store.js:475`).

**Regression coverage.**
- Unit, `test/s06-meal-completion.test.js`:
  - `:142` restores the prior state and clears the cooked version
  - `:169` requires a matching revision, a cooked meal and a recent stamp
  - `:216` keeps a rating and refuses to undo
  - `:228` does not reverse a newer state
  - `:338` a stale cook write rolls back
  - `:407` a stale `expected_updated_at` leaves the other member's write intact
  - `:560` rejects Undo without a revision and after the window
- E2E, `e2e/specs/s06-meal-completion.spec.js`: `:123` We made this then Undo; `:646` Undo after guided Finish.

**Remediation triggers.**
1. `revision_conflict` or `undo_expired` on `undo_cook` makes up a noticeable share of Undo attempts in `client_error_summary`, for example more than 1 in 10 over a week with real households.
2. A pilot report of "couldn't undo".
3. Any proposal to offer Undo for longer than about 9 s or from History. That needs a per-meal cooked-at stamp. Plan JSON can carry it without a migration, but the design must be reviewed.

---

## Risk 2: Non-cook plan operations are last-writer-wins

**Status.** Resolved in S-07 (remediated) for ratings and cooked state. Non-cook edits retry up to 3 times, then return 409 revision_conflict.

**Verified in code.**
- `COOK_OPS` = finish_cook, mark_cooked, undo_cook (`dinner-plan-routes.js:28`). Every other op saves with `expectedUpdatedAt: null` (`:262–264`).
- `saveDinnerPlan` replaces the whole plan document. It deletes and re-inserts meals, participants, adaptations, ratings, shop lines, deltas and votes (`dinner-plan-store.js:330–466`).
  - `dinner_plan_rating.meal_id … ON DELETE CASCADE` (`migrations/0011_cycle3_dinner_plan.sql:115`). Deleting the meals deletes their ratings.
  - Each request loads the plan once (`routes:219`), mutates in memory (`:246`) and writes its snapshot.
- Not affected: the household shopping list (`household_shop_*`). It has its own per-line `updated_at` check (`line_conflict`) and `household_shop_cas` (`docs/shopping/S-01-ARCHITECTURE-DECISION-CARD.md:125`; `migrations/0017_household_shop.sql`).

**Affected workflows.** Every plan op except the three cook ops:
- swap / add / remove meal
- `set_date`, reorder
- participants, guests
- adaptation apply/clear
- leftovers / eating out
- vote, finalize, count, planning preferences
- `start_shopping`, `set_line_state`
- skip / abandon / fulfil
- **`rate_meal`**, which leads to entry 5

**Realistic user impact.**
- Two members editing the same plan within one request's load-to-commit time (milliseconds to a few hundred ms) silently lose one edit, and both get HTTP 200.
- The accepted reading was "one of two concurrent edits wins". The code goes further: the losing snapshot also overwrites **unrelated** rows that were committed in between. That includes ratings (entry 5) and cooked states (5b).

**Detection signals.** None. No 409, no log line and no event. Indirect hints only:
- PROPOSED-AGGREGATE-QUERIES.md Q12: event-cooked but state-not-cooked
- Q7b: a rise in partially rated meals
- user reports

**Regression coverage.**
- None for concurrent non-cook writes.
- Cook-op CAS coverage exists (`s06-meal-completion.test.js:338, 407`).
- Existing `rate_meal` tests are all sequential: `cycle3-contract`, `s06-meal-completion`, `multi-diner-journey`, `household-state` and `current-plan-supersede`.

**Remediation triggers.** Already triggered by entry 5. See the decision there. If Oversight defers the fix, the trigger becomes: any confirmed lost rating or lost cook, or Q12 `event_cooked_state_not` > 0.

---

## Risk 3: A stale rating can interact with Undo, and the rating is preserved

**Status.** Resolved in S-07 (remediated).

**Verified in code.**
- `undoCook` refuses when the meal has any countable rating or is `partially_rated`/`fully_rated`, returning `undo_blocked_rating` (409) (`plan-mutations.js:791–793`).
- `rateMeal` requires a cooked state, otherwise `rating_requires_cooked` (`:828–832`).
- The client seals Undo on any score tap (`app.js` around 8481–8483) and shows "A rating is in, so this stays cooked." on `undo_blocked_rating` (`:2984–2988`) or after a conflict that finds a rating (`:2993–3000`).
- Undo never deletes ratings, and no code path deletes a rating on Undo. **The claim holds for Undo.**

**Correction to `docs/meal-loop/S-06-COMPLETION.md:47` (reproduced).**
- Current text: "If Undo is in flight and a rating lands first, the server blocks Undo. If Undo lands first, `rate_meal` rejects the score because the meal is no longer cooked."
- The second sentence holds only when the rating request **loads** the plan after Undo commits.
- If the rating request loaded the plan **before** Undo committed and saves after it, the save has no CAS (Risk 2). It writes its snapshot: the meal is cooked again, `cooked_recipe_version_id` is restored and the new rating is kept.
- The Undo silently reverses. The Undo device has already shown "Back to where you left it" and emitted `cook_undone`.
- Repro: `undo_http=200 undone=true rate_ok=true final_state=partially_rated ratings=1`.

**Replacement text for line 47:**
> If Undo is in flight and a rating lands first, the server blocks Undo (`undo_blocked_rating`). If Undo commits first, a rating request that reads the plan afterwards is rejected (`rating_requires_cooked`). A rating request that had already read the plan before Undo committed still saves, because ratings are not compare-and-swapped: the rating is kept, the meal returns to cooked or partly rated, and the Undo is reversed without a message on the Undo device. Ratings are never deleted by Undo. (Tracked as TECHNICAL-RISK-REGISTER Risk 3 / Risk 5; resolved if the rating save gains the plan compare-and-swap.)

**Affected workflows.**
- Undo on one device while a partner rates on another within the about-9 s offer.
- On one device: an Undo tap still in flight when a score is tapped.

**Realistic user impact.**
- Rare: it needs two writes inside about 9 s and an overlap of under a second.
- No rating is lost. The visible effect is a dinner that "came back" as cooked after Undo. Measurement: event netting counts 0 cooks for a meal that has a rating (Q12 `state_cooked_no_event`).

**Detection signals.**
- `undo_blocked_rating` and `rating_requires_cooked` 409s in `client_error_summary`.
- The reversed-Undo case has no signal except Q12.

**Regression coverage.**
- Unit `s06-meal-completion.test.js:216` (a rating blocks Undo, sequential).
- E2E `:123`. A score tap seals Undo, implied by the flow.
- **No interleave test.** Proposed in BUILD-BRIEF optional section, test 3.

**Remediation triggers.** It is fixed together with entry 5 if the server CAS is adopted. Otherwise: any pilot report of "undo didn't stick", or Q12 `state_cooked_no_event` > 0 together with a rating.

---

## Risk 4: Guided-cook progress lives in `sessionStorage`

**Verified in code.**
- Key `fw_cook_step:{planId}:{mealId}` (`app.js:2250`); read, write and clear at `:2256, 2265, 2272`.
- Successful completion clears it (`releaseCookSession`, called at `:2944`).
- Undo of a guided Finish writes the saved step back and reopens the kitchen on the same tab (`:2943, 3031–3040`).
- Sign-out clears every `fw_cook_step:` key (`:9122, 9170`).
- The server never stores the step (`plan-mutations.js:783` comment; `S-06-COMPLETION.md:19`).

**Affected workflows.** Guided cook mode across a new tab, another device, a closed tab or sign-out. Undo after guided Finish on a different tab.

**Realistic user impact.**
- Opening the dinner on another device or tab starts at step 1. A partner cannot follow the cook's current step.
- No plan, rating or cooked-state data is affected.
- On iOS, a tab the OS discards can lose its `sessionStorage`. Cosmetic.

**Detection signals.** None server-side, by design. A user report ("lost my place") is the only signal. Do not add step telemetry without a privacy review.

**Regression coverage.**
- E2E `e2e/specs/s06-meal-completion.spec.js:646` (Undo after guided Finish returns to the same step on this tab; reads the key at `:761`).
- `:491` (Finish waits for an in-flight begin cook).
- `:247` (sign-out stacks).

**Remediation triggers.** Pilot feedback about losing their place, a multi-device cooking requirement, or any need for cook-duration analytics. The last two require server-side step state and a design review; plan JSON can carry it without a migration.

---

## Risk 5: Concurrent rating loss (ESCALATED, status: awaiting Oversight decision)

**Status.** Resolved in S-07 (remediated). The cooked-state loss (5b) is resolved in S-07 (remediated). Non-cook edits retry up to 3 times, then return 409 revision_conflict. Oversight approved the fix at 4:52 PM CT on Oct 18 2026.
**Detail.** ESCALATION-CONCURRENT-RATING-LOSS.md.

**Mechanism (verified).** `rate_meal` is not a cook op, so it saves with no CAS (`dinner-plan-routes.js:28, 262–264`). The whole-document replace then deletes all ratings through the meal cascade and re-inserts only that request's snapshot (`dinner-plan-store.js:334, 393–410`; `0011:115`).

**5a: lost rating (reproduced).**
- Two overlapping `rate_meal` requests for two diners on one meal: both return 200, one rating is stored, and the meal stays `partially_rated`.
- Route level, with 3 ms of simulated D1 latency per read: `http=200,200 stored_ratings=1`. Store level, deterministic interleave: same result.
- **Main trigger.** On one phone, every score tap fires `rate_meal` immediately and unqueued (`app.js` around 8480–8495; it does not use `enqueueMealCook` `:2747`). Tapping a score for diner A and then diner B within one round trip is the normal multi-diner flow.
- Any other non-cook op on the same plan, by any member, can also do it.

**5b: lost cooked state (reproduced; same root cause, found while verifying this register).**
- A `mark_cooked` that commits (response `completed: true`; the client emits `cook_recorded` and opens rating) is reverted to `planned` by a concurrent `set_date` on another meal that loaded before it: `completed=true m1_state=planned`.
- The user saw "cooked". The plan says planned. The events say cooked.
- If the reverted meal already had ratings in a newer state, the same path removes them.

**Not affected.**
- **Taste fabrication:** none. Taste reads ratings when it queries (`src/lib/recommendations.js:264`, `plan-contract.js:345`), so a deleted row just disappears.
- **Cross-household exposure:** none. Saves are scoped to their own `dinner_plan_id` and household.

**Affected workflows.** Multi-diner rating on one device (most likely). Partners rating on separate devices. Any concurrent plan edit during rating or cooking.

**Realistic user impact.**
- A diner's score silently disappears. The UI shows whichever response arrived last (`initPlanRatingsForMeal`, `app.js:6818`), so the user *may* see a diner as unrated and re-tap.
- The meal never reaches `fully_rated`, so no completed meal loop is counted. Taste has less evidence.
- Under 5b, a dinner the household logged as made shows as planned again.

**Detection signals.** None today: both requests succeed, and there is no 409, log or event. Indirect signals:
- Q7b partially rated meals in multi-diner households
- Q12 `event_cooked_state_not`
- user reports

After the server fix, `logRevisionConflict("dinner_plan_save")` would also fire for non-cook ops.

**Regression coverage.** None. All rating tests are sequential. The repro file supplies five cases to turn into tests.

**Remediation (proposed, pending decision).** Server CAS on every plan save with a bounded reload-and-reapply retry, a client per-meal queue for `rate_meal`, and three tests. No migration. See BUILD-BRIEF.md § Optional: Rating-loss fix.

**Decision owner.** Oversight. The options are:
- (i) include the fix in the S-07 PR
- (ii) ship a separate S-06 follow-up first
- (iii) defer, with the monitoring triggers above

**Measurement consequence until it is fixed.** Questions #4 (state), #5 and #6 are lower bounds. Mark every report with that caveat (OUTCOME-MEASUREMENT.md §7).
