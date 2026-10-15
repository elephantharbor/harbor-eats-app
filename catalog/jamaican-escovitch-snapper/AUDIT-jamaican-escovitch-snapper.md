# Audit r2: Jamaican Escovitch Fish: Pan-Fried Snapper with Pickled Pepper-Onion Escovitch and Rice

| | |
|---|---|
| Slug | `jamaican-escovitch-snapper` |
| Package revision | `author-r3` (consistent) |
| r1 verdict | FAIL (B, C) |
| culinary_hash | `b3211dac4b00da9f19674cba1a9123c89bf522cad0af52e51b8119621efc7da8` (recomputed, matches) |
| Image | unchanged from r1, not regenerated |
| Freeze integrity | auditor re-run PASS 26/26 (both tools) |
| Structural preflight | auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor, 2026-10-15 CT, Wave-16 r2. Full A–O re-run on the author-r3 package. Package not edited; nothing imported; D1 and repo untouched.

## A — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4), ingredient_complexity `standard` (sidecar score 2, 13 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

r1 FAIL resolved by the thin-layer option. 1/2 cup = 7.2 cu in over a 12-inch skillet's ≈9.5-10 in flat base (71-78 sq in) is ≈0.09-0.10 in deep: closer to 3/32-1/10 inch than a full 1/8 (0.125). Decision: acceptable. The quantity, heat line, step 4, scaling and do-not-scale note now agree on one figure. 'About 1/8 inch' is within ordinary cookbook tolerance (≈20-25% under), and a thin layer is correct for pan-frying dredged fillets. r1 failed a 2.5x shortfall against '1/4 inch', which this is not. The 10-inch line (1/3 cup over an ≈8 in base ≈0.10 in) uses the same ratio, so it is internally consistent.

## C — PASS

r1 FAIL resolved: 1 serving 1/3 cup in a 10-inch skillet; 2 servings the full 1/2 cup in the 12-inch; 4 as written; the do-not-scale note gives both pan sizes. Consistent.

## D — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Clock unchanged: 12 + (5+6+17+3) = 43. PASS.

## F — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Store-bought components carry hard contracts, or none are required.

## G — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: **Eligibility:** meat False, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 True (Finfish is allowed. No dairy, meat, poultry, shellfish, or nuts.). Labels ['dairy_free', 'fish'].

**Allergens:** ['finfish', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Finfish from the snapper.', 'Wheat from the flour dredge.', 'No egg, milk, soy, sesame, shellfish, or nuts.']

## H — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Vocabulary tags ['tangy', 'spicy', 'crispy'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Compared with senegalese-fish-yassa: a sharp vinegar pickle with Scotch bonnet and allspice, not slow-cooked lemon-mustard onions. Compared with red-snapper-veracruzana: pan-fried fillets under a pickled vegetable escovitch, not fish braised in tomato-olive sauce. Compared with pan-fried-trout-lemon-capers: a hot vinegar pickle over the fish, not a lemon-caper butter. Compared with jamaican-jerk-p Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

## J — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

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

package_revision `author-r3` consistent across v1.json top level, recipe_version, image, d03 sidecar, image-state, README, brief and prompt; revision_history entry author-r2→author-r3 with from/to culinary_hash. The auditor recomputed culinary_hash (b3211dac4b00da9f…), which matches the field and the history. certification null, kitchen_tested false. FREEZE_INTEGRITY re-run on copies with both tool versions: PASS, 26/26. Structural preflight re-run: PASS.

## Notes (non-blocking)

- B: if you want the wording exact, 'a thin layer, a scant 1/8 inch' matches the arithmetic. Optional; non-blocking.
- K (carried from r1): Scotch bonnet rings read like seeded banana-pepper rings; only a sliver of red skin shows. Non-blocking.
