# Audit: Austrian Pork Schnitzel with Warm Viennese Potato Salad and Lemon

| | |
|---|---|
| Slug | `austrian-pork-schnitzel-potato-salad` |
| Recipe version | `rv_austrian-pork-schnitzel-potato-salad_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `austrian-pork-schnitzel-potato-salad.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7), ingredient_complexity `simple` (sidecar score 0, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

17 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 12 + cook 38 = 50 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The cutlets are breaded while the potatoes come to a boil and simmer (step 3 runs inside step 2, overlap stated).

## F — PASS

Breadcrumbs: 'plain dry breadcrumbs, wheat flour, yeast, salt only' (see N note). Dijon mustard: disclosed in notes. Broth: vegetable broth contract.

## G — PASS

Pork; not HH001. Wheat and egg tokenized. Mustard (Dijon in the potato dressing) disclosed in allergen notes; the importer has no mustard token, the same handling as Wave-15 (cobb, rouladen, bengali mustard fish).

## H — PASS

Vocabulary tags ['crispy', 'tangy', 'savory'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with crispy-skillet-chicken-sandwiches: a pounded pork cutlet with a potato salad, not a chicken sandwich. Compared with air-fryer-honey-mustard-pork: breaded and shallow-fried thin cutlets, not a glazed tenderloin. Compared with southern-smothered-pork-chops: crisp breaded cutlets, not chops braised in gravy. Compared with kasespatzle-caramelized-onions: a cutlet and potato salad, not ch Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

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

- F/N: breadcrumbs limited to 'wheat flour, yeast, salt only' are hard to find in US stores (most contain oil, sugar or whey); add a fallback (pulse stale plain white bread that meets the same rule, then dry it). B: 2 cups oil gives ~3/8 inch, more than the 'about 1/4 inch' stated; the cook has enough oil, so non-blocking. G: mustard disclosed.
