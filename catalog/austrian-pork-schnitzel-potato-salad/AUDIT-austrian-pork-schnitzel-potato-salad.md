# Audit r2: Austrian Pork Schnitzel with Warm Viennese Potato Salad and Lemon

| | |
|---|---|
| Slug | `austrian-pork-schnitzel-potato-salad` |
| Package revision | `author-r3` (consistent) |
| r1 verdict | PASS WITH NOTES |
| culinary_hash | `c19fa32db70ff90dc3220518bd5f645d3183801a0a9c8cd85085400fc0ac97ec` (recomputed, matches) |
| Image | unchanged from r1, not regenerated |
| Freeze integrity | auditor re-run PASS 26/26 (both tools) |
| Structural preflight | auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor, 2026-10-15 CT, Wave-16 r2. Full A–O re-run on the author-r3 package. Package not edited; nothing imported; D1 and repo untouched.

## A — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7), ingredient_complexity `simple` (sidecar score 0, 11 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: 17 ingredients, 6 steps; every ingredient used; split quantities stated; equipment sized for the quantities.

## C — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Main path clock unchanged: 12 + (18+4+14+2) = 50 with store-bought crumbs. The homemade-crumb fallback (about 12 minutes) is not in the total. Decision: acceptable as a note, not a FAIL. It is a conditional path ('If you cannot find them'), its extra time is stated where the cook reads it ('This adds about 12 minutes before step 1'), and the default path's clock is accurate. The Wave-15 partial-freeze FAILs were different: those were mandatory steps on the main path that the clock silently dropped.

## F — PASS

Breadcrumb contract unchanged ('wheat flour, yeast, salt only'), now with a fallback: day-old plain bakery bread whose label lists only wheat flour, water, yeast and salt. That keeps the same allergen boundary (wheat only; no milk, soy, sesame, egg). The allergen note is updated to match.

## G — PASS

Unchanged: pork, not HH001; wheat and egg tokenized; Dijon mustard disclosed in allergen notes and runtime_enum_gaps. The fallback bread adds no new allergen.

## H — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Vocabulary tags ['crispy', 'tangy', 'savory'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Compared with crispy-skillet-chicken-sandwiches: a pounded pork cutlet with a potato salad, not a chicken sandwich. Compared with air-fryer-honey-mustard-pork: breaded and shallow-fried thin cutlets, not a glazed tenderloin. Compared with southern-smothered-pork-chops: crisp breaded cutlets, not chops braised in gravy. Compared with kasespatzle-caramelized-onions: a cutlet and potato salad, not ch Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

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

package_revision `author-r3` consistent across v1.json top level, recipe_version, image, d03 sidecar, image-state, README, brief and prompt; revision_history entry author-r2→author-r3 with from/to culinary_hash. The auditor recomputed culinary_hash (c19fa32db70ff90d…), which matches the field and the history. certification null, kitchen_tested false. FREEZE_INTEGRITY re-run on copies with both tool versions: PASS, 26/26. Structural preflight re-run: PASS.

## Notes (non-blocking)

- E: optionally append '(about 62 minutes if you make the crumbs)' to time_clock/README so the total shows both paths. Non-blocking.
- B/D: the fallback needs a food processor, which is not in the equipment list. Add 'food processor (only for the homemade-crumb fallback)', or allow a box grater. About 6 oz of day-old bread dries to roughly 1 1/4-1 1/2 cups of fine crumbs, so it's borderline; 'about 7 oz' would give margin. Keep the crumbs pale when drying, since toasted crumbs brown fast in the fry. All non-blocking.
- B (carried): 2 cups oil ≈3/8 inch vs 'about 1/4 inch'; surplus, non-blocking. G: mustard disclosed.
