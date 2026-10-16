# Audit: Yucatecan Tikin Xic: Achiote-Citrus Baked Fish with Pickled Red Onions

| | |
|---|---|
| Slug | `yucatecan-tikin-xic-fish` |
| Recipe version | `rv_yucatecan-tikin-xic-fish_v1` |
| Package revision | `author-r3` |
| Hero | `img_v1.jpg` → `yucatecan-tikin-xic-fish.webp` (regeneration_count 0) |
| D-03 | moderate / standard |
| HH001 | True |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r2 (re-audit of author-r3), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 3, floors none), ingredient_complexity `standard` (score 2, 13 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

Recipe text unchanged since r1 (culinary_hash 822a10ee… unchanged).

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 27 + cook 20 = 47 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks while the oven heats and the fish bakes (step 3 runs inside steps 2 and 4, overlap stated). Unchanged: 27 + 20 = 47, oven preheat on the clock.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`. Labels ['dairy_free', 'fish'], all unconditional. HH001 True: Finfish is allowed. No dairy, meat, poultry, shellfish, or nuts.

**Allergens:** ['finfish']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Finfish from the cod.', 'No milk, egg, soy, wheat, sesame, shellfish, or nuts.', 'Achiote paste: the label lists no wheat (corn starch only).']

## H: PASS

vocabulary_tag_ids are now [cod, citrusy, tangy, mexican]. 'smoky' was removed; nothing was added. Every tag is supported (citrus marinade, habanero-pickled onions, cod). The r1 defect is fixed. The culinary_hash is correctly unchanged (vocabulary isn't in the basis).

## I: PASS

Title and slug are unchanged since r1 (dish identity unchanged), so the r1 duplicate check (PASS against the other 49 and all 200 live meals) stands; I did not re-run it. Package review: Compared with red-snapper-veracruzana: an achiote-orange marinade baked in foil with pickled onions, not a tomato-olive-caper sauce. Compared with ginger-scallion-fish-packets: an earthy red achiote-citrus packet, not ginger-scallion-soy. Compared wi

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. Hero unchanged (img_v1): achiote-red cod with tomato and pepper, pickled onions, cilantro, rice. Unchanged from the r1 PASS.

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

- Metadata-only revision verified: the culinary_hash and image are unchanged.
