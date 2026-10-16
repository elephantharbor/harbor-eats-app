# Audit: Salvadoran Bean-and-Cheese Pupusas with Curtido and Salsa Roja

| | |
|---|---|
| Slug | `salvadoran-bean-cheese-pupusas` |
| Recipe version | `rv_salvadoran-bean-cheese-pupusas_v1` |
| Package revision | `author-r4` |
| Hero | `img_v5.jpg` → `salvadoran-bean-cheese-pupusas.webp` (regeneration_count 4) |
| D-03 | involved / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **FAIL** (gate K) |

Independent auditor, Wave-17 r3 (re-audit of author-r4), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7, floors none), ingredient_complexity `simple` (score 0, 11 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

Recipe text is unchanged since r2 (culinary_hash ff2b632367fb… unchanged, recomputed). The r2 arithmetic stands: about 1 1/2 cups filling = 8 × 3 tbsp; every ingredient is used.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 37 + cook 33 = 70 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The curtido stands while everything else is made (step 1, about 45 minutes, stated). Unchanged: 37 + 33 = 70, step clocks recompute.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`. Labels ['vegetarian'], all unconditional. HH001 False: Not HH001: mozzarella is dairy.

**Allergens:** ['milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Milk from the mozzarella.', 'Masa harina: the label lists corn treated with lime, so no wheat.', 'No egg, soy, wheat, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['tangy', 'savory', 'crunchy'] are supported by the method and ingredients.

## I: PASS

Title and slug are unchanged since r1 (dish identity unchanged), so the r1 duplicate check (PASS against the other 49 and all 200 live meals) stands; I did not re-run it. Package review: Compared with venezuelan-black-bean-plantain-arepas: thin stuffed masa harina rounds with curtido, not split cornmeal arepas filled after cooking. Compared with black-bean-quesadillas: the beans and cheese are sealed inside a thick masa dough, not fo

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: FAIL

Viewed v5 at full size and in a 2x crop of the cut face. v5 fixes the r2 sheen: the filling is matte, and the curtido and salsa are good. But the bean layer is now a thick (~1/2-inch), uniform, very dark grey-brown slab with a fine, crumbly, granular texture. In the crop it looks like cooked ground beef or a burger patty inside the masa: the 'reads as ground meat' defect self-review rejected v1 and v2 for, and the meat-reading defect from r1 and r2. It also contradicts the recipe in two ways. (1) The ingredient is 'refried small red beans, puréed smooth', which would be a smooth, reddish-brown paste, not crumbly near-black grains. (2) Step 3 mixes the beans and mozzarella into one filling, but the hero shows a separate dark layer with a separate white cheese pull. For a vegetarian meal, a hero filling that reads as ground meat is a fidelity FAIL.

**Fix:** Regenerate (v6) and show the filling the recipe makes. Beans and cheese are mixed into one marbled filling: a lighter, reddish-brown, smooth bean paste with melted white mozzarella streaked all through it. It should not be a separate dark layer, and it must have no crumbly or granular texture and no near-black colour. Keep it fairly thin (about 1/4 inch), and keep the masa wall, cheese pull, curtido, salsa and griddle spotting from v5. If the generator still produces a meat-like slab, change the plating so the hero shows two whole spotted pupusas, plus one torn open just enough to show a creamy cheese-and-bean edge. Re-finalize, re-freeze, re-audit K/L.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v5.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (r3 re-check: mean abs diff 1.68/1.75, card 2.33/2.36), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 4; superseded versions are recorded (self-review rejects as never_finalized; the audit-r1 reject with rejected_by, its moved files and sha256), and none is the active hero.

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

- B (filling quantity, r1) and the curtido (r1/r2) remain fixed. Only the bean-filling look fails.
- Pattern note: five generations have struggled with this filling. The fix asks for the recipe's actual mixed bean-cheese filling, which is both more faithful and less likely to read as meat.
