# Audit r2: Hawaiian Huli-Huli Chicken with Grilled Pineapple and Rice

| | |
|---|---|
| Slug | `hawaiian-huli-huli-chicken` |
| Recipe version | `rv_hawaiian-huli-huli-chicken_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v1.jpg` → `hawaiian-huli-huli-chicken.webp` |
| r1 verdict | FAIL (K) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **K:** Text option taken: '1 lime, cut into wedges, to serve' (role garnish) added to the ingredients and to serve step 7 ('Cut the lime into wedges... lime wedges for squeezing') with an ingredient_ref, so the app's ingredient-derived shopping list carries it. The kept hero's lime wedges are now recipe items. D-03: 11 counted, complexity still simple. RESOLVED.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 6), ingredient_complexity `simple` (sidecar score 0, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

13 ingredients, 7 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 8 + cook 96 = 104 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The chicken marinates 1 hour (step 2). The rice cooks during steps 4 to 6 (step 3 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry True, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains chicken (poultry).). Labels ['dairy_free'].

**Allergens:** ['poultry', 'soy', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Poultry from the chicken.', 'Soy and wheat from the soy sauce.', 'No egg, milk, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['chicken', 'grilled', 'smoky', 'savory', 'american'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with greek-chicken-souvlaki: a sweet soy-pineapple glaze with rice, not lemon-oregano skewers with pita. Compared with gochujang-grilled-flank-steak: chicken thighs with a pineapple glaze, no gochujang. Compared with thai-moo-ping-sticky-rice in this wave: chicken and pineapple with steamed rice, not pork skewers with sticky rice. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

r2 re-check of r1 finding: Text option taken: '1 lime, cut into wedges, to serve' (role garnish) added to the ingredients and to serve step 7 ('Cut the lime into wedges... lime wedges for squeezing') with an ingredient_ref, so the app's ingredient-derived shopping list carries it. The kept hero's lime wedges are now recipe items. D-03: 11 counted, complexity still simple. RESOLVED.

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

- K: a small dish of dark glaze sits in the top-right corner. Step 6 uses the last of the glaze on the chicken, so none is served. It is a partial corner item that matches a recipe component, so it doesn't block; next time, either reserve 2 tbsp glaze for serving or drop the dish.
- J/D: the description doesn't mention the new lime wedges; optional.
