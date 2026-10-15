# Audit: Peruvian Tacu Tacu with a Pan-Fried Egg and Salsa Criolla

| | |
|---|---|
| Slug | `peruvian-tacu-tacu-egg` |
| Recipe version | `rv_peruvian-tacu-tacu-egg_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v2.jpg` → `peruvian-tacu-tacu-egg.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (K) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 6), ingredient_complexity `simple` (sidecar score 1, 9 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

12 ingredients, 9 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 2 + cook 63 = 65 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. Prep runs while the rice cooks (step 3 states the overlap); the salsa criolla is mixed while the rice cools (step 5 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy False, vegetarian True, plant-based False, nut_policy `none`; HH001 True (Eggs are allowed. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'vegetarian'].

**Allergens:** ['egg']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Egg from the pan-fried eggs.', 'The ají amarillo paste label lists peppers, salt, and acid only.', 'No milk, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['crispy', 'savory', 'tangy', 'spicy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with dominican-mangu-eggs-pickled-onions in this wave: a crisp rice-and-bean cake, not a plantain mash; ají heat. Compared with chipotle-lime-black-bean-bowls: the rice and beans are fused into a pan-fried crust, no bowl assembly, no black beans. Compared with skillet-shakshuka: no tomato sauce. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — FAIL

The v2 hero fixed the oval shape. But (1) the salsa criolla shows yellow pepper strips, while the recipe's salsa is red onion, lime, cilantro and ají amarillo paste only (invented visible ingredient). (2) The bean-rice cake reads near-black, like black beans, while the recipe uses canary/pinto beans.

**Fix:** Regenerate (v3): keep the oval, crisp-crusted tacu tacu with a fried egg; the cake interior and crust are pale tan-brown (canary/pinto beans with rice), not black; the salsa criolla is thin red-onion slivers with lime and cilantro, tinted only lightly yellow by the paste, with no pepper strips.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v2.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands. v1 moved to rejected/ with a superseded record and its hash; regeneration_count 1.

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
