# Audit r2: Classic Cobb Salad with Seared Chicken, Bacon, Egg, and Blue Cheese

| | |
|---|---|
| Slug | `cobb-salad` |
| Recipe version | `rv_cobb-salad_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v1.jpg` → `cobb-salad.webp` |
| r1 verdict | FAIL (J) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **J:** Both descriptions now say 'hard-cooked eggs'; no 'jammy' remains anywhere in the package. That matches the 10-minute boil with 'yolks just set' and the kept hero (fully set yolks). RESOLVED.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 6), ingredient_complexity `simple` (sidecar score 1, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

15 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 14 + cook 36 = 50 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The eggs cook and cool inside steps 3 and 4 (step 2 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry True, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains chicken (poultry), bacon (meat), and blue cheese (dairy).). Labels [].

**Allergens:** ['poultry', 'meat', 'egg', 'milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Poultry from the chicken.', 'Meat from the bacon.', 'Egg from the hard-cooked eggs.', 'Milk from the blue cheese.', 'The bacon is a store-bought hard contract: the label lists pork, salt, sugar, and curing agents, with no soy, wheat, or milk.', 'Dijon mustard is used; mustard is not a FlavorWeave token. No soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['chicken', 'fresh', 'crunchy', 'rich', 'american'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with salade-nicoise-seared-tuna: chicken, bacon, avocado, and blue cheese, not tuna, green beans, and potatoes. Compared with greek-chicken-souvlaki: a salad plate, not grilled skewers with pita. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

r2 re-check of r1 finding: Both descriptions now say 'hard-cooked eggs'; no 'jammy' remains anywhere in the package. That matches the 10-minute boil with 'yolks just set' and the kept hero (fully set yolks). RESOLVED.

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v1.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands. regeneration_count 0; 0 superseded record(s), and every file in rejected/ is hash-recorded there. The card is a faithful 640x480 downscale of the master, which is a centre 4:3 crop of the source.

## L2 — PASS

Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

L1 and L2 both pass (K is judged separately).

## M — PASS

Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r3` consistent across top-level, recipe_version, image, sidecar, README and brief (no stray author-r2). culinary_hash recomputed by the auditor from the build basis: matches. It changed from r2 as expected. Version 1; classification_history present; FREEZE_INTEGRITY re-run PASS (26/26).

## Notes (non-blocking)

- G: Dijon mustard disclosed in notes; no mustard token in the app.
