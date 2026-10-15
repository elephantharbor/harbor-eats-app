# Audit r2: Thai Moo Ping: Grilled Pork Skewers with Sticky Rice and Jaew Dipping Sauce

| | |
|---|---|
| Slug | `thai-moo-ping-sticky-rice` |
| Recipe version | `rv_thai-moo-ping-sticky-rice_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v1.jpg` → `thai-moo-ping-sticky-rice.webp` |
| r1 verdict | FAIL (B, E) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **B:** Ingredient prep is now 'very cold, sliced thin (1/8 inch)', and step 1 'Slice the very cold pork thin, 1/8 inch thick'. RESOLVED.
- **E:** No uncounted freeze; clock unchanged at 20 + 102 = 122. RESOLVED.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 8), ingredient_complexity `standard` (sidecar score 3, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

r2 re-check of r1 finding: Ingredient prep is now 'very cold, sliced thin (1/8 inch)', and step 1 'Slice the very cold pork thin, 1/8 inch thick'. RESOLVED.

17 ingredients, 7 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

r2 re-check of r1 finding: No uncounted freeze; clock unchanged at 20 + 102 = 122. RESOLVED.

Prep 20 + cook 102 = 122 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The pork marinates and the sticky rice soaks at the same time (step 2). The rice steams inside steps 4 to 6 (step 3 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains pork (meat).). Labels ['dairy_free'].

**Allergens:** ['meat', 'finfish', 'soy', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the pork.', 'Finfish from the fish sauce (anchovy).', 'Soy and wheat from the soy sauce.', 'The fish sauce label lists anchovy, salt, and sugar, with no shrimp or shellfish.', 'Coconut (coconut milk) is not a FlavorWeave allergen token; diners avoiding coconut should skip this dish.', 'No egg, milk, sesame, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['grilled', 'smoky', 'savory', 'tangy', 'thai'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with nigerian-beef-suya-skewers: pork with a sweet coconut-soy marinade and sticky rice, not beef with peanut spice. Compared with vietnamese-bun-cha: skewered grilled pork with sticky rice and jaew, not patties in a dipping broth with noodles. Compared with hawaiian-huli-huli-chicken in this wave: pork skewers with sticky rice and a chile-lime sauce, not glazed chicken thighs with pineap Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v1.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands. regeneration_count 0; 0 superseded record(s), and every file in rejected/ is hash-recorded there. The card is a faithful 640x480 downscale of the master, which is a centre 4:3 crop of the source.

## L2 — PASS

Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

L1 and L2 both pass (K is judged separately).

## M — PASS

Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r3` consistent across top-level, recipe_version, image, sidecar, README and brief (no stray author-r2). culinary_hash recomputed by the auditor from the build basis: matches. It changed from r2 as expected. Version 1; classification_history present; FREEZE_INTEGRITY re-run PASS (26/26).

## Notes (non-blocking)

- G: fish sauce tokenized finfish; coconut disclosed in notes (no token).
