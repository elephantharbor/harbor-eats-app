# Audit r2: Turkish Mücver: Zucchini-Feta Fritters with Garlic Yogurt and Tomato-Cucumber Salad

| | |
|---|---|
| Slug | `turkish-mucver-zucchini-fritters` |
| Package revision | `author-r3` (consistent) |
| r1 verdict | FAIL (B) |
| culinary_hash | `f8a2f157239511d8c610aad7ac92b4fb95546a4b02765fa47423237242311644` (recomputed, matches) |
| Image | unchanged from r1, not regenerated |
| Freeze integrity | auditor re-run PASS 26/26 (both tools) |
| Structural preflight | auditor re-run PASS |
| **r2 verdict** | **PASS WITH NOTES** |

Independent auditor, 2026-10-15 CT, Wave-16 r2. Full A–O re-run on the author-r3 package. Package not edited; nothing imported; D1 and repo untouched.

## A — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 7), ingredient_complexity `standard` (sidecar score 2, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — PASS

r1 FAIL resolved. 2/3 cup = 9.6 cu in over ≈71-78 sq in ≈0.12-0.14 in: about 1/8 inch, as heat, food-safety, step 5 and scaling state. The neutral-oil line is 1 1/3 cups (2/3 per batch). 10-inch line: 1/2 cup over an ≈8 in base ≈0.14 in, about 1/8: consistent. Dill raised to 1/2 cup = 8 tbsp: 1 yogurt + 2 scatter + 5 batter, and steps 2/3 allocate it exactly (the batter gets ≈5 tbsp vs ≈3.3 before; a flavour shift only).

## C — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — PASS

Prep 6+12+5+2 = 25; cook 21+2 = 23; total 48 (fields, time_clock, README agree). Step 5's 21 minutes = 3 to heat + 8 + ~1 drain/add oil + 1 reheat + 8: reconciles.

## F — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Store-bought components carry hard contracts, or none are required.

## G — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: **Eligibility:** meat False, poultry False, finfish False, shellfish False, dairy True, vegetarian True, plant-based False, nut_policy `none`; HH001 False (Not HH001: feta and yogurt are dairy.). Labels ['vegetarian'].

**Allergens:** ['egg', 'milk', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Egg from the eggs in the batter.', 'Milk from the feta and yogurt.', 'Wheat from the flour.', 'No soy, sesame, fish, shellfish, or nuts.']

## H — PASS

Description and component now read 'garlic-dill yogurt' / 'yogurt flecked with dill', supported by step 2. PASS.

## I — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Compared with japanese-okonomiyaki: small herb-feta zucchini fritters with yogurt, not a cabbage pancake with mayo and sauce. Compared with shallow-fried-green-tomatoes: grated zucchini batter, not cornmeal-coated tomato slices. Compared with greek-spanakopita: fritters, not a phyllo pie, though both use feta and dill. Compared with turkish-lahmacun: vegetarian, no lamb flatbread. Checked against the 135 catalog meals, the 50 Wave-15 meals and the rest of Wave-16: no slug collision, not a cosmetic duplicate.

## J — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Image unchanged. The r1 K note (green flecks in a garlic-only yogurt) is resolved by the text: step 2 now stirs 1 tbsp dill into the yogurt, so the herb-flecked swoosh matches the recipe. Three fritters, one broken open, feta, dill, salad: as briefed.

## L1 — PASS

Image files byte-identical to r1 (no regeneration): source, master, card and any rejected files are absent from the r2→r3 diff, and hashes still match image.file_hashes. Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v2.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. Master re-derived: it equals a LANCZOS 1.25x upscale of the centre 960x720 source crop (mean abs diff ~1.5-2.0), disclosed in method_detail; same pipeline as Waves 14-15; no objectionable softness at master or card size. No text, logos or hands. v1 moved to rejected/ with a superseded record and its hash; regeneration_count 1.

## L2 — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: L1 and L2 both pass (K is judged separately).

## M — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Unchanged since r1 except the revised fields (field-by-field diff of v1.json, README, brief, prompt, sidecar and image-state against the author-r2 backup tarball, which is byte-identical to the state audited in r1). r1 evidence stands. r1: Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r3` consistent across v1.json top level, recipe_version, image, d03 sidecar, image-state, README, brief and prompt; revision_history entry author-r2→author-r3 with from/to culinary_hash. The auditor recomputed culinary_hash (f8a2f157239511d8…), which matches the field and the history. certification null, kitchen_tested false. FREEZE_INTEGRITY re-run on copies with both tool versions: PASS, 26/26. Structural preflight re-run: PASS.

## Notes (non-blocking)

- B: batch 2 adds a fresh 2/3 cup to whatever oil is left after batch 1, so the second batch runs slightly deeper than 1/8 inch (more oil, not less; safe direction). Non-blocking.
- K: a few dark specks in the yogurt (pepper-like) remain; trivial. E: six 3.5-inch fritters per batch in a 12-inch skillet is still tight (carried).
