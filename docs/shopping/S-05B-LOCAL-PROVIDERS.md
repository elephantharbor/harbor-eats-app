# S-05B Local Providers — Schnucks, Dierbergs, Walmart, Kroger (St. Louis)

**Intended repo path:** `docs/shopping/S-05B-LOCAL-PROVIDERS.md`
**Status:** Research only, 2026-10-17, 09:35–09:46 CT. No accounts, no forms, no contact, no storefront scraping. Raw captures: `/workspace/s05b/raw/`.
**Market:** Brentwood (63144) and Webster Groves, St. Louis County. No residential address used.

Evidence labels: **Verified** (we read it on an official public page today), **Documented** (vendor says it; nobody here ran it), **Secondary** (news, app-store text, employee posts, search index), **Requires partner access**, **Unknown**, **Closed**. Nothing here is **Consumer-tested**.

---

## 1. Schnucks

### What the shopper has today
| Topic | Finding | Label |
|---|---|---|
| Nearby stores | Schnucks Brentwood, 8800 Manchester Rd (63144); Schnucks Webster Groves, 8650 Big Bend (63119). | Secondary (search index of schnucks.com/locations) |
| Ordering methods | "Schnucks Delivers" delivery and curbside pickup in the Schnucks Rewards app and on schnucks.com; Instacart Marketplace storefront; "Schnucks Now" fast delivery in the Instacart app. Curbside is "available at select Schnucks locations". Online prices "reflect regular retail prices… In-store sale prices may not be available". | Verified (schnucks.com/schnucks-delivers, 09:36) |
| Who runs the e-commerce | Instacart: "Schnucks owned-and-operated e-commerce properties, powered by Carrot Connect" (Instacart enterprise), plus the Instacart App. Caper smart carts, Carrot Tags, Eversight pricing. Partnership since 2017. | Verified (Instacart newsroom, 2023-07-19, read 09:36) |
| App list | Rewards app "My List": search or barcode-scan to add, sorted by home-store aisle, digital coupons auto-clipped; move list items into the curbside/delivery cart and back. Recipes add ingredients to list or cart. | Verified (schnucks.com/schnucks-rewards-app-knowledge-base, 09:36) |
| List sharing | "You cannot share or link a shopping list to other accounts" (help article returned 403 to us). | Secondary (search snippet only) |
| Loyalty / coupons | Schnucks Rewards points, 100+ weekly digital coupons, personalized savings; auto-applied to online orders. | Verified |
| AI assistant | Launched 2026-08-12 in the Rewards app and on schnucks.com, co-developed with VitalityIP. Builds lists or a Delivers/Curbside cart from a budget, recipes, pantry; aisle locations. **"Upload a recipe screenshot or photo of a handwritten list or recipe, and your Schnucks helper will pull up the ingredients for you! You stay in control—just select the size and flavor of the items you want before adding them to your digital shopping cart."** FAQ: "Open a chat window, select the paperclip symbol and choose your file or photo." Requires sign-in to a Rewards account, choosing a shopping method and store, and accepting Schnucks' AI terms. Conversations are saved; usage data may be used for training. Pricing "may not always reflect real-time changes". | Verified (schnucks.com/ask-schnucks and news releases, 09:36–09:40) — **not consumer-tested** |
| VitalityIP role | "Schnucks maintains ownership of the customer relationship, shopper data and brand experience while leveraging VitalityIP's AI." First retailer on the platform. | Verified (schnucks.com news release 2026-07-22) |

### The Schnucks API portal (apiportal.schnucks.com)
What a signed-out visitor can see today (09:35–09:36 CT, 14 GETs to the same public JSON calls the page itself makes):
- It is a **Google Apigee integrated developer portal** (site id `schnucks-schnucksportal`, footer "Copyright © 2026 Google LLC", `noindex` robots meta).
- Home page text, in full: "Welcome to the Schnucks API Portal… APIs Learn about and try our APIs. View APIs".
- The public API catalog call returns **`{"apiDocs": [], "apiProducts": [], "apiCategoryList": []}`** — zero public API products or docs. The authenticated catalog returns 401 "No authorization header provided".
- Menus (Home, APIs, Sign In) were last modified **2020-01-23**; the custom stylesheet was last changed 2024-11-15.
- `/accounts/create` shows a self-signup form (first/last name, email, password, reCAPTCHA) with "I agree to the terms". The terms link points to `https://apiportal.schnucks.com/terms`, and the portal reports **no page with that id** (404). The only other terms shown are Google's generic privacy/terms links.
- Feature flag: `portal.consumer_teams`.

**What this means.** Registration is technically open (a form exists), but nothing on the portal says who it is for, what you would get, or what terms you would accept, and the catalog shown to the public is empty. In Apigee portals, API products are often only visible to approved or specially-audienced accounts, so signing up may reveal nothing at all. **We did not sign up.** Whether independent third parties are eligible, and whether any product search, store inventory/pricing, list/cart, or customer-auth API exists behind sign-in: **Unknown / Requires partner access.** The portal looks like an internal or vendor-integration portal that has not been maintained for public developers.

### Is there a retailer-owned path independent of Instacart?
- **Cart and checkout are Instacart-controlled.** Schnucks' own site and app checkout are "powered by Carrot Connect". Instacart's Storefront Pro integration catalogue (docs.instacart.com, updated 2026-10-14) lists identity, loyalty, POS order injection, SNAP, FoodStorm — **no third-party list or cart import.** Instacart's consumer developer platform is closed to new applicants (re-verified 09:39 CT: "There is no waitlist available at this time" present in the page HTML). **Schnucks cannot be assumed to grant Instacart-controlled cart functionality.**
- **Schnucks-controlled surfaces** that a partnership could plausibly touch: the Rewards app shopping list (aisle-sorted, Schnucks-branded), Schnucks Rewards identity, digital coupons, and the VitalityIP assistant (which already accepts uploaded list images).
- **Plausible integration models**, from least to most effort for Schnucks:
  1. *Consumer-assisted (works today, no approval):* FlavorWeave exports a clean list image; the shopper uploads it to the Schnucks AI assistant and picks products. Documented by Schnucks; not tested by us.
  2. *Deep link:* a Schnucks-supported link that opens the app or assistant with a list prefilled. Would need Schnucks (and possibly VitalityIP) to build it. Unknown whether it exists.
  3. *List API:* FlavorWeave sends name + quantity lines into the shopper's Schnucks list after Schnucks Rewards sign-in. Needs a Schnucks API product, OAuth, and a commercial agreement.
  4. *Cart API:* would run through Carrot Connect/Instacart; needs both companies. Least likely.
- **Minimum useful capability:** model 2 (a documented deep link into the Schnucks list or assistant that carries plain item text). It needs no product data exchange and no customer data flowing back to FlavorWeave.
- **Responsible group (inferred):** Schnucks digital/e-commerce leadership (press names COO Ted Schnuck and Digital Marketing Director Cristina Preston as spokespeople; a "Senior Director of Digital Experience" appears in a search synthesis only — **unverified**, do not use without a human check).
- **Public partnership channel:** schnucks.com/suppliers → "All Service and Not-for-Resale Product Providers" (a Google Form). Submitting it is a human action and was **not** done. No developer-partnership contact is published.
- **Approvals likely needed:** Schnucks business owner, Schnucks IT/security review of the integration, possibly VitalityIP (assistant) and Instacart (anything touching cart), plus a data-sharing agreement.

**Verdict:** worth one short, honest inquiry (draft in §5) because Schnucks is the largest local chain and already has the most capable retailer-owned surfaces. Probability of a near-term API is low, and nothing should be built against it.

## 2. Dierbergs

| Topic | Finding | Label |
|---|---|---|
| Nearby stores | Dierbergs Brentwood Pointe, 8450 Eager Rd (63144). | Secondary |
| Online ordering | Dierbergs.com "Order Groceries" → delivery "powered by Instacart" (article modified 2026-04-29). Dierbergs launched **Instacart Storefront Pro** in 2026 ("performing ahead of expectations"). Also on the Instacart App since 2025-04-08 (same-day delivery, Carrot Tags). Older help pages still describe Shipt pickup/delivery (2021) plus DoorDash and Uber Eats. | Verified (support.dierbergs.com 09:37; SupermarketNews 2026-08-07) / Secondary (earnings call) |
| Pickup | Instacart storefront pickup is offered for some retailers; Dierbergs-specific curbside on Storefront Pro: **Unknown** (the current help says delivery; the Shipt pickup page is from 2021). | Unknown — ZIP check for Oversight |
| Modes | Dierbergs.com has "Delivery mode" (orders) and "In-Store Shopping Mode" (build and save a list, see store-specific prices; "does not place an order"). | Verified |
| Lists | Website "My List" (start/edit, "add item to list"); app "My List" with +Add Item, barcode scan, weekly-ad add; app list sorted by aisle. **App and website lists "are two separate lists and will not sync up."** App sharing: "no way to share the shopping list, besides sending a screenshot"; website can email a list. | Verified (support.dierbergs.com, 2024-03 article) |
| App | "Dierbergs" by Dierbergs, Inc., v5.9.0 (May 11), 13K ratings; smart list, item locator, coupons, rewards, delivery. Reviews compare it unfavourably to the Schnucks app. | Secondary (App Store) |
| Rewards via Instacart | Earn but not redeem Dierbergs Rewards in the Instacart app. | Verified |
| AI assistant / list import | None documented. Instacart's white-label Cart Assistant partners named on 2026-09-09 do not include Dierbergs. | Verified absence on the pages read; otherwise Unknown |
| Developer program | None found. Vendor pages cover resale/non-resale suppliers only. | Verified absence (search) |

**Control map.**
- *Dierbergs-controlled:* the Dierbergs app and its list, Dierbergs Rewards, weekly ad, store pages.
- *Instacart-controlled:* dierbergs.com ordering (Storefront Pro), cart, checkout, the Instacart App storefront.
- *Commercial relationship needed:* anything that writes into a Dierbergs list or cart.

**Third-party transfer today:** none documented. The only honest path is consumer-side: the shopper types or pastes into the Dierbergs list (paste support not documented), or shops Dierbergs through the Instacart App, where Instacart's own photo/paste list features apply (see consumer-handoff doc).

**Partnership compared to Schnucks:** lower capability (no assistant, lists don't even sync between app and web), similar approval complexity (Instacart controls checkout), smaller footprint (≈28 stores vs ≈115), harder to prove in a pilot. **No outreach draft is justified now.** Contact path if ever needed: dierbergs.com/contact-us (general business line 314-916-1811 per search) — not verified, not contacted.

## 3. Walmart

| Topic | Finding | Label |
|---|---|---|
| Nearby | Walmart Supercenter, 1900 Maplewood Commons Dr, Maplewood (≈2–3 mi from Brentwood). Pickup and delivery are standard Walmart services. | Secondary |
| Add-to-cart link | `https://www.walmart.com/sc/cart/addToCart?items=ITEMID_QTY,…&storeId=…&ap=…`, "available to partners/publishers whether they are onboarded to Impact Radius or not". Failed items → error modal; nothing reported back. | Verified at 07:53 CT today (S-05 render); docs page is JS-only so the 09:38 curl got an empty shell |
| Getting item IDs | **Affiliate Marketing API Quickstart describes self-service:** sign in with a Walmart.com account → create an application → upload a public key → a consumer ID is issued → call `developer.api.walmart.com/api-proxy/service/affil/product/v2/...` with signed headers. | Documented (walmart.io/apidocs/affiliates/quickstart, ~09:38) — **not exercised** |
| Publisher ID | Search docs list `publisherId` as **Required: No**; the spec labels it "Your Impact Radius Publisher Id". So search may work with only a consumer ID; commission tracking needs Impact. | Documented; behavior Unknown |
| Search / lookup | `/search` (≤25 per page, top 1,000), `/items?ids=` or `?upc=` ("real time item status including price and availability"), `/stores?zip=`, taxonomy. Results are "items available for sale online"; responses carry `itemId`, `upc`, `offerId`, `stock`, `affiliateAddToCartUrl`. "Several categories are excluded… we can not list them." | Documented |
| Store context | `/stores` by ZIP; ATC accepts `storeId`/`ap`. Whether search prices/stock reflect a specific store: not documented (catalog is walmart.com level). | Unknown |
| Fresh/by-weight grocery coverage in the affiliate catalog | Not documented. | Unknown |
| Who qualifies | Affiliate API intro: "apps that help users to find and purchase products on Walmart.com" (fits a shopping app). Affiliate Program: 18+, not an employee; "We may accept or reject any Application in our sole discretion"; Walmart "reserves the right to approve each and every website" linking via Qualifying Links; "fastest approval… within a day". | Documented (affiliates.walmart.com/terms, 09:39) |
| Terms caveats | Affiliates may link to Walmart only via Qualifying Links; "may not collect, store, cache, or otherwise use any account information of Walmart customers"; trademark and widget restrictions; no browser extension without written approval. walmart.io's own terms page is JS-only and was not read (search snippet: API "solely to advertise Walmart products"; delete API materials 10 days after access ends — Unknown until a human reads it). | Documented / Unknown |
| Consumer list import | Walmart's AI assistant **Sparky** reportedly accepts a photo of a list or a list shared from Apple Notes and builds an editable cart (live by mid-2026). Sources are Walmart employees' LinkedIn posts and a Japanese trade article; the App Store listing mentions Sparky and shopping lists but not image import. | **Secondary only** — not verified, not tested |

**Verdict.** The item-ID path is legitimate and *documented* as self-service, which upgrades S-05's "Unknown". It is still not proven obtainable: it needs a human to create a walmart.io application under Elephant Harbor, accept walmart.io terms, and confirm grocery items come back. Walmart remains a **conditional alternative**, not the primary unit. No cart links with invented IDs.

## 4. Kroger (secondary reference only)
Unchanged from S-05 (verified 07:41–07:54 CT today): open, free, documented Public API with customer OAuth and add-only cart. Its only St. Louis presence is a few Ruler Foods stores, none near Brentwood. **Not recommended for this market** regardless of API openness.

## 5. Outreach draft (NOT SENT — requires Oversight approval)
Only Schnucks justifies a draft. This draft has not been sent. Do not send it without Oversight approval. Suggested channel: the "All Service and Not-for-Resale Product Providers" form on schnucks.com/suppliers (human submits), or a named digital contact once a human verifies one.

> **Subject:** FlavorWeave — sending well-structured grocery demand to Schnucks
>
> Hello Schnucks Digital team,
>
> I lead FlavorWeave, a household meal-planning and shopping application based in St. Louis. Households plan their week's dinners with us, and we turn those plans into a clean, deduplicated shopping list with quantities.
>
> We are not building a competing shopping experience. We want to send well-structured grocery demand to participating retailers, so the shopper finishes in the retailer's own app, with the retailer's own products, coupons and Rewards.
>
> Today the best we can do is help a shopper export a clean list image that your new AI assistant can read. We would like to ask whether Schnucks has, or would consider, a supported way for a household app to hand a plain item list (names and quantities only) into a shopper's Schnucks Rewards list or assistant — for example a documented deep link — with the shopper's consent. We do not need prices, inventory or customer data back.
>
> We noticed apiportal.schnucks.com and did not want to register without understanding who it is meant for. If there is a partner program or the right person to speak with, we would be grateful for a pointer.
>
> Thank you,
> Cora — Harbor Eats / FlavorWeave
> [contact details to be added by Oversight]

Notes for Oversight: NOT SENT. Requires Oversight approval before anyone sends it. The draft makes no claim about how many households shop at Schnucks, and no usage or volume claim. Do not mention VitalityIP or Instacart terms.

## 6. Samsung Food / Whisk (recorded separately)
Whisk sandbox: "We do not accept new sandbox applications now" (docs.whisk.com, ~09:39). Production access "depends on your Whisk agreement". Business route: samsungfood.com/business and help@samsungfood.com (search). **Closed to new self-serve API clients.** Not contacted.
