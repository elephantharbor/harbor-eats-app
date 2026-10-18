# ESCALATION: two ratings saved at the same moment can lose one (origin/main e57f464; the code is the same as bc11084)

**Status.** Decided: fix shipped in S-07 (Oversight approval 4:52 PM CT Oct 18 2026).
**Production.** origin/main is now e57f464, "Deploy log: S-06 Production (0f812781, main bc11084) (#95)". That commit changes only DEPLOYMENTS.md, so this code path is the one deployed to Production.
**Data used.** None from Production. No D1 query was run and no backup was opened. The reproduction runs on an in-memory SQLite copy of the migrations, with synthetic ids, in /tmp. The repo was not modified.

## Finding
`rate_meal` is a non-cook op, so it is saved last-writer-wins. That save replaces the whole plan document, and the replace removes every rating row and inserts only the ratings in that request's snapshot. Two overlapping requests on the same plan, where at least one is `rate_meal`, can therefore delete a rating that was already committed. Both requests return HTTP 200 and neither returns an error.

## Code path
- `src/lib/dinner-plan-routes.js:28`: `COOK_OPS` = finish_cook, mark_cooked, undo_cook. `rate_meal` is not in it.
- `dinner-plan-routes.js:219`: the route loads the plan. Line 246 applies the mutation in memory. Lines 262–264 pass `expectedUpdatedAt` only for `COOK_OPS`, so `rate_meal` saves with no compare-and-swap.
- `src/lib/dinner-plan-store.js:334`: `DELETE FROM dinner_plan_meal WHERE dinner_plan_id = ?`.
  - `migrations/0011_cycle3_dinner_plan.sql:115` defines `dinner_plan_rating.meal_id ... ON DELETE CASCADE`, so this delete removes every rating on the plan.
  - `dinner-plan-store.js:393–410` then re-inserts only `meal.ratings` from that request's snapshot.
- `src/lib/plan-mutations.js` `rateMeal`: adds one diner's row to the snapshot it was given.
- `public/app.js` (score-tap handler, the `op: "rate_meal"` call near line 8489):
  - Every score tap fires `writeMealMutation` immediately.
  - It does not go through `enqueueMealCook`, so it is not serialized. On a two-diner rating screen, tapping diner A and then diner B quickly sends two overlapping requests from one phone.
  - After each response, `writeMealMutation` applies `res.plan`, and `initPlanRatingsForMeal` (app.js:6818) rebuilds the scores from it. Whichever response arrives last decides what the screen shows. The user may see one diner as unrated, but nothing tells them a saved score was removed.
- Other ways to hit it: any other non-cook mutation on the same plan that overlaps a rating save, from any member. Examples: swap, set_date, set_line_state, vote.
  - Cook ops are safe against this. Their CAS fails if a rating committed in between, then the client reloads.

## Reproduction (local, synthetic, deterministic)
`repro/s07-concurrent-rating-repro.test.js`. To run it, copy `git archive origin/main` to a scratch directory and use Node 22 for `node:sqlite`. Result:

```
REPRO sequential:  http=200,200 stored_ratings=2 meal_state=fully_rated
REPRO concurrent:  http=200,200 stored_ratings=1 meal_state=partially_rated   (route level, 3 ms simulated D1 latency)
REPRO interleave:  stored_ratings=1 meal_state=partially_rated                (store level, two snapshots)
```

No existing test sends two `rate_meal` requests at the same time. `git grep` finds `rate_meal` in cycle3-contract, s06-meal-completion, multi-diner-journey, household-state and current-plan-supersede, and all of them call it one after another.

## Why it is material (against the brief's stop conditions)
- **Lost ratings:** yes. A real diner's committed score can be removed with no error.
- **Fabricated Taste evidence:** no. Taste reads `dinner_plan_rating` when it queries (`src/lib/recommendations.js:264`, `plan-contract.js:345`). A deleted row simply vanishes. Nothing derived from it stays behind.
- **Cross-household exposure:** none found. Every save is scoped to its own `dinner_plan_id` and household.
- **Measurement impact:**
  - "Meals with all diners rated" and `countsTowardCompletedMealLoop` undercount, because the meal is left `partially_rated`.
  - Taste loses evidence.
  - No event or error records the loss, so it cannot be detected afterwards.
- The accepted S-06 caveat (b), "non-cook ops are last-writer-wins", does not mention ratings. `S-06-COMPLETION.md:43` says "Ratings are not deleted", and that holds for Undo only.
- Related, lower severity: `S-06-COMPLETION.md:47` says "If Undo lands first, `rate_meal` rejects the score".
  - That holds only when the rating request loads the plan after Undo commits.
  - If it loaded before, its save brings back the cooked state and keeps the rating. The rating survives, but the Undo is silently reverted and a `cook_undone` event has already been sent. The funnel then nets that meal to 0 cooks while it has a rating.

## Proposed fix (no migration)
1. **Server, primary fix** (`dinner-plan-routes.js`):
   - Save every mutation with `expectedUpdatedAt = plan.updated_at` as loaded. The CAS uses the existing `updated_at` and `household_id` columns, so no migration is needed.
   - On a `revision_conflict` for a non-cook op, reload the plan, re-apply the same action and save again, up to 3 attempts, then return 409 with the current plan.
   - Cook ops keep their current client-stamp behaviour.
   - Watch-out: two writes in the same millisecond produce the same ISO `updated_at`. Make the new stamp strictly greater than the loaded one, for example `max(now, loaded + 1 ms)`.
2. **Client, defence in depth** (`public/app.js` score handler): send `rate_meal` through a per-meal queue such as `enqueueMealCook(planId, mealId, …)`, or a per-plan queue, so one phone never overlaps its own rating writes.
3. **Tests:**
   - Add the route-level concurrent test from the repro to `test/s06-meal-completion.test.js`. Assert both ratings are stored and the meal is `fully_rated`.
   - Add a test for a concurrent `rate_meal` plus a non-cook op such as `set_date`.
   - Add an Undo-versus-rating test where the rating loaded before Undo committed.
4. **Detection meanwhile:** none exists. `logRevisionConflict("dinner_plan_save")` (dinner-plan-store.js:475) fires only for cook ops today. After fix 1, the same log becomes the signal for non-cook conflicts as well.

## Decision needed
- Should this fix go into the S-07 runtime PR, or ship as a separate S-06 follow-up first?
- Should I go ahead and write the four Goal B deliverables once you have decided? They would record this as a fifth risk-register entry and adjust the rating-completeness measures in OUTCOME-MEASUREMENT.md.

## Addendum (added 2026-10-18 while writing the risk register): two more cases with the same root cause, both reproduced
- **5b: a cooked state is lost.** A `mark_cooked` that commits (the response says `completed: true`, and the client emits `cook_recorded` and opens rating) is reverted to `planned` by a concurrent `set_date` on another meal that loaded before it. Repro: `completed=true m1_state=planned`.
- **Undo versus a rating that loaded before Undo committed.** The rating saves, the meal returns to `partially_rated`, and the Undo is silently reversed. No rating is lost, but `S-06-COMPLETION.md:47` is incomplete. Repro: `undo_http=200 undone=true … final_state=partially_rated ratings=1`.
- Both are covered by the same proposed server CAS (BUILD-BRIEF.md §7). Repro file: `repro/s07-concurrent-rating-repro.test.js` (5 cases).
