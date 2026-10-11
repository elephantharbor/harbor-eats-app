# FlavorWeave catalog coverage — wave-13-2026-10-11

Source: `elephantharbor/harbor-eats-app` `origin/main` at **b28f03e** (`D-06.1: Semantic Breadth + Weave UX Hardening`). Inventory is every `catalog/<slug>/v1.json` (none of these 75 have a `v2.json`). Excludes `catalog/legacy-24/` and `catalog/staging-publication.json`.

**Base count: 75.** This wave authors 10 new packages under `factory/waves/wave-13/candidates/`. They are not in `catalog/` and are not imported.

Counts are counts. Household 001 is eligibility, not a quota. The task for this wave requires at least 6 of the 10 to be HH001-eligible. The selection is 8 of 10, because the open gaps (new fish, an egg skillet, a cashew-only sauce, an air-fryer plant meal) land on Tom and Renata's side of the rules. The other two cover a poultry cut and a shellfish shape the catalog does not have.

## D-03 (75 current versions)

| Effort | Count | Complexity | Count |
|---|---|---|---|
| easy | 20 | simple | 29 |
| moderate | 43 | standard | 43 |
| involved | 12 | adventurous | 3 |

Pairs: moderate/standard 29, easy/simple 15, moderate/simple 13, involved/standard 9, easy/standard 5, involved/adventurous 2, moderate/adventurous 1, involved/simple 1. Easy/adventurous and involved with a light list are almost empty. Adventurous complexity is still rare (3). This wave does not invent an adventurous shopping list to fill that cell. The new techniques score moderate or involved on the rubric.

## Time (`recipe_version.total_minutes`)

| Band | Count |
|---|---|
| Under 30 | 11 |
| 30–45 | 37 |
| 45+ | 27 |

Under 30 is the thin clock. One new meal (pan-fried trout, 24 minutes) sits there. A short clock is not an Easy effort score.

## Cuisine

| Cuisine | Count |
|---|---|
| american | 11 |
| italian-inspired | 7 |
| mexican | 6 |
| mediterranean | 5 |
| indian-inspired, japanese, thai-inspired | 4 each |
| korean | 3 |
| asian-fusion, chinese-inspired, californian, north-african, vietnamese | 2 each |
| italian-american, brazilian, cajun, chinese-american, scandinavian-inspired, british, ethiopian, filipino, greek, caribbean, moroccan, peruvian, southwestern, middle-eastern, israeli, french, new-american, southern, spanish, japanese-inspired, turkish | 1 each |

No German, Austrian, West African, Polish, or Portuguese meal. French, southern, Spanish, and British are single meals. Chinese home cooking that is not chicken-and-cashews is thin (the Chinese-American meal is cashew chicken; the Chinese-inspired meals are a fish packet and pork dumplings).

## Meal format

Bowl 6. Fillet, stir-fry, and pasta 4 each. Stew, composed plate, skillet, and sheet-pan 3 each. Braise, tacos, sandwiches, grilled, noodle-soup, soup, and curry 2 each. Everything else is a single meal, including air-fry, burgers, chili, pizza, dumplings, fish cakes, and lettuce wraps.

Empty shapes that still matter: a British deep-fried fish plate, a spring-roll handheld, a Spanish egg-and-potato skillet, a duck plate, a clam pasta.

## Primary protein and lead ingredient

Chicken in some cut is the largest cluster (about 10 meals once thighs, breast, and ground-adjacent poultry are rolled up). Finfish is broad but repetitive: salmon 2, catfish 2, white fish 2, plus one each of halibut, cod, arctic char, swordfish, tuna, and anchovy. No trout. No mackerel. Shellfish is shrimp (2), mussels, and scallops. No clams. No duck. Eggs lead only shakshuka. Tofu is three bowls plus a stew and tempeh. Legumes are already a large HH001 cluster (beans, chickpeas, lentils, white beans, pinto chili). This wave does not add another bean-pot dinner.

## HH001

Limits: no dairy, no shellfish, no meat other than fish, no poultry. Nuts only as cashews. Eggs, finfish, and sesame are allowed.

`hh001_eligible: true` is set on **23** of 75 packages (the factory meals that carried the flag). The other 52 are mostly legacy packages with no flag. This wave does not re-tag them.

The 23 confirmed meals lean on plants, a few fish, eggs (shakshuka, sabich, nicoise, okonomiyaki), and one cashew biryani plus one cashew fish (turmeric dill fish). There is still no HH001 deep-fried fish, no HH001 air-fried handheld, no HH001 southern plate (the only southern meal is a shrimp boil with sausage and butter), and no HH001 Spanish meal (the only Spanish meal is chorizo rice).

## Cooking methods (D-06.1)

`deriveCookingMethod` (`src/weave/semantics.js`) on the 75 current packages:

| Source | Count |
|---|---|
| Classified from methods, description, or steps | 24 |
| Classified from the title only | 1 |
| No cooking classification | 50 |

Only one package has a method token that names a fryer (`air_fry` on crispy chipotle tofu tacos). The other "fried" hits come from prose, and several are accidents:

- Cajun blackened catfish classifies as **deep** because a step says "Do not deep-fry."
- Mushroom pozole classifies as **pan** because the broth step says "this frying step."
- Scallops and biryani classify as **pan** because of crisp-fried sage and crisp-fried onions.
- Pork dumplings classify as both **deep** and **pan**.

Air-fried crisp shows up on the pork tenderloin and the tofu tacos, both outside a clean "not frying" contract for HH001 (pork is meat; the tofu tacos are a legacy package without an HH001 flag). Stir-fry is five meals, three of them meat or peanut.

Baked or roasted crisp is real on a handful of oven meals (gnocchi sheet pan, teriyaki tofu, grilled cheese's oven side) and is not the same thing as frying. The catalog does not say so in `methods`.

Wave-13's job on this dimension is to add meals whose `methods` tokens and step text agree, so a request for "nothing fried" or "crispy without frying" can tell deep, pan, and shallow apart from air-fried, oven-crisp, and stir-fry.

## What this wave is for

Ten meals: eight HH001, two that HH001 cannot eat (duck, clams). They add trout, mackerel, cod-as-a-fried-plate, green tomatoes, spring rolls, a cashew romesco, a Sichuan vegetable stir-fry, a Spanish tortilla, duck, and clams. They also add one explicit example of each D-06.1 frying kind and of the crisp methods that are not frying. Rationale: `selection-rationale.md`.
