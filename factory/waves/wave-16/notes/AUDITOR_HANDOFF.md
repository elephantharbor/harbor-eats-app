# Wave-16 auditor handoff

This handoff is for an independent audit of the 15 wave-16 candidate packages in `/workspace/flavorweave-catalog-factory/wave-16/candidates/`. **Nothing in this wave is certified.** Nothing has been imported, published, or deployed, D1 has not been touched, and no pull request exists. Every package has `certification: null`, `auditor: null`, and `kitchen_tested: false`. Audit verdicts and any certification belong to the auditor.

## What is being handed over

- 15 dinner packages at `package_revision` `author-r2`, `structural_qa_state` `author_r2_preflight_pass_awaiting_vale`. Together they would take the catalog from 185 to 200 meals.
- Each package contains `v1.json`, `d03-classification.json`, `README.md`, `image-plating-brief.md`, `image-prompt.md`, `image-state.json`, the GenerateImage source (`img_v1.jpg` or `img_v2.jpg`), the `<slug>.webp` master (1200x900), the `<slug>-640.webp` card (640x480), `STRUCTURAL_PREFLIGHT.json`, and `FREEZE_INTEGRITY.json`. The three regenerated packages also have `rejected/`.
- Wave files: `README.md`, `WAVE.json`, `coverage.md`, `selection-rationale.md`, `rejected.md`, `notes/` (`existing-185.tsv`, `coverage-stats.json`, `wave16-roster.tsv`, `image-gen-map.txt`, `regen-v2-clarifiers.md`, `prompts-author-r1.txt`, `prompts-v2-selfreview.txt`, and the preflight logs), and `tools/`.

| # | Slug | Cuisine | Protein | Total min | Effort / complexity | HH001 | Allergens | Enum gaps | Hero |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `sichuan-mapo-tofu-shiitake` | chinese | veg | 41 | moderate / adventurous | yes | soy,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |
| 2 | `korean-japchae-vegetables` | korean | veg | 43 | moderate / simple | yes | soy,wheat,sesame | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 3 | `indonesian-gado-gado-tempeh` | indonesian | veg | 47 | moderate / standard | no | peanut,egg,soy,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 4 | `russian-mushroom-stroganoff` | russian | veg | 41 | moderate / simple | no | milk,wheat,egg | allergens,classification,cooking,cuisine,dietary_labels,mustard,provenance,publication_state | img_v1.jpg |
| 5 | `sicilian-pasta-alla-norma` | italian | veg | 44 | moderate / simple | no | milk,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 6 | `turkish-mucver-zucchini-fritters` | turkish | veg | 46 | involved / standard | no | egg,milk,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |
| 7 | `southern-shrimp-and-grits` | southern | shellfish | 39 | moderate / simple | no | shellfish,milk | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 8 | `goan-shrimp-ambot-tik` | goan | shellfish | 40 | moderate / standard | no | shellfish | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 9 | `cambodian-fish-amok` | cambodian | fish | 53 | moderate / standard | yes | finfish,egg | allergens,classification,coconut,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 10 | `persian-sabzi-polo-salmon` | persian | fish | 51 | moderate / simple | yes | finfish | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 11 | `jamaican-escovitch-snapper` | jamaican | fish | 43 | moderate / standard | yes | finfish,wheat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 12 | `hawaiian-ahi-poke-bowl` | hawaiian | fish | 35 | easy / standard | yes | finfish,soy,wheat,sesame | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 13 | `austrian-pork-schnitzel-potato-salad` | austrian | meat | 50 | involved / simple | no | meat,wheat,egg | allergens,classification,cooking,cuisine,dietary_labels,mustard,provenance,publication_state | img_v1.jpg |
| 14 | `cuban-picadillo-rice` | cuban | meat | 45 | moderate / simple | no | meat | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v1.jpg |
| 15 | `thai-yum-nua-beef-salad` | thai | meat | 42 | moderate / standard | no | meat,finfish | allergens,classification,cooking,cuisine,dietary_labels,provenance,publication_state | img_v2.jpg |

## Pre-audit check results (mechanical only, not an audit)

- Structural preflight: 15/15 PASS (`notes/structural-r4.log`). Run it with `cd /workspace/harbor-eats-app && node factory/tools/structural_preflight.mjs /workspace/flavorweave-catalog-factory/wave-16/candidates`.
- Freeze integrity: 15/15 PASS, 26/26 checks each (`notes/freeze-r4.log`). Run it with `python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py <candidate dir>`.
- Image hashes: for all 15, the active source, master, and card sha256 match `image.file_hashes`. The active source and each rejected v1 also match `notes/image-gen-map.txt` (18 lines: 15 active, 3 rejected v1).
- Builder guards in `tools/build_packages.py`:
  - near-duplicate slug and comparison refs against the 185 existing meals;
  - pot size against water volume;
  - boil-up minutes inside step clocks;
  - no untimed waits;
  - counted equipment in the scaling notes;
  - description words present as ingredients;
  - step clocks against stated minutes;
  - styling props limited to recipe items and neutral tableware.

  The guards also confirm that each author-r1 prompt rebuilds byte-for-byte from the recipe files.

These checks prove structure and consistency only. They do not establish culinary correctness, dietary or allergen correctness, or image fidelity.

## Images

- All 15 heroes were generated with Grok Bot GenerateImage at 1280x720. The master and card are 4:3 center crops (960x720) resized with LANCZOS. **The 1200x900 master is a 1.25x upscale of the crop.**
- Twelve heroes are v1, made from the exact prompts in `/workspace/wave16-prompts.txt`.
- Three are v2 regenerations after a creator self-review:
  - `sichuan-mapo-tofu-shiitake`: v1 rejected before finalization (The tofu looked golden and fried, the sauce read brown, and the shiitake crumbs read as ground meat.) Kept at `candidates/sichuan-mapo-tofu-shiitake/rejected/img_v1-selfreview-rejected.jpg` and recorded under `image.superseded` (never_finalized). The active hero is `img_v2.jpg`. image-prompt.md carries the v2 prompt verbatim under 'Active prompt (v2)' and the v1 prompt under 'Superseded prompt (v1)'. image-plating-brief.md was rebuilt to match v2.
  - `turkish-mucver-zucchini-fritters`: v1 rejected before finalization (Only two fritters were on the plate; the brief and recipe serve three per plate.) Kept at `candidates/turkish-mucver-zucchini-fritters/rejected/img_v1-selfreview-rejected.jpg` and recorded under `image.superseded` (never_finalized). The active hero is `img_v2.jpg`. image-prompt.md carries the v2 prompt verbatim under 'Active prompt (v2)' and the v1 prompt under 'Superseded prompt (v1)'. image-plating-brief.md was rebuilt to match v2.
  - `thai-yum-nua-beef-salad`: v1 rejected before finalization (The lettuce read as savoy or napa cabbage, not romaine.) Kept at `candidates/thai-yum-nua-beef-salad/rejected/img_v1-selfreview-rejected.jpg` and recorded under `image.superseded` (never_finalized). The active hero is `img_v2.jpg`. image-prompt.md carries the v2 prompt verbatim under 'Active prompt (v2)' and the v1 prompt under 'Superseded prompt (v1)'. image-plating-brief.md was rebuilt to match v2.
- The v2 prompts (`/workspace/wave16-v2-prompts.txt`) shorten the lighting line and drop the Chipotle Lime Black Bean Bowl quality-reference sentence. The mücver and yum nua v2 prompts also have no separate Color line, and mücver has no Sauce line. Those brief sections restate the hero and must-show text, as each image-prompt.md notes.

## Points worth the auditor's attention

These are observations to verify, not verdicts.

1. **thai-yum-nua-beef-salad (v2):** the brief asks for a large oval platter, but the hero appears to show a round plate. Some lettuce leaves may still read as crinkled rather than smooth romaine. Check this against gate K.
2. **cambodian-fish-amok:** the hero shows two of the four ramekins, with rice on the plate. The recipe uses four 12-ounce ramekins steamed about 22 minutes; check that the custard volume and steaming time are realistic.
3. **turkish-mucver-zucchini-fritters (v2):** the hero has three fritters, one broken open. The yogurt shows herb flecks, but the recipe's yogurt is garlic and salt only, with the herbs scattered over the fritters.
4. **hawaiian-ahi-poke-bowl:** raw tuna, with a food-safety note in the package. The rice rests 5 minutes, not 10, to fit the step clock.
5. **thai-yum-nua-beef-salad:** steak at 130 F medium-rare, with the USDA 145 F note. Fish sauce is listed as finfish (seasoning only).
6. **Enum gaps carried as open items:** mustard (schnitzel, stroganoff) and coconut (amok) have no FlavorWeave allergen token. They are disclosed in allergen_notes and runtime_enum_gaps.
7. **Store-bought label contracts** (breadcrumbs, egg noodles, tomato sauce, olives, fish sauce, ricotta salata with microbial rennet) are written as label statements. They are not verified against real products.
8. **HH001 (6/15):** mapo tofu and japchae are plant-based; amok, sabzi polo, escovitch, and poke are fish. Check the nut policy and the dairy and shellfish exclusions in each `hh001_contract`.
9. **Near duplicates:** each package's `near_duplicate_review` names at least two existing meals. `rejected.md` lists ideas dropped as too close.
10. **Time claims** are reconstructed from step minutes, with overlap steps adding zero (`time_clock` in v1.json). The rice and boil overlaps are the ones most worth re-timing.

## Out of scope for this handoff

Certification, import into harbor-eats-app, D1, publication, deployment, and pull requests. None of these has been started.
