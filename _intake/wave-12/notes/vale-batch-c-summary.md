# Vale — wave-12 batch C audit summary (r1)

Auditor: Vale (Harbor Eats - Catalog Auditor) · 2026-10-08 (America/Chicago) · package_revision freeze-r1 · contract: flavorweave-catalog-certification A–O (K, L1, L2 separate) + D-03.
I am independent of the creator (Cora/Juniper). Packages not mutated. kitchen_tested false. Verdicts are binary; "PASS WITH NOTES" is not a publication state, so notes are listed separately and are non-blocking.

Freeze Integrity: re-run by Vale on copies of all 8 folders → PASS, 0 fails each. culinary_hash recomputed from batch_c_recipes.py → matches for all 8. Image file hashes match; master 1200x900 / card 640x480 WebP RGB.

## Results — 3 PASS / 5 FAIL

| slug | HH001 | verdict | failed gates | disposition |
|---|---|---|---|---|
| spaghetti-puttanesca | true ✓ | **FAIL** | J | classification metadata amendment (no culinary v2, no image regen) |
| mushroom-hominy-pozole-rojo | true ✓ | **PASS** | — | certify |
| sabich-pita-sandwiches | true ✓ (sesame flag) | **PASS** | — | certify |
| thai-fish-cakes-cucumber-relish | true ✓ | **FAIL** | K (→L), J | regenerate image + classification amendment |
| tomato-soup-grilled-cheese | false ✓ | **PASS** | — | certify |
| cashew-chicken-stir-fry | false ✓ | **FAIL** | K (→L), J | regenerate image + classification amendment |
| cottage-pie | false ✓ | **FAIL** | J | classification metadata amendment |
| seared-scallops-parsnip-puree | false ✓ | **FAIL** | D | v1 text amendment (no image regen) |

Per-package audits: `wave-12/candidates/<slug>/VALE-AUDIT-<slug>.json` (batch A/B naming and format).

## FAIL defects and minimal fixes

### Shared builder fix (all J failures)
- `batch_c_build.py` `count_band`: `0 if n <= 12 else (1 if n <= 16 else 2)` → `0 if n <= 8 else (1 if n <= 14 else 2)` (D-03 rubric; batch A builder and Vale D-03 audits use ≤8 / 9–14 / ≥15). `counted_ingredients()` must also skip `optional: true` items (batch A/B convention). Update `conventions.ingredient_count_band` text in each sidecar.
- Classification-only fixes are metadata amendments: same version_number 1, append a `classification_history` entry (from/to/reason citing this audit), culinary_hash unchanged, no K/L rerun.

### spaghetti-puttanesca — J
- Defect: ingredient_complexity simple (0). 10 countable → band 1; anchovy fillets = specialty 1 (Vale D-03 grilled-swordfish precedent). Score 2 → standard.
- Fix: `batch_c_recipes.py` d03.complexity_factors.specialty_burden 0→1, specialty_items [] → ["anchovy fillets"]; `d03-classification.json` complexity_factors {0,0,0,0} → {1,1,0,0}, complexity_score 0→2, ingredient_complexity simple→standard; `v1.json recipe_version.ingredient_complexity` simple→standard + classification_history entry; curator_preflight[7].detail, README lines 20/38/40, BATCH-C-STATUS row. Effort moderate 3 stands.

### thai-fish-cakes-cucumber-relish — K and J
- K defect: the broken-open interior is vivid salmon-pink and looks moist and raw, so it reads as salmon or undercooked fish. The green inclusions read as peas or edamame instead of green-bean rounds, and the pebbly, crumb-like surface is close to the must-not that got the first attempt rejected.
- K fix: move the active JPEG and both WebPs to `rejected/` under new names. In image-prompt.md and image-plating-brief.md, require an "opaque, matte, pale tan-coral cooked interior flecked with curry paste — not pink, translucent or moist-looking; thin 1/8-inch green-bean rings showing seeds, no peas/edamame; smooth puffed blistered golden surface, no crumbs". Add "pink/salmon/translucent interior" and "peas or edamame" to Must not appear. Regenerate, run `prepare`, and record both rejected attempts in the image metadata.
- J defect: effort moderate 5. Shaping 16 cakes plus batch shallow-frying is technique 2 (rubric; Vale spiced-lamb-meatball precedent), so the floor makes it involved.
- J fix: effort_factors.technique 1→2; effort_score 5→6; effort_level moderate→involved; effort_floors_applied += `technique_2_plus_prep_or_components_involved`. Apply in batch_c_recipes.py, d03-classification.json, `v1.json recipe_version.effort_level`, a classification_history entry, preflight detail, README lines 19/36/40 and the STATUS row. Complexity standard 3 stands.
- Culinary is OK: 145 F; hard rules for shrimp-paste-free, soy/wheat-free curry paste and shrimp-free fish sauce; oil not peanut.

### cashew-chicken-stir-fry — K and J
- K defect: the chicken shows as large (~2 in) flat cutlet/tender pieces with grill stripes instead of bite-size 3/4-inch velveted pieces. Small round tan nuggets in the sauce read as peanuts or chickpeas; peanuts are a must-not, and the meal claims cashews only.
- K fix: reject to `rejected/`. In the prompt and brief, require "bite-size 3/4-inch cubes of velveted chicken breast, no whole cutlets, no strips >1 inch, no grill marks; the only nuts are whole cashews, no other small round nuts/legumes/chickpeas". Add the matching must-nots, then regenerate and run `prepare`.
- J defect: complexity simple 1. 15 countable → band 2; velvet marinade + sauce → breadth 1 (souvlaki/teriyaki precedent). Score 3 → standard.
- J fix: complexity_factors {1,0,0,0} → {2,0,1,0}; complexity_score 1→3; ingredient_complexity simple→standard. Apply in v1, the history, README lines 20/38/40 and the STATUS row. Also fix the rationale's stale "Thai Basil Eggplant scored 6 (involved)". Effort moderate 5 stands.

### cottage-pie — J
- Defect: complexity simple 1. 15 countable (butter counted, as in batch A smash burgers) → band 2. Score 2 → standard.
- Fix: ingredient_count_band 1→2; complexity_score 1→2; ingredient_complexity simple→standard. Apply in v1, the history, README lines 20/38/40 and the STATUS row. Effort moderate 5 stands.

### seared-scallops-parsnip-puree — D
- Defect: the scallops come off at 120–125 F, "translucent in the center", and no fully cooked option is given. The swordfish and niçoise precedents passed only because they offered a 145 F option.
- Fix: in `recipe_version.steps[4].body`, after "(120 to 125 F).", add "For fully cooked scallops (recommended for young children, pregnant, older, or immunocompromised diners), cook 1 to 2 minutes longer on the second side until opaque throughout (145 F)." In `recipe_version.doneness`, append "Fully cooked option: opaque throughout (145 F)." Mirror both in batch_c_recipes.py, re-render, recompute culinary_hash and go to freeze-r2. Times (10/37/47) and the image are unchanged.

## Rulings on creator-flagged items
- **Effort changes.** Puttanesca easy→moderate 3 ✓, sabich moderate→involved 6 ✓, tomato soup easy→moderate 4 ✓, cashew chicken easy→moderate 5 ✓.
  - The premise that Thai Basil Eggplant is "involved" is superseded. In the final D-03 ruling (JUNIPER-CLASSIFICATION-BATCH r2, which Vale agreed with), it is **moderate 5 [1,2,1,1,0]** because unattended rice counts as coordination 0. Cashew chicken at 5 matches it.
  - The rationales for sabich and cashew chicken cite the stale "(6, involved)" and should be corrected.
  - Fish cakes is the one effort label that is wrong: it should be involved (see above).
- **Time bands.** Derive them from the honest total_minutes: tomato soup 56 → 45+, cashew chicken 33 → 30–45, scallops 47 → 45+, cottage pie 81 → 45+, pozole 63 → 45+. All clocks reconstruct, and the WAVE bands were only plans. selection_alignment already records the deviations, so update coverage/selection to match.
- **Allergen/provenance enums.** Packages keep `original_ai_assisted`, `milk`, `tree_nut` and `cashew`. This is the wave-10/11 precedent ("do not silently remap"), and the gaps are documented in runtime_enum_gaps. **The importer maps them** (original_ai_assisted→ai_assisted, milk→dairy, tree_nut→nuts).
  - **Release blocker:** egg, soy, wheat and sesame have no live PACKAGE_ALLERGEN_IDS token. The importer must carry or extend them and must never silently drop them.
  - For cashews-only meals, map to live `cashew` **without** adding generic `nuts`, or the HH001 cashew exception breaks.
- **Cottage pie.** The wheat, finfish (anchovies in Worcestershire) and meat allergens are correct; meat follows the tibs precedent. Leaving out a cuisine tag is correct because D-02 has no british slug. Keep the cuisine_gap entry and do not invent a tag.
- **Reason codes.** The closed list exists at `/workspace/d03-design/FACTORY-SKILL-AMENDMENT.md` but is a draft that has not been applied. Batch C's free-form codes are therefore non-blocking. Remap them to the v1 closed set at freeze-r2; suggested mappings are in each audit's non_blocking_notes.
- **Factor key.** Batch C actually uses `pantry_familiarity`, the same as batch A and the 50 audited classifications; it does not use `sourcing_difficulty`. **`pantry_familiarity` is canonical** (it is the rubric's "sourcing difficulty" factor). Batch B's `sourcing_difficulty` is the outlier and should be renamed or aliased at import.
- **Count band.** Batch C's builder band (≤12/13–16/17+) is not the rubric. It mislabels puttanesca, cashew chicken and cottage pie. On sabich and tomato soup it leaves only factor-level errors under correct labels (non-blocking).

## Non-blocking notes (wave hygiene)
- **Sabich.**
  - HH001 is allowed because tahini is sesame, a seed, and the rule bans "nuts except cashews". **Household should confirm HH001 has no sesame restriction.**
  - Sidecar: count 11 (amba is optional), band 1, specialty_items should be ["tahini"].
  - Image: egg shows as halves and the pitas lie flat.
- **Tomato soup.**
  - Sidecar: count 10 (sugar is optional), band 1, score 1, still simple.
  - Vegetarian-rennet cheddar is specialty 0 because mainstream block cheddar already meets the contract. This is borderline against the Parmesan/Gruyère precedent.
- **Pozole.**
  - Image: broth slightly thick and granular; the oregano mound is larger than a pinch.
  - The scaling "1" note says to make a half batch of chiles.
- **Cottage pie scaling.**
  - `scaling_notes["1"]` says "Make half the recipe…" but `ratio["1"]` is 0.25, so the shopping list comes out short.
  - Not failed, for consistency with batch B butter chicken ("make the full recipe" with ratio 0.25 passed).
  - **Importer/curator item:** reconcile the scaling notes with ratio["1"] wave-wide. For cottage pie, either set ratio "1" to 0.5 or write a true quarter-recipe note.
- **Cashew chicken.** Add "label lists no peanuts" to the hoisin line.
- **Fish cakes.** specialty_items should add fish sauce, and optional makrut should not be counted.
- **Scallops (image).** The sage looks soft and there is an extra lemon slice in the arugula.
- **Puttanesca (image).** Olive halves and large garlic slices.
- **Rejected attempts.** Record rejected images in v1.json image metadata; at the moment only `rejected_dir` is recorded.

## Release handoff
- Certify-ready now: **mushroom-hominy-pozole-rojo, sabich-pita-sandwiches, tomato-soup-grilled-cheese** (freeze-r1 hashes as audited). HH001 publication of sabich depends on the household's sesame confirmation.
- Not publishable until r2: puttanesca, thai fish cakes, cashew chicken, cottage pie, scallops.
- Importer must:
  - map the provenance and allergen tokens explicitly
  - keep egg/soy/wheat/sesame
  - map cashew without generic nuts for HH001
  - alias sourcing_difficulty → pantry_familiarity for batch B
- Rights remain not_cleared_for_external_release for all images.

## Next steps (Cora → Vale r2)
1. Fix `count_band` and the optional-exclusion rule in batch_c_build.py, then apply the per-slug d03 edits in batch_c_recipes.py. Remap reason codes to the closed set.
2. Scallops: apply the D text fix. Fish cakes and cashew chicken: reject, revise the prompt and brief, regenerate, run `prepare`.
3. Re-render the failed slugs at **freeze-r2**, adding classification_history entries for the J fixes.
   - Either keep the 3 PASS packages byte-identical at freeze-r1, or, if `build` re-renders them for the sidecar tidy, re-freeze them too and ask Vale for a hash re-check.
4. Run `batch_c_build.py finalize <slug>`. FREEZE_INTEGRITY must PASS. Update BATCH-C-STATUS.md.
5. Vale r2 checks the changed items: J (puttanesca, fish cakes, cashew chicken, cottage pie), K/L1/L2 (fish cakes, cashew chicken), D/O (scallops). New files go to `VALE-AUDIT-<slug>-r2.json`.

Disclosure: freeze_integrity.py rewrites FREEZE_INTEGRITY.json when it runs. The batch C copies show a 17:08 CT rewrite (PASS, 0 fails, same paths), likely from an earlier Vale verification run. My final check ran on scratch copies. No package content was changed.

---

# Vale — batch C r2 re-audit (2026-10-08, ~17:30 CT)

Scope as requested:
- puttanesca: A, J
- cottage pie: A, J, N
- cashew chicken: A, J, K, L1, L2, O
- fish cakes: A, J, K, L1, L2, M, O
- scallops: D, O
- sabich: note-only change confirmation

Pozole and tomato soup are byte-identical to freeze-r1 and were not re-audited; their r1 PASS stands.

Method:
- Byte- and JSON-diffed every package against Vale's r1 scratch copies.
- Ran Freeze Integrity on scratch copies: PASS with 0 fails on all 8.
- Recomputed culinary_hash from batch_c_recipes.py: matches all 8.
- Recomputed D-03 with the corrected builder: matches the v1 labels on all 8.
- Checked every image with Pillow: file hashes, 1200x900 / 640x480, RGB.
- Inspected the new master and card WebPs and zoomed the 1280x720 sources.

r1 audits are kept as `VALE-AUDIT-<slug>-r1.json`. `VALE-AUDIT-<slug>.json` is now r2 and carries a `history` entry plus the `r2_rescored_gates` list.

## r2 results — overall 6 PASS / 2 FAIL (records only)

| slug | revision | r2 verdict | notes |
|---|---|---|---|
| spaghetti-puttanesca | freeze-r2 | **PASS** | A, J ✓ — moderate 3 / standard 2 [1,1,0,0] |
| cottage-pie | freeze-r2 | **PASS** | A, J ✓ — standard 2 [2,0,0,0]; N ✓ — ratio["1"] 0.5 matches the note |
| seared-scallops-parsnip-puree | freeze-r2 | **PASS** | D ✓ — 145 F fully-cooked sentence in steps[4].body and doneness; O ✓ — hash 737ef601… recomputed |
| sabich-pita-sandwiches | freeze-r1 | **PASS** | note-only confirmed: v1/images byte-identical; README and d03 rationale only |
| cashew-chicken-stir-fry | freeze-r2 | **FAIL** | A, J, K, L1, L2 ✓; **O ✗** |
| thai-fish-cakes-cucumber-relish | freeze-r2 | **FAIL** | A, J, K, L1, L2, M ✓; **O ✗** |
| mushroom-hominy-pozole-rojo | freeze-r1 | PASS (r1 stands) | — |
| tomato-soup-grilled-cheese | freeze-r1 | PASS (r1 stands) | — |

## Image rulings
- **Cashew chicken K PASS.**
  - Bite-size chicken pieces with no cutlets, strips or grill marks.
  - Whole curved cashews are the only nuts; no peanut, chickpea or nugget look-alikes.
  - Pepper, celery, onion, scallion, glossy brown sauce and rice in the same bowl are all present.
  - L1 and L2 PASS.
- **Fish cakes K PASS.**
  - The cut interior is opaque, matte, pale tan and reads as cooked; it is not pink or salmon. Cora's tan wording is correct for 3 tbsp red curry paste and the "curry-red" description.
  - True green-bean rings with seeds; no peas.
  - Glossy reddish-golden skin with no crumb coating, clearly better than attempt3.
  - Non-blocking notes:
    - The cakes read about 3/4–1 inch thick and evenly round, against the recipe's 1/2 inch.
    - The interior is slightly granular.
    - The edges are not lacy.
- **Crop flag (L1/L2): PASS.** The 4:3 crop clips the relish bowl's left rim (about 5%) and the plate rims. The relish stays legible and the cakes are not cropped, the same treatment as batch B lahmacun.

## Remaining defects and exact fixes (records only; no image regen, no culinary change)

**cashew-chicken-stir-fry — O.** The hero has been regenerated and frozen, but the records still say it is pending.
1. In batch_c_recipes.py `revision_note` (renders to v1.json `.revision_note` and README line 24), replace "Awaiting Cora's regenerated hero." with "Cora regenerated the hero at freeze-r3 from the exact prompt in image-prompt.md (GenerateImage), then ran prepare/finalize; FREEZE_INTEGRITY PASS."
2. In rejected/REJECTIONS.md attempt1, replace "…revised at freeze-r2; awaiting Cora's regeneration." with "…revised at freeze-r2; superseded by Cora's regenerated hero (active img_v1.jpg, sha256 d8f3e026…)."
3. Set package_revision freeze-r2 → freeze-r3, run `batch_c_build.py finalize cashew-chicken-stir-fry` and require FREEZE_INTEGRITY PASS. Images, culinary_hash and labels must stay unchanged.

**thai-fish-cakes-cucumber-relish — O.** The prompt and rejection record does not match what happened.
1. In batch_c_recipes.py `rejected_assets`, append `{"attempt": 3, "files": ["rejected/attempt3-surface-reads-crumb-coated.jpg"], "stage": "Cora pre-screen at freeze-r2, never finalized", "reason": "Interior colour acceptable, but the surface read as breaded/crumb-coated and the cakes as perfect discs; exact-prompt surface wording rewritten before the next generation."}`. Today v1.json image.rejected_assets and rejected_assets_note list only attempts 1–2.
2. Update `prompt_revision_note` (the Revision header in image-prompt.md and image-plating-brief.md) and `image_revision_note` (v1 image.generation.revision_note).
   - Replace "smooth, golden-brown, blistered…" with the wording actually used: "a sleek, glossy, deep reddish-golden-brown pan-fried skin with soft bumps, a few shallow blisters and irregular frilly edges; no breadcrumbs, panko, batter, crumb coating, or grainy/sandy crust".
   - Replace "Attempts 1 … and 2 … are in rejected/." with "Attempts 1 (crumb-coated), 2 (r1 active hero) and 3 (freeze-r2 pre-screen, crumb-like surface) are in rejected/."
3. In `revision_note` (v1 `.revision_note` and README line 24), replace "Awaiting Cora's regenerated hero." with "Cora regenerated the hero at freeze-r2: attempt3 was rejected at pre-screen (surface read as crumb-coated) and the exact prompt's surface wording was rewritten (tod mun pla, sleek glossy reddish-golden skin, irregular frilly edges); the next generation, verbatim from image-prompt.md, is the active hero; prepare/finalize, FREEZE_INTEGRITY PASS."
4. In REJECTIONS.md:
   - attempt2: change "…awaiting Cora's regeneration." to "…superseded (see attempt3 and the active hero)."
   - attempt3: change the timestamp "~17:20 CT" to "~17:18 CT" (the file mtime is 17:18:18 CDT).
5. Set package_revision → freeze-r3, run `finalize` and require FREEZE_INTEGRITY PASS. Images, culinary_hash and labels must stay unchanged.

Vale r3 for these two will re-check O plus the image and culinary hashes only.

## Non-blocking (r2)
- Cottage pie scaling_notes["1"] shows internal wording to users: "(…shopping ratio is 0.5, not 0.25)". Reword at the next re-freeze.
- Scallops: the fully cooked path adds up to about 2 min per sear batch (about 51 min total, still 45+).
- Sabich: sidecar factor tidy (11 counted, score 3, specialty ["tahini"]) and closed-set reason codes are deferred. The HH001 sesame confirmation is still open.
- Cashew chicken: slightly more sauce than "no pooling". The hoisin "label lists no peanuts" line is still not added.
- BATCH-C-STATUS.md is stale:
  - The revision bullets for cashew chicken and fish cakes still say "Awaiting Cora's regenerated hero".
  - "Image regeneration (Cora)" is empty.
  - "Flags" still says ivory-white.
  - The sabich row shows complexity (2) against the corrected 3.
  - Update it with the freeze-r3 re-render.

## Release handoff (r2)
- **Certify-ready:**
  - freeze-r2: puttanesca, cottage pie, scallops
  - freeze-r1: pozole, sabich, tomato soup
- Sabich HH001 publication depends on the household's sesame confirmation.
- Cashew chicken and fish cakes are blocked only by the records-only O fixes above. Their images and classifications are accepted.
- Importer items are unchanged from r1:
  - explicit provenance and allergen mapping
  - keep egg/soy/wheat/sesame
  - cashew without generic nuts
  - alias batch B's sourcing_difficulty to pantry_familiarity

---

# Vale — batch C r3 re-check (2026-10-08, ~17:30 CT): Gate O + hashes, cashew chicken and fish cakes only

| slug | revision | r3 verdict |
|---|---|---|
| cashew-chicken-stir-fry | freeze-r3 | **PASS**: O ✓, hashes ✓ |
| thai-fish-cakes-cucumber-relish | freeze-r3 | **PASS**: O ✓, hashes ✓ |

- **Hashes.**
  - img_v1.jpg and both WebPs are byte-identical to r2 for both slugs; file_hashes, asset_sha256 and image-state.json all match.
  - culinary_hash recomputes and is unchanged: cashew chicken 80aeaa5a…, fish cakes ecb6c0dd….
  - D-03 labels are unchanged: moderate/standard and involved/standard.
  - Vale re-ran Freeze Integrity on scratch copies: PASS, 0 fails.
  - The other 6 batch C packages are byte-identical to the r2 copies.
- **Juniper's three changes from Vale's fix text are accepted.**
  - Fish cakes: the revision notes quote the exact prompt verbatim, which is more faithful than Vale's paraphrase. The Exact prompt block is byte-identical.
  - Cashew chicken: the note says the hero was regenerated "at freeze-r2" and relabeled freeze-r3. This corrects Vale's "freeze-r3" wording, which was inaccurate.
  - Fish cakes: the attempt3 line in REJECTIONS.md is normalized to the attemptN format.
- **Records.**
  - Fish cakes: image.rejected_assets lists attempts 1–3, and all the files are present.
  - No "awaiting" language remains in v1.json, README or REJECTIONS.md for either slug.
- **Batch C final: all 8 PASS.**
  - freeze-r3: cashew chicken, fish cakes
  - freeze-r2: puttanesca, cottage pie, scallops
  - freeze-r1: pozole, sabich, tomato soup
- **Handoff notes still open:**
  - Sabich HH001 publication depends on the household's sesame confirmation.
  - Importer: explicit provenance and allergen mapping; keep egg, soy, wheat and sesame; cashew without generic nuts; alias sourcing_difficulty → pantry_familiarity.
  - BATCH-C-STATUS.md has been refreshed through freeze-r3; it only needs the r3 PASS recorded.
  - Non-blocking notes from r1 and r2 remain in the audit files.
