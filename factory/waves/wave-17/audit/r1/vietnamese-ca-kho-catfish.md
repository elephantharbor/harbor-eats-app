# Audit: Vietnamese Ca Kho: Caramel-Braised Catfish with Black Pepper and Jasmine Rice

| | |
|---|---|
| Slug | `vietnamese-ca-kho-catfish` |
| Recipe version | `rv_vietnamese-ca-kho-catfish_v1` |
| Package revision | `author-r2` |
| Hero | `img_v2.jpg` → `vietnamese-ca-kho-catfish.webp` (regeneration_count 1) |
| D-03 | moderate / simple |
| HH001 | True |
| Freeze integrity | auditor re-run on a copy: PASS (26/26) |
| Structural preflight | auditor re-run: PASS |
| Verdict | **FAIL** (gate K) |

Independent auditor, Wave-17 r1, 2026-10-15 CT. Package not edited; nothing imported; D1 and the app repo were read-only; no PR, deploy or cloud agent. Hero viewed at full size.

## A: PASS

Slug, dish_id and recipe ids are consistent; version 1, immutable, draft, recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4, floors none), ingredient_complexity `simple` (score 1, 10 counted ingredients; salt, water and oils excluded per EXCLUDE_NAMES). The sums, floors and bands (≤12/13-16/17+) recompute, and the enums match v1. My own run of structural preflight: PASS.

## B: PASS

13 ingredients and 4 steps. Every ingredient is used, split quantities are stated, and the equipment fits the quantities (checked by arithmetic).

## C: PASS

Base 4 servings; scaling lines for 1, 2 and 4 present, with do-not-scale items where relevant.

## D: PASS

Heat levels and doneness cues are stated; every component is completed; there is a serve step.

## E: PASS

Prep 10 + cook 31 = 41 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The fish braises while the rice cooks and rests (step 3 runs inside step 2, overlap stated). I rebuilt it from the steps (clock_phase/clock_minutes): the sums match 10+31=41, overlaps fit inside their host steps, and preheat and boil allowances are realistic.

## F: PASS

Store-bought components carry hard label contracts where eligibility or allergens depend on them.

## G: PASS

**Eligibility:** meat False, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`. Labels ['dairy_free', 'fish'], all unconditional. HH001 True: Finfish is allowed. No dairy, meat, poultry, shellfish, or nuts.

**Allergens:** ['finfish']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid; nothing appears only in the notes. Notes: ['Finfish from the catfish and the anchovy fish sauce.', 'No milk, egg, soy, wheat, sesame, shellfish, or nuts.', 'Coconut water has no FlavorWeave allergen token; disclosed here and in runtime_enum_gaps.']

## H: PASS

Vocabulary tags ['savory', 'umami', 'spicy'] are supported by the method and ingredients.

## I: PASS

Package review: Compared with cajun-blackened-catfish: braised in a dark caramel and fish sauce, not spice-crusted and seared. Compared with burmese-mohinga-fish-noodle-soup: a sticky glazed braise with rice, not a lemongrass noodle soup. Compared with korean-braised-mackerel-radish: a sugar caramel and black pepper glaze with no radish or gochugaru. Auditor check: no slug collision; compared by title-token similarity (max 0.36 overall), shared dish names and primary protein/format against all 200 live meals (notes/existing-200.tsv, harbor-eats-app main 077bd14) and the other 49. Not a duplicate.

## J: PASS

Title, description, methods and the cooking object agree with the steps. D-03 classification is plausible for the method and sourcing (not cuisine-driven; sidecar cultural_bias reviewed).

## K: FAIL

Viewed at full size and cropped (v2). The plate shows about seven large, thick, oval cross-cut fish steaks, each with a dark skin ring around the edge, in a glossy caramel glaze with rice and cucumber. The recipe buys US farm-raised catfish fillets (sold skinless) and cuts them into about 14 pieces of 2 x 2 1/2 inches. The hero shows a different cut and product (skin-on steaks), at about half the piece count and twice the piece size. A cook following the recipe can't produce this plate. The accepted self-review correction moved the image away from the recipe to fix v1's 'chicken cutlet' look. The handoff flagged it; I confirm it as a fidelity FAIL (wrong cut, visible skin the recipe doesn't have).

**Fix:** Preferred: regenerate with 12-14 skinless, roughly rectangular catfish fillet pieces (2 x 2 1/2 in), lacquered deep amber with black pepper, with pale flaky flesh at the broken edges and no skin ring. Use cracked pepper, sliced chiles and scallion lengths to keep it from reading as chicken. Alternative: rewrite the recipe for skin-on catfish steaks (1-inch crosswise cuts, sold at Asian markets) with a new piece count, braise time, pan fit, shopping line and HH001 contract, then re-hash. Either way, re-freeze and re-audit.

## L1: PASS

Master WEBP 1200x900 RGB; card 640x480; source img_v2.jpg 1280x720. SHA-256 match file_hashes/asset_sha256 and image-gen-map. Master re-derived as a LANCZOS 1.25x upscale of the centre 960x720 source crop (mean abs diff 1.4-2.3), disclosed in generation.method_detail; same pipeline as Waves 14-16, no objectionable softness at master or card size. No text, logos, hands or artifacts. regeneration_count 1; superseded drafts are recorded as never_finalized and are not the active hero.

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

- Text is clean: 14 pieces (~70 sq in) fit the 12-inch skillet; caramel safety copy present; fish sauce and coconut water contracts are HH001-safe; coconut disclosed (no importer token). Only the image fails.
- I: closest live meals are cajun-blackened-catfish and vietnamese-turmeric-dill-fish. Distinct.
