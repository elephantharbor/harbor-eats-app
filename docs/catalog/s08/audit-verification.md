# S-08 audit verification

The preliminary flavor audit (`REPORT`, `sample_scores.csv`, `catalog_levers.csv`, `levers.py`) was checked against the catalog files. It was not treated as a measurement.

## Confirmed

- The catalog has 250 dishes: 24 legacy recipes (the `recipe-store.js` / `catalog/legacy-24` cohort) and 226 factory recipes.
- The live file for a dish is the highest `vN.json`. Before this cycle that was v2 for the legacy 24 and for `korean-soft-tofu-stew`, and v1 for every other factory dish.
- Maple Mustard Glazed Salmon v2 and Cashew Pesto Pasta v2 are underseasoned. Salmon v2 brushes Dijon and maple on fish and asparagus and says "No oil is listed, and none is added." Its `unchanged_from_v1` line said no oil, salt, pepper, lemon, or garlic. Pesto v2 has 1/2 tsp of unnamed kosher salt, unsalted pasta water, soaked rather than toasted cashews, and "No oil and no cheese."
- Gate D in `factory/CERTIFICATION.md` was the undefined label "Culinary completeness." Gates A–O did not check seasoning. The auditor-does-not-rewrite rule and the image rule against inventing color were both real.
- Kosher salt in the factory catalog is generally unbranded and measured in teaspoons.
- The legacy cohort is the recipe-store 24, not a name guess.

## Corrected

- 125 F is not the salmon default. FDA seafood guidance is 145 F. The audit's lower pull temperature was not used.
- A Gate P with numeric salt floors, and a mandatory taste-step template on every recipe, would not fix the failure. The new checks are objective defects only.
- "Half Morton" is only a rough volume comparison. UC ANR publication 390575 (November 2023) is the weight table: Diamond Crystal kosher 2.8 g/tsp, Morton coarse kosher 4.8 g/tsp, table salt 6 g/tsp. Grams are authoritative. 2.8/4.8 is about 0.58, not one half.
- Not all 24 legacy recipes needed a rewrite. Nine were left on v2.
- Factory sample scores and medians in the audit are judgments, not measurements. A zero-added-salt dish seasoned by soy, miso, fish sauce, or gochujang is not a defect.
- `hh001_eligible: false` on salmon and ginger-scallion fish packets is a documentation flag. Runtime eligibility still allows finfish for Household 001. That flag was not "fixed."
- Some "do not add" lines are real dietary boundaries (no cheese on a dairy-free stew, no fish sauce on a plant stew). Those were not treated as flavor bugs.

## Uncertain

- The exact versions currently published in production D1 were not queried. This cycle did not open a D1 connection. The repo and the import docs are the evidence used here.
- Sodium in Dijon, soy sauce, broth, and adobo varies by brand. Revisions do not claim a milligram total.
- No revised recipe has been cooked. `kitchen_tested` remains false. Nothing in this cycle is proven delicious.
