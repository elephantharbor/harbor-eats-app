# Audit: Thai Crispy Barramundi with Three-Flavor Tamarind Sauce

| | |
|---|---|
| Slug | `thai-crispy-barramundi-tamarind` |
| Recipe version | `rv_thai-crispy-barramundi-tamarind_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v2.jpg` → `thai-crispy-barramundi-tamarind.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 8), ingredient_complexity `standard` (sidecar score 3, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

18 ingredients, 5 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 12 + cook 34 = 46 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks and rests inside steps 3 to 5 (step 2 states the overlap). The oil heats during step 3.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 True (Finfish is allowed. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'fish'].

**Allergens:** ['finfish']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Finfish from the barramundi and the fish sauce (anchovy).', 'The fish sauce label lists only anchovy, salt, and sugar, with no shrimp or other shellfish.', 'The coating is rice flour and cornstarch, with no wheat.', 'No egg, milk, soy, wheat, sesame, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['crispy', 'tangy', 'spicy', 'savory', 'thai'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with deep-fried-cod-roasted-potatoes: rice-flour coating, a tamarind sauce, rice; no batter or chips. Compared with crispy-fish-tacos-cabbage-slaw: no tortillas or slaw. Compared with thai-fish-cakes-cucumber-relish: whole crisp fish pieces with tamarind sauce and rice, not minced curry-paste fish cakes. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v2.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands. v1 moved to rejected/ with a superseded record and its hash; regeneration_count 1.

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

- G: fish sauce tokenized finfish with an anchovy-only, no-shrimp contract; HH001 valid. J: deriveCookingMethod tags crispy_non_fry 'baked' although the fish is deep-fried (app derivation quirk). D-03: fry-oil counted (no band change). v2 hero is good.
