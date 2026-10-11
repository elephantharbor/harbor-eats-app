# Audit: Roasted Cabbage Steaks with Cashew Romesco

| | |
|---|---|
| Slug | `roasted-cabbage-cashew-romesco` |
| Recipe version | `rv_roasted-cabbage-cashew-romesco_v1` |
| Package revision | `author-r1` |
| Freeze integrity | PASS |
| Overall | **FAIL** |

Independent auditor (Vale role), 2026-10-11. Run `bc-d19f3d1e-d801-59d5-8734-22463092a47a`. Recipe text was not edited. Importer accepts the package. Structural preflight image slot is PASS. The meal fails gate E.

## Failed gate

**E — time realism.** The oven is cold when the roast clock starts. Step 1 is titled "Heat the oven" and says "Turn the oven to 425 F," then immediately cuts the cabbage, oils it, and loads the sheet pan. Step 2 starts "Roast 8 minutes" and states a 30-minute cook (8 + about 22). No preheat minutes are in the prep clock, and the 15-minute prep is defined as overlapping the roast (the blender work in step 3), not as time for the oven to reach 425 F before the food goes in. A cold oven that starts at the bake, with no preheat minutes and no earlier overlap, fails E. Cod in this same wave does the overlap correctly: the oven heats during a stated 20-minute prep before the roast begins.

## A — PASS

Identity ids agree. Version 1, immutable, draft, not recommendation-eligible. `kitchen_tested` false. `effort_level` `moderate`, `ingredient_complexity` `simple`. Equipment includes a sheet pan, a blender or food processor, a knife, and a cutting board. `certification` and `auditor` are null.

## B — PASS

Olive oil is 6 tbsp: 3 tbsp on the cabbage in step 1, the remaining 3 tbsp in the sauce in step 3. Salt is 1.25 tsp: 1 tsp on the cabbage, 1/4 tsp in the sauce. Cashews are roasted and then blended. Parsley is the finish. Every id is referenced.

## C — PASS

One cabbage cut into four steaks at 4 servings. Scaling is one steak for 1 and two for 2, with the sauce divided. Oven temperature and crowding are do-not-scale.

## D — PASS

The roast has a visual target: cores tender, cut faces crisp and browned, cashews pulled when golden. The sauce is blended until spoonable. The missing preheat is an E defect, not a missing culinary step of another kind.

## E — FAIL

Prep 15 + cook 30 = 45 on the package, and the arithmetic identity holds. The reconstruction does not. The oven is switched on and the food goes in as part of the same setup, then a 30-minute roast is counted as if the oven were already at 425 F. The only stated overlap is the sauce blend during the roast. There is no preheat interval before the bake. See the failed-gate note above.

## F — PASS

Jarred roasted red peppers are a single ingredient. The romesco is made in the recipe. The contract names the sauce: peppers, cashews, garlic, smoked paprika, vinegar, olive oil. No almonds, no bread, no cheese.

## G — PASS

**Dietary eligibility.** Meat, poultry, finfish, shellfish, and dairy false. Plant-based and vegetarian true. `nut_policy` `cashews_only_ok`. `hh001_eligible` true. Cashews are the Household 001 exception, and they are the only nut. Labels: `dairy_free`, `vegetarian`, `plant_based`. No conditional claim.

**Allergens.** `tree_nut` and `cashew`. That pair, with `nut_policy: cashews_only_ok`, is the factory token pattern the importer maps to `cashew`. No almond, walnut, peanut, wheat, egg, soy, sesame, milk, finfish, or shellfish. The "no almonds" sentence is a hard exclusion, matched by the ingredient list.

## H — PASS

`crispy`, `smoky`, `savory`, `rich` are active. Crisp is the cabbage face. Smoky is the paprika. Rich is the romesco.

## I — PASS

Cabbage in the catalog is a stuffed bake and an okonomiyaki, not a roasted steak. Cashews elsewhere are biryani and a fish dish, not a pepper sauce. Cauliflower shawarma is a different vegetable. Not a duplicate.

## J — PASS

Roasted cabbage and a cashew romesco match the title. `methods` is `["roast"]`. Derived cooking is `frying: []`, `crispy_non_fry: ["baked", "roasted"]`, `stir_fry: false`, `source: "metadata"`, and the stored object matches. Crisp plus oven/roast produces those crisp tokens. There is no fry word. The dish is not frying.

**Classification.** Effort 1 + 0 + 1 + 1 + 1 = 4, moderate. Attention 0 is low for a cashew check at 8 minutes, but a 1 would still be moderate (sum 5). The level holds. Complexity: 7 counted items, band 0, specialty 0, flavor breadth 1, pantry 0, sum 1, simple. Cashews and jarred peppers are supermarket items and are not double-counted. Spanish cooking adds nothing. Sidecar matches.

## K — PASS

Two roasted cabbage steaks with charred rims, a rust-red sauce, parsley, and a few whole cashews. No almonds, bread, cheese, or chorizo. The brief asks for a few whole cashews from the sauce quantity. They read as cashews, not a second nut. The sauce is a band, not a soup.

## L1 — PASS

Master 1200×900, card 640×480, WebP RGB. Hashes match. Both steaks and the red sauce stay in the center. No text, logo, or rejected files. Provenance complete.

## L2 — PASS

Char against pale cabbage and a red sauce is strong contrast. The plate is full. Cashews and parsley read at card size. Light is bright. This is a desirable hero, not a plain roasted vegetable.

## L — PASS

L1 and L2 both pass. Gate L does not fail with E.

## M — PASS

`original_ai_assisted`. Image dated 2026-10-11, model `unknown`, stock false. Brief and prompt present.

## N — PASS

Cabbage is one head cut into steaks. Cashews are 3/4 cup. Peppers are 1.5 cups from a jar. Units are shoppable. The E failure is the clock, not the shopping list.

## O — PASS

First version, classification history present, auditor and certification null.
