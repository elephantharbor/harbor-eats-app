# Wave-16 coverage analysis

Base: the 185 existing meals (135 live in harbor-eats-app/catalog before wave-15, plus the 50 wave-15 meals). The full list with cuisine, format, primary ingredient, protein class, and total time is in `notes/existing-185.tsv`; counts are in `notes/coverage-stats.json`.

## Protein balance

| Protein class | Base (185) | Wave-16 (15) | After (200) |
|---|---|---|---|
| veg | 78 (42%) | 6 | 84 (42%) |
| meat | 49 (26%) | 3 | 52 (26%) |
| fish | 30 (16%) | 4 | 34 (17%) |
| poultry | 23 (12%) | 0 | 23 (12%) |
| shellfish | 5 (3%) | 2 | 7 (4%) |

- Poultry is 23 meals, 19 with chicken in the title. Wave-16 adds no chicken and no poultry.
- Shellfish is the thinnest class: 5 meals (mussels, clams, scallops, calamari, crab cakes), and shrimp leads only a pasta, a sheet-pan boil, and a laksa. Wave-16 adds two shrimp dinners in formats the catalog lacks (shrimp and grits; a Goan shrimp curry).
- Fish: 30 meals, but salmon leads only two and raw or steamed fish formats are missing. Wave-16 adds four fish dinners, all HH001: a steamed custard (amok), herbed rice with salmon, a pickled-topping fried snapper, and a no-cook poke bowl.
- Vegetarian: 78 meals, but tofu leads only 4 and tempeh one, and zucchini and eggplant have no pasta or fritter lead. Wave-16 adds six vegetarian dinners, two of them plant-based HH001 (mapo tofu, japchae).
- Other proteins: pork and beef as weeknight formats that are not slow braises (a schnitzel, a 45-minute picadillo, a seared-steak salad).

## Cuisine

- The base is led by american (21), mexican, japanese, mediterranean, indian, italian, and korean labels.
- New labels in wave-16: austrian, cambodian, goan, indonesian, jamaican, russian. Sichuan flavor is filed under chinese.
- Wave-16 uses each cuisine once, and only one meal (pasta alla Norma) is in the large Italian cluster.

## Time and effort

- Base time bands: 30-45 58 (31%), 46-60 43 (23%), 61-90 37 (20%), over 90 25 (14%), under 30 22 (12%).
- 62 base meals run over an hour, 25 of them over 90 minutes. The catalog does not need more long cooks.
- Wave-16 totals run 35 to 54 minutes (median 43); 10 of 15 are 45 minutes or less, and none needs an oven braise, a marinade, or an overnight step.
- Effort: moderate 12 (80%), involved 2 (13%), easy 1 (7%). Complexity: simple 7 (47%), standard 7 (47%), adventurous 1 (7%).

## HH001

Base HH001: 71 of 185. Wave-16: 6 of 15 (two plant-based, four fish).

## Formats new to the catalog

Steamed fish custard in ramekins, poke bowl (no-cook raw fish), shrimp curry, shrimp and grits, breaded pork cutlet with potato salad, vegetable fritters, sweet potato glass noodles, and a seared-steak main salad.

Generated 2026-10-15T17:01:31-05:00 by tools/write_docs.py.
