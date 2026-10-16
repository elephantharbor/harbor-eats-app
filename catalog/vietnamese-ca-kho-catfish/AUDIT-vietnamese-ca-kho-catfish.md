# Audit: Vietnamese Ca Kho: Caramel-Braised Catfish with Black Pepper and Jasmine Rice

| | |
|---|---|
| Slug | `vietnamese-ca-kho-catfish` |
| Recipe version | `rv_vietnamese-ca-kho-catfish_v1` |
| Package revision | `author-r3` |
| Hero | `img_v3.jpg` → `vietnamese-ca-kho-catfish.webp` (regeneration_count 2) |
| D-03 | moderate / simple |
| HH001 | True |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r2 (re-audit of author-r3), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4, floors none), ingredient_complexity `simple` (score 1, 10 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

Recipe text unchanged since r1 (culinary_hash 247f574f… unchanged): 14 pieces (~70 sq in) in one layer in the 12-inch skillet; every ingredient used.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 10 + cook 31 = 41 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The fish braises while the rice cooks and rests (step 3 runs inside step 2, overlap stated). Unchanged: 10 + 31 = 41; braise overlap 26 inside the 29-minute rice step.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`. Labels ['dairy_free', 'fish'], all unconditional. HH001 True: Finfish is allowed. No dairy, meat, poultry, shellfish, or nuts.

**Allergens:** ['finfish']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Finfish from the catfish and the anchovy fish sauce.', 'No milk, egg, soy, wheat, sesame, shellfish, or nuts.', 'Coconut water has no FlavorWeave allergen token; disclosed here and in runtime_enum_gaps.']

## H: PASS

Vocabulary tags ['savory', 'umami', 'spicy'] are supported by the method and ingredients.

## I: PASS

Title and slug are unchanged since r1 (dish identity unchanged), so the r1 duplicate check (PASS against the other 49 and all 200 live meals) stands; I did not re-run it. Package review: Compared with cajun-blackened-catfish: braised in a dark caramel and fish sauce, not spice-crusted and seared. Compared with burmese-mohinga-fish-noodle-soup: a sticky glazed braise with rice, not a lemongrass noodle soup. Compared with korean-braise

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. v3 viewed at full size and cropped. About 13-14 rectangular pieces of roughly 2 x 2 1/2 inches, with no skin ring. The cut sides show white, layered, flaking fish flesh. Each top is a dark, pepper-speckled, glossy caramel lacquer: on close crop it is a continuous glaze over flesh texture, with no skin grain, scales or grey skin edge, so it can't be mistaken for skin. Sliced Thai chiles, scallion lengths, pooled caramel, jasmine rice and cucumber slices match the recipe. The r1 defect is fixed.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v3.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (r2 re-check: mean abs diff 1.6-1.9, card 2.2-2.6), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 2; superseded versions are recorded (self-review rejects as never_finalized; the audit-r1 reject with rejected_by, its moved files and sha256), and none is the active hero.

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

- Handoff point 2 (glaze vs skin): judged as glaze. L2: glossy, abundant, strong card-scale contrast with the rice and cucumber.
