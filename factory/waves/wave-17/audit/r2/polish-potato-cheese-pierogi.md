# Audit: Polish Potato-and-Cheese Pierogi with Golden Onions and Sour Cream

| | |
|---|---|
| Slug | `polish-potato-cheese-pierogi` |
| Recipe version | `rv_polish-potato-cheese-pierogi_v1` |
| Package revision | `author-r3` |
| Hero | `img_v1.jpg` → `polish-potato-cheese-pierogi.webp` (regeneration_count 0) |
| D-03 | involved / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r2 (re-audit of author-r3), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `involved` (sidecar score 8, floors ['technique_2_floor_involved (already met)']), ingredient_complexity `simple` (score 0, 8 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

Re-checked by arithmetic. Filling: 3/4 lb russets mashed (~1 1/2 cups) + 4 oz farmer's cheese (~1/2 cup) + one-third of 1 1/2 onions cooked in butter (~1/4 cup) = ~2 1/4 cups, as step 4 states. Use: 36 × a level tablespoon = 36 tbsp = 2 1/4 cups. Reconciled. Dough: 3 cups flour rolled to 1/8 inch, 3-inch rounds (~7 sq in × 1/8 in ≈ 15 ml each) gives about 36 with one reroll, which is plausible. Topping keeps 1 onion's worth (two-thirds of the batch) in 3 tbsp butter. Salt split notes match (1 + 1 + 1/4 = 2 1/4 tsp). The r1 defect is fixed.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 52 + cook 38 = 90 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The dough rests while the potatoes and onions cook (steps 2-4, overlap stated); the pierogi water heats while you fill (step 6 runs inside step 5, overlap stated). Prep 52 + cook 38 = 90, unchanged. 3/4 lb potatoes cook in the same 6 cups of water. The step 3 onion overlap is unchanged. Rolling 1/8 inch is faster than 1/16 inch, so the clock is conservative.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`. Labels ['vegetarian'], all unconditional. HH001 False: Not HH001: farmer's cheese, butter, and sour cream are dairy.

**Allergens:** ['wheat', 'egg', 'milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Wheat from the flour.', 'Egg from the dough.', "Milk from the farmer's cheese, butter, and sour cream.", 'No soy, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['rich', 'savory', 'tender'] are supported by the method and ingredients.

## I: PASS

Title and slug are unchanged since r1 (dish identity unchanged), so the r1 duplicate check (PASS against the other 49 and all 200 live meals) stands; I did not re-run it. Package review: Compared with pan-fried-pork-dumplings: boiled soft dough with a potato-cheese filling and onions, not pan-seared pork wrappers. Compared with kasespatzle-caramelized-onions: filled dumplings, not cheese-tossed spaetzle (shared onion topping only). C

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. Hero unchanged (img_v1): boiled pierogi with browned-onion topping, chives, sour cream. Matches the revised recipe (topping onions kept at 1 onion).

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

- E: the clock is unchanged although the filling is smaller and rolling is thicker. Conservative, not a defect.
