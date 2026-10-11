# D-06.1 Semantic Decision Card

**Status.** Runtime contract for the shared fuzzy-intent module. This card does not redesign Plan or Find. Luna still returns a strict delta. Deterministic code still executes it.

**Module.** `src/weave/semantics.js` is the only place a vague word becomes a signal. `applyPlanningDelta` and `applyDiscoveryDelta` both call `applySharedSemantics`. Planning reads the result as a composition preference. Find reads it as a ranking or query signal. Neither path writes eligibility, taste evidence, or a health claim.

**Versions.** Prompt and schema move together: `planning_intent@4` (output cap 600) and `discovery_intent@4` (output cap 360). Both stay on `gpt-6-luna` with `reasoning_effort: none`. Structured outputs stay strict: `additionalProperties: false`, every property required, nullable unions, no `anyOf` / `oneOf`. The new required field is `concepts`, at most four `{ id, polarity }` objects. `id` is a free string so an unknown adjective still validates. Normalization, not the schema, decides whether it means anything.

**Out of this card.** Ambiguous-day UI, the stepper, and the mobile keyboard are designed separately. Starter-prompt UI and cleanup scripts are later. This card locks only the backend those screens call.

---

## 1. Canonical vocabulary

Surface phrases live in the module. Runtime state stores only the ids below, plus the closed rank tokens in §4. An unknown word is not a concept.

| id | Signals it may set | It does not mean | Role |
| --- | --- | --- | --- |
| `light` | cue `light` | calories, a nutrition score, a medical diet, a hard filter | ranking boost |
| `hearty` | cue `filling` | a guaranteed portion, a hard style filter | ranking boost |
| `fresh` | cue `fresh` | raw-only, a safety claim | ranking boost |
| `comforting` | cue `comforting` | a required soup, a health judgment | ranking boost |
| `cozy` | cue `cozy` | a temperature, a hard style filter | ranking boost |
| `filling` | cue `filling` | calories, a hard style filter | ranking boost |
| `summery` | cue `summery` | a season lock | ranking boost |
| `special` | cue `special` | a named dish, an eligibility bypass | preference |
| `restaurant_like` | cue `restaurant_like` | a restaurant name, a hard effort filter | ranking boost |
| `weeknight` | cue `weeknight`, `keep_it_easy` when that field is still null | `criteria.quick`, a hard clock | preference |
| `quick` | cue `weeknight`, `keep_it_easy` when still null | a hard minute cap, the bare-word quick bypass | preference |
| `simple` | `keep_ingredients_simple` when still null | a hard ingredient-complexity filter, “only simple” | preference |
| `adventurous` | rank `adventurous` | a hard complexity filter | ranking boost |
| `indulgent` | rank `indulgent` | a health judgment, a hard filter | ranking boost |
| `vegetable_forward` | rank `vegetable_forward` | a vegetarian requirement, a stored diet label | ranking boost |
| `fish_forward` | rank `fish_forward` | a fish frequency, shellfish, an eligibility change | ranking boost |
| `healthy` | cue `light` plus rank `vegetable_forward`, `fish_forward`, `fewer_fried` | a health claim, calories, a nutrition score, a hard filter, a fish frequency | preference (derived) |
| `family` | cue `weeknight`, `keep_it_easy` and `keep_ingredients_simple` when still null, rank `mild` | a hard flavor filter, a kids-only menu, a nutrition claim, a required dish | preference |
| `fried` | `exclude_cooking` = `deep`, `pan`, `shallow` | baked crispy, roasted crispy, air-fried crispy, stir-fry, a title word alone | hard filter |
| `deep_fried` | `exclude_cooking` includes `deep` only | pan-fried, shallow-fried, baked crispy, air-fried crispy | hard filter |

Phrase aliases, longest first, override the token default:

- `nothing fried`, `no fried`, `not fried`, `without fried`, `avoid fried`, and the same negations on `frying` / `fry` (`without frying`, `no frying`, `not frying`, `nothing frying`) → avoid `fried` (deep, pan, and shallow)
- `crispy without frying` → avoid `fried` and rank `crispy_non_fry`
- `crispy but not deep fried`, `not deep fried`, `nothing deep fried` → avoid `deep_fried` only. The first also ranks `crispy_non_fry`
- `whole family`, `kid friendly`, `family friendly` → `family` (simple, familiar weeknight, mild, easy). Those words are not a literal text search
- `nothing too heavy`, `not too heavy`, `not heavy` → prefer `light`
- `nothing too rich`, `not too rich` → avoid `indulgent`, which adds the `light` cue and does not add an indulgent boost
- `no comfort food` → avoid `comforting` (soft exclusion: rank `avoid_comforting`, drop the comforting cue). It is not a hard filter
- `comfort food` → prefer `comforting`
- `restaurant style`, `restaurant like` → `restaurant_like`
- `weeknight friendly` → `weeknight`
- `clean and simple` → `simple` plus `light`

The bare tokens `fried`, `frying`, and `fry` are not a preference. Only an explicit negation phrase, or a model concept with `polarity: avoid`, excludes frying. `healthier`, `healthful`, `wholesome`, and `clean` alias to `healthy`. `clean` is not detox, organic, or a medical diet. A lone `\beasy\b` that is not “only easy” or “nothing but easy” sets `keep_it_easy` when that field is still null. `easier` does not.

## 2. Healthy, with no health claim

`healthy` is derived, never canonical. It has no nutrition score, calorie target, or medical definition. The server must not say a meal is healthy, healthier, nutritious, or low-calorie. `post_validate` blanks an acknowledgement that uses those words. The composed sentence is:

- Find: `Here are some lighter, veggie-forward ideas.`
- Plan: `{n} lighter, veggie-forward dinners.` (`Three` when the count is 3), plus `, with fish twice.` only when a frequency row already has fish min 2 and max 2.

`fewer_fried` is a ranking penalty on meals whose cooking method is actual frying. It does not set `exclude_cooking`. `fish_forward` boosts finfish protein only. It does not boost shellfish, and it does not create a frequency. No Healthy chip is emitted. The existing light cue chip stays `Not too heavy`.

## 3. Soft and hard are structural

Support status is one of `canonical`, `derived`, `unsupported_soft`, `explicit_hard`. Role is one of `preference`, `ranking_boost`, `soft_exclusion`, `hard_filter`. There is no confidence score.

- A ranking boost or preference may set a cue, a rank token, or a null `keep_it_easy` / `keep_ingredients_simple`. It does not filter the pool and does not change eligibility.
- A soft exclusion (`avoid comforting`, `avoid indulgent`) only changes rank or a cue.
- A hard filter is only an explicit cooking exclusion (`fried`, `deep_fried`) or a field the existing delta already wrote: ingredients, proteins, cuisines, diets, frequencies, hard minutes, quick, effort.
- Cue scores stay clamped to `[-0.40, 0.40]`. Semantic rank adds a separate score clamped to `[-0.25, 0.25]`. Ranking never grants eligibility.

`semantic_rank` tokens, closed: `vegetable_forward`, `fish_forward`, `fewer_fried`, `avoid_comforting`, `adventurous`, `indulgent`, `crispy_non_fry`, `mild`.

## 4. Unknown model concepts

`normalizeModelConcepts` lowercases and trims the id, then looks it up in the canonical table or the alias map. A miss increments `unsupported_soft_count` and is dropped. The raw string is not written to state, chips, acknowledgements, or telemetry. It is not a literal text filter and it cannot touch eligibility.

Text of the form “something / really / very / quite &lt;unknown adjective&gt;” is the same kind of miss. Fuzzy vocabulary tokens and leftover soft or descriptive words (`whole family`, `kid`, `friendly`, `eat`, and the same class of filler) are stripped from `text_residue`. They are not a required literal search. A leftover noun that is not one of those words, such as a real ingredient, a dish noun, or an unknown noun like xylophone, stays.

## 5. Cooking method

`deriveCookingMethod` reads methods, description, and steps first. The title is used only when those sources do not already classify the dish. `deriveCatalogCookingMethods` runs that over catalog packages.

Frying kinds, the only ones a hard exclusion may name: `deep`, `pan`, `shallow`.

- Method tokens `deep_fry`, `pan_fry`, `shallow_fry`, `fry`, `fried` map to those kinds. Unqualified instruction “fry / fried / frying”, after stir-fry and air-fry spans are removed, is pan, or shallow when the same evidence says shallow or that the oil shimmers.
- `air_fry` and baked, roasted, or oven evidence that is also crispy map to `crispy_non_fry` (`air_fried`, `baked`, `roasted`). Those dishes are not excluded by “nothing fried”.
- Stir-fry is recorded and is not a frying exclusion. A negated “no / not / without / never … fried” span is removed before the scan, so “No fried egg” on a stir-fry does not classify the dish as fried.

When `exclude_cooking` is set, the words fried, frying, fry, deep-fried, pan-fried, and shallow-fried are stripped from `exclude_terms`, `methods`, `ingredients`, and `exclude_ingredients` so a title search cannot drop an air-fried dish. Chips: all three kinds → `Nothing fried`; deep without the other two → `Nothing deep-fried`.

## 6. Zero-result reasons

`classifyZeroResult` returns null when the page is non-empty. Otherwise exactly one of:

| reason | When |
| --- | --- |
| `hard_eligibility` | hard-ineligible rows cover the catalog, or hard eligibility excluded rows and no explicit filter did |
| `combined_constraints` | both a hard-eligibility exclusion and an explicit filter exclusion |
| `explicit_filters` | explicit criteria excluded rows and eligibility did not |
| `unsupported_soft_intent` | unsupported-soft count is positive and the state has no explicit hard filter |
| `no_catalog_match` | text missed, or the catalog is empty, and the cases above did not apply |
| `unknown` | none of the above |

A vague adjective alone is not one of these. Zero results stay reserved for a real conflict: an explicit ingredient with no eligible match, an explicit filter combination, household eligibility, or an unsatisfiable conjunction. The module does not expand the catalog and does not loosen a hard constraint.

## 7. Telemetry

`buildSemanticTelemetry` attaches `telemetry` on interpret, count, and the ambiguous-day response. Fields:

- `task`: `planning_intent`, `discovery_intent`, or null
- `canonical_intents`: sorted canonical ids from the normalizer, plus any applied `intent_cues` whose id is in that same vocabulary (so a cue written by a list op is not reported as no intent)
- `unsupported_soft_count`
- `broadening`
- `zero_result_reason`: a reason from §6, or null
- `result_count_bucket`: `0`, `1-3`, `4-12`, `13+`, or null
- `route`: `bypass`, `provider` (including cache), `deterministic`, or `fallback`
- `downstream_success`: boolean or null

No utterance, acknowledgement, residue, or unknown string.

## 8. Broadening order

`broadenDiscoveryState` and `canBroadenZero` follow this order and stop:

1. Eligibility is not on this object and is never changed. A semantic score cannot make an ineligible meal eligible.
2. Explicit hard lists stay: ingredients, include ingredients, protein groups, cuisines, meal styles, `exclude_cooking`, excluded ingredients and terms and categories, diet, methods, equipment, effort levels, frequencies, a hard minute cap, `quick`, and `effort`.
3. Residue already classified as an unsupported soft adjective may be dropped. A leftover noun, such as a word the catalog does not contain, stays. That miss is `no_catalog_match`, not a broaden.
4. Ranking cues and `semantic_rank` stay, because they do not filter.

`canBroadenZero` is true only for `unsupported_soft_intent` or `no_catalog_match`, only when step 2 found nothing hard, and only when the normalizer already counted an unsupported-soft concept or set `broadening`. The discovery interpret route may rerun the pipeline after that drop. If the rerun is non-empty, `semantic.broadening` is true. Broadening never writes `diner_taste`.

A portion split (“two cozy dinners and one light one”) is owned by the existing slot overlay. Semantics does not copy those cues back onto the global list.

## 9. Backend contracts for later UI

These three are server-owned. They do not call Luna.

### Ambiguous day

`ambiguousTarget({ text, dates, dinnerCount, today })` runs before `service.run` on `POST /api/plan/interpret`.

- A day-targeted soft cue (`lighten up Friday`, `make Friday lighter`) on an existing plan applies only to that slot (`intent_cue`). A plan-wide cue that was already on the plan stays. The slot chip reads `Fri: lighter`. Exactly one dated match replans that slot and answers `Friday's now lighter: {title}.` An undated plan never invents a weekday: the chooser lists every dinner, with Add days, and nothing else changes. Luna is not called.
- Weekend language uses real plan dates only. Dated Saturday and Sunday are both updated, with no chooser. An undated plan opens the chooser for every dinner (`Dinner 1` through `Dinner N`) and does not replan. A dated plan with no weekend dinner asks which dinners were meant. The result is never a silent empty delta, and `fallbackDatesForUndatedPlan` is not used to pick a day.
- Other named weekdays with exactly one date still return null from `ambiguousTarget` and may continue to Luna. Two or more return `{ reason: "ambiguous_day", prompt, candidates }` and `state.pending_slot` holds the inferred patch.
- Choosing days posts `POST /api/plan/apply` with every selected position. That apply, and `POST /api/plan/interpret` with `target_position` or `target_positions`, replays `pending_slot` and does not call a provider.
- The route responds `source: "deterministic"`, `llm_called: false`. A direct hit includes a preview. A chooser sets `choice` and `pending_slot`.

### Count change

`POST /api/plan/count` with `schema_version`, `dinner_count` (integer 1..14), `state`, and optional `dinner_plan_id`, `participant_ids`, `timezone`.

`applyDinnerCount` sets the count and `executePlanning` runs the existing deterministic planner. `resolveProvider` is not called. Response: `llm_called: false`, `source: "deterministic"`, `telemetry.route: "deterministic"`. An out-of-range count is `dinner_count_invalid`.

### Household-safe starters

`householdSafeStarterPrompts({ limits })` filters a fixed list by the union of prohibited hard-limit ids (`rulesFromLegacyKeys` on each diner’s `constraint_rule`). `GET /api/weave/starters` is session-authenticated and returns `{ ok, llm_called: false, starters: [{ id, task, text }] }`.

One eligible entry wins each slot, four at most. The clear table is the first row of each slot. A shellfish-free table swaps `find_shrimp` for `find_lemony`. A no-fish table swaps `plan_fish_twice` for `plan_two_veggie`, and Find uses tofu and lemony in place of fish and shrimp.

| id | task | text | withheld when |
| --- | --- | --- | --- |
| `plan_three_easy` | planning | Plan three easy dinners this week. | — |
| `plan_fish_twice` | planning | Fish twice this week. | `no_finfish` |
| `plan_two_veggie` | planning | Make two of them vegetarian. | `no_meat` |
| `plan_lighter` | planning | Plan three lighter, veggie-forward dinners. | — |
| `plan_special` | planning | Make one night something special. | — |
| `plan_weeknight` | planning | Keep weeknights simple. | fallback for slot D |
| `find_cozy` | discovery | Something cozy | — |
| `find_summery` | discovery | Something summery | fallback for slot A |
| `find_fish` | discovery | Easy fish dinner | `no_finfish` |
| `find_tofu` | discovery | Spicy, with tofu | fallback for slot B |
| `find_lighter` | discovery | Something lighter and veggie-forward | — |
| `find_fresh_filling` | discovery | Fresh but filling | fallback for slot C |
| `find_shrimp` | discovery | Garlicky shrimp | `no_shellfish` or `no_finfish` |
| `find_lemony` | discovery | Bright and lemony | fallback for slot D |

A starter that requires meat, dairy, or nuts is withheld for `no_meat` / `no_poultry`, `no_dairy`, or `no_nuts`. The click text is the sentence above, so the shrimp starter sends “Garlicky shrimp”. The function never suggests fish or shrimp to a table that cannot have them.

## 10. What this release does not do

No deploy. No OpenAI call. No UI, no starter-prompt screen, no cleanup script. No second ontology beside Taste Vocabulary, D-03 labels, and the cue table. No Sol on Plan or Find. Astra stays denylisted. Prod and preview budgets are unchanged.
