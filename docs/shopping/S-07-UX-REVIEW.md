# S-07A — "How are you shopping?" UX review (recommendation only)

**Status.** 1 and 2 accepted; 3 declined.

**Source:** `origin/main` `bc11084`, read with `git show`, not modified. The sheet is in `public/index.html:1191–1229` (`<dialog id="shopHowSheet">`). Logic is in `public/app.js:8841–9112` (`refreshGroceryProviders`, `howFeedback`, `copyCurrentAppPart`, `shopCopyForApp`, `shopSaveImage`, `openHowSheet`). Image feedback is in `public/shop-list-image.js:294–330` (`imageHandoffFeedback`), re-exported by `src/lib/shop-list-image.js`. The return note is `public/index.html:585`. The entry button is `public/index.html:596` (`#btnShopInStore`, "How are you shopping?").

## Current flow and copy (verbatim)

1. **Shop in store**: "Your list, in aisle order, with check‑offs." (index.html:1196–1199)
2. **Send to your grocery app** (index.html:1200–1216)
   - copy: the previous hint, quoted in full on `S-05B-UX-DECISION-CARD.md` (superseded by the accepted sentence below)
   - note: "Names and quantities only. Dietary notes stay in FlavorWeave."
   - buttons: **Copy for my grocery app** · **Save/Share list image**
   - lists longer than 200 lines: "This list is in N parts. Copy each part. Nothing is left out." Then a Previous / Next / Copy part pager. The 200 limit matches Instacart's documented "200 items per paste" [IC-LIST].
   - after copy: "Copied. Paste this into your grocery app, then review the items before buying." (app.js:8923)
   - after image: share → "Your shopping-list image is ready. Review the matched items in your grocery app."; download → "Download started. Check your downloads, then review the items in your grocery app."; tab → "The image is open in a new tab. Press and hold it to save, then review the items in your grocery app."; cancel → "Share cancelled. Your list is still here."
3. **Shop online with a connected service**: hidden unless `/api/grocery/capabilities` returns a configured non-`instore` provider. None in Production. Copy: "A grocery service is connected for this kitchen. You'll review the items before anything leaves FlavorWeave." (app.js:8860)
4. After any successful export, the list shows "Back from shopping? Check off what you got." (index.html:585)

No provider is named. There is no checkout or order control on the export row, and no provider dashboard.

## Verdict per criterion

| Criterion | Covered? | Evidence |
|---|---|---|
| Copy list | **Yes. Adequate.** | Clear button, flat import-ready text, part pager, honest success and failure toasts. |
| Share/save image | **Yes. Adequate.** | One button with an honest message for share, download or tab fallback. Nothing claims "saved". |
| Picking a compatible destination, generically | **Partly.** | "Send to your grocery app" implies any grocery app takes a pasted list. The docs say otherwise. Instacart paste is iPhone-only today [IC-LIST]. Dierbergs' own app documents no import [DIER-SHARE]. The Schnucks assistant and Clementine take a *photo or file*, not a paste [SCH-ASK] [IC-CLEM]. One generic hint about what the destination must support would prevent a dead end. |
| Reviewing imported products | **Yes, with one gap.** | "Review the items…" appears on the row and in every toast. The gap is that the note says dietary notes stay behind but never says to check what the app picked. Both AI destinations disclaim accuracy and allergens: Clementine says allergen info is "for reference only… review the product packaging" [IC-CLEM]; Schnucks says "can make mistakes… always double check" [SCH-ASK]. |
| FlavorWeave stays the authoritative list | **Mostly.** | Exporting never mutates the list: `shopCopyForApp` and `shopSaveImage` only read `format=app`. The return note asks the shopper to check off here. Failure toasts say "Your list is still here". No success path says so explicitly. This is optional to fix. |

**Overall: largely adequate. Two minimal copy changes are recommended and one is optional.** Nothing else should change: titles, buttons, the connected row, toasts, layout and the image all stay.

## Proposed changes (exact before → after)

**1. Recommended: generic destination hint.** `public/index.html:1202` (`<p class="shop-how__copy">`)
- Before: the previous hint, quoted in full on `S-05B-UX-DECISION-CARD.md`
- After: `Copy it into a grocery app that supports pasting multiple items, or save the image for one that reads list photos. Review the items there before checkout.`
- Why: the documented inputs differ by app and platform (paste versus photo or file) [IC-LIST] [IC-CLEM] [SCH-ASK]. It names no provider and adds no control.
- Must change in the same PR: `e2e/specs/household-shop.spec.js:143` and `e2e/specs/s05c-handoff.spec.js:63` assert the old string exactly. `docs/shopping/S-05B-UX-DECISION-CARD.md:12` quotes it too. Add a one-line "superseded by S-07" note there; do not rewrite it.

**2. Recommended: allergen check.** `public/index.html:1203` (`<p class="shop-how__note">`)
- Before: `Names and quantities only. Dietary notes stay in FlavorWeave.`
- After: `Names and quantities only. Dietary notes stay in FlavorWeave, so check labels and any substitutions for allergens.`
- Why: the export deliberately drops diets and allergies (S-05C-DECISION). The destinations' own docs tell shoppers to verify allergens and AI picks [IC-CLEM] [SCH-ASK]. No test asserts this string.

**3. Optional: authoritative list.** `public/index.html:585` (`#shopExportReturn`)
- Before: `Back from shopping? Check off what you got.`
- After: `Your list stays here. Back from shopping? Check off what you got.`
- Why: it makes explicit that the external app's cart does not update FlavorWeave. No test asserts this string.

**Not proposed:** naming Instacart, Schnucks, Clementine, Alexa or AnyList, which waits for a `human_tested` fact; per-provider guided help; any provider dashboard; checkout, order or "send to store" controls; changing "Review the matched items" (it is accurate); changing button labels.

Source keys are as in `COMPATIBILITY-MATRIX.md`.
