# Audit: Sichuan Green Bean and Mushroom Stir-Fry

| | |
|---|---|
| Slug | `sichuan-green-bean-mushroom-stir-fry` |
| Recipe version | `rv_sichuan-green-bean-mushroom-stir-fry_v1` |
| Package revision | `author-r1` |
| Freeze integrity | PASS |
| Overall | **FAIL** |

Independent auditor (Vale role), 2026-10-11. Run `bc-d19f3d1e-d801-59d5-8734-22463092a47a`. Recipe text was not edited. Importer accepts the package. Structural preflight image slot is PASS. The meal fails gate B.

## Failed gate

**B — ingredient and instruction reconciliation.** Water is one ingredient, 2.75 cups, with this note: "2 1/4 cups for the rice; of the remaining 1/2 cup, 2 tbsp goes into the cornstarch slurry and the rest into the sauce." Step 1 says "Stir together the soy sauce, rice vinegar, sugar, chili bean paste, cornstarch, and water" and does not say how much water. Step 2 then says "Put the rice, 2 1/4 cups of the water, and the salt in a saucepan." A cook who follows the steps in order stirs the water into the sauce before the rice pot exists, and the only measure on the ingredient is 2.75 cups. The rice water and the sauce water are the same line. The split lives in a note the step does not repeat. That fails reconciliation.

## A — PASS

Identity ids agree. Version 1, immutable, draft, not recommendation-eligible. `kitchen_tested` false. `effort_level` `involved`, `ingredient_complexity` `standard`. Equipment is a wok or 12-inch skillet, a lidded saucepan, a small bowl, and tongs. `certification` and `auditor` are null.

## B — FAIL

Every ingredient id is referenced, including water in steps 1 and 2. The failure is the quantity, not a dangling id. See the failed-gate note. The other splits are fine: rice is 1.5 cups with 2 1/4 cups water once that water is identified, and sesame oil and scallions go in off the heat.

## C — PASS

1.5 lb beans and 1.5 cups rice at 4 servings. Scaling quarters and halves the beans and rice and tells the cook to keep the pan hot. The water-split defect is B. The serving ratios themselves are stated.

## D — PASS

Beans are blistered in two batches, mushrooms are stir-fried, garlic and ginger go in briefly, and the sauce is tossed until it clings. Rice simmers covered about 18 minutes. Doneness cues exist. The unstated water split is the B defect.

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

Blistered beans, shiitake, chili bean paste, rice. `methods` is `["stir-fry"]`. Derived cooking is `frying: []`, `crispy_non_fry: []`, `stir_fry: true`, `source: "metadata"`, and the stored object matches. The only fry words are stir-fry. Stir-fry is not a frying kind. The title does not say dry-fried or fried. That keeps a "nothing fried" request from classifying this as pan-fried.

**Classification.** Effort 1 + 2 + 1 + 1 + 1 = 6, involved. Attention 2 is the wok. The attention floor would have required at least moderate anyway. Complexity: 11 counted items with sesame oil excluded as a cooking oil (12 if it were counted), either way band 0. Specialty 1 for chili bean paste, not also pantry familiarity. Flavor breadth 2. Sum 3, standard. Chinese cooking adds nothing. Sidecar matches.

## K — PASS

A bowl of blistered green beans and shiitake in a clinging red-brown sauce, scallions on top, white rice at the edge. No chicken, beef, peanuts, cashews, or a fryer. The beans read stir-fried, not deep-fried.

## L1 — PASS

Master 1200×900, card 640×480, WebP RGB. Hashes match. Beans fill the center and a crescent of rice remains. No text, logo, or rejected files. Provenance complete.

## L2 — PASS

Green beans, dark mushrooms, chile, and white rice are strong contrast. The bowl is abundant. Blistered skins and scallions read at card size. Light is bright. This is a hero, not a dull vegetable side.

## L — PASS

L1 and L2 both pass. Gate L does not fail with B.

## M — PASS

`original_ai_assisted`. Image dated 2026-10-11, model `unknown`, stock false. Brief and prompt present.

## N — PASS

Beans are 1.5 lb. Rice is 1.5 cups. Chili bean paste is 1.5 tbsp of the contracted paste. Units are shoppable. The water line is numeric; the defect is that the steps do not use that number in two places.

## O — PASS

First version, classification history present, auditor and certification null.
