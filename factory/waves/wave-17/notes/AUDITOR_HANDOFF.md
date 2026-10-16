# Wave-17 auditor handoff

This handoff is for an independent audit, against certification gates A–O, of the 50 wave-17 candidate packages in `/workspace/flavorweave-catalog-factory/wave-17/candidates/`.

**Nothing in this wave is certified.** Nothing has been imported, published, or deployed. D1 has not been touched, and no pull request exists. Every package has `certification: null`, `auditor: null`, and `kitchen_tested: false`. Audit verdicts and any certification belong to the auditor.

## What is being handed over

- **The packages.** 50 dinner packages at `package_revision` `author-r2`, with `structural_qa_state` `author_r2_preflight_pass_awaiting_vale` (the pipeline's standard post-preflight state). Together they would take the live catalog from 200 to 250 meals.
- **Contents of each package:**
  - `v1.json`, `d03-classification.json`, `README.md`
  - `image-plating-brief.md`, `image-prompt.md`, `image-state.json`
  - the GenerateImage source `img_vN.jpg`
  - the `<slug>.webp` master (1200x900) and the `<slug>-640.webp` card (640x480)
  - `STRUCTURAL_PREFLIGHT.json` and `FREEZE_INTEGRITY.json`
  - a `rejected/` folder, for the nine regenerated packages only
- **Wave files:**
  - `README.md`, `WAVE.json`, `coverage.md`, `selection-rationale.md`, `rejected.md`
  - `notes/`: `existing-200.tsv`, `coverage-stats.json`, `wave17-roster.tsv`, `image-gen-map.txt`, `prompts-author-r1.txt`, `prompts-regen-selfreview.txt`, and the preflight and finalize logs
  - `tools/`

| # | Slug | Cuisine | Protein | Total min | Effort / complexity | HH001 | Allergens | Enum gaps | Hero |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `south-indian-sambar-rice` | south-indian | veg | 71 | moderate / standard | yes |  | allergens,classification,cooking,cuisine,dietary_labels,mustard,provenance,publication_state | img_v1.jpg |
| 2 | `vietnamese-lemongrass-tofu-banh-mi` | vietnamese | veg | 41 | moderate / standard | yes | soy,wheat,egg | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 3 | `nigerian-jollof-rice-boiled-eggs` | nigerian | veg | 82 | moderate / simple | yes | egg | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 4 | `japanese-vegetable-omurice` | japanese | veg | 60 | moderate / simple | yes | egg,soy,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 5 | `mexican-rajas-con-crema-tacos` | mexican | veg | 57 | moderate / simple | no | milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 6 | `polish-potato-cheese-pierogi` | polish | veg | 90 | involved / simple | no | wheat,egg,milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 7 | `indo-chinese-gobi-manchurian` | indo-chinese | veg | 44 | involved / standard | yes | soy,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 8 | `greek-fasolakia-green-beans` | greek | veg | 77 | easy / simple | yes |  | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 9 | `chinese-hot-sour-soup-tofu` | chinese | veg | 55 | moderate / simple | yes | soy,wheat,egg,sesame | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 10 | `salvadoran-bean-cheese-pupusas` | salvadoran | veg | 70 | involved / simple | no | milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v3.jpg |
| 11 | `bhutanese-ema-datshi` | bhutanese | veg | 50 | moderate / simple | no | milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |
| 12 | `ecuadorian-locro-de-papa` | ecuadorian | veg | 60 | easy / simple | no | milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 13 | `thai-pad-see-ew-tofu` | thai | veg | 41 | moderate / simple | yes | soy,wheat,egg | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 14 | `jamaican-ital-stew` | jamaican | veg | 64 | easy / simple | yes |  | allergens,classification,coconut,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 15 | `penne-alla-vodka` | italian-american | veg | 38 | moderate / simple | no | wheat,milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 16 | `french-mushroom-bourguignon` | french | veg | 70 | moderate / simple | yes | wheat,soy | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |
| 17 | `persian-ash-reshteh` | persian | veg | 75 | moderate / standard | no | wheat,milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 18 | `vietnamese-ca-kho-catfish` | vietnamese | fish | 41 | moderate / simple | yes | finfish | allergens,classification,coconut,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |
| 19 | `british-kedgeree-smoked-salmon` | british | fish | 48 | moderate / simple | yes | finfish,egg | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 20 | `yucatecan-tikin-xic-fish` | yucatecan | fish | 47 | moderate / standard | yes | finfish | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 21 | `turkish-balik-ekmek-mackerel` | turkish | fish | 31 | moderate / simple | yes | finfish,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 22 | `amritsari-fish-mint-chutney` | punjabi | fish | 54 | involved / standard | yes | finfish | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |
| 23 | `korean-spicy-cod-stew` | korean | fish | 48 | easy / standard | yes | finfish,soy,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 24 | `finnish-lohikeitto-salmon-soup` | finnish | fish | 51 | easy / simple | no | finfish,milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 25 | `indonesian-ikan-bakar-tilapia` | indonesian | fish | 42 | moderate / simple | yes | finfish,soy,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 26 | `greek-shrimp-saganaki` | greek | shellfish | 36 | easy / simple | no | shellfish,milk,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 27 | `san-francisco-cioppino` | californian | shellfish | 60 | moderate / simple | no | shellfish,finfish,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 28 | `crab-louie-salad` | american | shellfish | 40 | easy / simple | no | shellfish,egg | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |
| 29 | `korean-ojingeo-bokkeum-squid` | korean | shellfish | 35 | moderate / standard | no | shellfish,soy,wheat,sesame | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 30 | `galician-pulpo-potatoes` | spanish | shellfish | 38 | easy / simple | no | shellfish | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 31 | `japanese-chicken-nanban` | japanese | poultry | 69 | involved / standard | no | poultry,wheat,egg,soy | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 32 | `chicken-tinga-tostadas` | mexican | poultry | 56 | moderate / simple | no | poultry,milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 33 | `greek-avgolemono-chicken-soup` | greek | poultry | 61 | moderate / simple | no | poultry,egg | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 34 | `georgian-chkmeruli-garlic-chicken` | georgian | poultry | 52 | moderate / simple | no | poultry,milk,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |
| 35 | `moroccan-chicken-preserved-lemon-tagine` | moroccan | poultry | 81 | easy / simple | no | poultry,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 36 | `southern-chicken-and-dumplings` | american | poultry | 69 | moderate / simple | no | poultry,milk,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 37 | `palestinian-musakhan-chicken` | palestinian | poultry | 56 | moderate / simple | no | poultry,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 38 | `ivorian-chicken-kedjenou` | ivorian | poultry | 70 | easy / simple | no | poultry | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 39 | `uzbek-lamb-plov` | uzbek | meat | 146 | moderate / simple | no | meat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 40 | `filipino-pork-menudo` | filipino | meat | 94 | easy / simple | no | meat,soy,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 41 | `taiwanese-lu-rou-fan` | taiwanese | meat | 97 | moderate / simple | no | meat,soy,wheat,egg | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 42 | `sichuan-dan-dan-noodles` | sichuan | meat | 28 | moderate / standard | no | meat,soy,wheat,sesame | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 43 | `uruguayan-chivito-sandwiches` | uruguayan | meat | 44 | moderate / simple | no | meat,milk,egg,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v4.jpg |
| 44 | `argentine-beef-empanadas` | argentine | meat | 89 | moderate / simple | no | meat,wheat,egg | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 45 | `pakistani-lamb-keema-peas` | pakistani | meat | 64 | moderate / simple | no | meat,milk,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 46 | `tex-mex-steak-fajitas` | tex-mex | meat | 50 | moderate / simple | no | meat,wheat,milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 47 | `balkan-cevapi-ajvar` | balkan | meat | 49 | moderate / simple | no | meat,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |
| 48 | `orecchiette-sausage-broccoli-rabe` | italian | meat | 42 | moderate / simple | no | meat,wheat,milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 49 | `lebanese-arayes` | lebanese | meat | 42 | moderate / standard | no | meat,wheat,sesame | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 50 | `swedish-pytt-i-panna` | swedish | meat | 52 | moderate / simple | no | meat,milk,egg | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |

## Required: duplicate check against all 200 live meals

Check each of the 50 against **all 200 live meals** on harbor-eats-app main at 077bd14. Those are the 85 base meals plus waves 14, 15, and 16, listed with cuisine, format, primary ingredient, protein, time, and allergens in `notes/existing-200.tsv`. Also check the 50 against each other.

- **Builder checks already run.** The builder enforces unique slugs and at least two real "Compared with" references per package (`near_duplicate_review` in v1.json). These are mechanical checks; the judgment on whether two meals are near-duplicates is the auditor's.
- **In-wave pairs worth a second look:**
  - salvadoran-bean-cheese-pupusas and mexican-rajas-con-crema-tacos (corn and cheese);
  - greek-avgolemono-chicken-soup and southern-chicken-and-dumplings (chicken in broth);
  - pakistani-lamb-keema-peas, balkan-cevapi-ajvar, and lebanese-arayes (ground meat, two in pita);
  - greek-shrimp-saganaki and san-francisco-cioppino (shrimp in tomato).
- **Live meals with the closest overlap:**
  - french-mushroom-bourguignon against russian-mushroom-stroganoff;
  - chicken-tinga-tostadas against chicken-enchiladas-verdes;
  - moroccan-chicken-preserved-lemon-tagine against moroccan-chermoula-fish-tagine;
  - sichuan-dan-dan-noodles against peanut-noodle-stir-fry;
  - uruguayan-chivito-sandwiches against philly-cheesesteaks.
- **Dropped ideas.** `rejected.md` lists the ideas dropped as too close, including two in-wave swaps made during drafting.

## Flagged facts

1. **Only 1 meal is 30 minutes or less:** sichuan-dan-dan-noodles, at 28 minutes. The live catalog has 24 at that length, so wave-17 does little for quick weeknights. Three meals run over 90 minutes: filipino-pork-menudo (94), taiwanese-lu-rou-fan (97), and uzbek-lamb-plov (146).
2. **17 of 50 are Household 001 (HH001) eligible**, which keeps the catalog at 38% (94 of 250).
   - 10 vegetarian: south-indian-sambar-rice, vietnamese-lemongrass-tofu-banh-mi, nigerian-jollof-rice-boiled-eggs, japanese-vegetable-omurice, indo-chinese-gobi-manchurian, greek-fasolakia-green-beans, chinese-hot-sour-soup-tofu, thai-pad-see-ew-tofu, jamaican-ital-stew, french-mushroom-bourguignon.
   - 7 finfish: vietnamese-ca-kho-catfish, british-kedgeree-smoked-salmon, yucatecan-tikin-xic-fish, turkish-balik-ekmek-mackerel, amritsari-fish-mint-chutney, korean-spicy-cod-stew, indonesian-ikan-bakar-tilapia.
   - No poultry, meat, or shellfish meal is HH001. Check the nut policy and the dairy and shellfish exclusions in each `hh001_contract`.
3. **No peanut dishes.** None of the 50 has the peanut allergen; dan dan uses Chinese sesame paste. The live catalog has 4 peanut dishes.
4. **15 cuisine labels are new to the catalog:** balkan, bhutanese, ecuadorian, finnish, indo-chinese, ivorian, palestinian, punjabi, salvadoran, sichuan, south-indian, tex-mex, uruguayan, uzbek, yucatecan.

## Pre-audit check results (mechanical only, not an audit)

- **Structural preflight:** 50/50 PASS (`notes/structural-r4.log`). Run it with `cd /workspace/harbor-eats-app && node factory/tools/structural_preflight.mjs /workspace/flavorweave-catalog-factory/wave-17/candidates`.
- **Freeze integrity:** 50/50 PASS, 26/26 checks each (`notes/freeze-r4.log`). Run it with `python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py <candidate dir>`.
- **Image hashes.** For all 50, the active source, master, and card sha256 match `image.file_hashes`. All 62 generated images (50 active plus 12 rejected) match `notes/image-gen-map.txt`.
- **Builder guards** in `tools/build_packages.py`:
  - unique slugs and near-duplicate references;
  - pot size against water volume;
  - boil-up minutes inside step clocks;
  - no untimed waits;
  - counted equipment in the scaling notes;
  - description words present as ingredients;
  - step clocks against stated minutes;
  - styling props limited to recipe items and neutral tableware.
- **Builder guards new in wave-17:**
  - oil volume against stated depth for every shallow-fry;
  - pan and sheet-pan fit, using grid packing for rectangles and circle packing for rounds;
  - the app's own title-word allergen matcher (`src/lib/eligibility.js`).
  - The guards also confirm that each author-r1 prompt rebuilds byte for byte from the recipe files, and that each regeneration prompt is exactly the v1 prompt plus one appended correction sentence.
- **Overlap timing.** `tools/overlap_report.py` reports every overlap step inside the steps it runs alongside.

These checks prove structure and consistency only. They do not establish culinary correctness, dietary or allergen correctness, or image fidelity.

## Images

- **How the files were made.** All 50 heroes were generated with Grok Bot GenerateImage at 1280x720. The master and card are 4:3 center crops (960x720) resized with LANCZOS. **The 1200x900 master is a 1.25x upscale of the crop.**
- **41 heroes are v1**, made from the exact prompts in `/workspace/wave17-prompts.txt`.
- **9 are regenerations after a creator self-review**, made before any audit. Each regeneration prompt is the v1 prompt plus one appended "Correction for this version:" sentence.
  - Every version's prompt is recorded word for word in that package's `image-prompt.md` under "Version history", with each rejected version's reason and its file in `rejected/`.
  - The source for the regeneration prompts is `/workspace/wave17-v2-prompts.txt`, copied to `notes/prompts-regen-selfreview.txt`.
  - Each rejected version is recorded under `image.superseded` (`never_finalized: true`).
  - `image-plating-brief.md` was rebuilt to match the accepted prompt: the author-r1 sections plus a "Correction for the accepted version" section.
  - Accepted versions and rejection reasons:
    - `bhutanese-ema-datshi` v2. v1: chile strips read as green beans.
    - `french-mushroom-bourguignon` v2. v1: some pieces read as beef cubes in a vegetarian dish.
    - `vietnamese-ca-kho-catfish` v2. v1: pieces read as glazed chicken cutlets, not flaking fish.
    - `amritsari-fish-mint-chutney` v2. v1: lemon slice on the fish (explicitly excluded).
    - `crab-louie-salad` v2. v1: crab reads as red-streaked imitation crab, not lump crab.
    - `georgian-chkmeruli-garlic-chicken` v2. v1: shows eight thighs, brief says six.
    - `balkan-cevapi-ajvar` v2. v1: grill marks on the sausages (explicitly excluded).
    - `salvadoran-bean-cheese-pupusas` v3. v1: bean filling reads as ground meat. v2: bean filling still reads as ground meat.
    - `uruguayan-chivito-sandwiches` v4. v1: steak reads as a ground-beef burger patty. v2: steak still reads as a thick burger patty. v3: steak fixed but fried egg missing (must-show).

## Points worth the auditor's attention

These are observations to verify, not verdicts.

1. **vietnamese-ca-kho-catfish (v2), recipe and image mismatch to check under gate K.**
   - The accepted correction asks for "thick crosswise steaks of fish ... and a ring of skin", and the hero shows thick skin-edged steaks, about seven pieces.
   - The recipe uses US farm-raised catfish fillets, which are sold skinless, cut into pieces about 2 by 2 1/2 inches. The brief asks for five or six pieces.
2. **bhutanese-ema-datshi (v2).** The correction asks for long halved chiles "with ... a few stems", and the hero shows long halved chiles with stems. The recipe stems the Anaheims and cuts them into 1/2-inch strips.
3. **salvadoran-bean-cheese-pupusas (v3).**
   - The correction specifies smooth refried black beans; the recipe says vegetarian refried beans and does not name the bean.
   - In the hero, the filling still looks somewhat dark and chunky rather than a smooth purée. Check whether it can read as meat.
4. **uruguayan-chivito-sandwiches (v4).**
   - The steak layer looks thicker than the recipe's 1/4 inch, and rosy pink, while the recipe cooks it to 145 F.
   - The egg yolk is runny; the food-safety note covers firmer yolks.
   - The rejected v2 correction mentioned "beef tenderloin", but the recipe uses sirloin. That prompt is kept only as a record.
5. **taiwanese-lu-rou-fan (v1).** The pork reads as fine mince more than 1/2-inch dice with translucent fat.
6. **Gate G, title matcher gaps.** The app's matcher does not tag mackerel, catfish, haddock, squid, octopus, steak, ham, egg, or mozzarella in titles. These are false negatives only: every tag it does raise is true, and stored allergens carry eligibility. Squid and octopus use the `shellfish` token, as in italian-grilled-calamari.
7. **Enum gaps carried as open items.** Coconut (jamaican-ital-stew, vietnamese-ca-kho-catfish) and mustard (south-indian-sambar-rice) have no FlavorWeave allergen token. They are disclosed in `allergen_notes` and `runtime_enum_gaps`.
8. **Store-bought label contracts are written as label statements and not verified against real products.** They include:
   - corn tortillas and tostadas; flour tortillas without lard; refried beans without lard;
   - empanada discs, pita, rolls, and chapatis;
   - gochujang and kecap manis (wheat declared); Shaoxing wine and black vinegar (wheat declared);
   - fish sauce (anchovy and salt, no shrimp); vegan-labeled wine;
   - ajvar, ham, bacon, kielbasa, Italian sausage, and chipotles in adobo;
   - vegetarian cheeses with microbial rennet, or acid-set.
9. **Shallow-fry oil and pan fit.** These are recorded in each package's `oil` and `fit` records and checked arithmetically. Re-check that they are realistic, for example 1 1/3 cups of oil for 1/4 inch in a 12-inch skillet (10-inch base) for the chicken nanban, and six thighs of about 6 oz in one layer for the chkmeruli.
10. **Food-safety notes.**
    - tex-mex-steak-fajitas: steak to 130 F, with the USDA 145 F note.
    - uruguayan-chivito-sandwiches and swedish-pytt-i-panna: runny-yolk option.
    - crab-louie-salad: pasteurized crab.
    - japanese-chicken-nanban, amritsari-fish-mint-chutney, and other shallow-fry steps: oil-handling notes.
11. **Time claims** are reconstructed from step minutes, with overlap steps adding zero (`time_clock` in v1.json). The long cooks (plov, lu rou fan, menudo) and the rice overlaps are the ones most worth re-timing.
12. **Base data quirk.** In `notes/existing-200.tsv`, the live lemon-garlic-shrimp-pasta is classed as veg (old-schema data), so live shellfish is really 8, not 7. The live package was not changed.

## Out of scope for this handoff

Certification, import into harbor-eats-app, D1, publication, deployment, and pull requests. None of these has been started.

---

## Addendum r2: author round 3 after audit r1 (2026-10-16 CT)

Audit r1 (`audit/r1/`) returned 42 PASS / 8 FAIL. The 8 failing packages were revised as **author-r3** using the fix options Thomas chose. The 42 passing packages were not edited: every file in them is byte-identical to the pre-r3 manifest (`notes/pre-r3-file-hashes.sha256`, taken before any edit), and they stay at `author-r2` / `author_r2_preflight_pass_awaiting_vale`. Nothing is certified, imported, published, or deployed. D1 and the app repo were not written, and no PR or cloud agent was used.

Please re-audit the 8 packages below (round 2). Each one's `v1.json` has a `revision_history` entry (author-r2 → author-r3) with the trigger, the scope, the before and after culinary_hash, and the change list.

### Results for all 50

- Structural preflight: 50/50 PASS, hh001=17 (`notes/structural-author-r3.log`).
- Freeze integrity: the 8 revised packages were re-frozen and PASS (`notes/freeze-author-r3.log`). All 50 also PASS when run on a scratch copy, so the 42 untouched packages got no new FREEZE_INTEGRITY.json.
- `tools/mark_preflight.py` ran only on the 8 (it now takes slug arguments), so they read `author_r3_preflight_pass_awaiting_vale`. Both checks were re-run afterwards.
- `tools/finalize_images.py` re-ran only for the 3 meals with new heroes (`notes/finalize-author-r3.log`). The 5 text- or metadata-only meals kept their image files and hashes.
- Builder: all 50 pass every guard (`build_packages.py --check`).

### Per-meal changes

| Meal | Audit r1 gate | Scope | culinary_hash before → after | Time (prep+cook=total) | Active hero |
|---|---|---|---|---|---|
| `argentine-beef-empanadas` | gate B | recipe text only; image files unchanged and not regenerated | `5a1eaf53abf9…` → `1c2becd57927…` | 34+55=89 | `img_v1.jpg` (`006bda58fb88…`) |
| `polish-potato-cheese-pierogi` | gate B | recipe text only; image files unchanged and not regenerated | `fa1ce057fc08…` → `218505b5394b…` | 52+38=90 | `img_v1.jpg` (`395616bd1708…`) |
| `salvadoran-bean-cheese-pupusas` | gates B and K | recipe text and hero image (v3 rejected by audit r1 K; v4 is the new active hero) | `7f2e9d2e0b58…` → `ff2b632367fb…` | 37+33=70 | `img_v4.jpg` (`59c654ceb8d6…`) |
| `swedish-pytt-i-panna` | gate B | recipe text only; image files unchanged and not regenerated | `c344e937326f…` → `58554c9ff8f7…` | 15+47=62 | `img_v1.jpg` (`1ec5f1907f77…`) |
| `vietnamese-ca-kho-catfish` | gate K | hero image only; recipe text unchanged (culinary_hash unchanged) | `247f574f060d…` → `247f574f060d…` (unchanged) | 10+31=41 | `img_v3.jpg` (`f1e7f5c0200b…`) |
| `bhutanese-ema-datshi` | gate K | recipe text only; image files unchanged and not regenerated (the v2 hero is kept; the recipe now matches it) | `594dccb90531…` → `500aa46d0644…` | 14+36=50 | `img_v2.jpg` (`b3e706166e55…`) |
| `uruguayan-chivito-sandwiches` | gate K | hero image only; recipe text unchanged (culinary_hash unchanged) | `c76caf515334…` → `c76caf515334…` (unchanged) | 10+34=44 | `img_v5.jpg` (`e132a2952e0a…`) |
| `yucatecan-tikin-xic-fish` | gate H | metadata only (taste tags); recipe text and image unchanged (culinary_hash unchanged) | `822a10eee007…` → `822a10eee007…` (unchanged) | 27+20=47 | `img_v1.jpg` (`da385538f392…`) |

1. **argentine-beef-empanadas** (audit r1 gate B FAIL).
   - Filling trimmed to fit 16 discs at about 3 tbsp each (about 3 cups): ground beef 1 lb -> 3/4 lb; yellow onions 2 -> 1.
   - Rest of the filling scaled by 3/4: red bell pepper 1 -> 3/4; cumin 2 -> 1 1/2 tsp; sweet paprika 2 -> 1 1/2 tsp; dried oregano 1 -> 3/4 tsp; red chile flakes 1/2 -> 1/4 tsp (3/8 rounded to a standard spoon); kosher salt 1 1/4 -> 1 tsp; green olives 1/3 -> 1/4 cup; scallions 3 -> 2. The 2 boiled eggs are kept (audit fix text) and the third egg is still the wash.
   - Step 5: 'Place about 2 tbsp filling on each disc' -> 'Divide the filling evenly among the 16 discs, about 3 tbsp (a scant 1/4 cup) each'. Steps 1 and 3 and the description say 'onion' (singular).
   - Yield (16), discs, sheet pans, bake, clocks and total time (89 min) unchanged.
2. **polish-potato-cheese-pierogi** (audit r1 gate B FAIL).
   - Filling halved: russet potatoes 1 1/2 -> 3/4 lb; farmer's cheese 8 -> 4 oz; filling salt 1/2 -> 1/4 tsp (total salt 2 1/2 -> 2 1/4 tsp); black pepper 1/2 -> 1/4 tsp.
   - Onions: the filling share is halved and the topping share kept: yellow onions 2 -> 1 1/2 (1 topping, 1/2 filling), butter 4 -> 3 tbsp, all cooked together in step 3; step 3 sets aside two-thirds for the topping and step 4 mashes in the remaining third (about 2 1/4 cups filling).
   - Step 5: roll to about 1/8 inch (was 1/16) and cut 3-inch rounds, about 36 from the 3 cups flour; a level tablespoon of filling each (was a heaping teaspoon).
   - Dough, potato water (6 cups, 3-quart saucepan), yield (about 36, 3 boiling batches), clocks and total time (90 min) unchanged.
3. **salvadoran-bean-cheese-pupusas** (audit r1 gates B and K FAIL).
   - Filling cut to fit 8 pupusas at 3 tbsp each: refried beans one 16-oz can -> 1 cup; low-moisture mozzarella 8 -> 4 oz (about 1 1/2 cups filling, stated in step 3).
   - Bean named on the ingredient line: 'vegetarian refried small red beans, puréed smooth (about half a 16-oz can), whose label lists small red beans, water, oil, and salt, no lard'; description and pupusas component say refried small red beans.
   - Hero image: v3 (af06246b...) rejected by audit r1 K (filling reads as meat, curtido reads creamy) and moved to rejected/; v4 (59c654ce...) generated by Cora from the v4 prompt (v1 prompt plus one correction sentence) is the active hero; WebPs re-exported.
   - Yield (8), dough, clocks and total time (70 min) unchanged.
4. **swedish-pytt-i-panna** (audit r1 gate B FAIL).
   - Step 2 rewritten: the 2 lb of 1/2-inch potatoes are browned in 2 batches in the 12-inch skillet, each in one layer (1 tbsp oil + 1 tbsp butter and half the salt for batch 1, covered 7 then uncovered about 8 minutes; the remaining 1 tbsp oil and salt for batch 2, about 15 minutes), then both batches go back in the skillet.
   - Step 2 clock 22 -> 32 minutes; cook and total time rise by 10 minutes (total 52 -> 62); time-derived fields recomputed by the builder.
   - do-not-scale note now says to brown the 2 lb in 2 batches at 4 servings; the 1- and 2-serving lines say the potatoes go in one batch; effort note names the 2 batches (points unchanged).
   - Quantities unchanged.
5. **vietnamese-ca-kho-catfish** (audit r1 gate K FAIL).
   - Hero image: v2 (e2b47945...) rejected by audit r1 K (skin-on cross-cut steaks vs skinless fillet pieces) and moved to rejected/; v3 (f1e7f5c0...) generated by Cora from the v3 prompt (v1 prompt plus one correction sentence: about fourteen skinless rectangular fillet pieces) is the active hero; WebPs re-exported.
   - Recipe text unchanged.
6. **bhutanese-ema-datshi** (audit r1 gate K FAIL).
   - Chiles are halved lengthwise with the stems left on (no longer stemmed and cut into 1/2-inch strips): Anaheim and jalapeno ingredient prep lines, step 1, and the description ('Strips of' -> 'Halved ... stems left on').
   - Step 3: the halves simmer covered about 12 minutes (was 10, for the thicker pieces); step 3 clock 19 -> 21, still inside the 34-minute rice step, so total time (50 min) is unchanged.
   - Doneness: 'holding their strips' -> 'chile halves ... holding their shape'; effort note 'Cutting ... into strips' -> 'Halving ... lengthwise' (points unchanged).
7. **uruguayan-chivito-sandwiches** (audit r1 gate K FAIL).
   - Hero image: v4 (6da2d7ee...) rejected by audit r1 K (thick rosy steak vs 1/4 inch at 145F) and moved to rejected/; v5 (e132a295...) generated by Cora from the v5 prompt (v1 prompt plus one correction sentence: thin steak cooked to medium, egg visible, olives inside) is the active hero; WebPs re-exported.
   - Recipe text unchanged.
8. **yucatecan-tikin-xic-fish** (audit r1 gate H FAIL).
   - vocabulary_tag_ids: 'smoky' removed (foil-baked, nothing smoked or charred); now cod, citrusy, tangy, mexican. No tag added.

### Image records for the 3 new heroes

Each new prompt is the author-r1 v1 prompt plus one appended `Correction for this version:` sentence, word for word from `/workspace/wave17-v2-prompts.txt` (sections `## salvadoran-bean-cheese-pupusas (v4)`, `## vietnamese-ca-kho-catfish (v3)`, `## uruguayan-chivito-sandwiches (v5)`). `notes/prompts-regen-selfreview.txt` was refreshed as a byte-for-byte copy, and the builder checks the v1-plus-one-sentence form. Generator: Cora via Grok Bot GenerateImage. The new sha256 values match `/workspace/wave17-imgmap.txt` and `notes/image-gen-map.txt`.
The audit rejections are logged in `notes/image-gen-map.txt` as `REJECTED audit r1 K: <reason>` lines. They also appear in each package's image-prompt.md version history, marked "rejected by audit r1", and in `image.superseded` in v1.json (rejected_by `independent audit r1 (gate K)`, with the old source, master and card moved to `rejected/` as `*-replaced-<timestamp>.*`, with their sha256 values: pupusas 20261016002355, ca kho 20261016002402, chivito 20261016002409). image-prompt.md records every version's prompt verbatim (checked by script for all 9 regenerated meals). image-plating-brief.md was rebuilt from the author-r1 sections plus the accepted correction.

| Meal | Rejected by audit r1 K | New active hero |
|---|---|---|
| `salvadoran-bean-cheese-pupusas` | v3 `af06246be75dd72470a24b99bb55eadd59204554672fbec47a62074735564e68`: filling reads as meat, curtido reads creamy | v4 `59c654ceb8d636ef16dfdde34650f11e634e7fe848d075d0adb02058fa575aa0` |
| `vietnamese-ca-kho-catfish` | v2 `e2b47945f550633fb44db90117eb9a689c8bfd1de92ac0b39da8075ca2c942a5`: skin-on cross-cut steaks vs skinless fillet pieces | v3 `f1e7f5c0200b60555d04015c8c3e7a70b84fd279871d2e2e1753f7394f94a8c0` |
| `uruguayan-chivito-sandwiches` | v4 `6da2d7ee25954a4277e232c911c90357cd66e52fd0eaa47b927905d7bad71733`: thick rosy steak vs 1/4 inch at 145F | v5 `e132a2952e0a0bfee0190888e086856a70d5185e7c2b5a18cf9176d3ee973dc4` |

### Points for the r2 auditor

1. **Pupusas v4, gate K.** The curtido now looks translucent and vinegar-dressed, with carrot and jalapeño rings. The cut filling is dark red-brown with stretched white cheese, but at full size it still shows some rounded, bean-shaped lumps. It is not fully the hummus-smooth purée the correction asked for. Please judge whether it can still read as meat. The ingredient line now says smooth puréed refried small red beans.
2. **Ca kho v3, gate K.** About 13 to 14 rectangular pieces with white flesh at the cut sides. The tops are dark and lacquered from the caramel glaze. Check that the glaze can't be mistaken for skin.
3. **Chivito v5, gate K.** A thin browned steak layer with at most a faint pink line, a visible pan-fried egg in each half, and green olive slices inside the sandwich. The yolks are still runny; the existing food-safety note covers firmer yolks. The styling props match the brief (board, steak knife, linen).
4. **Ema datshi brief wording.** The recipe now matches the kept v2 hero: halved chiles, stems on. The brief's author-r1 sections still say "chile strips", because the brief has to reproduce the frozen v1 prompt exactly. The appended v2 correction section (halved lengthwise, a few stems) controls the image. The step 3 simmer went from 10 to 12 minutes and sits inside the rice step, so the total stays 50.
5. **Empanadas rounding.** Red chile flakes scaled 1/2 → 1/4 tsp (3/8 rounded to a standard spoon). The bell pepper is 3/4 of one. Both boiled eggs are kept, as the audit fix text said.
6. **Pierogi onions.** Only the filling share was halved. The topping keeps 1 onion, so the total is 1 1/2 onions in 3 tbsp butter, cooked together, with two-thirds set aside for the topping.
7. **Pytt i panna time band.** The total moves 52 → 62 minutes, from the 46-60 band to 61-90. The D-03 effort points and level are unchanged (moderate). coverage.md, WAVE.json and the roster were regenerated from the packages.
8. **Tikin xic tags.** 'smoky' was removed and nothing was added. vocabulary_tag_ids is now cod, citrusy, tangy, mexican. The culinary_hash is unchanged, which the builder checks for metadata-only revisions.
9. **Nutrition and shopping.** The wave-17 package contract has no nutrition or shopping-list fields. The builder recomputed the culinary_hash, time clock, D-03, scaling text, and the freeze and file hashes.
10. **Tooling changes this round.** `common.py` has the R3 table (with culinary_changed and image_changed flags, which the builder enforces both ways) and `audit_rejected` in SELFREVIEW. `build_packages.py` and `finalize_images.py` handle versions rejected by audit after finalization. `mark_preflight.py` takes slug arguments. `write_docs.py` reports the r3 round.
11. **Housekeeping.** During this round, `notes/structural-r3.log` and `notes/freeze-r3.log` (earlier run logs) were overwritten by accident. They were restored byte-for-byte from the pre-r3 backup. This round's logs are the `*-author-r3.log` files.

---

## Addendum r3: author round 4 after audit r2 (2026-10-16 CT)

Audit r2 (`audit/r2/`) returned 48 PASS / 2 FAIL. Both failures were gate K on the hero image only. Author round 4 (`author-r4`) replaced those two heroes and nothing else. The recipe text is unchanged: the culinary_hash equals the author-r3 value, and the builder enforces that for both. The other 48 packages were not touched. Every file in them is byte-identical to `notes/pre-r4-file-hashes.sha256`, which was taken before this round. They stay at author-r2 (42) or author-r3 (6). Nothing is certified, imported, published, or deployed. D1 and the app repo were not written, and no PR or cloud agent was used.

| Meal | Rejected by audit r2 K | New active hero | culinary_hash |
|---|---|---|---|
| `salvadoran-bean-cheese-pupusas` | v4 `59c654ceb8d636ef16dfdde34650f11e634e7fe848d075d0adb02058fa575aa0`: filling glossy, dark and lumpy, reads like chili or meat; contradicts 'puréed smooth' | v5 `ac633b8531748e6cf583a573fbc717e6fa2d5715ad4a74d0b6b2cd4a3f164d1c` (img_v5.jpg) | `ff2b632367fb…` (unchanged) |
| `uruguayan-chivito-sandwiches` | v5 `e132a2952e0a0bfee0190888e086856a70d5185e7c2b5a18cf9176d3ee973dc4`: steak cut face has ground-beef texture, reads as smash-burger patty | v6 `cbe2528faba71d14cfa0fb0e9def16acf0a55e73114643e8fd092343a2ec810b` (img_v6.jpg) | `c76caf515334…` (unchanged) |

- **Prompts:** each new prompt is the author-r1 v1 prompt plus one appended `Correction for this version:` sentence, word for word from `/workspace/wave17-v2-prompts.txt` (sections `## salvadoran-bean-cheese-pupusas (v5)` and `## uruguayan-chivito-sandwiches (v6)`). `notes/prompts-regen-selfreview.txt` was refreshed as a byte-for-byte copy. Generator: Cora via Grok Bot GenerateImage. The sha256 values match `/workspace/wave17-imgmap.txt`.
- **Image records:** `notes/image-gen-map.txt` has the `REJECTED audit r2 K:` lines and the new versions. In each package's image-prompt.md, the version history gives every prompt verbatim (checked by script) and is now headed v1…v4 or v1…v5, marked self-review, audit r1 or audit r2. `image.superseded` records the r2 rejection with rejected_by `independent audit r2 (gate K)` and finalized_at author-r3. The old source, main image and small card image are in `rejected/` as `*-replaced-20261016003710.*` (pupusas) and `*-replaced-20261016003718.*` (chivito). `revision_history` has two entries (r2→r3, r3→r4). image-plating-brief.md was rebuilt from the author-r1 sections plus the accepted correction.
- **Checks:** finalize_images ran for these 2 only (`notes/finalize-author-r4.log`). Structural preflight passes 50/50, hh001=17 (`notes/structural-author-r4.log`). mark_preflight ran on these 2 only, giving `author_r4_preflight_pass_awaiting_vale`. Freeze integrity passes for both (`notes/freeze-author-r4.log`) and for all 50 on a scratch copy.
- **Tooling:** `common.py` has R4, `audit_rej` (audit round per rejected version) and `audit_reasons`. `build_packages.py` writes a revision_history entry per round, and `finalize_images.py` handles rejections from any audit round.

### Points for the r3 auditor

1. **Pupusas v5.** The filling is now matte, with no sauce sheen. The curtido and salsa match v4. However, the bean layer is fairly thick and dark brown with a fine, slightly crumbly grain, so please check that it can't read as ground meat. The cheese pull is prominent.
2. **Chivito v6.** The cut face of the steak shows visible muscle grain and reads as whole-muscle meat, with the egg and olives inside. However, the steak layer may look thicker than the recipe's 1/4 inch, so please re-check thickness and doneness against v5's pass on those points. A few loose olive slices sit on the board. They are a recipe item, so the props rule allows them.
3. **Still open from audit r2 (not done, by instruction).** Audit r2 asked to update the stale "chile strips" wording in `bhutanese-ema-datshi`'s near_duplicate_review. That package is one of the 48 I was told not to touch this round, so it is still author-r3 and still has that wording.

---

## Addendum r4: author round 5 after audit r3 (2026-10-16 CT)

Audit r3 (`audit/r3/`) passed chivito and failed `salvadoran-bean-cheese-pupusas` on gate K again, for the hero image only. Author round 5 (`author-r5`) replaced that one hero and nothing else.

- The recipe text is unchanged: the culinary_hash is still `ff2b632367fb…`, the author-r3 value, and the builder enforces this.
- The other 49 packages were not touched. Every file in them is byte-identical to `notes/pre-r5-file-hashes.sha256`, which was taken before this round. They stay at author-r2 (42), author-r3 (6) and author-r4 (chivito).
- Nothing is certified, imported, published, or deployed. D1 and the app repo were not written, and no PR or cloud agent was used.

| Meal | Rejected by audit r3 K | New active hero | culinary_hash |
|---|---|---|---|
| `salvadoran-bean-cheese-pupusas` | v5 `ac633b8531748e6cf583a573fbc717e6fa2d5715ad4a74d0b6b2cd4a3f164d1c`: thick near-black crumbly slab reads as ground beef; contradicts smooth red-bean paste and mixed bean-cheese filling | v6 `f7bf2b7c85377e5e218e1d8fb971f47ec3978cb6fa47b026d95f0832195696d5` (img_v6.jpg) | `ff2b632367fb…` (unchanged) |

- **Prompt:** the v6 prompt is the author-r1 v1 prompt plus one appended `Correction for this version:` sentence, word for word from `/workspace/wave17-v2-prompts.txt`, section `## salvadoran-bean-cheese-pupusas (v6)`. `notes/prompts-regen-selfreview.txt` was refreshed as a byte-for-byte copy. Generator: Cora via Grok Bot GenerateImage. The sha256 matches `/workspace/wave17-imgmap.txt`.
- **Image records:**
  - `notes/image-gen-map.txt` has the `REJECTED audit r3 K:` line and the v6 line.
  - image-prompt.md gives versions v1 to v6 verbatim (checked by script). v1 and v2 are self-review rejections; v3, v4 and v5 were rejected by audits r1, r2 and r3.
  - `image.superseded` records v5 with rejected_by `independent audit r3 (gate K)` and finalized_at author-r4. The old source, main image and small card image are in `rejected/` as `*-replaced-20261016004234.*`.
  - `revision_history` has the entries r2→r3, r3→r4 and r4→r5.
  - image-plating-brief.md was rebuilt from the author-r1 sections plus the v6 correction.
- **Checks:**
  - finalize_images ran for this package only (`notes/finalize-author-r5.log`).
  - Structural preflight passes 50/50, hh001=17 (`notes/structural-author-r5.log`).
  - mark_preflight ran on this package only, giving `author_r5_preflight_pass_awaiting_vale`.
  - Freeze integrity passes (`notes/freeze-author-r5.log`), and all 50 pass on a scratch copy.
- **Tooling:** `common.py` adds R5 and audit r3 (finalized at author-r4). The builder writes a revision_history entry for every round.

### Points for the r4 auditor

1. **Pupusas v6 uses audit r3's fallback composition:** one whole pupusa, plus one torn open to show a small edge. The filling is now a lighter brown bean mixed with stretched white cheese, not a dark slab. The bean shows some soft texture, so please check that it reads as bean paste and not meat. The curtido and salsa are as before.
2. **Thickness.** The pupusas look puffier than the recipe's 4-inch, about 1/2-inch rounds, especially the torn one. Please check this is within tolerance.
3. **Still open (not done, by instruction).** The stale "chile strips" wording in `bhutanese-ema-datshi`'s near_duplicate_review, which audit r2 raised, is unchanged because that package was out of scope.
