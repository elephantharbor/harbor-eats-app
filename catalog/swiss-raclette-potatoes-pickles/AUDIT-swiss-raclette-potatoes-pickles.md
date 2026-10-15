# Audit r2: Swiss Raclette Night: Melted Raclette over Potatoes with Cornichons and Pickled Onions

| | |
|---|---|
| Slug | `swiss-raclette-potatoes-pickles` |
| Recipe version | `rv_swiss-raclette-potatoes-pickles_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v1.jpg` → `swiss-raclette-potatoes-pickles.webp` |
| r1 verdict | FAIL (B, E) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **B:** Equipment, HEAT and step 2 now say 6-quart pot; 10 cups + 2.5 lb potatoes ≈ 3.7 qt in 6 qt (~62%). RESOLVED.
- **E:** Step 2: 'Bring to a boil over high heat, about 12 minutes, then cook until tender, about 18 minutes', clocked 32; sums give 10 + 44 = 54, matching all time fields. RESOLVED.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `easy` (sidecar score 2), ingredient_complexity `simple` (sidecar score 1, 8 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

r2 re-check of r1 finding: Equipment, HEAT and step 2 now say 6-quart pot; 10 cups + 2.5 lb potatoes ≈ 3.7 qt in 6 qt (~62%). RESOLVED.

12 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

r2 re-check of r1 finding: Step 2: 'Bring to a boil over high heat, about 12 minutes, then cook until tender, about 18 minutes', clocked 32; sums give 10 + 44 = 54, matching all time fields. RESOLVED.

Prep 10 + cook 44 = 54 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The salad and pickles are set out while the potatoes boil (step 3 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`; HH001 False (Contains raclette cheese (dairy).). Labels ['vegetarian'].

**Allergens:** ['milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Milk from the raclette cheese.', 'The raclette is a store-bought hard contract: the label lists microbial rennet, not animal rennet.', 'The cornichons and pickled onions are store-bought hard contracts: the labels list vegetables, vinegar, salt, and spices only.', 'Contains mustard (not a FlavorWeave token). No egg, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['rich', 'creamy', 'tangy', 'savory'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with potato-leek-gratin: whole boiled potatoes with melted raclette and pickles, not a baked cream gratin. Compared with kasespatzle-caramelized-onions: potatoes, not spaetzle; no onions; pickles alongside. Compared with swiss-rosti-smoked-trout: boiled potatoes with cheese, not a crisp potato cake with fish. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

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

- G: microbial-rennet raclette contract and mustard note present.
- J: deriveCookingMethod tags crispy_non_fry 'baked' (app-side).
