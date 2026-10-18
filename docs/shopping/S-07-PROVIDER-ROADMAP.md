# S-07A — Provider inventory and roadmap

**Status.** Recommendation **E** accepted: no more provider work until household use produces stronger evidence.
**Date:** 2026-10-18 (CT). Research only. Repo `origin/main` `bc11084`, read-only. Categories follow `REGISTRY-PATCH-PLAN.md` §2: A native, B integrated provider, C consumer-assisted compatible app. Evidence labels and sources are in `COMPATIBILITY-MATRIX.md` and `SOURCES.md`. **Nothing is Human-tested.**

## 1. Inventory

### 1.1 Live native shopping (A, Production)
| Item | State | Evidence |
|---|---|---|
| Household list, check-offs, quantities, read-only share links | Production | registry `instore` row, `lifecycle: "production-enabled"` [REPO] |
| "How are you shopping?" sheet: Shop in store; Send to your grocery app → **Copy for my grocery app** (`format=app`, 200-line parts) and **Save/Share list image** (client PNG, nothing uploaded) | Production since S-05C / S-05C.1 | `public/index.html:1191–1229`, `public/app.js:8841–9073`, `src/lib/shop-app-export.js` (`APP_EXPORT_PART_LIMIT = 200`) [REPO] |
| `shop_export` telemetry (closed fields `type`, `ok`, `surface`) | Approved and shipped in S-05C | `docs/shopping/S-05C-DECISION.md` [REPO]. Counts were not read in this cycle (no D1 queries). |

### 1.2 Implemented but disabled adapters (B)
| Provider | Documented | Registration | Credentials | Mock-tested | Provider-tested | Production enabled |
|---|---|---|---|---|---|---|
| Instacart Developer Platform | ✔ | **unavailable** (closed, no waitlist, re-read 2026-10-18 ~11:25 CT [IC-DEV]) | ✘ no dev key | ✔ | ✘ | ✘ (`GROCERY_PROVIDERS = ""`) |

A monthly routine checks it on the 1st at 9 AM CT (per Cora's brief). The routine is not recorded in the repo; patch plan §3.6 records it.

### 1.3 Registry-only / research providers (no adapter)
| id | Why it is a row | Developer path today |
|---|---|---|
| `walmart` | Affiliate API plus ATC link | Self-service onboarding documented [WM-QS]. Affiliate acceptance at Walmart's discretion [WM-TERMS]. |
| `amazon` (Whole Foods) | Local Whole Foods (Galleria) | Closed/Unavailable: Alexa list API deprecated; Creators API is catalog only [AMZ-DEP] (S-05B) |
| `schnucks` | Biggest local chain | Closed/Unavailable: API portal publishes nothing; terms page 404 (S-05B) |
| `dierbergs` | Second local chain | Closed/Unavailable: none found (S-05B) |
| `whisk` | List-API candidate | Closed/Unavailable: sandbox closed (S-05B) |
| `trader_joes` | No online sales | None by design |
| Kroger (not a row) | Reference architecture | Documented open Cart API [KR-API]. Not relevant in St. Louis (Ruler only). |

### 1.4 Documented consumer import destinations (C, not integrations)
| App | Text | Image | Retailers (St. Louis) | Note |
|---|---|---|---|---|
| Instacart Shopping List | Paste, 200/paste, **iPhone only** | Add by photo (iPhone) | Schnucks, Dierbergs | Quantity handling Unverified [IC-LIST] |
| Instacart Clementine | Chat | List photo or screenshot | Chosen store | "Isn't available to everyone"; review required [IC-CLEM] |
| Schnucks AI assistant | Chat, recipe URL | File or photo (paperclip) | Schnucks | Rewards sign-in plus AI terms; shopper picks sizes; no checkout [SCH-ASK] |
| Alexa for Shopping | Chat | Handwritten list → "your cart" | Amazon. Whole Foods via image: Unverified | [AMZ-AFS] [AMZ-WFM] |
| AnyList | Paste, one per line | — | None (list app) | Quantity parsing Unverified [AL-ANY] |
| Walmart Sparky | Unverified | Unverified | Walmart | Secondary sources only [WM-SEC]. Not counted as documented. |

## 2. Roadmap

| Provider | Current status | Next practical opportunity | Prerequisites |
|---|---|---|---|
| **Instacart** | B: adapter mock-tested, registration closed with no waitlist, no key, disabled. C: Shopping List paste/photo is iOS-only; Clementine is on app and web, not on every account. | (1) Human test P1–P3 (`CONSUMER-TEST-KIT.md`) to learn whether the native export lands well. (2) If the monthly check sees the waitlist or applications reopen, apply under Elephant Harbor. (3) When Android or web Shopping List ships, re-run P1 on Android. | Human tester with an Instacart account. For B: open registration, a human applies and accepts IDP terms, dev key in secrets, provider-test, Oversight gate. |
| **Schnucks** | C: assistant documented (file or photo, Rewards, AI terms). B: no published program; portal empty. Outreach draft **preserved, unsent**. | Human test P4. Use the outcome to decide whether a partnership inquiry has anything specific to ask. | Oversight approval to send. Contact details added by Oversight. The draft must carry no household-count claim (§3). Tester accepts Schnucks AI terms personally. |
| **Whole Foods / Amazon** | C: Alexa for Shopping image to cart, documented for handwritten lists only. Whole Foods routing Unverified. B: closed. | Optional human test P5: does a typed-list image land in the Whole Foods cart? | Tester's Amazon account; a 63144 Whole Foods address or pickup. No developer work. |
| **Walmart** | B-research: Affiliate API self-service and ATC link documented; affiliate terms restrict use (Qualifying Links, no customer data, no scraping, ad disclosure). C: Sparky list import Unverified. | None now. Re-read an official Sparky help page if one becomes readable. Consider D only on real demand. | Household demand for Walmart online; a human creates the walmart.io app and accepts terms; Oversight affiliate decision; real item IDs only (never guessed). |
| **Kroger** | B-research reference. Open Cart API documented. Not relevant in St. Louis. | None | Only if a household moves to a Kroger-banner market. |
| **Dierbergs** | C via Instacart (marketplace and dierbergs.com "powered by Instacart"). Own app: no import; lists don't sync. No developer path. | Human test P3 (Instacart with Dierbergs selected). | Tester's Instacart account; Dierbergs Brentwood Pointe pickup or 63144 delivery. No outreach. |
| **Other list apps** (AnyList; Notes/Reminders, Keep, OurGroceries, Paprika not researched) | AnyList: paste one per line, auto-categorized; quantity parsing Unverified. List organization only, no checkout. | Human test P6 (optional) to see whether "2 limes" becomes a quantity or stays in the name. | Tester's AnyList account. |

## 3. Constraints carried forward

- **Do not contact anyone.** No retailer, provider or partner was contacted in this cycle, and none may be contacted without Oversight approval.
- **The Schnucks outreach draft is preserved and unsent.**
  - Repo copy: `docs/shopping/S-05B-LOCAL-PROVIDERS.md` §5 on origin/main, marked "NOT SENT". It already contains **no** household-count claim. Its note says: "The draft makes no claim about how many households shop at Schnucks."
  - **The workspace copy still has the unsupported claim.** `/workspace/s05b/docs/S-05B-LOCAL-PROVIDERS.md` line 101 and `/workspace/s05b/S-05B-OVERSIGHT-HANDOFF.md` §14 (line 491) both still contain **"Several of our pilot households shop at Schnucks."** S-05B's own evidence shows 3 real households and no store-preference data. Handoff line 503 also says "The draft makes no usage or volume claims", which contradicts the draft above it. **Before any future use, delete that sentence, or use the repo copy.** I did not edit S-05B's files, because they are a record. The cleaned draft is below, unchanged otherwise, for reference only:

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

  *(Status: NOT SENT. Requires Oversight approval. Recipient channel suggested by S-05B: the "All Service and Not-for-Resale Product Providers" form on schnucks.com/suppliers, submitted by a human.)* One factual tweak to consider: "export a clean list image that your new AI assistant can read" implies a typed image works. That is Unverified until P4. Soften it to "…a clean list image to upload to your new AI assistant" unless P4 passes.
- No accounts, terms or uploads by agents. Every consumer step is a human tester's own decision.

## 4. Recommendation: **E. No more provider work until household use produces stronger evidence**

Run the cheap, non-provider steps now: the ~25-minute human test and the two copy strings in `UX-REVIEW.md`.

**Reasons**
1. **Option A has already shipped.** S-05C/S-05C.1 put Copy and Save/Share in Production with provider-neutral copy and a 200-line split that matches Instacart's documented 200-per-paste limit [REPO] [IC-LIST]. What is left of A is two small copy edits. That is UX polish, not a provider cycle.
2. **Nobody has measured whether the handoff works.** Every quantity-fidelity cell in the matrix is Unverified. Building more export variants, or naming providers, before one human test is guesswork.
3. **Option B is blocked outside our control.** Instacart applications are closed with no waitlist (re-read today). The monthly routine already watches it.
4. **Option C has nothing specific to ask yet.** Schnucks publishes no program. The only honest pitch ("your assistant can read our list") is itself untested. The workspace draft also carried an unsupported household claim.
5. **Option D has no demand signal.** No pilot household is on record shopping Walmart online. Affiliate terms add disclosure and approval obligations. Matching by-weight produce is hard.
6. **The evidence base is small.** The S-05 baseline had 3 real households, 0 exports and 0 handoffs on record. `shop_export` telemetry now exists, so real export use can be counted without guessing.

**Prerequisites to reopen provider work** (any one is enough to schedule a decision, not to start building):
- the human test passes the S-05B rule (**≥12 of 16 lines usable**, with package quantities counted as partial) on a St. Louis path → mark that fact `human_tested` and consider guided help naming it (A);
- `shop_export` shows repeated real exports, read by an approved person under the D1 rules, or a household asks for online ordering at a named store → C (Schnucks, via approved outreach) or D (Walmart, after the human access and terms gate);
- the monthly check sees Instacart registration reopen → B.
