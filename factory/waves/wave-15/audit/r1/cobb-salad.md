# Audit: Classic Cobb Salad with Seared Chicken, Bacon, Egg, and Blue Cheese

| | |
|---|---|
| Slug | `cobb-salad` |
| Recipe version | `rv_cobb-salad_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `cobb-salad.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (J) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

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

## J — FAIL

The description (dish + recipe_version) promises 'jammy-yolked hard-cooked eggs'. The method boils the eggs 10 minutes and ice-bathes them with 'yolks just set', and the hero shows fully set yolks. The consumer promise contradicts the method (Wave-14 gyudon precedent).

**Fix:** Text fix only: change 'jammy-yolked hard-cooked eggs' to 'hard-cooked eggs' in both descriptions and README, then recompute culinary_hash. The image already matches the method, so no regeneration is needed. (Alternative: change the method to 7 to 8 minutes with jammy yolks AND regenerate. Not recommended.)

## K — PASS

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v1.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands.

## L2 — PASS

Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

L1 and L2 both pass (K is judged separately).

## M — PASS

Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r2` consistent across top-level, recipe_version, image, sidecar and docs; version 1; classification_history present; FREEZE_INTEGRITY re-run PASS (26/26).

## Notes (non-blocking)

- G: Dijon mustard noted; no token.
