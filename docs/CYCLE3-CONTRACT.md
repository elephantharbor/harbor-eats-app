# Cycle 3 contract

Shared planning domain for FlavorWeave Campaign Cycle 3 (D-01 Plan → Shop → Cook → Rate). Later workstreams implement consumer UI against this document. This workstream does not build that UI, does not call a model, and does not implement D-04, D-05, or D-06.

Branch: `feature/fw-c3-contract`. Workstream A. No pull request. Not merged to `main`. Not deployed. Production D1 `23aa3db3-1090-471b-8c8a-b6fe71f5c053` and Household 001 were not written. Migration 0011 was not applied to any D1 database.

D-01 is **In Progress**. This contract is not an acceptance.

## Ownership

| Path | Role |
|------|------|
| `src/lib/plan-contract.js` | Status names, intent parser, history, Completed Meal Loop rule. |
| `src/lib/ingredient-identity.js` | Canonical ingredient id, unit compatibility, serving ratio. |
| `src/lib/dinner-planner.js` | Deterministic filler. No model. |
| `src/lib/plan-mutations.js` | Every plan change, including shopping rebuild and deltas. |
| `src/lib/dinner-plan-store.js` | Persistence. |
| `src/lib/dinner-plan-routes.js` | HTTP. Household checks live here. |
| `migrations/0011_cycle3_dinner_plan.sql` | Tables. Apply only after 0010. |

Not owned here: `public/app.js`, the existing `/api/plans` Tonight loop, `shopped_plan_line`, and any screen that says Plan our dinners, What are we cooking tonight, or Find a dinner.

The existing `plan` table stays the single-round Tonight record. A dinner plan is a different row. There is one shopping list per dinner plan. `shopped_plan_line` remains the freeze for a legacy `plan` and is not a second list for these rows.

## One plan

A dinner plan belongs to a household, not to a diner. Plan our dinners, What are we cooking tonight, and Find a dinner are the same model. `entry_point` is `plan_dinners`, `tonight`, or `find_dinner`. A one-dinner flow is a plan whose `meal_count` is 1. It uses the same states, the same list, and the same mutations.

`meal_count` is an integer from 1 through 14, sent by the caller. A missing count is `dinner_count_required`. The phrase "this week" is not a count. The number 7 is stored only when the caller sends 7.

Dates are optional. A meal may stay undated. `set_date` assigns or clears `scheduled_date` and does not rebuild the plan, change cook order, or rewrite the shopping list. Position is display order. It is not a cooking sequence.

## Status

Internal API values. Conceptual labels are for people, not for new client copy.

| API `status` | Conceptual label | When it is used |
|--------------|------------------|-----------------|
| `draft` | Draft | Composing. Shopping has not started. Nothing is selected or cooking. |
| `ready` | Ready to shop | One member finalized. Shopping has not started. Nothing is selected or cooking. |
| `shopping` | Shopping | Shopping has started, and no meal is selected, cooking, cooked, rated, or fulfilled. |
| `active` | Active | At least one meal is selected, cooking, cooked, partially rated, fully rated, or fulfilled, and the plan is not complete. |
| `completed` | Completed | Every slot is closed. See history below. |

`presentDinnerPlan` adds `status_label` from that table. Clients should read `status` and `shopping_started_at`, not invent a parallel enum.

`shopping_started_at` is the shopping authority. Status `shopping` is only the label used before any meal has been pulled into tonight or cooking. After that, status becomes `active` and the timestamp stays.

## Shopping started

Shopping has started when the first of these happens:

1. `start_shopping` (the member starts shopping mode)
2. a line is marked `purchased` (`checked` is accepted as an alias)
3. a line is marked `already_have`

`shopping_started_at` is set once and is never cleared. Setting a line back to `open` does not undo it.

Before that timestamp, ingredient-bearing mutations replace the list. Lines are `open`. Deltas are cleared.

After that timestamp, the same mutations must not silently rewrite the list. They append `shop_deltas` of kind `added` or `no_longer_needed`. `list_state` (`open`, `already_have`, `purchased`) is kept. A line that is no longer needed stays on the list with `still_needed: false` so a purchased or already-have mark is not dropped.

Already-have and purchased are list states. There is no pantry table, no Instacart link, no price, and no aisle lookup. Current recipe metadata has no honest grocery area, so the list is ordered by ingredient id and unit.

### Mutations

All of these go through `applyPlanMutation`. Nothing else writes the list.

| Mutation | Before shopping | After shopping |
|----------|-----------------|----------------|
| `add_meal`, `remove_meal`, `swap_meal`, `set_participants`, `set_leftovers`, `set_eating_out`, `adopt_version`, `skip_meal`, `abandon_meal` | Replace the list | Append added and no-longer-needed deltas. Keep list state. |
| `set_date`, `reorder` | List untouched | List untouched |
| `select_meal`, `begin_cook`, `exit_cook`, `finish_cook`, `rate_meal`, `fulfill_meal`, `vote`, `finalize`, `set_count` | List untouched | List untouched |
| `start_shopping` | Sets the timestamp | Already started |
| `set_line_state` | Sets the line. `purchased` or `already_have` also starts shopping | Updates that line only. Does not rebuild. |

`skip_meal` and `abandon_meal` drop that meal's ingredients. `fulfill_meal` does not, because leftovers and eating out never added any.

## Structured intent

`parsePlanIntent` checks a structured object. It does not read a sentence and it does not call a model. D-06 can fill this object later. The same object is stored on the plan as `intent`.

| Field | Rule |
|-------|------|
| `dinner_count` | Required integer, 1–14. |
| `entry_point` | `plan_dinners`, `tonight`, or `find_dinner`. |
| `requested_ingredient` | Optional vocabulary slug or other token. |
| `max_cook_minutes` | Optional number. A soft boost, not a ban. |
| `meal_styles` | Optional vocabulary slugs. A soft boost. |
| `participant_ids` | Diners for slots that do not name their own. |
| `practical_hints` | `{ hint_key, detail }` using the Cycle 2 hint keys. `equipment` requires `detail`. |
| `slots` | Optional per-slot `{ participant_ids }`. |
| `scheduled_dates` | Optional. Shorter than the count is allowed. Null means undated. |

`planDinners(intent, context)` returns one slot per count:

- `source` is `deterministic` and `model` is null.
- The candidate set is the current 24-meal catalog unless a caller passes `context.catalog`. A result never names a slug outside that set.
- Hard limits use `isOptionEligibleForHousehold` and `decideEligibility` for that slot's participants only. Tastes, ratings, and hints are passed into eligibility and do not grant permission.
- Taste ranking uses `scoreDinerTastes`. Love and Like raise a meal. Less often lowers it and does not remove it.
- Diversity (cuisine, meal style, flavor, key ingredient, recent slugs) applies inside a taste band, so a clearly better taste fit is not dropped to vary the plan.
- `under_30_minutes`, cook-time, equipment, and grill use real minutes, equipment, and methods. `low_cleanup` and `weeknight` are carried and reported in `unscored_hints` because the catalog has no honest field for them.
- A requested ingredient with zero catalog matches is `constrained_requests[]` with `invented: false`. Slots are still filled with eligible meals.
- A slot with no eligible meal, or no unused eligible meal, is `result: "constrained"` and `recipe_slug: null`. It is never a meal that breaks a hard limit.

`swapSlot` replaces one index. The other slot objects are returned as the same references, including their `recipe_version_id`.

## Meals

| `kind` | `state` values | Shopping | Rating |
|--------|----------------|----------|--------|
| `recipe` | `planned`, `selected`, `cooking`, `cooked`, `partially_rated`, `fully_rated`, `skipped`, `abandoned` | Scaled pin | Required for a full close |
| `leftovers` | `planned`, `fulfilled`, `skipped`, `abandoned` | None | Not accepted |
| `eating_out` | `planned`, `fulfilled`, `skipped`, `abandoned` | None | Not accepted |

A slot on the plan is `planned` until someone selects it. `selected` is tonight's meal. It is not cooked. `begin_cook` moves `planned` or `selected` to `cooking`. `finish_cook` is the only way to reach `cooked`. `exit_cook` returns to `planned` and does not cook. Any remaining planned meal can be cooked in any order. Reorder and dates do not change state.

Ratings are accepted only from `cooked`, `partially_rated`, or `fully_rated`. One household rating moves a meal to `partially_rated` until every active participant on that meal has a countable rating, which makes it `fully_rated`. A household member who is not a participant does not rate and does not block. A synthetic rating does not satisfy a household plan and cannot replace a household rating.

`skipped` and `abandoned` are different. Neither is cooked, rated, or fulfilled.

A recipe meal stores `recipe_version_id`, `pinned_ingredients`, and `pinned_steps` from the version resolved on the server. Client ingredient lists and an `eligible: true` flag are ignored. `resolvedRecipe` returns the pin. A later catalog version does not change ingredients, the shopping list, cook steps, or the rating's `recipe_version_id`. `adopt_version` is the explicit replacement, and only while the meal is `planned` or `selected`. After cooking, the version is locked to `cooked_recipe_version_id`.

`swap_meal` changes one meal. Other meals keep their pins.

## Participants and votes

Participants are stored per meal. Eligibility, servings, and who must rate use that list plus household-wide constraint rows. One diner's hard limit blocks the meal for that slot. It does not block a different slot whose participants clear the meal. Changing participants on an ineligible recipe is rejected. The meal is not silently swapped.

Servings use the same ratio as `scaleRecipeVersion`: requested diners divided by `base_servings`, with the requested count clamped from 1 to 8. Numeric pin quantities are multiplied by that ratio. They are not passed through the display-step rounder, so a quarter cup is not snapped to a half cup. String leftovers still go through `scaleIngredientQuantity`. A "for serving" line is not multiplied.

Votes use `dinner_plan_vote`. `votes_required` is always false. `finalize` records one member and moves a draft plan to `ready` even when `votes` is empty. Voting does not select a meal.

## Ingredients

`canonicalIngredient` lowercases the name, strips a leading or trailing prep word (diced, chopped, minced, sliced, grated, shredded, crushed, julienned, halved, quartered), and slugs the rest. The prep words and the recipe note are `preparation`. They are not part of the id.

### Shopping ingredient aliases

Obvious forms of the same purchasable item aggregate on one shopping id. Prep still becomes `preparation`; it does not fork the line. This is a small explicit map in `SHOPPING_INGREDIENT_ALIASES`, not an ontology. Pairs are added only when the current 24-recipe catalog actually uses both strings for the same buy.

| Recipe strings (after prep strip) | Shopping `ingredient_id` |
|-----------------------------------|--------------------------|
| `yellow onion` | `onion` |
| `diced onion`, `onion` | `onion` (prep strip only) |

Not aliased (different products or only one catalog string): `pickled red onion`, `green onions`, `olive oil` vs `neutral oil`, `sesame oil`, `garlic powder` vs `garlic`, `soy sauce` vs `fish sauce`, `lime` vs `lemon`.

Lines aggregate only when the canonical id and the normalized unit match. `tablespoon` and `tbsp` match. `cup` and `cups` match. `tbsp` and `cup` do not. Counts match counts. Unparsed quantities are not added together into a fake number.

## History and learning

`projectDinnerHistory` marks `completed` only for `fully_rated` (a cooked recipe) or `fulfilled` (leftovers or eating out). A planned meal is not completed. Skipped, abandoned, selected, cooking, cooked, and partially rated stay distinct from that.

A dinner plan is `completed` only when `meals.length === meal_count` and every slot is closed: recipe meals by `fully_rated`, `skipped`, or `abandoned`; leftovers and eating out by `fulfilled`, `skipped`, or `abandoned`. A closed plan can contain skipped meals. Those history rows are still not cooked.

Completed Meal Loop for this domain is narrower than plan completion. `countsTowardCompletedMealLoop` is true only when the meal is a recipe, state is `fully_rated`, the plan origin is `household`, the household is not synthetic, and every active participant on that meal has a household-origin rating. Other household members are not required. `dinnerCompletedLoopSql` is the same rule in SQL. Synthetic and unproven rows stay out of that count, taste learning, funnel, alpha ops, and traction. New dinner-plan rows default to `unproven` so a forgotten writer does not look like household evidence.

FW-01 on the existing Tonight plan is unchanged. Preview still does not select. A cooked Tonight outcome stays locked.

## Authorization

Every dinner-plan route requires a session.

| Case | Result |
|------|--------|
| Member of the plan's household | Allowed |
| Plan belongs to another household | `403 forbidden_cross_household` |
| Unknown plan id | `404 plan_not_found` |
| Participant id is not an active or invited member of that household | `403 forbidden_member` |

Constraints are loaded from `constraint_rule`. Tastes are loaded from `diner_taste` for ranking only. A body field named `constraints` or `eligible` does not change either decision. `data_origin` on create comes from the existing origin writer, not from a client claim that a synthetic request is household.

## HTTP

| Method and path | Role |
|-----------------|------|
| `POST /api/dinner-plans` | Create. `meal_count`, `entry_point`, and either `meals` or `fill: "planner"`. |
| `POST /api/dinner-plans/preview` | Planner only. Nothing is saved. |
| `GET /api/dinner-plans/:id` | Plan, history, lines, deltas. |
| `GET /api/dinner-plans/:id/shopping` | Lines, deltas, `shopping_started_at`. |
| `POST /api/dinner-plans/:id/mutations` | Body is one mutation `op` from the table above. |

The existing `POST /api/plans` route is unchanged.

## Migration 0011

`migrations/0011_cycle3_dinner_plan.sql` creates `dinner_plan`, `dinner_plan_meal`, `dinner_plan_participant`, `dinner_plan_rating`, `dinner_shop_line`, `dinner_shop_delta`, and `dinner_plan_vote`.

The first statements insert and delete a sentinel household with `data_origin = 'unproven'`, then read `taste_vocabulary`. The file fails if 0009 has not run, and it fails if 0010 has not run. It does not update existing household, plan, rating, or preference rows, and it does not default those rows to household. New dinner-plan origin columns default to `unproven`.

Do not apply 0008, 0009, 0010, or 0011 to production D1 in this campaign.

## Left for later workstreams

- Consumer UI for the three entry points, the list, cooking, and rating.
- D-04 native Back.
- D-05 model gateway. `planDinners` does not call one.
- D-06 natural language. The intent parser does not read a sentence.
- Publishing the 24 packages. The planner reads the current catalog projection. Unpublished is not treated as permission to invent meals.
- Replacing the Tonight `/api/plans` loop. It still runs.
- Acceptance of D-01. This branch does not claim it.
