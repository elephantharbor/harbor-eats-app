# Audit r2: Cambodian Fish Amok: Steamed Coconut-Lemongrass Fish Custards with Jasmine Rice

| | |
|---|---|
| Slug | `cambodian-fish-amok` |
| Package revision | `author-r3` (consistent) |
| r1 verdict | FAIL (B) |
| culinary_hash | `f942451e0ebd1da787161d41f1feaf9cb1d1e69a4ffeb302d43b08c753b275d0` (recomputed, matches) |
| Image | unchanged from r1, not regenerated |
| Freeze integrity | auditor re-run PASS 26/26 (both tools) |
| Structural preflight | auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor, 2026-10-15 CT, Wave-16 r2. Full A–O re-run on the author-r3 package. Package not edited; nothing imported; D1 and repo untouched.

## A — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 5), ingredient_complexity `standard` (sidecar score 3, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

r1 FAIL resolved. Capacity: six 10-oz ramekins hold ≈1.77 L. The ≈1.27-1.33 L mix plus the ≈60 ml coconut-cream topping is ≈1.33-1.39 L, so each is ≈75-79% full; step 3 says 'a scant 1 cup each, about three-quarters full' (a scant cup ≈ 220-235 ml of 296 ml), consistent with the total. Fit: three 4-inch ramekins need a circle of ≈8.6 in; a 12-inch bamboo tier has ≈11 in of usable floor, so three per tier fit with steam gaps. A 12-inch bamboo steamer seated in a 14-inch flat-bottomed wok is the standard pairing; its base sits about 2+ in above the wok floor, and 4 cups of water is ≈1-1.5 in deep, so the water stays below the steamer as step 4 requires. Equipment, heat, steps 3-5, food safety, scaling and do-not-scale lines all name the same vessels; no stale '4 ramekins', '12-ounce', 'basket' or '6-quart pot' strings remain outside revision_history.

## C — PASS

1 serving: a quarter of the mix (≈350 ml) in 2 ramekins ≈59% full ('about half full'), one tier, check at 16 minutes: consistent. 2 servings: half (≈700 ml) in 3 ramekins ≈79% full, one tier, 22 minutes, no swap: consistent. 4: as written. Do-not-scale fill and steaming-time rules agree with the steps.

## D — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 12+5+5 = 22, cook 30+2 = 32, total 54 (matches prep/cook/total fields, time_clock and README). Step 4's 30 minutes = 6 to boil + ~1 to set the steamer + 22 steam + 1 topping; the tier swap at 11 minutes is quick. Rice 4+15+10 = 29 inside 32. PASS.

## F — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Fish sauce contract: anchovy, salt (sugar optional), no shrimp/shellfish (e.g. Red Boat-style); plausible and HH001-safe. Coconut milk: plain, no additives contract. Kroeung is made from scratch.

## G — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Finfish only; no dairy, shellfish, meat or nuts; egg allowed. HH001 true. Coconut disclosed in allergen notes (no coconut token in the importer); fish sauce tokenized finfish.

## H — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Vocabulary tags ['creamy', 'herbaceous', 'tender', 'cod'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Compared with thai-fish-cakes-cucumber-relish: a soft steamed coconut custard with fish chunks, not fried fish cakes. Compared with brazilian-fish-moqueca: steamed and set with egg, not a stew. Compared with ginger-scallion-fish-packets: fish in a lemongrass-coconut custard in ramekins, not steamed in packets with ginger and scallion. Compared with thai-red-curry-kabocha: a fresh herb paste set in Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

## J — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Image unchanged (byte-identical to r1). The hero shows two spinach-lined ramekins with rice. The recipe now makes six and serves '1 or 2 ramekins per person', so two ramekins reads as one diner's generous serving: consistent, no regen. The r1 garnish/texture observation stands as a note.

## L1 — PASS

Image files byte-identical to r1 (no regeneration): source, master, card and any rejected files are absent from the r2→r3 diff, and hashes still match image.file_hashes. Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v1.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. Master re-derived: it equals a LANCZOS 1.25x upscale of the centre 960x720 source crop (mean abs diff ~1.5-2.0), disclosed in method_detail; same pipeline as Waves 14-15; no objectionable softness at master or card size. No text, logos or hands.

## L2 — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: L1 and L2 both pass (K is judged separately).

## M — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r3` consistent across v1.json top level, recipe_version, image, d03 sidecar, image-state, README, brief and prompt; revision_history entry author-r2→author-r3 with from/to culinary_hash. The auditor recomputed culinary_hash (f942451e0ebd1da7…), which matches the field and the history. certification null, kitchen_tested false. FREEZE_INTEGRITY re-run on copies with both tool versions: PASS, 26/26. Structural preflight re-run: PASS.

## Notes (non-blocking)

- C/serving: 6 ramekins for 4 servings averages 1.5 per person, so '1 or 2 ramekins per person' means unequal plates. Optional wording: 'serve 1 1/2 ramekins per person, or 1 each with the extra two to share'. Non-blocking.
- E: about 29 minutes at a boil with 4 cups of water in the wok is fine, but suggest 'check the water when you swap the tiers and top up with boiling water if needed'. Non-blocking.
- K (carried from r1): the green garnish reads as thicker green-bean/scallion lengths than slivered lime leaf, and the custard surface is grainy. Identity reads; the text was correctly not changed to match the image.
- G: coconut disclosed (no importer token); fish-sauce contract unchanged and HH001 still valid.
