# S-01 Current State → Required Changes

**Status.** Assessment of the tree at `8b5a7e1`, read 2026-10-16. Not a runtime change.

**Production context.** `DEPLOYMENTS.md` records that production Pages and production D1 `23aa3db3-1090-471b-8c8a-b6fe71f5c053` received migration `0016_alpha_diner_adaptation` on 2026-10-12 (Pages deploy `8dbf56b6`). That migration alters `dinner_plan_meal` and creates `dinner_meal_adaptation`, so the dinner-plan shopping tables from `0011` were already on that database. **production-enabled** for the alpha list described below. This pass did not query D1. `docs/DATABASE.md` still says `0011` was not applied; that sentence is stale relative to `DEPLOYMENTS.md`. Do not “fix” it in S-01.

## 1. Shopping schema and D1

**accessible** `migrations/0011_cycle3_dinner_plan.sql`, `migrations/0016_alpha_diner_adaptation.sql`.

| Table | Role today | Verdict |
|---|---|---|
| `dinner_plan` | One household plan. Status `draft \| ready \| shopping \| active \| completed`. `shopping_started_at` is the shopping authority. | **Extend** the timestamp rule. Do not invent a second plan status for providers. |
| `dinner_plan_meal` | Slot: `recipe \| leftovers \| eating_out`. Pins ingredients and steps. `guest_count` from `0016`. | **Extend.** Recipe requirements stay derived from these pins. |
| `dinner_plan_participant` | Who is eating that meal. | **Keep.** Diner count reads this plus guests. |
| `dinner_shop_line` | One consolidated list **per dinner plan**. Unique `(dinner_plan_id, ingredient_id, unit)`. `list_state` is `open \| already_have \| purchased`. `still_needed`, `surplus_quantity`, `meal_ids_json`. | **Do not overload.** A household staple has no dinner plan. Cascades on plan delete. |
| `dinner_shop_delta` | `added \| no_longer_needed` after shopping has started. | **Keep** as the plan-change journal. Provider staleness is a different record. |
| `dinner_meal_adaptation` | Cook/shopping overlay. Catalog pin stays immutable. | **Keep.** Shopping already reads the overlay. |
| `shopped_plan_line` | Freeze of ingredients for the **legacy** `plan` row (`0010`). | **Leave alone.** `docs/CYCLE3-CONTRACT.md` says it is not the dinner-plan list. |
| `household.settings_json` | Spice and exploration prefs via `src/lib/household-settings.js`. | **Extend** with a closed `shopping` object for household defaults. No new household table. |
| `member` | No preference blob. | **New primitive** for a person’s favorites. |

`list_state` is a trip mark, not a pantry. The file header says so. There is no on-hand quantity, location, expiry, provider product, cart id, or order id.

## 2. Recipe ingredients

**accessible** `migrations/0012_catalog_runtime.sql` `catalog_ingredient`; `migrations/0010_cycle2_taste_contract.sql` `recipe_package_version.ingredients_json`.

A planned recipe copies the published version onto the meal (`pinned_ingredients_json`, `recipe_version_id`, `base_servings`). Later catalog publishes do not move the pin. **tested** by the Cycle 3 contract (`test/cycle3-contract.test.js` exists in the tree). **production-enabled** as part of the alpha deploy above.

Ingredient identity for shopping is **not** a grocery catalog. `src/lib/ingredient-identity.js` slugs the name, strips a small prep-word list, and aliases only `yellow-onion` → `onion`. Prep is not part of the id. Compatible units add. Incompatible units stay separate lines.

## 3. Aggregation, servings, diner scaling

**accessible** and **tested** (`test/alpha-diner-scaling.test.js`, `test/shop-display.test.js`).

- `diner_count = participant_ids.length + guest_count`, clamped 1–8. Guests are unnamed covers. `household.servings_default` is not read.
- `servingRatio = diner_count / base_servings`. `scaleForDiners` is the quantity function for detail, cook, and shopping.
- Volume and weight multiply and `roundQuantity` keeps 3 decimals. Countables use the shop path’s numeric quantity. Unit `serving`, or raw quantity exactly `for serving`, becomes one per diner.
- `contributionsFromMeals` skips non-recipes and meals in `skipped` or `abandoned`. Leftovers and eating out contribute nothing.
- `aggregateContributions` sums the same `ingredient_id` and unit.
- `syncShopping` in `src/lib/plan-mutations.js` rebuilds lines before shopping starts, and after `shopping_started_at` preserves `list_state`, writes deltas, and retires dropped lines with `still_needed = false` instead of deleting them.

**Keep this engine.** S-02 projects its output into a household list. It does not replace the scaler, the alias map, or per-dinner diner counts.

**Gap to close in S-02, not by rewriting the scaler.** After shopping starts, `syncShopping` writes the new required quantity onto the line. A shopper’s manual quantity edit would be overwritten on the next plan change. The household line needs `quantity_required` and `quantity_override` so an edit survives a resync. The existing “Get more / Less needed” tags in `src/lib/shop-display.js` stay the way a requirement change is shown.

## 4. Checked, purchased, already-have

**accessible** `set_line_state` in `plan-mutations.js`. The client may send `checked`; the server stores `purchased`. States are only `open`, `already_have`, and `purchased`. Marking either of the last two sets `shopping_started_at` once. It is never cleared.

The shop screen (`public/app.js` `renderShopList`) splits lines into still need (`open` + `still_needed`), bought (`purchased`), already have, and no longer needed (`still_needed` false). A dropped line whose state is still `open` is labeled “Skip it”. That label means the plan dropped it. It is not a shopper decision to skip a still-needed item.

**Missing truthful states**

| Idea | Supported today? |
|---|---|
| Shopper has it | Yes. `already_have`. Not a measured pantry. |
| Shopper bought it in person | Yes. `purchased`. User-asserted. |
| Plan no longer needs it | Yes. `still_needed = false`, plus a delta. |
| Shopper skips it this trip while the plan still needs it | No. |
| Sent to a provider | No. |
| Added to a provider cart | No. The API we would use does not tell us. |
| Provider purchased or delivered | No. Must not be inferred from a link. |

## 5. Household sharing and auth

**accessible** `src/lib/dinner-plan-routes.js`, `migrations/0003_member_sessions.sql`, `docs/DEEP-LINKS.md`. **production-enabled** with the alpha app.

Every dinner-plan route calls `requireSession`. The session is one member of one household. A body or query `household_id` that disagrees is `forbidden_cross_household`. Members of the household already see the same plan and the same `dinner_shop_line` rows. There is no per-member shopping list.

There is no `updated_at` check on `set_line_state`. Two phones can overwrite each other’s check. S-02 adds an `updated_at` precondition. No websocket, no new sync product. Refetch on focus stays the transport.

Invites (`/invite/HE-INV-*`) and choice-set shares (`/share/HE-SHARE-*`, table `share_choice`) are a different object: legacy plan options A/B/C, with status `active \| expired \| revoked \| consumed`. The shop overflow menu is “Edit plan” and “Ask the table”. Ask the table copies a dinner-plan URL. It is not a shopping-list share.

## 6. Shopping API

**accessible** routes in `routeDinnerPlanRequest`:

| Route | Behavior |
|---|---|
| `POST /api/dinner-plans/preview` | Plan preview. No list write. |
| `POST /api/dinner-plans` | Creates the plan and calls `syncShopping`. |
| `GET /api/dinner-plans` and `/current` | Household’s plans. Summaries omit lines. |
| `GET /api/dinner-plans/:id` | Full plan, including lines on the plan payload. |
| `GET /api/dinner-plans/:id/shopping` | Lines, deltas, `shopping_started_at`. |
| `POST /api/dinner-plans/:id/mutations` | All writers, including `start_shopping` and `set_line_state`. |

Line id is `sl_{dinnerPlanId}_{ingredient}_{unit}` (`shopLineId`). Unique across the database, not only inside the plan.

No `/api/grocery` route exists. The AI gateway (`src/ai/providers/contract.js`, `AI_TASKS_ENABLED`, `AI_PROVIDER`) is a different adapter. Grocery must not enter that gateway.

## 7. Recipe adaptation

**accessible** `src/lib/meal-adaptation.js` `effectivePinnedIngredients`. **tested** `test/alpha-adaptation.test.js`.

Apply is `apply_adaptation` / `clear_adaptation` while the meal is `planned` or `selected`. The model schema has no quantity. The server applies `keep_scaled`, `omit`, or `to_taste`. Safety rejects a substitute that breaks a participant’s hard limit. Shopping rebuilds from the overridden pin through `syncShopping`. A substitute that changes `ingredient_id` retires the old line and opens a new one. Checks do not move to a different ingredient. **Keep that rule** when the line moves to the household list.

`to_taste` and unresolved names stay off the summed canonical quantity. They must not be sent to a provider as a guessed product.

## 8. Telemetry

**accessible** `event` in `migrations/0001_init.sql`. The comment lists plan, cook, rating, invite, and share events. It does not list a shopping event. `dinner_shop_delta` is the shopping journal. `client_error` exists for client failures. Weave telemetry is privacy-safe and unrelated.

S-03 may add a closed `event_name` set. Props must not contain item names, postal codes, or provider payloads.

## 9. UI

**accessible** `public/index.html` view `shopList`, `public/app.js` `renderShopList`, `public/styles.css` `.shop-row*`. **production-enabled** with the alpha client.

The screen is a task view, not a tab. Chrome for `shopList` is `focus` (`public/nav-context.js`). Primary destinations are Home, Tonight, Find, History, Profile. Back from the list returns to Tonight (`choices`). The alpha architecture card already notes that a recipe opened from the list must return to the list.

Layout: eyebrow from `shopCookingHeadline` (“4 dinners · cooking for 2”), title “Shopping list”, progress “N to get · N bought · N already have”, two columns from 1024px, rows with a 28px circular check inside a 56px target, a ⋯ sheet (already have, mark bought, still need, view recipe), and a changes banner fed by unseen deltas. Empty state points at leftovers and nights out.

Visual system to reuse, not restyle: Signature canvas `#FFFDF8`, ink `#17393A`, coral `#F15D3C` for **our** primary actions, teal structure `#0F5D5B`, oat surfaces, Plus Jakarta Sans for UI text, the SVG wordmark for the name, 4px space scale, 52px controls, 44px minimum targets, radii 6–28px, motion 120/200/360ms. Source: `docs/FLAVORWEAVE-BRAND.md` and `public/styles.css` `:root`. Themes swap tokens. Components do not hard-code hex.

The list reads as a calm ingredient list. It does not yet read as a household shop: no everyday items, no aisle groups, no in-store versus online choice, no export.

## 10. Export and share

**accessible.** No `@media print`, `window.print`, or download helper under `public/`. Recipe detail and cook scale with `scaleForDiners` on screen. They have no print or download of the scaled recipe. External share that exists is the choice set and the invite, both documented in `docs/DEEP-LINKS.md`.

## Extend versus new

**Extend**

- Diner count, `scaleForDiners`, `aggregateContributions`, adaptation overlay, pin immutability, delta journal, `shopping_started_at`, session auth, household isolation, `shopList` view, shop row anatomy, `settings_json` for household defaults, `event` for a few closed names later.

**New primitives**

- One open household list that outlives a single `dinner_plan` and can hold non-recipe items.
- Origin `recipe | general`, shopper quantity override, and a shopper `skipped` state that is not “no longer needed”.
- `updated_at` conflict check for two shoppers.
- Provider handoff records, separate from the line, created only in S-03.
- Member shopping favorites.
- A shopping share token that is not `share_choice`.

**Do not build**

- A second aggregation engine, a grocery ontology, an LLM parser, a pantry table, or a provider call.
