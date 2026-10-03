# FW-01 root cause — meal / rating identity

**Status:** fixed on `feature/fw-c1-identity-metadata` (campaign cycle 1).
**Model:** Grok 4.7 (`grok-4.7`).
**Migration:** none for this bug. Identity is enforced in application code. `migrations/0008_evidence_origin.sql` is the evidence-isolation migration and is unrelated to the rating transfer.

## Symptom

A rating already given to Meal A showed up on Meal B after the household opened B’s recipe and entered, then left, cooking. Home, history, and the rate screen disagreed about which meal the score belonged to.

## What was wrong

The identity chain is plan → meal option → selection → recipe → recipe version → cook → rating → history → Taste evidence. Three separate bugs let a later inspection rewrite the earlier outcome.

1. **Opening a recipe selected it.** Choice cards used both `data-select` and `data-go="detail"`. Tapping Meal B called `selectMeal`, which set `selectedMealId` and posted `POST /api/selections` (or a vote with auto-resolve). Viewing was not distinct from choosing.

2. **The server treated every selection as the new plan outcome.** `createSelection` inserted another selection row, set `meal_option.selected = 1` on B, and forced `plan.status = 'Selected'` even when the plan was already `Cooked` or `Rated`. Vote resolution did the same flag and status flip when a selection already existed, and it did not keep the existing selection pointed at the cooked meal.

3. **Ratings were stored per person for the plan, then displayed on whichever option was flagged selected.** `loadMealHistory` joined `meal_option` where `selected = 1` and aggregated every rating for the `plan_id`. Meal A’s score therefore rendered on B, the last option marked selected. Household activity used the latest selection by `created_at` the same way. On the client, `state.ratings` was keyed only by `member_id`, so a snapshot copied every plan rating onto the members and the rate UI showed A’s scores while B was on screen. A later client-supplied `recipe_version_id` could also replace the version stored on the rating.

Entering cook mode for B did not need to finish cooking. The damage was done when B became the selected option and the plan was pulled back to `Selected`. Reload then read that flag, so A’s outcome appeared attached to B.

## Why the symptom appeared

Completed A → inspect B rewrote the selected flag and plan status. History and Home followed that flag and attached the plan’s ratings to B. Taste evidence and the rating row still had a score, but the read path did not bind it to A’s meal option and recipe version. Exiting B’s cook screen did not undo the selection.

## What changed

- **Preview is not selection.** Owner cards open recipe detail with `data-preview`. “Choose this dinner” is the only control that selects. Detail and cook screens load the previewed or in-progress meal, not a silent new selection.
- **Cook entry does not select or complete.** Starting steps on an unselected meal sets a cooking id only. Finish commits only when that id is the explicitly selected meal and the plan is not already cooked or rated. Leaving cook clears the cooking id and leaves selection and ratings unchanged.
- **Outcomes are locked on the server.** After a real cook or rating, a different meal returns `409 selection_locked`. The same locked meal is unchanged. Cook requires an explicit matching selection (`selection_required`); it does not create one. Rating requires the cooked meal. `recipe_version_id` already stored on a rating is kept.
- **Plan status does not move backward.** Selection does not downgrade `Cooked` or `Rated`. Cook does not downgrade `Rated`. If a cook and full ratings exist, household state reports `Rated` even when an older write left `plan.status` as `Selected`.
- **Reads follow the outcome, not the selected flag.** Resolution order is ratings, then the cook that matches them, then the earliest real cook, then the latest explicit selection. History, Home, and the rating ledger key scores by `meal_option_id`. Inspecting B cannot move A’s score.

## Required behavior this fixes

- Opening recipe detail does not mutate selection or history.
- Entering cook mode does not silently select or complete another meal.
- Selection is explicit.
- A rating stays bound to the meal instance and recipe version that were rated.
- Home, History, Taste evidence, and the learning rows for that meal agree.
- Inspecting Meal B after completing Meal A does not transfer A’s outcome to B.

Regression coverage is in `test/meal-identity.test.js`: completed A → inspect B → enter B cooking → exit without completion → reload, with A still rated and B unrated; navigation only; explicit selection; selection then abandonment; a second recommendation round.
