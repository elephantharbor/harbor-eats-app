# FlavorWeave Catalog Package

Canonical package: **Dish → Recipe → Recipe Version → Image metadata**.

This is not an ephemeral recommendation option. Dinner-plan meals pin an immutable recipe version. The importer in `src/lib/catalog-import.js` and the token map in `src/lib/factory-package-tokens.js` are the runtime contract. `catalog_contract` is `flavorweave-catalog-package`. A package the importer rejects is not done.

Reference packages: `factory/examples/sabich-pita-sandwiches` and `factory/examples/vietnamese-turmeric-dill-fish`.

## Dietary eligibility is not allergens

Keep both structures on every recipe version.

**`dietary_eligibility`** (hard classification):

- `contains_meat`, `contains_poultry`, `contains_finfish`, `contains_shellfish`, `contains_dairy` (booleans)
- `plant_based_compatible`, `vegetarian_compatible` (booleans)
- `nut_policy`: `none` | `cashews_only_ok` | `tree_nuts_present` | `peanuts_present`, with an explicit note for the Household 001 cashew rule

Do not put meat, poultry, finfish, or shellfish only in the allergen array and skip the booleans.

**`allergens`** (tokens present in the ingredients):

Factory tokens the importer accepts: `egg`, `milk`, `soy`, `wheat`, `sesame`, `peanut`, `tree_nut`, `cashew`, `shellfish`, `finfish`, `poultry`, `meat`.

`tree_nut` together with `cashew` and `nut_policy: cashews_only_ok` imports as `cashew`. Any other `tree_nut` imports as `nuts`. Unknown tokens fail the import. Notes do not replace the array.

**`dietary_labels`** the importer accepts: `dairy_free`, `vegetarian`, `plant_based`, `fish`. `plant_based` imports as `plant`.

## No conditional dietary claims

Do not write "dairy-free if the mayonnaise is dairy-free." Require the compliant ingredient in the contract, define the component, or delete the claim. An unresolved conditional fails certification gate G.

Household 001 (Tom and Renata): no dairy, no shellfish, no meat other than fish, no poultry. Nuts are out except cashews. Eggs, finfish, and sesame are allowed. `hh001_eligible: true` requires those booleans and `nut_policy` of `none` or `cashews_only_ok`, with the hard contract written on the package. Eligibility is not a quota.

## Identity

Directory name, `dish.dish_id`, and `dish.slug` are the same slug.

- `recipe.recipe_id` = `rcp_<slug>`
- `recipe_version.recipe_version_id` = `rv_<slug>_v1` for a first version
- `version_number` 1, `immutable: true`
- A later version sets `version_number` > 1 and `supersedes_recipe_version_id` to the prior `rv_<slug>_vN`

`kitchen_tested` is `false` on the recipe version and on `catalog_confidence`. `household_cooks` and `household_completed_ratings` are `0`. New AI meals are not kitchen-tested.

Provenance for factory text is `original_ai_assisted`. The importer maps that token to `ai_assisted`. Keep the factory token on the package.

`publication_status` stays `draft` until an authorized integrator publishes. `recommendation_eligible` stays `false` on an author package.

## Recipe version fields the importer reads

- Integer `base_servings` ≥ 1
- `prep_minutes`, `cook_minutes`, `total_minutes` with `total = prep + cook`
- `ingredients[]`: `name`, numeric `quantity`, `unit`. Also carry `ingredient_id`, `display_name`, `preparation`, `optional`, `role`, and a shopping `note` where the cook needs one
- `steps[]`: `step_number` starting at 1, in order, with a `body`. `ingredient_refs` use `ingredient_id`s
- `equipment[]` strings
- `methods[]` cooking tokens (see below)
- `vocabulary_tag_ids` — active slugs from `src/lib/taste-vocabulary.js` only
- `allergens`, `dietary_labels`, `dietary_eligibility`
- `effort_level`: `easy` | `moderate` | `involved`
- `ingredient_complexity`: `simple` | `standard` | `adventurous`

Do not author legacy `effort`, `effort_band`, or a freeform `complexity` string.

`components[]` names made or store-bought sub-recipes. A store-bought compound (a paste, a wrapper, a broth) gets a hard ingredient contract, not a conditional claim.

## Time

Prep, cook, and total reconstruct from the steps. If a bake would otherwise start a cold oven, put preheat minutes in the cook clock or start the oven in an earlier step and say the overlap. Quick (a short clock) is not Easy (a low effort score).

## D-03 classification

The author assigns both enums before freeze. Factor scores and closed reason codes live in `d03-classification.json` (and may be mirrored on `classification_sidecar`). They are not required runtime API fields.

Effort, five factors scored 0–2 each. Sum 0–2 easy, 3–5 moderate, 6–10 involved.

- Active prep
- Active attention
- Active components
- Technique
- Coordination, cleanup, and equipment

Floors: continuous attention (2) plus any other factor ≥ 1 is at least moderate. Technique 2 plus prep ≥ 1 or components ≥ 1 is involved.

Complexity, four factors scored 0–2. Sum 0–1 simple, 2–3 standard, 4–8 adventurous.

- Ingredient-count band. Counted items exclude salt, black pepper, water, and cooking oils. ≤12 → 0, 13–16 → 1, 17+ → 2
- Specialty burden (specialty-store items)
- Flavor-component breadth
- Pantry familiarity

Cuisine unfamiliarity adds no points. A specialty-store item scores once, under specialty burden, not again under pantry familiarity.

A classification-only change amends metadata on the same `version_number` and records `classification_history`. It does not create a culinary v2 and does not reopen image gates. The culinary hash excludes classification.

## Cooking methods (D-06.1)

`src/weave/semantics.js` `deriveCookingMethod` reads `methods`, the description, and step bodies. The title is used only when those three did not already classify the dish.

| Intended meaning | `methods` token | What the classifier records |
|---|---|---|
| Deep-fried | `deep-fry` | `frying: ["deep"]` |
| Pan-fried | `pan-fry` | `frying: ["pan"]` |
| Shallow-fried | `shallow-fry` | `frying: ["shallow"]` |
| Air-fried crisp | `air-fry` | `crispy_non_fry` includes `air_fried`. Not frying. |
| Baked or roasted crisp | `bake` or `roast` | `crispy_non_fry` includes `baked` and/or `roasted` when the text also says crisp. Not frying. |
| Stir-fry | `stir-fry` | `stir_fry: true`. Not frying. |

A bare `fried` or `frying` counts as pan. "Do not deep-fry" still counts as deep, because the classifier does not treat that negation as absence. Do not put frying words, including negated ones, into `methods`, `title`, `description`, or steps unless that frying kind is true.

Set `recipe_version.cooking` to the object `deriveCookingMethod` returns, plus a short `intent` string. Structural preflight fails if the derived result and the stored arrays disagree.

## Image slot

`image-plating-brief.md` is required before generation. `image-prompt.md` is the prompt the image pass will run. See `IMAGE-SPEC.md`.

When the task leaves images pending, `image.asset_generated` is `false`, derivative files are absent, and the brief is complete. Do not write denial strings that `freeze_integrity.py` treats as a corrupt freeze (`images not generated`, `blocked_no_image`, `unknown_no_asset`, `r0_images_missing`, `images missing`, or `image_provenance` = `missing`). Say the slot is `pending_image_pass`. Freeze integrity will still FAIL until the WebP pair exists. That is the correct signal. Re-freeze after the image pass.

When assets exist: master WebP 1200×900 and card WebP 640×480, dimensions recorded, generation provenance present (`method`, `generation_date`, `generator`, `model` — `unknown` is allowed), active paths not under `rejected/`. One active set. Superseded files live only in `rejected/`.

## Certification record

The author leaves `certification` null and `auditor` null. The auditor writes the gate record. The author does not.
