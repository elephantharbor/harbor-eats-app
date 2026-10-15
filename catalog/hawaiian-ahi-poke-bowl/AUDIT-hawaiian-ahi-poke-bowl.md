# Audit: Hawaiian Shoyu Ahi Poke Bowls with Seasoned Rice, Cucumber, Avocado, and Edamame

| | |
|---|---|
| Slug | `hawaiian-ahi-poke-bowl` |
| Recipe version | `rv_hawaiian-ahi-poke-bowl_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `hawaiian-ahi-poke-bowl.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `easy` (sidecar score 2), ingredient_complexity `standard` (sidecar score 2, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

17 ingredients, 7 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 23 + cook 12 = 35 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks covered and rests inside steps 3 to 5 (step 2 states the overlap): about 4 minutes to boil, 15 covered, 5 resting, 24 minutes against 25 minutes of steps 2 to 5.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

Finfish raw; HH001 true (no dairy, shellfish, meat, nuts; sesame allowed). Raw-fish copy: 'The tuna is eaten raw. Buy tuna the fish counter sells for raw consumption (sashimi-grade, previously frozen for parasite control), keep it cold, and serve it the day it is bought. Raw fish is not advised for pregnant people, young children, older adults, or anyone with a weakened immune system.' Step 4 keeps the bowl cold. Good. Soy/wheat and sesame tokenized.

## H — PASS

Vocabulary tags ['bowls', 'fresh', 'umami', 'american'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with peruvian-ceviche-sweet-potato-corn: raw tuna in a soy-sesame dressing over rice, not citrus-cured flounder. Compared with salade-nicoise-seared-tuna: raw shoyu tuna on rice, not seared tuna on a French salad. Compared with sesame-soba-noodle-bowl: a rice bowl topped with raw fish, not a soba bowl. Compared with teriyaki-tofu-bowls: raw tuna, no glaze. Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size: cubed glossy ahi in shoyu dressing with sweet onion, scallion, sesame and nori strips; rice, cucumber, avocado fan and edamame, as briefed. Raw-tuna colour is natural. No invented items.

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

- G/N: the 'previously frozen for parasite control' wording is harmless but not required for tuna (FDA exempts tuna from the parasite-freeze guidance); consider 'sold for raw consumption' alone. E: 5-minute rice rest fine.
