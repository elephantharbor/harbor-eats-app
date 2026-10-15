# Audit r2: Peruvian Tacu Tacu with a Pan-Fried Egg and Salsa Criolla

| | |
|---|---|
| Slug | `peruvian-tacu-tacu-egg` |
| Recipe version | `rv_peruvian-tacu-tacu-egg_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v4.jpg` → `peruvian-tacu-tacu-egg.webp` |
| r1 verdict | FAIL (K) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **K:** New hero img_v4 (v3 superseded by Thomas because of an ají side bowl). The cake is a golden-crusted, elongated oval with rice grains and pale tan/pinkish pinto-type beans visible at the edge; it no longer reads as black beans. The salsa criolla is red-onion slivers with cilantro only, with no yellow pepper strips. Runny-yolk fried egg; one lime wedge, which the brief allows and the recipe supplies (limes). No side bowl, sauce dish, cup or prop. RESOLVED.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 6), ingredient_complexity `simple` (sidecar score 1, 9 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

12 ingredients, 9 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 2 + cook 63 = 65 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. Prep runs while the rice cooks (step 3 states the overlap); the salsa criolla is mixed while the rice cools (step 5 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy False, vegetarian True, plant-based False, nut_policy `none`; HH001 True (Eggs are allowed. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'vegetarian'].

**Allergens:** ['egg']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Egg from the pan-fried eggs.', 'The ají amarillo paste label lists peppers, salt, and acid only.', 'No milk, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['crispy', 'savory', 'tangy', 'spicy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with dominican-mangu-eggs-pickled-onions in this wave: a crisp rice-and-bean cake, not a plantain mash; ají heat. Compared with chipotle-lime-black-bean-bowls: the rice and beans are fused into a pan-fried crust, no bowl assembly, no black beans. Compared with skillet-shakshuka: no tomato sauce. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

r2 re-check of r1 finding: New hero img_v4 (v3 superseded by Thomas because of an ají side bowl). The cake is a golden-crusted, elongated oval with rice grains and pale tan/pinkish pinto-type beans visible at the edge; it no longer reads as black beans. The salsa criolla is red-onion slivers with cilantro only, with no yellow pepper strips. Runny-yolk fried egg; one lime wedge, which the brief allows and the recipe supplies (limes). No side bowl, sauce dish, cup or prop. RESOLVED.

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v4.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands. regeneration_count 3; 3 superseded record(s), and every file in rejected/ is hash-recorded there. The card is a faithful 640x480 downscale of the master, which is a centre 4:3 crop of the source.

## L2 — PASS

Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

L1 and L2 both pass (K is judged separately).

## M — PASS

Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r3` consistent across top-level, recipe_version, image, sidecar, README and brief (no stray author-r2). culinary_hash recomputed by the auditor from the build basis: matches. Unchanged from r2, as expected (image-only or clock-text-only change). Version 1; classification_history present; FREEZE_INTEGRITY re-run PASS (26/26).

## Notes (non-blocking)

- K: the cake is an elongated oval but closer to about 1.4:1 than the brief's 'about twice as long as wide'. The identity reads (not a round burger patty), as accepted at r1.
- L2: small oil/yolk droplets on the plate; slightly untidy but appetizing.
