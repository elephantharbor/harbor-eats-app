# S-01 Instacart Feasibility

**Status.** Research brief. No account, no key, no call. Every external sentence is from a page fetched on 2026-10-16 unless noted.

**Decision.** The first online integration is Instacart Developer Platform `POST /idp/v1/products/products_link` with `link_type` `shopping_list` and measurements in `line_item_measurements`. FlavorWeave sends a list and opens the returned URL. Instacart’s UI selects the store, matches products, builds the cart, and checks out. We do not call that a purchase. We do not implement Instacart Connect.

## Sources

| Topic | URL | Page date | Mark |
|---|---|---|---|
| Overview | https://docs.instacart.com/developer_platform_api/ | Last updated May 14, 2026 | accessible |
| Create shopping list | https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/ | Last updated May 14, 2026 | accessible |
| Nearby retailers | https://docs.instacart.com/developer_platform_api/api/retailers/get_nearby_retailers/ | Last updated May 14, 2026 | accessible |
| Approval | https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/approval_process/ | Last updated May 14, 2026 | accessible |
| Units | https://docs.instacart.com/developer_platform_api/api/units_of_measurement | Last updated May 14, 2026 | accessible |
| Shopping list concept | https://docs.instacart.com/developer_platform_api/guide/concepts/shopping_list | Last updated May 14, 2026 | accessible |
| FAQ | https://docs.instacart.com/developer_platform_api/faq | Last updated May 14, 2026 | accessible |
| Recipe tutorial | https://docs.instacart.com/developer_platform_api/get_started/recipe | Last updated May 20, 2026 | accessible |
| Get started | https://docs.instacart.com/developer_platform_api/get_started/overview | Last updated Jul 20, 2026 | accessible |
| API keys (get started) | https://docs.instacart.com/developer_platform_api/get_started/api-keys | Last updated May 14, 2026 | accessible |
| API reference overview | https://docs.instacart.com/developer_platform_api/api/overview | fetched 2026-10-16 | accessible |
| API keys reference path | https://docs.instacart.com/developer_platform_api/api/api_keys/ | search snippet 2026-10-16; direct fetch returned **404** | documented, not accessible at that path |
| Errors | https://docs.instacart.com/developer_platform_api/api/error_and_status_codes | fetched 2026-10-16 | accessible |
| Terms | https://docs.instacart.com/developer_platform_api/guide/terms_and_policies/developer_terms | fetched 2026-10-16 | accessible |
| Pre-launch | https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/pre-launch_checklist | Last updated Jun 18, 2026 | accessible |
| CTA design | https://docs.instacart.com/developer_platform_api/guide/concepts/design/cta_design | Last updated May 14, 2026 | accessible |
| Older CTA path | https://docs.instacart.com/developer_platform_api/guide/design/cta_design/ | fetched 2026-10-16 | accessible, conflicts with the checklist |
| Conversions | https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/conversions_and_payments | Last updated Jun 18, 2026 | accessible |
| Company page | https://company.instacart.com/business/developers | fetched 2026-10-16 | accessible |
| www company URL | https://www.instacart.com/company/business/developers | fetched 2026-10-16; links to the company host | accessible |
| Changelog | https://docs.instacart.com/developer_platform_api/api/changelog | search snippet 2026-10-16 | documented |

## What the API guarantees

Development host `https://connect.dev.instacart.tools`. Production host `https://connect.instacart.com`. Auth is `Authorization: Bearer` with the API key. `Accept` and `Content-Type` are `application/json`. Optional `Accept-Language`: `en-US`, `en-CA`, `fr-CA`.

`POST /idp/v1/products/products_link` creates a page and returns `products_link_url`. The concept page says the person then selects a store, reviews items, adds them to a cart, and checks out, logging in if needed. The recipe tutorial states that development or production requests do not become an order unless someone checks out on Instacart.

Request fields we rely on:

| Field | Use |
|---|---|
| `title` | A FlavorWeave title with no diet or member data. |
| `link_type` | `shopping_list`. The household list mixes dinners and non-food. A recipe page is the wrong object. |
| `expires_in` | Days, maximum 365. Shopping lists have **no default**. We set 14 so expiry is knowable. |
| `line_items` | One object per included line. |
| `landing_page_configuration.partner_linkback_url` | Our `/shop` URL. |
| `enable_pantry_items` | Documented as default false and **only supported on `recipe`**. We omit it. Our already-have state stays in FlavorWeave. |

Line item fields:

| Field | Use |
|---|---|
| `name` | Search text. Required for matching. |
| `display_text` | What they show. `name` still matches. |
| `line_item_measurements` | **The measurement we send.** Array of `{ quantity, unit }`. |
| `quantity`, `unit` | **Deprecated** on the line item (changelog and the create page, both describing May 14, 2026 updates). If measurements are omitted, those fields are still used. We do not omit measurements. We do not send the deprecated pair as the preferred shape. |
| `upcs`, `product_ids` | Mutually exclusive. We do not send either in V1. We have no Instacart product ids. A UPC would prioritize UPC search; we must not invent UPCs. |
| `filters` | Not sent in V1. See safety. |

200 body is `products_link_url`. An example on the page includes affiliate query parameters. The conversions page says those parameters are appended automatically and must not be hardcoded.

Documented 400s include missing parameters (`9999`), invalid health filters (`1001`), quantity `<= 0` (`1001` on `line_items[0].line_item_measurements[0].quantity`), both `product_ids` and `upcs` (`1001`), and duplicate product ids or UPCs (`1001`).

General error codes on the errors page: `1001` invalid parameter, `2003` retry later, `4000` record not found, `4001` invalid request, `4002` failed to resolve a valid context, `500x` internal, `9999` multiple errors. The errors page also mentions order fields such as `order.service_option_id`. Those examples are not a shopping-list order API. The shopping-list 200 body has no order.

`GET /idp/v1/retailers?postal_code=&country_code=` with country `US` or `CA` returns `retailers[]` of `retailer_key`, `name`, `retailer_logo_url`. The page says `retailer_key` is the organization, not a store address. There is no street, no pickup flag, and no delivery flag in that response.

The recipe tutorial says a **new** API key may be required before `get_nearby_retailers` works. The FAQ says an initial key may only access `/products/products_link` or `/products/recipe`. S-03 must treat a 401 or a missing retailers call as `not_configured` for that capability, not as an empty neighborhood.

## Measurements

The create page: use `line_item_measurements` so Instacart can choose the best measurement for quantity. The concept page: they calculate in array order, starting with the first, and the page can show the measurements we sent. The FAQ: they will **attempt** a quantity match and **cannot guarantee** it. A wrong cart quantity is something the person fixes on Instacart. We do not detect it.

Supported unit strings are the tables on the units page, not a guess. FlavorWeave’s `UNIT_ALIASES` map as follows. “Send” means we put that unit in `line_item_measurements` and keep our unit on the canonical line.

| Our unit | Instacart unit we may send | Basis |
|---|---|---|
| `cup` | `cup` | Units table lists cup, cups, c. |
| `tbsp` | `tablespoon` | Table lists tablespoon, tablespoons, tb, tbs. |
| `tsp` | `teaspoon` | Table lists teaspoon, teaspoons, ts, tsp, tspn. |
| `oz` | `ounce` | Table lists ounce, ounces, oz as **weight**. Fluid ounces are separate (`fl oz ounce` and the container forms). Our alias is weight. Do not relabel it as fluid ounces. |
| `lb` | `pound` | Table lists pound, pounds, lb, lbs. |
| `g` | `gram` | Table lists gram, grams, g, gs. |
| `kg` | `kilogram` | Table lists kilogram, kilograms, kg, kgs. |
| `ml` | `milliliter` | Table lists milliliter and the other spellings. |
| `l` | `liter` | Table lists liter and the other spellings. |
| `can` | `can` | Countable table. |
| `bunch` | `bunch` | Countable table. |
| `head` | `head` | Countable table. |
| `package` | `package` | Countable table. |
| `count` | `each` | The create page and the units tip recommend `each` for countable items such as tomatoes. |
| `clove` | — | Not on the units page. |
| `jar` | — | Not as a bare unit. `fl oz jar` is a container form, which we do not have a volume for. |
| `serving` | — | Not on the units page. |
| `unparsed` | — | Not sent. |

Multiple measurements are allowed when **we** already have two honest quantities. V1 sends one measurement: the household buy quantity in the mapped unit. We do not invent a milliliter equivalent. Array order would make a guessed conversion the one Instacart tries first.

`clove`, `jar`, `serving`, and `unparsed` stay on the FlavorWeave list and are excluded from the payload. The review screen lists them. That is the missing-item case `invalid_qty_unit`, not a silent drop.

Health filters, if a later card adds them, are only `ORGANIC`, `GLUTEN_FREE`, `FAT_FREE`, `VEGAN`, `KOSHER`, `SUGAR_FREE`, `LOW_FAT`. Brand filters are case-sensitive and ignored when product ids or UPCs are present. V1 sends neither. Diet limits are not health filters.

Image URL, if ever sent, must be 500×500. V1 omits `image_url`. Instructions are omitted. They would be a place to leak dietary notes.

## Nearby retailers and store selection

We may show the returned names after the member enters a postal code, so the household sees that Instacart operates nearby. We store the postal code only if they save it in shopping preferences.

We do **not** promise a specific store on the link.

- FAQ, May 14, 2026: “Currently, directing users to a specific merchant is not supported.” Instacart shows a default from location, matching, availability, and the user’s preferences. A signed-in user sees their last retailer.
- Recipe tutorial, May 20, 2026: for a **recipe** URL, appending `?retailer_key=` can show that retailer next to “Add ingredients to cart”. The shopping-list create body has no retailer field. The shopping-list concept page says the user selects the store on the page.

S-03 uses `link_type: shopping_list` and does not append `retailer_key`. The recipe-page parameter is documented and unverified, and it is the wrong page type for a mixed household list. A preferred store in FlavorWeave is a label (“we usually use the Market Street Instacart”). The person confirms the store on Instacart.

## Deep link and return

FAQ: the URL from either create endpoint deep-links, and opens the Instacart app on iOS and Android. On iOS, repeated browser tests can make the URL open in Safari instead. That is their platform behavior. We open the URL. We do not ship a custom scheme.

Return is `partner_linkback_url`. Landing on `/shop` shows the same list. Copy does not say the order was placed. If the session expired, the existing recover flow runs, then `/shop`. No list contents in the URL.

## Branding, usage, affiliate

Pre-launch checklist, June 18, 2026, is the production bar:

- Use the Platform API and link to Instacart pages.
- Button text is “Shop ingredients” or “Shop on Instacart”.
- Button is 46px tall, 29.5px radius, 22px full-color logo.
- Themes are Dark, Light, or White with their hex values.
- Logo is full color, unmodified, unrotated, on white, cashew, or dark kale.
- Logo indicates the integration. It is not paired with our logo in a header and not used to imply a joint offering.

Forbidden customer copy: “Free Delivery”; “Partner” or “Partnership”; “Instacart delivers”, “Instacart grocery delivery”, “Instacart shops for you”; any delivery-speed claim.

CTA design page, May 14, 2026, repeats “Shop ingredients” and “Shop on Instacart”. The **dark** theme is fully specified in text: background `#003D29`, text `#FAF1E5`, logo `#FF7009` and `#0AAD0A`, no stroke. Two other themes are only partially specified in the text extract (strokes `#EFE9E1` and `#E8E9EB` at 0.5px). Their background hex values were not in the text. Do not invent them. S-03 uses the dark theme on a white card. The 22px logo is Instacart’s asset from their logo page. S-01 does not draw a substitute mark. The prototype labels the slot.

An older CTA page at `guide/design/cta_design/` lists different strings (“Order with Instacart”, “Shop with Instacart”, “Get Ingredients”, “Get Recipe Ingredients”). The June 18 checklist is the one that gates the production key. Use the checklist strings. Our mixed list uses **“Shop on Instacart”**, because “Shop ingredients” understates paper towels and soap.

Terms grant a revocable license to build an interoperating application and to use marks only as they prescribe. Restrictions include not selling or sharing their materials with another delivery or data company, and not scraping the platform. Confidential information includes purchase and transaction data. Public-API developers, per the company FAQ, do not receive that data anyway. Security incidents go to the addresses in the terms. Parties are independent contractors. The terms say the agreement does not create a partnership. That matches the ban on the word “partner” in the UI.

Company FAQ: applicants are 18 or older and a US or Canada resident or registered business. There is no waitlist. Developers with a live integration can sign up for affiliate commissions. The same FAQ says public-API developers cannot access Instacart data and receive a landing-page link. The hero sentence on that page about inventory access is contradicted by that FAQ and by the response schema. Do not design inventory sync.

Get-started overview: average time from access request to demo approval and a production key is about 30–40 days. That is their figure, not a Harbor Eats schedule.

Approval page, May 14, 2026: creating a production key starts a review. The key stays pending and does not work. Review checks terms, request shape, error handling, and an Enterprise Help Desk account. For affiliate payment it still mentions an Instacart Tastemakers account. The conversions page, June 18, 2026, says affiliates join through Impact, parameters must not be hardcoded, and a mismatched email blocks attribution. The pre-launch page, also June 18, says approval includes an Impact invitation. **The May 14 approval page and the June 18 pages disagree about Tastemakers versus Impact.** A human confirms which account the review email requires. S-01 creates neither.

Affiliate is optional. The handoff works without it. Do not block shopping on a commission account.

## What happens only inside Instacart

After the URL opens, all of the following are theirs. We get none of it back:

- Which store was selected, and whether that store can fulfill the list
- Product match, including a name that resolves to a different variety
- Quantity conversion into a package
- Substitutions and shopper replacements
- Prices, fees, and tip
- Login and payment
- Pickup versus delivery
- Order acceptance, shopping, and delivery

The FAQ also says users can add items from more than one retailer, and Instacart keeps a separate cart per retailer. That is their UI. We do not merge those carts into our list.

The company page’s launch-partner stories describe “add to cart” and delivery. Those are the experience on Instacart’s side of the link. They are not additional response fields.

## Minimum human steps for dev access

No step below was performed.

1. A person who meets their criteria (18+, US or Canada resident or registered business) opens https://company.instacart.com/business/developers and uses the apply control on that page. This environment did not find a separate form URL in the HTML. The docs also say “Apply today” on the get-started page without a captured href. The www host links to the company page.
2. That person agrees to the Developer Platform terms.
3. After they have dashboard access, they create a **Development** key, copy it once, and store it outside the repo. The get-an-API-key page describes a `keys.` prefix and says the full key is not shown again.
4. They confirm the key can call `products_link` on `https://connect.dev.instacart.tools`. If retailers are needed, they request a key that includes that endpoint. The recipe tutorial warns that a new key may be required.
5. They do not create a production key until S-04’s demo exists. A production key request is the approval trigger, and the key does not work while pending.

Enterprise Help Desk, the demo recording, and Impact or Tastemakers are production-approval steps, not dev-access steps. They are listed in the execution plan.
