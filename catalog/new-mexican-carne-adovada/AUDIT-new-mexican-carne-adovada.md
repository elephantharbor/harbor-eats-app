# Audit: New Mexican Carne Adovada with Warm Flour Tortillas

| | |
|---|---|
| Slug | `new-mexican-carne-adovada` |
| Recipe version | `rv_new-mexican-carne-adovada_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `new-mexican-carne-adovada.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4), ingredient_complexity `simple` (sidecar score 1, 10 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

12 ingredients, 7 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 15 + cook 184 = 199 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The oven heats while the chile sauce is blended (step 3 states the preheat). The cabbage and tortillas are readied during the braise (step 6 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains pork (meat).). Labels ['dairy_free'].

**Allergens:** ['meat', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the pork.', 'Wheat from the flour tortillas.', 'The tortillas are a store-bought hard contract: the label lists wheat flour, water, oil, salt, and leavening, with no milk or soy.', 'No egg, milk, soy, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['spicy', 'smoky', 'rich', 'tender'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with mushroom-hominy-pozole-rojo: a thick pork chile braise with tortillas, not a hominy soup. Compared with slow-cooker-ropa-vieja: red-chile pork cubes in the oven, not shredded beef in tomato. Compared with jamaican-jerk-pork-chops: braised in dried-chile sauce, not grilled jerk chops. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

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

- E: long (199 min), the longest in the wave; clock reconciles.
