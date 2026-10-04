# Crispy Skillet Chicken Sandwiches

Pound-thin chicken cutlets seared in a skillet and stacked on rolls with lemon-dijon mayonnaise, lettuce, and tomato.

Draft catalog package for FlavorWeave Catalog Factory Dry Run #1. Not kitchen-tested. Not certified. Not published. Do not import into recipe-store.

## Identity

- Dish id / slug: `crispy-skillet-chicken-sandwiches`
- Recipe id: `rcp_crispy-skillet-chicken-sandwiches`
- Recipe version id: `rv_crispy-skillet-chicken-sandwiches_v1`
- Cuisine: american
- Meal format: sandwiches
- Primary ingredient: chicken
- Servings: 4
- Time: prep 12 + cook 16 = 28 minutes
- Effort: weeknight (straightforward)
- Publication state: Draft
- Provenance: original_ai_assisted
- Kitchen tested: false
- HH001 eligible: false — Poultry is banned for HH001. Global catalog candidate. It is the second chicken technique, not a second sheet-pan.
- Taste tags: american, sandwiches, chicken, crispy, tender, citrusy, savory, herbaceous
- Dietary labels: dairy_free
- Allergens: poultry, egg, wheat
- Allergen notes: Egg (eggs, and egg in the mayonnaise) and wheat (all-purpose flour, sandwich rolls) are on the structured array with poultry. Live PACKAGE_ALLERGEN_IDS has poultry and no egg or wheat id. That gap does not remove them from the array. Dairy-free assumes a dairy-free egg-and-oil mayonnaise; yogurt-based or cheese-added mayo would fail the label.

## Why this slot

Fills sandwiches (absent), a sub-30 non-bowl, and a second chicken method that is not the one sheet-pan roast.

Not a rename of Sheet-Pan Lemon Herb Chicken: breast cutlets, skillet dredge, rolls, no potatoes or green beans. Not a taco or a bowl.

## Equipment

- 12-inch skillet
- tongs
- instant-read thermometer
- meat mallet or heavy pan
- two shallow bowls or a bowl and a plate
- knife

Heat: Skillet over medium-high; lower to medium only if the crust darkens before the center is done.

Doneness: 165°F in the center of each cutlet. Color is not the doneness test.

## Ingredients

Quantities are for 4 servings. Preparation is not part of the shopping id.

- `boneless-skinless-chicken-breast` — 1 lb boneless skinless chicken breast; prep: pounded to 1/4 inch; note: 2 breasts, butterflied into 4 pieces
- `kosher-salt` — 1 tsp kosher salt; note: divided: 3/4 tsp on the chicken, 1/4 tsp in the sauce
- `black-pepper` — 0.5 tsp black pepper
- `garlic-powder` — 0.5 tsp garlic powder
- `all-purpose-flour` — 0.5 cup all-purpose flour
- `eggs` — 2 count eggs; prep: beaten
- `canola-oil` — 4 tbsp canola oil; note: divided: about 2 tbsp for each skillet batch
- `mayonnaise` — 8 tbsp mayonnaise; note: store-bought; egg and oil style, dairy-free — check the label
- `dijon-mustard` — 1 tbsp dijon mustard; note: store-bought
- `lemon` — 1 count lemon; note: zest plus juice
- `fresh-parsley` — 2 tbsp fresh parsley; prep: chopped
- `garlic` — 1 clove garlic; prep: minced
- `sandwich-rolls` — 4 count sandwich rolls; note: soft rolls, split
- `tomato` — 1 count tomato; prep: sliced
- `romaine-lettuce` — 1 count romaine lettuce; note: 4 large leaves

## Components

- **lemon-dijon mayonnaise** — made in the recipe: True. Store-bought finished component: False.

## Steps

### 1. Pound and season

Butterfly the boneless skinless chicken breast into 4 pieces and pound each to about 1/4 inch. Pat dry. Season both sides with 3/4 tsp of the kosher salt, the black pepper, and the garlic powder.

### 2. Mix the sauce

Stir the mayonnaise, dijon mustard, the zest and juice of the lemon, the fresh parsley, the garlic, and the remaining 1/4 tsp kosher salt. The mayonnaise is store-bought. This lemon-dijon mayonnaise is the only sauce. Use a dairy-free mayonnaise or the dairy-free label does not hold.

### 3. Dredge

Beat the eggs in a shallow bowl. Spread the all-purpose flour on a plate. Dip each piece in flour, then in egg, and set them on a clean plate. Let the excess egg drip off.

### 4. Sear

Heat a 12-inch skillet over medium-high. Add 2 tbsp of the canola oil. When it shimmers, add 2 pieces. Cook about 2 1/2 to 3 minutes per side, until the crust is deep golden and the center is 165°F. Repeat with the remaining 2 tbsp canola oil and the remaining pieces. If the crust darkens before 165°F, lower the heat to medium for the last minute. Do not crowd the pan.

### 5. Toast the rolls

Wipe out loose browned bits if they will scorch. Toast the sandwich rolls, cut side down, in the skillet over medium heat for about 45 to 60 seconds.

### 6. Assemble

Spread the lemon-dijon mayonnaise on the rolls. Add romaine lettuce, tomato, and a chicken cutlet. Serve right away. No fries and no pickles are part of this recipe.

## Scaling for 1, 2, and 4

Ratios from a base of 4: 1 serving ×0.25, 2 servings ×0.5, 4 servings ×1.

**1 serving.** One 4 oz cutlet, 1 roll, 2 slices of tomato, 1 lettuce leaf. Keep 1 egg even though the scaled amount is half an egg; a smaller egg wash still has to coat. Use about 2 tbsp flour, 1 tbsp canola oil, and 2 tbsp mayonnaise with 3/4 tsp dijon. One small garlic clove is enough. Cook in one batch, still to 165°F, about 3 minutes per side.

**2 servings.** Two cutlets in one batch. One egg is still enough. Halve the flour, oil, sauce, lemon (use half a lemon), parsley, and salt. Same skillet temperature and 165°F target.

**4 servings.** As written. Two skillet batches so the pan is not crowded. Oil is split, 2 tbsp then 2 tbsp.

Do not scale: skillet temperature; 165°F doneness; pounding to 1/4 inch.

## Curator preflight

This is Juniper's preflight for the frozen draft. It is not Vale's audit and it is not a PASS.

- **ingredient_instruction_reconciliation** — pass. Every listed ingredient name appears in a step. No finish item is introduced only in the method.
- **oil** — pass. The cooking fat is a named ingredient with a quantity and is used in the method: canola oil.
- **compounds** — pass. Lemon-dijon mayonnaise is mixed in step 2 from store-bought mayonnaise, store-bought dijon mustard, lemon, parsley, garlic, and salt. Mayonnaise and dijon are labeled store-bought. No unnamed sauce.
- **times** — pass. prep 12 + cook 16 = total 28. Step durations are written to match that sum without hiding a required wait.
- **scaling_1_2_4** — pass_with_rounding_notes. Base is 4 servings. Quantities scale by 0.25 / 0.5 / 1. See scaling_notes for cloves, eggs, wine, and time that must not be scaled blindly.
- **dietary_vs_ingredients** — revised r1, not a Vale pass. Structured allergens are poultry, egg, and wheat. Egg and wheat stay on the array even though they are outside the live enum. Dairy-free still depends on a dairy-free mayonnaise.
- **taste_vocabulary** — pass. vocabulary_tag_ids are existing D-02 slugs only. No invented beef/mussels/pork tag.
- **kitchen_tested** — pass. kitchen_tested is false. This preflight is not a kitchen test and not a Vale certification.
- **publication** — pass. publication_state is Draft. Not published. Not recommendation-eligible.

## Image

Frozen for Vale round 2. Not certified. Not published. Canonical audit asset is the v2-derived WebP, not v1.

- Audit / canonical image: `crispy-skillet-chicken-sandwiches.webp` (WebP 1200×900) and `crispy-skillet-chicken-sandwiches-640.webp` (WebP 640×480), converted from `img_v2.jpg` only. Image id `img_crispy-skillet-chicken-sandwiches_v2`.
- `img_v1.jpg` is still in this folder and is not the audit image. Vale r1 Gate K: thick coarse breading. The recipe is a 1/4-inch flour-then-egg cutlet.
- Spec catalog paths are recorded as `/images/meals/crispy-skillet-chicken-sandwiches.webp` and `/images/meals/crispy-skillet-chicken-sandwiches-640.webp`. They were not copied into the app.
- Method: format and size conversion of img_v2.jpg. Model slug: unknown (C2PA softwareAgent on the JPEG is "Grok Imagine"; that label was not invented into a model id).
- Provenance token: `ai_illustration`. qa_state: pending_r2. Gate K is not granted until Vale looks at this WebP.
- Rights: not cleared for external release.
