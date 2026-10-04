# Garlic Tomato Mussels with Grilled Bread

Mussels steamed in a garlic and crushed-tomato broth, finished with parsley and lemon, with oil-brushed bread toasted in a skillet.

Draft catalog package for FlavorWeave Catalog Factory Dry Run #1. Not kitchen-tested. Not certified. Not published. Do not import into recipe-store.

## Identity

- Dish id / slug: `garlic-tomato-mussels`
- Recipe id: `rcp_garlic-tomato-mussels`
- Recipe version id: `rv_garlic-tomato-mussels_v1`
- Cuisine: mediterranean
- Meal format: one-pot
- Primary ingredient: mussels
- Servings: 4
- Time: prep 15 + cook 13 = 28 minutes
- Effort: weeknight (straightforward)
- Publication state: Draft
- Provenance: original_ai_assisted
- Kitchen tested: false
- HH001 eligible: false — Shellfish is banned for HH001. Global catalog candidate. It is not a second shrimp pasta.
- Taste tags: mediterranean, savory, tangy, fresh, tender, crunchy
- Dietary labels: dairy_free
- Allergens: shellfish, wheat
- Allergen notes: Wheat (required crusty bread, baguette or ciabatta) is on the structured array with shellfish. Live PACKAGE_ALLERGEN_IDS has shellfish and no wheat id. That gap does not remove wheat from the array. Wine is not an allergen and was not added.

## Why this slot

Fills a second shellfish meal that is not shrimp pasta, a one-pot steam, a sub-30 non-bowl, and a briny tomato finish the catalog does not have.

Shares garlic, lemon, parsley, and olive oil with Lemon Garlic Shrimp Pasta. Those are pantry overlaps. The meal is a different animal, no pasta, a tomato-wine steam, and skillet bread. It is not a second shrimp sauté.

## Equipment

- wide 8-quart pot with lid
- skillet or grill pan
- tongs
- knife

Heat: Medium for the onion and garlic, then a 4-minute simmer, then medium-high under a lid for the mussels. Bread toasts over medium-high.

Doneness: Mussels are done when the shells open, usually 4 to 6 minutes. Discard any that stay closed. Do not cook them until they shrink.

## Ingredients

Quantities are for 4 servings. Preparation is not part of the shopping id.

- `mussels` — 4 lb mussels; prep: scrubbed and debearded; note: farmed, in the shell
- `olive-oil` — 3 tbsp olive oil; note: divided: 2 tbsp in the pot, 1 tbsp on the bread
- `onion` — 1 count onion; prep: diced; note: small yellow onion
- `garlic` — 6 clove garlic; prep: sliced
- `red-pepper-flakes` — 0.25 tsp red pepper flakes
- `crushed-tomatoes` — 15 oz crushed tomatoes; note: canned
- `dry-white-wine` — 0.75 cup dry white wine; note: not salted cooking wine
- `kosher-salt` — 0.5 tsp kosher salt
- `black-pepper` — 0.25 tsp black pepper
- `crusty-bread` — 1 count crusty bread; prep: sliced; note: one baguette or small ciabatta, 8 slices
- `fresh-parsley` — 0.25 cup fresh parsley; prep: chopped
- `lemon` — 1 count lemon; note: half juiced into the pot, half cut into wedges

## Components

- **tomato garlic broth** — made in the recipe: True. Store-bought finished component: False.

## Steps

### 1. Clean the mussels

Rinse the mussels under cold water and scrub the shells. Pull off any beards. Discard cracked shells, any mussel that smells off, and any mussel that stays open after a firm tap. Do not add a long salt soak; it is not part of this timing.

### 2. Prep the bread and aromatics

Slice the crusty bread into 8 pieces and brush the slices with 1 tbsp of the olive oil. Dice the onion, slice the garlic, and chop the fresh parsley.

### 3. Start the broth

Warm the remaining 2 tbsp olive oil in a wide 8-quart pot over medium heat. Cook the onion for 3 minutes, until softened. Add the garlic and red pepper flakes and cook 1 minute. Do not let the garlic brown.

### 4. Simmer

Add the crushed tomatoes, dry white wine, kosher salt, and black pepper. Simmer 4 minutes so the wine cooks off its raw edge and the tomatoes thicken slightly.

### 5. Steam the mussels

Raise the heat to medium-high. Add the mussels, cover the pot, and cook 4 to 6 minutes, until the shells open. Shake the pot once halfway. Discard any mussel that is still closed. Do not cook them longer or they turn rubbery.

### 6. Toast the bread

While the mussels steam, toast the oiled crusty bread in a skillet or grill pan over medium-high, about 1 to 2 minutes per side, until the edges char. This is a skillet char, not a separate grilled meal.

### 7. Finish

Take the pot off the heat. Squeeze in the juice of half the lemon and toss in the fresh parsley. Serve the mussels in their broth with the remaining lemon as wedges and the toasted bread. There is no pasta and no cheese.

## Scaling for 1, 2, and 4

Ratios from a base of 4: 1 serving ×0.25, 2 servings ×0.5, 4 servings ×1.

**1 serving.** 1 lb mussels and 2 slices of bread. Do not scale the liquid to a splash or the pot scorches: keep at least 1 tsp olive oil, 1 garlic clove, 2 tbsp diced onion, 1/4 cup crushed tomatoes, and 1/4 cup dry white wine. Steam time stays about 4 to 6 minutes. Still discard closed shells.

**2 servings.** 2 lb mussels. Halve the aromatics, tomatoes, parsley, and bread. Keep at least 1/3 cup wine. Same heat and the same open-shell test.

**4 servings.** As written. 1 lb mussels per person is a main, not an appetizer portion. Use a wide 8-quart pot so they cook in one batch.

Do not scale: medium and medium-high heat; 4 to 6 minute steam; discard-closed rule; minimum wine at small batches.

## Curator preflight

This is Juniper's preflight for the frozen draft. It is not Vale's audit and it is not a PASS.

- **ingredient_instruction_reconciliation** — pass. Every listed ingredient name appears in a step. No finish item is introduced only in the method.
- **oil** — pass. The cooking fat is a named ingredient with a quantity and is used in the method: olive oil.
- **compounds** — pass. The broth is built in the pot from listed ingredients. Crushed tomatoes are canned and labeled. Dry white wine is a plain ingredient, not a mystery cooking liquid. Bread is toasted, not a separate recipe. No pesto, crema, or bottled mussel sauce.
- **times** — pass. prep 15 + cook 13 = total 28. Step durations are written to match that sum without hiding a required wait.
- **scaling_1_2_4** — pass_with_rounding_notes. Base is 4 servings. Quantities scale by 0.25 / 0.5 / 1. See scaling_notes for cloves, eggs, wine, and time that must not be scaled blindly.
- **dietary_vs_ingredients** — revised r1, not a Vale pass. Structured allergens are shellfish and wheat. Wheat stays on the array even though it is outside the live enum. Notes do not replace the field.
- **taste_vocabulary** — pass. vocabulary_tag_ids are existing D-02 slugs only. No invented beef/mussels/pork tag.
- **kitchen_tested** — pass. kitchen_tested is false. This preflight is not a kitchen test and not a Vale certification.
- **publication** — pass. publication_state is Draft. Not published. Not recommendation-eligible.

## Image

Frozen for Vale round 2. Not certified. Not published.

- Audit image: `garlic-tomato-mussels.webp` (WebP 1200×900) and `garlic-tomato-mussels-640.webp` (WebP 640×480), converted from `img_v1.jpg`.
- Spec catalog paths are recorded as `/images/meals/garlic-tomato-mussels.webp` and `/images/meals/garlic-tomato-mussels-640.webp`. They were not copied into the app.
- Method: format and size conversion of the existing AI JPEG. Model slug: unknown (C2PA softwareAgent on the JPEG is "Grok Imagine"; that label was not invented into a model id).
- Provenance token: `ai_illustration`. qa_state: pending_r2.
- Rights: not cleared for external release.
