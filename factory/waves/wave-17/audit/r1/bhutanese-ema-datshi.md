# Audit: Bhutanese Ema Datshi: Green Chiles in Farmer's Cheese Sauce with Red Rice

| | |
|---|---|
| Slug | `bhutanese-ema-datshi` |
| Recipe version | `rv_bhutanese-ema-datshi_v1` |
| Package revision | `author-r2` |
| Hero | `img_v2.jpg` → `bhutanese-ema-datshi.webp` (regeneration_count 1) |
| D-03 | moderate / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **FAIL** (gate K) |

Independent auditor, Wave-17 r1, 2026-10-15 CT. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 3, floors none), ingredient_complexity `simple` (score 1, 9 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

12 ingredients and 4 steps. Every ingredient is used, split quantities are stated, and the equipment fits the quantities (checked by arithmetic).

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 14 + cook 36 = 50 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The ema datshi simmers while the rice cooks and rests (step 3 runs inside step 2, overlap stated). I rebuilt it from the steps (clock_phase/clock_minutes): the sums match 14+36=50, overlaps fit inside their host steps, and preheat and boil allowances are realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`. Labels ['vegetarian'], all unconditional. HH001 False: Not HH001: farmer's cheese, feta, and butter are dairy.

**Allergens:** ['milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ["Milk from the farmer's cheese, feta, and butter.", 'No egg, soy, wheat, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['spicy', 'creamy', 'rich'] are supported by the method and ingredients.

## I: PASS

Package review: Compared with chiles-rellenos-ranchero: chile strips melted into a cheese sauce over rice, not whole stuffed battered chiles. Compared with saag-paneer: green chiles in a loose melted farmer's cheese sauce, not spinach with cubes of paneer. Compared with mexican-rajas-con-crema-tacos: no crema and no tortillas; the cheese is the sauce and the rice  Auditor check: no slug collision; compared by title-token similarity (max 0.36 overall), shared dish names and primary protein/format against all 200 live meals (notes/existing-200.tsv, harbor-eats-app main 077bd14) and the other 49. Not a duplicate.

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: FAIL

Viewed at full size and cropped (v2). The chiles are whole Anaheim/jalapeño halves, 4-5 inches long, several still with stems, seeds visible, lying on a curdled cheese sauce with tomato and red rice. The recipe stems the Anaheims, halves them, and cuts them and the jalapeños into 1/2-inch strips. So the hero shows parts the recipe removes (stems) and a cut it never makes (uncut halves, about 2-3x the strip width). The self-review correction chose this look to fix v1, where the strips read as green beans, so the image now departs from the method on purpose. Identity (ema datshi) still reads, but plating and technique don't match the recipe.

**Fix:** Either (a) change the recipe to match the hero: 'halve the Anaheims and jalapeños lengthwise, leaving the stems on' (traditional long-split chiles), update the description ('Strips of' → 'Halved'), step 1, the simmer time if needed, and the brief, then re-hash; or (b) regenerate with stemless 1/2-inch strips that clearly read as chiles: glossy blistered skins, mixed pale-green Anaheim and darker jalapeño, a few seeds and ribs, half-sunk in the cheese sauce, so no green-bean look. Re-freeze and re-audit.

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

- Text, timing, eligibility (vegetarian, microbial-rennet feta and acid-set farmer's cheese contracts) and allergens are clean. Only K fails.
