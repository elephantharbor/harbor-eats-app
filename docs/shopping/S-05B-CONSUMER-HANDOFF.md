# S-05B Consumer Handoff — Instacart Photo/Paste Import and Retailer Assistants

**Intended repo path:** `docs/shopping/S-05B-CONSUMER-HANDOFF.md`
**Status:** Research only, 2026-10-17, 09:35–09:45 CT. **Nothing here was consumer-tested.** We have no Instacart, Schnucks, Amazon or Walmart account and uploaded nothing.

**The principle.** Everything in this document is *consumer-assisted*: the shopper moves the list themselves, inside an app they already use. It is not an API. A successful upload gives FlavorWeave **no** confirmed matches, stock, prices, cart, order or confirmation. FlavorWeave's own list stays the source of truth.

## 1. What the official sources say

### 1.1 Instacart Shopping List — "Add by photo" and "Paste items"
Source: Instacart Help Center, "Saved and shopping lists" (`https://www.instacart.com/help/section/2893565984`, fetched 09:35 CT). **Verified text.**
- "Take a photo of your paper list, recipe, or pantry items." Works with "Handwritten shopping lists", "Printed recipes showing ingredients", "Screenshots of recipes", pantry items. Steps: "Open your Shopping List → Tap 'Add by photo' → Take a clear photo of your list or items → The app reads your photo and adds items to your list." Failure: "No items found. Try again or add items another way."
- **"Copy and Paste Text — Paste your list from anywhere - notes, emails, texts, or websites."** Steps: "Open your Shopping List → Tap 'Paste items' → Paste your text → The app reads your text and adds items to your list." Lines, commas or no separators; **"200 items per paste"**.
- Then "Tap 'Add all items to cart'" or "+" per item, then checkout. Family-account members can all add to the Shopping List.
- **Platform limit:** "Features coming soon — Android and web support - Shopping List features will be available on Android and web soon." So today this is **iOS app only**.
- Not stated: whether "Add by photo" accepts an image chosen from the photo library (wording says "take a photo"); how quantities are kept; how the store is chosen when adding to cart.

### 1.2 Instacart AI assistant (Clementine)
Sources: Instacart newsroom 2026-09-09 ("Meet Clementine…") and company update 2026-06-18, fetched 09:39 CT. **Verified text.**
- "Grocery list upload. Snap a photo of a handwritten list, or screenshot a digital one, and Clementine turns it into a list that can be added to cart in seconds."
- Availability: "available today to most U.S. and Canadian Instacart customers through the app and website." (June: "millions of U.S. customers… full rollout… in the coming months".) So it **may not be on every account**.
- Access: "Open the Instacart app or website and select a retailer. On mobile, tap the Clementine icon on the top right above the search bar. On desktop… top of the left-hand navigation bar."
- Behavior: grounded in "what's actually available on shelves… from the customer's chosen store"; "surfaces alternatives when a preferred item is unavailable"; "does not finalize anything without explicit action and every decision is reviewed before checkout".
- **Retailer choice:** the shopper selects a retailer first. Schnucks and Dierbergs both sell on the Instacart Marketplace in St. Louis (Instacart retailer pages; Dierbergs/Instacart release 2025-04-08). Whether Clementine is switched on inside the Schnucks and Dierbergs storefronts: **Unknown — human test.**
- Platforms: iOS, Android and web for Clementine (per "app and website"); the Shopping List photo/paste path is iOS only.

### 1.3 Schnucks AI assistant (retailer-owned)
Source: `https://schnucks.com/ask-schnucks` and Schnucks releases, fetched 09:36–09:40 CT. **Verified text.**
- "Upload a recipe screenshot or photo of a handwritten list or recipe, and your Schnucks helper will pull up the ingredients for you! You stay in control—just select the size and flavor of the items you want before adding them to your digital shopping cart."
- "Open a chat window, select the paperclip symbol and choose your file or photo."
- Requires a Schnucks Rewards sign-in, a chosen store and shopping method (in-store, curbside or delivery), and acceptance of Schnucks' AI terms. Conversations are saved; usage may train Schnucks' systems. Web and Rewards app.
- This is the only **St. Louis retailer-owned** import path we found. It feeds Schnucks' own list or Delivers/Curbside cart (checkout itself runs on Instacart's Carrot Connect).

### 1.4 Others
- **Amazon (Whole Foods):** Alexa for Shopping transcribes "an image of your handwritten shopping list" into the cart; all U.S. customers. WFM cart routing unknown. **Verified text**, untested.
- **Walmart:** Sparky image/list import reported by Walmart staff posts (mid-2026). **Secondary only.**
- **Dierbergs:** no import feature documented. The app list can only be shared as a screenshot.
- **Google Gemini → Instacart carts** (SupermarketNews, 2026-08-07): another consumer assistant route. **Secondary**, not evaluated.

## 2. Workflow under evaluation
FlavorWeave list → clean export (image **or** plain text) → shopper opens Instacart (or Schnucks/Amazon) → uploads image or pastes text → app interprets → shopper picks retailer/store → reviews matches → checks out in that app.

**Plain text is likely the stronger input.** Instacart documents a paste path with clear rules and a 200-item limit, so no image recognition is involved. FlavorWeave already copies text. But the **current text export is wrong for this use** (`renderExportTextFromSections` in `src/lib/household-shop.js`):
- the first line, "FlavorWeave list", and the headline ("4 dinners · cooking for 2") will likely be read as items;
- it includes "Bought", "Already have" and "No longer needed" sections, which would be re-bought;
- meal titles in parentheses ("(miso salmon)") may become items.
A grocery-app variant must list only still-needed, unchecked lines, with no header, no meal names and plain ASCII fractions.

## 3. Synthetic test list
Files: `/workspace/s05b/test-list.png` (Unicode fractions, as FlavorWeave displays them), `/workspace/s05b/test-list-ascii.png` (1/2, 1/4… variant), `/workspace/s05b/test-list.txt` (paste version). No names, diets, allergies or real household data.

| Group | Line | What it tests |
|---|---|---|
| Produce | 2 lb yellow onions | by-weight produce → bag or loose count |
| Produce | 3 bananas | count |
| Produce | 1 bunch flat-leaf parsley | bunch unit, herb |
| Produce | ½ cup cilantro | fraction + recipe volume on an herb |
| Produce | 1 ½ lb Yukon Gold potatoes | mixed number, by weight, variety |
| Produce | 2 limes | count |
| Produce | 4 oz fresh ramps | likely unavailable in October |
| Meat & seafood | 1 ¼ lb boneless chicken thighs | mixed fraction by weight, meat |
| Dairy & eggs | 1 carton oat milk (64 fl oz) | packaging + size |
| Dairy & eggs | 1 dozen large eggs | dozen unit |
| Pantry | 2 cans black beans (15 oz each) | multiple packages + size |
| Pantry | 1 jar Rao's marinara sauce (24 oz) | **branded** item, apostrophe |
| Pantry | ⅔ cup rolled oats | thirds |
| Pantry | 1 tbsp smoked paprika | spoon measure |
| Pantry | ⅛ tsp kosher salt | tiny fraction — should become one package |
| Household | 1 pack paper towels | **non-food** |

## 4. Evaluation criteria (score each line)
| Criterion | Pass | Partial | Fail |
|---|---|---|---|
| Recognition | Right item | Related item (e.g., any parsley for flat-leaf) | Missing or wrong item |
| Quantity | Sensible package count (2 lb onions → 1 × 2–3 lb bag or ~4 loose) | Defaults to 1 with no hint | Absurd (8 bags; 0.125 of salt) |
| Fractions | ½ ¼ ⅔ ⅛ read correctly | Read as whole numbers | Dropped or garbled ("1 1/2" → 11) |
| Category / grouping | Headers ignored | One header added as an item | Several headers as items |
| Packaging | carton/can/jar/dozen understood | Ignored | Misread as item ("carton") |
| Branded | Rao's offered first | Generic marinara | Wrong product |
| Non-food | Paper towels found | — | Dropped |
| Unavailable | Flagged or substitute offered | Silently replaced | Silently dropped |
| Human review needed | <3 lines touched | 3–6 lines | >6 lines |

## 5. Human-assisted test procedure (for Oversight)
**Who:** one Oversight member with their own consumer accounts. **No purchase:** stop before checkout, then empty the test cart. No real household list.
**Platforms:** iPhone (iOS Instacart app — required for Shopping List photo/paste); Instacart website on desktop (Clementine); optionally Android. Schnucks Rewards app or schnucks.com (Schnucks assistant). Amazon iOS app (Alexa for Shopping). Optional: Walmart app (Sparky).
**Location:** set the delivery or pickup address to any 63144 address you are comfortable using, or pick Schnucks Brentwood / Dierbergs Brentwood Pointe for pickup. Record which.

**Prep (2 min):** AirDrop or message `test-list.png`, `test-list-ascii.png` and `test-list.txt` to the phone and save the images to Photos.

**Test 1 — Instacart Shopping List, paste (iOS):**
1. Open Instacart. Select **Schnucks**. Note whether a Shopping List entry is visible (search bar or Account → Shopping List).
2. Tap "Paste items". Paste the contents of `test-list.txt`.
3. Screenshot the parsed list (scroll; capture all items).
4. Tap "Add all items to cart". Screenshot the cart and any "not found" or substitution notices. Note which store the cart belongs to.
5. Repeat steps 1–4 with **Dierbergs** selected.

**Test 2 — Instacart Shopping List, photo (iOS):**
1. Clear the Shopping List. Tap "Add by photo". Check whether you can choose an existing image (Photos) or only take a new photo. If only camera: display `test-list.png` on a second screen or print it, and photograph it.
2. Screenshot the parsed list. Repeat with `test-list-ascii.png`.

**Test 3 — Clementine (web and app):**
1. On instacart.com, select Schnucks. Look for the Clementine entry (left nav). Record whether it exists on this account.
2. Upload `test-list.png`. Ask: "Add this list to my cart." Screenshot the proposed items, quantities, substitutions and unmatched lines.
3. Repeat for Dierbergs. Repeat once on the phone.

**Test 4 — Schnucks AI assistant (Rewards account required; accepting Schnucks' AI terms is the tester's own decision):**
1. Sign in at schnucks.com, set store = Schnucks Brentwood, method = curbside or in-store.
2. Open the chat → paperclip → choose `test-list.png`. Ask it to find the items.
3. Screenshot the item picks, size/flavor prompts and what lands in the list or cart. Note whether it accepts a typed list image (its copy says handwritten list, recipe screenshot, or "file or photo").
4. Delete the conversation afterwards (History → trash) if you prefer.

**Test 5 — Amazon Alexa for Shopping (optional):** Amazon app → Alexa icon → "+" → choose `test-list.png` → "Add these to my Whole Foods cart." Record which cart it fills and screenshot the result. Remove items afterwards.

**Evidence to capture for every test:** date and CT time; app version (Settings → About); platform; account region; selected retailer and store; screenshots of entry point, parsed list, cart or assistant result, and any errors; the §4 score sheet filled per line; total minutes; how many lines needed manual fixing.

**Expected observations (hypotheses, not claims):** paste beats photo on quantities and fractions; headers may appear as items; ⅛ tsp salt and ½ cup cilantro will become "1" of a package; ramps unmatched or substituted; Rao's matched where stocked; paper towels matched; the Shopping List may not carry quantities into the cart.

**Decision rule after the test:** if paste or photo correctly recognizes ≥12 of 16 lines on at least one St. Louis retailer path, name that path in guided-handoff copy. If not, ship the export as a generic "share your list" feature and name no provider.

## 6. Decision: is a provider-neutral "Export list as image" worth building?
**Yes, as part of one "Send to your grocery app" export that offers clean text first and an image second.**
- **Credible evidence:** four official consumer features read lists from images or text (Instacart Shopping List, Clementine, Schnucks assistant, Alexa for Shopping), and two of them cover the pilot's own St. Louis chains through Instacart. None needs our credentials, partnership or terms.
- **Low cost, no lock-in:** client-side rendering from the existing `/api/household-shop/export?format=json` payload; no provider code, no new tables, no retailer data stored.
- **Honest limits:** we cannot confirm anything after the hand-off; image recognition quality is unproven for typed lists; Instacart's best path is iOS-only today.
- **Also useful without any provider:** sending a readable list to a partner who shops, or keeping it on a lock screen.
The UX and technical decision is in `S-05B-UX-DECISION-CARD.md`. Do not implement in this cycle.
