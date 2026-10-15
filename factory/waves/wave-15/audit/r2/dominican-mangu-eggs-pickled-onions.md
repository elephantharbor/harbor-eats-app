# Audit r2: Dominican Mangú with Pan-Fried Eggs and Pickled Red Onions

| | |
|---|---|
| Slug | `dominican-mangu-eggs-pickled-onions` |
| Recipe version | `rv_dominican-mangu-eggs-pickled-onions_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v2.jpg` → `dominican-mangu-eggs-pickled-onions.webp` |
| r1 verdict | FAIL (B, E, K) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **B:** Equipment, HEAT and step 2 now say 6-quart pot; 10 cups + ~2.5 lb plantains ≈ 3.7 qt in 6 qt (~62%). RESOLVED.
- **E:** Step 2 now reads 'Bring to a boil over high heat, about 12 minutes, then cook until very tender, about 20 minutes', clocked 34; sums give prep 10 + cook 49 = 59, matching every time field. RESOLVED.
- **K:** New hero img_v2: the mangú is a pale ivory/cream-yellow mound glossy with olive oil, clearly a different colour from the avocado fan; pickled red onion on top; two fried eggs; avocado slices. No coffee cup or any other prop. RESOLVED.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4), ingredient_complexity `simple` (sidecar score 0, 5 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

r2 re-check of r1 finding: Equipment, HEAT and step 2 now say 6-quart pot; 10 cups + ~2.5 lb plantains ≈ 3.7 qt in 6 qt (~62%). RESOLVED.

10 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

r2 re-check of r1 finding: Step 2 now reads 'Bring to a boil over high heat, about 12 minutes, then cook until very tender, about 20 minutes', clocked 34; sums give prep 10 + cook 49 = 59, matching every time field. RESOLVED.

Prep 10 + cook 49 = 59 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The onions pickle during the plantain boil (step 3 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy False, vegetarian True, plant-based False, nut_policy `none`; HH001 True (Eggs are allowed. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'vegetarian'].

**Allergens:** ['egg']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Egg from the pan-fried eggs.', 'No milk, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['savory', 'tangy', 'creamy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with ghanaian-red-red-plantains: green plantains mashed savory, eggs, no bean stew. Compared with peruvian-tacu-tacu-egg in this wave: a plantain mash, not a crisp rice-and-bean cake. Compared with skillet-shakshuka: pan-fried eggs beside a mash, not eggs poached in sauce. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

r2 re-check of r1 finding: New hero img_v2: the mangú is a pale ivory/cream-yellow mound glossy with olive oil, clearly a different colour from the avocado fan; pickled red onion on top; two fried eggs; avocado slices. No coffee cup or any other prop. RESOLVED.

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v2.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands. regeneration_count 1; 1 superseded record(s), and every file in rejected/ is hash-recorded there. The card is a faithful 640x480 downscale of the master, which is a centre 4:3 crop of the source.

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

- K: the eggs look fried sunny-side up with crisp lacy edges; that matches 'pan-fried'.
