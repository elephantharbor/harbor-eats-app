# Audit: Argentine Grilled Strip Steak with Chimichurri, Grilled Potatoes, and Ensalada Criolla

| | |
|---|---|
| Slug | `argentine-chimichurri-steak-potatoes` |
| Recipe version | `rv_argentine-chimichurri-steak-potatoes_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `argentine-chimichurri-steak-potatoes.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (E) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `simple` (sidecar score 1, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

14 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — FAIL

Step 2 is clocked at 18 minutes, but 12 minutes cooking plus 2 minutes steam-drying leaves 4 minutes to bring 8 cups of water plus 2 lb of cold potatoes to a boil on high. That realistically takes 10 to 12 minutes, so the clock understates by about 8 minutes. This goes beyond the 'tight boil' notes accepted in Wave-14, which allowed about 10 minutes for 12 cups.

**Fix:** Change step 2 clock_minutes to 26 (about 10 to boil, 12 cook, 2 steam-dry, 2 toss), or state that the potatoes start during prep as an overlap. Then restate cook/total time in time_clock, time_reconstruction and the top-level time fields.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains beef (meat).). Labels ['dairy_free'].

**Allergens:** ['meat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the beef.', 'No egg, milk, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['grilled', 'herbaceous', 'smoky', 'tangy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with steak-au-poivre-smashed-potatoes: grilled, a raw herb-vinegar sauce, no cream or pepper crust, grilled not smashed potatoes. Compared with gochujang-grilled-flank-steak: salt-only strip steak with chimichurri, no gochujang. Compared with grilled-lamb-chops-mint-salsa-verde in this wave: beef with parsley-oregano chimichurri, not lamb with mint salsa verde. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

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

- K: a red-wine glass in the background is not in the recipe; beverage prop only, non-blocking. D-03: coarse-salt counted as an ingredient (no band change).
