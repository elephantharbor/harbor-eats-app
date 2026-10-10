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
- effort_level: moderate · ingredient_complexity: standard (D-03; replaces legacy effort/complexity; see d03-classification.json and classification_history)
- Package revision: `freeze-r1` (matches v1.json)
- Publication state: Draft
- Provenance: original_ai_assisted
- Kitchen tested: false
- HH001 eligible: false — Poultry is banned for HH001. Global catalog candidate. It is the second chicken technique, not a second sheet-pan.
- Taste tags: american, sandwiches, chicken, crispy, tender, citrusy, savory, herbaceous
- Dietary labels: none claimed
- Dietary label note: No dietary labels claimed. dairy_free removed at freeze-r1 (Cora decision, Vale Gate G): the recipe has no hard dairy-free contract for the soft rolls or mayonnaise, so the claim would be conditional. Household eligibility unchanged: poultry already excludes this dish where relevant (HH001 false).
- Allergens: egg, wheat
- Dietary eligibility: contains_meat=false, contains_poultry=true, contains_finfish=false, contains_shellfish=false, contains_dairy=true, plant_based_compatible=false, vegetarian_compatible=false, pescatarian_compatible=false, nut_policy=none, hh001_eligible=false
- Allergen notes: Egg covers the 2 eggs in the dredge and the egg in the egg-and-oil mayonnaise. Wheat covers the all-purpose flour and the sandwich rolls. Poultry is not an allergen token; it is recorded as dietary_eligibility.contains_poultry = true. Live enum gap: PACKAGE_ALLERGEN_IDS does not include egg or wheat. Both stay on the array; see runtime_enum_gaps. Milk is not added as an allergen token: no milk ingredient is listed; contains_dairy=true is a conservative eligibility setting because roll/mayo dairy status is uncontracted. Vale G to confirm whether a 'milk' may-contain token is wanted.

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
- **dietary_vs_ingredients** — superseded at freeze-r1: no dietary labels claimed (dairy_free removed, Cora decision); contains_dairy conservatively true; contains_poultry true; allergens egg, wheat.
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

## Amendment freeze-r1 (2026-10-10 CT, hardening-1)

freeze-r1 (2026-10-10 CT, hardening-1): contract-forward creator amendment of the Dry Run #1 package. Records/classification only; recipe and images unchanged (culinary_hash unchanged). Changes: package_revision added; dietary_eligibility object added; poultry/meat moved from allergens to dietary_eligibility; D-03 effort_level/ingredient_complexity replace legacy effort/complexity; image.generation.generator added from existing generator_identity; image.dimensions converted to master/card format. culinary_hash `0c0cd0c7b7220636001787b27880334b1ef2108c6b9432047e289ea6d9b1c62b` (basis in v1.json culinary_hash_basis; identical to the dry-run-1 record). Image dimensions now recorded as master 1200×900 / card 640×480. structural_qa_state `freeze_r1_contract_forward_amendment_awaiting_preflight_and_vale`. The certification block records the Dry Run #1 Vale r2 PASS for the pre-contract record. It does not certify freeze-r1; freeze-r1 needs Vale re-audit (A, G, J-classification, M, N, O; see AMENDMENT-freeze-r1.md in this directory).
