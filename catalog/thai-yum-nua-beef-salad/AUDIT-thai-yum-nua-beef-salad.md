# Audit: Thai Yum Nua: Seared Steak Salad with Lime-Chile Dressing and Jasmine Rice

| | |
|---|---|
| Slug | `thai-yum-nua-beef-salad` |
| Recipe version | `rv_thai-yum-nua-beef-salad_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v2.jpg` → `thai-yum-nua-beef-salad.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4), ingredient_complexity `standard` (sidecar score 2, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

18 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 12 + cook 30 = 42 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks covered and rests inside steps 3 to 6 (step 2 states the overlap): about 4 minutes to boil, 15 covered, 10 resting, 29 minutes against 30 minutes of steps 2 to 6.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

Beef; not HH001. Fish sauce tokenized finfish (anchovy/salt contract, no shrimp). Food safety: cooked to 130 F medium-rare as the diner's choice, with the USDA 145 F + 3-minute rest guidance stated. Good.

## H — PASS

Vocabulary tags ['fresh', 'spicy', 'citrusy', 'herbaceous', 'thai'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with thai-turkey-larb-lettuce-wraps: sliced seared steak with tomato and cucumber, not minced turkey with toasted rice in lettuce cups. Compared with gochujang-grilled-flank-steak: a lime-fish sauce herb salad, not a gochujang marinade. Compared with cobb-salad: a hot-sour Thai dressing with herbs, no bacon, egg, or cheese. Compared with argentine-chimichurri-steak-potatoes: sliced steak  Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size and in crops: the lettuce has long leaves with pale central ribs and the crinkled edges of romaine; on close inspection it reads as romaine, not napa or savoy cabbage, though the crinkle is heavier than ideal. Steak is rosy medium-rare (matches 130 F), with cucumber, tomato, shallot, mint, cilantro, scallion and chile-lime dressing as in the recipe; no invented items. The vessel is a large round plate, not the oval platter in the brief and step 6: vessel shape only, non-blocking.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v2.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. Master re-derived: it equals a LANCZOS 1.25x upscale of the centre 960x720 source crop (mean abs diff ~1.5-2.0), disclosed in method_detail; same pipeline as Waves 14-15; no objectionable softness at master or card size. No text, logos or hands. v1 moved to rejected/ with a superseded record and its hash; regeneration_count 1.

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

- K: lettuce reads as romaine on close inspection (ribs, elongated leaves); the heavy crinkle is the only cabbage-like cue. Round plate vs the brief's oval platter is vessel shape only. Both non-blocking; no regen required.
- E/B: two 3/4-lb flank halves side by side in a 12-inch skillet (~10 in base) is tight; may need to sear one at a time on a smaller skillet. Tolerable.
- G: fish sauce tokenized finfish; no fish label needed beyond the token.
