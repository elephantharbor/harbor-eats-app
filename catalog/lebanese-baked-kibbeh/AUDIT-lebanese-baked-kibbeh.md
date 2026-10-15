# Audit: Lebanese Baked Kibbeh with Pine Nuts, Yogurt-Cucumber Salad, and Fattoush-Style Greens

| | |
|---|---|
| Slug | `lebanese-baked-kibbeh` |
| Recipe version | `rv_lebanese-baked-kibbeh_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `lebanese-baked-kibbeh.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 9), ingredient_complexity `standard` (sidecar score 3, 13 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

17 ingredients, 7 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 12 + cook 102 = 114 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The bulgur soaks while the filling cooks (step 2). The salads are made during the bake (step 6 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `tree_nuts_present`; HH001 False (Contains lamb (meat), yogurt (dairy), and pine nuts (tree nuts).). Labels [].

**Allergens:** ['meat', 'wheat', 'tree_nut', 'milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the lamb.', 'Wheat from the bulgur.', 'Tree nuts from the pine nuts.', 'Milk from the yogurt.', 'The seven-spice blend is a store-bought hard contract: the label lists spices only, with no wheat or nuts.', 'No egg, soy, sesame, fish, shellfish, or peanuts.']

## H — PASS

Vocabulary tags ['savory', 'crispy', 'herbaceous', 'fresh', 'middle-eastern'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with lebanese-samke-harra-bulgur: a lamb-and-bulgur bake with pine nuts and yogurt salad, not fish with tahini. Compared with spiced-lamb-meatballs: layered baked kibbeh with a bulgur shell, not meatballs. Compared with south-african-bobotie: bulgur-and-lamb layers with pine nuts, not a curried mince under an egg custard. Compared with persian-lamb-koobideh-saffron-rice in this wave: bake Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

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

- K: pieces are cut in triangles rather than the scored diamonds the brief describes (creator flag); identity still reads. G: pine-nut tree_nut token present.
