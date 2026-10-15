# Audit: Mushroom Stroganoff with Sour Cream, Dill, and Buttered Egg Noodles

| | |
|---|---|
| Slug | `russian-mushroom-stroganoff` |
| Recipe version | `rv_russian-mushroom-stroganoff_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `russian-mushroom-stroganoff.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `simple` (sidecar score 0, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

15 ingredients, 8 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 10 + cook 31 = 41 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The noodle pot comes to a boil (about 12 minutes) inside steps 3 and 4 (18 minutes), and the noodles cook inside step 6 (steps 2 and 5 state the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

Vegetarian (dairy: sour cream, butter); not HH001 (dairy). Wheat (egg noodles, flour) and egg tokenized; mustard (Dijon) disclosed in notes with no importer token, consistent with Wave-15.

## H — PASS

Vocabulary tags ['creamy', 'savory', 'rich', 'mushrooms'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with hungarian-chicken-paprikash: mushrooms with Dijon and dill, no chicken, and a broth sauce finished with sour cream. Compared with mushroom-walnut-bolognese: a creamy sour cream sauce on egg noodles, not a tomato-walnut ragu on pasta. Compared with polish-mushroom-barley-krupnik: a sauced noodle dinner, not a barley soup. Compared with kasespatzle-caramelized-onions: mushrooms in a so Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

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

- F: broth contract ('vegetables, salt, herbs only') plausible. G: mustard disclosed.
