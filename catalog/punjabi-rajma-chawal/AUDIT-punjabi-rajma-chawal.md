# Audit: Punjabi Rajma Chawal: Kidney Bean Curry with Basmati Rice

| | |
|---|---|
| Slug | `punjabi-rajma-chawal` |
| Recipe version | `rv_punjabi-rajma-chawal_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `punjabi-rajma-chawal.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4), ingredient_complexity `standard` (sidecar score 2, 15 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

19 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 12 + cook 44 = 56 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks covered and rests inside steps 3 to 5 (step 2 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy False, vegetarian True, plant-based True, nut_policy `none`; HH001 True (Plant-based. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'vegetarian', 'plant_based'].

**Allergens:** []. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['No FlavorWeave allergen tokens: no egg, milk, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['curries', 'savory', 'spicy', 'rich', 'indian'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with pumpkin-pinto-bean-chili: an onion-tomato masala with garam masala, served over basmati; no chili powder blend, no pumpkin. Compared with coconut-chickpea-curry: kidney beans, no coconut. Compared with ghanaian-red-red-plantains: kidney beans in an Indian masala, not black-eyed peas in palm-oil tomato stew. Compared with vegetable-biryani-cashews: a bean curry over plain rice, not a  Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

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
