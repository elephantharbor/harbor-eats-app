# S-01 Sharing and Export

**Status.** Contract for S-02. No route is added in S-01.

**Decision.** Household members already share the list through the session. External sharing is a copy of names and quantities, plus an optional read-only link. It is not `share_choice`, and it does not reveal diet or medical limits.

## Household collaboration

The open `household_shop_list` is visible to every active member of that household. Invited members who have not joined have no session and do not see it. Writes use the line `updated_at` check from the architecture card. The client refetches the list when the view becomes visible. No new realtime channel.

“Ask the table” stays the dinner-plan vote link. The shop menu does not call it a shopping share.

## On this phone

The shop overflow menu gains:

| Action | Behavior |
|---|---|
| Copy | Plain text on the clipboard. |
| Share | `navigator.share` when present, with the same text. If it is missing or rejected, Copy stays. |
| Print | `window.print` of a print stylesheet. |
| Download | A `.txt` file and a `.csv` file. No PDF library. |

Text shape:

```text
FlavorWeave list
4 dinners · cooking for 2

Produce
2 yellow onions
1 bunch cilantro

Around the house
Paper towels

Already have
Soy sauce
```

Skipped lines are omitted from the default text and included under “Leaving off” if the person toggles them. No member names. No allergen line. No recipe method. Meal titles are included because they are already on the in-app list (“miso salmon”). They are not medical.

CSV columns: `section`, `name`, `quantity`, `unit`, `note`. Note is the shopper note, which they wrote knowing it is on the list. Still no constraint data.

Print uses the same grouping, Signature ink on white, and hides the tab bar, the Instacart control, and the add field. `@media print` lives with the shop view in S-02.

## Recipe print and share

Recipe detail and cook already scale with `scaleForDiners`. S-02 adds print and copy on a recipe that is open from a plan meal, at that meal’s diner count, and on a Find recipe at the on-screen serving control. The output is title, yield line (“For 3 people”), ingredients, and steps. It does not include household limits, the adaptation warning if that warning names a limit, or ratings.

The yield line uses `dinerExceptionCopy` when the dinner differs from the household. Guest counts stay numeric (“1 guest”). Guests have no names.

## Read-only link

New object `shop_share`. Do not reuse `share_choice` or `HE-SHARE` choice tokens. Those rows are plan options A/B/C.

| Column | Rule |
|---|---|
| `share_id` | Primary key. Token prefix `HE-SHOP-`. |
| `shop_list_id`, `household_id` | |
| `created_by_member_id` | Any active member may create or revoke. |
| `status` | `active`, `expired`, `revoked`. |
| `expires_at` | 7 days from creation. |
| `created_at`, `revoked_at` | |

`GET /shop/shared/HE-SHOP-*` is public and read-only. The worker SPA-fallback list gains that path, same pattern as `/share/*` in `docs/DEEP-LINKS.md`. The payload is the print text’s data: names, quantities, units, sections, meal titles. It has no member ids, no constraint rules, no notes that the server did not already classify as shopper notes, no postal code, no provider URL, and no `already_have` versus medical reason. `already_have` may show as “Already have” because the shopper set that mark for the trip.

Expired or revoked returns 404 with the same body as an unknown token. Do not reveal that a token once existed.

The link page is a quiet list with the wordmark and “Someone shared a shopping list”. It has no Instacart button. A provider URL in a public page would widen access to a household’s handoff.

Revoke is immediate. Creating a new link does not revoke the previous one unless the member asks. The settings and shop menu list active links with “Stop sharing”.

## Privacy defaults

The share sheet states: “Names and quantities only. Dietary limits stay in your kitchen.” Creating a link is explicit. Export does not also create a link. Clipboard text is not a URL unless they chose the link action.
