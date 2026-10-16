# Audit: Salvadoran Bean-and-Cheese Pupusas with Curtido and Salsa Roja

| | |
|---|---|
| Slug | `salvadoran-bean-cheese-pupusas` |
| Recipe version | `rv_salvadoran-bean-cheese-pupusas_v1` |
| Package revision | `author-r2` |
| Hero | `img_v3.jpg` → `salvadoran-bean-cheese-pupusas.webp` (regeneration_count 2) |
| D-03 | involved / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **FAIL** (gate B, K) |

Independent auditor, Wave-17 r1, 2026-10-15 CT. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7, floors none), ingredient_complexity `simple` (score 0, 11 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: FAIL

Filling made and filling used do not reconcile. The bean-and-cheese mix is about 3 cups (~680 g): 16 oz vegetarian refried beans plus 8 oz shredded mozzarella. Eight pupusas at 3 tbsp each use about 1.5 cups (~400 g), so 40-50% of the filling is unused. The recipe also doesn't say what kind of refried beans to buy, yet the hero shows black beans.

**Fix:** Either (a) cut the filling to about 1 cup refried beans and 4 oz mozzarella (about 1 3/4 cups mix, 3 tbsp each); or (b) keep the filling and make 16 pupusas with 4 cups masa harina and about 3 1/2 cups water, cooked in 4 batches, then update the yield, clock and scaling. Either way, name the bean on the ingredient line ('vegetarian refried black beans, label lists black beans, water, salt, oil' or pinto, whichever the regenerated hero shows). Re-hash afterwards.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 37 + cook 33 = 70 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The curtido stands while everything else is made (step 1, about 45 minutes, stated). I rebuilt it from the steps (clock_phase/clock_minutes): the sums match 37+33=70, overlaps fit inside their host steps, and preheat and boil allowances are realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`. Labels ['vegetarian'], all unconditional. HH001 False: Not HH001: mozzarella is dairy.

**Allergens:** ['milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Milk from the mozzarella.', 'Masa harina: the label lists corn treated with lime, so no wheat.', 'No egg, soy, wheat, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['tangy', 'savory', 'crunchy'] are supported by the method and ingredients.

## I: PASS

Package review: Compared with venezuelan-black-bean-plantain-arepas: thin stuffed masa harina rounds with curtido, not split cornmeal arepas filled after cooking. Compared with black-bean-quesadillas: the beans and cheese are sealed inside a thick masa dough, not folded in a tortilla. Compared with chipotle-lime-black-bean-bowls: beans sealed in griddled masa with Auditor check: no slug collision; compared by title-token similarity (max 0.36 overall), shared dish names and primary protein/format against all 200 live meals (notes/existing-200.tsv, harbor-eats-app main 077bd14) and the other 49. Not a duplicate.

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: FAIL

Viewed at full size and cropped (v3). The pupusas, salsa roja and stretching mozzarella are right, but two things still misrepresent this vegetarian meal. (1) The filling is a dark, chunky, glistening brown-black mass with visible lumps. It doesn't read as a smooth refried-bean purée, and at card size it reads like chicharrón or shredded meat (pupusa revuelta). Self-review rejected v1 and v2 for this same problem. (2) The curtido looks like creamy coleslaw: opaque white cabbage that seems dressed, with no translucent vinegar-pickled look and no oregano flecks. The recipe's curtido is a vinegar-water brine.

**Fix:** Regenerate. Target: a cut pupusa with a smooth, matte, spreadable bean purée (refried black or pinto beans, matching the recipe line from the B fix) marbled with melted white cheese, and no chunks or meat-like strands. Curtido should be translucent, glossy and vinegar-pickled, with cabbage, carrot, onion, jalapeño rings and oregano flecks, and must not look creamy. Keep the salsa roja and the griddle spotting. Re-freeze and re-audit K/L.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v3.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (mean abs diff 1.4-2.3), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 2; superseded drafts are recorded as never_finalized and are not the active hero.

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

- Eligibility (vegetarian; microbial-rennet mozzarella contract) and allergens (milk) are clean. D-03 involved/simple is plausible (hand-forming masa).
