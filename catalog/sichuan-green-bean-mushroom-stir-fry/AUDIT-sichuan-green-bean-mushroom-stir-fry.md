# Audit: Sichuan Green Bean and Mushroom Stir-Fry

| | |
|---|---|
| Slug | `sichuan-green-bean-mushroom-stir-fry` |
| Recipe version | `rv_sichuan-green-bean-mushroom-stir-fry_v1` |
| Package revision | `author-r2` |
| Freeze integrity | PASS |
| Overall | **PASS** |

Independent auditor (Vale role), re-audit 2026-10-11 of `author-r2` at `73f897a`. Run `bc-d19f3d1e-d801-59d5-8734-22463092a47a`. The prior audit of `author-r1` failed gate B. This pass re-runs A–O on the revised package. Recipe text was not edited by the auditor. Importer accepts the package. Structural preflight is PASS, including the image slot. `FREEZE_INTEGRITY.json` is PASS for `author-r2`.

Image SHA-256 values are unchanged from the `author-r1` audit: source `1d534e9c…d615`, master `a6680349…1462`, card `382b8690…a865`. K, L1, and L2 are re-applied to those same pixels.

## A — PASS

Identity ids agree. Version 1, immutable, draft, not recommendation-eligible. `kitchen_tested` false. `effort_level` `involved`, `ingredient_complexity` `standard`. Equipment is a wok or 12-inch skillet, a lidded saucepan, a small bowl, and tongs. `certification` and `auditor` are null.

## B — PASS

Water is now two ingredients. `rice-water` is 2.25 cups, display name "water for the rice," note "For the rice only." `sauce-water` is 0.5 cup, note "Use 2 tbsp of it for the cornstarch slurry and the remaining 6 tbsp in the sauce." Half a cup is 8 tbsp, and 2 + 6 = 8. Step 1 measures the 1/2 cup, makes the slurry with 2 tbsp, and stirs the remaining 6 tbsp into the sauce before the slurry goes back in. Step 2 uses only the 2 1/4 cups with the rice. Step 3 adds the sauce from step 1 and says to add no more water. Step 4 adds none. Every other amount in the steps matches the shopping line (1 1/2 lb beans, 8 oz shiitake, 4 garlic cloves, 1 tbsp ginger, 3 scallions, 2 tbsp soy sauce, 1 tbsp vinegar, 1 tsp sugar, 1 1/2 tbsp paste, 1 tsp cornstarch, 2 tbsp neutral oil, 1 tsp sesame oil, 1/2 tsp salt, 1 1/2 cups rice). No dangling or unused ingredient id. The `author-r1` single 2.75-cup line is gone.

## C — PASS

1.5 lb beans and 1.5 cups rice at 4 servings. Scaling quarters and halves the beans and rice and tells the cook to keep the pan hot. The two water lines scale with those ratios: rice water stays with the rice, sauce water stays with the sauce. Pan heat is do-not-scale.

## D — PASS

Beans are blistered in two batches, mushrooms are stir-fried, garlic and ginger go in briefly, and the sauce is tossed until it clings. Rice simmers covered about 18 minutes. Doneness cues exist. The water amounts are now in the steps.

## E — PASS

Prep 15 + cook 20 = 35. Rice is about 18 minutes and runs under the stir-fry. The stir-fry is about 12 minutes inside the 20-minute cook (two bean batches, mushrooms, aromatics, sauce). The clocks agree. No oven.

## F — PASS

Chili bean paste is store-bought with a hard contract: broad beans, chile, and soy. No shrimp and no shellfish. The component record repeats that contract. No oyster sauce. This is not "shellfish-free if the paste is shellfish-free" without naming the paste.

## G — PASS

**Dietary eligibility.** Meat, poultry, finfish, shellfish, and dairy false. Plant-based and vegetarian true. `nut_policy` `none`. `hh001_eligible` true. No peanuts. Sesame oil is allowed. The paste contract excludes shrimp, so shellfish stays false. Labels: `dairy_free`, `vegetarian`, `plant_based`. No conditional "if" claim.

**Allergens.** `soy`, `wheat`, `sesame`. Soy and wheat are the soy sauce; the package also attributes wheat to the chili bean paste, which is the safe declaration for a broad-bean chile paste that is not contracted as wheat-free. Sesame is the sesame oil. Cornstarch is not a reason to add or remove wheat. No peanut, tree nut, egg, milk, finfish, or shellfish token. The "no shrimp" note is backed by the paste contract, so omitting shellfish is correct.

## H — PASS

`stir-fries`, `spicy`, `savory`, `mushrooms`, `crunchy` are active. Chili bean paste is the heat. Blistered beans are the crunch. Mushrooms are in the dish.

## I — PASS

Stir-fries in the catalog are cashew chicken, peanut noodles, Thai basil eggplant, lomo saltado, and kimchi rice. None is a plant green-bean and shiitake stir-fry without peanuts. Not a duplicate.

## J — PASS

Blistered beans, shiitake, chili bean paste, rice. `methods` is `["stir-fry"]`. Derived cooking on the revised steps is `frying: []`, `crispy_non_fry: []`, `stir_fry: true`, `source: "metadata"`, and the stored object matches. The only fry words are stir-fry. Stir-fry is not a frying kind. "Add no more water" is not a fry phrase.

**Classification.** Effort 1 + 2 + 1 + 1 + 1 = 6, involved. Attention 2 is the wok. The attention floor would have required at least moderate anyway. Complexity: 11 counted items. Both water ids and the oils are excluded. Band 0. Specialty 1 for chili bean paste, not also pantry familiarity. Flavor breadth 2. Sum 3, standard. Enums are unchanged from `author-r1`. Chinese cooking adds nothing. Sidecar matches the package.

## K — PASS

A bowl of blistered green beans and shiitake in a clinging red-brown sauce, scallions on top, white rice at the edge. No chicken, beef, peanuts, cashews, or a fryer. The beans read stir-fried, not deep-fried.

## L1 — PASS

Master 1200×900, card 640×480, WebP RGB. Hashes match. Beans fill the center and a crescent of rice remains. No text, logo, or rejected files. Provenance complete.

## L2 — PASS

Green beans, dark mushrooms, chile, and white rice are strong contrast. The bowl is abundant. Blistered skins and scallions read at card size. Light is bright. This is a hero, not a dull vegetable side.

## L — PASS

L1 and L2 both pass. The pixels are the same files judged at `author-r1`.

## M — PASS

`original_ai_assisted`. Image dated 2026-10-11, model `unknown`, stock false. Brief and prompt present.

## N — PASS

Beans are 1.5 lb. Rice is 1.5 cups. Chili bean paste is 1.5 tbsp of the contracted paste. The two water lines have different `ingredient_id`s (`rice-water`, `sauce-water`) and different display names, both in cups, so a shopping list keyed on ingredient id keeps them apart. Units are shoppable.

## O — PASS

Still version 1. It was never certified, planned, or cooked, so the author amended the unpublished draft in place and set `package_revision` to `author-r2`. `classification_history` records the move from `author-r1` to `author-r2` with the same enums. The culinary hash changed because the water lines and steps changed, and the package says so. Both water ids stay out of the D-03 count. `auditor` and `certification` remain null.
