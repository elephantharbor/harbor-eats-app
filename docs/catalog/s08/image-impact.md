# Image impact

No images were generated. Version ids still resolve to the existing WebP files, because image lookup strips `rv_` and `_vN` down to the slug. A regen is a later image pass, not a blocker for the recipe text.

| Dish | Regen |
|---|---|
| maple-mustard-glazed-salmon | Yes. Dill and lemon wedges will show. The current hero was audited with neither. |
| cashew-pesto-pasta | Yes. Toasted cashews, a greener pesto, and an oil sheen will not match a pale oil-free photo. |
| moroccan-chickpea-skillet | Yes if the hero is a bare skillet. Chopped parsley on top is visible. |
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
- `docs/catalog/s08/image-plating-moroccan.md` — regenerate only if the current hero is a bare skillet

`python3 factory/tools/export_meal_webps.py` can center-crop an already-generated source into the 1200×900 and 640×480 WebP pair. The repo has no image-generation pipeline and no generator credentials. Pixels are a later image pass. This cycle does not block on them.
