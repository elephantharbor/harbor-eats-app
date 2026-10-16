# Audit: Amritsari Fish with Cilantro-Mint Chutney, Kachumber, and Basmati Rice

| | |
|---|---|
| Slug | `amritsari-fish-mint-chutney` |
| Recipe version | `rv_amritsari-fish-mint-chutney_v1` |
| Package revision | `author-r2` |
| Hero | `img_v2.jpg` → `amritsari-fish-mint-chutney.webp` (regeneration_count 1) |
| D-03 | involved / standard |
| HH001 | True |
| Freeze integrity | auditor re-run on a copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r1, 2026-10-15 CT. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7, floors ['attention_2_floor_moderate (already met)']), ingredient_complexity `standard` (score 3, 16 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

21 ingredients and 6 steps. Every ingredient is used, split quantities are stated, and the equipment fits the quantities (checked by arithmetic).

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 34 + cook 20 = 54 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks and rests through the marinating, chutney, and frying (step 3 runs inside steps 2, 4, and 5, overlap stated). I rebuilt it from the steps (clock_phase/clock_minutes): the sums match 34+20=54, overlaps fit inside their host steps, and preheat and boil allowances are realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`. Labels ['dairy_free', 'fish'], all unconditional. HH001 True: Finfish is allowed. No dairy, meat, poultry, shellfish, egg, or nuts.

**Allergens:** ['finfish']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Finfish from the haddock.', 'Chickpea and rice flours, no wheat.', 'No milk, egg, soy, wheat, sesame, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['crispy', 'spicy', 'fresh', 'indian'] are supported by the method and ingredients.

## I: PASS

Package review: Compared with deep-fried-cod-roasted-potatoes: a spiced chickpea-flour batter shallow-fried, with chutney and rice, not a wheat beer batter with potatoes. Compared with thai-crispy-barramundi-tamarind: Punjabi spices and a mint chutney, not a tamarind sauce. Compared with bengali-mustard-fish: crisp-fried pieces, not fish simmered in mustard sauce. Auditor check: no slug collision; compared by title-token similarity (max 0.36 overall), shared dish names and primary protein/format against all 200 live meals (notes/existing-200.tsv, harbor-eats-app main 077bd14) and the other 49. Not a duplicate.

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. v2: six craggy fried fish pieces with white flaky interiors, cilantro-mint chutney, kachumber (cucumber, tomato, red onion) and basmati. No lemon slice, which was v1's defect. Note: the crust reads slightly crumb-like and more golden than the expected orange-red besan/Kashmiri tint.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v2.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (mean abs diff 1.4-2.3), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 1; superseded drafts are recorded as never_finalized and are not the active hero.

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

- B: 1 1/3 cups oil gives about 1/4 inch over a 12-inch skillet's ~10-in base, which matches the stated depth.
- K/L2: the crust reads slightly breadcrumb-like and more golden than the orange-red that 2 tsp Kashmiri chili and turmeric in besan usually give. Identity still reads. Optional in a later image pass.
