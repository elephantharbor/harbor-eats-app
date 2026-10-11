# Audit: Roasted Cabbage Steaks with Cashew Romesco

| | |
|---|---|
| Slug | `roasted-cabbage-cashew-romesco` |
| Recipe version | `rv_roasted-cabbage-cashew-romesco_v1` |
| Package revision | `author-r2` |
| Freeze integrity | PASS |
| Overall | **PASS** |

Independent auditor (Vale role), re-audit 2026-10-11 of `author-r2` at `73f897a`. Run `bc-d19f3d1e-d801-59d5-8734-22463092a47a`. The prior audit of `author-r1` failed gate E. This pass re-runs A–O on the revised package. Recipe text was not edited by the auditor. Importer accepts the package. Structural preflight is PASS, including the image slot. `FREEZE_INTEGRITY.json` is PASS for `author-r2`.

Image SHA-256 values are unchanged from the `author-r1` audit: source `4c858bb4…7e90`, master `f2b3fb3a…2ffc`, card `a54ff4e1…4153`. K, L1, and L2 are re-applied to those same pixels.

## A — PASS

Identity ids agree. Version 1, immutable, draft, not recommendation-eligible. `kitchen_tested` false. `effort_level` `moderate`, `ingredient_complexity` `simple`. Equipment includes a sheet pan, a blender or food processor, a knife, and a cutting board. `certification` and `auditor` are null.

## B — PASS

Olive oil is 6 tbsp: 3 tbsp on the cabbage in step 1, the remaining 3 tbsp in the sauce in step 3. Salt is 1.25 tsp: 1 tsp on the cabbage, 1/4 tsp in the sauce. Cashews are roasted and then blended. Parsley is the finish. Every id is referenced.

## C — PASS

One cabbage cut into four steaks at 4 servings. Scaling is one steak for 1 and two for 2, with the sauce divided. Oven temperature and crowding are do-not-scale.

## D — PASS

The roast has a visual target: cores tender, cut faces crisp and browned, cashews pulled when golden. The sauce is blended until spoonable. The preheat is now its own step, covered under E.

## E — PASS

Prep 15 + cook 30 = 45. Step 1 is now a real preheat: the oven heats to 425 F for about 15 minutes, and the pan stays out. Step 2 cuts and oils during that preheat (about 8 minutes active) and says to wait if the oven is not at temperature yet. Step 3 puts the pan in only when the oven is hot, then roasts 8 minutes plus about 22 minutes. That 30 minutes is hot-oven time. Step 4 blends the romesco during the roast (about 5 minutes active) and does not add it to prep. Plating is about 1 minute. Active time, about 15 minutes, sits inside the 45-minute total. The cold-oven defect from `author-r1` is gone.

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

L1 and L2 both pass. The pixels are the same files judged at `author-r1`.

## M — PASS

`original_ai_assisted`. Image dated 2026-10-11, model `unknown`, stock false. Brief and prompt present.

## N — PASS

Cabbage is one head cut into steaks. Cashews are 3/4 cup. Peppers are 1.5 cups from a jar. Units are shoppable. The clock is covered under E.

## O — PASS

Still version 1. It was never certified, planned, or cooked, so the author amended the unpublished draft in place and set `package_revision` to `author-r2`. `classification_history` records the move from `author-r1` to `author-r2` with the same enums. The culinary hash changed because the steps changed, and the package says so. `auditor` and `certification` remain null.
