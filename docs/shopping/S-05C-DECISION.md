# S-05C — Decision note

**Status.** Accepted for the S-05C runtime. This note is the contract where it disagrees with the S-05B research.

**Date.** 2026-10-17.

## What ships

A household copies or shares the items it still needs. FlavorWeave does not create an external cart, verify a price or a stock count, match a product, confirm a substitution, place an order, or complete a purchase.

Two actions, both from “How are you shopping?”:

1. **Copy for my grocery app.** One purchase line per item. No “FlavorWeave list” header, no category heading, no meal title, member name, diet, allergen, internal id, provider name, URL, or note.
2. **Save/Share list image.** The same rows, painted in the browser. Nothing is uploaded.

Shop in store stays the first row. A connected online provider is shown only when that provider is actually configured. At launch every sentence is provider-neutral. There is no “Send directly to Schnucks” and no “fill your Dierbergs cart.”

## Where this overrides S-05B

| Topic | S-05B card | S-05C |
|---|---|---|
| Group headings | Category labels and rules on the copied list and the image | Flat list. A heading such as “Produce” must not become a cart line. |
| Part labels | — | “Part 1 of N” is on screen only. It is not in the clipboard text. |
| Provider names | Research names Schnucks, Dierbergs, Whole Foods, Walmart, Whisk, Instacart | Launch copy does not name a provider. Only a `human_tested` fact may be named. None are. |
| Evidence | Documented pages | `documented` is not `human_tested`. Registry rows carry `source_url`, `last_verified`, and `evidence`. |
| Telemetry | — | `shop_export` is approved. Closed fields only: `type` (`copy_app`, `image`, `copy`, `share`, `print`, `download`), `ok`, `surface`. |

## Order, quantities, and parsing

Copied lines use the existing category order internally and then the item name. The labels are omitted. That order is produce, dairy, meat, bakery, pantry, frozen, household, other. Dairy therefore comes before meat. Within a category, names sort case-insensitively. The S-05B reference image used a different within-group order and put meat before dairy. See `assets/S-05C-COMPARISON.md`.

A unit is plural only when the quantity is greater than 1. `1/2 cup` stays singular. `1 1/2 cups` is plural. `1 dinner` is singular.

Stored `0.333` and `0.667` render as ⅓ and ⅔, including mixed numbers (`1.333`, `2.667`). The tolerance is half a thousandth and applies only to those two fractions. `0.332`, `0.334`, `0.33`, and `0.666` stay decimals. Canonical arithmetic is unchanged.

Manual entry parses `1/2`, `½`, mixed numbers, and the common unit words without a model. A bare name stays a bare name. The formatter does not invent “1 each” or a package size.

## Registry

Schnucks, Dierbergs, Whole Foods / Amazon, Walmart, and Whisk are registry rows with empty capabilities. They are not adapters and they are not a connect action. `export_image` is not a capability and not a handoff mechanism. Walmart `cart_link` is a documented URL mechanism, not an implementation.

Instacart registration is closed, with no waitlist, last verified 2026-10-17. Instacart stays disabled. Production keeps `GROCERY_PROVIDERS` empty.

Two source URLs are hosts rather than article slugs because the S-05B notes truncated them: Instacart’s Clementine mention uses `https://company.instacart.com/`, and the Alexa mention uses `https://www.aboutamazon.com/`. The slugs were not reconstructed.

## Sign-out

Sign out revokes the server session and clears the cookie. It does not switch households. Multi-household switching is not in this unit. The invite path is sign out, then join.

## Outreach

The Schnucks draft in `S-05B-LOCAL-PROVIDERS.md` is **NOT SENT** and requires Oversight approval. It does not claim that any number of pilot households shop at Schnucks.

## Explicitly not in this unit

Kroger, Walmart cart links, Instacart activation, Schnucks or Whole Foods APIs, pantry inventory, multi-store optimization, automatic substitution, ordering, purchase reconciliation, and a household switcher. No retailer was contacted. No migration.
