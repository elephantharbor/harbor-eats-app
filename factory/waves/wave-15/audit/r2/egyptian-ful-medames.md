# Audit r2: Egyptian Ful Medames with Warm Pita, Tomato, and Cucumber

| | |
|---|---|
| Slug | `egyptian-ful-medames` |
| Recipe version | `rv_egyptian-ful-medames_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v3.jpg` → `egyptian-ful-medames.webp` |
| r1 verdict | FAIL (K) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **K:** New hero img_v3 (v2 was self-rejected): a loose, creamy tan-brown fava stew with dozens of whole, smooth, oval fava beans, an olive-oil pool, cumin, diced tomato, parsley and jalapeño rings, warm pita, radish halves, cucumber, and a lemon wedge at the edge. It no longer reads as ground meat. RESOLVED.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `easy` (sidecar score 1), ingredient_complexity `simple` (sidecar score 1, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

14 ingredients, 5 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 3 + cook 21 = 24 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. Short stovetop meal; the vegetables are cut while the beans simmer (step 3 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy False, vegetarian True, plant-based True, nut_policy `none`; HH001 True (Plant-based. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'vegetarian', 'plant_based'].

**Allergens:** ['wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Wheat from the pita.', 'The pita is a store-bought hard contract: the label lists no milk, butter, egg, honey, soy, or sesame.', 'No egg, milk, soy, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['savory', 'citrusy', 'fresh', 'creamy', 'north-african'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with egyptian-koshari: fava beans and pita, no lentil-rice-pasta layering or tomato sauce. Compared with greek-gigantes-plaki in this wave: mashed stovetop favas with raw garnishes, not a baked tomato casserole. Compared with sabich-pita-sandwiches: a bowl of mashed fava beans with pita on the side, not stuffed pita with eggplant and egg. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

r2 re-check of r1 finding: New hero img_v3 (v2 was self-rejected): a loose, creamy tan-brown fava stew with dozens of whole, smooth, oval fava beans, an olive-oil pool, cumin, diced tomato, parsley and jalapeño rings, warm pita, radish halves, cucumber, and a lemon wedge at the edge. It no longer reads as ground meat. RESOLVED.

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v3.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands. regeneration_count 2; 2 superseded record(s), and every file in rejected/ is hash-recorded there. The card is a faithful 640x480 downscale of the master, which is a centre 4:3 crop of the source.

## L2 — PASS

Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

L1 and L2 both pass (K is judged separately).

## M — PASS

Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r3` consistent across top-level, recipe_version, image, sidecar, README and brief (no stray author-r2). culinary_hash recomputed by the auditor from the build basis: matches. Unchanged from r2, as expected (image-only or clock-text-only change). Version 1; classification_history present; FREEZE_INTEGRITY re-run PASS (26/26).

## Notes (non-blocking)

- K: the olives on the side plate are green, but the recipe and brief specify kalamata (dark) olives. Minor side-garnish identity slip; the main dish identity is now correct.
- M: notes/image-gen-map.txt records the self-rejected v2 with an 8-character hash prefix only (ef2d70ae). The full sha256 is in image.superseded, so traceability holds; write the full hash to the map next time.
- M: image-prompt.md gives the v3 base prompt plus the addendum, but Cora did not record where the addendum sat in the prompt. The exact final prompt is not reproducible verbatim, though its content is disclosed.
- G: fava/G6PD caution present.
