# Image impact

The three regen heroes are exported under `public/images/meals/`. Lookup still strips `rv_` and `_vN` down to the slug, so the new files replace the old heroes for every version of that dish. Audit verdicts are in `IMAGE-PROVENANCE.md`.

| Dish | Regen |
|---|---|
| maple-mustard-glazed-salmon | Exported. Independent audit: FAIL. The center crop clips the asparagus tips and the right plate rim. |
| cashew-pesto-pasta | Exported. Independent audit: PASS. Green oily pesto, toasted cashews, no dairy-looking topping. |
| moroccan-chickpea-skillet | Exported. Independent audit: PASS. Parsley, couscous under the chickpeas, preserved lemon as slivers. |
| thai-basil-eggplant-stir-fry | Optional. A few red pepper flakes may show. The plate is still eggplant and basil over rice. |
| sheet-pan-lemon-herb-chicken | No, unless a later pass wants minced garlic to read. |
| smoky-lentil-sweet-potato-stew | No. Same bowl. |
| harissa-roasted-carrots-feta | No. Lemon is juiced, not plated as a wedge. |
| roasted-cauliflower-shawarma-plate | No. Garlic is in the sauce. |
| chipotle-lime-black-bean-bowls | No. Oil and cumin are not a new plated component. |
| ginger-scallion-fish-packets | No. |
| lemon-garlic-shrimp-pasta | No. |
| mushroom-walnut-bolognese | No. |
| sesame-soba-noodle-bowl | No. |
| white-bean-kale-soup | No. |
| black-bean-quesadillas | No. Lime is mixed into the beans. |
| steak-au-poivre-smashed-potatoes | No. |
| spanish-potato-tortilla | No. |
| linguine-with-clams | No. |

The three regen candidates are salmon, pesto, and Moroccan parsley. Thai basil flakes are the only other visible maybe. The twelve doneness revisions do not change the plate, so they do not need a new hero. Swordfish's existing brief still describes the v1 pull temperature; the photograph does not show an internal temperature, so that brief was left as the image record.

Plating briefs, using the sections in `factory/IMAGE-SPEC.md`:

- `docs/catalog/s08/image-plating-salmon.md`
- `docs/catalog/s08/image-plating-pesto.md`
- `docs/catalog/s08/image-plating-moroccan.md`

`python3 factory/tools/export_meal_webps.py` center-cropped the three sources into the 1200×900 and 640×480 WebP pairs. Hashes, prompts, and the audit are in `IMAGE-PROVENANCE.md`. Salmon fails that audit because the crop clips the asparagus.
