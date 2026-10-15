# Audit: Indonesian Gado-Gado with Pan-Fried Tempeh, Eggs, and Peanut Sauce

| | |
|---|---|
| Slug | `indonesian-gado-gado-tempeh` |
| Recipe version | `rv_indonesian-gado-gado-tempeh_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `indonesian-gado-gado-tempeh.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `standard` (sidecar score 3, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

18 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 15 + cook 32 = 47 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The tempeh and the peanut sauce are made while the potatoes and eggs cook (steps 3 and 4 run inside step 2, overlap stated): 14 minutes of work inside 20 minutes of boiling and simmering.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy False, vegetarian True, plant-based False, nut_policy `peanuts_present`; HH001 False (Not HH001: the sauce is peanut-based.). Labels ['dairy_free', 'vegetarian'].

**Allergens:** ['peanut', 'egg', 'soy', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Peanut from the peanut butter.', 'Egg from the hard-cooked eggs.', 'Soy from the tempeh and soy sauce.', 'Wheat from the soy sauce.', 'No milk, sesame, fish, shellfish, or tree nuts.']

## H — PASS

Vocabulary tags ['savory', 'rich', 'fresh', 'crunchy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with salade-nicoise-seared-tuna: no fish, olives, or vinaigrette; tempeh, cabbage, and sprouts under a warm peanut sauce. Compared with peanut-noodle-stir-fry: a composed plate of boiled vegetables, not noodles. Compared with ginger-glazed-tempeh-plate: tempeh pan-fried plain and served with peanut sauce, not glazed with ginger. Compared with malian-chicken-maafe: a cold-and-warm vegetabl Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

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

- I: third peanut-sauce meal in the catalog (with malian maafe and the peanut noodle bowl); distinct dish. G: peanut token correct; tempeh grain contract present.
