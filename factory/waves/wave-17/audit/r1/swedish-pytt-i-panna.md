# Audit: Swedish Pytt i Panna Ham and Potato Hash with Pan-Fried Eggs and Pickled Beets

| | |
|---|---|
| Slug | `swedish-pytt-i-panna` |
| Recipe version | `rv_swedish-pytt-i-panna_v1` |
| Package revision | `author-r2` |
| Hero | `img_v1.jpg` → `swedish-pytt-i-panna.webp` (regeneration_count 0) |
| D-03 | moderate / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **FAIL** (gate B) |

Independent auditor, Wave-17 r1, 2026-10-15 CT. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 3, floors none), ingredient_complexity `simple` (score 0, 8 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: FAIL

The equipment fit does not match the package's own one-layer rule. Step 2 puts 2 lb of Yukon Golds in 1/2-inch dice into the 12-inch skillet 'in one layer', and do_not_scale says 'one layer of potatoes; never crowd the pan'. 2 lb is ~410 half-inch cubes, a footprint of about 100 sq in. A 12-inch skillet has a flat base of about 9.5-10 in (71-78 sq in). The potatoes cover ~130-140% of the floor before the onion, 8 oz ham and 8 oz kielbasa go in (steps 3-4). The promised 'browned' result depends on floor contact, so the stated method can't be followed as written. This is the same class as the Wave-16 oil-depth FAILs, where a stated parameter couldn't be reached.

**Fix:** Either (a) cut the potatoes to 1 1/2 lb (about 75 sq in, one layer) and rescale the 1/2-serving lines; or (b) keep 2 lb and brown the potatoes in 2 batches (or use two 12-inch skillets), adding ~10 minutes to step 2 and the clock, and change the do-not-scale text to match. Re-hash afterwards.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 15 + cook 37 = 52 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The eggs are pan-fried while the hash finishes browning (step 5 runs inside step 4, overlap stated). I rebuilt it from the steps (clock_phase/clock_minutes): the sums match 15+37=52, overlaps fit inside their host steps, and preheat and boil allowances are realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`. Labels [], all unconditional. HH001 False: Not HH001: ham and kielbasa are meat; butter is dairy.

**Allergens:** ['meat', 'milk', 'egg']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Meat from the ham and kielbasa.', 'Milk from the butter.', 'Egg from the pan-fried eggs.', 'No soy, wheat, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['scandinavian', 'crispy', 'savory', 'rich'] are supported by the method and ingredients.

## I: PASS

Package review: Compared with swedish-meatballs-lingonberry: a diced potato and ham hash with eggs, not meatballs in cream gravy. Compared with swiss-rosti-smoked-trout: diced browned potatoes with ham and sausage, not a shredded potato cake with fish. Compared with spanish-potato-tortilla: crisp diced potatoes topped with pan-fried eggs, not a set potato and egg  Auditor check: no slug collision; compared by title-token similarity (max 0.36 overall), shared dish names and primary protein/format against all 200 live meals (notes/existing-200.tsv, harbor-eats-app main 077bd14) and the other 49. Not a duplicate.

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. v1: diced browned potato, ham and kielbasa hash with a sunny egg, pickled beet slices, parsley.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v1.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (mean abs diff 1.4-2.3), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 0.

## L2: PASS

Appetizing, well lit, abundant, and reads at card size; on par with the house reference range.

## L: PASS

L1 and L2 both PASS.

## M: PASS

Text provenance original_ai_assisted; image ai_illustration via Grok Bot GenerateImage, with the 1280x720 source disclosed; no stock or web photo; no metadata denies an asset that is present.

## N: PASS

Shopping list derivable; units and package sizes are shoppable.

## O: PASS

package_revision `author-r2` is consistent across top level, recipe_version, image, sidecar and docs; version 1; classification_history present; certification null, kitchen_tested false. My own run of FREEZE_INTEGRITY: PASS (26/26). culinary_hash recomputes.

## Notes (non-blocking)

- F: ham, kielbasa and pickled-beet label rules are present. G: food-safety copy covers runny-yolk choice ('cover for firmer yolks').
