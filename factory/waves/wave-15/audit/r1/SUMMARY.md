# Wave-15 audit r1 (Harbor Eats / FlavorWeave Catalog Factory)

Independent auditor (Vale role), 2026-10-15 (CT). Skills: flavorweave-catalog-certification (gates A–O, L2 appeal, D-03), flavorweave-catalog-package, flavorweave-meal-image-spec. Same standard as Wave-14 (r1→r3). Packages were read only; nothing imported, D1 untouched, no PR, nothing deployed, no package file modified. All 50 hero WebPs (and the 4 rejected v1 JPEGs) were viewed with Read against each image-plating-brief.md and recipe. Creator notes (AUDITOR_HANDOFF.md, regen-v2-clarifiers.md) were used as information only.

## Verdict

**CERTIFIED 31 / 50** (PASS 4 · PASS WITH NOTES 27) · **FAIL 19**. Certification is binary; notes do not block.

- Image regenerations required: **11** (K). Text/recipe-only fixes: 8 slugs, plus the text parts of mangú.
- If all 19 are fixed and pass r2, the catalog goes from 135 to 185. As of r1 it is 135 + 31 = 166 certifiable.

## Checks re-run by the auditor

- FREEZE_INTEGRITY re-run: PASS 50/50 (26 checks each). STRUCTURAL_PREFLIGHT re-run: PASS 50/50 (HH001 true 20 / false 30).
- SHA-256 of every source JPEG, master and card matches image.asset_sha256, image-state.json and notes/image-gen-map.txt. Masters are 1200x900 RGB WebP, cards 640x480 RGB, sources 1280x720.
- The 4 v2 slugs (lamb chops, tacu tacu, barramundi, iskender) have regeneration_count 1, a superseded record with the v1 hash, and v1 in rejected/.
- package_revision is `author-r2` everywhere; generator "Cora via Grok Bot GenerateImage"; no asset-denial or stale wording (the `PENDING_AUDIT`/`awaiting_audit` state fields are correct pre-audit states).
- D-03 sidecars: sums, bands (≤12/13–16/17+), counted IDs and enums all consistent with v1.
- Uniqueness: no slug collision with the 135 catalog meals (catalog/ also holds `legacy-24`), with Wave-14, or within the wave; no true duplicates.

## Slug × gate table

| Slug | A | B | C | D | E | F | G | H | I | J | K | L1 | L2 | L | M | N | O | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `argentine-chimichurri-steak-potatoes` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `basque-hake-salsa-verde` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `bengali-mustard-fish` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `bhindi-masala-chapati` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `cantonese-char-siu-pork-rice` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `chinese-egg-foo-young` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `cobb-salad` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `cuban-sandwiches` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `cypriot-halloumi-orzo-salad` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `dominican-mangu-eggs-pickled-onions` | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `egyptian-ful-medames` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `ethiopian-atakilt-wat` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `filipino-bistek-tagalog` | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `german-beef-rouladen` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `greek-gigantes-plaki` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `grilled-lamb-chops-mint-salsa-verde` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `hawaiian-huli-huli-chicken` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `herb-roast-turkey-breast-cranberry` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| `indian-paneer-tikka` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `irish-beef-stew` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `italian-chicken-cacciatore` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `italian-grilled-calamari` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `japanese-hambagu` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `japanese-vegetable-curry-rice` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `kenyan-tilapia-ugali-sukuma` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `korean-braised-mackerel-radish` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `korean-galbi-jjim` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `lebanese-baked-kibbeh` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `malian-chicken-maafe` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `maryland-crab-cakes-slaw` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `mexican-enfrijoladas` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| `moroccan-chermoula-fish-tagine` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| `nepali-aloo-tama` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `new-mexican-carne-adovada` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `pakistani-chicken-karahi` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `persian-lamb-koobideh-saffron-rice` | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `peruvian-aji-de-gallina` | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `peruvian-tacu-tacu-egg` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `polish-bigos` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `portuguese-grilled-sardines-potatoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `puerto-rican-pollo-guisado` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `punjabi-rajma-chawal` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| `red-snapper-veracruzana` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `southern-smothered-pork-chops` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `swiss-raclette-potatoes-pickles` | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `taiwanese-three-cup-mushrooms` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `thai-crispy-barramundi-tamarind` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `thai-khao-man-gai` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS WITH NOTES |
| `thai-moo-ping-sticky-rice` | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |
| `turkish-iskender-kebab` | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL |

## FAILs and exact fixes

Every fix that touches recipe text needs culinary_hash recomputed, FREEZE_INTEGRITY and STRUCTURAL_PREFLIGHT re-run, and a package_revision bump (e.g. `author-r3`) applied consistently. Every regeneration also needs new hashes in asset_sha256, image-state.json and image-gen-map.txt, a superseded record, and the old JPEG moved to rejected/. Where the brief proposed the non-recipe prop, delete it from image-plating-brief.md "Environmental styling" and image-prompt.md before regenerating.

### `argentine-chimichurri-steak-potatoes` — FAIL (E)

- **E:** Step 2 is clocked at 18 minutes, but 12 minutes cooking plus 2 minutes steam-drying leaves 4 minutes to bring 8 cups of water plus 2 lb of cold potatoes to a boil on high. That realistically takes 10 to 12 minutes, so the clock understates by about 8 minutes. This goes beyond the 'tight boil' notes accepted in Wave-14, which allowed about 10 minutes for 12 cups.
  - **Fix:** Change step 2 clock_minutes to 26 (about 10 to boil, 12 cook, 2 steam-dry, 2 toss), or state that the potatoes start during prep as an overlap. Then restate cook/total time in time_clock, time_reconstruction and the top-level time fields.

### `cobb-salad` — FAIL (J)

- **J:** The description (dish + recipe_version) promises 'jammy-yolked hard-cooked eggs'. The method boils the eggs 10 minutes and ice-bathes them with 'yolks just set', and the hero shows fully set yolks. The consumer promise contradicts the method (Wave-14 gyudon precedent).
  - **Fix:** Text fix only: change 'jammy-yolked hard-cooked eggs' to 'hard-cooked eggs' in both descriptions and README, then recompute culinary_hash. The image already matches the method, so no regeneration is needed. (Alternative: change the method to 7 to 8 minutes with jammy yolks AND regenerate. Not recommended.)

### `cuban-sandwiches` — FAIL (K)  · REGENERATE IMAGE

- **K:** (1) A prominent bowl of plantain chips is not in the recipe and implies an extra side. (2) The pork inside the sandwich reads as shredded/pulled pork, but the recipe roasts a pork tenderloin and slices it thin.
  - **Fix:** Regenerate: pressed Cuban sandwiches cut on the diagonal, showing thin, flat, sliced roast pork tenderloin layers, ham, Swiss and pickles; no plantain chips; props limited to recipe items (pickle spears, yellow mustard). Also delete the plantain-chip line from image-plating-brief.md 'Environmental styling'.

### `dominican-mangu-eggs-pickled-onions` — FAIL (B, E, K)  · REGENERATE IMAGE

- **B:** Step 2 puts 6 green plantains (~2.5 lb) in 10 cups (2.5 qt) of water in the listed 4-quart pot. That is about 3.7 qt of water and solids, over 90% of capacity at a rolling boil (Wave-14 pot precedent: bun cha, laksa, Swedish meatballs).
  - **Fix:** Change the plantain pot in equipment and step 2 to a 6-quart pot, or cut the water to 8 cups (update the boil-water ingredient line and step 2 text to match).
- **E:** Step 2 is clocked at 24 minutes, but cooking takes 20, leaving 4 minutes to boil 10 cups of water plus 6 cold plantains. That realistically takes 12 to 15 minutes, so the clock understates by about 10 minutes.
  - **Fix:** Change step 2 clock_minutes to 34 (about 12 to boil, 20 cook, 2 reserve/drain), or start with water from a kettle and say so. Restate the cook/total times.
- **K:** Creator-flagged and confirmed: the mangú mash is distinctly green, the same hue family as the sliced avocado beside it, so it reads as guacamole or avocado mash. Boiled green plantain mashed with olive oil and cooking water is pale cream-yellow to ivory with only a faint green cast.
  - **Fix:** Regenerate: the mangú is a smooth, pale cream-yellow to warm ivory mound (at most a faint greenish tint), glossy with olive oil and topped with the pink pickled red onions, clearly a different colour from the avocado slices. Keep the fried eggs and avocado. Drop the coffee cup (not in the recipe).

### `egyptian-ful-medames` — FAIL (K)  · REGENERATE IMAGE

- **K:** The fava mash has a crumbly, granular brown texture that reads as browned ground meat. That is a serious misread for an HH001, meat-free meal. No whole or intact fava beans are visible, though the brief asks for coarsely mashed beans with some whole ones.
  - **Fix:** Regenerate: coarsely mashed, creamy, saucy brown fava beans with several whole intact fava beans clearly visible on top, a smooth loose bean texture (no crumbles or granules), an olive-oil pool, cumin, diced tomato, parsley, jalapeño and lemon wedges on top, with the recipe's cucumber spears, halved radishes, kalamata olives and warm pita on the side; no egg, no meat-like crumbles.

### `filipino-bistek-tagalog` — FAIL (B, E)

- **B:** The ingredient prep note says the sirloin is 'partly frozen 20 minutes' for slicing, but no step freezes it, and the time clock does not count it (Wave-14 Xi'an cumin lamb precedent: same pattern, B + E FAIL).
  - **Fix:** Either add a timed step ('Freeze the meat 20 minutes until firm at the edges, then slice...') and count the 20 minutes in prep, or state an explicit overlap with a named parallel task (the rice cooks) that is at least 20 minutes long. Update time_clock and time_reconstruction. Or drop 'partly frozen' and write 'very cold, sliced thin' with no freeze.
- **E:** The 20-minute partial freeze from the ingredient note is missing from the clock, so total time under-reports by up to 20 minutes for a cook who follows the note.
  - **Fix:** Follows the B fix: count the freeze in prep (or state the overlap); if 'partly frozen' is dropped, no clock change is needed.

### `hawaiian-huli-huli-chicken` — FAIL (K)  · REGENERATE IMAGE

- **K:** Lime wedges sit at the plate/tray edge. The recipe contains no lime or lemon, so this is a visible garnish that the recipe does not supply (meal-image-spec: garnish only from the recipe).
  - **Fix:** Either regenerate without lime wedges, or (text fix, no regen) add '1 lime, cut into wedges, to serve' to the ingredients, serve step and shopping list, re-hash, and re-audit K/N.

### `japanese-hambagu` — FAIL (K)  · REGENERATE IMAGE

- **K:** (1) A cup of miso soup is not in the recipe and reads as an extra side. (2) The cut patty interior is distinctly pink, but the recipe cooks to 160 F with 'juices run clear', so the image implies undercooked ground meat.
  - **Fix:** Regenerate: the cut patty interior is cooked through, juicy and grey-brown with no pink; pan sauce, short-grain rice and the shredded cabbage-carrot salad as in the recipe; no miso soup or other unlisted side. Remove the miso line from the brief.

### `japanese-vegetable-curry-rice` — FAIL (K)  · REGENERATE IMAGE

- **K:** A clearly identifiable dish of red fukujinzuke pickles sits beside the plate. It is not in the recipe and implies an extra condiment, and fukujinzuke also carries soy/wheat that the recipe doesn't disclose.
  - **Fix:** Regenerate without the pickle dish; garnish only with scallions as the recipe states. Remove fukujinzuke from the brief.

### `pakistani-chicken-karahi` — FAIL (K)  · REGENERATE IMAGE

- **K:** A bowl of sliced raw red onion is prominent. The karahi recipe contains no onion of any kind, so this is an invented visible ingredient (Wave-14 spanakopita precedent).
  - **Fix:** Regenerate without the onion bowl (lemon wedges, ginger julienne, green chiles and cilantro are fine because they are in the recipe), or add '1 small red onion, thinly sliced, to serve' to the ingredients, serve step and shopping list, re-hash, and re-audit G/N/K.

### `persian-lamb-koobideh-saffron-rice` — FAIL (B)

- **B:** Equipment lists 4 flat metal skewers, but step 5 shapes 8 kebabs 'each onto a flat skewer'. Equipment and step do not reconcile. The scaling line ('Half a pound of lamb on 1 skewer') also implies one kebab per skewer, but 8 portions from 2 lb are 1/4 lb each.
  - **Fix:** Change equipment to '8 flat metal skewers (3/4 to 1 inch wide)', and the 1-serving scaling line to 'Half a pound of lamb as 2 kebabs on 2 skewers'; or change step 5 to shape two kebabs end-to-end on each of 4 long skewers and say so in scaling.

### `peruvian-aji-de-gallina` — FAIL (B)

- **B:** The potato/egg pot is a 3-quart saucepan holding 8 cups (2 qt) water + 1 lb potatoes + 4 eggs, about 2.7 qt, ~90% of capacity at a boil. The 4-quart pot is already in use for the chicken poach at the same time.
  - **Fix:** Cut the potato water to 6 cups (update the ingredient line and step text), or add a second 4-quart pot to equipment and use it for the potatoes and eggs.

### `peruvian-tacu-tacu-egg` — FAIL (K)  · REGENERATE IMAGE

- **K:** The v2 hero fixed the oval shape. But (1) the salsa criolla shows yellow pepper strips, while the recipe's salsa is red onion, lime, cilantro and ají amarillo paste only (invented visible ingredient). (2) The bean-rice cake reads near-black, like black beans, while the recipe uses canary/pinto beans.
  - **Fix:** Regenerate (v3): keep the oval, crisp-crusted tacu tacu with a fried egg; the cake interior and crust are pale tan-brown (canary/pinto beans with rice), not black; the salsa criolla is thin red-onion slivers with lime and cilantro, tinted only lightly yellow by the paste, with no pepper strips.

### `portuguese-grilled-sardines-potatoes` — FAIL (K)  · REGENERATE IMAGE

- **K:** A slice of bread on a side plate is not in the recipe and implies an extra side (and wheat in an HH001 package with no wheat disclosure). The image also shows 3 sardines against the brief's 4 per serving, and the potatoes are whole where the brief calls for halved/smashed boiled potatoes.
  - **Fix:** Regenerate: 4 whole grilled sardines per plate with charred skin, small waxy potatoes boiled and halved with olive oil and parsley, the charred red-pepper salad with thin red onion, and lemon wedges (all in the recipe); no bread. Remove bread from the brief.

### `puerto-rican-pollo-guisado` — FAIL (K)  · REGENERATE IMAGE

- **K:** A dish of tostones (fried plantain rounds) is not in the recipe and implies an extra side.
  - **Fix:** Regenerate without tostones: the chicken stew and white rice only, as briefed. Remove tostones from the brief's environmental styling.

### `southern-smothered-pork-chops` — FAIL (K)  · REGENERATE IMAGE

- **K:** A piece of cornbread is not in the recipe and implies an extra side (and undisclosed wheat/milk/egg).
  - **Fix:** Regenerate without cornbread; show only the recipe's components: smothered chops in onion gravy, white rice, garlicky green beans and parsley. Remove cornbread from the brief.

### `swiss-raclette-potatoes-pickles` — FAIL (B, E)

- **B:** Step 2 puts 2.5 lb potatoes in 10 cups (2.5 qt) of water in a 4-quart pot. That is about 3.7 qt, over 90% of capacity at a boil (Wave-14 pot precedent).
  - **Fix:** Change equipment and step 2 to a 6-quart pot, or cut the water to 8 cups (update the potato-water ingredient line and step 2).
- **E:** Step 2 is clocked at 24 minutes, but cooking takes 18, leaving about 6 minutes (drain included) to boil 10 cups of water plus 2.5 lb cold potatoes. That realistically takes 12 to 15 minutes.
  - **Fix:** Change step 2 clock_minutes to 32 (about 12 to boil, 18 cook, 2 drain), or start the potatoes in an explicitly stated overlap. Restate the cook/total times.

### `thai-moo-ping-sticky-rice` — FAIL (B, E)

- **B:** The ingredient prep note says the pork shoulder is 'partly frozen 20 minutes' for slicing, but no step freezes it, and the time clock does not count it (Wave-14 Xi'an cumin lamb precedent: same pattern, B + E FAIL).
  - **Fix:** Either add a timed step ('Freeze the meat 20 minutes until firm at the edges, then slice...') and count the 20 minutes in prep, or state an explicit overlap with a named parallel task (the marinade is blended) that is at least 20 minutes long. Update time_clock and time_reconstruction. Or drop 'partly frozen' and write 'very cold, sliced thin' with no freeze.
- **E:** The 20-minute partial freeze from the ingredient note is missing from the clock, so total time under-reports by up to 20 minutes for a cook who follows the note.
  - **Fix:** Follows the B fix: count the freeze in prep (or state the overlap); if 'partly frozen' is dropped, no clock change is needed.

### `turkish-iskender-kebab` — FAIL (B, E)

- **B:** The ingredient prep note says the lamb/beef is 'partly frozen 20 minutes' for slicing, but no step freezes it, and the time clock does not count it (Wave-14 Xi'an cumin lamb precedent: same pattern, B + E FAIL).
  - **Fix:** Either add a timed step ('Freeze the meat 20 minutes until firm at the edges, then slice...') and count the 20 minutes in prep, or state an explicit overlap with a named parallel task (the marinade is mixed) that is at least 20 minutes long. Update time_clock and time_reconstruction. Or drop 'partly frozen' and write 'very cold, sliced thin' with no freeze.
- **E:** The 20-minute partial freeze from the ingredient note is missing from the clock, so total time under-reports by up to 20 minutes for a cook who follows the note.
  - **Fix:** Follows the B fix: count the freeze in prep (or state the overlap); if 'partly frozen' is dropped, no clock change is needed.

## Wave-level issues (not author failures unless noted)

1. **Briefs proposed non-recipe props.** This is the root cause of most K FAILs (plantain chips, tostones, cornbread, miso soup, fukujinzuke, raw onion, bread, lime) and of the beverage/spice notes (wine, beer, coffee, doogh, berbere, chaat masala, banchan). The creator's brief template should limit environmental styling to items in the recipe.
2. **Importer allergen vocabulary gaps.** There are no tokens for mustard (bengali, cobb, cuban, rouladen, crab cakes, raclette), coconut (moo ping), gluten from rye/barley (bigos, irish stew; atakilt injera; mackerel gochujang), or celery (Old Bay, gigantes, rouladen). All are disclosed in allergen_notes, so G passes; the app should add the tokens.
3. **deriveCookingMethod quirk.** It tags crispy_non_fry `baked` for deep-fried barramundi and for raclette. This is app derivation behaviour, not an author error.
4. **Boil-time realism.** Several pot steps leave too little time to bring 2+ qt of cold water to a boil. Where the allowance was ≤6 min, I marked E FAIL (argentine, mangú, raclette). Where it was 7–10 min, I left a note (rouladen, koobideh, galbi), matching the Wave-14 'tight boil' notes.
5. **'Partly frozen' with no freeze step** appears in 3 packages (bistek, moo ping, iskender): the same pattern Wave-14 failed in Xi'an lamb. The creator's ingredient template should either include a freeze step or omit the phrase.
6. **Long cook times:** adovada 199, char siu 187, irish 184, galbi jjim 148, rouladen 147, bigos 143 minutes. All are clock-correct.
7. **Cluster note:** about 8 poultry meals; cacciatore and pollo guisado are both chicken-thigh tomato braises with olives (distinct by cuisine). There are 4 lamb meals (chops, kibbeh, koobideh, iskender).
8. **D-03 cosmetic:** salt/oil/saltines are counted as ingredients in a few sidecars (argentine, sardines, bengali, barramundi, crab cakes) with no band change. specialty_items lists flavour labels while specialty_burden is 0.

## Safety summary

- All 20 HH001 claims hold: no meat, poultry, shellfish or dairy, and nut_policy none. The fish-sauce contract in barramundi (anchovy only, no shrimp) keeps it HH001. Bread/pita/injera contracts exclude milk/butter/egg.
- Peanut: maafe (token, nut_policy). Tree nut: ají de gallina (walnut), kibbeh (pine nut). Fish sauce: barramundi and moo ping tokenized finfish.
- Alcohol notes are present for hake, char siu, irish, cacciatore, hambagu, galbi jjim and three-cup. Rennet: halloumi and raclette (microbial) contracts; paneer is acid-set. Ful has a G6PD/fava caution.

## PASS WITH NOTES (plain language for Thomas)

- `argentine-chimichurri-steak-potatoes` (FAIL): K: a red-wine glass in the background is not in the recipe; beverage prop only, non-blocking. D-03: coarse-salt counted as an ingredient (no band change).
- `basque-hake-salsa-verde` (PASS WITH NOTES): G: white-wine alcohol note present; finfish only; HH001 valid.
- `bengali-mustard-fish` (PASS WITH NOTES): E: rice timing is tight against the fish steps; tolerable. G: mustard (seeds and oil) disclosed in notes; the app has no mustard token. Mustard-oil 'labeled for cooking' contract present. D-03: mustard-oil counted (no band change).
- `bhindi-masala-chapati` (PASS WITH NOTES): K: lemon wedge is in the recipe; fine.
- `cantonese-char-siu-pork-rice` (PASS WITH NOTES): K: the red lacquered edge is weaker than classic char siu; still reads correctly. G: Shaoxing wine (alcohol, wheat) noted. E: long total (187 min).
- `chinese-egg-foo-young` (PASS WITH NOTES): E: rice rest tight; tolerable.
- `cobb-salad` (FAIL): G: Dijon mustard noted; no token.
- `cuban-sandwiches` (FAIL): G: yellow mustard noted; no token.
- `cypriot-halloumi-orzo-salad` (PASS WITH NOTES): B: 10 cups water + orzo in a 4-quart pot is about 2.9 qt (~70%); acceptable. G: halloumi rennet contract present.
- `dominican-mangu-eggs-pickled-onions` (FAIL): K: the coffee-cup prop is not in the recipe; remove it during the regeneration.
- `egyptian-ful-medames` (FAIL): G: fava/G6PD caution note present (good).
- `ethiopian-atakilt-wat` (PASS WITH NOTES): K: a small dish of berbere-like red spice sits at the edge; the recipe uses turmeric, not berbere. Spice prop only, non-blocking; prefer to drop it in future images. G: injera wheat/gluten note present.
- `german-beef-rouladen` (PASS WITH NOTES): E: potato boil (8 cups + potatoes, 18-min cook) in the stated last-25-minute window is tight. G: mustard noted; no token.
- `greek-gigantes-plaki` (PASS WITH NOTES): K: crusty bread is in the recipe; fine.
- `grilled-lamb-chops-mint-salsa-verde` (PASS WITH NOTES): v2 hero (loin chops, not frenched) matches the brief; good.
- `hawaiian-huli-huli-chicken` (FAIL): I: one of about 8 poultry meals in this wave.
- `indian-paneer-tikka` (PASS WITH NOTES): K: a small dish of chaat-masala-like spice at the edge is not in the recipe; spice prop, non-blocking. G: paneer is acid-set (no rennet issue).
- `irish-beef-stew` (PASS WITH NOTES): G: stout (alcohol) noted; barley (gluten) disclosed in notes, no gluten token. E: long total (184 min).
- `italian-chicken-cacciatore` (PASS WITH NOTES): K: wine is in the recipe. I: same slot as pollo guisado (chicken-thigh tomato braise) and the catalog paprikash; distinct by cuisine and ingredients.
- `italian-grilled-calamari` (PASS WITH NOTES): K: a wine glass prop is not in the recipe; beverage prop, non-blocking.
- `japanese-hambagu` (FAIL): G: sake/mirin alcohol note present.
- `kenyan-tilapia-ugali-sukuma` (PASS WITH NOTES): K: a tiny, soft-focus corner dish of chopped tomato/chile is not in the recipe (lemon is); non-blocking, but drop it in future images.
- `korean-braised-mackerel-radish` (PASS WITH NOTES): K: a banchan dish (sprouts) in the corner is not in the recipe; partial and out of focus, non-blocking. G: gochujang no-barley-malt contract present.
- `korean-galbi-jjim` (PASS WITH NOTES): K: banchan corner dish (non-recipe, partial); shiitake caps are dark enough to be misread as chestnuts/prunes. Clock text says rice cooks 'inside step 6' while step 7 says steps 5-6; cosmetic. G: mirin noted. E: long (148 min).
- `lebanese-baked-kibbeh` (PASS WITH NOTES): K: pieces are cut in triangles rather than the scored diamonds the brief describes (creator flag); identity still reads. G: pine-nut tree_nut token present.
- `malian-chicken-maafe` (PASS WITH NOTES): G: peanut token and peanut nut_policy present; correct.
- `maryland-crab-cakes-slaw` (PASS WITH NOTES): K: a wooden crab mallet prop (tool, no shells) is non-blocking. G: mustard noted; Old Bay contains celery (not an app allergen). D-03: saltines counted (no band change).
- `nepali-aloo-tama` (PASS WITH NOTES): K: a cardamom spice prop is non-blocking.
- `new-mexican-carne-adovada` (PASS WITH NOTES): E: long (199 min), the longest in the wave; clock reconciles.
- `pakistani-chicken-karahi` (FAIL): Text: clock text says the naan warms 'while the karahi rests', but the step says 'while it finishes uncovered'; cosmetic.
- `persian-lamb-koobideh-saffron-rice` (FAIL): K: a doogh/yogurt-drink glass in soft focus; beverage prop, non-blocking. E: 12-cup rice boil allowance (~9 min) is tight.
- `peruvian-aji-de-gallina` (FAIL): G: walnut tree_nut token present; Parmesan is not vegetarian-claimed.
- `polish-bigos` (PASS WITH NOTES): K: a beer-glass prop is non-blocking. G: rye bread has a wheat token plus 'Contains gluten (rye)'; no gluten_free claim. E: long (143 min).
- `red-snapper-veracruzana` (PASS WITH NOTES): K: jalapeño rings are not visible (creator flag) and the olives are sliced rather than whole; still reads as veracruzana.
- `swiss-raclette-potatoes-pickles` (FAIL): G: microbial-rennet raclette contract present; mustard noted. J: deriveCookingMethod tags crispy_non_fry 'baked' (app derivation, not an author error).
- `taiwanese-three-cup-mushrooms` (PASS WITH NOTES): K: some king-oyster rounds could read as meat or scallops at card size; identity carried by the basil and sauce. G: Shaoxing/rice wine noted; HH001 valid.
- `thai-crispy-barramundi-tamarind` (PASS WITH NOTES): G: fish sauce tokenized finfish with an anchovy-only, no-shrimp contract; HH001 valid. J: deriveCookingMethod tags crispy_non_fry 'baked' although the fish is deep-fried (app derivation quirk). D-03: fry-oil counted (no band change). v2 hero is good.
- `thai-khao-man-gai` (PASS WITH NOTES): G: tao jiao (soybean paste) wheat noted.
- `thai-moo-ping-sticky-rice` (FAIL): G: fish sauce tokenized finfish; coconut milk disclosed in notes (no coconut token); not HH001 (pork). K: lime is in the recipe.
- `turkish-iskender-kebab` (FAIL): Text: the HEAT section mentions brown butter in a saucepan while the step uses an 8-inch skillet; cosmetic, fix with the B edit. v2 hero (no herbed yogurt) is good.
