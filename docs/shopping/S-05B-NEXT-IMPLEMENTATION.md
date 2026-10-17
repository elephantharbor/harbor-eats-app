# S-05B Next Implementation — Recommendation and Scoped Units

**Intended repo path:** `docs/shopping/S-05B-NEXT-IMPLEMENTATION.md`
**Status:** Recommendation only. Nothing started.

## 1. Outcome chosen: **A — consumer handoff is viable → premium export + guided handoff**
Why A and not the others:
- **A (consumer handoff):** four official consumer features accept lists as text or images (Instacart Shopping List paste/photo, Clementine, Schnucks AI assistant, Alexa for Shopping). Two reach the pilot's own chains. None needs credentials, terms or partners from us. Not yet consumer-tested, so provider naming waits for the human test.
- **B (Schnucks/Dierbergs direct):** not feasible now. Schnucks' API portal publishes nothing; Dierbergs has no program; both checkouts run on Instacart. Schnucks gets one unsent inquiry (Human decisions).
- **C (WFM authorized route):** none accessible.
- **D (nothing accessible):** not the case — but D's polish work is bundled into A anyway.

## 2. Primary unit — S-05C "Send to your grocery app" (export text + list image) + polish bundle
**Scope**
1. **Grocery-app text** — new export format `app` on `/api/household-shop/export`: only still-needed, unchecked, not-already-have, not-skipped lines; no header, headline, meal titles or notes; ASCII fractions; category groups; ≤200 lines per part.
2. **List image** — client-side canvas render from `format=json` (filtered the same way), 1080 px wide PNG, spec in `S-05B-UX-DECISION-CARD.md` §3.2; share via `navigator.share({files})` with download fallback.
3. **"How are you shopping?" sheet** — rows per the decision card: Shop in store, Send to your grocery app (Copy for my grocery app · Save list image), connected service (unchanged, hidden while `GROCERY_PROVIDERS` empty), Open your store's website (label-only, only if allowlisted; may be deferred).
4. **Guided help text** — generic in this release ("paste it into your grocery app's list, or upload the image to its assistant"). Provider-named lines only after Oversight's human test marks `human_tested`.
5. **Registry facts (data only)** — add `registration` (S-05) and `consumer_import` fields; registry-only rows `schnucks` and `dierbergs` with no capabilities; Instacart `last_verified: "2026-10-17"`; update the contract test.
6. **Polish bundle** (S-04A.1 backlog):
   - ⅓/⅔ display for stored three-decimal values `0.333`/`0.667` in `src/lib/shop-display.js` `formatShopQuantityAmount` and the client copy in `public/app.js`.
   - Mixed-number unit pluralization ("1 ½ cups", "1 ¼ lbs" as the unit table dictates).
   - "1 dinners" copy at `public/app.js:742` (`mealCount + " dinners · cooking for "`) — singular when 1; check line 1908 too.
   - Fractional general-item parsing: `QTY_TOKEN` in `src/lib/household-shop.js:62` accepts only ASCII digits and slashes, so "½ lime" keeps "½" in the name. Add Unicode vulgar fractions (½ ⅓ ⅔ ¼ ¾ ⅛ and "1½"/"1 ½") mapped to the same values.
   - `scripts/cleanup-synthetic-households.mjs`: add children-first deletes for `grocery_handoff`, `shop_share`, `household_shop_cas`, `household_shop_line`, `household_shop_requirement`, `household_shop_list` (confirm exact FK order from migrations 0017/0018), plus matching orphan/cross-household checks; dry-run output lists them.
7. **Measurement (needs Oversight OK)** — closed telemetry event `shop_export {kind}`; no content.

**Prerequisites:** none external. Optional Oversight human test (consumer-handoff doc §5) can run in parallel; it only gates provider-named copy.
**PR / release structure:** one runtime PR (export format + sheet + image + polish + registry facts + tests), one docs PR (these S-05B docs into `docs/shopping/`). Preview deploy → manual mobile check (iOS Safari + Android Chrome) → Production deploy only with Oversight approval. No migrations (telemetry uses the existing `event` table if approved).
**API/account dependencies:** none.
**Technical risk:** low–medium. Canvas text measurement and fraction glyph fallback; `navigator.share` with files varies by browser (fallbacks defined); list length splitting.
**UX complexity:** medium — one sheet, two new actions, honest copy, return note.
**Validation:** unit tests for the `app` text filter (excludes bought/have/skipped/dropped, no header, ASCII fractions), quantity formatting (⅓/⅔, plurals), parser (½ lime → 0.5 lime), image layout function (pure function returning line boxes, tested without a DOM), cleanup-script dry-run against a synthetic Preview household; Preview screenshots at 375/414 px; render the synthetic test list through the real code path and compare to `test-list.png`. No broad E2E.
**Effort (Grok 4.7):** ≈ one work unit — roughly 4–6 hours of agent time for code + tests + Preview verification, plus ~45 minutes of human testing by Oversight.

## 3. Alternative (only if Oversight prefers an integration) — S-05D Walmart cart link, gated
**Gate (all required):** a human creates the walmart.io application under Elephant Harbor and reads/accepts walmart.io terms; a test search for common groceries returns item IDs with `stock`; Oversight decides whether to join the affiliate program (Qualifying Links rule applies if so); some household shows online-ordering intent.
**Scope if gated open:** `cart_link` capability; signed-header client (server-side, key in secrets); search → shopper picks one product per line (never auto); ATC URL with `items=ID_QTY` and optional `storeId`; copy "Walmart will open and add what it can"; nothing stored beyond the session; `routes.js` per-adapter `activation(env)` refactor.
**Risk:** medium-high (matching quality for fresh/by-weight items unknown; catalog exclusions; terms). **Effort:** 2–3 work units after the gate.

## 4. Not recommended now
Kroger runtime (no local value); Whole Foods integration (none exists); Dierbergs outreach; Instacart IDP activation (closed); any scraping or browser automation.
