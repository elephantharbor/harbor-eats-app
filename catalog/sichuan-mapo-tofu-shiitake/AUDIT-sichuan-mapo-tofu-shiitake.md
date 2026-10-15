# Audit: Sichuan Mapo Tofu with Shiitake and Jasmine Rice

| | |
|---|---|
| Slug | `sichuan-mapo-tofu-shiitake` |
| Recipe version | `rv_sichuan-mapo-tofu-shiitake_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v2.jpg` → `sichuan-mapo-tofu-shiitake.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `adventurous` (sidecar score 4, 13 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

18 ingredients, 8 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 10 + cook 31 = 41 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks covered and rests inside steps 3 to 7 (step 2 states the overlap): about 4 minutes to boil, 15 covered, 10 resting, 29 minutes against 29 minutes of steps 2 to 7, so the rice is ready as step 8 begins.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

Plant-based; HH001 true. Soy and wheat (doubanjiang, soy sauce) tokenized; no oyster sauce or fish products. Doubanjiang contract (broad bean, chile, salt, wheat flour; no shrimp or fish) plausible for Pixian-style brands.

## H — PASS

Vocabulary tags ['spicy', 'umami', 'savory', 'chinese', 'tofu'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with korean-soft-tofu-stew: a thick chili-bean sauce spooned over rice, not a brothy gochugaru stew with egg. Compared with sichuan-green-bean-mushroom-stir-fry: soft tofu simmered and thickened in sauce, not dry-fried beans. Compared with teriyaki-tofu-bowls: soft tofu in fermented chili bean sauce, not seared tofu in a sweet glaze. Compared with taiwanese-three-cup-mushrooms: doubanjian Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size (v2): white tofu cubes in red chile-bean sauce with chopped shiitake, Sichuan pepper and scallion, rice alongside; the shiitake reads as mushroom, not ground meat. Good.

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

- Brief says 'silken'; the recipe uses soft or medium tofu; the image is consistent with soft tofu. E: rice timing exact (29 vs 29 min). Cosmetic.
