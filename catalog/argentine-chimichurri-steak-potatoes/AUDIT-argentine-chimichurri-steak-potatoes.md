# Audit r2: Argentine Grilled Strip Steak with Chimichurri, Grilled Potatoes, and Ensalada Criolla

| | |
|---|---|
| Slug | `argentine-chimichurri-steak-potatoes` |
| Recipe version | `rv_argentine-chimichurri-steak-potatoes_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v1.jpg` → `argentine-chimichurri-steak-potatoes.webp` |
| r1 verdict | FAIL (E) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **E:** Step 2 now reads 'bring to a boil over high heat, about 10 minutes, and cook until just tender, about 12 minutes. Drain, steam dry 2 minutes, and toss', clocked 26 (10+12+2+toss). Step sums recompute to prep 15 + cook 55 = 70; prep/cook/total and *_time_minutes fields, time_clock and curator_preflight all say 70. 8 cups + 2 lb potatoes in the 4-quart pot is ~2.9 qt (~72%), which is acceptable. RESOLVED.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `simple` (sidecar score 1, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

14 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

r2 re-check of r1 finding: Step 2 now reads 'bring to a boil over high heat, about 10 minutes, and cook until just tender, about 12 minutes. Drain, steam dry 2 minutes, and toss', clocked 26 (10+12+2+toss). Step sums recompute to prep 15 + cook 55 = 70; prep/cook/total and *_time_minutes fields, time_clock and curator_preflight all say 70. 8 cups + 2 lb potatoes in the 4-quart pot is ~2.9 qt (~72%), which is acceptable. RESOLVED.

Prep 15 + cook 55 = 70 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The chimichurri rests while the potatoes boil (step 3 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains beef (meat).). Labels ['dairy_free'].

**Allergens:** ['meat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the beef.', 'No egg, milk, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['grilled', 'herbaceous', 'smoky', 'tangy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with steak-au-poivre-smashed-potatoes: grilled, a raw herb-vinegar sauce, no cream or pepper crust, grilled not smashed potatoes. Compared with gochujang-grilled-flank-steak: salt-only strip steak with chimichurri, no gochujang. Compared with grilled-lamb-chops-mint-salsa-verde in this wave: beef with parsley-oregano chimichurri, not lamb with mint salsa verde. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v1.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands. regeneration_count 0; 0 superseded record(s), and every file in rejected/ is hash-recorded there. The card is a faithful 640x480 downscale of the master, which is a centre 4:3 crop of the source.

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

- K (carried from r1): red-wine glass background prop; beverage only.
- D-03: coarse-salt counted (no band change).
