# Wave-17 coverage analysis

Base: the 200 live meals on harbor-eats-app main at 077bd14 (85 base meals plus waves 14, 15, and 16). The full list with cuisine, format, primary ingredient, protein class, total time, effort, complexity, HH001, and allergens is in `notes/existing-200.tsv`; counts are in `notes/coverage-stats.json`.

## Protein balance

| Protein class | Base (200) | Wave-17 (50) | After (250) |
|---|---|---|---|
| veg | 80 (40%) | 17 | 97 (39%) |
| meat | 50 (25%) | 12 | 62 (25%) |
| fish | 37 (18%) | 8 | 45 (18%) |
| poultry | 26 (13%) | 8 | 34 (14%) |
| shellfish | 7 (4%) | 5 | 12 (5%) |

- Poultry is the thinnest land protein: 26 meals (13%). Wave-17 adds 8 poultry dinners, all chicken, each in a format the catalog lacks (Japanese fried cutlet with tartar, tostadas, egg-lemon soup, garlic-cream skillet, preserved-lemon tagine, dumplings, sumac flatbread, sealed-pot stew).
- Shellfish is the thinnest class overall: 7 meals. (One more, the shrimp pasta, is filed as veg in the old-schema base data, so the true count is 8.) Wave-17 adds 5: shrimp saganaki, cioppino, crab Louie, spicy squid, and octopus with potatoes.
- Fish: 37 meals. Wave-17 adds 8 in species and formats the catalog lacks (catfish, smoked salmon, mackerel sandwich, achiote-baked fish, Amritsari fried fish, cod stew, salmon soup, grilled tilapia).
- Vegetarian: 80 meals (40%) is already the largest class, so wave-17 keeps it near that share: 17 vegetarian meals, 5 of them plant-based.
- Meat: 12 dinners, with pork, lamb, and beef in formats new to the catalog (braised pork rice bowl, dan dan noodles, plov, empanadas, keema, fajitas, cevapi, arayes, a loaded steak sandwich, a hash).
- Peanut: the base already has 4 peanut dishes. Wave-17 adds 0; dan dan noodles are made with sesame paste and no peanuts.

## Cuisine

- The base is led by american (21), mexican (9), japanese (8), italian-inspired (7), mediterranean (7), korean (6).
- New cuisine labels in wave-17: balkan, bhutanese, ecuadorian, finnish, indo-chinese, ivorian, palestinian, punjabi, salvadoran, sichuan, south-indian, tex-mex, uruguayan, uzbek, yucatecan.
- No cuisine appears more than three times in wave-17 (Greek three; Mexican, American, Japanese, Korean, and Vietnamese twice each), and the Italian cluster gets two pastas (vodka penne and orecchiette).

## Time and effort

- Base time bands: 31-45 66 (33%), 46-60 48 (24%), 61-90 37 (18%), over 90 25 (12%), 30 or less 24 (12%).
- Wave-17 time bands: 61-90 16 (32%), 46-60 16 (32%), 31-45 14 (28%), over 90 3 (6%), 30 or less 1 (2%). Totals run 28 to 146 minutes (median 56).
- Long cooks are limited to three over 90 minutes (menudo, lu rou fan, plov at 146); the base already has 25 over 90.
- Effort: moderate 34 (68%), easy 11 (22%), involved 5 (10%). Complexity: simple 39 (78%), standard 11 (22%).

## HH001

Base HH001: 77 of 200 (38%). Wave-17: 17 of 50 (34%), giving 94 of 250 (38%) after the wave. The HH001 meals are the dairy-free vegetarian and finfish dinners; no poultry, meat, or shellfish meal qualifies.

## Formats new to the catalog

Stuffed corn pupusas, pierogi, omurice, Indo-Chinese gobi, fish sandwich (balik ekmek), cioppino, crab Louie, octopus a feira, egg-lemon soup, chicken and dumplings, musakhan flatbread, sealed-pot kedjenou, plov, baked empanadas, lamb-stuffed pita, a loaded steak sandwich, and a Swedish hash.

Generated 2026-10-16T00:42:52-05:00 by tools/write_docs.py.
