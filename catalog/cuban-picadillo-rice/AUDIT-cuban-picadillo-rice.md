# Audit r2: Cuban Picadillo with Green Olives, Capers, and Raisins over White Rice

| | |
|---|---|
| Slug | `cuban-picadillo-rice` |
| Package revision | `author-r3` (consistent) |
| r1 verdict | PASS WITH NOTES |
| culinary_hash | `2ccffe55ac66494fbd6cb122094e3b3e1dfa3b6d0bd6810b86d2d1821c91a74b` (recomputed, matches) |
| Image | unchanged from r1, not regenerated |
| Freeze integrity | auditor re-run PASS 26/26 (both tools) |
| Structural preflight | auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor, 2026-10-15 CT, Wave-16 r2. Full A–O re-run on the author-r3 package. Package not edited; nothing imported; D1 and repo untouched.

## A — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 4), ingredient_complexity `simple` (sidecar score 1, 12 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: 17 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Prep 10 + cook 35 = 45 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The rice cooks covered and rests inside steps 3 to 6 (step 2 states the overlap): about 4 minutes to boil, 15 covered, 10 resting, 29 minutes against 35 minutes of steps 2 to 6.

## F — PASS

Label rules now on the ingredient lines: tomato sauce 'whose label lists tomatoes and salt only'; olives 'whose label lists olives, pimiento, water, salt, and vinegar only'. That closes the r1 note (rules were only in the allergen notes). No allergen depends on either.

## G — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: **Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Not HH001: beef is meat.). Labels ['dairy_free'].

**Allergens:** ['meat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the ground beef.', 'The tomato sauce label lists tomatoes and salt; the olive label lists olives, pimiento, water, salt, and vinegar.', 'No egg, milk, soy, wheat, sesame, fish, shellfish, or nuts.']

## H — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Vocabulary tags ['savory', 'tangy', 'tender'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Compared with slow-cooker-ropa-vieja: ground beef simmered about 15 minutes, not shredded flank braised for hours. Compared with south-african-bobotie: no curry spices and no baked egg custard topping, though both use raisins. Compared with turkey-sloppy-joes: beef with olives, capers, and raisins over rice, not a sweet sauce on buns. Compared with cottage-pie: a skillet hash over rice, not a pota Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

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

package_revision `author-r3` consistent across v1.json top level, recipe_version, image, d03 sidecar, image-state, README, brief and prompt; revision_history entry author-r2→author-r3 with from/to culinary_hash. The auditor recomputed culinary_hash (2ccffe55ac66494f…), which matches the field and the history. certification null, kitchen_tested false. FREEZE_INTEGRITY re-run on copies with both tool versions: PASS, 26/26. Structural preflight re-run: PASS.

## Notes (non-blocking)

- N/F: as hard rules on the ingredient lines, both are stricter than the allergen boundary needs, and stricter than most US shelf products. Typical canned tomato sauce adds citric acid, spices or natural flavour; most pimiento-stuffed olives use pimiento paste with sodium alginate/guar gum and lactic acid. Consider loosening to the allergen-relevant rule, e.g. 'label lists no wheat, milk, soy, fish or nuts', so shoppers aren't blocked. Non-blocking.
- K (carried, not addressed): olives are sliced rings rather than halved; still reads. Acceptable.
