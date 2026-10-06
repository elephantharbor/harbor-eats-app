# D-07 DiscoveryQuery contract

The request Composer and a future D-06 interpreter both have to produce. Normalization rules are `normalizeQuery` and `normalizeClientContext`. A payload that does not match is an error, not a guess.

Schema version is `1` (`DISCOVERY_SCHEMA_VERSION`). Any other version is `schema_version_unsupported`. An omitted version is 1.

## DiscoveryQuery

| Field | Type | Rule |
|-------|------|------|
| `schema_version` | `1` | Only version 1. |
| `text` | string or null | Trimmed, lowercased, internal whitespace collapsed. Empty becomes null. Longer than 200 characters is `text_invalid`. |
| `criteria` | object | Explicit hard filters. Omitted means every filter off. |
| `soft` | object or omitted | D-01 chips for this search. Omit the key to inherit. See soft below. |
| `limit` | integer | Default 20. Minimum 1. Maximum 50. |
| `offset` | integer | Default 0. Zero or greater. A large offset is an empty page, not an error. |

Unknown keys are `unknown_field`.

### criteria

| Field | Type | Match |
|-------|------|-------|
| `cuisines` | slug[] | `dish.cuisine` or a cuisine vocabulary tag. |
| `meal_styles` | slug[] | A meal-style vocabulary tag or `meal_format`. |
| `flavors` | slug[] | A flavor vocabulary tag or `flavor_profile`. |
| `ingredients` | slug[] | Canonical ingredient id, vocabulary tag, or `primary_ingredient`. |
| `exclude_ingredients` | slug[] | Same identity. Any hit drops the meal. |
| `effort_levels` | `easy` \| `moderate` \| `involved`[] | Hard filter on D-03 `effort_level`. |
| `ingredient_complexities` | `simple` \| `standard` \| `adventurous`[] | Hard filter on D-03 `ingredient_complexity`. |
| `max_minutes` | number or null | Hard filter. `total_minutes <= max_minutes`. |
| `methods` | slug[] | Method token, such as `oven` or `grill`. |
| `equipment` | slug[] | Equipment token, such as `sheet-pan`. |
| `quick` | boolean | Default false. True means `total_minutes <= 30`. |

Lists are lowercase, unique, and sorted. A value outside the effort or complexity enums is `effort_levels_invalid` or `ingredient_complexities_invalid`. Other slug lists reject empty strings and characters outside `a-z`, `0-9`, hyphen, and underscore (`cuisines_invalid`, and the same pattern for each field). More than 20 items in one list is invalid. Spaces are not turned into hyphens.

Inside one list, any value matches. Every list that is non-empty must match. `quick: false` does not filter. `max_minutes: null` does not filter.

`quick` does not write `effort_levels`. `effort_levels` does not write `quick`. A meal can be easy and an hour long, or moderate and 20 minutes.

### soft

| Field | Type | Rule |
|-------|------|------|
| `keep_it_easy` | boolean | D-01 chip. Soft tier. Not an effort filter. |
| `keep_ingredients_simple` | boolean | D-01 chip. Soft tier. Not a complexity filter and not a pantry. |

Omit `soft` and `soft_provided` is false. The server then uses the plan's chips in plan modes and both off for standalone.

Send `soft`, even with both flags false, and `soft_provided` is true. A missing flag inside that object is false. `"yes"` is `keep_it_easy_invalid` or `keep_ingredients_simple_invalid`.

The HTTP response separates them. `query.soft` is null when the client omitted it, and the object when the client sent it. Effective flags are the top-level `soft` and `soft_source` (`query`, `plan_intent`, or `default_off`). Read those for the chip state. Do not infer them from `query.soft` when it is null.

### Keys that are not filters

| Sent key | Error |
|----------|--------|
| `constraints`, `eligible` | `client_constraints_forbidden` |
| `pantry`, `already_have` | `pantry_not_a_filter` |
| `effort`, `easy`, `simple`, `quick_and_easy` | `unknown_field` |

`effort_levels: ["easy"]` is the Easy filter. `ingredient_complexities: ["simple"]` is the Simple filter. The bare names above are refused so they are not remapped.

## Canonical JSON

Key order is part of the fixture contract. `canonicalQuery` returns this shape. `soft` is null when the caller did not send it.

```json
{
  "schema_version": 1,
  "text": "lemon herb",
  "criteria": {
    "cuisines": ["american"],
    "meal_styles": [],
    "flavors": [],
    "ingredients": [],
    "exclude_ingredients": [],
    "effort_levels": ["easy"],
    "ingredient_complexities": [],
    "max_minutes": null,
    "methods": [],
    "equipment": [],
    "quick": false
  },
  "soft": {
    "keep_it_easy": false,
    "keep_ingredients_simple": true
  },
  "limit": 10,
  "offset": 0
}
```

That object is fixture `explicit-easy-not-quick`. The meal it keeps can take an hour. Quick is false on purpose.

## Query string

`GET /api/discovery/search` and `serializeQueryString` use one parameter order. Repeated keys and commas both split lists. Booleans are `1`, `0`, `true`, or `false`.

| Parameter | Field |
|-----------|--------|
| `schema` | `schema_version` |
| `text` | `text` |
| `q` | `text` only when `text` is absent |
| `cuisine` | `criteria.cuisines` |
| `style` | `criteria.meal_styles` |
| `flavor` | `criteria.flavors` |
| `ingredient` | `criteria.ingredients` |
| `exclude_ingredient` | `criteria.exclude_ingredients` |
| `effort` | `criteria.effort_levels` |
| `complexity` | `criteria.ingredient_complexities` |
| `max_minutes` | `criteria.max_minutes` |
| `method` | `criteria.methods` |
| `equipment` | `criteria.equipment` |
| `quick` | `criteria.quick` |
| `keep_it_easy` | `soft.keep_it_easy` |
| `keep_ingredients_simple` | `soft.keep_ingredients_simple` |
| `limit` | `limit` |
| `offset` | `offset` |
| `mode` | context mode |
| `dinner_plan_id` | context |
| `meal_id` | context |
| `position` | context |
| `participant_id` | repeated context participants |
| `exclude_slug` | standalone only, repeated or comma-separated |

`effort` on the query string is the effort-level list. `effort` inside a JSON criteria object is `unknown_field`. The JSON name is `effort_levels`. Both forms normalize to the same list.

False `quick` is omitted from the string. Parsing it back leaves `quick` false. Soft flags are written only when `soft` was sent, including an explicit `0`, so an inherited chip survives a round trip.

```
schema=1&text=lemon+herb&cuisine=american&effort=easy&keep_it_easy=0&keep_ingredients_simple=1&limit=10&offset=0
```

```
schema=1&text=tacos&max_minutes=25&quick=1&limit=20&offset=0
```

```
schema=1&limit=20&offset=0
```

Those three strings are the fixtures in `src/discovery/fixtures.js`: `EXPLICIT_EASY_FIXTURE`, `QUICK_NOT_EASY_FIXTURE`, and `EMPTY_QUERY_FIXTURE`. `parseQuery` on the string equals `normalizeQuery` on the fixture input.

## Context

JSON context keys: `mode`, `dinner_plan_id`, `meal_id`, `position`, `participant_ids`, `exclude_slugs`.

`mode` may also sit on the POST body. The body value wins over `context.mode`.

| Mode | `dinner_plan_id` | `meal_id` | `exclude_slugs` from the client |
|------|------------------|-----------|----------------------------------|
| `standalone` | Forbidden | Forbidden | Allowed |
| `replace_plan_meal` | Required | Required | Forbidden |
| `choose_for_plan` | Required | Optional | Forbidden |

Ids match `^[A-Za-z0-9_-]{1,80}$`. `position` is an integer of 1 or more. Member ids are not lowercased.

POST body keys are `schema_version`, `mode`, `context`, and `query`. Anything else, including a top-level `constraints`, is `unknown_field`.

### POST bodies

Standalone browse, chips off, no text:

```json
{
  "schema_version": 1,
  "mode": "standalone",
  "query": {}
}
```

Replace one planned dinner. Chips omitted, so the stored plan intent applies:

```json
{
  "mode": "replace_plan_meal",
  "context": {
    "dinner_plan_id": "dp_1",
    "meal_id": "dpm_1"
  },
  "query": {
    "text": "taco",
    "criteria": { "quick": true }
  }
}
```

Choose a new row while the plan has room. Explicit Easy, and both chips forced off for this search only:

```json
{
  "mode": "choose_for_plan",
  "context": {
    "dinner_plan_id": "dp_1",
    "participant_ids": ["m1"]
  },
  "query": {
    "criteria": { "effort_levels": ["easy"] },
    "soft": { "keep_it_easy": false, "keep_ingredients_simple": false }
  }
}
```

Fill a specific empty slot (swap that row, do not add another):

```json
{
  "mode": "choose_for_plan",
  "context": {
    "dinner_plan_id": "dp_1",
    "meal_id": "dpm_3"
  },
  "query": {}
}
```

## Response

`200` body, fields in this role:

| Field | Role |
|-------|------|
| `ok` | `true` |
| `schema_version` | `1` |
| `mode` | The mode that ran |
| `catalog_source` | `d1` |
| `catalog_size` | Published meals before filters |
| `query` | Canonical client query. `soft` is null when omitted |
| `context` | Public context. No constraints and no tastes |
| `soft` | Effective chips |
| `soft_source` | `query`, `plan_intent`, or `default_off` |
| `selection` | Mutation to call after a pick. `action: "none"` for standalone |
| `excluded_counts` | Map of exclusion code to count |
| `trace` | One row per stage: `stage`, `in`, `out`, `excluded` |
| `results` | The page |
| `limit`, `offset` | The page that ran |
| `total` | Survivors before the page |
| `recent_source` | `cook` or `unavailable` |

Each result:

| Field | Role |
|-------|------|
| `rank` | 1-based index in the full order, not the page |
| `recipe_slug`, `recipe_version_id`, `recipe_id` | Published identity. The version id is what `swap_meal` and `add_meal` pin |
| `title`, `cuisine`, `meal_format`, `primary_ingredient` | Card facts |
| `total_minutes`, `effort_level`, `ingredient_complexity`, `exploration` | D-03 and catalog facts. Minutes may be null |
| `preference_tier`, `preference_relaxed` | Stage 5. Tier 0 is the best soft band |
| `taste_score`, `taste_hits` | Stage 6. Hits are `scoreDinerTastes` hits |
| `match_score` | Stage 3. Zero when `text` is null |
| `reasons`, `primary_reason` | `RANK_REASON_CODES` |

`context` echoes `mode`, `household_id`, `participant_ids`, `dinner_plan_id`, `meal_id`, `position`, `exclude_slugs`, `plan_slugs`, `recent_slugs`, `soft`, and `soft_source`.

## Errors

| Error | Status | When |
|-------|--------|------|
| `schema_version_unsupported` | 400 | Version is not 1 |
| `query_invalid`, `criteria_invalid`, `soft_invalid`, `context_invalid` | 400 | Wrong JSON type |
| `unknown_field` | 400 | A key this schema does not define, including remapped aliases |
| `client_constraints_forbidden` | 400 | `constraints` or `eligible` |
| `pantry_not_a_filter` | 400 | `pantry` or `already_have` |
| `text_invalid`, `limit_invalid`, `offset_invalid`, `max_minutes_invalid`, `quick_invalid` | 400 | Bad scalar |
| `*_invalid` on a list or flag | 400 | Bad slug, enum, or boolean |
| `mode_invalid` | 400 | Mode outside the three names |
| `dinner_plan_required`, `dinner_plan_not_allowed` | 400 | Plan id missing or present in the wrong mode |
| `meal_required`, `meal_not_allowed` | 400 | Meal id missing or present in the wrong mode |
| `exclude_slugs_not_allowed` | 400 | Client exclude list in a plan mode |
| `participant_required`, `participant_ids_invalid`, `forbidden_member` | 400 or 403 | No diners, a bad id, or a diner outside the household |
| `plan_not_found` | 404 | Plan id is unknown |
| `forbidden_cross_household` | 403 | Plan belongs to another household |
| `meal_not_found` | 404 | `meal_id` is not on that plan |
| `outcome_locked` | 409 | The meal is not a planned or selected recipe |
| `plan_full` | 409 | `choose_for_plan` without a `meal_id` and no open row |
| `catalog_source_required` | 503 | `CATALOG_SOURCE` is not `d1` |
| `catalog_unavailable` | 503 | Published catalog failed to load |
| `method_not_allowed` | 405 | Not GET or POST |
| `invalid_json` | 400 | POST body is not JSON |
| `unauthorized` | 401 | No session |

Exclusion codes on a meal that did load (`EXCLUSION_CODES`) are not HTTP errors. An empty `results` with a `200` and a non-zero `excluded_counts` is a real search.

| Code | Stage |
|------|--------|
| `excluded_slug` | context |
| `participants_required` | context, when the pure pipeline is called with no diners |
| `ineligible_hard_limit` | hard eligibility |
| `text_miss` | text |
| `explicit_effort`, `explicit_complexity`, `explicit_quick`, `explicit_max_minutes` | explicit criteria |
| `explicit_cuisine`, `explicit_meal_style`, `explicit_flavor` | explicit criteria |
| `explicit_ingredient`, `explicit_exclude_ingredient` | explicit criteria |
| `explicit_method`, `explicit_equipment` | explicit criteria |

`explicit_quick` and `explicit_max_minutes` use `detail: "minutes_unknown"` when the catalog has no `total_minutes`. They use `over_quick_max` or `over_max` when the clock misses.

## What a later interpreter returns

D-06 is not implemented. The success shape it will have to return, which D-07 will then pass through `normalizeQuery`:

```json
{
  "ok": true,
  "owner": "D-06",
  "query": {},
  "unresolved": ["phrase the interpreter did not bind"]
}
```

`query` is a DiscoveryQuery. Bindings are `NLP_BINDING_RULES` in `src/discovery/nlp.js`. This branch's `interpretFreeText` returns `nlp_not_in_d07` instead.
