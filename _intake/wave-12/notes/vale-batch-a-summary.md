# Wave-12 Batch A — Vale audit r1 — 2026-10-08 (CT)

Auditor: Vale (Harbor Eats - Catalog Auditor), independent of the creators (Juniper text/brief/classification, Cora images). Scope: 9 frozen packages at `freeze-r1`. All 9 have `FREEZE_INTEGRITY: PASS`, and Vale's own re-run on /tmp copies also PASSed. Gates A–O are checked, with K / L1 / L2 reported separately and D-03 checked under A and J.

The standard is binary PASS/FAIL, so no package gets "PASS WITH NOTES" for publication; non-blocking notes are listed separately. This is a gate result only. Nothing is published, released, or kitchen-tested (`kitchen_tested` is false). Vale did not edit any creator file. `render_batch_a.py --check` was run with `-B` (read-only), and it plus the source-vs-rendered diff show the source and the rendered packages in sync.

**Result: 7 PASS / 2 FAIL.**

| slug | overall | failed gates | K | L1 | L2 | D-03 (effort / complexity) | HH001 (intent → claim) |
|---|---|---|---|---|---|---|---|
| sheet-pan-gnocchi-brussels-apples | **PASS** | — | PASS | PASS | PASS | easy / simple | eligible → true ✔ |
| miso-mushroom-ramen | **PASS** | — | PASS | PASS | PASS | moderate / standard | eligible → true ✔ |
| brazilian-fish-moqueca | **PASS** | — | PASS | PASS | PASS | moderate / standard | eligible → true ✔ |
| vegetable-biryani-cashews | **PASS** | — | PASS | PASS | PASS | involved / standard | eligible → true ✔ |
| filipino-chicken-adobo | **PASS** | — | PASS | PASS | PASS | moderate / simple | not → false ✔ |
| classic-smash-burgers | **FAIL** | G | PASS | PASS | PASS | moderate / simple | not → false ✔ |
| peruvian-lomo-saltado | **FAIL** | K | FAIL | PASS | PASS | involved / adventurous | not → false ✔ |
| chicken-enchiladas-verdes | **PASS** | — | PASS | PASS | PASS | moderate / standard | not → false ✔ |
| baked-ziti-italian-sausage | **PASS** | — | PASS | PASS | PASS | moderate / simple | not → false ✔ |

Per-package files follow the naming Batch B used for this wave, `wave-12/candidates/<slug>/VALE-AUDIT-<slug>.json`, which mirrors the wave-11 `VALE-AUDIT-<slug>.json` pattern.

## FAILs: exact defects and minimal fixes

### classic-smash-burgers: G FAIL (text amendment on v1; no image change)
- **Defect:** soy, a major allergen, appears only in notes. The commercial sesame buns are an uncontracted compound ingredient that typically contains soy (soy flour, soybean oil or soy lecithin). The package acknowledges this in `ingredients[sesame-buns].note` ("check labels if soy matters") and in `allergen_notes[4]` ("Commercial buns may contain soy; ... not tokenized - households with soy allergy should check bun labels"), but `recipe_version.allergens` has no `soy`. The binding lesson "Notes-only allergens → FAIL" applies here, and so does the rule against conditional claims.
- **Fix, option A (recommended):**
  - In `batch-a-tools/recipes_part3.py`, line 188, change `allergens` from `["meat","milk","egg","wheat","sesame"]` to `["meat","milk","egg","wheat","sesame","soy"]`.
  - Line 194, `allergen_notes[4]`: change it to "Mustard (yellow mustard) is present; not a US major allergen and has no runtime token. Soy is tokenized because commercial sesame hamburger buns typically contain soy (soy flour, soybean oil, or soy lecithin)."
  - Line 132, bun note: change it to "contain wheat and sesame; commercial buns commonly also contain milk, egg, and soy, all declared in allergens".
- **Fix, option B:** contract a soy-free bun ("REQUIRED: label lists no soy") and state the exclusion in `allergen_notes`. This is harder to shop for and not recommended.
- **Process:**
  1. Run `render_batch_a.py --finalize classic-smash-burgers` at **freeze-r2** for this slug only. `REV` is a global at line 43, so use a per-slug override and leave the 7 passing packages at freeze-r1.
  2. Run Freeze Integrity, which must PASS.
  3. Vale re-checks G, plus A, N and O for consistency. The image is unchanged.

### peruvian-lomo-saltado: K FAIL (image regeneration only; no culinary, version or classification change)
- **Defect:**
  1. Most sirloin pieces carry regular parallel **grill-mark/char stripes**, which read as grilled steak. The recipe sears the beef in a smoking-hot skillet and tosses it (saltado), and the image spec requires the actual sear treatment to show.
  2. The brief's Required item "fries, **some folded in** and some alongside" and the description's "folded with crisp oven fries" are not met. All the fries sit in a separate pile behind the beef.
  3. Minor: one tomato wedge still shows its seeds, though the recipe scoops them out.
  - L2 is strong, so keep the light and composition.
- **Fix:**
  1. Move the active hero to `rejected/attempt1-beef-grill-marks-fries-not-folded.jpg` and list it in `image.rejected_assets`.
  2. In `recipes_part4.py`, lines 114–118 (the prompt):
     - Replace the beef clause with "bite-size beef sirloin strips pan-seared in a smoking-hot wok, with an even deep-brown seared crust and no grill marks or char stripes (juicy, pink just visible inside a cut edge)".
     - Replace the fries clause with "about a third of the golden, crisp straight-cut French fries tossed right into the stir-fry, glossed with the amber pan sauce and mingled with the beef, onion and tomato, the rest piled alongside".
     - Add the negatives "no grill marks, no char stripes, no sliced grilled steak, no tomato seeds".
  3. Add matching levers at line 119 (`regen_levers`).
  4. Leave the brief alone. It already requires seared strips and fries folded in.
  5. Regenerate, run `export_meal_webps.py`, then run `--finalize` at **freeze-r2** for this slug only.
  6. Freeze Integrity must PASS. Vale then re-audits K, L1 and L2, plus M and O.

## Creator-flagged items, ruled
- **Effort labels that changed from the plan are all accepted, and all are rubric-faithful:**
  - Adobo, easy → moderate (score 4): the attended garlic chips, the sear and the spoon-basted glaze each score 1, and the braise is correctly not counted. Cider-braised pork (4) is the precedent.
  - Smash burgers, easy → moderate (score 5): floor rule 1 applies, because continuous batch smashing combines with other factors.
  - Lomo, moderate → involved (score 7): continuous stir-fry plus three converging components. Even under the batch's own set-and-forget convention it still scores 6, which is involved. It is borderline, but it holds.
- **Close calls, all accepted:**
  - Gnocchi easy/simple: exactly 8 countable items (the ≤8 band) plus one contracted specialty, for a sum of 1.
  - Ziti simple (1): seasoning the ricotta isn't a second build.
  - Biryani involved (8): floor rule 2 (technique 2 + prep) also applies. The 70-minute clock is not the driver.
  - Lomo adventurous (4): ají amarillo paste is a single specialty-store-likely item with no substitute (scored 2), on a par with Thai basil and Scotch bonnet. That is sourcing, not cultural bias.
- **No legacy fields:** no package authors legacy `effort`, `effort_band` or `complexity`.
- **Ramen:** fully plant-based through hard contracts: plain miso without dashi or bonito, egg-free kansui noodles, instant seasoning packets discarded, and no egg, butter or animal broth. HH001 passes. (Bonito would have been allowed as fish, but the plant claim is the stricter, correct choice.) Allergens are soy, wheat and sesame.
- **Moqueca without dendê:** accepted. The description discloses it ("made with olive oil instead of dende"), and paprika supplies the color. Fish only, with a no-shellfish contract, coconut milk not treated as a tree nut, and fish cooked to 145 F.
- **Smash burgers at 31 min:** Gate E passes because the time rebuilds honestly from the steps (10 + 4 + 3 + 12 + 2). The selection band was "Under 30", so Under-30 filters will drop it (release note).
- **Complexity factor key: `pantry_familiarity` is canonical.**
  - It's the key in all 50 Vale-audited D-03 classifications (`d03-design/all-50-classifications.json` and `JUNIPER-CLASSIFICATION-BATCH.json`). Those files say it is "v1's field for the rubric's 'sourcing difficulty' factor", kept at 0 because specialty-store sourcing is scored once under `specialty_burden`.
  - `sourcing_difficulty` appears in **no** prior audited artifact. It is only the prose name in DESIGN-DRAFT.md.
  - Batch A and **Batch C** already use `pantry_familiarity`. C's `batch_c_build.py` and all 8 C sidecars use it, so **C needs no change**.
  - **Batch B (all 8) must rename** `complexity_factors.sourcing_difficulty` → `pantry_familiarity`:
    1. Edit `notes/batch-b/build_batch_b.py` line 59 `CPLX_KEYS`, and `complexity_factors` in each `notes/batch-b/r_*.py`.
    2. Re-render the 8 `d03-classification.json` sidecars.
  - Every B value is 0, so no score or label changes. This is a classification-sidecar-only metadata amendment: no culinary version, no K/L rerun, and B's `culinary_hash` should be unaffected because it excludes D-03.
- **Allergen enum vs the live app:**
  - The factory package vocabulary (the wave-11 certified packages) is egg, milk, soy, wheat, sesame, peanut, tree_nut, shellfish, finfish, meat and poultry. Batch A adds `cashew`, which is also a live token. The biryani's `tree_nut` + `cashew` pairing matches the package skill ("tree_nut (or specific tree nuts)") and Batch B's Vietnamese fish.
  - Live `PACKAGE_ALLERGEN_IDS` (`harbor-eats-app/src/lib/recipe-package-integrity.js`) contains only dairy, nuts, cashew, walnut, peanut, almond, pecan, hazelnut, pistachio, macadamia, pine_nut, shellfish, finfish, poultry and meat.
  - Batch A tokens the live enum doesn't support:
    - **wheat**: gnocchi, ramen, adobo, lomo, burgers, ziti
    - **soy**: ramen, adobo, lomo, and burgers after the fix
    - **sesame**: ramen, burgers
    - **milk**: burgers, enchiladas, ziti
    - **egg**: burgers
    - **tree_nut**: biryani
  - All are documented in `runtime_enum_gaps`. Under the package skill and wave-11 precedent this isn't a gate fail.

## Batch-level hygiene, required before release (not a package gate fail)
- `wave-12/candidates/BATCH-A-STATUS.md` still says "text complete; awaiting Cora GenerateImage. Not frozen. Freeze Integrity not run. Vale not started." That contradicts the frozen state, the present WebPs and Freeze Integrity PASS.
  - Scrub it to the freeze-r1/r2 state, as wave-11 r3 did ("BATCH status files scrubbed").
  - Optionally mark `batch-a-tools/CORA-HANDOFF.md` as historical (pre-freeze).

## Carry to release handoff (non-blocking)
1. **Allergen import blocker.** `cycle2-catalog.js:80` rejects unknown allergens.
   - Before integration, either extend `PACKAGE_ALLERGEN_IDS` (egg, milk/dairy, wheat, soy, sesame, tree_nut) or define an explicit importer mapping. Live precedent `cashew-pesto-pasta` v2 uses `["cashew","nuts","wheat"]`, which is tree_nut → nuts with cashew kept.
   - Never silently drop egg, wheat, soy or sesame.
   - The live catalog already mixes `milk` (5) and `dairy` (4); pick one.
2. **Dietary labels.** Live `PACKAGE_DIETARY_LABELS` = plant, dairy_free, fish.
   - Packages use `vegetarian` and `plant_based` (as wave-11 did), so map plant_based → plant.
   - Decide whether moqueca also gets `fish`.
3. **Other enum gaps.** Provenance `original_ai_assisted` → live `ai_assisted`, and `Draft` → `draft`. Both are documented gaps.
4. **No `culinary_hash`.** Batch A packages have none; wave-11 had none either, while B and C do. Add a culinary_hash that excludes D-03 at the next re-freeze, so future classification-only amendments are hash-safe.
5. **Time filters.** Burgers at 31 min miss the "Under 30" band. Biryani (70), adobo (64), enchiladas (62) and ziti (62) are all 45+, as selected.
6. **Doneness.**
   - Lomo serves whole-muscle sirloin at about medium (pink), which is accepted. Consider an optional 145 F + rest line.
   - Ziti sausage doneness says "no pink"; adding 160 F would be tidier, though the simmer and bake make it safe.
7. **Images.**
   - Gnocchi are drawn large and blocky but read as ridged gnocchi. The rejected tofu-cube attempt is correctly retired.
   - The biryani cauliflower now reads as cauliflower. The rejected fritter attempt is correctly retired.
   - Enchilada tortillas could pass for flour, but they're mostly sauced over.
   - All masters are 960×720 center crops upscaled 1.25×, the same as wave-11 and Batch B.
8. **Gnocchi crowding.** The gnocchi pan carries about 2.2 lb gnocchi + 1 lb apples on one half-sheet, roughly 70% coverage. That's feasible but tight; a future v2 could move the apples to the sprout pan.
9. **Selection expected-allergens extended correctly.** Adobo, enchiladas and lomo add poultry/meat; burgers adds meat (and soy after the fix); biryani is tree_nut + cashew.

## Next
1. Cora applies the two fix sets and re-freezes those two slugs to `freeze-r2`, and Freeze Integrity must PASS.
2. Vale then re-audits:
   - **classic-smash-burgers**: G, plus A, N and O.
   - **peruvian-lomo-saltado**: K, L1 and L2, plus M and O.
3. The 7 PASS packages aren't reopened unless they change.
4. Batch B applies the `pantry_familiarity` rename as a sidecar-only amendment.

Files: `wave-12/candidates/<slug>/VALE-AUDIT-<slug>.json` (9), plus this summary.

---

## r2 re-audit (2026-10-08, 17:14 CT)

Scope: the two r1 FAILs, both re-frozen at `freeze-r2`. Vale re-ran Freeze Integrity on /tmp copies (both PASS, 0 fails) and recomputed both culinary_hashes independently from v1.json (both match). Every changed field was diffed against the freeze-r1 copies. The 7 r1 PASS packages were not reopened. No creator file was edited.

| slug | r1 | r2 | failed gates |
|---|---|---|---|
| `classic-smash-burgers` | FAIL (G) | **PASS** -> CERTIFY_V1 | none |
| `peruvian-lomo-saltado` | FAIL (K) | **FAIL** -> regenerate at freeze-r3 | K, O |

**Batch A after r2: 8 PASS / 1 FAIL.**

### classic-smash-burgers: PASS
- **G:** allergens are now `meat, milk, egg, wheat, sesame, soy`. allergen_notes[4], the bun note and dietary_label_note all declare soy (buns), and no notes-only major allergen remains.
- **A:** the D-03 enums are unchanged.
- **N:** the shopping list is unchanged.
- **O:**
  - The text amendment keeps version_number 1, with revision notes on both root and recipe_version.
  - culinary_hash `sha256:af82dfee…278c3` verifies.
  - The images are byte-identical to r1, so K/L1/L2 carry over.

### peruvian-lomo-saltado: FAIL (K, O)
I inspected the master, the 640 card, and 3x crops of img_v1.jpg. L1 PASS (dims, hashes, crop fixed, plate rim inside the frame) and L2 PASS (strong; keep the composition).

- **Cleared from r1:** about a third of the fries are now folded into the stir-fry and glossed with sauce, the rest are alongside, and there are no parallel char stripes.
- **K defect 1 (beef):** almost every strip shows a regular crosshatch/diamond lattice. It reads as scored or crosshatch-grilled steak, not an even deep-brown wok sear, and it is still legible on the card. The recipe never scores the meat, so this is the r1 grill-mark defect in a new form.
- **K defect 2 (tomatoes):** the right-front tomato wedge clearly shows seeds and gel (the left one shows a gel locule). The recipe says "seeds scooped out", and the prompt says "no tomato seeds". This persisted through an explicit prompt fix.
- **O defect:**
  - The active hero was generated from Juniper's prompt plus three Cora additions (smaller centred plate, whole-muscle sirloin with no ground-meat texture, seeded-out tomatoes). The exact text is recorded nowhere.
  - image-prompt.md and recipes_part4.py hold only Juniper's text, so `image.generation.prompt_file` misstates the active image's prompt.
  - rejected/ has no REJECTIONS.md (Batch B niçoise precedent).

**Fixes (exact text is in `required_fixes` in the audit JSON):**
1. Retire the active hero with `render_batch_a.py --retire peruvian-lomo-saltado --as attempt3-beef-crosshatch-scored-tomato-seeds`.
2. **recipes_part4.py line 115:**
   - beef: "bite-size strips of sliced whole-muscle beef sirloin (smooth meat, no ground-meat texture) pan-seared in a smoking-hot wok, each with a smooth, naturally uneven deep-brown caramelized sear and no scoring, crosshatch, diamond pattern, grill marks or char stripes…";
   - tomatoes: "…juicy red Roma tomato wedges holding their shape, seeds and seed gel fully scooped out so only smooth firm red flesh shows".
   - Keep the rest of the line.
3. **Line 117:** "Keep the plate slightly smaller and centred, with the whole plate rim within the central 75% of the frame width…". This records Cora's addition.
4. **Line 118:** the negatives lead with "No crosshatch or diamond scoring on the beef, no grill marks, no char stripes, no sliced grilled steak, no ground-meat texture, no tomato seeds or seed gel, …".
5. **Line 119:** add levers for the crosshatch beef and for tomato seeds/gel.
6. Re-render **before** generating, and generate from the image-prompt.md "Exact prompt" block verbatim. Make no ad-hoc additions; any wording change goes into recipes_part4.py and is re-rendered first.
7. Add `rejected/REJECTIONS.md` with attempt1, attempt2, and attempt3. Attempt3's entry records its prompt as "freeze-r2 text + Cora's three additions; exact text not recorded".
8. In `SLUG_REVISIONS["peruvian-lomo-saltado"]`, set package_revision to **freeze-r3** with a new revision_note and updated prompt/image notes. culinary_hash must stay `sha256:776350ee…`.
9. Export, run `--finalize`, Freeze Integrity PASS, then Vale r3 on K, L1, L2, M, O.

### Hygiene
- `candidates/BATCH-A-STATUS.md` (Juniper, 17:10 CT) still lists lomo as "freeze-r2 (pending image)", with Freeze Integrity "not run". Cora's 17:11–17:12 CT finalize superseded it. Update the burgers row (r2 PASS) and the lomo row (r2 FAIL K/O, freeze-r3 pending).
- A process re-ran Freeze Integrity across all candidates at 17:08 CT. The Batch A r1 PASS packages are still PASS with unchanged v1/images.

Files updated: `candidates/classic-smash-burgers/VALE-AUDIT-classic-smash-burgers.json` and `candidates/peruvian-lomo-saltado/VALE-AUDIT-peruvian-lomo-saltado.json`. Both are r2 at top level, with the full r1 audit kept in `history[0]`.

---

## r3 re-audit + Batch A integrity check (2026-10-08, 17:20 CT)

### peruvian-lomo-saltado (freeze-r3): FAIL (O only; metadata fix, no regeneration)
Checked on the master, the 640 card, the full img_v1.jpg and 3-4x crops. I re-ran Freeze Integrity on a /tmp copy: PASS, 0 fails. culinary_hash `776350ee…` is unchanged and verifies, and the culinary fields and D-03 values match the r2 snapshot exactly. Asset sha256s verify, and both WebPs are a clean 4:3 crop of img_v1.jpg.

| gate | r3 | finding |
|---|---|---|
| K | PASS | No scored, crosshatched or grill-striped beef; no tomato seeds or gel (wedges skin side up); fries partly folded in, the rest alongside; rice dome, onion, cilantro and thin pan juices present; nothing forbidden. Reads as lomo saltado. |
| L1 | PASS | 1200×900 / 640×480; hashes match; plate rim fully inside the crop; no artifacts. |
| L2 | PASS | Bright, glossy, high-contrast, appetizing at card size. |
| M | PASS | The image-prompt.md exact block equals `RECIPES[…]['prompt']`, and the levers match too (checked programmatically). The block matches the active image. Date 2026-10-08, model unknown. Plating brief byte-identical. |
| O | **FAIL** | The revision metadata still describes the superseded first freeze-r3 prompt (the attempt4 prompt). See the defects below. |

**O defects:**
- `image.generation.revision_note` says the tomato wedges "show only smooth seeded-out flesh" (the image shows them skin side up) and "Attempts 1-3".
- `image-prompt.md` line 5 "Revision (freeze-r3)" describes the caramelized-sear / 75% / no-crosshatch prompt, not the block beneath it.
- The root and README revision notes say "REJECTIONS.md logs attempts 1-3".
- `rejected_assets_note` omits attempt4.
- The REJECTIONS.md attempt4 entry breaks the one-line `attemptN (…)` format, and the prompt it claims was used verbatim is no longer recorded anywhere.

**Fix (exact text is in the lomo audit JSON `required_fixes`):**
- In `render_batch_a.py` `SLUG_REVISIONS["peruvian-lomo-saltado"]`:
  - set package_revision to `freeze-r4`;
  - rewrite revision_note, prompt_revision_note, image_revision_note and rejected_assets_note to describe the actual active prompt and attempts 1-4.
- Rewrite the REJECTIONS.md attempt4 line.
- Re-render this slug only with `--finalize peruvian-lomo-saltado --generation-date 2026-10-08 --model unknown`. **Do not run `--render-pending`**, and do not touch the shared call-notes template (line 566), because both would change the 8 certified packages.
- Freeze Integrity must PASS. Then Vale r4 checks O plus unchanged image bytes and culinary_hash; K, L1, L2 and M carry over.

**Non-blocking:**
- The active prompt departs from the unchanged plating brief:
  - "like teriyaki beef" / "dark mahogany" vs "light glossy amber pan sauce";
  - "thin" strips vs 1/2-inch strips;
  - "medium round plate" vs "wide dinner plate";
  - the brief-required pink cut edge is dropped.

  The image still passes K, because the dark coat is still a plausible soy glaze and nothing contradicts the pink-inside doneness. Re-derive the prompt from recipe + brief before any future regeneration, or have Juniper amend the brief.
- The skin-up wedges at the back could read as red pepper strips; the front wedges are clearly tomato.

### Integrity check of the other 8 Batch A packages after the accidental `--render-pending`
Method: Vale kept byte snapshots made during the audits:
- `/tmp/vale/fi/<slug>`: all 9 packages at freeze-r1, copied 17:05 CT, which is the exact file set audited in r1;
- `/tmp/vale/r2fi/classic-smash-burgers`: the freeze-r2 set audited in r2.

`diff -rq` of each restored package against its snapshot covered v1.json, README.md, d03-classification.json, image-plating-brief.md, image-prompt.md, img_v1.jpg, both WebPs and rejected/. It excluded only FREEZE_INTEGRITY.json and the VALE-AUDIT files.

**Result: zero differences for all 8 packages. Every file is byte-identical to what Vale certified.**

Values were also cross-checked against the VALE-AUDIT records:
- package_revision: freeze-r1 ×7, freeze-r2 for burgers;
- effort/complexity and allergens unchanged;
- generation_date 2026-10-08 and model unknown;
- image.sha256 matches on-disk files;
- burgers culinary_hash `af82dfee…` unchanged;
- Freeze Integrity PASS (0 fails) on all 8.

| slug | content vs audited set | verdict stands |
|---|---|---|
| sheet-pan-gnocchi-brussels-apples | identical | PASS (r1) |
| miso-mushroom-ramen | identical | PASS (r1) |
| brazilian-fish-moqueca | identical | PASS (r1) |
| vegetable-biryani-cashews | identical | PASS (r1) |
| filipino-chicken-adobo | identical | PASS (r1) |
| chicken-enchiladas-verdes | identical | PASS (r1) |
| baked-ziti-italian-sausage | identical | PASS (r1) |
| classic-smash-burgers | identical to r2 set | PASS (r2) |

No package is failed for drift.

The only side effect is filesystem mtimes: the image-plating-brief.md, d03, README, prompt and v1 files now carry 17:16 CT mtimes. The r1 M-gate evidence that each brief predated its image (16:53 vs 16:59 CT) is therefore preserved only in the r1 audit notes, not on disk. Content is unaffected.

**Process recommendation:** add a guard so `--render-pending` skips any slug with an active img_v1.jpg, or requires explicit slugs.

### Status
- Batch A after r3: **8 PASS / 1 FAIL** (lomo: O only, metadata-only fix at freeze-r4).
- `BATCH-A-STATUS.md` (17:15 CT) still shows lomo as "freeze-r3 (pending image)", with Freeze Integrity not run. Update the row to "freeze-r3 hero finalized; Vale r3 K/L1/L2/M PASS, O FAIL; freeze-r4 metadata fix pending".

Files: `candidates/peruvian-lomo-saltado/VALE-AUDIT-peruvian-lomo-saltado.json` is now r3, with `history` = [r1, r2]. No other VALE-AUDIT file was changed.

**r4 (2026-10-08, 17:24 CT):** peruvian-lomo-saltado freeze-r4 is **PASS on O, so the package is PASS (CERTIFY_V1)**. Every note matches the r3 required text; REJECTIONS.md has 4 conforming entries with a verbatim attempt4 prompt; Freeze Integrity is PASS; images are byte-identical (d81b4325… / 8c086ddb… / 16fae237…); culinary_hash 776350ee… is unchanged. K, L1, L2 and M carry from r3. The other 8 packages show no drift:
- Content files were last written 17:16:45–46 CT, before Vale's 17:17 CT byte comparison against its own snapshots.
- Current sha256 of all 74 files matches Juniper's 17:20 CT r4_before and r4_after manifests.
- Burgers was re-diffed against Vale's surviving r2 snapshot.
- Freeze Integrity is PASS on all 8.
- Note: Vale's /tmp/vale/fi r1 snapshot was deleted by another process at about 17:21 CT.

**Batch A final: 9/9 PASS.**
