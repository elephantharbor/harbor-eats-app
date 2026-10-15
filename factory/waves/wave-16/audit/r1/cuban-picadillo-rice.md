# Audit: Cuban Picadillo with Green Olives, Capers, and Raisins over White Rice

| | |
|---|---|
| Slug | `cuban-picadillo-rice` |
| Recipe version | `rv_cuban-picadillo-rice_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `cuban-picadillo-rice.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4), ingredient_complexity `simple` (sidecar score 1, 12 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

17 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 10 + cook 35 = 45 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks covered and rests inside steps 3 to 6 (step 2 states the overlap): about 4 minutes to boil, 15 covered, 10 resting, 29 minutes against 35 minutes of steps 2 to 6.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Not HH001: beef is meat.). Labels ['dairy_free'].

**Allergens:** ['meat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the ground beef.', 'The tomato sauce label lists tomatoes and salt; the olive label lists olives, pimiento, water, salt, and vinegar.', 'No egg, milk, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['savory', 'tangy', 'tender'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with slow-cooker-ropa-vieja: ground beef simmered about 15 minutes, not shredded flank braised for hours. Compared with south-african-bobotie: no curry spices and no baked egg custard topping, though both use raisins. Compared with turkey-sloppy-joes: beef with olives, capers, and raisins over rice, not a sweet sauce on buns. Compared with cottage-pie: a skillet hash over rice, not a pota Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v1.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. Master re-derived: it equals a LANCZOS 1.25x upscale of the centre 960x720 source crop (mean abs diff ~1.5-2.0), disclosed in method_detail; same pipeline as Waves 14-15; no objectionable softness at master or card size. No text, logos or hands.

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

- F: the tomato-sauce ('tomatoes, salt') and olive ('olives, pimiento, water, salt, vinegar') label rules appear only in allergen notes, not on the ingredient lines; no allergen depends on them. K: olives are sliced rings rather than halved; still reads.
