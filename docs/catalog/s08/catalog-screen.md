# Catalog screen

`node scripts/s08-catalog-screen.mjs` reads the live `vN.json` of every dish and runs `assessCulinaryQuality`. Flags are candidates. They are not automatic rewrites.

Unbranded "kosher salt" on a package that is not an S-08 revision is counted and not flagged. The gram-and-brand rule applies to new and materially revised recipes. 217 live pre-S-08 dishes still say an unnamed kosher salt. That is recorded here. It is not a batch rewrite.

A boil-salt warning is not flagged when the steps already mention salt, soy, miso, broth, or stock. The first pass of that warning marked about 102 dishes, and 92 of those already season the pot or the sauce. Treating that list as defects would have been the heuristic, not the catalog.

## Counts

| | |
|---|---|
| Screened | 250 |
| Culinary-reviewed in this cycle (the 18 new versions) | 18 |
| Flagged on the post-revision catalog | 13 |
| Defects revised | 18 |
| Dishes left on their previous version | 232 |
| Needs a kitchen test before anyone calls a revision proven | 18 |
| Sub-FDA internal temperatures found and not rewritten | 12 |
| Flag reviewed and left unchanged | 1 (`vietnamese-ca-kho-catfish`) |

The 18 revisions are the fifteen legacy v3 files plus Steak au Poivre, Spanish Tortilla, and Linguine with Clams. They are not in the flagged 13 because they pass the objective checks.

## Named factory dishes

Steak au Poivre with smashed potatoes, v2. Salt is 38 g Diamond Crystal: 11 g on the steaks (about 2.8 g each), 24 g in 10 cups of potato water (about 1%), 2 g on the smashed potatoes, 1 g in the sauce. The instruction is 145 F and a 3-minute rest. A pinker center is named as a personal preference and is not given a temperature. Butter was left as unsalted butter. The v1 125 F medium-rare number is not in v2.

Spanish potato tortilla, v2. Salt is 11 g: 8 g on the potatoes and onion while they cook, 3 g in the eggs. The cook tastes a potato that is already cooked. Eggs are cooked until the center is just firm.

Linguine with clams, v2. Salt is 38 g in 4 qt (about 1%). The clam sauce is tasted and not pre-salted, because clam liquor is already briny. Closed clams are discarded.

New England clam chowder was a false screen hit. It already says to salt to taste because clam juice is salty. It was not revised.

## The 13 flags, after review

These were read. They were not given a new version in this cycle. Changing rare tuna, duck breast, or a medium-rare steak across the factory catalog is a safety-versus-identity decision for Oversight. The new check will fail a future culinary revision that keeps a lower number as the instruction.

| Dish | What the screen saw | Decision |
|---|---|---|
| ethiopian-beef-tibs | Beef cubes at about 135–140 F | Left. No 145 F instruction beside it. |
| gochujang-grilled-flank-steak | 135 F | Left. Medium-rare is the written instruction. |
| grilled-swordfish-olive-caper | 135 F | Left. Seafood default is 145 F. |
| malaysian-curry-laksa | Shrimp at 120–125 F | Left. The checker now calls this seafood, not the chicken in the same dish. |
| nigerian-beef-suya-skewers | About 140 F | Left. |
| pan-seared-halibut-lemon-butter-corn | 135 F | Left. |
| roasted-whole-branzino-salmoriglio | 140 F | Left. |
| salade-nicoise-seared-tuna | About 115 F, with 145 F as the cooked-through alternative | Left. Rare tuna is the dish. 115 F is still the first instruction. |
| seared-duck-breast-cherry | 135 F | Left. 165 F would be a different dish. |
| seared-scallops-parsnip-puree | 120–125 F, with 145 F described as the fully cooked recommendation | Left. The first instruction is still the lower one. |
| tex-mex-steak-fajitas | 135 F and 130 F | Left. |
| thai-yum-nua-beef-salad | Beef at 130 F, with a parenthetical USDA 145 F | Left. `contains_finfish` is true because of fish sauce, not a fish fillet. |
| vietnamese-ca-kho-catfish | Rice brought to a boil with no salt word | Left. The salt is in the fish-sauce caramel. The rice is the plain side. Not a defect to rewrite from the screen. |

Turkey breast and piri-piri chicken pull the poultry at 160 F and say it rises or carries over to 165 F. The checker treats that stated carryover as the safety target and does not flag them.

## Needs kitchen test

Every S-08 version has `kitchen_tested: false`. The screen does not promote any of them to kitchen-tested or household-rated.
