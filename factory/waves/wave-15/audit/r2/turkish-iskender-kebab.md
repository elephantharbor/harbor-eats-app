# Audit r2: Turkish İskender Kebab: Sliced Lamb over Pide with Tomato Sauce, Brown Butter, and Yogurt

| | |
|---|---|
| Slug | `turkish-iskender-kebab` |
| Recipe version | `rv_turkish-iskender-kebab_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v2.jpg` → `turkish-iskender-kebab.webp` |
| r1 verdict | FAIL (B, E) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **B:** Ingredient prep is now 'very cold, sliced thin (1/8 inch)', and step 1 'Slice the very cold lamb thin'. RESOLVED.
- **E:** No uncounted freeze; clock 15 + 66 = 81 recomputes. The clock note now says the lamb marinates during step 2's 30 minutes while the pide is cubed, the yogurt mixed and the parsley chopped, which matches step 2. RESOLVED. The HEAT text now names the 1-quart saucepan (sauce) and the 8-inch skillet (brown butter), matching steps 3 and 6, so the r1 text note is resolved.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7), ingredient_complexity `standard` (sidecar score 3, 15 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

r2 re-check of r1 finding: Ingredient prep is now 'very cold, sliced thin (1/8 inch)', and step 1 'Slice the very cold lamb thin'. RESOLVED.

19 ingredients, 7 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

r2 re-check of r1 finding: No uncounted freeze; clock 15 + 66 = 81 recomputes. The clock note now says the lamb marinates during step 2's 30 minutes while the pide is cubed, the yogurt mixed and the parsley chopped, which matches step 2. RESOLVED. The HEAT text now names the 1-quart saucepan (sauce) and the 8-inch skillet (brown butter), matching steps 3 and 6, so the r1 text note is resolved.

Prep 15 + cook 66 = 81 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The lamb marinates for the 30 minutes of step 2, while the pide is cubed, the garlic yogurt is mixed, and the parsley is chopped.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains lamb (meat), butter, and yogurt (dairy).). Labels [].

**Allergens:** ['meat', 'milk', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the lamb.', 'Milk from the butter and yogurt.', 'Wheat from the pide.', 'The pide is a store-bought hard contract: the label lists wheat flour, water, yeast, salt, and oil, with no egg, milk, or sesame (no nigella or sesame topping).', 'No egg, soy, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['rich', 'savory', 'smoky', 'tangy', 'middle-eastern'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with turkish-lahmacun: sliced lamb over cubed bread with tomato sauce, butter, and yogurt, not a thin spiced-meat flatbread. Compared with greek-chicken-souvlaki: lamb over sauced bread cubes, not chicken skewers in pita. Compared with persian-lamb-koobideh-saffron-rice in this wave: sliced lamb on bread with butter and yogurt, not ground kebabs over rice. Compared with sabich-pita-sandwi Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v2.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands. regeneration_count 1; 1 superseded record(s), and every file in rejected/ is hash-recorded there. The card is a faithful 640x480 downscale of the master, which is a centre 4:3 crop of the source.

## L2 — PASS

Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

L1 and L2 both pass (K is judged separately).

## M — PASS

Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r3` consistent across top-level, recipe_version, image, sidecar, README and brief (no stray author-r2). culinary_hash recomputed by the auditor from the build basis: matches. It changed from r2 as expected. Version 1; classification_history present; FREEZE_INTEGRITY re-run PASS (26/26).

## Notes (non-blocking)

- E: step 2 (a 30-minute marinade with prep tasks inside it) is phased as 'cook'; the arithmetic is correct either way.
