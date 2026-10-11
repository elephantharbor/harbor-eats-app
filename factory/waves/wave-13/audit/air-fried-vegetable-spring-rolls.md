# Audit: Air-Fried Vegetable Spring Rolls

| | |
|---|---|
| Slug | `air-fried-vegetable-spring-rolls` |
| Recipe version | `rv_air-fried-vegetable-spring-rolls_v1` |
| Package revision | `author-r1` |
| Freeze integrity | PASS |
| Overall | **PASS** |

Independent auditor (Vale role), 2026-10-11. Run `bc-d19f3d1e-d801-59d5-8734-22463092a47a`. Recipe text was not edited. Importer `normalizeFactoryPackage` accepts the package. Structural preflight, after the image-slot fix, is PASS, including `image_slot`.

## A — PASS

Directory, `dish.dish_id`, and `dish.slug` are `air-fried-vegetable-spring-rolls`. `rcp_air-fried-vegetable-spring-rolls`, `rv_air-fried-vegetable-spring-rolls_v1`, version 1, `immutable: true`. `publication_status` is `draft`. `recommendation_eligible` is false. `kitchen_tested` is false on the version and on `catalog_confidence`. Household cooks and ratings are 0. `effort_level` is `moderate`. `ingredient_complexity` is `standard`. Both are the allowed enums. Equipment has five items, including an air fryer. `certification` and `auditor` are null.

## B — PASS

Seventeen ingredients, all referenced. The step bodies carry the splits the notes describe: 1 tsp of the neutral oil and 1 tbsp soy sauce in the filling, the remaining soy sauce in the dip, two garlic cloves in the filling and the last clove in the dip, the remaining oil brushed on the rolls. Rice vermicelli is soaked, cut, and folded in. No dangling reference.

## C — PASS

Base is 4 servings, 12 wrappers. Scaling says 3 rolls for 1 and 6 rolls for 2. Oil crowding and overfilling are listed as do-not-scale. Quantities are numeric.

## D — PASS

Filling is cooked until the cabbage softens, rolls are wrapped, and the air fryer is set to 375 F until the wrappers are crisp and blistered, about 8 minutes a batch, turned once. The dip is specified. No missing doneness cue.

## E — PASS

Prep 25 + cook 16 = 41. Step 2 states the 25-minute prep (soak, 4-minute filling cook, cool, roll, mix the dip). Step 3 states 16 minutes of air-frying in two batches. The air fryer is heated to 375 F before those timed batches. That is not a cold-oven bake with an uncounted preheat.

## F — PASS

Wheat spring-roll wrappers are a store-bought component with a hard contract: wheat wrappers, not rice paper, no egg wash. The dip is made in the recipe from soy sauce, lime, water, sugar, garlic, and chile. No fish sauce.

## G — PASS

Dietary eligibility and allergens are separate.

**Dietary eligibility.** `contains_meat` false, `contains_poultry` false, `contains_finfish` false, `contains_shellfish` false, `contains_dairy` false, `plant_based_compatible` true, `vegetarian_compatible` true, `nut_policy` `none`. `hh001_eligible` true. Eggs are absent, so plant-based is allowed. Sesame oil is not a nut. No shrimp and no fish sauce in the ingredients or steps. Labels: `dairy_free`, `vegetarian`, `plant_based`. No conditional "if" claim.

**Allergens.** `wheat`, `soy`, `sesame`. Wheat is the wrappers and the soy sauce (the soy-sauce note says wheat and soy). Soy is the soy sauce. Sesame is the sesame oil. No egg, peanut, tree nut, finfish, or shellfish token, and none of those ingredients are present.

## H — PASS

`crispy`, `crunchy`, `fresh`, `savory` are active taste-vocabulary slugs. The wrappers are the crisp claim. The filling supplies the fresh and savory notes.

## I — PASS

Live catalog has no spring roll. Vietnamese meals are pho and turmeric dill fish. Air-fried crisp elsewhere is pork or a tofu taco. Pork dumplings are a different wrapper and a frying method. Not a cosmetic duplicate.

## J — PASS

The title, description, and method are air-fried crisp rolls, not a fryer and not a fresh rice-paper roll. `methods` is `["air-fry"]`. `deriveCookingMethod` returns `frying: []`, `crispy_non_fry: ["air_fried"]`, `stir_fry: false`, `source: "metadata"`. The stored `cooking` object matches, including `intent`. Title and steps say air-fried / air-fry only. No deep, pan, shallow, or bare fry token survives after the air-fry strip.

**Classification.** Effort factors 2 + 1 + 1 + 1 + 0 = 5, moderate. Prep 2 is twelve rolls. No floor is triggered. Complexity: 13 counted items (wrappers through chile; salt, water, both oils excluded), band 1, specialty 0, flavor breadth 2, pantry 0, sum 3, standard. Wrappers are a grocery item. Vietnamese cooking is not scored. Sidecar enums match the package.

## K — PASS

`img_v1.jpg` shows four blistered rolls, two cut open, with cabbage, carrot, shiitake, and pale vermicelli, plus a dark dip with chile rings. No shrimp, no rice-paper summer roll, no fryer basket, no peanut sauce. The wrapper reads dry and blistered, which is the air-fried surface the brief required, not a bubbling fryer crust.

## L1 — PASS

Master WebP 1200×900 RGB, card WebP 640×480 RGB. Source JPEG 1280×720. Package SHA-256 values match the three files. No text, logo, watermark, hands, or faces. No `rejected/` set. Provenance keys present (`method`, `generation_date` 2026-10-11, `generator`, `model` `unknown`). Active paths are not under `rejected/`.

## L2 — PASS

Cut faces, carrot, and chile give contrast on a gold wrapper. The portion fills the plate. Light is bright and soft. The dip and the filling still read at card size. Appetite is in the same range as the stronger catalog cards.

## L — PASS

L1 and L2 both pass.

## M — PASS

Text provenance is `original_ai_assisted`. Image generation is original AI (`grok_bot_GenerateImage_then_webp_export`, model `unknown`), with `stock_or_web_photo_used` false. Plating brief and prompt are on disk. Rights are `not_cleared_for_external_release`.

## N — PASS

Ingredients have numeric quantity and unit. Wrappers are a count with a size note. Scaling covers 1, 2, and 4. Specialty shopping is ordinary grocery, not a missing unit.

## O — PASS

Version 1, no superseded id. `classification_history` records this first assignment. `auditor` and `certification` are null. This file is the auditor record; it is not inside the package.
