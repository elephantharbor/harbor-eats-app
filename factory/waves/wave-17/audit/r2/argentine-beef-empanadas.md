# Audit: Argentine Baked Beef Empanadas with Olives and Boiled Egg

| | |
|---|---|
| Slug | `argentine-beef-empanadas` |
| Recipe version | `rv_argentine-beef-empanadas_v1` |
| Package revision | `author-r3` |
| Hero | `img_v1.jpg` → `argentine-beef-empanadas.webp` (regeneration_count 0) |
| D-03 | moderate / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r2 (re-audit of author-r3), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5, floors none), ingredient_complexity `simple` (score 0, 11 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

Re-checked by arithmetic. The filling is now 3/4 lb beef, 1 onion, 3/4 red pepper, 2 chopped boiled eggs, 1/4 cup olives and 2 scallions: about 560 g, roughly 3 cups cooked. Step 5 now divides it evenly among 16 discs at about 3 tbsp (a scant 1/4 cup) each = 48 tbsp = 3 cups. Made and used reconcile. Spices and salt are scaled by 3/4. All 15 ingredients are referenced by steps; the third egg is still the wash. The r1 defect is fixed.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 34 + cook 55 = 89 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The eggs boil while the filling cooks (step 2 runs inside step 3, overlap stated). Prep 34 + cook 55 = 89, unchanged; the smaller filling shortens no step materially. Preheat and egg boil are on the clock.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`. Labels ['dairy_free'], all unconditional. HH001 False: Not HH001: beef is meat.

**Allergens:** ['meat', 'wheat', 'egg']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Meat from the beef.', 'Wheat from the pastry discs.', 'Egg from the filling and the egg wash.', 'No milk, soy, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['savory', 'crispy', 'tender', 'rich'] are supported by the method and ingredients.

## I: PASS

Title and slug are unchanged since r1 (dish identity unchanged), so the r1 duplicate check (PASS against the other 49 and all 200 live meals) stands; I did not re-run it. Package review: Compared with argentine-chimichurri-steak-potatoes: a ground-beef pastry baked in hand pies, not grilled steak with potatoes. Compared with cuban-picadillo-rice: spiced beef sealed in pastry with egg and olives, not saucy beef over rice. Compared wit

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. Hero unchanged (img_v1, hashes as r1): five baked repulgue empanadas, one open showing beef, egg, olive/scallion. Still matches the revised filling (same components, smaller quantity).

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

- C: the 1/2-serving lines say 'a quarter/half of the filling', which still works after the trim. Chile flakes 3/8 rounded to 1/4 tsp and 3/4 of a bell pepper are fine.
