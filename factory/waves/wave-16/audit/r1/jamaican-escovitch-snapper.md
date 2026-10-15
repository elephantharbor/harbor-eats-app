# Audit: Jamaican Escovitch Fish: Pan-Fried Snapper with Pickled Pepper-Onion Escovitch and Rice

| | |
|---|---|
| Slug | `jamaican-escovitch-snapper` |
| Recipe version | `rv_jamaican-escovitch-snapper_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `jamaican-escovitch-snapper.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (B, C) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4), ingredient_complexity `standard` (sidecar score 2, 13 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — FAIL

The listed frying oil does not achieve the stated depth. The ingredient line is 1/2 cup neutral oil for a 12-inch skillet (~9.5-10 in flat base, 71-78 sq in). That is ≈7.2 cu in, a depth of about 1/10 inch. The do-not-scale note says 'Oil depth: keep about 1/4 inch in the skillet for any batch', which needs ≈1 1/4 to 1 1/3 cups. A cook who follows the depth instruction runs short of oil by 2.5x (shopping/quantity mismatch, the same class as the Wave-15 koobideh equipment precedent).

**Fix:** Either change the oil ingredient line (and shopping list) to 1 1/4 cups neutral oil, or change the do-not-scale note (and any heat/food-safety text) to 'a thin layer, about 1/8 inch (1/2 cup in a 12-inch skillet)'. Re-hash after the edit.

## C — FAIL

The do-not-scale oil-depth rule (1/4 inch for any batch) contradicts the base quantity, so the 1- and 2-serving scaling of the oil cannot be followed as written.

**Fix:** Follows the B fix: once the depth and quantity agree, state the oil for the 10-inch skillet in the 1-2 serving line (≈3/4 cup at 1/4 inch, or ≈1/3 cup at 1/8 inch).

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 12 + cook 31 = 43 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks covered and rests inside steps 3 to 5 (step 2 states the overlap): about 4 minutes to boil, 15 covered, 10 resting, 29 minutes against 31 minutes of steps 2 to 5.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 True (Finfish is allowed. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'fish'].

**Allergens:** ['finfish', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Finfish from the snapper.', 'Wheat from the flour dredge.', 'No egg, milk, soy, sesame, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['tangy', 'spicy', 'crispy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with senegalese-fish-yassa: a sharp vinegar pickle with Scotch bonnet and allspice, not slow-cooked lemon-mustard onions. Compared with red-snapper-veracruzana: pan-fried fillets under a pickled vegetable escovitch, not fish braised in tomato-olive sauce. Compared with pan-fried-trout-lemon-capers: a hot vinegar pickle over the fish, not a lemon-caper butter. Compared with jamaican-jerk-p Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

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

- K: the Scotch bonnet rings look like seeded yellow banana-pepper rings rather than thin seeded slivers; the fillet shows only a sliver of red skin. Still reads as escovitch; non-blocking. G: HH001 true (finfish).
