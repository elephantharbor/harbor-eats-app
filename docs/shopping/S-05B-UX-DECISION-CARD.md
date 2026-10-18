# S-05B UX Decision Card — "How are you shopping?" and "Send to your grocery app"

**Intended repo path:** `docs/shopping/S-05B-UX-DECISION-CARD.md`
**Status:** Decision proposal for Oversight. Not implemented. Builds on `S-01-UX-DECISION-CARD.md`, `S-01-SHARING-EXPORT.md` and the Signature theme in `docs/FLAVORWEAVE-BRAND.md`.

## 1. One sheet, honest rows
"How are you shopping?" opens from the list's primary action. It is a bottom sheet on mobile, not a page and not a dashboard. **Only rows that work are shown.**

| Row | Shown when | Primary action | Copy (exact) |
|---|---|---|---|
| **Shop in store** | Always (default, first) | "Shop with my list" | "Your list, in aisle order, with check-offs." If a preferred store is saved: "Schnucks · Brentwood". |
| **Send to your grocery app** | Always | "Copy for my grocery app" · "Save list image" | "Your list is ready to share. Review the items in your grocery app before checkout." Footnote: "Names and quantities only. Dietary notes stay in FlavorWeave." |
| **Shop online with a connected service** | Only when an adapter is configured, active and allowed for this household (none in Production today) | Provider-specific, e.g. "Send to Instacart" | Existing S-03/S-04A copy. Never shown while `GROCERY_PROVIDERS` is empty. |
| **Open your store's website** | Only if a preferred store has an allowlisted host | "Open Schnucks" (opens in a new tab) | "Opens Schnucks' site. Your list doesn't move over — use Copy or Save image first." |

Superseded by S-07: the hint now reads 'Copy it into a grocery app that supports pasting multiple items, or save the image for one that reads list photos. Review the items there before checkout.'

**Never:** "Send to Schnucks/Instacart/Whole Foods" for an export; "Order", "Checkout", "Pickup", "Delivery" buttons on export rows; stock, price or "matched" badges; provider logos as decoration; a row for a provider we have not human-tested by name.

**After an export** (toast, then quiet inline note on the list): "Copied. In your grocery app, paste it into your list, then check each item before you buy." For image: "Saved. Upload it in your grocery app's list or assistant, then check each item." When the shopper returns: "Back from shopping? Check off what you got." Nothing is marked automatically.

**Guided help (optional, collapsed "How do I use this?")**, only after the Oversight test confirms each path:
- "Instacart (iPhone): Shopping List → Paste items." 
- "Schnucks: AI assistant → paperclip → choose the image."
Each line carries a small "Checked Oct 2026" date and is removed if a quarterly re-check fails.

## 2. Capability ladder (each step optional)
1. **Native in-store** — live today.
2. **Print / copy / share / download** — live today (text, CSV, print, share sheet).
3. **Grocery-app export** (clean paste text + list image) — this proposal.
4. **Provider website navigation** — label only; never claims transfer.
5. **Authorized list transfer** — e.g. Instacart IDP (built, closed to new keys), Whisk (closed).
6. **Authorized product/cart handoff** — e.g. Kroger cart_add, Walmart cart_link (gated).
Higher rungs never replace lower ones. Rungs 1–3 need no provider, account or terms.

## 3. "Send to your grocery app" — implementation-ready spec
### 3.1 Content rules (both text and image)
- **Include:** still-needed lines that are not purchased, not "already have", not skipped. Grouped by the existing category order (Produce, Meat & seafood, Dairy & eggs, Pantry…, then "Around the house").
- **Exclude:** the "FlavorWeave list" header, the dinners/headline line, meal titles, notes, "Bought", "Already have", "Leaving off", "No longer needed", member names, diets, allergies, postal code, URLs, provider names.
- **Quantity formatting:** `qty unit name`, one line each. Use the existing `formatShopQuantityAmount` / `formatTrueQuantity` (with the ⅓/⅔ fix from the polish backlog). **Text for apps uses ASCII fractions** ("1 1/2 lb", "1/8 tsp") because paste parsers handle them predictably; the **image uses Unicode fractions** (½ ⅓ ⅔ ¼ ¾ ⅛) at full text size. Units pluralize correctly ("1 ½ cups"). No trailing ".0". Countable items with no unit read "3 bananas".
- **Text format:** blank line between groups, group name on its own line, no bullets or emoji. Under 200 lines (Instacart's paste limit); if longer, split into "Part 1 of 2".

### 3.2 Image
- **Size:** 1080 px wide, height to fit (cap 4000 px; beyond that split into numbered images). Render at devicePixelRatio 2 on a canvas, export PNG.
- **Look:** white `#FFFFFF` ground (not the cream canvas — maximizes OCR contrast), ink `#17393A` (Signature Ink) or near-black for items, group labels in Teal `#0F5D5B`, uppercase, letter-spaced, 40 px bold. Items 44 px; quantity bold in a left column (≈300 px), name regular. Line height ≥ 1.5. Hairline `#E5DED7` rules between groups. Contrast ≥ 7:1 for items.
- **Title:** "Shopping list" only (no wordmark on the list body; a tiny "FlavorWeave" mark bottom-right in Line colour is acceptable but must sit outside the list area so assistants don't read it as an item — test this).
- **No:** checkboxes, icons, illustrations, coral fills, shadows, gradients, tables with borders, two columns, handwriting fonts.
- **Font:** the app's sans (Plus Jakarta Sans) if loaded; fall back to system sans. Confirm ½ ⅓ ⅔ ¼ ¾ ⅛ glyphs render (DejaVu/Noto fallback).
- **Legibility check:** the item text must still be readable when the image is shown at 375 px wide (phone screenshot scale) → ≥ 15 px effective item height.
- Reference rendering: `/workspace/s05b/test-list.png`.

### 3.3 Mobile save/share
- Prefer `navigator.canShare({ files: [file] })` → `navigator.share({ files: [png], title: "Shopping list" })` so iOS offers "Save Image" and direct share to Instacart, Messages, etc.
- Fallback: download `shopping-list-YYYY-MM-DD.png` via an object URL; on iOS Safari without file share, open the PNG in a new tab with "Press and hold to save".
- "Copy for my grocery app" uses the existing clipboard helper; fallback toast "Couldn't copy — try Save list image".
- Files are created on the device; nothing is uploaded to our server or a provider.

### 3.4 Visual and interaction quality (Signature)
- Warm surfaces: sheet on `#FFFDF8`, rows on Oat `#F7F2EC`, primary action Coral `#F15D3C` (white label ≥19 px bold), secondary actions Teal text buttons.
- Touch targets ≥ 48 px high; row spacing `--space-4`; sheet radius `--radius-xl`.
- Motion: sheet slides up 200 ms ease-out; respect `prefers-reduced-motion` (fade only). No confetti, no spinners longer than 400 ms (render is local).
- Accessibility: image export has a text alternative (the copy action sits next to it); buttons have explicit labels; the sheet traps focus and closes on Escape/back.
- Back navigation closes the sheet, not the list.

### 3.5 Measurement (proposal — needs Oversight OK)
Exports leave no server record today (S-05 §9). Add one closed telemetry event `shop_export` with props `{ kind: "copy_app" | "image" | "copy" | "share" | "print" | "download" }` only — no content, no provider, no counts of items. This makes real use visible without collecting list data.

## 4. Which near-term path best supports the future vision
Inventory, pantry, package-aware buying, budget and waste work all need **first-party** data: what the household planned, what they bought, what they still have. Consumer-assisted export keeps FlavorWeave's list as the record and stores **no retailer-derived product, location or price data**, so it carries no terms risk. Retailer APIs we found either forbid storing that data (Kroger Acceptable Use), restrict use to advertising (Walmart affiliate), or return nothing (Instacart IDP). The best near-term investment for the vision is therefore: clean export + "check off what you got" on return, which builds an honest purchase record the household owns. Retailer matching and price-aware features should wait for an authorized partner that permits it.
