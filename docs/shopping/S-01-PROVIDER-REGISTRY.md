# S-01 Grocery Provider Registry

**Status.** Maintenance contract. The table below is the 2026-10-16 research snapshot. The runtime rows live in `src/lib/grocery/registry.js`. See the S-03 addendum. Categories (native, integrated provider, consumer-assisted compatible application) are defined in PROVIDER-TERMINOLOGY.md and take precedence over the lifecycle words below.

**Verification date.** 2026-10-16.

## Schema

One row per provider. Status words are the only lifecycle.

| Field | Rule |
|---|---|
| `id` | Stable token. `instacart`, `walmart`, `amazon`, `trader_joes`, `instore`. |
| `display_name` | Consumer name. |
| `fulfillment_methods` | What their own docs support, not what we wish. |
| `geography` | Where the docs say they operate. |
| `documented_capabilities` | From an official source. |
| `verified_capabilities` | Subset we have called. Empty for every row on 2026-10-16. |
| `access` | Account, approval, or “none”. |
| `credential_status` | `none`, `dev_secret`, `production_secret`. All rows are `none`. |
| `environments` | Hosts the docs name. |
| `integration_status` | `none`, `mock_only`, `dev_handoff`, `production`. All `none`. |
| `sources` | URLs. |
| `last_verified` | Date a person re-read the docs or re-ran a contract test. |
| `contract_test_date` | Empty until S-03. |
| `owner` | One integration owner. S-03 names them. S-01 owner is Grok 4.7 for the research. |
| `limitations` | What we must not claim. |
| `lifecycle` | `documented`, `accessible`, `tested`, or `production-enabled`. |
| `category` | `native`, `integrated_provider` or `provider_research`. See PROVIDER-TERMINOLOGY.md. Consumer apps are not registry rows; they live in `compatible-apps.js`. |
| `adapter_implemented` | True only when the id is in `createGroceryAdapters()`. |
| `status` | B rows only: `documented`, `registration`, `credentials_obtained`, `mock_tested`, `provider_tested`, `production_enabled`, `monitoring`. |

Lifecycle is the highest mark that is true. A public doc page can be **accessible** while the API is only **documented**. Production-enabled requires the flag on in production and a successful contract test against the production credential. None of these providers are production-enabled.

## Operating routine

**Monthly.** The owner re-reads the changelog or doc root for each current row, including providers that are only documented. Instacart is on that list. Update `last_verified` and the limitation notes. A missed month does not turn a provider off by itself. Instacart: an automated routine runs on the 1st of each month at 9:00 AM CT. It re-reads company.instacart.com/business/developers and the Shopping List help page (Android/web availability), and updates status.registration.last_verified. A change in either opens a review; it never flips a flag by itself.

**Quarterly.** Proactive review of emerging providers and capabilities. This does not wait for a household to ask. The owner looks for a new documented API, a new fulfillment method, or a capability an existing row did not have. Adding a row is not building an adapter.

**Triggered.** An API change, a vendor announcement, an integration failure, a production error spike, a changelog that deprecates a field we would send, or a 401 after a key rotation starts a review in the same week. The adapter stays disabled until the contract test matches the new docs.

### S-02 addendum

S-02 did not add adapter code and did not change any lifecycle mark. Order online still shows Instacart as “Not connected yet.” The household list is the in-store list. A typed usual store remains a label. The next review of this file is still a monthly read of the current rows plus the proactive quarterly scan above.

### S-03 addendum

S-03 copies the rows into `src/lib/grocery/registry.js`. Instacart `integration_status` is `mock_only`. Its lifecycle stays `documented`. `verified_capabilities` and `provider_tested_capabilities` stay empty. Shop in store is `production-enabled`. Walmart, Amazon, and Trader Joe’s stay documented with no adapter. The decision card is `docs/shopping/S-03-DECISION-CARD.md`. Committed environments still leave `GROCERY_PROVIDERS` empty, so a default deploy still shows “Not connected yet.”

**Adding or upgrading an adapter.**

1. A decision card names the capability, the official source, and the lifecycle evidence.
2. The registry row is updated in the same change as the contract test.
3. Dev credential and production credential are separate human steps. The card does not contain the secret.
4. Production-enabled is a later change that sets the env flag. It is not implied by a green unit test with a mock.

## Comparison

Marks in the table are as of 2026-10-16. “Documented” means their site says it. We have not called any of these APIs.

| | Instacart Developer Platform | Walmart direct | Whole Foods / Amazon | Trader Joe’s | FlavorWeave in-store |
|---|---|---|---|---|---|
| Role in V1 | First online handoff | Registry only. No adapter. | Registry only. No adapter. | The no-online example. No adapter. | The default shop. |
| What their docs actually give a third party | Create a shopping-list **page** and get `products_link_url`. Nearby retailers by postal code: `retailer_key`, name, logo. | Affiliate catalog: search, item price/availability, nearest stores, taxonomy. Marketplace APIs are for sellers and suppliers, not a household cart. | Creators API is an affiliate **catalog**. No Whole Foods or Amazon Fresh order API was found. | Official FAQ: no online sales, no curbside, no delivery, no Instacart or other third-party delivery. | Our list on the phone. |
| List handoff | Documented. Not tested. | Not documented. | Not documented. | Not offered. | Not applicable. The list never leaves. |
| Cart, substitutions, order status | Not in the shopping-list response. Happens in their UI. | Not in the affiliate reference that was read. | Not found. | Not offered. | Shopper checks the line. That is `purchased`, user-asserted. |
| Store selection | The person picks a store on Instacart’s page. Pinning a merchant is contradicted across their docs. See the Instacart card. | Affiliate `GET /stores` finds nearest Walmart stores from lat/lon/zip. That is not a grocery cart. | Not found. | Public store finder on their site. We do not wrap it in V1. | Household’s own habit, stored as a label if they type one. |
| Geography | US and CA postal codes on the retailers call. Company page says US and Canada. | Walmart.com affiliate and US Marketplace docs. | Amazon.com Associates / Creators API. Fresh and Whole Foods coverage was not in the API docs read. | Stores they operate. The FAQ does not publish a developer geography. | Wherever the household shops. |
| Access | Application, review, dev key, then a production key that does not work until approval. Affiliate payments are a further Impact account. | Affiliate publisher id (Impact Radius) for the affiliate API. Seller OAuth for Marketplace, which is the wrong product. | Amazon Associates, then Creators API. Docs require 10 qualifying sales in 30 days for that catalog access. | None. | None. |
| Credential we hold | None. | None. | None. | None. | None. |
| Lifecycle | **documented.** Doc pages were **accessible**. API not accessible, not tested, not production-enabled. | Affiliate reference **accessible** (HTTP 200, last-modified 2026-08-14). API not accessible, not tested, not production-enabled. Marketplace portal **accessible** as documentation. | Creators API and PA-API deprecation pages **accessible**. Not tested, not production-enabled. | FAQ text **documented** via retrieval on 2026-10-16. Direct HEAD from this environment returned 403, so the HTML endpoint is not marked accessible from here. | **production-enabled** as the current check-off list, without the household-item work. |

## Row notes

### `instacart`

Sources are listed in `S-01-INSTACART.md`. Documented capabilities: `retailer_discovery`, `list_handoff`. Not documented as a cart or order API for the public Developer Platform. Instacart Connect is a different product for retailers and is out of scope. Marketing text on the company page says the API provides inventory data; the same page’s FAQ says public-API developers cannot access Instacart data and receive a link. The API reference returns `products_link_url` only. The reference wins.

### `walmart`

**accessible** `https://developer.walmart.com/` (HTTP 200 on 2026-10-16). The portal groups Marketplace (sellers), suppliers, carriers, and advertising. The Marketplace introduction describes item, inventory, order, and price APIs for sellers and solution providers. That is not a consumer grocery list.

**accessible** `https://walmart.io/apidocs/affiliates/affiliate-marketing-api` (HTTP 200 with a browser user agent; HEAD without one returned 400). Last-modified `Fri, 14 Aug 2026 11:48:37 GMT`. Endpoints named on that page:

- `GET /items` and `GET /items/{itemId}` — “real time item status including price and availability”, with `publisherId` and ids or UPC
- `GET /search` — Walmart.com catalogue text search, `numItems` max 25
- `GET /stores` — nearest stores by `lat`, `lon`, or `zip`
- `GET /taxonomy`, `GET /reviews/{itemId}`, `GET /nbp`, `GET /postbrowse`, `GET /trends`

No shopping-list, cart, or grocery-order operation appears on that page. Item availability there is Walmart.com catalogue status, not a claim we can show as “in stock at the grocery aisle” until a later card tests it. V1 makes no Walmart availability claim. A URL-only future would still make none.

Affiliate terms **accessible** at `https://affiliates.walmart.com/terms` and `https://affiliates.walmart.com/faqs`: qualifying links to Walmart, commissions on qualifying purchases, Impact Radius tools. Not a cart API.

### `amazon`

**accessible** `https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction` (fetched 2026-10-16). Creators API is a REST catalog for Associates: recommendations and product content. Registration docs require an accepted Associates account, and the introduction says 10 qualifying sales in 30 days to access the catalog API. Credentials are OAuth, not the old PA-API keys.

**accessible** `https://webservices.amazon.com/paapi5/documentation`: PA-API 5 “will be deprecated on April 30th, 2026” and tells developers to migrate. That date is before this verification date. The deprecation page `https://affiliate-program.amazon.com.au/creatorsapi/docs/en-us/paapiv5-deprecation` shows a sample `403` telling callers to migrate. The maintained Add to Cart **form** on the PA-API site (`https://webservices.amazon.com/paapi5/documentation/add-to-cart-form.html`) posts ASINs to Amazon retail. It is not a Whole Foods order API, and the parent site says it is no longer maintained. Do not build on it.

**documented**, not a 2026 product page: an AWS re:Post reply states AWS does not provide APIs for Amazon Fresh and Whole Foods (`https://repost.aws/questions/QUAWoPILDhS_6j458Ih6zAzQ/is-there-an-api-for-amazon-fresh-or-whole-foods`). The reply is several years old. S-01 did not find a newer official order API. Treat Whole Foods and Amazon Fresh as website-only. A URL-only provider makes no per-item availability claim.

### `trader_joes`

**documented** `https://www.traderjoes.com/home/FAQ/general-faqs.html`, text retrieved 2026-10-16. Quoted substance: they do not sell products online, including gift cards; they do not offer curbside or delivery; they do not work with third-party delivery services like Instacart or Dumpling; there are no authorized online sales of their products. A direct HEAD from this environment returned 403, so the mark is documented rather than accessible.

This is the representative grocer with no online fulfillment. FlavorWeave’s in-store mode is how a household shops there. We do not imply a partnership, and we do not send their name to Instacart as a retailer we selected.

### `instore`

No external source. The behavior is the current shop list. **production-enabled** for recipe lines. Household items are not built yet.

## Instacart Connect

`https://docs.instacart.com/developer_platform_api/` says the Developer Platform is for app developers, and retailers who want fulfillment on their own site should see Instacart Connect. Connect uses OAuth applications and is a different credential. FlavorWeave is not a retailer embedding fulfillment. Do not register a Connect app for S-03.
