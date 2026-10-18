# S-06 — Meal completion and rating recovery

**Status.** Implemented. No migration. Plan JSON remains the meal record.

## Lifecycle

`planned` → `selected` → `cooking` → `cooked` → `partially_rated` → `fully_rated`.

Only an explicit “We made this” or guided Finish writes `cooked`. Completion does not create a rating. A rating is still one diner’s score. Taste evidence still requires those rating rows. `countsTowardCompletedMealLoop` stays false until the meal is `fully_rated` by its participants.

Skipped, abandoned, leftovers, and eating out are not cooked. `mark_cooked` rejects them. `finish_cook` still accepts only `cooking`.

## One write

`recordCookedMeal` is the only function that sets `cooked` and `cooked_recipe_version_id` (from `recipe_version_id` when that pin is empty). `finish_cook` and `mark_cooked` both call it.

`mark_cooked` accepts `planned`, `selected`, and `cooking`. A meal already `cooked`, `partially_rated`, or `fully_rated` returns success with `unchanged` and `already_cooked`. It does not insert a rating and it does not bump `updated_at`.

Neither op writes guided-step progress, a cook duration, or equipment use. Adaptation and pinned steps are left as they were. The step lives in `sessionStorage` (`fw_cook_step:{planId}:{mealId}`) on this device and tab. A successful completion clears that key and the open cook meal. Undo of a guided Finish writes the step back and reopens the kitchen on this same tab. Undo of “We made this” returns to the screen that logged it (Home, Tonight, or History) and does not reopen the kitchen. Sign-out clears the key. Another device or a new tab starts without it.

`MUTATION_EFFECTS` for `finish_cook`, `mark_cooked`, and `undo_cook` is `none`, so the shopping projection is not rebuilt. `saveDinnerPlan` does not clear `superseded_at`. A historical completion cannot become the current plan and cannot change the household list.

## Idempotency and concurrency

The client sends `expected_state` and `expected_updated_at` on cook ops.

- A stale `expected_updated_at` is `revision_conflict` (409) before the write.
- Inside the existing `saveDinnerPlan` batch, a compare-and-swap sets `dinner_plan.household_id` from a subquery that matches `updated_at`. A hit writes the same household id. A miss selects NULL. `household_id` is already NOT NULL, so that check aborts the batch. `db.batch` is one transaction, so the child-row rewrite rolls back with it and the other member’s meal state and `updated_at` stay. The CAS statement is the only assignment of `household_id` in that batch. No new column.
- A second `mark_cooked` after success is `unchanged`. The client emits `cook_completed` and `cook_recorded` only when the response says `completed`. A lost first response followed by a retry therefore misses the event rather than recording it twice.
- Undo emits `cook_undone` through the same event post, with the meal id in `meal_option_id`. The household funnel’s `cook_recorded` count is not a raw event total. It counts a meal at most once: `cook_recorded` rows minus `cook_undone` rows for that meal, and only when the net is still positive. Mark, undo, mark is one completion. Mark then undo is zero.
- Cook events carry `completion_source` (`mark_cooked` or `finish_cook`). The server keeps only those two values. Events recorded before S-07 have none and count as `unknown`; they are never back-filled.
- Two members who both pass the pre-check still serialize on the compare-and-swap. The loser reloads. If the meal is already cooked, the client opens rating and does not emit a second completion event.
- A 409 applies the returned plan, so the stored stamp moves forward. If that meal is still in a state the action accepts, Finish or We made this retries once with the fresh stamp. A second 409 stops. It does not loop.
- Cook ops for one meal run one at a time. Finish waits for an in-flight begin cook and uses the stamp that comes back.
- In-flight taps for the same plan, meal, and op are dropped on the client.

## Undo

`undo_cook` is separate from `exit_cook`. Exit always returns `cooking` to `planned`. Undo restores the state that completion left (`planned`, `selected`, or `cooking`) and clears `cooked_recipe_version_id`.

- Offered for about 9 seconds, or until a score is tapped. It is an inline row under the “How was it?” heading, so it does not cover that heading or the scores. The row is a live region (`role="status"`, `aria-live="polite"`). The control is a 44px button, “Undo, this dinner is not cooked yet”.
- The server requires `expected_updated_at` (`undo_requires_revision` when it is missing, `revision_conflict` when it is stale) so the save compare-and-swaps. The meal must still be `cooked` with no countable rating (`undo_not_cooked`, `undo_blocked_rating`). Undo is also refused when the plan’s `updated_at` is older than three minutes (`undo_expired`). That stamp is the plan row, and any write to the plan bumps it. It is not a cook-only timestamp. No new column.
- A conflict on Undo refreshes the plan and shows a calm message. It does not send Undo again.
- A score tap seals Undo. The server also refuses Undo when a countable rating exists, or when the meal is `partially_rated` or `fully_rated` (`undo_blocked_rating`). Ratings are not deleted.
- Leaving the rating screen does not seal Undo on this device and tab session. The window keeps running here only. Another device or a new tab does not show it.
- A second Undo, once the meal is already back in `prior_state`, is `undo_not_cooked`. It does not write.
- A stale `expected_state` or `expected_updated_at` is a conflict. It does not reverse a newer outcome.
- If Undo is in flight and a rating lands first, the server blocks Undo. If Undo lands first, `rate_meal` rejects the score because the meal is no longer cooked. Ratings are compare-and-swapped since S-07.
- Opening “Rate it” later does not offer Undo.

## Back from rating and the kitchen

Rating’s Not now control, Save for later, and the browser Back button use the same real screen. Home returns Home. Tonight, including the older `tonightPlan` origin, returns Tonight (`choices`). History returns History. The finished-cooking screen returns there. Guided Finish returns to Tonight and never to the kitchen.

An unknown view name opens Home. The client reports one `unknown_view` error, classified as `expected_guard`.

Cook mode does not render a meal that is already `cooked`, `partially_rated`, or `fully_rated`. Reaching it opens the rating screen (or Tonight when that meal is not on the open plan). The in-kitchen Exit control still leaves a meal that is actually cooking. Browser Back from the kitchen still opens the recipe.

## History

History includes `cooking`, `cooked`, `partially_rated`, and `fully_rated`. `planned` and `selected` appear only when that plan’s `superseded_at` is set, so the current week is not copied into History. A recoverable row offers “We made this”. A cooked or partly rated row the diner has not scored offers “Rate it”. A fully rated row adds nothing. The client does not call `applyDinnerPlan` for a historical plan response.
