# Audit: Pakistani Chicken Karahi with Warm Naan

| | |
|---|---|
| Slug | `pakistani-chicken-karahi` |
| Recipe version | `rv_pakistani-chicken-karahi_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `pakistani-chicken-karahi.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (K) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `simple` (sidecar score 0, 12 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

15 ingredients, 7 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 15 + cook 40 = 55 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The naan warms in the skillet's residual heat while the karahi rests (step 6 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry True, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains chicken (poultry) and the naan contains milk.). Labels [].

**Allergens:** ['poultry', 'wheat', 'milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Poultry from the chicken.', 'Wheat and milk from the naan.', 'The naan is a store-bought hard contract: the label lists wheat flour, milk or yogurt, oil, and leavening, with no egg, soy, or sesame.', 'The karahi itself uses oil only, no ghee or cream. No egg, soy, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['chicken', 'curries', 'spicy', 'savory'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with pressure-cooker-butter-chicken: no cream or butter, cooked fast at high heat until dry and clinging; bone-in. Compared with filipino-chicken-adobo: tomato-ginger-chile, not vinegar-soy. Compared with hungarian-chicken-paprikash: no sour cream or paprika gravy; served with naan. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — FAIL

A bowl of sliced raw red onion is prominent. The karahi recipe contains no onion of any kind, so this is an invented visible ingredient (Wave-14 spanakopita precedent).

**Fix:** Regenerate without the onion bowl (lemon wedges, ginger julienne, green chiles and cilantro are fine because they are in the recipe), or add '1 small red onion, thinly sliced, to serve' to the ingredients, serve step and shopping list, re-hash, and re-audit G/N/K.

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

- Text: clock text says the naan warms 'while the karahi rests', but the step says 'while it finishes uncovered'; cosmetic.
