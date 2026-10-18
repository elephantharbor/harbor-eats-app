# Catalog screen

`node scripts/s08-catalog-screen.mjs` reads the live `vN.json` of every dish and runs `assessCulinaryQuality`. Flags are candidates. They are not automatic rewrites.

Unbranded "kosher salt" on a package that is not culinary-reviewed is counted and not flagged. The gram-and-brand rule applies to seasoning revisions. 217 live dishes still say an unnamed kosher salt, including the 12 doneness revisions, which did not change salt. That is recorded here. It is not a batch rewrite.

A boil-salt warning is not flagged when the steps already mention salt, soy, miso, broth, or stock. The first pass of that warning marked about 102 dishes, and 92 of those already season the pot or the sauce. Treating that list as defects would have been the heuristic, not the catalog.

## Counts

| | |
|---|---|
| Screened | 250 |
| Culinary-reviewed in this cycle (seasoning revisions) | 18 |
| Doneness revisions (safe primary instruction, not a seasoning rewrite) | 12 |
| Flagged on the post-revision catalog | 1 |
| Defects revised | 30 version files (18 seasoning, 12 doneness) |
| Dishes left on their previous version | 220 |
| Needs a kitchen test before anyone calls a revision proven | 30 |
| Flag reviewed and left unchanged | 1 (`vietnamese-ca-kho-catfish`) |

The 18 seasoning revisions are the fifteen legacy v3 files plus Steak au Poivre, Spanish Tortilla, and Linguine with Clams. The 12 doneness revisions are factory v2 files. They are not flagged because the primary instruction is the USDA/FDA minimum and any traditional lower temperature sits in a labeled optional note.

## Named factory dishes

Steak au Poivre with smashed potatoes, v2. Salt is 38 g Diamond Crystal: 11 g on the steaks (about 2.8 g each), 24 g in 10 cups of potato water (about 1%), 2 g on the smashed potatoes, 1 g in the sauce. The instruction is 145 F and a 3-minute rest. A pinker center is named as a personal preference and is not given a temperature. Butter was left as unsalted butter. The v1 125 F medium-rare number is not in v2.

Spanish potato tortilla, v2. Salt is 11 g: 8 g on the potatoes and onion while they cook, 3 g in the eggs. The cook tastes a potato that is already cooked. Eggs are cooked until the center is just firm.

Linguine with clams, v2. Salt is 38 g in 4 qt (about 1%). The clam sauce is tasted and not pre-salted, because clam liquor is already briny. Closed clams are discarded.

New England clam chowder was a false screen hit. It already says to salt to taste because clam juice is salty. It was not revised.

## Doneness revisions

Oversight's rule: do not publish a lower temperature as universally safe. Each of these is a new factory v2. The primary instruction is the USDA/FDA minimum. Where the dish is traditionally served less done, that doneness is a labeled optional note and says the lower temperature does not meet the recommendation. No other recipe text changed. `evidence.culinary_reviewed` is not set, so the gram-and-brand salt rule was not applied to these twelve.

| Dish | Version | Primary instruction | Optional note |
|---|---|---|---|
| ethiopian-beef-tibs | `rv_ethiopian-beef-tibs_v2` | 145 F, then a 3-minute rest. Cook 29, total 44. | Medium cubes, about 135 F to 140 F. |
| gochujang-grilled-flank-steak | `rv_gochujang-grilled-flank-steak_v2` | 145 F, then the existing 5-minute rest. Cook 27, total 52. | Medium-rare, 130 F to 135 F. |
| grilled-swordfish-olive-caper | `rv_grilled-swordfish-olive-caper_v2` | 145 F, then the existing 3-minute rest. Cook 30, total 48. | 130 F to 135 F. |
| malaysian-curry-laksa | `rv_malaysian-curry-laksa_v2` | Shrimp pink, opaque, and firm. Cook 29, total 54. | Translucent center, about 120 F to 125 F. |
| nigerian-beef-suya-skewers | `rv_nigerian-beef-suya-skewers_v2` | 145 F, then a 3-minute rest. Cook 41, total 61. | About 140 F. |
| pan-seared-halibut-lemon-butter-corn | `rv_pan-seared-halibut-lemon-butter-corn_v2` | 145 F. Cook 18, total 26. | 130 F to 135 F. |
| roasted-whole-branzino-salmoriglio | `rv_roasted-whole-branzino-salmoriglio_v2` | 145 F. Cook 49, total 64. | 135 F to 140 F. |
| salade-nicoise-seared-tuna | `rv_salade-nicoise-seared-tuna_v2` | 145 F, 3 minutes per side. Cook 32, total 47. | Rare center, about 115 F. |
| seared-duck-breast-cherry | `rv_seared-duck-breast-cherry_v2` | 165 F, then the existing 5-minute rest. Cook 26, total 36. | Rosy interior, about 135 F. |
| seared-scallops-parsnip-puree | `rv_seared-scallops-parsnip-puree_v2` | Opaque and firm. Cook 41, total 51. | Translucent center, about 120 F to 125 F. |
| tex-mex-steak-fajitas | `rv_tex-mex-steak-fajitas_v2` | 145 F, then the existing 5-minute rest. Cook 34, total 54. | Medium-rare, about 130 F. |
| thai-yum-nua-beef-salad | `rv_thai-yum-nua-beef-salad_v2` | 145 F, then the existing 5-minute rest. Cook 32, total 44. | Medium-rare, about 130 F. `contains_finfish` is still fish sauce, not a fillet. |

## The flag that stayed

| Dish | What the screen saw | Decision |
|---|---|---|
| vietnamese-ca-kho-catfish | Rice brought to a boil with no salt word | Left. The salt is in the fish-sauce caramel. The rice is the plain side. Not a defect to rewrite from the screen. |

Turkey breast and piri-piri chicken pull the poultry at 160 F and say it rises or carries over to 165 F. The checker treats that stated carryover as the safety target and does not flag them.

## Needs kitchen test

Every S-08 version has `kitchen_tested: false`. The screen does not promote any of them to kitchen-tested or household-rated.
