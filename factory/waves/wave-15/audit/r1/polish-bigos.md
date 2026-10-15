# Audit: Polish Bigos: Hunter's Stew of Sauerkraut, Cabbage, Kielbasa, and Pork

| | |
|---|---|
| Slug | `polish-bigos` |
| Recipe version | `rv_polish-bigos_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `polish-bigos.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `easy` (sidecar score 2), ingredient_complexity `standard` (sidecar score 2, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

16 ingredients, 7 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 18 + cook 125 = 143 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The porcini soak during prep (step 1). Bread is sliced during the simmer (step 6 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains pork and kielbasa (meat).). Labels ['dairy_free'].

**Allergens:** ['meat', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the pork shoulder and kielbasa.', 'Wheat from the rye bread, which also contains wheat flour.', 'Contains gluten (rye) from the rye bread.', 'The kielbasa is a store-bought hard contract: the label lists pork, salt, spices, garlic, and curing agents, with no milk, soy, or wheat fillers.', 'The sauerkraut is a store-bought hard contract: the label lists cabbage and salt only.', 'The rye bread is a store-bought hard contract: the label lists rye flour, wheat flour, water, yeast, salt, and caraway, with no milk, egg, soy, or sesame.', 'No egg, milk, soy, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['stews', 'tangy', 'smoky', 'rich'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with polish-mushroom-barley-krupnik: a thick sauerkraut-and-meat stew, not a barley soup. Compared with brazilian-feijoada: sauerkraut and cabbage with kielbasa, no beans. Compared with ukrainian-beet-borscht: no beets; a thick stew, not a soup. Compared with irish-beef-stew in this wave: pork, kraut, and sausage, not beef in stout. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

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

- K: a beer-glass prop is non-blocking. G: rye bread has a wheat token plus 'Contains gluten (rye)'; no gluten_free claim. E: long (143 min).
