# Audit: Uruguayan Chivito Steak Sandwiches with Ham, Bacon, Mozzarella, and Egg

| | |
|---|---|
| Slug | `uruguayan-chivito-sandwiches` |
| Recipe version | `rv_uruguayan-chivito-sandwiches_v1` |
| Package revision | `author-r4` |
| Hero | `img_v6.jpg` → `uruguayan-chivito-sandwiches.webp` (regeneration_count 5) |
| D-03 | moderate / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r3 (re-audit of author-r4), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5, floors ['attention_2_floor_moderate (already met)']), ingredient_complexity `simple` (score 0, 10 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

Recipe text is unchanged since r1/r2 (culinary_hash c76caf515334… unchanged, recomputed): 4 thin steaks, 2 per batch; bacon in 2 batches; every ingredient used.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 10 + cook 34 = 44 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0.  Unchanged: 10 + 34 = 44, step clocks recompute; 145 F in about 3.5 minutes for a 1/4-inch steak.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`. Labels [], all unconditional. HH001 False: Not HH001: beef, ham, and bacon are meat; mozzarella is dairy.

**Allergens:** ['meat', 'milk', 'egg', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Meat from the beef, ham, and bacon.', 'Milk from the mozzarella.', 'Egg from the eggs and mayonnaise.', 'Wheat from the rolls.', 'No soy, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['sandwiches', 'rich', 'savory', 'crispy'] are supported by the method and ingredients.

## I: PASS

Title and slug are unchanged since r1 (dish identity unchanged), so the r1 duplicate check (PASS against the other 49 and all 200 live meals) stands; I did not re-run it. Package review: Compared with philly-cheesesteaks: whole thin steaks stacked with ham, bacon, egg, and mozzarella, not chopped steak with onions and provolone. Compared with cuban-sandwiches: a hot steak and egg stack on a soft roll, not pressed roast pork with pick

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. v6 viewed at full size and in a 2x crop. The r2 defect is fixed: the steak's cut face shows clear whole-muscle grain (fibre striations) with a seared outer edge. It reads as a sliced, pounded steak, not a ground patty. Doneness is grey-tan throughout with no pink, consistent with 145 F. Thickness is about 3/8-1/2 inch at the image's scale. That is a little more than the raw 1/4 inch, but plausible for a pounded steak that contracts and plumps when seared, and well under the 1/2-3/4-inch rosy steak failed in r1. Every layer is present and in the recipe: ham, melted mozzarella, crisp bacon, a pan-fried egg with a soft yolk, mayo, lettuce and tomato. Sliced green olives are inside the sandwich. A few loose olive slices sit on the board (a recipe item, styling only).

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v6.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (r3 re-check: mean abs diff 1.68/1.75, card 2.33/2.36), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 5; superseded versions are recorded (self-review rejects as never_finalized; the audit-r1 reject with rejected_by, its moved files and sha256), and none is the active hero.

## L2: PASS

Appetizing, well lit, abundant, and reads at card size; on par with the house reference range.

## L: PASS

L1 and L2 both PASS.

## M: PASS

Text provenance original_ai_assisted; image ai_illustration via Grok Bot GenerateImage, with the 1280x720 source disclosed; no stock or web photo; no metadata denies an asset that is present.

## N: PASS

Shopping list derivable; units and package sizes are shoppable.

## O: PASS

package_revision `author-r4` is consistent across top level, recipe_version, image, sidecar and docs; version 1; classification_history present; certification null, kitchen_tested false. revision_history records the author-r2 → author-r3 and author-r3 → author-r4 entries (trigger, scope, before/after culinary_hash, changes), and it matches my field-level diff against my r2 copy (r4 changed only the image block and revision labels; the recipe is unchanged). My own run of FREEZE_INTEGRITY on a scratch copy: PASS (26/26). culinary_hash recomputes. The superseded/rejected records for audit-rejected heroes are complete, and the files rejected in r2 are byte-identical to the heroes I audited in r2.

## Notes (non-blocking)

- K note: the steak may read slightly thicker than 1/4 inch (about 3/8-1/2 inch at image scale). It's within tolerance for a seared pounded steak, so not blocking.
- K note: the loose olive slices on the board are a recipe item used as styling (r1 precedent: an in-recipe item placed elsewhere is a note).
- Runny yolk: fine. The recipe offers soft or firm yolks, and the food-safety note covers firm yolks.
- L2: abundant, high-contrast layers; strong at card size.
