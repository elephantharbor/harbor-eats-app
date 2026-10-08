# Wave-12 Batch B — Vale audit r1 — 2026-10-08 (CT)

Auditor: Vale (Harbor Eats - Catalog Auditor). Scope: 8 frozen packages at `freeze-r1`, all with `FREEZE_INTEGRITY: PASS`. Gates A–O, with K / L1 / L2 reported separately and D-03 checked under A and J.

The standard is binary PASS/FAIL, so no package gets "PASS WITH NOTES" for publication. Non-blocking notes are listed separately below. This is a gate result only: nothing here is published, released, or kitchen-tested (`kitchen_tested` is false). Vale did not edit any package file.

**Result: 6 PASS / 2 FAIL.**

| slug | overall | failed gates | K | L1 | L2 | D-03 (effort / complexity) | HH001 (intent → claim) |
|---|---|---|---|---|---|---|---|
| pumpkin-pinto-bean-chili | **PASS** | — | PASS | PASS | PASS | easy / standard | eligible → true ✔ |
| salade-nicoise-seared-tuna | **FAIL** | K | FAIL | PASS | PASS | involved / simple | eligible → true ✔ |
| japanese-okonomiyaki | **PASS** | — | PASS | PASS | PASS | moderate / standard | eligible → true ✔ |
| vietnamese-turmeric-dill-fish | **PASS** | — | PASS | PASS | PASS | moderate / standard | eligible → true ✔ |
| thai-turkey-larb-lettuce-wraps | **PASS** | — | PASS | PASS | PASS | easy / standard | not → false ✔ |
| sheet-pan-shrimp-boil | **PASS** | — | PASS | PASS | PASS | easy / simple | not → false ✔ |
| pressure-cooker-butter-chicken | **PASS** | — | PASS | PASS | PASS | moderate / standard | not → false ✔ |
| turkish-lahmacun | **FAIL** | C, D | PASS | PASS | PASS | involved / standard | not → false ✔ |

Per-package audit files are named on the wave-11 `VALE-AUDIT-<slug>.json` pattern. They're written in each package folder, as this audit's brief asked; wave-11 kept them in `wave-11/audits/`.

## FAILs: exact defects and minimal fixes

### salade-nicoise-seared-tuna: K FAIL (fix is image regeneration only, with no culinary, version, or classification change)
- **Defect:** The base greens are crinkled, pale yellow-green leaves with thick white midribs, so they read as **napa/savoy cabbage, not butter lettuce**. Only **3 jammy egg halves** are visible, but the brief requires "4+" (the recipe makes 8). Pale seed-like specks in the tuna crust could also read as sesame, which is forbidden.
- **Fix:**
  1. Run `build_batch_b.py reject salade-nicoise-seared-tuna --reason "K: greens read as napa/savoy cabbage; 3 egg halves; sesame-like specks"`.
  2. In the `r_nicoise.py` prompt (and in `image-prompt.md`):
     - Change "on pale-green butter lettuce leaves" to "on soft, smooth, rounded cup-shaped butter (Bibb) lettuce leaves… no crinkling, no thick white ribs".
     - Change "halved jammy soft-boiled eggs" to "eight halved jammy soft-boiled eggs (at least six halves clearly visible)".
     - Make the crust "coarsely cracked black peppercorns only (dark, no pale seeds)".
     - Add the negatives "no napa cabbage, no savoy cabbage, no romaine, no iceberg".
     - Update Must-be-visible and Must-not-appear to match.
  3. Regenerate, then run `finalize --preflight`. Keep the active filenames, add `image.generation.revision_note`, refresh `asset_sha256`, and bump `package_revision` freeze-r1 → **freeze-r2**. Freeze Integrity must PASS.
  4. Keep the current L2 strengths.

### turkish-lahmacun: C + D FAIL (fix is a v1 text amendment; no image regeneration needed)
- **D defect:** The recipe bakes on parchment at 475 F for 7–8 min on the preheated lowest-rack pan, which is above the usual parchment rating of about 420–450 F. It also calls darkening "expected". Two 12-inch parchment squares can't sit side by side on an inverted half-sheet (about 16.5×11.5 in), so overhang is guaranteed, and the recipe tells the cook to trim it during the bake at 475 F.
  - `recipe_version.steps[0].body`: change "Cut six 12-inch squares of parchment." to "Cut six 10-by-8-inch pieces of parchment (two fit side by side on the inverted pan with no overhang)."
  - `recipe_version.steps[2].body`: change "Bake 7 to 8 minutes, until … (160 F). Trim any parchment that overhangs the pan; parchment darkens at this heat, which is expected." to "Bake 3 minutes, then use tongs to slide the parchment out from under each lahmacun and discard it; bake directly on the pan 4 to 5 minutes more (7 to 8 minutes total), until the rims and underside are browned and crisp and the topping is sizzling and cooked through with no pink (160 F)."
  - `recipe_version.heat`: change "Lahmacun bake on parchment directly on the hot pan, 7 to 8 minutes per batch." to "Lahmacun start on parchment for 3 minutes, then finish directly on the hot pan; 7 to 8 minutes total per batch."
  - Times stay 20 / 32 / 52.
- **C defect:** Each 4-oz dough ball rolled to 9×7 in comes out about **1/8 in** thick, not "about 1/16 in". At 1/16 in each oval would be about 13×11 in, two would no longer fit on the pan, and the 3-batch clock would break. The description also says "Paper-thin".
  - `recipe_version.steps[1].body`: change "(about 1/16 inch)" to "(about 1/8 inch)".
  - `scaling_notes.do_not_scale`: change "1/16-inch thin dough" to "1/8-inch thin dough".
  - `dish.description` and `recipe_version.description`: change "Paper-thin flatbreads" to "Thin flatbreads".
- **Process:**
  - Make the same edits in `r_lahmacun.py`, then run `render` so README and v1 agree.
  - Recompute `culinary_hash`.
  - Bump freeze-r1 → **freeze-r2**, re-run Freeze Integrity, and request a Vale re-audit.

## Creator concerns, ruled
- **Classifications that differ from the plan are all accepted, and none shows cultural bias:**
  - Chili: simple → standard, because 18 countable items puts it in the list-length band.
  - Niçoise: moderate/standard → involved/simple. "Involved" scores 6 and is borderline but follows the rubric. Simple is right because everything comes from a mainstream supermarket.
  - Okonomiyaki: adventurous → standard, because the sauce is made from staples, the aonori and beni shoga are optional, and only bonito and Japanese mayo are specialty items.
  - Larb (easy, scores 2) is also borderline, and is accepted.
  - No package authors the legacy `effort`, `effort_band`, or `complexity` fields.
- **Three meals run 50–52 minutes:** shrimp boil (50), butter chicken (52) and lahmacun (52). All three rebuild honestly from their steps, including preheat and pressure come-up, so Gate E passes. Shrimp boil and butter chicken exceed their planned 30–45 band. Time doesn't measure effort, but "≤45 min" filters will drop them.
- **Allergen enum gaps:** Live `PACKAGE_ALLERGEN_IDS` (`harbor-eats-app/src/lib/recipe-package-integrity.js`) contains only dairy, nuts, cashew, walnut, peanut, almond, pecan, hazelnut, pistachio, macadamia, pine_nut, shellfish, finfish, poultry and meat. Batch B package tokens it doesn't support:
  - **egg**: niçoise, okonomiyaki
  - **milk**: shrimp boil, butter chicken
  - **wheat**: okonomiyaki, lahmacun
  - **soy**: okonomiyaki
  - **tree_nut**: Vietnamese fish, which also carries the supported `cashew` token
  - Mustard (niçoise Dijon) and celery (Old Bay) appear only in notes, not as tokens, which is correct.
  - Every package documents its gaps in `runtime_enum_gaps`. Under the package skill and wave-11 precedent this isn't a gate fail.
- **HH001 shopping contracts are explicit (verified):**
  - Okonomiyaki: homemade okonomi-style sauce (component contract and the step-1 "Contract check"), egg-yolk mayo with no milk, anchovy Worcestershire with no shellfish, and no dashi powder.
  - Vietnamese fish: fish sauce limited to anchovy and salt (no shrimp, crab or oyster, and not mắm tôm), plain cashews only, and no peanut oil.
  - Chili: vegetable broth, plain corn chips not fried in peanut oil, and 100% pumpkin.
  - Niçoise: the vinaigrette is dairy-free by recipe.
- **Lahmacun parchment at 475 F:** judged unsafe as written. This is the D FAIL above; the fix pulls the parchment out after 3 minutes and sizes the pieces so nothing overhangs.
- **Niçoise lettuce:** it does read as napa/savoy cabbage. This is the K FAIL above.

## Carry to release handoff (non-blocking)
1. **Allergen import blocker:** `cycle2-catalog.js:80` rejects unknown allergens. Before integration, either extend `PACKAGE_ALLERGEN_IDS` (egg, milk/dairy, wheat, soy, sesame, tree_nut) or define an explicit mapping. Don't silently drop egg, wheat or soy, because they have no live equivalent.
2. Provenance `original_ai_assisted` maps to live `ai_assisted`, and `Draft` maps to `draft`. Both are documented gaps.
3. **Niçoise** serves rare tuna (about 115 F) and jammy eggs. Consider an app-level undercooked-food advisory; the package already offers a 145 F option.
4. **Vietnamese fish:** 1.5 lb of 2-inch pieces is tight for one single layer in a 12-inch skillet. A future revision should say to sear in two batches if needed.
5. **Larb:** the fish sauce has no no-shellfish contract. That's acceptable for a non-HH001 meal, but consider adding one for allergen certainty.
6. **Butter chicken** needs an electric pressure cooker, which matters for the equipment filter. The rice boil-up adds about 4 minutes past the pressure block, which the finish step absorbs.
7. All masters are 960×720 center crops upscaled 1.25×, the same as wave-11.
8. Selection's expected allergens were correctly extended: Vietnamese adds tree_nut and cashew, larb and butter chicken add poultry, and shrimp boil and lahmacun add meat.

## Next
Cora applies the two fix sets and re-freezes to `freeze-r2`, and Freeze Integrity must PASS again. Vale then re-audits **salade-nicoise-seared-tuna** (K, L1 and L2 on the new image) and **turkish-lahmacun** (C, D, E, J and O). The 6 packages that passed don't need to be reopened unless they change.

Files: `wave-12/candidates/<slug>/VALE-AUDIT-<slug>.json` (8), plus this summary.

---

## r2 re-audit — freeze-r2 revisions (2026-10-08, ~17:15 CT)

Scope: turkish-lahmacun on C, D, E, J and O; salade-nicoise-seared-tuna on K, L1 and L2 (actual master and card WebPs, plus 3× crops of img_v1.jpg compared against `rejected/attempt1_*`). For both packages I also checked Freeze Integrity, culinary_hash and asset_sha256. Both `VALE-AUDIT-<slug>.json` files are now `audit_round: "r2"`, with the r1 findings preserved under `history[0]` and a `rescore` block. No creator files were edited.

| slug | r1 | r2 | rescored gates | FI | culinary_hash | asset_sha256 |
|---|---|---|---|---|---|---|
| turkish-lahmacun | FAIL (C, D) | **PASS** | C, D, E, J, O all PASS | PASS | `sha256:89a0fe2b…a8e3eb`, recomputed with `build_batch_b.culinary_hash()`, exact match | 3/3 match; image unchanged |
| salade-nicoise-seared-tuna | FAIL (K) | **PASS** | K, L1, L2 all PASS | PASS | `sha256:3661d36c…a6d736`, unchanged (image-only revision), exact match | 3/3 match the new files |

**Lahmacun:** The parchment is now cut to 10×8 in, so two pieces sit on the inverted pan with no overhang. The parchment is pulled with tongs after 3 minutes and the bake finishes on the pan (7–8 minutes total, 160 F, no pink). The in-oven trim and "darkens … expected" text are gone, and the heat field and equipment list (tongs) agree with the steps. The dough is "about 1/8 inch", which is consistent with 4-oz balls rolled to 9×7 in, and do_not_scale and both descriptions ("Thin flatbreads") match. No stale wording remains in v1.json or README. Times 20/32/52 are still honest, D-03 is still involved/standard, and freeze-r2 is consistent everywhere.

**Niçoise:** The greens now read as soft green lettuce, not napa or savoy cabbage. Seven jammy egg halves are visible (at least 6 required). The crust is dark cracked black pepper with no sesame read. Every required component is present and nothing forbidden appears. Images are 1200×900 and 640×480 RGB WebP, with one active set and the r1 assets only under `rejected/attempt1_*`. The card has strong appeal.

**Non-blocking (no gate FAIL):**
1. Niçoise provenance: the discarded first freeze-r2 generation (likely agent asset `2a38a305…802a.jpg`, 17:06 CT) was never finalized and is not archived. For parity with wave-11 spanish-chorizo `img_r2a-…`, copy it to `rejected/attempt2_img.jpg`, add a REJECTIONS.md line, and mention it in `image.rejected_assets_note`. Do not change the active set or hashes.
2. Niçoise: the brief says oval platter and the hero shows a round plate. This is cosmetic.
3. Lahmacun (pre-existing): `components[thin-flatbreads]` has made_in_recipe false / store_bought true, but the flatbreads are rolled and baked in the recipe; only the dough is store-bought. Fix it at the next v1 text touch, or before any "store-bought" badge surfaces.
4. Housekeeping: running `freeze_integrity.py` rewrites each package's `FREEZE_INTEGRITY.json`. The output carries no timestamp, so the content is unchanged; only mtimes moved. A stray `candidates/__pycache__/FREEZE_INTEGRITY.json` from my run was deleted.

The six r1-PASS packages were spot-checked. Creator files are unmodified since 16:54 CT, FI PASS, and culinary_hash and asset_sha256 match.

**Batch B tally after r2: 8/8 PASS → CERTIFY_V1.** kitchen_tested is false on all eight. The r1 release-handoff notes still apply, especially the allergen-enum import blocker (`egg`, `wheat`, `soy`, `sesame`, `milk`, `tree_nut` are missing from `PACKAGE_ALLERGEN_IDS`), the undercooked-tuna and jammy-egg advisory, and the pressure-cooker equipment flag.

---

## Post-cleanup re-check — Juniper cleanup pass (2026-10-08, ~17:20 CT)

Trigger: Juniper's cleanup after r2 (backup `/workspace/backups/wave-12-juniper-r2-20261008-171303/`). I diffed every Batch B file against the backup. Hashes were recomputed with `build_batch_b.culinary_hash()`. Freeze Integrity was run on `/tmp` copies so that `FREEZE_INTEGRITY.json` was not rewritten; the stored results match. All 8 `VALE-AUDIT-<slug>.json` files were advanced one round, with prior rounds kept under `history[]`. No creator files were edited.

| slug | round | verdict | rechecked | notes |
|---|---|---|---|---|
| turkish-lahmacun | r2 → r3 | **FAIL (O)** | C PASS, N PASS, O **FAIL**, A/J PASS | hash `09f38cab…77dd3` recomputes exactly; image 3/3 match; FI PASS |
| pressure-cooker-butter-chicken | r1 → r2 | **PASS** | N PASS, O PASS, A/J PASS | freeze-r2 consistent everywhere; hash `d09a5103…` unchanged; FI PASS |
| salade-nicoise-seared-tuna | r2 → r3 | **PASS** | O PASS, A/J PASS | `rejected/attempt2_img.jpg` = `2a38a305…802a` and is logged; the note is updated; active set and hashes unchanged |
| pumpkin-pinto-bean-chili, japanese-okonomiyaki, vietnamese-turmeric-dill-fish, thai-turkey-larb-lettuce-wraps, sheet-pan-shrimp-boil | r1 → r2 | **PASS** | A/J PASS | v1.json byte-identical to the backup; hashes, assets and FI verified |

**A/J for all 8:** `pantry_familiarity` is the canonical key. Batch A, Batch C and the 50 audited D-03 meals all use it, and it is the rubric's "Sourcing difficulty" factor. In every sidecar the diff is the key rename only (0 → 0) plus a `factor_key_note`. Scores and labels are unchanged and match v1.json, and the README factor lines are renamed to match. No `sourcing_difficulty` key is left in build_batch_b.py or r_*.py.

**turkish-lahmacun O FAIL. The content is fine; the freeze label is not.**
- **Content (C and N PASS):** The flatbread component is now made_in_recipe true / store_bought false, and the dough contract stays on the ingredient. ratio['1'] = 0.3333 matches "2 of 6 lahmacun".
- **Defect:** This changed culinary_hash from `89a0fe2b…` (the content r2 passed) to `09f38cab…` while package_revision stayed `freeze-r2`. The revision_note calls it "Post-certification touch-ups at freeze-r2". One frozen label now covers two culinary contents. Same-day butter chicken was bumped for a smaller change that doesn't touch the hash.
- **Fix (label only):**
  1. In `r_lahmacun.py`, set `package_revision` freeze-r2 → **freeze-r3** and re-render. This updates every freeze-r2 occurrence: root, recipe_version, image, catalog_contract_note, immutability_note, runtime_enum_gaps, provenance_note, curator_preflight[9]/[10], the d03 sidecar, the README (5, 22, 155, 156, 161) and the image-prompt.md Status line.
  2. Reword the revision_note. "Post-certification touch-ups at freeze-r2 (…)" becomes "freeze-r3 (2026-10-08 CT) follow-up v1 text amendment after Vale r2 (…)". In recipe_version.revision_note, prefix the follow-up sentence with "freeze-r3".
  3. culinary_hash must stay `sha256:09f38cab5f6df061fac7598b3585d3e946f3b87ac4eea468e46843a875777dd3`. The image and version_number 1 stay unchanged.
  4. Re-run Freeze Integrity, then Vale re-checks O only.

**Batch B tally: 7/8 PASS → CERTIFY_V1. Lahmacun is pending a freeze-r3 relabel.**

- **r4 (2026-10-08 ~17:24 CT), turkish-lahmacun O: PASS.** The freeze-r3 relabel is label-only: culinary_hash is still `09f38cab…77dd3`, the image bytes are byte-identical, FI passes, and the other 7 v1.json files are untouched. **Batch B tally: 8/8 PASS → CERTIFY_V1** (kitchen_tested false on all).
