# Audit: Salvadoran Bean-and-Cheese Pupusas with Curtido and Salsa Roja

| | |
|---|---|
| Slug | `salvadoran-bean-cheese-pupusas` |
| Recipe version | `rv_salvadoran-bean-cheese-pupusas_v1` |
| Package revision | `author-r3` |
| Hero | `img_v4.jpg` → `salvadoran-bean-cheese-pupusas.webp` (regeneration_count 3) |
| D-03 | involved / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **FAIL** (gate K) |

Independent auditor, Wave-17 r2 (re-audit of author-r3), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7, floors none), ingredient_complexity `simple` (score 0, 11 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

Re-checked by arithmetic. Filling: 1 cup refried small red beans + 4 oz shredded low-moisture mozzarella (~1 cup loose, packs down) = about 1 1/2 cups, as step 3 states. Use: 8 × 3 tbsp = 24 tbsp = 1 1/2 cups. Reconciled. The bean is now named on the ingredient line, the description and the component. The r1 B defect is fixed.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 37 + cook 33 = 70 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The curtido stands while everything else is made (step 1, about 45 minutes, stated). Prep 37 + cook 33 = 70, unchanged (yield and batches unchanged).

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

Viewed v4 at full size and in a 1.5x crop of the cut pupusa. The r1 curtido defect is fixed: no creamy coating, loose shreds of cabbage, carrot and onion with jalapeño rings. The filling is not fixed. It is a glossy, dark red-brown, visibly lumpy mass with rounded chunks and saucy streaks, about 1/2 inch thick, and it reads like chili con carne or a braised-meat/chicharrón filling more than beans. The recipe now explicitly says 'vegetarian refried small red beans, puréed smooth', so the image also contradicts the stated texture. A vegetarian meal whose hero filling reads as meat is the same K defect as v1-v3 (four images now).

**Fix:** Regenerate (v5). Show the cut face with a thin, smooth, matte, uniform layer of refried red-bean purée (medium brown, like a spread, with no lumps, chunks or sauce sheen), cheese clearly dominant and stretching, and the masa wall visible around it. Keep the v4 curtido, salsa roja and griddle spotting. If the generator keeps producing chunks, change the plating so only a small, clean cut edge shows (cheese pull foreground, thin bean line) rather than an open wedge. Re-finalize, re-freeze, re-audit K/L.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v4.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (r2 re-check: mean abs diff 1.6-1.9, card 2.2-2.6), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 3; superseded versions are recorded (self-review rejects as never_finalized; the audit-r1 reject with rejected_by, its moved files and sha256), and none is the active hero.

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

- B, F and N pass. The refried small red bean contract (small red beans, water, oil, salt, no lard) is plausible for Salvadoran-style canned frijoles. Only about half a 16-oz can is used; the leftover is a shopping note, not a defect.
- Curtido now reads as a plain pickled slaw, not creamy (r1 sub-defect fixed).
