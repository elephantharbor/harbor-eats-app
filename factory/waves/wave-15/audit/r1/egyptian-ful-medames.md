# Audit: Egyptian Ful Medames with Warm Pita, Tomato, and Cucumber

| | |
|---|---|
| Slug | `egyptian-ful-medames` |
| Recipe version | `rv_egyptian-ful-medames_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `egyptian-ful-medames.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (K) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `easy` (sidecar score 1), ingredient_complexity `simple` (sidecar score 1, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

14 ingredients, 5 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 3 + cook 21 = 24 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. Short stovetop meal; the vegetables are cut while the beans simmer (step 3 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy False, vegetarian True, plant-based True, nut_policy `none`; HH001 True (Plant-based. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'vegetarian', 'plant_based'].

**Allergens:** ['wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Wheat from the pita.', 'The pita is a store-bought hard contract: the label lists no milk, butter, egg, honey, soy, or sesame.', 'No egg, milk, soy, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['savory', 'citrusy', 'fresh', 'creamy', 'north-african'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with egyptian-koshari: fava beans and pita, no lentil-rice-pasta layering or tomato sauce. Compared with greek-gigantes-plaki in this wave: mashed stovetop favas with raw garnishes, not a baked tomato casserole. Compared with sabich-pita-sandwiches: a bowl of mashed fava beans with pita on the side, not stuffed pita with eggplant and egg. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — FAIL

The fava mash has a crumbly, granular brown texture that reads as browned ground meat. That is a serious misread for an HH001, meat-free meal. No whole or intact fava beans are visible, though the brief asks for coarsely mashed beans with some whole ones.

**Fix:** Regenerate: coarsely mashed, creamy, saucy brown fava beans with several whole intact fava beans clearly visible on top, a smooth loose bean texture (no crumbles or granules), an olive-oil pool, cumin, diced tomato, parsley, jalapeño and lemon wedges on top, with the recipe's cucumber spears, halved radishes, kalamata olives and warm pita on the side; no egg, no meat-like crumbles.

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

- G: fava/G6PD caution note present (good).
