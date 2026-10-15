# FlavorWeave Catalog Factory — Wave-15

50 candidate meal packages at `author-r2/author-r3`, authored 2026-10-15 for Thomas's request "Please do 50 more." These would take the catalog from 135 to 185 meals.

**State:** audit r1 certified 31/50 and failed 19 (`audit/r1/`). The creator fixed all 19 at `author-r3`, plus one auditor note on korean-galbi-jjim. These 20 packages await audit r2 (`notes/AUDITOR_HANDOFF-r2.md`). Revisions: author-r2 x 30, author-r3 x 20. Nothing is imported, there is no PR, and nothing is deployed. The creator does not self-certify.

## Results at author-r2/author-r3

- Structural preflight: PASS 50/50, hh001=20 (`notes/structural-preflight-author-r3.txt`).
- Freeze integrity: PASS 50/50, 26/26 checks x 50 (`notes/freeze-integrity-author-r3.txt`).
- structural_qa_state: author_r3_preflight_pass_awaiting_vale x 20, author_r2_preflight_pass_awaiting_vale x 30.
- HH001: 20/50 (8 finfish, 9 plant-based, 3 egg-vegetarian).

## Images

- Generator: Cora via Grok Bot GenerateImage, 2026-10-15. Sources are 1280x720; `tools/finalize_images.py` center-crops each to 4:3 and exports the 1200x900 master and 640x480 card WebPs.
- `notes/image-gen-map.txt` maps each slug to its GenerateImage attachment hash: 65 lines (50 v1, 12 v2, 2 v3); full hashes equal the sha256 of the saved source files; the egyptian-ful-medames v2 line (self-review rejected) carries an 8-character prefix only.
- 9 heroes were regenerated after audit r1 gate K FAILs (cuban-sandwiches -> img_v2.jpg, dominican-mangu-eggs-pickled-onions -> img_v2.jpg, egyptian-ful-medames -> img_v3.jpg, japanese-hambagu -> img_v2.jpg, japanese-vegetable-curry-rice -> img_v2.jpg, peruvian-tacu-tacu-egg -> img_v4.jpg, portuguese-grilled-sardines-potatoes -> img_v2.jpg, puerto-rican-pollo-guisado -> img_v2.jpg, southern-smothered-pork-chops -> img_v2.jpg). The previous hero files are in each `rejected/` and recorded under `image.superseded`. Each `image-prompt.md` keeps the earlier prompts and adds a labeled "Regeneration (audit r1) prompt" section with Cora's exact prompt.
- 4 heroes were regenerated as v2 after creator self-review, before any audit. In each, the never-finalized v1 is kept in `rejected/img_v1-selfreview-rejected.jpg` and recorded under `image.superseded` (`never_finalized: true`) and `image.regeneration`. Each `image-prompt.md` keeps the v1 prompt unchanged and adds a labeled "Regeneration v2 prompt addition" section.
  - `grilled-lamb-chops-mint-salsa-verde`: active `img_v2.jpg`; rejected v1 at `rejected/img_v1-selfreview-rejected.jpg`
  - `peruvian-tacu-tacu-egg`: active `img_v4.jpg`; rejected v1 at `rejected/img_v1-selfreview-rejected.jpg`
  - `thai-crispy-barramundi-tamarind`: active `img_v2.jpg`; rejected v1 at `rejected/img_v1-selfreview-rejected.jpg`
  - `turkish-iskender-kebab`: active `img_v2.jpg`; rejected v1 at `rejected/img_v1-selfreview-rejected.jpg`

## Layout

- `candidates/<slug>/`: v1.json, d03-classification.json, image-plating-brief.md, image-prompt.md, image-state.json, README.md, img_vN.jpg (active source), `<slug>.webp`, `<slug>-640.webp`, STRUCTURAL_PREFLIGHT.json, FREEZE_INTEGRITY.json, and `rejected/` where applicable.
- `coverage.md`, `selection-rationale.md`, `rejected.md`: coverage analysis and rationale.
- `notes/`: curator notes, roster, coverage stats, preflight, freeze and finalize logs, the image map, the v2 clarifiers, and the auditor handoff.
- `tools/`: generators and guards (`build_packages.py`, `recipes_w15_*.py`, `common.py`, `finalize_images.py`, `mark_preflight.py`, `coverage_stats.py`, `write_docs.py`).

## Reproduce the checks (read-only)

```
cd /workspace/harbor-eats-app && node factory/tools/structural_preflight.mjs /workspace/flavorweave-catalog-factory/wave-15/candidates
cd /workspace/flavorweave-catalog-factory/wave-15/candidates && for d in */; do python3 ../../freeze_integrity.py "$d"; done
```

## Roster

| Slug | Cuisine | HH001 | Effort / complexity | Total min | Image | Revision |
|---|---|---|---|---|---|---|
| argentine-chimichurri-steak-potatoes | argentine | N | moderate/simple | 70 | img_v1.jpg | author-r3 |
| basque-hake-salsa-verde | spanish | Y | moderate/simple | 35 | img_v1.jpg | author-r2 |
| bengali-mustard-fish | bengali | Y | moderate/standard | 36 | img_v1.jpg | author-r2 |
| bhindi-masala-chapati | indian | Y | involved/standard | 69 | img_v1.jpg | author-r2 |
| cantonese-char-siu-pork-rice | cantonese | N | involved/standard | 187 | img_v1.jpg | author-r2 |
| chinese-egg-foo-young | chinese | Y | involved/simple | 40 | img_v1.jpg | author-r2 |
| cobb-salad | american | N | involved/simple | 50 | img_v1.jpg | author-r3 |
| cuban-sandwiches | cuban | N | moderate/standard | 95 | img_v2.jpg (audit r1 regen) | author-r3 |
| cypriot-halloumi-orzo-salad | cypriot | N | moderate/simple | 35 | img_v1.jpg | author-r2 |
| dominican-mangu-eggs-pickled-onions | dominican | Y | moderate/simple | 59 | img_v2.jpg (audit r1 regen) | author-r3 |
| egyptian-ful-medames | egyptian | Y | easy/simple | 24 | img_v3.jpg (audit r1 regen) | author-r3 |
| ethiopian-atakilt-wat | ethiopian | Y | easy/standard | 55 | img_v1.jpg | author-r2 |
| filipino-bistek-tagalog | filipino | N | moderate/simple | 61 | img_v1.jpg | author-r3 |
| german-beef-rouladen | german | N | involved/standard | 147 | img_v1.jpg | author-r2 |
| greek-gigantes-plaki | greek | Y | easy/standard | 72 | img_v1.jpg | author-r2 |
| grilled-lamb-chops-mint-salsa-verde | mediterranean | N | moderate/simple | 52 | img_v2.jpg (v2 self-review regen) | author-r2 |
| hawaiian-huli-huli-chicken | hawaiian | N | involved/simple | 104 | img_v1.jpg | author-r3 |
| herb-roast-turkey-breast-cranberry | american | N | moderate/simple | 118 | img_v1.jpg | author-r2 |
| indian-paneer-tikka | indian | N | moderate/standard | 66 | img_v1.jpg | author-r2 |
| irish-beef-stew | irish | N | moderate/simple | 184 | img_v1.jpg | author-r2 |
| italian-chicken-cacciatore | italian | N | moderate/simple | 81 | img_v1.jpg | author-r2 |
| italian-grilled-calamari | italian | N | involved/simple | 34 | img_v1.jpg | author-r2 |
| japanese-hambagu | japanese | N | moderate/simple | 44 | img_v2.jpg (audit r1 regen) | author-r3 |
| japanese-vegetable-curry-rice | japanese | Y | moderate/simple | 52 | img_v2.jpg (audit r1 regen) | author-r3 |
| kenyan-tilapia-ugali-sukuma | kenyan | Y | involved/simple | 63 | img_v1.jpg | author-r2 |
| korean-braised-mackerel-radish | korean | Y | moderate/standard | 44 | img_v1.jpg | author-r2 |
| korean-galbi-jjim | korean | N | moderate/standard | 148 | img_v1.jpg | author-r3 |
| lebanese-baked-kibbeh | lebanese | N | involved/standard | 114 | img_v1.jpg | author-r2 |
| malian-chicken-maafe | malian | N | moderate/simple | 75 | img_v1.jpg | author-r2 |
| maryland-crab-cakes-slaw | american | N | moderate/simple | 66 | img_v1.jpg | author-r2 |
| mexican-enfrijoladas | mexican | Y | moderate/standard | 55 | img_v1.jpg | author-r2 |
| moroccan-chermoula-fish-tagine | moroccan | Y | moderate/standard | 52 | img_v1.jpg | author-r2 |
| nepali-aloo-tama | nepali | Y | moderate/standard | 55 | img_v1.jpg | author-r2 |
| new-mexican-carne-adovada | new-mexican | N | moderate/simple | 199 | img_v1.jpg | author-r2 |
| pakistani-chicken-karahi | pakistani | N | moderate/simple | 55 | img_v1.jpg | author-r3 |
| persian-lamb-koobideh-saffron-rice | persian | N | involved/standard | 67 | img_v1.jpg | author-r3 |
| peruvian-aji-de-gallina | peruvian | N | involved/standard | 62 | img_v1.jpg | author-r3 |
| peruvian-tacu-tacu-egg | peruvian | Y | involved/simple | 65 | img_v4.jpg (audit r1 regen) | author-r3 |
| polish-bigos | polish | N | easy/standard | 143 | img_v1.jpg | author-r2 |
| portuguese-grilled-sardines-potatoes | portuguese | Y | moderate/simple | 49 | img_v2.jpg (audit r1 regen) | author-r3 |
| puerto-rican-pollo-guisado | puerto-rican | N | moderate/standard | 79 | img_v2.jpg (audit r1 regen) | author-r3 |
| punjabi-rajma-chawal | indian | Y | moderate/standard | 56 | img_v1.jpg | author-r2 |
| red-snapper-veracruzana | mexican | Y | moderate/simple | 45 | img_v1.jpg | author-r2 |
| southern-smothered-pork-chops | southern | N | moderate/simple | 78 | img_v2.jpg (audit r1 regen) | author-r3 |
| swiss-raclette-potatoes-pickles | swiss | N | easy/simple | 54 | img_v1.jpg | author-r3 |
| taiwanese-three-cup-mushrooms | taiwanese | Y | moderate/standard | 39 | img_v1.jpg | author-r2 |
| thai-crispy-barramundi-tamarind | thai | Y | involved/standard | 46 | img_v2.jpg (v2 self-review regen) | author-r2 |
| thai-khao-man-gai | thai | N | involved/standard | 88 | img_v1.jpg | author-r2 |
| thai-moo-ping-sticky-rice | thai | N | involved/standard | 122 | img_v1.jpg | author-r3 |
| turkish-iskender-kebab | turkish | N | involved/standard | 81 | img_v2.jpg (v2 self-review regen) | author-r3 |
