# Audit: Argentine Baked Beef Empanadas with Olives and Boiled Egg

| | |
|---|---|
| Slug | `argentine-beef-empanadas` |
| Recipe version | `rv_argentine-beef-empanadas_v1` |
| Package revision | `author-r2` |
| Hero | `img_v1.jpg` → `argentine-beef-empanadas.webp` (regeneration_count 0) |
| D-03 | moderate / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **FAIL** (gate B) |

Independent auditor, Wave-17 r1, 2026-10-15 CT. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5, floors none), ingredient_complexity `simple` (score 0, 11 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: FAIL

Filling made and filling used do not reconcile. The filling is about 845 g, roughly 4 cups: 1 lb 85% beef, 2 onions, a red bell pepper, 2 chopped hard-boiled eggs, olives and scallions. The fill step puts 'about 2 tbsp' on each of 16 five-inch discs, which is about 2 cups (~0.5 L). Roughly half the filling has no use in the recipe, so the cook either overfills (and the discs won't seal) or throws food away, and the shopping list is about 2x what the method uses.

**Fix:** Make the filling match 16 discs. Either (a) say 'divide the filling evenly, about 3 tbsp (a scant 1/4 cup) each' and trim the filling to about 3 cups (3/4 lb beef, 1 onion, keep the 2 eggs); or (b) keep the filling and make 24 empanadas (24 discs, 3 sheet pans or 2 bake rounds), then update the yield wording, the bake step, the clock and the 1/2/4 scaling lines. Re-hash afterwards.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 34 + cook 55 = 89 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The eggs boil while the filling cooks (step 2 runs inside step 3, overlap stated). I rebuilt it from the steps (clock_phase/clock_minutes): the sums match 34+55=89, overlaps fit inside their host steps, and preheat and boil allowances are realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`. Labels ['dairy_free'], all unconditional. HH001 False: Not HH001: beef is meat.

**Allergens:** ['meat', 'wheat', 'egg']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Meat from the beef.', 'Wheat from the pastry discs.', 'Egg from the filling and the egg wash.', 'No milk, soy, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['savory', 'crispy', 'tender', 'rich'] are supported by the method and ingredients.

## I: PASS

Package review: Compared with argentine-chimichurri-steak-potatoes: a ground-beef pastry baked in hand pies, not grilled steak with potatoes. Compared with cuban-picadillo-rice: spiced beef sealed in pastry with egg and olives, not saucy beef over rice. Compared with greek-spanakopita: a beef filling in single crimped discs, not spinach and feta in phyllo. Auditor check: no slug collision; compared by title-token similarity (max 0.36 overall), shared dish names and primary protein/format against all 200 live meals (notes/existing-200.tsv, harbor-eats-app main 077bd14) and the other 49. Not a duplicate.

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. v1: five baked repulgue-edged empanadas on a board, one cut open to show beef, egg, green olive/scallion flecks. Reads as Argentine baked empanadas.

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
