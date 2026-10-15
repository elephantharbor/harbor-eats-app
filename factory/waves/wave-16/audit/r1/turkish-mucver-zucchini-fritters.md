# Audit: Turkish Mücver: Zucchini-Feta Fritters with Garlic Yogurt and Tomato-Cucumber Salad

| | |
|---|---|
| Slug | `turkish-mucver-zucchini-fritters` |
| Recipe version | `rv_turkish-mucver-zucchini-fritters_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v2.jpg` → `turkish-mucver-zucchini-fritters.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (B) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7), ingredient_complexity `standard` (sidecar score 2, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — FAIL

The listed frying oil does not achieve the stated depth. Step 5 uses 1/4 cup neutral oil per batch (1/2 cup total) in a 12-inch nonstick skillet (~9.5-10 in base). That is ≈3.6 cu in over 71-78 sq in, a depth of about 1/20-1/16 inch. The HEAT section and food-safety copy both say the oil is 'about 1/8 inch' deep, which needs ≈2/3 cup per batch (≈1 1/4 cups total). A cook who follows the stated depth runs short.

**Fix:** Either change the oil to 2/3 cup per batch (1 1/4 cups total; update the neutral-oil ingredient line, step 5 text and shopping list), or change the HEAT and food-safety text to 'a thin film of oil, about 1/16 inch (1/4 cup per batch)'. Re-hash after the edit.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 25 + cook 21 = 46 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The salted zucchini drains for 10 minutes inside step 2 (step 1 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`; HH001 False (Not HH001: feta and yogurt are dairy.). Labels ['vegetarian'].

**Allergens:** ['egg', 'milk', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Egg from the eggs in the batter.', 'Milk from the feta and yogurt.', 'Wheat from the flour.', 'No soy, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['crispy', 'fresh', 'herbaceous', 'tangy', 'middle-eastern'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with japanese-okonomiyaki: small herb-feta zucchini fritters with yogurt, not a cabbage pancake with mayo and sauce. Compared with shallow-fried-green-tomatoes: grated zucchini batter, not cornmeal-coated tomato slices. Compared with greek-spanakopita: fritters, not a phyllo pie, though both use feta and dill. Compared with turkish-lahmacun: vegetarian, no lamb flatbread. Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size (v2): exactly three fritters, one broken open showing the green-flecked set interior, feta crumbles and dill on top, tomato-cucumber-red-onion salad. The yogurt swoosh carries visible green herb flecks and dark specks, but the recipe yogurt is garlic and salt only (herbs are scattered over the plate in step 6). In-recipe herbs placed in a different component: non-blocking under the Wave-14 paprikash precedent; see notes.

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

- K (recommended with the B fix, no regen needed): add 'stir 1 tablespoon of the dill into the yogurt' to the yogurt step so the herb-flecked yogurt in the hero is exact; otherwise regenerate with plain white garlic yogurt in a later pass.
- E: six ~3.5-inch fritters per batch in a 12-inch skillet is a tight fit; tolerable. G: feta microbial-rennet contract plausible; vegetarian claim relies on it.
- v1 (two fritters) correctly rejected in self-review; v2 fixes the count.
