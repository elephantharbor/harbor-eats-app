# Audit: Paneer Tikka with Peppers and Onions, Mint Chutney, and Naan

| | |
|---|---|
| Slug | `indian-paneer-tikka` |
| Recipe version | `rv_indian-paneer-tikka_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `indian-paneer-tikka.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `standard` (sidecar score 2, 16 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

18 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 15 + cook 51 = 66 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The paneer marinates 30 minutes while the chutney and salad are made (step 3 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`; HH001 False (Contains paneer, yogurt, and naan with milk (dairy).). Labels ['vegetarian'].

**Allergens:** ['milk', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Milk from the paneer, yogurt, and naan.', 'Wheat from the naan.', 'The paneer is a store-bought hard contract: the label lists milk and an acid (vinegar, lemon, or citric acid), and no rennet is used.', 'The yogurt label lists milk and cultures only, with no gelatin.', 'The naan is a store-bought hard contract: the label lists wheat flour, milk or yogurt, oil, and leavening, with no egg, soy, or sesame.', 'No egg, soy, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['smoky', 'spicy', 'creamy', 'fresh', 'indian'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with saag-paneer: broiled marinated cubes on skewers, not paneer in a spinach puree. Compared with pakistani-chicken-karahi in this wave: vegetarian broiled skewers with chutney, not a chicken curry. Compared with roasted-cauliflower-shawarma-plate: paneer tikka with mint chutney and naan, not roasted cauliflower with tahini. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

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

- K: a small dish of chaat-masala-like spice at the edge is not in the recipe; spice prop, non-blocking. G: paneer is acid-set (no rennet issue).
