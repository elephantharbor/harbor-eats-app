# S-02 Household Shopping Foundation

**Status.** Implemented on the household list. Not deployed. S-03 is not started.

One open list per household. Recipe amounts still come from `syncShopping` (`scaleForDiners`, `aggregateContributions`). This card does not add a second scaler. General items live only on the household list.

## Lifecycle

| Event | Recipe lines | General items |
|---|---|---|
| New plan, plan edit, meal swap, participants, guests, adaptation | Reprojected from the current plan’s shop lines. One row per ingredient and unit. | Untouched. |
| A dinner is cooked | Still on the list. `syncShopping` keeps cooked meals until the meal is skipped or abandoned, or the plan is completed. | Untouched. |
| Plan completed | That plan’s recipe requirements become no longer needed. Unmarked ones are removed. | Untouched. |
| Plan replaced | The previous plan’s recipe requirements are retired the same way. | Untouched. |
| Clear completed | Removes no-longer-needed rows, and purchased or already-have general items. | Open items stay. Skipped items that are still required stay. Purchased or already-have recipe rows that the plan still needs stay. |

Shopper states are `open` (currently needed), `purchased` (bought), `already_have`, and `skipped` (skipped this trip). `still_needed = 0` is “no longer required by the plan.” There is no trip archive.

An unmarked obsolete recipe requirement is deleted on the next projection so it does not accumulate. A shopper-settled row (bought, already have, skipped, or an override) stays under No longer needed until Clear completed.

## Reconciliation

Three quantities stay distinct: `quantity_required` (recipe), `quantity_manual` (typed), `quantity_override` (what the shopper set).

The buy quantity is the override when it is set and not stale. Otherwise it is required plus manual.

An override survives sync and never writes back onto the recipe. A change is material when the requested total moves by more than 0.0005, or when one side is empty and the other is not. On a material change the override value is kept, marked stale, and the buy quantity falls back to the fresh requirement. The row says “Recipes now need X. Your earlier amount was Y.” Keep my amount clears the flag and rebases it. Use the recipe amount clears the override.

Equivalent measured items (same ingredient id and unit) show one quantity and keep a requirement per source. Deleting the typed onion leaves the recipe onion. Unparsed units do not merge with a measured unit. A bare name has no invented unit. A bare number is rejected.

## Concurrency

The list has a monotonic integer `revision`. A write sends `expected_revision`. The batch’s first statement inserts into `household_shop_cas` only when that revision still matches. SQLite does not treat a TEXT primary key as NOT NULL, so the column is declared `NOT NULL`. A miss inserts NULL, the batch aborts, and the API returns 409 `revision_conflict` with the authoritative list and the attempted action.

Check-off sends the absolute state, not a flip. Add sends `client_request_id`. Apply again resubmits that same action against the new revision, so a retry does not duplicate a row or toggle twice.

`content_revision` moves only when the buy content changes. A check-off bumps `revision` and leaves `content_revision` alone, so a later handoff can tell a check from a quantity change.

## Connectivity

There is no offline queue. The checkbox does not move until the server returns 200. A dropped request leaves the add field as the person typed it. A 409 shows Apply again and does not drop the edit. Opening the list again refetches. That is the whole offline story.

## Sharing

`HE-SHOP-` plus 24 random bytes, hex. Separate from `HE-SHARE`. Seven days. Revocable. The public page is the snapshot taken at creation. Later items are not on it. Missing, expired, and revoked all return the same 404. The page and the API are `no-store` and `noindex`.

## What S-03 can do

Add `grocery_handoff` in migration 0018, an adapter, and the Instacart review inside the existing Order online sheet. The list, aisles, quantities, revision, and snapshot do not need a redesign. S-02 does not call a grocery API and does not store a handoff.
