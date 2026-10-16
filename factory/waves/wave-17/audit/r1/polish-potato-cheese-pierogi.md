# Audit: Polish Potato-and-Cheese Pierogi with Golden Onions and Sour Cream

| | |
|---|---|
| Slug | `polish-potato-cheese-pierogi` |
| Recipe version | `rv_polish-potato-cheese-pierogi_v1` |
| Package revision | `author-r2` |
| Hero | `img_v1.jpg` → `polish-potato-cheese-pierogi.webp` (regeneration_count 0) |
| D-03 | involved / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **FAIL** (gate B) |

Independent auditor, Wave-17 r1, 2026-10-15 CT. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `involved` (sidecar score 8, floors ['technique_2_floor_involved (already met)']), ingredient_complexity `simple` (score 0, 8 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: FAIL

Filling made and filling used do not reconcile, and the dough count does not match the roll thickness. The filling is about 4-4.5 cups: 1.5 lb russets mashed (~3 cups), 8 oz farmer's cheese (~1 cup) and half the onions. Thirty-six pierogi at 'a heaping teaspoon' each use about 1.5 cups, so about two-thirds of the filling is left over. Separately, 3 cups of flour rolled to 1/16 inch and cut into 3-inch rounds gives about 60 rounds; 36 rounds matches about 1/8 inch.

**Fix:** Pick one consistent build: (a) halve the filling (3/4 lb potatoes, 4 oz farmer's cheese, same onions split), use a level tablespoon per pierogi, and say to roll about 1/8 inch thick for 36 rounds; or (b) keep the filling, roll to 1/16 inch for about 60 rounds, fill with 1 tbsp each, boil in 5 batches, and update the yield, clock and scaling. Re-hash afterwards.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 52 + cook 38 = 90 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The dough rests while the potatoes and onions cook (steps 2-4, overlap stated); the pierogi water heats while you fill (step 6 runs inside step 5, overlap stated). I rebuilt it from the steps (clock_phase/clock_minutes): the sums match 52+38=90, overlaps fit inside their host steps, and preheat and boil allowances are realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`. Labels ['vegetarian'], all unconditional. HH001 False: Not HH001: farmer's cheese, butter, and sour cream are dairy.

**Allergens:** ['wheat', 'egg', 'milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Wheat from the flour.', 'Egg from the dough.', "Milk from the farmer's cheese, butter, and sour cream.", 'No soy, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['rich', 'savory', 'tender'] are supported by the method and ingredients.

## I: PASS

Package review: Compared with pan-fried-pork-dumplings: boiled soft dough with a potato-cheese filling and onions, not pan-seared pork wrappers. Compared with kasespatzle-caramelized-onions: filled dumplings, not cheese-tossed spaetzle (shared onion topping only). Compared with polish-bigos: a vegetarian dumpling plate, not a sauerkraut and meat stew. Auditor check: no slug collision; compared by title-token similarity (max 0.36 overall), shared dish names and primary protein/format against all 200 live meals (notes/existing-200.tsv, harbor-eats-app main 077bd14) and the other 49. Not a duplicate.

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. v1: boiled crimped pierogi topped with browned onions and chives, sour cream.

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

- Image, eligibility (vegetarian, farmer's cheese contract), allergens and timing are otherwise clean.
