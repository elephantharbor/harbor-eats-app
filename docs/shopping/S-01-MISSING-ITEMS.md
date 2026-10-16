# S-01 V1 Missing-Item Contract

**Status.** Contract for the review step and the in-store list. Deliberately small.

**Decision.** If a line cannot be handed off cleanly, it stays on the FlavorWeave list, the person sees why, and they can fix it or shop in store. V1 does not search another store, rewrite the dinner, or substitute a product.

## Cases

| Code | When we may set it | When we must not |
|---|---|---|
| `unavailable` | A provider response has an explicit unavailable flag for that line. | Instacart’s create call. It returns a URL, not per-line stock. Their UI may say an item is unavailable later. That is not our fact. |
| `unknown_availability` | We handed the line off and learned nothing about stock. This is the normal Instacart case. It is not an error banner on every row. The review copy says we don’t know what the store has. | Do not set it on in-store lines. |
| `partial_match` | A provider returns a match that is not an exact product id we sent. | Instacart V1. We send a name and get no match object back. The FAQ says name search can return a different variety, and that this is their matching. We do not label our line partial. |
| `invalid_qty_unit` | Our unit has no mapping, quantity is missing, or quantity is `<= 0`. | A successful mapping such as `count` → `each`. |
| `unsupported_category` | A provider documents a category it rejects and the line is in it. | Instacart. Their shopping-list concept page includes cleaning, laundry, pet, health, and party supplies. Non-food is allowed. |
| `provider_error` | The create call failed (`provider_rejected`, `auth_failed`, `timeout`, `rate_limited`). The whole handoff failed. Lines are not individually blamed unless `provider_code` points at one index, as their `1001` key `line_items[0]…` does. | A network failure is not “this onion is unavailable”. |
| `stale_link` | List `revision` is newer than `revision_sent`. | A check-off alone, which does not bump `revision`. |
| `cancelled_handoff` | Status `cancelled` on the handoff. | The person merely returned via the linkback. |

A provider that is only a website (`amazon`, a future Walmart link, Trader Joe’s) never gets `unavailable`, `unknown_availability`, or `partial_match` on a line. There is no per-item claim to make. The UI offers the in-store list and, later, an optional “open their site” that is not a handoff.

## Rules

1. Never remove a line because a provider failed or because the unit is unsupported.
2. Never auto-substitute. A hard limit (`constraint_rule`) makes substitution a safety action, and V1 does not have a safe automatic substitute. The existing adaptation flow remains the only way a recipe ingredient changes, and it is a person asking on purpose.
3. Never mark `purchased` from a handoff, a link open, or a linkback.
4. The canonical line stays the household line. Provider ids are not written onto it.
5. The person can edit the quantity or unit, skip the line, mark already have, or leave it off this handoff.
6. The fallback is always “Shop in store”, including for the lines that were left off.
7. Do not invent on-hand stock to explain a gap.
8. If we ever do learn an explicit unavailable fact, store it on the handoff line note, not by deleting the household line, and do not “correct” it to available when the link is rebuilt unless a new response says so.
9. URL-only means no availability sentence at all.

## Resolution UX

One calm block on the review screen, not a red failure page. Title: “A few items stay on your list”. Body names the items and the plain reason:

- “Garlic cloves need a unit Instacart accepts. Edit it, or grab it in the store.”
- “We couldn’t create the Instacart link. Your list is unchanged.”
- “This Instacart link is from an older list. Send it again when you want.”

Actions, in this order: Edit, Leave it off this link, Shop in store. No “Find another store”. No “Change the recipe”.

`unknown_availability` is a sentence under the Instacart button, not a per-line warning: “Instacart will show what’s at the store you pick. FlavorWeave doesn’t see that stock.”

## Extension points (not V1)

| Later idea | Where it attaches | Guard |
|---|---|---|
| Safe substitution | A person confirms a `recipe` adaptation. The existing safety check stays. | No allergen-bearing swap without that check. No swap from a provider suggestion. |
| Recipe change | The plan screen, not the missing-item block. | Missing item does not call the planner. |
| Another store | A second handoff only after that provider is production-enabled. | V1 has one online provider. |
| Package optimization | A later card that maps a measured quantity to a package size the provider returned. | Requires `product_match` in the response. Not Instacart’s link API. |
| Price comparison | Registry capabilities `price` on two tested providers. | One untested affiliate price is not a comparison. |

The block’s action row is a list in the client. S-03 ships Edit, Leave off, and Shop in store. Later actions are added only with a card. The empty slots are not buttons.
