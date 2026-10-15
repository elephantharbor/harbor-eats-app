# Audit: Japanese Hambagu: Beef and Pork Hamburg Steaks with Rich Pan Sauce

| | |
|---|---|
| Slug | `japanese-hambagu` |
| Recipe version | `rv_japanese-hambagu_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `japanese-hambagu.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (K) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `simple` (sidecar score 1, 16 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

21 ingredients, 8 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 6 + cook 38 = 44 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks and rests inside steps 3 to 6 (step 2 states the overlap). The onions cool while the cabbage is shredded (step 4 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains beef and pork (meat), milk, and butter (dairy).). Labels [].

**Allergens:** ['meat', 'egg', 'milk', 'wheat', 'soy']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the beef and pork.', 'Egg from the egg in the patties.', 'Milk from the milk and butter.', 'Wheat from the panko and soy sauce.', 'Soy from the soy sauce.', 'The panko is a store-bought hard contract: the label lists wheat flour, yeast, sugar, salt, and oil, with no milk, egg, or sesame.', 'No sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['rich', 'savory', 'umami', 'tender', 'japanese'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with classic-smash-burgers: thick steamed patties in a pan sauce with rice, no bun. Compared with glazed-turkey-meatloaf: individual beef-pork patties seared and steamed, not a baked turkey loaf. Compared with swedish-meatballs-lingonberry: large patties with a ketchup-wine-soy sauce, not small meatballs in cream gravy. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — FAIL

(1) A cup of miso soup is not in the recipe and reads as an extra side. (2) The cut patty interior is distinctly pink, but the recipe cooks to 160 F with 'juices run clear', so the image implies undercooked ground meat.

**Fix:** Regenerate: the cut patty interior is cooked through, juicy and grey-brown with no pink; pan sauce, short-grain rice and the shredded cabbage-carrot salad as in the recipe; no miso soup or other unlisted side. Remove the miso line from the brief.

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

- G: sake/mirin alcohol note present.
