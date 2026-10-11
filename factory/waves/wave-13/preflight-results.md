# Wave-13 preflight

Author role only. No images were generated. No package was copied into `catalog/`. Nothing was imported, deployed, or published.

Base catalog SHA for the coverage inventory: `b28f03e`.

## Structural preflight

`node factory/tools/structural_preflight.mjs factory/waves/wave-13/candidates`

**PASS 10/10.** HH001-eligible: 8.

The script loads each `v1.json` through `normalizeFactoryPackage` (the same function `scripts/import-catalog.mjs` uses), then checks D-03, equipment, methods, dietary eligibility, Household 001 hard rules, ingredient references, plating-brief sections, and that `recipe_version.cooking` matches `deriveCookingMethod` in `src/weave/semantics.js`.

Per-meal records: `candidates/<slug>/STRUCTURAL_PREFLIGHT.json`.

## Freeze integrity

`python3 factory/tools/freeze_integrity.py factory/waves/wave-13/candidates/<slug>`

**FAIL 10/10**, each with the same three checks:

- `provenance_generation_date` missing (no image has been generated, so there is no generation date)
- `image_exists_master` missing `<slug>.webp`
- `image_exists_card` missing `<slug>-640.webp`

Identity, ingredients, steps, eligibility, allergens, and the "no denial strings" check passed. An auditor must not start. After the image pass drops in the WebP pair, sets `generation_date`, and re-runs this script to PASS, a different cloud agent can audit.

Per-meal records: `candidates/<slug>/FREEZE_INTEGRITY.json`.

## Cooking classification recorded on the packages

| Slug | HH001 | `methods` | Derived |
|---|---|---|---|
| deep-fried-cod-roasted-potatoes | yes | deep-fry, roast | frying deep; crisp baked and roasted |
| pan-fried-trout-lemon-capers | yes | pan-fry | frying pan |
| shallow-fried-green-tomatoes | yes | shallow-fry | frying shallow |
| air-fried-vegetable-spring-rolls | yes | air-fry | crisp air_fried; not frying |
| roasted-cabbage-cashew-romesco | yes | roast | crisp baked and roasted; not frying |
| sichuan-green-bean-mushroom-stir-fry | yes | stir-fry | stir_fry; not frying |
| spanish-potato-tortilla | yes | shallow-fry | frying shallow |
| grilled-mackerel-fennel-orange | yes | grill | no frying classification |
| seared-duck-breast-cherry | no | sear | crisp token from the skin; not frying |
| linguine-with-clams | no | stovetop | no frying classification |
