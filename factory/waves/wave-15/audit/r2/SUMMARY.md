# Wave-15 audit r2 (Harbor Eats / FlavorWeave Catalog Factory)

Independent auditor (Vale role), 2026-10-15 (CT). I re-audited the 20 packages that changed since r1 (now `author-r3`): the 19 r1 FAILs plus `korean-galbi-jjim`. I confirmed that the other 30 are unchanged so their r1 verdicts carry. Skills: flavorweave-catalog-certification (A–O, L2, D-03) and flavorweave-meal-image-spec. Everything was checked independently. AUDITOR_HANDOFF-r2.md was used only as a pointer, and its claims were checked against the r2 backup and the live files. Packages were not edited; nothing imported, D1 untouched, no PR, nothing deployed.

## Verdict

- **r2 (20 re-audited): CERTIFIED 20 / 20, FAIL 0** (PASS 2 · PASS WITH NOTES 18). Every r1 required fix is in place.
- **Combined Wave-15 final status: CERTIFIED 50 / 50, FAIL 0** (PASS 6 · PASS WITH NOTES 44). Catalog if imported: 135 → 185.
- Certification is binary; notes do not block. Import, D1 and deploy are outside this audit and were not touched.

## Carry-over verification (30 untouched packages)

- I extracted `/workspace/wave15-backups/wave-15-author-r2-20261015-153429.tgz` (taken at 15:34:29 CT, after the creator's 15:34:00 freeze and before my r1 audit) and compared sha256 file-by-file for every file in every candidate directory.
- **30/30 are byte-identical**, with no added, removed or changed files. Even STRUCTURAL_PREFLIGHT.json and FREEZE_INTEGRITY.json match. All 30 are still `author-r2`, so their r1 verdicts (and r1 notes) carry over unchanged.
- The 20 re-audited packages are exactly the 20 directories that differ, and each is `author-r3`. No other package changed.

## Checks re-run by the auditor (all 50)

- `harbor-eats-app/factory/tools/freeze_integrity.py` on a copy: PASS 50/50, 26 checks each, 0 failures. `structural_preflight.mjs` on the same copy: PASS 50/50, hh001=20.
- culinary_hash recomputed from `tools/build_packages.py` canonical basis for all 50: all match. It changed vs r2 for exactly the 11 text-changed packages and stayed the same for the 8 image-only packages and galbi-jjim.
- Changed packages:
  - Step clock sums equal prep/cook/total and the *_time_minutes fields.
  - D-03 sidecars recompute. Karahi went to 13 counted ingredients, count band 1, complexity 1, still `simple`; huli huli went to 11, still `simple`. No enum changed.
  - No 'partly frozen', 'jammy', '4-quart' (mangú/raclette) or '4 flat' strings remain, and there is no stray `author-r2`.
- Images for the 20:
  - Master is 1200x900 RGB, card 640x480 RGB, source 1280x720.
  - asset_sha256, image-state.json and image-gen-map.txt all match the active source.
  - Each card is a faithful downscale of its master, and each master a centre crop of its source.
  - Every file in rejected/ is hash-recorded under image.superseded, and regeneration_count is consistent (ful 2, tacu tacu 3, others 1).
- All 9 new heroes and the 2 kept heroes whose recipes changed (karahi, huli huli) were viewed at full size against the recipe, the rebuilt brief and the r1 required fix.

## r2 slug × gate table

| Slug | r1 | A | B | C | D | E | F | G | H | I | J | K | L1 | L2 | L | M | N | O | r2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `argentine-chimichurri-steak-potatoes` | FAIL (E) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `cobb-salad` | FAIL (J) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `cuban-sandwiches` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `dominican-mangu-eggs-pickled-onions` | FAIL (B,E,K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `egyptian-ful-medames` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `filipino-bistek-tagalog` | FAIL (B,E) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| `hawaiian-huli-huli-chicken` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `japanese-hambagu` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `japanese-vegetable-curry-rice` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `korean-galbi-jjim` | PASS WITH NOTES | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `pakistani-chicken-karahi` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `persian-lamb-koobideh-saffron-rice` | FAIL (B) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `peruvian-aji-de-gallina` | FAIL (B) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `peruvian-tacu-tacu-egg` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `portuguese-grilled-sardines-potatoes` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `puerto-rican-pollo-guisado` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `southern-smothered-pork-chops` | FAIL (K) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| `swiss-raclette-potatoes-pickles` | FAIL (B,E) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `thai-moo-ping-sticky-rice` | FAIL (B,E) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `turkish-iskender-kebab` | FAIL (B,E) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |

## r1 findings: verification

### `argentine-chimichurri-steak-potatoes` — PASS WITH NOTES

- **E:** Step 2 now reads 'bring to a boil over high heat, about 10 minutes, and cook until just tender, about 12 minutes. Drain, steam dry 2 minutes, and toss', clocked 26 (10+12+2+toss). Step sums recompute to prep 15 + cook 55 = 70; prep/cook/total and *_time_minutes fields, time_clock and curator_preflight all say 70. 8 cups + 2 lb potatoes in the 4-quart pot is ~2.9 qt (~72%), which is acceptable. RESOLVED.

### `cobb-salad` — PASS WITH NOTES

- **J:** Both descriptions now say 'hard-cooked eggs'; no 'jammy' remains anywhere in the package. That matches the 10-minute boil with 'yolks just set' and the kept hero (fully set yolks). RESOLVED.

### `cuban-sandwiches` — PASS WITH NOTES

- **K:** New hero img_v2: two diagonal pressed halves stacked, showing distinct layers of thin, flat, sliced pale roast pork (not shredded), pink ham, melted Swiss, pickle slices and yellow mustard; a small mustard dish and pickle spears as props (both recipe items). No plantain chips. RESOLVED.

### `dominican-mangu-eggs-pickled-onions` — PASS WITH NOTES

- **B:** Equipment, HEAT and step 2 now say 6-quart pot; 10 cups + ~2.5 lb plantains ≈ 3.7 qt in 6 qt (~62%). RESOLVED.
- **E:** Step 2 now reads 'Bring to a boil over high heat, about 12 minutes, then cook until very tender, about 20 minutes', clocked 34; sums give prep 10 + cook 49 = 59, matching every time field. RESOLVED.
- **K:** New hero img_v2: the mangú is a pale ivory/cream-yellow mound glossy with olive oil, clearly a different colour from the avocado fan; pickled red onion on top; two fried eggs; avocado slices. No coffee cup or any other prop. RESOLVED.

### `egyptian-ful-medames` — PASS WITH NOTES

- **K:** New hero img_v3 (v2 was self-rejected): a loose, creamy tan-brown fava stew with dozens of whole, smooth, oval fava beans, an olive-oil pool, cumin, diced tomato, parsley and jalapeño rings, warm pita, radish halves, cucumber, and a lemon wedge at the edge. It no longer reads as ground meat. RESOLVED.

### `filipino-bistek-tagalog` — PASS

- **B:** Ingredient prep is now 'very cold, sliced thin (1/4 inch) across the grain' and step 1 says 'Slice the very cold beef thin'. No freeze is promised, so none is needed. RESOLVED.
- **E:** No uncounted freeze; clock unchanged at 15 + 46 = 61 and the step sums recompute. RESOLVED.

### `hawaiian-huli-huli-chicken` — PASS WITH NOTES

- **K:** Text option taken: '1 lime, cut into wedges, to serve' (role garnish) added to the ingredients and to serve step 7 ('Cut the lime into wedges... lime wedges for squeezing') with an ingredient_ref, so the app's ingredient-derived shopping list carries it. The kept hero's lime wedges are now recipe items. D-03: 11 counted, complexity still simple. RESOLVED.

### `japanese-hambagu` — PASS WITH NOTES

- **K:** New hero img_v2: the cut patty shows a uniformly grey-brown, cooked-through interior with no pink. Glossy red-wine/ketchup pan sauce, a short-grain rice mound, and the shredded cabbage-carrot salad. No miso soup or other side. RESOLVED.

### `japanese-vegetable-curry-rice` — PASS WITH NOTES

- **K:** New hero img_v2: rice and curry with potato, carrot, mushrooms and a scallion garnish only; no fukujinzuke or side dish. RESOLVED.

### `korean-galbi-jjim` — PASS WITH NOTES

- **—:** Re-check of the changed package: the only content change is time_clock/curator_preflight text, now 'The rice cooks and rests inside steps 5 and 6', matching step 7. The clock is still 18 + 130 = 148 and the step sums recompute. The hero is unchanged (same hash). The culinary hash is unchanged, correctly, because clock text is outside its basis. The r1 PASS WITH NOTES still holds, and the clock-text note is resolved.

### `pakistani-chicken-karahi` — PASS WITH NOTES

- **K:** Text option taken: '1 small red onion, thinly sliced, to serve' (garnish) added to the ingredients, prep step 1 ('thinly slice the red onion') and serve step 7, with ingredient_refs, so the shopping list carries it. The kept hero's bowl of sliced red onion with lemon is now recipe-backed. D-03: 13 counted → ingredient_count_band 1, complexity 1 = simple; the band change is correctly applied, and the enum is unchanged. The clock note now says the naan warms 'while the karahi finishes uncovered', matching step 6, so the r1 text note is resolved. RESOLVED.

### `persian-lamb-koobideh-saffron-rice` — PASS WITH NOTES

- **B:** Equipment is now '8 flat metal skewers, 3/4 to 1 inch wide' for the 8 kebabs in step 5. The 1-serving scaling is now 'Half a pound of lamb as 2 kebabs on 2 skewers', consistent with 2 lb / 8 = 1/4 lb per kebab. RESOLVED.

### `peruvian-aji-de-gallina` — PASS WITH NOTES

- **B:** Potato water is now 6 cups in the ingredient line and step 4. 6 cups + 1 lb potatoes + 4 eggs ≈ 2.1 qt in the 3-quart saucepan (~70%), and the potatoes and eggs are still covered. RESOLVED.

### `peruvian-tacu-tacu-egg` — PASS WITH NOTES

- **K:** New hero img_v4 (v3 superseded by Thomas because of an ají side bowl). The cake is a golden-crusted, elongated oval with rice grains and pale tan/pinkish pinto-type beans visible at the edge; it no longer reads as black beans. The salsa criolla is red-onion slivers with cilantro only, with no yellow pepper strips. Runny-yolk fried egg; one lime wedge, which the brief allows and the recipe supplies (limes). No side bowl, sauce dish, cup or prop. RESOLVED.

### `portuguese-grilled-sardines-potatoes` — PASS WITH NOTES

- **K:** New hero img_v2: exactly 4 whole grilled sardines with charred skin; small waxy potatoes halved, cut face up, with parsley and coarse salt; the charred red-pepper salad with red onion; 2 lemon wedges. No bread and no side props. RESOLVED.

### `puerto-rican-pollo-guisado` — PASS WITH NOTES

- **K:** New hero img_v2: two braised thighs in brick-orange sauce with potato, carrot, pimiento-stuffed manzanilla olives and chopped herbs, beside white rice. No tostones and no side dishes. RESOLVED.

### `southern-smothered-pork-chops` — PASS

- **K:** New hero img_v2: a bone-in chop smothered in onion gravy, white rice with gravy, and blistered green beans with sliced garlic and parsley. No cornbread and no side props. RESOLVED.

### `swiss-raclette-potatoes-pickles` — PASS WITH NOTES

- **B:** Equipment, HEAT and step 2 now say 6-quart pot; 10 cups + 2.5 lb potatoes ≈ 3.7 qt in 6 qt (~62%). RESOLVED.
- **E:** Step 2: 'Bring to a boil over high heat, about 12 minutes, then cook until tender, about 18 minutes', clocked 32; sums give 10 + 44 = 54, matching all time fields. RESOLVED.

### `thai-moo-ping-sticky-rice` — PASS WITH NOTES

- **B:** Ingredient prep is now 'very cold, sliced thin (1/8 inch)', and step 1 'Slice the very cold pork thin, 1/8 inch thick'. RESOLVED.
- **E:** No uncounted freeze; clock unchanged at 20 + 102 = 122. RESOLVED.

### `turkish-iskender-kebab` — PASS WITH NOTES

- **B:** Ingredient prep is now 'very cold, sliced thin (1/8 inch)', and step 1 'Slice the very cold lamb thin'. RESOLVED.
- **E:** No uncounted freeze; clock 15 + 66 = 81 recomputes. The clock note now says the lamb marinates during step 2's 30 minutes while the pide is cubed, the yogurt mixed and the parsley chopped, which matches step 2. RESOLVED. The HEAT text now names the 1-quart saucepan (sauce) and the 8-inch skillet (brown butter), matching steps 3 and 6, so the r1 text note is resolved.

## Required fixes

None. No r2 FAILs.

## Combined final status (all 50)

| Slug | Revision | Final verdict | Basis |
|---|---|---|---|
| `argentine-chimichurri-steak-potatoes` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `basque-hake-salsa-verde` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `bengali-mustard-fish` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `bhindi-masala-chapati` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `cantonese-char-siu-pork-rice` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `chinese-egg-foo-young` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `cobb-salad` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `cuban-sandwiches` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `cypriot-halloumi-orzo-salad` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `dominican-mangu-eggs-pickled-onions` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `egyptian-ful-medames` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `ethiopian-atakilt-wat` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `filipino-bistek-tagalog` | `author-r3` | PASS | r2 re-audit |
| `german-beef-rouladen` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `greek-gigantes-plaki` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `grilled-lamb-chops-mint-salsa-verde` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `hawaiian-huli-huli-chicken` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `herb-roast-turkey-breast-cranberry` | `author-r2` | PASS | r1 carry-over (byte-identical to r2 backup) |
| `indian-paneer-tikka` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `irish-beef-stew` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `italian-chicken-cacciatore` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `italian-grilled-calamari` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `japanese-hambagu` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `japanese-vegetable-curry-rice` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `kenyan-tilapia-ugali-sukuma` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `korean-braised-mackerel-radish` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `korean-galbi-jjim` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `lebanese-baked-kibbeh` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `malian-chicken-maafe` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `maryland-crab-cakes-slaw` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `mexican-enfrijoladas` | `author-r2` | PASS | r1 carry-over (byte-identical to r2 backup) |
| `moroccan-chermoula-fish-tagine` | `author-r2` | PASS | r1 carry-over (byte-identical to r2 backup) |
| `nepali-aloo-tama` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `new-mexican-carne-adovada` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `pakistani-chicken-karahi` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `persian-lamb-koobideh-saffron-rice` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `peruvian-aji-de-gallina` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `peruvian-tacu-tacu-egg` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `polish-bigos` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `portuguese-grilled-sardines-potatoes` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `puerto-rican-pollo-guisado` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `punjabi-rajma-chawal` | `author-r2` | PASS | r1 carry-over (byte-identical to r2 backup) |
| `red-snapper-veracruzana` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `southern-smothered-pork-chops` | `author-r3` | PASS | r2 re-audit |
| `swiss-raclette-potatoes-pickles` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `taiwanese-three-cup-mushrooms` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `thai-crispy-barramundi-tamarind` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `thai-khao-man-gai` | `author-r2` | PASS WITH NOTES | r1 carry-over (byte-identical to r2 backup) |
| `thai-moo-ping-sticky-rice` | `author-r3` | PASS WITH NOTES | r2 re-audit |
| `turkish-iskender-kebab` | `author-r3` | PASS WITH NOTES | r2 re-audit |

## Non-blocking notes from r2 (plain language for Thomas)

- `argentine-chimichurri-steak-potatoes`: K (carried from r1): red-wine glass background prop; beverage only. D-03: coarse-salt counted (no band change).
- `cobb-salad`: G: Dijon mustard disclosed in notes; no mustard token in the app.
- `cuban-sandwiches`: K: the loaf reads a little like a sandwich loaf rather than a long Cuban loaf; identity still clear. G: yellow mustard disclosed in notes; no token.
- `dominican-mangu-eggs-pickled-onions`: K: the eggs look fried sunny-side up with crisp lacy edges; that matches 'pan-fried'.
- `egyptian-ful-medames`: K: the olives on the side plate are green, but the recipe and brief specify kalamata (dark) olives. Minor side-garnish identity slip; the main dish identity is now correct. M: notes/image-gen-map.txt records the self-rejected v2 with an 8-character hash prefix only (ef2d70ae). The full sha256 is in image.superseded, so traceability holds; write the full hash to the map next time. M: image-prompt.md gives the v3 base prompt plus the addendum, but Cora did not record where the addendum sat in the prompt. The exact final prompt is not reproducible verbatim, though its content is disclosed. G: fava/G6PD caution present.
- `hawaiian-huli-huli-chicken`: K: a small dish of dark glaze sits in the top-right corner. Step 6 uses the last of the glaze on the chicken, so none is served. It is a partial corner item that matches a recipe component, so it doesn't block; next time, either reserve 2 tbsp glaze for serving or drop the dish. J/D: the description doesn't mention the new lime wedges; optional.
- `japanese-hambagu`: G: red wine (alcohol) note present.
- `japanese-vegetable-curry-rice`: K: the mushrooms read as sliced shiitake (dark caps) rather than halved cremini; non-blocking.
- `korean-galbi-jjim`: K (carried from r1): banchan corner dish not in the recipe; shiitake caps could read as chestnuts/prunes. E (carried): 12-cup blanch boil allowance is tight. G: mirin noted.
- `pakistani-chicken-karahi`: J/D: the description doesn't mention the red onion; optional.
- `persian-lamb-koobideh-saffron-rice`: K (carried): soft-focus doogh glass (beverage prop). E (carried): 12-cup rice boil allowance is tight.
- `peruvian-aji-de-gallina`: G: walnut tree_nut token present.
- `peruvian-tacu-tacu-egg`: K: the cake is an elongated oval but closer to about 1.4:1 than the brief's 'about twice as long as wide'. The identity reads (not a round burger patty), as accepted at r1. L2: small oil/yolk droplets on the plate; slightly untidy but appetizing.
- `portuguese-grilled-sardines-potatoes`: D-03: coarse-salt counted (no band change).
- `puerto-rican-pollo-guisado`: I (carried): same slot as cacciatore (chicken-thigh tomato braise with olives); distinct by cuisine.
- `swiss-raclette-potatoes-pickles`: G: microbial-rennet raclette contract and mustard note present. J: deriveCookingMethod tags crispy_non_fry 'baked' (app-side).
- `thai-moo-ping-sticky-rice`: G: fish sauce tokenized finfish; coconut disclosed in notes (no token).
- `turkish-iskender-kebab`: E: step 2 (a 30-minute marinade with prep tasks inside it) is phased as 'cook'; the arithmetic is correct either way.

## Wave-level notes still open (from r1, app-side or non-blocking)

- No importer allergen tokens for mustard, coconut, rye/barley gluten, or celery. These are disclosed in allergen_notes.
- deriveCookingMethod tags deep-fried barramundi and raclette as crispy_non_fry `baked`. This is app derivation behaviour.
- The 41 heroes kept from r1 still carry the minor non-recipe beverage, spice-dish and corner-dish notes listed in r1. The new props guard in the creator's build covers regenerated briefs only (the others are grandfathered).
- Tight-but-plausible boil allowances: rouladen, koobideh, galbi jjim. D-03 sidecars count salt/oil in a few packages, with no band change.
- Long cooks: adovada 199, char siu 187, Irish stew 184, galbi jjim 148, rouladen 147 and bigos 143 minutes.
