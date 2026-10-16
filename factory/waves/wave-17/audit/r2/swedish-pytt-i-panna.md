# Audit: Swedish Pytt i Panna Ham and Potato Hash with Pan-Fried Eggs and Pickled Beets

| | |
|---|---|
| Slug | `swedish-pytt-i-panna` |
| Recipe version | `rv_swedish-pytt-i-panna_v1` |
| Package revision | `author-r3` |
| Hero | `img_v1.jpg` → `swedish-pytt-i-panna.webp` (regeneration_count 0) |
| D-03 | moderate / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r2 (re-audit of author-r3), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 3, floors none), ingredient_complexity `simple` (score 0, 8 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

Re-checked by arithmetic. Step 2 now browns the 2 lb of 1/2-inch dice in 2 batches: each ~1 lb (~50 sq in footprint) lies in one layer on the ~71-78 sq in floor of the 12-inch skillet. That satisfies the one-layer rule, and the do-not-scale note now says the same. Oil 1 + 1 tbsp = 2 tbsp listed; butter 1 (batch 1) + 1 (onion) + 1 (eggs) = 3 tbsp listed, matching the splits. The 1- and 2-serving lines (one batch) also fit. The r1 defect is fixed.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 15 + cook 47 = 62 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The eggs are pan-fried while the hash finishes browning (step 5 runs inside step 4, overlap stated). Step 2 is 2 min heat + 7 covered + 8 uncovered (batch 1) + ~15 (batch 2) = 32; step clocks sum to 15 + 47 = 62. The egg overlap (5) still sits inside step 4 (7). Realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`. Labels [], all unconditional. HH001 False: Not HH001: ham and kielbasa are meat; butter is dairy.

**Allergens:** ['meat', 'milk', 'egg']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Meat from the ham and kielbasa.', 'Milk from the butter.', 'Egg from the pan-fried eggs.', 'No soy, wheat, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['scandinavian', 'crispy', 'savory', 'rich'] are supported by the method and ingredients.

## I: PASS

Title and slug are unchanged since r1 (dish identity unchanged), so the r1 duplicate check (PASS against the other 49 and all 200 live meals) stands; I did not re-run it. Package review: Compared with swedish-meatballs-lingonberry: a diced potato and ham hash with eggs, not meatballs in cream gravy. Compared with swiss-rosti-smoked-trout: diced browned potatoes with ham and sausage, not a shredded potato cake with fish. Compared with

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. Hero unchanged (img_v1): browned diced potato, ham and kielbasa hash with a fried egg and pickled beets. The batch change is invisible on the plate; still matches.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v1.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (r2 re-check: mean abs diff 1.6-1.9, card 2.2-2.6), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 0.

## L2: PASS

Appetizing, well lit, abundant, and reads at card size; on par with the house reference range.

## L: PASS

L1 and L2 both PASS.

## M: PASS

Text provenance original_ai_assisted; image ai_illustration via Grok Bot GenerateImage, with the 1280x720 source disclosed; no stock or web photo; no metadata denies an asset that is present.

## N: PASS

Shopping list derivable; units and package sizes are shoppable.

## O: PASS

package_revision `author-r3` is consistent across top level, recipe_version, image, sidecar and docs; version 1; classification_history present; certification null, kitchen_tested false. revision_history records the author-r2 → author-r3 entry (trigger, scope, before/after culinary_hash, changes), and it matches the field-level diff I made against my r1 pre-audit copy. My own run of FREEZE_INTEGRITY on a scratch copy: PASS (26/26). culinary_hash recomputes. The superseded/rejected records for audit-rejected heroes are complete, and the rejected files are byte-identical to the r1 heroes.

## Notes (non-blocking)

- B: in step 3 the onion cooks beside all 2 lb of returned potatoes, which is crowded for 'soft and golden'. Tolerable, since the hard browning is already done. Optional: cook the onion while batch 2 browns.
- D-03 effort is unchanged (moderate, 3 points). The total-time band moves from 46-60 to 61-90, and coverage docs were regenerated (not audited here beyond consistency).
