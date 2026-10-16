# S-01 Premium Shopping UX Decision Card

**Status.** Visual and interaction contract. Opus-style judgment is not required to reopen it. The screens were drawn against `public/styles.css` and `docs/FLAVORWEAVE-BRAND.md`, read 2026-10-16.

**Decision.** Shopping stays the `shopList` task. It does not become a sixth tab. It does become the household’s list: dinners and everyday items together, then a clear choice to walk the aisle or send the list out. It should feel like the rest of FlavorWeave: warm paper, one coral action, food-scale type, no dashboard and no embedded checkout.

Wireframes: `docs/shopping/prototypes/board.html` and `docs/shopping/prototypes/png/`. Tokens in `prototypes/proto.css` are the Signature values from `public/styles.css`. The wordmark is the real SVG. The Instacart control is a labeled slot, not a redrawn logo.

## What changes relative to today

The current screen is a two-column ingredient checklist titled “Shopping list”, with bought and already-have piles. Keep the row (circular mark, name, quantity, ⋯). Change the grouping, the title, the entry, and the ending actions.

Back: if the list was opened from Tonight or the plan, return there. If it was opened from Home, return Home. Opening a recipe from a line still returns to the list, as the alpha architecture card already requires. Do not call `select_meal`.

Chrome stays `focus` on the list so the tab bar does not compete with the sticky actions. Home and Tonight gain an entry, not a new destination id.

## Voice

Confident and short. “The list”, not “Shopping management”. “Shop in store” and “Order online”. “Already have” stays. “Bought” stays for a person’s check. Never “Purchased via Instacart”, “Partner”, or a delivery-time claim.

## 1. The list

Annotated in `png/01-list.png`.

Eyebrow is the existing `shopCookingHeadline` (“4 dinners · cooking for 2”). Title is **The list**. Progress is “9 to get”. A one-line add field sits under the title: placeholder “Add oat milk, paper towels…”. Submit on Enter. The parser result appears as a new row. Failures use the existing toast: “Add a bit more of a name.”

Groups, in order, only when non-empty:

1. **From the dinners** — aisle subgroups (Produce, Dairy, Pantry, …). Each row’s secondary line is the quantity and, when there is room, up to two meal titles. More than two collapses the way the sheet already does (“and N more”).
2. **Around the house** — general items. Same row. No meal subtitle.
3. **In hand** — `purchased`, `already_have`, and `skipped`, collapsed to a count with Show, matching today’s already-have disclosure.
4. **No longer needed** — `still_needed` false. The current sentence stays: “Your plan changed. These stay so your checks aren’t lost.”

Quantity formatting stays `formatShopQty`. Do not snap cups to new fractions. A shopper override shows the buy quantity, and the ⋯ sheet says “Recipes need 2 cups” when that differs.

The ⋯ sheet keeps Already have, Mark bought, Still need, View recipe, and adds Skip this trip and Edit amount. View recipe only for recipe origin.

Empty: the current leftovers empty state when there are no lines at all. If the only lines are general, the dinner group is omitted. No illustration of a cart.

Sticky bar, two actions: **Shop in store** (coral, primary) and **Order online** (secondary). On a phone they stack. On a desktop width they sit at the end of the left column, not in a new toolbar.

Desktop keeps the 1024px two-column shop layout. From-the-dinners fills the left column. Around the house, In hand, and No longer needed fill the right. Do not introduce a filter sidebar.

## 2. Shop in store

`png/02-in-store.png`.

Same list, chrome still `focus`. Eyebrow becomes “In the store”. The add field remains. The primary control on each row toggles need and bought. The mark fills with the accent token, as `.shop-row__check.is-on` does today. Progress becomes “6 left”. The sticky bar is a single quiet **Done** that returns to the list’s parent. Done does not archive the list and does not mean the provider was paid.

Checked rows stay visible at the bottom of their aisle, name in secondary color, so a person can uncheck. They are not deleted.

## 3. Order online

`png/03-order-online.png` and `png/04-review.png`.

Step one, a sheet, not a new site:

- **Instacart** as the only named service, with the sentence “Continues on Instacart. They choose the store and the products.”
- If capabilities omit `instacart`: the row says “Not connected yet” and is not tappable. **Shop in store** is the way forward. This is the S-02 state.
- No Walmart, Amazon, or Whole Foods buttons until a registry row is tested. A “More stores later” line is meta text, not a button.

Step two, the review, only when Instacart is enabled:

- Title “Sending 8 items”.
- Included lines with the measurement we will send (`2 each`, not a hidden conversion).
- A block “Staying on your list” for already-have, skipped, invalid units, and unparsed lines. This is the missing-item contract.
- One line of unknown-availability copy from `S-01-MISSING-ITEMS.md`.
- The Instacart CTA is their dark button, 46px tall, radius 29.5px, label “Shop on Instacart”, on a white card. Official logo asset, 22px, not redrawn. Our coral button is not this control.
- Secondary: “Not now”.
- After navigation, if they come back, the list is unchanged except for any checks they make themselves.

A stale link uses the existing changes banner (“Your plan changed”) plus “Send the list again”.

## 4. Preferences

`png/05-settings.png`.

Settings → a **Shopping** card under Household, same card anatomy as Appearance’s neighbors.

- Household default: Shop in store, or Order online. Default is Shop in store. This is the sticky bar’s emphasis, not a lock. The other action remains.
- Preferred service: Instacart, or None. None is the default until a member picks it. Picking it does not create an account.
- Usual store: a short label the household types (“Market Street”). It is not a `retailer_key`. Shown on the review as “You usually shop at Market Street. You’ll confirm the store on Instacart.”
- Postal code: optional, used only to ask Instacart for nearby names. A “Forget code” control clears it.
- This member’s favorite: the same fields on the member, pre-filling when they open Order online. A one-time override on the review (“This time”) does not write the favorite.

No onboarding wall. Settings is the full control.

## 5. Optional onboarding

`png/06-onboarding.png`.

After the existing invite step, one optional card: “Where do you usually shop?” Two choices, Shop in store and Order online, and **Skip**. Skip writes nothing. Choosing stores the household default only. No postal code on this step. No Instacart account creation. The card uses the onboarding brand chrome already used for invite.

## 6. Sharing

`png/07-share.png`.

The overflow ⋯ opens the existing context menu, extended: Edit plan, Copy list, Share, Print, Download, Sharing link. The link row explains the 7-day expiry and “Dietary limits stay in your kitchen.” Stop sharing sits on that row when a link is active.

## 7. Missing-item recovery

`png/08-missing.png`.

The “Staying on your list” block is oat (`--color-surface-quiet`), not error red. A provider failure uses the same block with the title “The link didn’t go through” and the list still behind it. The person is never dropped onto a blank error screen. FlavorWeave did not fail to plan dinner. The outside list did not get created.

## 8. Add and edit

`png/09-add.png`.

The field is always on the list. Editing amount is a sheet with the existing field styles: quantity, unit select drawn from `UNIT_ALIASES`, save. Recipe lines show “Recipes need …” under the fields. Saving sets `quantity_override`. “Use the recipe amount” clears the override.

## Motion and themes

New surfaces use `--duration-base` and `--ease-standard`. Reduced motion kills the sheet slide if one is added; `dialog` showModal is enough. All five themes work because the shop uses tokens. The Instacart hex values are the exception, scoped to `.instacart-cta`, and they do not change per FlavorWeave theme. On Dark Mode the CTA stays Instacart’s dark specification on a white inset so their logo rules still have a light surface. That inset is the one place a white chip appears on the dark canvas.

## Acceptance for a later implementation

- A household can add “paper towels”, see it under Around the house, check it in store, and still see recipe onions aggregated across dinners.
- Changing who is eating updates recipe quantities and does not wipe bought, already-have, skipped, or an override.
- Order online, while the flag is off, offers the store and does not call the network.
- The Instacart button, when shown, is their control, and no sentence says partner or a delivery time.
- Two members cannot silently overwrite a check.
- Print and the public link contain no diet limits.
