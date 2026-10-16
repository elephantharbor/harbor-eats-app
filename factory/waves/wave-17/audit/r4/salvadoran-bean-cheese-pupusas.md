# Audit: Salvadoran Bean-and-Cheese Pupusas with Curtido and Salsa Roja

| | |
|---|---|
| Slug | `salvadoran-bean-cheese-pupusas` |
| Recipe version | `rv_salvadoran-bean-cheese-pupusas_v1` |
| Package revision | `author-r5` |
| Hero | `img_v6.jpg` → `salvadoran-bean-cheese-pupusas.webp` (regeneration_count 5) |
| D-03 | involved / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r4 (re-audit of author-r5), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7, floors none), ingredient_complexity `simple` (score 0, 11 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

Recipe text unchanged since r2 (culinary_hash ff2b632367fb… recomputes, unchanged): 1 1/2 cups filling = 8 × 3 tbsp; every ingredient used; bean named on the ingredient line.

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

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. v6 viewed at full size and in a 2x crop of the source. It uses the r3 fallback composition: one whole griddled pupusa, plus one torn open, with curtido (cabbage, carrot, jalapeño rings; not creamy) and salsa roja. The filling is now what step 3 makes: a soft, reddish-brown refried-bean paste marbled throughout with stretched melted mozzarella. It isn't a separate layer, isn't near-black, and isn't crumbly or granular. In the crop it reads clearly as beans and cheese; nothing in it reads as ground meat or chicharrón. A few soft bean-sized lumps are consistent with refried beans and don't change the reading. The r1-r3 defect is fixed. Thickness: both rounds look domed, about 3/4 inch or a little more at image scale (the torn one more), against the recipe's 'about 1/2 inch' raw. Masa pupusas puff somewhat on the griddle, and the 4-inch diameter is right, so this is within tolerance (non-blocking; see notes). No invented items.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v6.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (r4 re-check: mean abs diff 1.80, card 2.50), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 5; superseded versions are recorded (self-review rejects as never_finalized; the audit-r1 reject with rejected_by, its moved files and sha256), and none is the active hero.

## L2: PASS

Appetizing, well lit, abundant, and reads at card size; on par with the house reference range.

## L: PASS

L1 and L2 both PASS.

## M: PASS

Text provenance original_ai_assisted; image ai_illustration via Grok Bot GenerateImage, with the 1280x720 source disclosed; no stock or web photo; no metadata denies an asset that is present.

## N: PASS

Shopping list derivable; units and package sizes are shoppable.

## O: PASS

package_revision `author-r5` is consistent across top level, recipe_version, image, sidecar and docs; version 1; classification_history present; certification null, kitchen_tested false. revision_history records the r2→r3, r3→r4 and r4→r5 entries (trigger, scope, before/after culinary_hash, changes), and it matches my field-level diff against my r3 copy (r5 changed only the image block and revision labels; the recipe is unchanged). My own run of FREEZE_INTEGRITY on a scratch copy: PASS (26/26). culinary_hash recomputes. The superseded/rejected records for audit-rejected heroes are complete, and the files rejected in r3 (v5) are byte-identical to the hero I audited in r3.

## Notes (non-blocking)

- K note: the pupusas look puffier than 1/2 inch (about 3/4 inch, domed). Within tolerance for griddled filled masa, and the identity still reads as pupusas with the curtido and salsa context. A flatter render is optional in any future image pass.
- K note: small soft lumps in the bean paste are normal for refried beans; I checked in the crop that it doesn't read as meat.
- B/curtido fixes from r1-r2 remain in place. L2: warm, appetizing, clear cheese pull, strong at card size.
