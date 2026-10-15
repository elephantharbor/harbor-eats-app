# Audit r2: Persian Lamb Koobideh Kebabs with Saffron Rice and Grilled Tomatoes

| | |
|---|---|
| Slug | `persian-lamb-koobideh-saffron-rice` |
| Recipe version | `rv_persian-lamb-koobideh-saffron-rice_v1` |
| Package revision | `author-r3` (consistent) |
| Hero | `img_v1.jpg` → `persian-lamb-koobideh-saffron-rice.webp` |
| r1 verdict | FAIL (B) |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r2. I checked everything against the r2 backup and the live files myself; the creator handoff was used only as a pointer. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. The new or kept hero was viewed at full size with Read.

## r1 findings re-checked

- **B:** Equipment is now '8 flat metal skewers, 3/4 to 1 inch wide' for the 8 kebabs in step 5. The 1-serving scaling is now 'Half a pound of lamb as 2 kebabs on 2 skewers', consistent with 2 lb / 8 = 1/4 lb per kebab. RESOLVED.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7), ingredient_complexity `standard` (sidecar score 2, 10 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

r2 re-check of r1 finding: Equipment is now '8 flat metal skewers, 3/4 to 1 inch wide' for the 8 kebabs in step 5. The 1-serving scaling is now 'Half a pound of lamb as 2 kebabs on 2 skewers', consistent with 2 lb / 8 = 1/4 lb per kebab. RESOLVED.

15 ingredients, 8 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 18 + cook 49 = 67 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The kebab mixture chills while the rice par-boils (step 3 states the overlap). The rice steams inside steps 5 and 6 (step 4 states the overlap).

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy True, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains lamb (meat) and butter (dairy).). Labels [].

**Allergens:** ['meat', 'milk']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the lamb.', 'Milk from the butter on the rice.', 'No egg, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['grilled', 'smoky', 'savory', 'herbaceous', 'middle-eastern'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with spiced-lamb-meatballs: long flat-skewer kebabs grilled with saffron rice, not meatballs. Compared with greek-chicken-souvlaki: ground lamb, saffron rice, no pita or tzatziki. Compared with nigerian-beef-suya-skewers: plain onion-lamb kebab, no peanut spice. Compared with lebanese-baked-kibbeh in this wave: grilled, no bulgur. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

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

- K (carried): soft-focus doogh glass (beverage prop).
- E (carried): 12-cup rice boil allowance is tight.
