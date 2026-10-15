# Audit: Bengali Shorshe Maach: Haddock in Mustard-Seed Sauce with Rice

| | |
|---|---|
| Slug | `bengali-mustard-fish` |
| Recipe version | `rv_bengali-mustard-fish_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `bengali-mustard-fish.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `standard` (sidecar score 2, 9 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

13 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 12 + cook 24 = 36 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks and rests inside steps 3 to 5 (step 2 states the overlap). The mustard seeds soak during prep.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 True (Finfish is allowed. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'fish'].

**Allergens:** ['finfish']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Finfish is the haddock.', 'Contains mustard (seeds and oil). Mustard is not a FlavorWeave allergen token; it is named here for diners who avoid it.', 'No egg, milk, soy, wheat, sesame, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['spicy', 'savory', 'tangy', 'tender', 'indian'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with senegalese-fish-yassa: a ground-mustard-seed sauce with nigella, not prepared mustard with caramelized onions and lemon. Compared with vietnamese-turmeric-dill-fish: turmeric rub but a pungent mustard sauce with rice, no dill or noodles. Compared with pressure-cooker-butter-chicken: fish, no cream or tomato. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

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

- E: rice timing is tight against the fish steps; tolerable. G: mustard (seeds and oil) disclosed in notes; the app has no mustard token. Mustard-oil 'labeled for cooking' contract present. D-03: mustard-oil counted (no band change).
