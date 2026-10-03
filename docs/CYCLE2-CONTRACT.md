# Cycle 2 contract

Shared taste vocabulary and recipe package for FlavorWeave Campaign Cycle 2 (D-02 and D-03). Later workstreams implement taste UX and catalog content against this document and the modules below. This workstream does not build those surfaces.

Branch: `feature/fw-c2-contract`. No pull request. Not merged to `main`. Not deployed. Production D1 `23aa3db3-1090-471b-8c8a-b6fe71f5c053` and Household 001 were not written.

## Ownership

| Path | Role |
|------|------|
| `src/lib/taste-vocabulary.js` | Curated terms. Source of truth for slugs. |
| `src/lib/taste-resolver.js` | Alias resolution. Does not insert terms and does not call a model. |
| `src/lib/cycle2-schema.js` | Enums, labels, and table names. |
| `src/lib/preference-concepts.js` | Hard limits, taste ranks, planning hints, explicit vs inferred, targeted feedback. |
| `src/lib/legacy-preference-audit.js` | Mapping of current hard-coded values. Unresolved stays unresolved. |
| `src/lib/recipe-package.js` | Package shape, projection of the current 24 meals, version rules. |
| `migrations/0010_cycle2_taste_contract.sql` | Empty contract tables. Apply only after 0009. |

Not owned here: `public/app.js` and the rest of onboarding, the rating screen, `src/lib/taste-model.js`, `src/lib/eligibility.js` (still the live checker), and the 24 meal bodies in `src/lib/recipe-store.js`.

## Taste vocabulary

One list for diner tastes and recipe descriptions. Each term has a stable slug, display name, category, synonyms, an active flag, and an optional parent. No starter term uses a parent. Add a parent only when a real rollup needs it. A parent is not a search alias.

Categories: `cuisine`, `flavor`, `texture`, `meal_style`, `ingredient`.

Active terms resolve. An inactive term still exists for old rows and does not resolve for a new choice. Search never inserts a term.

### Cuisines

| Slug | Display name | Aliases |
|------|----------------|---------|
| `mexican` | Mexican | |
| `indian` | Indian | indian inspired |
| `thai` | Thai | thai inspired |
| `mediterranean` | Mediterranean | |
| `japanese` | Japanese | japanese inspired |
| `italian` | Italian | italian inspired |
| `korean` | Korean | |
| `chinese` | Chinese | chinese inspired |
| `middle-eastern` | Middle Eastern | |
| `north-african` | North African | |
| `american` | American | |
| `scandinavian` | Scandinavian | scandinavian inspired |
| `moroccan` | Moroccan | |
| `californian` | Californian | |

### Flavors

| Slug | Display name | Aliases |
|------|----------------|---------|
| `smoky` | Smoky | bbq, barbecue, barbeque, bar-b-que, bar b que, smoked |
| `citrusy` | Citrusy | citrus, bright |
| `savory` | Savory | savoury |
| `spicy` | Spicy | |
| `tangy` | Tangy | |
| `rich` | Rich | |
| `fresh` | Fresh | |
| `umami` | Umami | |
| `herbaceous` | Herbaceous | |

BBQ resolves to `smoky`. There is no `barbecue` row.

### Textures

| Slug | Display name | Aliases |
|------|----------------|---------|
| `crispy` | Crispy | crisp |
| `creamy` | Creamy | |
| `crunchy` | Crunchy | crunch |
| `tender` | Tender | |

### Meal styles

| Slug | Display name | Aliases |
|------|----------------|---------|
| `tacos` | Tacos | taco, taco night |
| `bowls` | Bowls | bowl |
| `soups` | Soups | soup |
| `pasta` | Pasta | |
| `grilled` | Grilled | grill, grilling |
| `curries` | Curries | curry, curry bowls |
| `sandwiches` | Sandwiches | sandwich |
| `stews` | Stews | stew |
| `stir-fries` | Stir-fries | stir fry, stir-fry |

`grill` in taste search is the meal style Grilled. Grill-friendly is a planning hint, not this term.

### Ingredients

| Slug | Display name | Aliases |
|------|----------------|---------|
| `mushrooms` | Mushrooms | mushroom |
| `tofu` | Tofu | |
| `salmon` | Salmon | |
| `eggplant` | Eggplant | aubergine |
| `swordfish` | Swordfish | |
| `chickpeas` | Chickpeas | chickpea |
| `shrimp` | Shrimp | |
| `chicken` | Chicken | |
| `lentils` | Lentils | lentil |
| `cod` | Cod | |
| `cauliflower` | Cauliflower | |
| `soba` | Soba | |
| `carrots` | Carrots | carrot |
| `arctic-char` | Arctic char | arctic char |
| `polenta` | Polenta | |
| `rice-noodles` | Rice noodles | rice noodles |
| `peaches` | Peaches | peach |

Shrimp, chicken, salmon, cod, arctic char, and swordfish are tastes a diner can rank. They do not grant permission to eat shellfish, poultry, or finfish.

### Resolution

`resolveTasteTerm` in `src/lib/taste-resolver.js`:

1. Trim, lowercase, turn `&` into `and`, drop apostrophes, and turn other punctuation into spaces.
2. Look up that exact key on the slug, the display name, and the aliases.
3. Return the active term, `inactive` if the term is turned off, or `unresolved`.
4. Do not stem, do not match a substring, and do not insert a row.
5. Do not call a model.

Unknown stays unknown. `dragonfruit smoke`, `sheet`, `fish`, `weeknight`, and `grill-friendly` do not resolve to a taste.

### Current catalog counts

`catalogVocabularyCoverage()` counts how many of the 24 projected packages carry each slug. A zero is a zero. The number is not a claim that dinners are plentiful or scarce.

These required or starter terms are on **zero** current packages: `korean`, `savory`, `spicy`, `tangy`, `rich`, `fresh`, `crunchy`, `sandwiches`, `swordfish`.

`citrusy` is on 16 packages because the existing spark `bright` maps to it. `smoky` is on 1. The lentil stew title is not treated as smoky. The peach bowl title is not treated as grilled.

## Three concept types

### Hard limits

Hard limits decide eligibility. A rating, a taste, an inferred note, and a planning hint never override one.

| Id | Meaning |
|----|---------|
| `allergy` | Named substance. `substance` is required. |
| `prohibited_ingredient` | Named substance. `substance` is required. |
| `no_meat` | Meat and poultry. |
| `no_poultry` | Poultry only. Red meat can remain. |
| `no_shellfish` | Shellfish. |
| `no_dairy` | Dairy. |
| `no_nuts` | Nuts, including cashew, unless `cashew_permitted` is on for that diner. |
| `cashew_permitted` | Relaxes `no_nuts` for cashew only. A bare `nuts` tag still blocks. Another nut still blocks. |
| `no_finfish` | Finfish. Permission is the absence of this limit. It is never a taste rank. |

A meal is eligible only when every diner's limits clear it. One diner's cashew exception does not clear another diner's nut limit. `decideEligibility` accepts tastes, ratings, inferred rows, and hints and does not read them for the decision.

`src/lib/eligibility.js` remains the live checker, including its dish-name pass. `decideEligibility` agrees with it on the named catalog cases in `test/preference-concepts.test.js`. The package itself uses allergen ids and vocabulary ids. It does not read a title to invent an allergen. Catalog work has to put those ids on the package.

### Personal tastes

Ranks: `love` (Love), `like` (Like), `less_often` (Less often). `remove` deletes that diner's row. It does not write a ban, an allergy, or a limit.

Less often only sorts a meal lower. It is not an exclusion.

Tastes belong to `member_id`. `combineTasteRanks` throws. There is no household average.

One row per diner per slug. An inferred write does not replace an explicit one.

### Planning hints

| Key | Label | Notes |
|-----|--------|--------|
| `under_30_minutes` | Under 30 minutes | |
| `low_cleanup` | Low cleanup | |
| `grill_friendly` | Grill-friendly | Not the Grilled meal style. |
| `equipment` | Equipment | Requires `detail`, such as `sheet-pan` or `grill`. |
| `weeknight` | Weeknight | |

Every hint is overridable. `planningNote` can say whether a recipe fits. `blocks` is always false. Hints are not taste evidence and not eligibility. The planner UI is not built.

The catalog flag `weeknight: true` is a code default. It is not a diner hint.

## Explicit and inferred

| Stance | Who owns it | Diner-facing line |
|--------|-------------|-------------------|
| `explicit` | The diner. Editable. | You told us |
| `inferred` | Tentative. Correctable. Carries an internal confidence from 0 to 1. | We're learning |

`presentStance` does not return that confidence. Do not show a score, a percent, or other statistical wording.

A meal rating does not create a taste for each ingredient or attribute on the plate. `attributeTastesFromMealRating` returns an empty list.

Inferred tastes never override a hard limit, and they never replace an explicit taste.

### Targeted feedback

Optional, one diner, one recipe version. Not required to save a rating. Does not write a standing taste or a hard limit.

| Code | Label | Signal | Taste slug |
|------|--------|--------|------------|
| `loved_the_crunch` | Loved the crunch | `loved` | `crispy` |
| `too_spicy` | Too spicy | `too_much` | `spicy` |
| `great_sauce` | Great sauce | `loved` | none |
| `too_rich` | Too rich | `too_much` | `rich` |

`great_sauce` does not create a sauce term. Too spicy and too rich are not bans.

## Legacy values

`classifyLegacyValue` and `auditKnownClientPreferences` are the audit. Mapped means the old value has one clear home. Unresolved means it was left alone.

### Mapped from the client

| Source | Value | Lands on |
|--------|--------|----------|
| constraint | `dairy` | `no_dairy` |
| constraint | `meat` | `no_meat` (includes poultry) |
| constraint | `poultry` | `no_poultry` |
| constraint | `fish` | `no_finfish` |
| constraint | `shellfish` | `no_shellfish` |
| constraint | `nuts` | `no_nuts` |
| constraint | `cashew_ok` | `cashew_permitted` |
| spark | `crispy` | texture `crispy` |
| spark | `tacos` | meal style `tacos` |
| spark | `curry` | meal style `curries` |
| spark | `bright` | flavor `citrusy` |
| spark | `sheet` | planning equipment `sheet-pan` |
| evidence kind | `like` | Like, once the tag itself resolves |

Stored `preference_evidence` rows are not rewritten. `like` / `dislike` / `neutral` stay in that table until a later writer uses `diner_taste`.

### Unresolved on purpose

| Source | Value | Why it was left |
|--------|--------|-----------------|
| constraint | `none` | Empty-list sentinel, not a stored rule. |
| spark | `fish` | Finfish permission is eligibility, not a liking. Salmon, cod, and the other named fish stay ingredients. |
| evidence kind | `dislike` | Not clearly Less often, and not a ban. |
| evidence kind | `neutral` | No Love, Like, or Less often rank. |
| presentation | `avoid` | Explanation chrome, not a limit or a rank. |
| weeknight flag | default true | Not a diner hint. |
| cuisine | `asian-fusion` | Not one cuisine. |
| flavor | bare `savory` | Code default when `flavor_profile` is omitted. Diner-chosen Savory still exists. |
| flavor | `warm-spiced` | Not clearly spicy, smoky, or savory. |
| texture | `mixed` | Code default. |
| meal format | `fillet`, `handheld`, `packet`, `plate`, `side-main` | Not one meal style. `plate` is also the code default. |
| method | sole `stovetop` | Code default. A stovetop listed with another method is equipment. |
| primary ingredient | `beans` | Does not say which bean. |
| primary ingredient | `pasta` | Pasta is the meal style, not a second ingredient. |
| tag | `seafood` | Could be finfish, shellfish, or both. |
| title words | smoky lentil, grilled peach | Titles are not stored taste metadata. |

Inspired cuisines map to the named cuisine (`indian-inspired` to `indian`). That does not claim the recipe is a certified example of that cuisine.

### Household 001 backfill

Documentation only. Do not write production D1 or Household 001.

Future rows, when a later release is explicitly authorized:

| rule_key | status |
|----------|--------|
| `nuts` | prohibited |
| `cashew` | permitted |
| `dairy` | prohibited |
| `meat` | prohibited |
| `poultry` | prohibited |
| `shellfish` | prohibited |

Finfish is not in that list. `HH001_CASHEW_BACKFILL.write_production` is false.

## Recipe package

Chain: **Dish → Recipe → Recipe Version → Meal / outcome**.

A dish id is stable. A recipe id is one formulation of that dish. A recipe version id is an immutable snapshot. A meal option and a rating already point at a version through `recipe_version_id`. Publishing version 2 inserts a new version. It must not change version 1. A shopped plan keeps the ingredient list stored on `shopped_plan_line` for the version that was shopped.

`publishNextVersion` and `shopIngredients` enforce that in code. Migration 0010 does not use a trigger, because D1 splits a migration file on semicolons.

### Fields

| Field | Rule |
|-------|------|
| `dish_id` | Stable dish. Current projection uses `concept_id`. |
| `recipe_id` | Stable recipe. Current projection uses `rcp_<concept_id>`. |
| `recipe_version_id` | Immutable. Current projection keeps `rv_<slug>_v1`. |
| `version_number` | Moves forward only. |
| `title` | Required to publish. |
| `description` | Required to publish. Current meals have none, so the projection leaves it null. |
| `ingredients[]` | `name`, numeric `quantity`, `unit`. Legacy strings are parsed only when the amount and unit are plain. |
| `base_servings` | Integer, at least 1. |
| `equipment` | List. Not a diner hint. |
| `prep_minutes`, `cook_minutes`, `total_minutes` | Total is prep plus cook when all three are set. |
| `steps[]` | Ordered `step_number`, title, body. Bodies are copied, not rewritten. |
| `heat`, `doneness` | Optional. Null on the current projection. Step prose was not mined. |
| `dietary_labels` | From diet tags such as `plant` and `dairy_free`. |
| `allergens` | From allergen tags. `fish` and `finfish` both become `finfish`. |
| `vocabulary_tag_ids` | Slugs from this vocabulary only. `bbq` is not a valid id. `smoky` is. |
| `provenance` | See below. |
| `image.ref`, `image.provenance` | Association plus image provenance. |
| `publication_status` | See below. |
| `rights_state` | See below. |
| `kitchen_tested` | Boolean. Structural validation does not set it. |
| `validation_kind` | `structural_only` or `kitchen_tested`. |
| `visibility` | `global` or `household`. |
| `household_id` | Required for a household variation. Empty for a global recipe. |
| `data_origin` | `household`, `synthetic`, or `unproven`. |

### Enums

Recipe provenance: `original_team_created`, `licensed`, `ai_assisted`, `household_submitted`, `unknown_unverified`.

Image provenance: `original_photo`, `licensed_photo`, `ai_illustration`, `unknown`.

Rights: `not_cleared_for_external_release`, `cleared_for_external_release`, `unknown`.

Publication: `draft`, `published`, `unpublished`, `invalid`.

### Current 24 meals

`projectLegacyConcept` fills a package from stored fields. It does not invent a source.

- Provenance `unknown_unverified`.
- Image ref `/images/meals/<slug>.webp` with provenance `unknown`. The picture path is the existing association. It is not a claim about who made the picture.
- Rights `not_cleared_for_external_release`. There is no clearance record. This is the fail-closed rights value, not a legal review.
- `kitchen_tested` false. `markKitchenTested` throws for these version ids and for unknown provenance.
- Publication `unpublished`. `canRecommend` is false.
- `data_origin` `unproven`.

Leaving them unpublished does not remove them from the alpha recommender. The live path still uses `recipe-store.js`. They become recommendable through this contract only after a later workstream publishes a valid package. Unpublished, draft, invalid, and household-only packages cannot be recommended. A household variation uses its own recipe id, stays `household_submitted`, and does not become the global recipe.

Structural checks are not a kitchen test. No current recipe is marked kitchen-tested.

## Migration 0010

`migrations/0010_cycle2_taste_contract.sql` creates:

- `taste_vocabulary`
- `diner_taste`
- `diner_practical_hint`
- `recipe`
- `recipe_package_version`
- `shopped_plan_line`
- `targeted_feedback`

The vocabulary is not copied into SQL. Load it from `listVocabulary()` when a later release is ready. No alpha recipe rows are inserted. `kitchen_tested` defaults to 0.

The first statements insert and delete a sentinel household with `data_origin = 'unproven'`. That fails if 0009 has not run, so 0008 cannot be followed by 0010 alone. Do not apply 0008, 0009, or 0010 to production D1 in this campaign.

New learning rows keep `data_origin` of `household`, `synthetic`, or `unproven`. `learningTasteRows` uses the Cycle 1 gate. Synthetic and unproven rows stay out of taste learning, Completed Meal Loop counts, funnel events, traction events, and alpha ops. Those ops queries do not read the new tables.

Local proof is `test/migration-0010.test.js`: a database stopped after 0008 rejects 0010; a database at 0009 keeps its rows and gains empty contract tables; a clean chain through 0010 keeps synthetic and unproven rows out of the totals above.

## Left for later workstreams

- Onboarding and settings UI that read this vocabulary and the three concept types.
- Replacing spark chips and the client copies of the limit list.
- Rewriting the 24 meal bodies, descriptions, heat, doneness, and real provenance.
- Publishing those packages. Until then the live catalog is unchanged.
- A planner that reads practical hints. D-01 shopping and multi-dinner UX are not built. `shopped_plan_line` is the seam.
- D-04 native Back.
- D-05 model gateway and live generation. Resolution does not call a model.
- D-06 natural-language planning. The resolver is an alias table, not a sentence parser.
- Moving `dislike` and `neutral` evidence. They stay unresolved.
- The Household 001 cashew backfill.
