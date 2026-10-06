# D-07 Catalog Discovery

Architecture for catalog search. Composer implements UI against this document and `docs/D07-QUERY-CONTRACT.md`. Opus is designing the screens on another branch. This branch does not render those screens, does not call a model, and does not deploy.

The published catalog is the 50-meal D1 catalog (`CATALOG_SOURCE=d1`). Discovery does not read `recipe-store.js` and does not fall back to the old 24-meal memory catalog. That split is what made swap resolve the wrong version.

## Ownership

| Path | Role |
|------|------|
| `src/discovery/` | Query, context, pipeline stages, reason codes, HTTP outline. |
| `src/lib/eligibility.js`, `src/lib/dinner-planner.js` `assessMealEligibility` | Hard eligibility. Discovery calls it. Discovery does not copy it. |
| `src/lib/diner-taste-rank.js` `scoreDinerTastes` | Taste score. Love and Like raise a meal. Less often lowers it and does not remove it. |
| `src/lib/classification.js` `preferenceTier` | D-01 soft tiers for Keep it easy and Keep ingredients simple. |
| `src/lib/recommendation-pipeline.js` | Tonight's 3–5 choice set. Discovery does not call it. |
| `POST /api/dinner-plans/:id/mutations` | The only plan write. Search does not swap or add. |
| D-06, later | Free text → `DiscoveryQuery`. Not in this branch. |
| D-05, later | Models. Not in this branch. |

`public/app.js` and `public/planning-ui.js` stay as they are. A screen that wants search sends the query in this contract and renders the response.

## Two different jobs

Tonight and Plan our dinners fill a small set. Discovery returns the eligible catalog that matches a query, ranked.

Search is read-only. After the person picks a card, the client calls the dinner-plan mutation named in `selection`. The mutation still runs eligibility. A discovery hit is not a promise that a later swap will succeed if the plan changed.

## Server and client

| Concern | Server | Client |
|---------|--------|--------|
| Household | Session household only. | Does not send `household_id`. |
| Hard limits | Loaded from `constraint_rule`. `assessMealEligibility`. | Does not send `constraints` or `eligible`. Those keys are `client_constraints_forbidden`. |
| Tastes | Loaded from `diner_taste`. Ranking only. | Does not send tastes. |
| Catalog | `loadPublishedCatalog` when `CATALOG_SOURCE=d1`. | Renders `results`. Does not ship a second catalog. |
| Query | `normalizeQuery`. The normalized query is the one that ran. | May build the same object. Server output wins. |
| Soft chips | Effective flags are `soft` plus `soft_source`. | Sends `soft` only when the person toggled a chip on this search. Omitting `soft` inherits the plan's chips in plan modes. |
| Plan write | Not this route. | Uses `selection.op` and the result's `recipe_version_id`. |
| Copy and layout | Reason codes. | Opus / Composer. Do not invent a second reason enum. |

## Context

`mode` is `standalone`, `replace_plan_meal`, or `choose_for_plan`.

The client sends ids. The server fills participants, the plan's chips, recent cooks, and the slugs to hide. In plan modes the server ignores a client `exclude_slugs` list (`exclude_slugs_not_allowed`).

| Mode | Required | Participants | Slugs hidden | Selection |
|------|----------|--------------|--------------|-----------|
| `standalone` | Nothing. A `dinner_plan_id` or `meal_id` is `dinner_plan_not_allowed` / `meal_not_allowed`. | Client `participant_ids`, or every active member. | Client `exclude_slugs` only. | `action: "none"`. |
| `replace_plan_meal` | `dinner_plan_id` and `meal_id`. | That meal's participants. | That meal's `recipe_slug`, so the current dinner is not offered again. Other nights stay searchable and count toward diversity. | `swap_meal` on that `meal_id`. |
| `choose_for_plan` | `dinner_plan_id`. | The named meal's participants when `meal_id` is set. Otherwise the client list, or every active member. | When `meal_id` is set, that row's slug if it has one. When `meal_id` is omitted, every recipe slug already on the plan. The plan must have an open night (`plan_full` when `emptyNightCount` is 0). | `swap_meal` when `meal_id` is set. `add_meal` when it is not. |

`replace_plan_meal` and `choose_for_plan` with a `meal_id` are for a recipe in `planned` or `selected`. Anything else is `outcome_locked`. Leftovers and eating out are not search targets. Turning one of those rows into a cooked dinner stays the Cycle 3 swap-sheet flow. Discovery does not compose a selection for them.

### Empty nights

Cycle 3 does not store an empty night as a meal row with a null slug. `createDinnerPlan` with `fill: "planner"` puts nights the planner could not fill on the returned `unfilled` list and does not insert those rows. `buildMeal` requires a `recipe_version_id`. What remains on the saved plan is a count: open nights are `meal_count − meals.length` (`emptyNightCount`). `set_count` can raise `meal_count` without adding rows. `remove_meal` renumbers the rows that are left. `add_meal` appends at `max(position) + 1` and fails with `plan_full` when `meals.length >= meal_count`.

Filling an empty night is `choose_for_plan` with `dinner_plan_id` and no `meal_id`. Selection is `add_meal`. The resolved `position` is null. A client `position` is not the address of a hole, and the server does not copy it onto the context. Sending a `meal_id` swaps that stored row. It does not fill a missing row, because the missing row has no id.

Find a dinner is still a Cycle 3 entry point. The screen chooses a mode. Opening search with no plan is `standalone`. Replacing one stored dinner is `replace_plan_meal` or `choose_for_plan` with that `meal_id`. Filling an open night is `choose_for_plan` without a `meal_id`.

### Soft chips travel with the mode

| `soft_source` | When |
|---------------|------|
| `query` | The request included `soft`. Explicit `false` is off. It does not inherit. |
| `plan_intent` | Plan mode, and `soft` was omitted. Flags come from the dinner plan's `intent.keep_it_easy` and `intent.keep_ingredients_simple`. |
| `default_off` | Standalone, and `soft` was omitted. Both chips off. |

A query-level `soft` does not write the plan. Saving the chips for later swaps is still `set_planning_preferences`. Discovery does not call that mutation.

These plan-intent fields are not discovery filters, even when the plan has them:

- `max_cook_minutes` (a planner score boost)
- `practical_hints`, including `under_30_minutes`
- `meal_styles` on the intent
- `requested_ingredient`
- household `exploration_appetite` and `spice_level`

If the person wants those as search limits, the query has to say so in `criteria`.

## Pipeline

The order is fixed. `runDiscoveryPipeline` throws if a stage is skipped or reordered.

1. **Context.** Drop `exclude_slugs` (`excluded_slug`). If no participants remain, drop the rest (`participants_required`). The HTTP layer usually returns `participant_required` before this, via `assertParticipants`.
2. **Hard eligibility.** `assessMealEligibility` for the slot's participants. A failing meal is `ineligible_hard_limit`. Tastes are passed through and do not grant permission. A meal with no planner `entry` fails closed.
3. **Text match.** Literal tokens. A miss is `text_miss`. Empty text keeps the set.
4. **Explicit criteria.** Hard filters from `criteria`. A miss uses that criterion's exclusion code.
5. **Run soft prefs.** Annotate `preference_tier` with `preferenceTier`. Does not drop.
6. **Taste ranking.** `scoreDinerTastes` for the participants. Does not drop. A scorer that sets `excludes: true` is a contract error.
7. **Novelty, diversity, recency.** Reorder inside a tier. Does not drop and does not cross a tier.
8. **Results.** Reason codes, 1-based `rank` on the full order, then `offset` / `limit`.

A meal blocked by a hard limit is not later called a text miss, even when the title matches the query.

## Hard eligibility

Hard limits always win. They run before text, before an Easy filter, before Keep it easy, and before taste.

The check is `assessMealEligibility` (live household tags intersected with `decideEligibility`). Cashew exceptions, per-diner rules, and shared rows stay in those modules. A discovery criterion cannot put a blocked meal back.

Client bodies named `constraints` or `eligible` are refused. An empty `constraints` array is still refused. The server array is the one that ran.

## Explicit criteria and D-01 chips

These are different fields. None of them is an alias of another.

| Person's words | Field | Effect |
|----------------|-------|--------|
| Filter to Easy | `criteria.effort_levels: ["easy"]` | Hard drop. `moderate` and `involved` leave the set. A 60-minute easy meal stays. |
| Keep it easy | `soft.keep_it_easy: true` | Soft tier. Easy, then moderate, then involved. Nothing is dropped. A higher tier is `soft_pref_relaxed`. |
| Quick | `criteria.quick: true` | Hard drop on the clock. `total_minutes` at or under 30 (`QUICK_MAX_MINUTES`). Unknown minutes fail closed (`detail: "minutes_unknown"`). |
| Under N minutes | `criteria.max_minutes` | Hard drop. Equal to N stays. Unknown minutes fail closed. This is not plan-intent `max_cook_minutes`. |
| Simple ingredients as a filter | `criteria.ingredient_complexities: ["simple"]` | Hard drop on D-03 `ingredient_complexity`. |
| Keep ingredients simple | `soft.keep_ingredients_simple: true` | Soft tier. Simple, then standard, then adventurous. Nothing is dropped. |
| Pantry, already have | Not a field | `pantry_not_a_filter`. There is no pantry table. Already-have is a shopping-list state. |

`weeknight` on a dish is not Quick. `effort_level` is not minutes. The removed display string `effort` and `effort_band` are not accepted (`unknown_field`).

Both chips on use the D-01 ladder in `BOTH_PREFS_RELAXATION`: easy+simple, then easy+standard, then easy+adventurous, then moderate, and so on. Discovery calls `preferenceTier`. It does not keep a second copy of that table.

An explicit Easy filter and Keep it easy may both be set. The filter runs in stage 4. The chip only sorts what survived. The card's primary reason prefers `explicit_effort` over `soft_keep_easy`.

Unknown `effort_level` or `ingredient_complexity` fails an explicit filter that names a band. With only the soft chip, an unknown band sorts after the known bands. It is not treated as easy or simple.

Within one list, any token matches (Mexican or Korean). Across lists, every active list must match. `exclude_ingredients` fails the meal when any excluded token is present.

Ingredient match uses canonical ingredient ids, vocabulary tags, and `primary_ingredient`. It does not scan step prose. A title-only mention is not an exclusion. Meal style matches a meal-style vocabulary tag or `meal_format`.

### Cuisine

Cuisine matches `dish.cuisine` or a cuisine vocabulary tag. Normalize expands a base token to that token and `{token}-inspired`, so `italian` hits a meal stored as `italian-inspired`. The canonical query lists both. A token that already ends in `-inspired` is not expanded backward: sending only `italian-inspired` does not also match `italian`. This is not a synonym table. `greek` does not match `mediterranean`, and `cajun` does not match `american`. The UI does not have to send both forms.

### Collections

Oversight shelves are criteria, not hand-curated slug lists. A meal with no signal for that criterion is excluded. Discovery does not invent a label from the title, from a missing field, or from the absence of meat.

| Shelf | Query | Catalog fields | Missing signal |
|-------|--------|----------------|----------------|
| Fish & seafood | `criteria.protein_groups: ["seafood"]` | Union of eligibility tags (`concept.tags`, the published `eligibility_tags`) and `pkg.allergens`. `finfish` or `fish` fills `fish`. `shellfish` fills `shellfish`. Either fills `seafood`. | No token in that union: `explicit_protein`. Title, `primary_ingredient`, ingredient vocabulary (`salmon`, `shrimp`), and a dietary label of `fish` are not signals. |
| Fish, or shellfish | `["fish"]` or `["shellfish"]` | The same union, one family only. | Same exclusion. |
| Plant-forward | `criteria.diet: ["plant"]` | Stored `dietary_labels`. Normalize expands `plant` to `plant`, `plant_based`, and `vegetarian`. | No one of those labels: `explicit_diet`. |
| Dairy-free, vegetarian, plant-based chips | `criteria.diet` with that one value | The same `dietary_labels`, exact. `dairy_free` does not expand to plant. `vegetarian` does not include `plant_based`. | Same exclusion. |
| Something different | `criteria.different: true` | `recent_slugs`, the last eight real cooks, after hard eligibility. | Empty `recent_slugs`, or `recent_source: "unavailable"`: every meal is `explicit_different` with `detail: "no_recency_signal"`. A slug in `recent_slugs` is `detail: "recent_cook"`. |
| Crispy, creamy, crunchy, tender | `criteria.textures` | Active texture terms on `vocabulary_tag_ids`, plus `dish.texture` when that value is itself an active texture term. | No texture term: `explicit_texture`. |

`meat` or `poultry` in the same eligibility-tag and allergen union removes the meal from `fish`, `shellfish`, and `seafood`. Chicken pho that contains fish sauce stays out of Fish & seafood. A shrimp pasta whose only stored signal is allergen `shellfish` stays in.

Plant-forward does not read `vegetarian_compatible` or `plant_based_compatible`. Those booleans are import metadata, not runtime labels. It does not treat "no meat tag" as plant. There is no stored `vegan` label; sending `vegan` is `diet_invalid`. Household hard limits still run in stage 2 through `assessMealEligibility`. `criteria.diet` is not an extra diner and does not relax a prohibition.

Something different is a stage-4 filter. It does not drop a whole cuisine, and it does not include a meal because someone marked it less often. Less often remains a taste penalty in stage 6. Survivors are still taste-ranked, then stage 7 may reorder inside the taste band. Exploration is that tie-break. It is not the collection gate. A cook history that failed to load does not label the whole catalog as different.

`criteria.flavors` stays flavor vocabulary plus `flavor_profile`. Texture words are not flavors. `dish.texture` value `mixed` is not a texture term, so it matches no texture chip. A title that says Crispy, with no texture tag, matches no texture chip.

Closed lists are `PROTEIN_GROUP_FILTERS`, `DIET_FILTERS`, and `TEXTURE_FILTERS`.

### Deferred

Facet counts are not in V1. The response has no `facets` object. `excluded_counts` stays the count of meals removed, by exclusion code. The UI does not invent a count per cuisine, diet, or texture option.

Leftovers and eating-out rows stay `outcome_locked`. A composed "plan a dinner here instead" selection is not part of this contract.

## Text

Lowercase tokens of letters and digits. Every token must hit the title, cuisine, meal format, primary ingredient, flavor profile, vocabulary tags, ingredient names, methods, or equipment. A token of three or more characters may be a prefix (`taco` matches `tacos`). A two-character token has to match a whole token. This is not stemming and not D-06.

## Taste

Stage 6 calls `scoreDinerTastes` for the participants. Household-origin rows count. An inferred row does not replace an explicit one. Scores are a sum of per-diner nudges, not a household average.

Discovery does not call `scoreMealsForHousehold` or `buildRankedChoiceSet`. Those functions return three to five Tonight options and fold fatigue into the score. Search needs the full surviving set, with recency applied in stage 7.

Sort inside a tier is taste score descending, then text match score, then `recipe_slug`. Less often can place a meal last. It cannot remove it. Code `taste_less_often`.

## Novelty, diversity, recency

Inside one preference tier, take the meals within `DISCOVERY_TASTE_BAND` (0.5) of that tier's best taste score. That is the same band the planner uses. A meal below the band keeps taste order and is not pulled up to vary the page.

Inside the band, prefer:

1. A meal that is not in `recent_slugs`.
2. A cuisine not yet used on this page or already on the plan (`plan_slugs` resolved through the catalog).
3. A primary ingredient not yet used the same way.
4. Higher `exploration`.
5. `recipe_slug`.

`recent_slugs` are the household's last eight real cooks, the same window as `loadRecommendationContext`. The field `recent_source` is `cook`, or `unavailable` when that read fails. Dinner-plan history is not a second recency list. Stage 7 reorders and does not remove a meal. The code on the card is `recent_demoted`. A clearly better score outside the band stays ahead of a new meal. Removing recent cooks is only `criteria.different` in stage 4.

`diversity_preferred` means this meal moved ahead of a higher-taste neighbor because cuisine or ingredient was already used. `novelty_tiebreak` means `exploration` won a tie on the keys above it. `exploration_appetite` is not read.

## Reason codes

Exclusions are counts in `excluded_counts`. They are not cards. The codes are `EXCLUSION_CODES` in `src/discovery/constants.js`.

Ranking codes are `RANK_REASON_CODES`. A result lists every code that applies. `primary_reason` is the first of these that applies:

1. `taste_love`, `taste_like`
2. `explicit_effort`, `explicit_quick`, `explicit_max_minutes`, `explicit_complexity`, `explicit_ingredient`, `explicit_exclude_ingredient`, `explicit_cuisine`, `explicit_meal_style`, `explicit_flavor`, `explicit_method`, `explicit_equipment`, `explicit_protein`, `explicit_diet`, `explicit_texture`, `explicit_different`
3. `text_match`
4. `soft_keep_easy`, `soft_keep_simple`
5. `taste_less_often`
6. `soft_pref_relaxed`
7. `recent_demoted`, `diversity_preferred`, `novelty_tiebreak`
8. `eligible_catalog_fit` when nothing else applies

`soft_keep_easy` is only present when the chip is on and the meal's `effort_level` is `easy`. `explicit_effort` is only present when an effort filter was set and the meal matched it. A relaxed tier is `soft_pref_relaxed` and the meal is still in `results`.

D-01 card badges stay Easy and Simple ingredients. The API still returns `effort_level` and `ingredient_complexity` for every band so the client can follow that rule without guessing.

## HTTP

| Method and path | Role |
|-----------------|------|
| `POST /api/discovery/search` | Body `{ "schema_version": 1, "mode", "context", "query" }`. |
| `GET /api/discovery/search` | The same query as a query string. See the query contract. |

Session required, same as dinner plans. Another household's plan is `403 forbidden_cross_household`. An unknown plan is `404 plan_not_found`. `CATALOG_SOURCE` other than `d1` is `503 catalog_source_required`. The route does not plan from memory.

`selection` tells the client which mutation to send. `recipe_version_id` has to be the chosen result's published id. `swap_meal` without that id calls `swapSlot` and picks for the person.

```json
{
  "action": "swap_meal",
  "method": "POST",
  "path": "/api/dinner-plans/dp_1/mutations",
  "op": "swap_meal",
  "meal_id": "dpm_1",
  "participant_ids": ["m1"],
  "recipe_version_id_from": "result"
}
```

`add_meal` uses the same path, `op: "add_meal"`, a null `meal_id`, and the same `participant_ids`. The mutation body is `{ "op", "meal_id", "recipe_version_id", "participant_ids" }` with nulls omitted. Search does not send it.

The response also includes `catalog_source: "d1"`, `catalog_size`, the canonical `query`, public `context` (no constraints, no tastes), effective `soft`, `soft_source`, `excluded_counts`, `trace`, `results`, `limit`, `offset`, `total`, and `recent_source`. `rank` is the place in the full order, so a second page continues the numbering. `total` is the count before the page.

Result cards carry identity and rank fields only: slug, published version id, recipe id, title, cuisine, meal format, primary ingredient, minutes, both D-03 enums, exploration, tier, taste score, taste hits, match score, reasons, primary reason. They do not carry the planner entry, the ingredient list, or eligibility rows. Recipe detail stays `GET /api/recipes/:slug`.

## D-06 boundary

`interpretFreeText` returns `{ ok: false, error: "nlp_not_in_d07", owner: "D-06" }`. D-07 executes a normalized `DiscoveryQuery`. D-06 will later fill that object. D-05 will later own models. This branch has no model client and no phrase parser.

`NLP_BINDING_RULES` is the map a future interpreter has to honor:

| Binding | Writes | Must not write |
|---------|--------|----------------|
| Keep it easy | `soft.keep_it_easy` | `criteria.effort_levels`, `criteria.quick`, `criteria.max_minutes` |
| Keep ingredients simple | `soft.keep_ingredients_simple` | `criteria.ingredient_complexities`, pantry, already-have |
| An explicit Easy ask | `criteria.effort_levels: ["easy"]` | the Keep it easy chip, Quick |
| An explicit Quick ask | `criteria.quick: true` | effort, the Keep it easy chip |
| An explicit Simple ask | `criteria.ingredient_complexities: ["simple"]` | the Keep ingredients simple chip, pantry |
| Fish and seafood | `criteria.protein_groups: ["seafood"]` | ingredient slugs, the title |
| Plant-forward | `criteria.diet: ["plant"]` | `constraints`, `eligible` |
| Something different | `criteria.different: true` | a less-often include, dropping a cuisine |
| Crispy or creamy | `criteria.textures` | `criteria.flavors` |
| Leftover words | `text` | criteria and soft |

Unresolved phrases come back beside the query. They are not dropped into a guessed filter. Until D-06 exists, a search box sends `query.text` and the token matcher runs.

## Notes for Composer

- Import from `src/discovery/index.js`. Do not re-declare modes, reason codes, or the 30-minute Quick constant.
- Images: `public/meal-media.js` still title-maps the original 24 meals. The catalog is 50. Pass `recipe_slug` (and `recipe_version_id`) into image lookup. Do not grow the title map in this work. A slug path is the cheap fix when media is touched; a title-only match stays known debt.
- Do not filter dairy, nuts, or the other hard rules in the client. Show `excluded_counts.ineligible_hard_limit` if the empty state needs a count.
- Do not hide `moderate` or `involved` meals when only Keep it easy is on. Do hide them when `effort_levels` is `["easy"]`.
- Do not treat Simple as "what is in the kitchen."
- Fish & seafood is `criteria.protein_groups: ["seafood"]`. Plant-forward is `criteria.diet: ["plant"]`. Something different is `criteria.different: true`. Crispy and creamy are `criteria.textures`. Do not ship a hand-curated slug list for those shelves.
- Send a base cuisine token. The server adds `{token}-inspired`. Do not also require the UI to send every inspired variant.
- An empty night has no meal row. Fill it with `choose_for_plan` and no `meal_id` (`add_meal`). Do not look for a null slug.
- Do not render per-option facet counts. The response does not include them.
- Pinned versions on the plan are not a search index. Results are the current published version. The follow-up mutation pins that id.
- `trace` is for tests and debugging. The screen can ignore it.
- No production deploy from this work.

## Tests

`test/discovery-query.test.js` covers normalize, cuisine and plant expansion, the Quick/Easy/Simple/pantry split, fixture round-trips, empty-night selection, mode context, and the HTTP outline.

`test/discovery-pipeline.test.js` covers stage order, hard-limit before text, explicit Easy versus Keep it easy, Quick versus a long easy meal, Simple versus pantry, the shared preference tier, less-often still returned, `assessMealEligibility` on dairy, recency inside the taste band, diversity without drops, seafood and plant collections, cuisine expansion at match time, texture tags, and something-different versus taste.
