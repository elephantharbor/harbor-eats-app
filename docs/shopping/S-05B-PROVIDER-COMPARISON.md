# S-05B Provider Comparison, Evidence Classes and Architecture Fit

**Intended repo path:** `docs/shopping/S-05B-PROVIDER-COMPARISON.md`
**Status:** Research only, 2026-10-17. Scores 1–5, **5 is always best for us** (for effort and maintenance, 5 = least burden). "Developer accessibility" means a path we could legitimately start without a partnership.

## 1. Matrix
| | STL usefulness | Consumer testability | Developer accessibility | Technical capability (for us) | Commercial / access restrictions | Implementation effort | UX quality achievable | Operational maintenance | Future intelligence potential |
|---|---|---|---|---|---|---|---|---|---|
| **Schnucks** | 5 — largest local chain; Brentwood + Webster Groves stores | 4 — AI assistant accepts list images (Rewards account) | 1 — API portal shows zero public APIs; terms page missing | 2 via consumer upload; API Unknown | 2 — partnership + Instacart for cart | 5 for export (no code); U for API | 4 — retailer-owned assistant, coupons, aisles | 5 for export | 3 — only via partnership |
| **Dierbergs** | 4 — Brentwood Pointe; ≈28 stores | 2 — no import; via Instacart App only | 1 — no program | 1 | 2 — Instacart Storefront Pro controls ordering | 5 for export | 3 | 5 | 2 |
| **Whole Foods / Amazon** | 4 — Galleria store in 63144 | 3 — Alexa for Shopping list-image upload; WFM cart routing unknown | 1 — Alexa lists closed 2024; add-to-cart retired; Creators API needs 10 sales, catalog only | 1 | 1 — partner programs are sales-led | 5 for export | 3 | 5 | 1 |
| **Walmart** | 3 — Maplewood Supercenter, pickup/delivery | 3 — Sparky import (secondary evidence) | 3 — Affiliate API documented self-service; ATC link open; untested | 3 — real cart add by item ID; no confirmation | 3 — affiliate terms, Qualifying Links, approval at Walmart's discretion | 2 — signed requests, matching UI, ID mapping | 3 | 2 — catalog drift, terms | 2 — data limited to advertising use |
| **Kroger** (reference) | 1 — Ruler Foods only, none near Brentwood | 1 | 4 — open, free, documented | 4 — OAuth + add-only cart, store price/stock | 2 — strict Acceptable Use | 1 — OAuth, tokens, migration, matching | 3 | 2 | 1 — storing derived data forbidden |
| **Instacart** | 5 — Schnucks, Dierbergs, ALDI, Costco on one platform | 4 — Shopping List photo/paste (iOS), Clementine (app+web) | 1 — developer applications closed, no waitlist (re-verified 09:39 CT) | 4 for the built IDP adapter (link only) | 2 — closed; review, branding | 5 — already built (mock) | 4 | 4 | 2 — returns no data |
| **Provider-neutral export** (FlavorWeave) | 4 — works with any of the above | 5 — anyone can test | 5 — ours | 3 — text + image only; no confirmation | 5 — none | 4 — one small client unit | 4 | 5 | 4 — keeps first-party list as the record |

**Reading the matrix:** the only option that scores well on both St. Louis usefulness and accessibility is the provider-neutral export, because it rides on consumer features that Instacart, Schnucks and Amazon already ship. Kroger's high accessibility is irrelevant locally. Walmart is the only *integration* with a plausible self-service path.

## 2. Evidence classes (key findings)
| Finding | Class | Source (CT time today) | Access limits / terms |
|---|---|---|---|
| Instacart developer applications closed, no waitlist | Verified | company.instacart.com/business/developers (09:39) | — |
| Instacart Shopping List "Add by photo" and "Paste items" (200/paste); iOS only, Android/web "soon" | Verified (documented feature) | instacart.com/help/section/2893565984 (09:35) | Instacart account |
| Clementine accepts photo/screenshot of a list; "most U.S. and Canadian customers", app + web | Verified (documented feature) | Instacart newsroom 2026-09-09 (09:39) | Rollout may exclude some accounts |
| Instacart IDP cannot target a specific retailer; name-only matching | Verified | docs.instacart.com/developer_platform_api/faq (~09:40) | Closed to new keys |
| Storefront Pro has no third-party list import | Verified (absence in integrations list) | docs.instacart.com/storefront_pro/... (~09:39) | Retailer + Instacart only |
| Schnucks AI assistant accepts "file or photo" of a list; select sizes; add to cart | Verified (documented feature) | schnucks.com/ask-schnucks (09:40) | Rewards account; Schnucks AI terms; chats retained |
| Schnucks online ordering powered by Instacart (Carrot Connect) | Verified | Instacart newsroom 2023-07-19 (09:36) | — |
| Schnucks API portal: empty public catalog; 401 for authed catalog; terms page 404; menus last edited 2020 | Verified | apiportal.schnucks.com JSON (09:35–09:36) | Sign-up not done |
| Schnucks API capabilities behind sign-in | Unknown / Requires partner access | — | Needs sign-up or partnership |
| Dierbergs: Instacart Storefront Pro; app and web lists don't sync; app list shareable only by screenshot | Verified / Secondary | support.dierbergs.com (09:37); SupermarketNews 2026-08-07 | — |
| Dierbergs developer or import path | Unavailable (none found) | — | — |
| WFM ordering via Amazon; $9.95 delivery fee; free pickup >$35 | Verified | amazon.com help (~09:38) | Amazon account |
| Alexa List API closed since 2024-07-01 | Verified (Closed) | developer.amazon.com deprecated features (~09:44) | — |
| Alexa for Shopping list-image → cart | Verified (documented feature); WFM routing Unknown | aboutamazon.com (~09:40) | Amazon account |
| Amazon Fresh `afx/ingredients` endpoint | Unknown / undocumented — excluded | Stack Overflow only | Not used |
| Creators API needs 10 qualifying sales/30 days; catalog only | Documented | affiliate-program.amazon.com (~09:38) | Associates enrollment |
| Walmart ATC link usable without Impact | Documented (page verified 07:53) | walmart.io/docs/atc | Item IDs required |
| Walmart Affiliate API self-service onboarding; publisherId not required for search | Documented, untested | walmart.io/apidocs/affiliates/quickstart, /search (~09:38) | walmart.io terms unread (JS-only page) |
| Walmart affiliate program terms (approval discretion, Qualifying Links, no customer data) | Documented | affiliates.walmart.com/terms (09:39) | Applies if we enroll |
| Walmart Sparky list-image import | Secondary only | LinkedIn posts by Walmart staff (search) | — |
| Whisk/Samsung Food sandbox closed to new applications | Verified (Closed) | docs.whisk.com (~09:39) | Business contact only |
| Kroger Public API open; STL presence Ruler only | Verified 07:41–07:57 (S-05) | developer.kroger.com; KMOX | Strict Acceptable Use |
| Any consumer flow above actually working with a typed list | **Unknown — needs the human test** | — | — |

Nothing in this cycle is **Consumer-tested**.

## 3. Architecture fit (no code changes)
Files reviewed at `077973b`: `src/lib/grocery/registry.js`, `routes.js`, `instore.js`, `instacart.js`, `docs/shopping/S-01-PROVIDER-ADAPTER.md`, `S-01-SHARING-EXPORT.md`, `public/app.js` (shopExport, shopNativeShare), `src/lib/household-shop.js` (export), `src/lib/household-shop-routes.js` (`/api/household-shop/export` supports `txt`, `csv`, `print`, `json`).

**Key point: provider capability and handoff mechanism are different things.** Today the contract has one list of capabilities (`list_handoff`, `cart_create`, `customer_auth`…) and treats export as a separate, provider-free feature. That separation is right and should be made explicit.

| Mode | Represented today? | Where it should live |
|---|---|---|
| Native in-store | Yes — `instore` adapter, `in_store` capability | Unchanged |
| Copy / share / print / download | Yes, outside the adapter layer (`shopExport`, export route) | Unchanged; add the "for grocery apps" text variant here |
| List image export | No | **Export layer**, client-rendered from `format=json`. Not an adapter capability — no provider is involved |
| Provider website link | Partly — `navigation_hosts` + allowlist exist for Instacart only; contract says "Opening a website is not `list_handoff`" | New mechanism `provider_navigation` on a registry row; never a capability |
| Shopping-list API | Yes — `list_handoff` (Instacart IDP, mock-tested) | Unchanged |
| Product / cart API | Not cleanly — `cart_create` means "a cart id the provider returned" | Add S-05's `cart_add` (accepted, contents unconfirmed) and `cart_link` (URL we built; nothing confirmed) |
| Authenticated provider | Capability name exists (`customer_auth`); no token storage | Provider-owned, member-scoped token table when a real adapter needs it |

**Proposed registry additions (design only):**
```js
// per registry row; facts we can cite, not capabilities
handoff_mechanisms: ["provider_navigation"],        // never implies transfer
consumer_import: [                                  // guidance for copy, shown only if human_tested
  { feature: "shopping_list_paste", platforms: ["ios"], evidence: "documented",
    source: "https://www.instacart.com/help/section/2893565984", verified: "2026-10-17", human_tested: null },
  { feature: "assistant_image_upload", platforms: ["ios","android","web"], evidence: "documented",
    source: "https://company.instacart.com/pressreleases/meet-clementine-...", verified: "2026-10-17", human_tested: null },
],
registration: { status: "closed", verified: "2026-10-17", source: "...", quote: "..." }, // from S-05
```
Add registry-only rows for `schnucks` (consumer_import: assistant_image_upload, web + app) and `dierbergs` (none), each with `integration_status: "none"` and no adapter. Do **not** add `in_store`, `list_handoff` or any capability to them.

**`routes.js` remains hardcoded to Instacart.** The export unit does not touch it. The `activation(env)`-per-adapter refactor from S-05 is only needed when a second real adapter (Walmart `cart_link`) is approved.

**Rules to keep:** no invented capabilities to make providers look equal; an export never sets `trip_method = online` or creates a `grocery_handoff` row; provider names appear in export guidance only when `human_tested` is set.
