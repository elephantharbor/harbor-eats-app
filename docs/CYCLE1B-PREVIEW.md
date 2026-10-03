# Cycle 1B preview validation

Targeted preview check only. This is not the campaign-wide Opus review.

**Preview URL:** https://harbor-eats-cycle1-preview.pages.dev/?qa=1 (`/api/health` reports `environment: cycle1-preview`)  
**Integration SHA under test:** `35b19159643c017ed407bcda4ac5c2f72b2f09ba`  
**Branch for these notes:** `feature/fw-c1b-preview`, cut from that SHA  
**Agent model:** Claude Opus 5.5 (`claude-opus-5-5`)  
**Tooling:** Playwright 1.63 (repo `@playwright/test`), Chromium, Node 22.14, run against the live preview with no local server.  
**Date:** 2026-10-03

## What was deployed

The preview serves the same files as the integration tip. `/`, `styles.css`, `app.js`, `sw.js`, `theme.js`, `nav-context.js` and `meal-media.js` are byte-identical to `public/` at `35b1915`. `sw.js` has `CACHE_VERSION = "fw-sw-v7"`, and a browser that let the service worker install ends with exactly one cache, `fw-sw-v7`.

## Guardrails

- Every browser context aborted any request to `harbor-eats-app.pages.dev`. None were attempted. Production was not opened.
- All kitchens were created with `?qa=1`. The server stored them as `data_origin: synthetic` on the disposable `harbor-eats-cycle1-preview` database.
- Fake names only: `Maple Lane QA Kitchen` (Quinn, Avery) and `Birch Court QA Kitchen` (Rowan). No Tom, no Renata, no Household 001.
- The single cook and rating ran in the synthetic Maple Lane kitchen. No real household was used.
- No product code changed, nothing merged, nothing deployed, integration branch not pushed.

## Method

For each viewport and theme, a fresh context loaded the synthetic session with `fw_theme` preset (all per-member `fw_theme:*` overrides cleared) and confirmed `<html data-theme>` matched. It then visited Home, Tonight, recipe detail (opened from Tonight), History, Profile, Settings, and Invite (from Settings). On each screen it recorded:

- `documentElement.scrollWidth − clientWidth` and the same for `body`
- every rendered element whose box crosses the left or right edge of the viewport, excluding elements inside a horizontal scroller. This catches clipping hidden by `overflow-x: hidden`, which `scrollWidth` alone misses.
- a full-page screenshot

Viewports: 390×844, 768×1024, 1280×800, 1440×900.

## Matrix

Each cell covers all seven screens. "0 / 0" means zero document overflow and zero elements past either edge.

| Viewport | Signature | Dark Mode | Citrus Berry |
|----------|-----------|-----------|--------------|
| 390 mobile | PASS WITH NOTES (0 / 0) | PASS WITH NOTES (0 / 0) | PASS WITH NOTES (0 / 0) |
| 768 tablet | PASS (0 / 0) | PASS (0 / 0) | PASS (0 / 0) |
| 1280 laptop | PASS (0 / 0) | PASS (0 / 0) | PASS (0 / 0) |
| 1440 wide | PASS (0 / 0) | PASS (0 / 0) | PASS (0 / 0) |

Settings at 390 and 768 fits in all three themes. The theme picker (one column at 390, three at 768), Household fields, Members rows with Active and Invited badges, and the diet-limit grid all stay inside the viewport. The 768 header fix holds: the brand, the four top-nav links, the avatars and the Settings gear fit in one row with no right-edge clipping. The household name label stays hidden until 960px as intended.

Navigation chrome is correct at every width. At 390 the bottom tab bar shows and the top nav is hidden. At 768 and above the top nav shows and the tab bar is hidden.

### Notes on the 390 rows

These are notes, not overflow. Nothing crosses the right edge.

1. **Sticky recipe actions cover the tab row on first view.** On a recipe before a pick, the sticky Preview steps and Choose this dinner bar starts at y=688. The Overview, Ingredients, Steps and Notes tab row is at y=686–731, so on first paint the tab labels show faintly behind the buttons until the user scrolls. Once scrolled, the tabs and content are fully readable. The `.sticky-actions` rules are byte-identical on `main` (`9795220`), so Cycle 1 did not introduce this. Not fixed. A possible follow-up is to make the hero shorter on phones, or move the tabs above the fold. Screenshot: `vp390-signature-detail-prepick-top.png`.
2. **"Your pick" badge overlaps the picked card's title.** Once a dinner is chosen, the `.option-card__pick` badge is absolutely positioned at the card's top right. On a 390 card the title sits in that spot, so "Grilled Peach Burrito Bowl" reads as "Grilled Peach B… Bowl" behind the badge. At 768 and above the badge sits over the photo and covers no text. These rules are byte-identical on `main`, so Cycle 1 did not introduce this. Not fixed. Screenshot: `spot-tonight-wrap-390.png`.
3. **QA debug pill.** The `qa-on` status pill (for example `Unselected · 1–10 · Q:— A:—`) sits just under the header on the right at every width. It overlaps the edge of the hero image on the recipe screen. QA-only chrome, not shown to real households.

The tab bar appears mid-page in the 390 full-page captures. That is how full-page screenshots draw fixed elements: at the bottom of the first viewport. The viewport-sized captures (`vp390-*`) show it docked correctly.

## Spot checks (QA mode, synthetic kitchen)

| Check | Result | Evidence |
|-------|--------|----------|
| Tonight cards show time, effort and style when a plan exists | PASS | All three cards at every viewport and theme show four metadata chips. Example: `40 min · Easy · fillet · Fish`, `40 min · Easy · bowl · Plant`, `40 min · Easy · pasta · Shellfish`. |
| Viewing a recipe is not selecting it | PASS | Opening option B shows "Just looking — nothing’s chosen until you tap Choose this dinner." After Back: zero `.selected-mark` cards, and `/api/sessions/me` returns `selection: null`. Choose this dinner then shows "Tonight’s pick". |
| Back returns to the screen the recipe was opened from | PASS | From Tonight, the back control reads "Tonight", the Tonight nav item is highlighted, and Back lands on Tonight. From History, it reads "History", shows "From a past round · rated 8.0/10. Viewing it doesn’t add it to tonight.", hides Start cooking, and Back lands on History. Home has no recipe link before a pick, so there was no third origin to test. |
| Settings → Invite → Back stays in the app shell | PASS | On Invite, `data-chrome="full"`, the top nav is visible, the Settings gear is highlighted, the eyebrow reads "Invite" with no step count, the progress bar is hidden, and Back reads "Settings". Back returns to Settings with full chrome. Detailed check at 1280. The `data-chrome="full"`, "Settings" back label and return to Settings were also checked at all 12 combinations. |
| Dietary controls show No nuts and an explicit Cashews are OK exception | PASS | "No nuts: Peanuts and tree nuts, cashews included". Before No nuts is ticked, the cashew control does not exist. After it is ticked, "Cashews are OK: An exception to No nuts. Every other nut stays off." appears. The same pair shows in Settings at every width. |
| Completed meal shows Find our next dinner | PASS (reached) | The synthetic Maple Lane kitchen chose option B, cooked it through to Finish, and was rated 8/10 by Quinn, its one active diner (Avery is still Invited, so there is one rater card). "Find our next dinner" is visible on the rating-complete screen, on Tonight ("That round’s a wrap"), and on Home. The completed Home and Tonight screens have 0 / 0 overflow at 390. The button was not clicked, so no new round was started. |
| Meal images have a stable frame | PASS | `.meal-media` has CSS `aspect-ratio: 4 / 3` and `<img width="1200" height="900">`. Card frames measure 363×272 at 1280 and are the same before and after photos finish loading. A layout-shift observer recorded zero shifts while the cards loaded. At 390 the card thumbnail uses a 1:1 frame, which is consistent across all cards and themes. |

## Screenshots

Saved outside the repo under `/opt/cursor/artifacts/c1b-preview/`:

- `matrix-<viewport>-<theme>-<screen>.png`: 84 full-page captures (4 viewports × 3 themes × 7 screens)
- `spot-*.png`: dietary controls, Tonight cards, Just looking, Invite from Settings, completed loop, Tonight wrap, Home after rating, recipe from History
- `vp390-*.png`, `vp768-*.png`: viewport-sized captures of the recipe screen and Invite
- `results.json`: raw measurements for every screen
