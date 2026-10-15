# Audit: Peruvian Ají de Gallina: Creamy Ají Amarillo Chicken with Rice and Potatoes

| | |
|---|---|
| Slug | `peruvian-aji-de-gallina` |
| Recipe version | `rv_peruvian-aji-de-gallina_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `peruvian-aji-de-gallina.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (B) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7), ingredient_complexity `standard` (sidecar score 3, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — FAIL

The potato/egg pot is a 3-quart saucepan holding 8 cups (2 qt) water + 1 lb potatoes + 4 eggs, about 2.7 qt, ~90% of capacity at a boil. The 4-quart pot is already in use for the chicken poach at the same time.

**Fix:** Cut the potato water to 6 cups (update the ingredient line and step text), or add a second 4-quart pot to equipment and use it for the potatoes and eggs.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 10 + cook 52 = 62 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. Rice, potatoes, and eggs cook inside the chicken poach (steps 3 and 4 state the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry True, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `tree_nuts_present`; HH001 False (Contains chicken (poultry), milk, Parmesan (dairy), and walnuts (tree nuts).). Labels [].

**Allergens:** ['poultry', 'milk', 'wheat', 'tree_nut', 'egg']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Poultry from the chicken.', 'Milk from the evaporated milk and Parmesan.', 'Wheat from the white sandwich bread.', 'Tree nuts from the walnuts.', 'Egg from the halved hard-cooked eggs.', 'The bread is a store-bought hard contract: the label lists wheat flour, water, yeast, sugar, oil, and salt, with no soy, sesame, or egg.', 'No soy, sesame, fish, shellfish, or peanuts.']

## H — PASS

Vocabulary tags ['chicken', 'creamy', 'rich', 'spicy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with peruvian-tacu-tacu-egg in this wave: a creamy chicken stew, not a crisp rice-and-bean cake. Compared with hungarian-chicken-paprikash: ají-walnut-bread sauce, shredded chicken, rice and potatoes; no paprika or sour cream. Compared with pressure-cooker-butter-chicken: thickened with bread and walnuts, no tomato. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

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

- G: walnut tree_nut token present; Parmesan is not vegetarian-claimed.
