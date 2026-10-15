# Audit: Dominican Mangú with Pan-Fried Eggs and Pickled Red Onions

| | |
|---|---|
| Slug | `dominican-mangu-eggs-pickled-onions` |
| Recipe version | `rv_dominican-mangu-eggs-pickled-onions_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `dominican-mangu-eggs-pickled-onions.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (B, E, K) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4), ingredient_complexity `simple` (sidecar score 0, 5 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — FAIL

Step 2 puts 6 green plantains (~2.5 lb) in 10 cups (2.5 qt) of water in the listed 4-quart pot. That is about 3.7 qt of water and solids, over 90% of capacity at a rolling boil (Wave-14 pot precedent: bun cha, laksa, Swedish meatballs).

**Fix:** Change the plantain pot in equipment and step 2 to a 6-quart pot, or cut the water to 8 cups (update the boil-water ingredient line and step 2 text to match).

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — FAIL

Step 2 is clocked at 24 minutes, but cooking takes 20, leaving 4 minutes to boil 10 cups of water plus 6 cold plantains. That realistically takes 12 to 15 minutes, so the clock understates by about 10 minutes.

**Fix:** Change step 2 clock_minutes to 34 (about 12 to boil, 20 cook, 2 reserve/drain), or start with water from a kettle and say so. Restate the cook/total times.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy False, vegetarian True, plant-based False, nut_policy `none`; HH001 True (Eggs are allowed. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'vegetarian'].

**Allergens:** ['egg']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Egg from the pan-fried eggs.', 'No milk, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['savory', 'tangy', 'creamy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with ghanaian-red-red-plantains: green plantains mashed savory, eggs, no bean stew. Compared with peruvian-tacu-tacu-egg in this wave: a plantain mash, not a crisp rice-and-bean cake. Compared with skillet-shakshuka: pan-fried eggs beside a mash, not eggs poached in sauce. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — FAIL

Creator-flagged and confirmed: the mangú mash is distinctly green, the same hue family as the sliced avocado beside it, so it reads as guacamole or avocado mash. Boiled green plantain mashed with olive oil and cooking water is pale cream-yellow to ivory with only a faint green cast.

**Fix:** Regenerate: the mangú is a smooth, pale cream-yellow to warm ivory mound (at most a faint greenish tint), glossy with olive oil and topped with the pink pickled red onions, clearly a different colour from the avocado slices. Keep the fried eggs and avocado. Drop the coffee cup (not in the recipe).

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

- K: the coffee-cup prop is not in the recipe; remove it during the regeneration.
