# Skillet Shakshuka

Eggs set in a skillet of tomato and red pepper sauce made from crushed tomatoes, peppers, onion, and ground spices.

Frozen catalog package for FlavorWeave Catalog Factory Dry Run #3. Not kitchen-tested. Not certified. Not published. Master and card WebPs are frozen for preflight/audit. package_revision freeze-r1. Do not import into recipe-store.

## Identity

- Dish id / slug: `skillet-shakshuka`
- Recipe id: `rcp_skillet-shakshuka`
- Recipe version id: `rv_skillet-shakshuka_v1`
- Cuisine: north-african (already a live cuisine label; the gap is eggs and the skillet format)
- Meal format: skillet (not a D-02 meal_style slug)
- Primary ingredient: eggs (no D-02 ingredient slug)
- Servings: 4
- Time: prep 12 + cook 26 = 38 minutes
- Effort: easy (simple)
- Publication state: Draft
- Provenance: original_ai_assisted
- Package revision: freeze-r1
- Kitchen tested: false
- HH001 eligible: true — eggs are allowed. No meat, poultry, dairy, shellfish, or nuts. Plant-based is false because of the eggs.
- Taste tags: north-african, savory, tangy, herbaceous, tender, fresh
- Dietary labels: dairy_free
- Dietary label note: Unconditional. The ingredient list has no dairy. This is not a skip-the-cheese version.
- Allergens: egg
- Dietary eligibility: contains_meat=false, contains_poultry=false, contains_finfish=false, contains_shellfish=false, contains_dairy=false, plant_based_compatible=false, vegetarian_compatible=true, nut_policy=none, hh001_eligible=true

## Batch challenges

A HH001 egg dinner. B tomato-pepper sauce made in the skillet. C counted eggs (2/4/8) and a tomato-can floor. The cuisine label is not the gap.

## Why this slot

Eggs are unused as a dinner protein in the live 24 and in the seven certified drafts. The format is eggs set in sauce in a skillet, not a bowl, taco, or pasta. HH001 can eat eggs. The sauce is canned crushed tomatoes, red bell pepper, onion, garlic, and ground spices. It is not a jar of shakshuka sauce. There is no feta, yogurt, cheese, butter, cream, or bread.

## Equipment

- 12-inch skillet with lid
- wooden spoon
- knife
- cutting board
- measuring spoons

Heat: Medium for the onion, peppers, and sauce. Medium-low, covered, for the eggs. No oven.

Doneness: Sauce holds a well after about 10 minutes. Whites fully set, yolks soft and glossy. Do not flip the eggs. Firm yolks are about 2 extra covered minutes and are not the written target. kitchen_tested is false.

## Ingredients

Quantities are for 4 servings. Preparation is not part of the shopping id.

- `eggs` — 8 count large eggs; note: 2 per serving
- `olive-oil` — 2 tbsp olive oil
- `yellow-onion` — 1 count yellow onion; prep: diced
- `red-bell-pepper` — 2 count red bell pepper; prep: stemmed, seeded, and sliced
- `garlic` — 4 clove garlic; prep: minced
- `sweet-paprika` — 2 tsp sweet paprika
- `ground-cumin` — 1 tsp ground cumin
- `ground-coriander` — 1 tsp ground coriander
- `crushed-tomatoes` — 28 oz canned crushed tomatoes; note: one 28 oz can, not a jar of shakshuka sauce
- `water` — 0.5 cup water
- `sugar` — 1 tsp sugar
- `kosher-salt` — 1.25 tsp kosher salt; note: 1/4 tsp with the vegetables, 3/4 tsp in the sauce, 1/4 tsp on the eggs
- `black-pepper` — 0.5 tsp black pepper; note: all of it in the sauce
- `fresh-parsley` — 0.25 cup fresh parsley; prep: chopped

## Components

- **tomato-pepper sauce** — made in the recipe: true. Store-bought finished component: false.

## Steps

### 1. Prep

Dice the yellow onion. Stem, seed, and slice the red bell pepper. Mince the garlic. Chop the fresh parsley. Measure the spices, sugar, salt, and pepper. Leave the eggs whole until the sauce can hold a well.

### 2. Soften the onion and peppers

Heat the olive oil in a 12-inch skillet over medium heat. Add the yellow onion, the red bell pepper, and 1/4 tsp of the kosher salt. Cook until soft, about 8 minutes. Do not char them.

### 3. Bloom the spices

Add the garlic, sweet paprika, ground cumin, and ground coriander. Stir for 1 minute. Ground spices, not a jar and not a paste.

### 4. Simmer the tomato-pepper sauce

Add the canned crushed tomatoes, water, sugar, 3/4 tsp kosher salt, and the black pepper. Simmer uncovered about 10 minutes, until a spoon leaves a well. This is the only sauce. Do not add cheese, yogurt, butter, cream, or bread.

### 5. Set the eggs

Make 8 wells. Crack in 8 eggs, one per well. Sprinkle the remaining 1/4 tsp kosher salt. Cover. Cook over medium-low 6 to 8 minutes, until the whites are fully set and the yolks are still soft. Do not flip the eggs.

### 6. Finish in the skillet

Off the heat. Scatter the fresh parsley. Serve from the skillet, 2 eggs and sauce per person. No cheese, no yogurt, no bread, and no second sauce.

## Scaling for 1, 2, and 4

Ratios from a base of 4: 1 serving x0.25, 2 servings x0.5, 4 servings x1. Eggs stay whole. Floors below override a blind quarter.

**1 serving.** Two large eggs in an 8-inch skillet. 7 oz crushed tomatoes (about 3/4 cup). 1/2 small yellow onion. 1/2 red bell pepper. 1 garlic clove. 2 tsp olive oil. 2 tbsp water. 1/2 tsp sweet paprika, 1/4 tsp ground cumin, 1/4 tsp ground coriander, 1/4 tsp sugar. Salt as pinches plus 1/4 tsp in the sauce. 1 tbsp parsley. Sauce simmers at least 6 minutes. Egg time stays 6 to 8 minutes.

**2 servings.** Four large eggs in a 10-inch skillet. 14 oz crushed tomatoes. One red bell pepper, 1/2 yellow onion, 2 garlic cloves. Halve the oil, water, sugar, salt, parsley, and spices. Same heat and the same egg target.

**4 servings.** As written. Eight large eggs. One 28 oz can.

Do not scale: medium and medium-low heat; set-white and soft-yolk target; a fraction of an egg; the rule that the skillet shrinks with the batch.

## Allergen notes

- Egg is the only allergen token.
- No milk, soy, wheat, sesame, peanut, tree_nut, shellfish, or finfish.
- Live PACKAGE_ALLERGEN_IDS has no egg token. Do not drop egg to force an enum match.

## Curator preflight

Juniper preflight for freeze-r1. Not Vale's audit and not a certification. Master and card WebPs are frozen for preflight/audit.

- **ingredient_instruction_reconciliation** — pass. Every ingredient is used. No cheese, bread, or yogurt enters in the method.
- **oil** — pass. Olive oil is 2 tbsp, all used on the onion and peppers.
- **compounds** — pass. Tomato-pepper sauce is simmered in the skillet. Not a jar of shakshuka sauce.
- **times** — pass_with_stated_clock. 12 + 26 = 38. Egg clock uses the middle of the 6 to 8 minute range.
- **scaling_1_2_4** — pass_with_rounding_notes. Eggs are 2, 4, and 8. The can has a floor.
- **dietary_vs_ingredients** — pass. Dairy-free is unconditional. Vegetarian true. Plant-based false. Allergens: egg only. HH001 true.
- **taste_vocabulary** — pass. Existing slugs only. No invented egg or skillet tag.
- **kitchen_tested** — pass. kitchen_tested is false.
- **publication** — pass. Draft. freeze-r1. Not published.
- **image** — frozen_for_preflight. asset_generated is true. Master and card WebPs are present; not imported or published.

## Image

Master and card WebPs are frozen for preflight/audit. asset_generated: false. package_revision: draft-r0. Prompt: image-prompt.md. Intended size when an export exists: 1200x900 master and 640x480 card, both 4:3. No binary is in this folder.
