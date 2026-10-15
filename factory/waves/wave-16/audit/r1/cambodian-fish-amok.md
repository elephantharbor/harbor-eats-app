# Audit: Cambodian Fish Amok: Steamed Coconut-Lemongrass Fish Custards with Jasmine Rice

| | |
|---|---|
| Slug | `cambodian-fish-amok` |
| Recipe version | `rv_cambodian-fish-amok_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `cambodian-fish-amok.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (B) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-16 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `standard` (sidecar score 3, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — FAIL

Ramekin capacity and steamer fit do not reconcile. (1) Volume: the custard mix is about 1.27-1.33 L (1.5 lb fish ≈ 650 ml packed, one 13.5-oz can of coconut milk less the 1/4 cup reserved ≈ 340 ml, kroeung paste ≈ 130 ml, 2 eggs ≈ 100 ml, fish sauce/sugar/liquid ≈ 45 ml, plus the spinach lining). Four 12-oz ramekins hold 1.42 L, so they are ~93% full before the reserved coconut-cream topping and ~97% with it. That is above the ~90% full FAIL line, and a steamed egg custard puffs. (2) Fit: four 12-oz ramekins (~4.5-5 in across each) need a ~11-12 in single layer; a collapsible steamer basket in a 6-quart pot gives ~6-8 in of flat base, so at most two fit per layer, yet step 4 steams all four at once for 22 minutes.

**Fix:** Pick one consistent setup and make equipment, steps 3-4, the time clock and scaling match it: (a) six 10-oz ramekins, or four 16-oz (2-cup) wide shallow heatproof bowls, so they are ≤~85% full with the topping; and (b) a steamer that holds them all at once: a two-tier 12-inch bamboo steamer over a 12- to 14-inch wok or wide pot, or a wide 7- to 8-quart pot with a flat rack. Or keep the 6-quart pot and steam in two batches, adding ~22 minutes to the clock and rice overlap. As an alternative to (a), cut the fish to 1 1/4 lb and recompute the scaling lines. Re-hash after the edits.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 21 + cook 32 = 53 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice is started while the steamer water heats and cooks and rests inside step 4 (overlap stated): about 4 minutes to boil, 15 covered, 10 resting, 29 minutes against 32 minutes of steps 4 and 5.

## F — PASS

Fish sauce contract: anchovy, salt (sugar optional), no shrimp/shellfish (e.g. Red Boat-style); plausible and HH001-safe. Coconut milk: plain, no additives contract. Kroeung is made from scratch.

## G — PASS

Finfish only; no dairy, shellfish, meat or nuts; egg allowed. HH001 true. Coconut disclosed in allergen notes (no coconut token in the importer); fish sauce tokenized finfish.

## H — PASS

Vocabulary tags ['creamy', 'herbaceous', 'tender', 'cod'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with thai-fish-cakes-cucumber-relish: a soft steamed coconut custard with fish chunks, not fried fish cakes. Compared with brazilian-fish-moqueca: steamed and set with egg, not a stew. Compared with ginger-scallion-fish-packets: fish in a lemongrass-coconut custard in ramekins, not steamed in packets with ginger and scallion. Compared with thai-red-curry-kabocha: a fresh herb paste set in Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size: two fluted ramekins lined with spinach, golden custard with fish chunks, coconut-cream topping and red chile, jasmine rice and a spoon; identity reads as amok. See notes on the garnish and custard texture.

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

- K: the green garnish reads as thick green-bean or scallion lengths rather than fine kaffir-lime-leaf slivers, and the custard surface looks loose and grainy rather than a smooth, just-set mousse. Identity still reads; non-blocking. If the B fix changes the vessel, regenerating is optional.
- G: coconut disclosed in allergen notes (no importer token); fish-sauce contract plausible.
