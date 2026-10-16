# S-01 Architecture Decision Card — Canonical Shopping List

**Status.** Contract for S-02 and S-03. This file does not ship a migration.

**Decision.** FlavorWeave keeps one household shopping list. Recipe lines are a projection of the existing dinner-plan engine. Everyday items are typed by a person and parsed without an LLM. Trip marks stay on the line. Provider fulfillment stays on a handoff record. A handoff is not a purchase.

## Invariants

1. The household list is the canonical list. A provider page is a copy sent at a revision, not a second source of truth.
2. Recipe quantities still come from `scaleForDiners` and `aggregateContributions`. The LLM never emits a quantity. General-item parsing never calls a model.
3. `already_have`, `skipped`, `purchased`, sent-to-provider, in-a-provider-cart, and received are different facts. V1 stores only the facts we can support. See the state table.
4. A check on one ingredient never moves to another ingredient. Adaptation that changes `ingredient_id` retires the old line.
5. Plan changes after shopping has started still append `added` and `no_longer_needed` deltas. They do not clear a shopper mark.
6. A shopper quantity override survives a resync. The required quantity updates underneath it.
7. Nothing is dropped from the household list because a provider cannot accept it. The review screen shows what will stay home.
8. No automatic substitution. Allergen and diet limits are not sent to a provider to “filter” a product.
9. `dinner_shop_line` remains the plan projection written by `syncShopping`. S-02 copies that projection into the household list inside the same save. It does not make the UI read two competing lists.
10. Grocery code does not import `src/ai`, and `src/ai` does not import grocery code.

## Entities

S-02 writes these in the next migration (`0017`, name chosen then). The columns below are the contract. They are not SQL to apply in S-01.

### `household_shop_list`

One open list per household.

| Column | Rule |
|---|---|
| `shop_list_id` | Primary key. |
| `household_id` | The session household. |
| `status` | `open` or `archived`. At most one `open` row per household. |
| `revision` | Integer. Starts at 1. Bumps when line content that would be sent to a provider changes (names, buy quantities, units, which lines are included). A check-off bumps a separate `touch` time and does not by itself invalidate a link. See handoff staleness. |
| `dinner_plan_id` | The plan last projected. Nullable. The list is not owned by the plan and does not cascade-delete with it. |
| `created_at`, `updated_at` | ISO-8601. |

Archiving happens when a member starts a new list on purpose. Completing a dinner plan does not archive the list. Recipe lines whose meals are done follow the projection rules below. General items stay.

### `household_shop_line`

| Column | Rule |
|---|---|
| `line_id` | Primary key. New ids use prefix `hl_`. Do not reuse `sl_` ids. The plan line id stays on the projection. |
| `shop_list_id` | Parent. |
| `origin` | `recipe` or `general`. |
| `ingredient_id` | Required for `recipe`. For `general`, set only when `canonicalIngredient` returns a slug. |
| `general_key` | Required for `general` when `ingredient_id` is null. Lowercase collapsed text, max 80. |
| `display_name` | What the shopper sees. |
| `preparation` | Recipe prep notes, joined as today. Not part of identity. |
| `unit` | Normalized with the existing `UNIT_ALIASES`, or `unparsed`. |
| `quantity_required` | Engine quantity for recipe lines. Null for a general line the parser could not measure, and null for `to_taste`. |
| `quantity_override` | Shopper edit. Null means “use required”. |
| `list_state` | `open`, `already_have`, `purchased`, `skipped`. |
| `still_needed` | 1 when a recipe still contributes or a general item is still on the list. 0 when the plan dropped a recipe line. |
| `surplus_quantity` | Same meaning as today: how much the requirement fell. |
| `meal_ids_json` | Provenance for recipe lines. Empty for general lines. |
| `recipe_version_ids_json` | Versions that contributed. Recomputed on projection. Not a catalog write. |
| `category` | Closed display set below. Not a provider category. |
| `unparsed` | 1 when quantity or unit is not a number plus a known unit. |
| `note` | Optional shopper note, max 80. Not sent to a provider in V1. |
| `created_at`, `updated_at` | `updated_at` is the concurrency token. |

Identity for aggregation and for the unique key: `(shop_list_id, ingredient_id or general_key, unit)`.

**Buy quantity** shown and sent is `quantity_override` when it is a finite number, otherwise `quantity_required`.

### Recipe requirement (not a second table)

A recipe requirement is the scaled contribution that already exists:

- canonical `ingredient_id`
- `recipe_version_id` from the pin
- `meal_id` and `dinner_plan_id`
- unit and normalized quantity after `scaleForDiners`
- diner count = participants + guests for that meal
- adaptation already applied through `effectivePinnedIngredients`

S-02 does not store a contribution row. `contributionsFromMeals` remains the way to recompute the breakdown. The household line stores the sum, the meal ids, and the version ids. That is enough to explain “for miso salmon and tofu bowls” and to retire a line when the id changes.

When the open plan changes, `syncShopping` runs as it does now, then the save upserts recipe-origin lines:

- Same identity: update `quantity_required`, `meal_ids_json`, `display_name` only if the shopper has not renamed it, `preparation`, `still_needed`. Preserve `list_state` and `quantity_override`.
- New identity: insert `open`, `still_needed` 1, override null.
- Identity gone from the plan: set `still_needed` 0, keep the row and the shopper mark, append the existing delta on the plan journal.

General lines are never created or deleted by projection.

A completed plan stops contributing. The next open plan replaces recipe-origin lines using the same upsert. Lines left `still_needed` 0 remain visible under “No longer needed” until the member clears that section. Clearing hides them. It does not invent inventory.

### General items

Entry is a single text field, plus direct edits of name, quantity, unit, and note.

Parser, deterministic, no network:

1. Trim and collapse whitespace. Reject empty. Max 80 characters.
2. Read an optional leading quantity: integer, decimal, `a/b`, or `n a/b`.
3. Read an optional unit from `UNIT_ALIASES` only. S-02 may add `bag`, `box`, `roll`, `bottle` to that map as `package` **only** if the word is the whole unit token. Do not add a synonym dictionary for product names.
4. The remainder is the name. Run `canonicalIngredient` on it so “yellow onion” joins the recipe onion line when the unit matches. Prep words stripped by that function become `preparation`, matching recipes.
5. If the name is empty, reject with `item_name_required`. Do not store a bare number.
6. If quantity or unit is missing, store the line with `unparsed` 1 and a null buy quantity. Display the typed text. Do not invent `1 each`.

Direct edit writes the fields the person changed and clears `unparsed` when both quantity and unit are known. Editing a recipe line’s name does not change `ingredient_id`. A rename that should split the line is “Not the same item”, which retires the recipe line’s shopper mark in place and inserts a general line. That action is explicit.

### Trip state

| State | Who sets it | Meaning | Allowed in V1 |
|---|---|---|---|
| `open` | Default, or “Still need it” | Still to get | Yes |
| `already_have` | Shopper | Household says they have it for this list. Not a measured stock. | Yes |
| `skipped` | Shopper | Still required, not buying this trip | Yes. New. |
| `purchased` | Shopper, in the store or by hand | Shopper says it was bought | Yes |
| `still_needed = 0` | Engine | Plan no longer contributes this line | Yes. Orthogonal to `list_state`. |
| Sent to provider | Handoff row | We created a link at a revision | S-03. Not a line state. |
| In provider cart | — | Instacart’s UI after the user taps their button | **Not stored.** The API does not return it. |
| Provider purchased | — | Checkout inside the provider | **Not stored.** |
| Received | — | Delivery arrived | **Not stored.** Future order reconciliation only. |

`skipped` does not set `still_needed` to 0. A later plan increase still shows “Get more” if the line returns to `open`. `skipped` lines are omitted from a provider payload and shown on the review screen as “Leaving off”.

The UI must not say “Bought” for `already_have`, and must not say “Purchased” because a link was opened.

### Concurrency

`set_line_state` and general-item edits send the line’s `updated_at`. A mismatch is HTTP 409 `line_conflict` with the current line. The client shows that mark and does not retry blindly. Last-write-wins is not acceptable for two people in the aisle.

### Categories

Display only. Assigned by a closed keyword table in code, overridable by the shopper. Unknown stays `other`.

`produce`, `dairy`, `meat`, `bakery`, `pantry`, `frozen`, `household`, `other`.

Order on the list is that sequence, then name. Households cannot reorder aisles in V1. The column exists so a later preference does not need a new identity for the line.

### Future inventory (not in the migration)

Do not add columns for on-hand quantity, location, expiry, confidence, or deductions. The extension point is a later table `pantry_lot` keyed by the same `ingredient_id` or `general_key`, with `on_hand_qty`, `unit`, `location`, `expires_on`, `confidence`, and `source` (`manual` only at first). Deductions would be events against a lot, never a silent edit of `quantity_required`. `already_have` must not be migrated into a lot. It is a trip assertion and can be wrong.

The V1 primitive those features need is already in this card: a stable item key and an origin. See `S-01-FUTURE-READINESS.md`.

## Provider fulfillment, kept off the line

S-03 table `grocery_handoff`. Not created in S-02.

| Column | Rule |
|---|---|
| `handoff_id` | Primary key. |
| `shop_list_id`, `household_id` | |
| `revision_sent` | `household_shop_list.revision` at send. |
| `provider_id` | Registry id, V1 `instacart`. |
| `request_hash` | Hash of provider id, link type, and the ordered included lines (name, measurements, display text). No secrets. |
| `status` | `link_created`, `rejected`, `stale`, `expired`, `cancelled`. |
| `products_link_url` | Only a URL returned by the provider. |
| `expires_at` | When we know it. For Instacart, we set `expires_in` so this is known. |
| `retailer_key` | Optional note of what we displayed. Not proof the provider opened that store. |
| `error_code` | Our code plus the provider code when they sent one. |
| `created_by_member_id`, `created_at` | |

No `order_id`, no cart id, no per-line availability. Add a column only when a capability that returns that field is production-enabled.

**Idempotency.** The same `request_hash` and a `link_created` row that is not stale or expired returns the existing URL. Instacart’s own best practice is to cache the URL until the list content changes (documented 2026-10-16, create-shopping-list page).

**Staleness.** A revision bump marks `link_created` handoffs for that list `stale`. It does not delete the URL and does not call the provider. The shopper is told the link is out of date and can send again, which inserts a new handoff.

**Cancelled.** The shopper cancels on our review screen before navigation, or revokes a link we still consider current. We cannot delete the page on Instacart’s side. Status `cancelled` means FlavorWeave will not present it. The URL may still work until it expires.

**Reconciliation when the list changes after handoff.** Compare `revision` to `revision_sent`. Show the existing delta language (added, no longer needed, more, less). Do not pull a cart. Do not mark lines purchased. Lines the shopper checks in FlavorWeave stay user-asserted.

## What S-02 must not do

No provider HTTP client, no secret, no `GROCERY_PROVIDERS` value, no handoff table, no change to catalog tables, no change to diner-count math.
