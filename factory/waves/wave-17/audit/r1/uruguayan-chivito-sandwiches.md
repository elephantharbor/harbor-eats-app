# Audit: Uruguayan Chivito Steak Sandwiches with Ham, Bacon, Mozzarella, and Egg

| | |
|---|---|
| Slug | `uruguayan-chivito-sandwiches` |
| Recipe version | `rv_uruguayan-chivito-sandwiches_v1` |
| Package revision | `author-r2` |
| Hero | `img_v4.jpg` → `uruguayan-chivito-sandwiches.webp` (regeneration_count 3) |
| D-03 | moderate / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **FAIL** (gate K) |

Independent auditor, Wave-17 r1, 2026-10-15 CT. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5, floors ['attention_2_floor_moderate (already met)']), ingredient_complexity `simple` (score 0, 10 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

12 ingredients and 6 steps. Every ingredient is used, split quantities are stated, and the equipment fits the quantities (checked by arithmetic).

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 10 + cook 34 = 44 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0.  I rebuilt it from the steps (clock_phase/clock_minutes): the sums match 10+34=44, overlaps fit inside their host steps, and preheat and boil allowances are realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`. Labels [], all unconditional. HH001 False: Not HH001: beef, ham, and bacon are meat; mozzarella is dairy.

**Allergens:** ['meat', 'milk', 'egg', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Meat from the beef, ham, and bacon.', 'Milk from the mozzarella.', 'Egg from the eggs and mayonnaise.', 'Wheat from the rolls.', 'No soy, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['sandwiches', 'rich', 'savory', 'crispy'] are supported by the method and ingredients.

## I: PASS

Package review: Compared with philly-cheesesteaks: whole thin steaks stacked with ham, bacon, egg, and mozzarella, not chopped steak with onions and provolone. Compared with cuban-sandwiches: a hot steak and egg stack on a soft roll, not pressed roast pork with pickles and Swiss. Compared with classic-smash-burgers: sliced sirloin, not ground beef patties. Auditor check: no slug collision; compared by title-token similarity (max 0.36 overall), shared dish names and primary protein/format against all 200 live meals (notes/existing-200.tsv, harbor-eats-app main 077bd14) and the other 49. Not a duplicate.

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: FAIL

Viewed at full size (v4). The steak in both halves is about 1/2-3/4 inch thick and rosy pink, close to medium-rare, all the way through. The recipe pounds 4 oz sirloin steaks to 1/4 inch and cooks them to 145 F (about 3.5 minutes), which gives a thin, browned steak that is mostly grey-tan with at most a faint blush. Thickness and doneness are both outside what the recipe makes, and the stated 145 F food-safety target makes the doneness mismatch more than cosmetic. Egg, ham, bacon, mozzarella, lettuce, tomato and mayo are right. The olives sit on the board instead of in the sandwich, which on its own is a note.

**Fix:** Regenerate. Target: a thin (1/4-inch) seared steak layer, browned on the outside and cooked through to medium (light tan with at most a faint pink line), still clearly whole sliced steak and not a patty. Keep the soft-yolk fried egg, ham, bacon, melted mozzarella, lettuce, tomato and mayo, and put sliced green olives inside the sandwich. Re-freeze and re-audit K/L.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v4.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (mean abs diff 1.4-2.3), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 3; superseded drafts are recorded as never_finalized and are not the active hero.

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

- Text is clean: 4 x 4-oz sirloin pounded to 1/4 inch, 2 per batch, 145 F in ~3.5 min, soft-yolk option with food-safety note. Only the image fails.
- I: closest live meals are philly-cheesesteaks and cuban-sandwiches. Distinct.
