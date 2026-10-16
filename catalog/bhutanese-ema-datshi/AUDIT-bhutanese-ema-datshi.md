# Audit: Bhutanese Ema Datshi: Green Chiles in Farmer's Cheese Sauce with Red Rice

| | |
|---|---|
| Slug | `bhutanese-ema-datshi` |
| Recipe version | `rv_bhutanese-ema-datshi_v1` |
| Package revision | `author-r3` |
| Hero | `img_v2.jpg` → `bhutanese-ema-datshi.webp` (regeneration_count 1) |
| D-03 | moderate / simple |
| HH001 | False |
| Freeze integrity | auditor re-run on a scratch copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **PASS** |

Independent auditor, Wave-17 r2 (re-audit of author-r3), 2026-10-16 CT. Full gates A–O re-run. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 3, floors none), ingredient_complexity `simple` (score 1, 9 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

8 Anaheims and 2 jalapeños, halved with stems on (about 20 halves), simmer covered in 1 1/2 cups water in the 3-quart saucepan, partly stacked and steam-simmered. Plausible for a covered simmer. All 12 ingredients are used; the salt split is unchanged.

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 14 + cook 36 = 50 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The ema datshi simmers while the rice cooks and rests (step 3 runs inside step 2, overlap stated). Step 3 overlap is 12 + 4 + 3 = 19 of cooking, recorded as 21, inside the 34-minute rice step (4 + 20 + 10 rest). Total 14 + 36 = 50, unchanged. A 12-minute covered simmer for halved Anaheims is realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`. Labels ['vegetarian'], all unconditional. HH001 False: Not HH001: farmer's cheese, feta, and butter are dairy.

**Allergens:** ['milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ["Milk from the farmer's cheese, feta, and butter.", 'No egg, soy, wheat, sesame, fish, shellfish, or nuts.']

## H: PASS

Vocabulary tags ['spicy', 'creamy', 'rich'] are supported by the method and ingredients.

## I: PASS

Title and slug are unchanged since r1 (dish identity unchanged), so the r1 duplicate check (PASS against the other 49 and all 200 live meals) stands; I did not re-run it. Package review: Compared with chiles-rellenos-ranchero: chile strips melted into a cheese sauce over rice, not whole stuffed battered chiles. Compared with saag-paneer: green chiles in a loose melted farmer's cheese sauce, not spinach with cubes of paneer. Compared 

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: PASS

Viewed the hero at full size with Read, against image-plating-brief.md and the recipe. Hero unchanged (img_v2): long halved Anaheim/jalapeño chiles with a few stems, in a loose curdy cheese sauce with tomato, beside red rice. The revised recipe (halved lengthwise, stems left on) now matches the hero, which fixes the r1 defect.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v2.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (r2 re-check: mean abs diff 1.6-1.9, card 2.2-2.6), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 1; superseded versions are recorded (self-review rejects as never_finalized; the audit-r1 reject with rejected_by, its moved files and sha256), and none is the active hero.

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

- I: near_duplicate_review still says 'chile strips melted into a cheese sauce' (stale wording, not culinary-hashed); the distinctness conclusion is unaffected. Update it on the next metadata touch.
- Brief: the author-r1 sections of image-plating-brief.md still say strips. The appended v2 correction controls the image, and the recipe now matches it. A documentation note only.
