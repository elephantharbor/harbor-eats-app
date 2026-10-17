# S-05B Whole Foods Market / Amazon — Integration Feasibility

**Intended repo path:** `docs/shopping/S-05B-WHOLE-FOODS.md`
**Status:** Research only, 2026-10-17, 09:37–09:45 CT. No Amazon account, no Associates enrollment, no undocumented endpoints called. Evidence notes: `/workspace/s05b/raw/webfetch-notes.md`.

## 1. What a Brentwood shopper has today
| Topic | Finding | Label |
|---|---|---|
| Nearby stores | **Whole Foods Market Galleria, 1601 S Brentwood Blvd, St. Louis 63144** — inside the target ZIP. Town and Country, 1160 Town and Country Crossing Dr (63017). | Secondary (wholefoodsmarket.com store pages via search index) |
| How to order | Through Amazon: "Amazon.com offers convenient delivery and pickup of Whole Foods Market items. Visit www.amazon.com/wholefoods." 2-hour and 1-hour windows; **$9.95 service fee on all WFM delivery orders**; free one-hour pickup over $35. Requires an Amazon account (Prime for most benefits). | Verified (Amazon help page, ~09:38) |
| Amazon Fresh vs WFM | Separate Amazon grocery storefronts with separate carts; Amazon also runs same-day perishable delivery from its own network in 2,300+ cities. Which of these serve 63144 today: **Unknown — ZIP check for Oversight.** | Secondary / Unknown |
| Shopping lists | Alexa Shopping list is visible in the Alexa app, Amazon app and amazon.com. Voice: "Alexa, add [item] to my Whole Foods cart" (Amazon help, search index). | Verified (Alexa deprecation note) / Secondary (voice) |
| AI assistant | **Alexa for Shopping** (formerly Rufus), all U.S. customers: "Upload an image of your handwritten shopping list and Alexa for Shopping can transcribe and add those items directly to your cart." Photos from camera or gallery. **Whether items land in the Whole Foods cart, Amazon Fresh cart or main Amazon cart is not stated.** | Verified feature text (aboutamazon.com, ~09:40); WFM routing Unknown; not tested |

## 2. Developer and partner mechanisms
| Mechanism | Status today | Label |
|---|---|---|
| Alexa List Management API / List skills | "As of July 1, 2024, List skills and the List Management REST API to access Alexa lists… are no longer supported." | **Closed** (Verified, developer.amazon.com, page updated 2026-10-16) |
| PA-API 5 Add-to-Cart form | Page shows deprecation notice; PA-API replaced by Creators API. | **Closed** (Verified 07:56 CT, S-05) |
| Creators API | Catalog only (SearchItems, GetItems, GetVariations, GetBrowseNodes). Needs Associates enrollment **and 10 qualifying sales in the past 30 days**. No cart, no list, no WFM inventory. | Documented; inaccessible to us (no sales history) |
| Amazon Fresh "ingredient verifier" (`/afx/ingredients/verify`) | Known to developers from Stack Overflow and blog posts; posts a JSON ingredient list and lands on an Amazon shopping-list page. **No official Amazon documentation found.** | **Undocumented — excluded** by our rules |
| Shoppable-recipe partners (Destini, SideChef, Chicory) | Destini's 2023 support doc: Amazon Fresh/WFM receive ASINs into "a shopping list view where the consumer then confirms… add… to their Amazon cart", and Amazon may swap unavailable items. SideChef recipes live inside Amazon Fresh's recipe section (2021 partnership). These are sales-led programs for CPG brands and publishers, built on ASIN catalogs (Destini says it scrapes retailer pages). | Documented by the partner, not Amazon; **Requires partner access**; wrong shape for a private household list |
| Grocery order / cart API for WFM | None found. | **Unavailable** |

## 3. Outcomes
| Outcome | What actually works today |
|---|---|
| **A. Direct supported cart/list integration** | **Not feasible.** No documented, accessible Amazon or WFM cart or list API. Alexa lists closed 2024; add-to-cart form retired. |
| **B. Authorized partner integration** | **Only through sales-led third parties** (Destini/SideChef-style) or an Amazon business-development relationship with no public intake for this use. Both require ASIN matching and commercial terms; Destini relies on scraping, which we will not inherit. Not credible for the pilot. |
| **C. Consumer-assisted transfer** | **Partly documented.** The shopper can upload an image of a list to Alexa for Shopping, which "transcribes and adds those items directly to your cart". This is Amazon's own feature; whether it accepts a typed (not handwritten) list image and whether it targets the Whole Foods cart must be human-tested. Voice "add to my Whole Foods cart" is item-by-item. |
| **D. Native-only with WFM as preferred store** | **Works today.** FlavorWeave's in-store list with a "Whole Foods · Galleria" store label. Nothing leaves the app. |

## 4. Conclusions
- **Direct integration:** not feasible.
- **Best authorized consumer-assisted workflow:** FlavorWeave "Export list image" → Amazon app → Alexa for Shopping → "+" → choose the image from the gallery → review the suggested items → confirm the right store/cart → checkout on Amazon. FlavorWeave sees none of it.
- **Credible partnership route:** none for a small household app today. Revisit only if a public Amazon grocery-partner program appears.
- **What could be tested locally:** Oversight, with a personal Amazon account and the synthetic list image (`/workspace/s05b/test-list.png`), can check whether Alexa for Shopping reads a typed list, which cart it fills, and how it handles fractions, by-weight items, the branded item and the unavailable item. See the consumer-handoff doc for the procedure.
- **Implementation and maintenance cost:** zero WFM-specific code. The provider-neutral image/text export covers it. Maintenance is a quarterly re-check of Amazon's assistant help text. Any "Amazon/WFM" wording in the UI should wait for a human test.
