# Audit: Japanese Chicken Nanban with Tartar Sauce, Shredded Cabbage, and Rice

| | |
|---|---|
| Slug | `japanese-chicken-nanban` |
| Recipe version | `rv_japanese-chicken-nanban_v1` |
| Package revision | `author-r2` |
| Hero | `img_v1.jpg` → `japanese-chicken-nanban.webp` (regeneration_count 0) |
| D-03 | involved / standard |
| HH001 | False |
| Freeze integrity | auditor re-run on a copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r1, 2026-10-15 CT. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7, floors ['attention_2_floor_moderate (already met)']), ingredient_complexity `standard` (score 2, 13 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

17 ingredients and 7 steps. Every ingredient is used, split quantities are stated, and the equipment fits the quantities (checked by arithmetic).

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 18 + cook 51 = 69 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks and rests through the eggs, tartar, and frying (step 2 runs inside steps 3-7, overlap stated). I rebuilt it from the steps (clock_phase/clock_minutes): the sums match 18+51=69, overlaps fit inside their host steps, and preheat and boil allowances are realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry True, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`. Labels ['dairy_free'], all unconditional. HH001 False: Not HH001: chicken is poultry.

**Allergens:** ['poultry', 'wheat', 'egg', 'soy']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Poultry from the chicken.', 'Wheat from the flour and soy sauce.', 'Egg from the coating, the tartar eggs, and the mayonnaise.', 'Soy from the soy sauce.', 'No milk, sesame, fish, shellfish, or nuts.', 'The mayonnaise label lists oil, egg, vinegar, salt, and sugar; the relish label lists cucumbers, sugar, vinegar, salt, and spices.']

## H: PASS

Vocabulary tags ['chicken', 'crispy', 'tangy', 'creamy', 'japanese'] are supported by the method and ingredients.

## I: PASS

Package review: Compared with crispy-skillet-chicken-sandwiches: egg-dredged thighs soaked in sweet vinegar and topped with tartar over rice, not a breaded chicken sandwich. Compared with austrian-pork-schnitzel-potato-salad: chicken with a vinegar dip and egg tartar, not breadcrumbed pork with potato salad. Compared with pork-shogayaki: fried chicken with tartar, Auditor check: no slug collision; compared by title-token similarity (max 0.36 overall), shared dish names and primary protein/format against all 200 live meals (notes/existing-200.tsv, harbor-eats-app main 077bd14) and the other 49. Not a duplicate.

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. v1: sliced egg-battered fried chicken with chunky tartar, shredded cabbage, rice.

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
