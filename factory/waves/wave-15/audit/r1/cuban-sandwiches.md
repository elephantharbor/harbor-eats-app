# Audit: Cuban Sandwiches with Mojo Pork Tenderloin, Ham, Swiss, and Pickles

| | |
|---|---|
| Slug | `cuban-sandwiches` |
| Recipe version | `rv_cuban-sandwiches_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `cuban-sandwiches.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (K) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `standard` (sidecar score 2, 12 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

14 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 8 + cook 87 = 95 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The pork marinates for 30 minutes while the oven preheats (step 2).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains pork and ham (meat) and Swiss cheese and butter (dairy).). Labels [].

**Allergens:** ['meat', 'milk', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the pork tenderloin and ham.', 'Milk from the Swiss cheese and butter.', 'Wheat from the Cuban bread.', 'The Cuban bread is a store-bought hard contract: the label lists wheat flour, water, yeast, salt, sugar, and lard or oil, with no egg, soy, milk, or sesame.', 'The ham is a store-bought hard contract: the label lists pork, water, salt, sugar, and curing agents, with no soy, wheat, or milk.', "The pickles' label lists cucumbers, vinegar, salt, and dill. Contains mustard (not a FlavorWeave token). No egg, soy, sesame, fish, shellfish, or nuts."]

## H — PASS

Vocabulary tags ['sandwiches', 'crispy', 'tangy', 'savory'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with philly-cheesesteaks: roasted mojo pork with ham, pickles, and mustard, pressed flat, not griddled shaved beef in a soft roll. Compared with crispy-skillet-chicken-sandwiches: pork and ham, pressed, no fried chicken. Compared with tomato-soup-grilled-cheese: a loaded meat sandwich, no soup. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — FAIL

(1) A prominent bowl of plantain chips is not in the recipe and implies an extra side. (2) The pork inside the sandwich reads as shredded/pulled pork, but the recipe roasts a pork tenderloin and slices it thin.

**Fix:** Regenerate: pressed Cuban sandwiches cut on the diagonal, showing thin, flat, sliced roast pork tenderloin layers, ham, Swiss and pickles; no plantain chips; props limited to recipe items (pickle spears, yellow mustard). Also delete the plantain-chip line from image-plating-brief.md 'Environmental styling'.

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

- G: yellow mustard noted; no token.
