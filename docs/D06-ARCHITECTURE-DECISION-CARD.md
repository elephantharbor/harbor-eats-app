# D-06 Architecture Decision Card

**Status.** Decision for Composer. This file is the contract. It does not ship runtime code.

**Boundary.** Same line as D-05: Luna interprets language into a schema. FlavorWeave validates, constrains, ranks, and persists. `planning_intent` and `discovery_intent` stay on `gpt-6-luna` through `createGenerationService.run`. Sol is not a fallback. Astra stays denylisted.

**Reuse decision.** Refinement uses the **same task ids** (`planning_intent`, `discovery_intent`). The current canonical state travels in the task input. The model returns one **delta**, not a second copy of the plan. One Luna call per user submission. Chip edits and other direct manipulation do not call Luna.

**Out of this card.** Visual design, composer placement, motion, and typing cadence belong to the Opus `D06-UX-DECISION-CARD`. This card locks the data those screens read and write.

---

## Invariants

1. `run()` is the only Luna path. Interpret routes call it at most once.
2. Household allergies, hard limits, membership, and participant eligibility are loaded on the server. They are not fields the model may set, and they are not sent to the model.
3. A hard-ineligible request is removed from the executed intent and returned as a structured conflict. The planner and Discovery still run on the repaired intent.
4. The screen shows one acknowledgement: the string on the interpret response after reconciliation. The client does not type the raw provider payload.
5. Conversation memory is the canonical structured state. The next call does not receive a transcript.
6. Raw user text is not written to D1, `ai_usage`, analytics, taste rows, or the dinner-plan record.
7. Nothing on these routes writes `diner_taste`, ratings, or `constraint_rule`.
8. Discovery ranking stays the D-07 pipeline plus the closed cue table in this card. The model does not score meals.
9. Output caps stay under the Luna ceiling of 600. They are the measured caps in §8, not 600 by default.
10. Existing plan, swap, and `/api/discovery/search` routes remain the writers and the manual-control path.

---

## 1. Strict schemas

OpenAI strict Structured Outputs, as `toStrictSchema` already builds them (`src/ai/providers/openai.js`):

- every object has `additionalProperties: false`
- every property is listed in `required`
- a nullable field is a type union (`["string", "null"]`, `["integer", "null"]`, `["boolean", "null"]`, `["array", "null"]`)
- a nullable enum includes `null` in `enum`

`schema.js` enforces `minimum`, `maximum`, `maxLength`, `maxItems`, and `enum`. `toStrictSchema` strips those keywords on the wire and does not change `required` or nullability when the task schema is already written that way. Write the task schemas in that already-strict shape. Do not use `anyOf` / `oneOf`. `schema.js` does not implement them, and a dependent enum (the allowed `value` depends on `field`) is checked in `post_validate`, not in JSON Schema.

`minLength` is not enforced by `schema.js` and is not sent on the wire. Reject an empty or whitespace `acknowledgement` in `post_validate` so the gateway takes its one repair retry.

Prompt versions bump to `planning_intent@2` and `discovery_intent@2`. Both tasks stay `cost_class: "cheap"`, `allowed_models: ["fast-small"]` (alias → `gpt-6-luna`), and `reasoning_effort: "minimal"` (already required by `task()`). `planning_intent.executable` becomes `true`. Cache stays enabled (TTL 86400). The cache stores the structured delta, including the model acknowledgement. It does not store the prompt.

### 1.1 Shared closed sets

**Intent cues** (the entire fuzzy set):

`cozy`, `fresh`, `filling`, `light`, `comforting`, `summery`, `special`, `restaurant_like`, `weeknight`

`light` is the only encoding of “light”, “not heavy”, and “not too heavy”. There is no `not_heavy` cue.

**Weekdays:** `monday` … `sunday`.

**Effort:** `easy`, `moderate`, `involved` (`EFFORT_LEVELS`).

**Ingredient complexity:** `simple`, `standard`, `adventurous` (`INGREDIENT_COMPLEXITIES`).

**Frequency / category tokens** (`PLAN_TOKENS`). A frequency, an exclude-category, or a slot `category` must be one of these:

| Group | Tokens | Counted by |
|---|---|---|
| Protein | `fish`, `seafood`, `shellfish` | `proteinGroupsFromSignals` (eligibility tags ∪ allergens). Title and `primary_ingredient` do not count. `seafood` is the union. `fish` is finfish only. |
| Meal style | `tacos`, `bowls`, `soups`, `pasta`, `grilled`, `curries`, `sandwiches`, `stews`, `stir-fries` | Taste-vocabulary meal-style slug on the package, or `meal_format` equal to that slug |
| Diet | `plant` | Stored dietary label `plant`, `plant_based`, or `vegetarian` |
| Ingredient | `mushrooms`, `tofu`, `salmon`, `eggplant`, `swordfish`, `chickpeas`, `shrimp`, `chicken`, `lentils`, `cod`, `cauliflower`, `soba`, `carrots`, `arctic-char`, `polenta`, `rice-noodles`, `peaches` | Existing `matchesRequest` (vocabulary tag, `primary_ingredient`, canonical ingredient id) |

**List fields the model may patch**

| Task | `list_ops[].field` |
|---|---|
| `planning_intent` | `cuisines`, `meal_styles`, `include_ingredients`, `exclude_ingredients`, `exclude_categories`, `intent_cues` |
| `discovery_intent` | `cuisines`, `meal_styles`, `flavors`, `ingredients`, `exclude_ingredients`, `methods`, `equipment`, `textures`, `effort_levels`, `ingredient_complexities`, `protein_groups`, `diet`, `intent_cues` |

`value` is a string, max 40. `post_validate` keeps it only when it belongs to that field:

- cuisine / flavor / texture / meal_style / ingredient → active `taste-vocabulary.js` slug in that category
- `exclude_categories` and frequency `token` → `PLAN_TOKENS`
- `intent_cues` → the cue enum
- `effort_levels`, `ingredient_complexities`, `protein_groups`, `diet` → the D-07 enums (`easy|moderate|involved`, `simple|standard|adventurous`, `fish|seafood|shellfish`, `dairy_free|plant|plant_based|vegetarian`)
- `methods`, `equipment` → `^[a-z0-9_-]{1,40}$` (D-07 has no closed method list)

Dropped values are listed on the response as `dropped`. They do not fail the schema.

### 1.2 `planning_intent` input

Local validation only. Not an OpenAI response schema.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["text", "state", "context"],
  "properties": {
    "text": { "type": "string", "maxLength": 500 },
    "state": { "type": ["object", "null"] },
    "context": { "type": "object" }
  }
}
```

`state`, when an object, must match the canonical planning state in §1.5 (`additionalProperties: false`). `context` is server-built and redacted before `renderPrompt`:

```json
{
  "today": "2026-10-10",
  "timezone": "America/Chicago",
  "diners": 2,
  "dinner_count_default": 4,
  "dates": [{ "position": 1, "date": "2026-10-12", "weekday": "monday" }]
}
```

`today` is computed on the server in the client’s IANA timezone (`^[A-Za-z0-9_+\-/]{1,64}$`, otherwise UTC). `dates` is present only when a saved plan has `scheduled_dates`. `diners` is a count. The context object has no names, member ids, allergens, tastes, recipe titles, or prior utterances. `buildHouseholdContext` is not reused as-is: its `keep_it_easy` / `recent_count` fields are not part of this prompt.

`vocabulary` is still passed on the input for `post_validate` (the closed lists above). It is not a free-form object in the prompt beyond those lists.

### 1.3 `planning_intent` output (initial and refinement)

This is the delta. `null` on a scalar means “leave the canonical value”. An empty array means “no ops”, not “clear the list”. Clearing is `clear`.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "acknowledgement", "clear", "dinner_count", "date_start", "date_end",
    "keep_it_easy", "keep_ingredients_simple", "max_minutes", "max_minutes_hard",
    "effort", "ingredient_complexity", "ingredient_complexity_hard", "special_count",
    "list_ops", "frequency_ops", "slot_ops"
  ],
  "properties": {
    "acknowledgement": { "type": "string", "maxLength": 120 },
    "clear": {
      "type": "array",
      "maxItems": 6,
      "items": {
        "type": "string",
        "enum": [
          "dinner_count", "date_start", "date_end", "keep_it_easy", "keep_ingredients_simple",
          "max_minutes", "max_minutes_hard", "effort", "ingredient_complexity",
          "ingredient_complexity_hard", "special_count", "cuisines", "meal_styles",
          "include_ingredients", "exclude_ingredients", "exclude_categories",
          "frequencies", "intent_cues", "slots"
        ]
      }
    },
    "dinner_count": { "type": ["integer", "null"], "minimum": 1, "maximum": 14 },
    "date_start": { "type": ["string", "null"], "maxLength": 10 },
    "date_end": { "type": ["string", "null"], "maxLength": 10 },
    "keep_it_easy": { "type": ["boolean", "null"] },
    "keep_ingredients_simple": { "type": ["boolean", "null"] },
    "max_minutes": { "type": ["integer", "null"], "minimum": 5, "maximum": 240 },
    "max_minutes_hard": { "type": ["boolean", "null"] },
    "effort": { "type": ["string", "null"], "enum": ["easy", "moderate", "involved", null] },
    "ingredient_complexity": { "type": ["string", "null"], "enum": ["simple", "standard", "adventurous", null] },
    "ingredient_complexity_hard": { "type": ["boolean", "null"] },
    "special_count": { "type": ["integer", "null"], "minimum": 0, "maximum": 14 },
    "list_ops": { "type": "array", "maxItems": 4, "items": { "$ref": "#/$defs/listOp" } },
    "frequency_ops": { "type": "array", "maxItems": 3, "items": { "$ref": "#/$defs/frequencyOp" } },
    "slot_ops": { "type": "array", "maxItems": 3, "items": { "$ref": "#/$defs/slotOp" } }
  },
  "$defs": {
    "listOp": {
      "type": "object",
      "additionalProperties": false,
      "required": ["field", "op", "value"],
      "properties": {
        "field": { "type": "string", "enum": ["cuisines", "meal_styles", "include_ingredients", "exclude_ingredients", "exclude_categories", "intent_cues"] },
        "op": { "type": "string", "enum": ["add", "remove"] },
        "value": { "type": "string", "maxLength": 40 }
      }
    },
    "frequencyOp": {
      "type": "object",
      "additionalProperties": false,
      "required": ["op", "token", "min_count", "max_count"],
      "properties": {
        "op": { "type": "string", "enum": ["set", "clear"] },
        "token": { "type": "string", "enum": ["<PLAN_TOKENS>"] },
        "min_count": { "type": ["integer", "null"], "minimum": 0, "maximum": 14 },
        "max_count": { "type": ["integer", "null"], "minimum": 0, "maximum": 14 }
      }
    },
    "slotOp": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "target_kind", "target", "op", "effort", "ingredient_complexity",
        "max_minutes", "max_minutes_hard", "special", "cuisine", "meal_style",
        "ingredient", "category"
      ],
      "properties": {
        "target_kind": { "type": "string", "enum": ["weekday", "date", "position"] },
        "target": { "type": "string", "maxLength": 10 },
        "op": { "type": "string", "enum": ["set", "clear"] },
        "effort": { "type": ["string", "null"], "enum": ["easy", "moderate", "involved", null] },
        "ingredient_complexity": { "type": ["string", "null"], "enum": ["simple", "standard", "adventurous", null] },
        "max_minutes": { "type": ["integer", "null"], "minimum": 5, "maximum": 240 },
        "max_minutes_hard": { "type": ["boolean", "null"] },
        "special": { "type": ["boolean", "null"] },
        "cuisine": { "type": ["string", "null"], "maxLength": 40 },
        "meal_style": { "type": ["string", "null"], "maxLength": 40 },
        "ingredient": { "type": ["string", "null"], "maxLength": 40 },
        "category": { "type": ["string", "null"], "enum": ["fish", "seafood", "shellfish", "tacos", "bowls", "soups", "pasta", "grilled", "curries", "sandwiches", "stews", "stir-fries", "plant", "mushrooms", "tofu", "salmon", "eggplant", "swordfish", "chickpeas", "shrimp", "chicken", "lentils", "cod", "cauliflower", "soba", "carrots", "arctic-char", "polenta", "rice-noodles", "peaches", null] }
      }
    }
  }
}
```

`frequencyOp.token` uses the full `PLAN_TOKENS` enum (the table in §1.1), including every ingredient slug. The `$ref` notation above is documentation. Inline the defs in the task schema so `toStrictSchema` sees real nested objects (`schema.js` does not resolve `$ref`).

`acknowledgement` rules for the prompt and for `post_validate`:

- one sentence, at most 120 characters
- states only constraints present in this delta
- no meal titles, no “you’ll love”, no claim that a dinner was chosen
- `AUTHORITY_CLAIMS` in `src/ai/tasks.js` still rejects allergen / “safe for” / “gluten-free” style claims. On a match, `post_validate` replaces the string with `Got it.` and returns `ok: true` so a bad sentence does not discard a valid delta. The route then treats `Got it.` as untrusted and reconciles (§5).

### 1.4 `discovery_intent` input and output

Input matches planning, with `text.maxLength` 200 (`DISCOVERY_MAX_TEXT`). `state` is the canonical discovery state (§1.6) or `null`.

Output:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "acknowledgement", "clear", "text_residue", "max_minutes", "max_minutes_hard",
    "quick", "different", "keep_it_easy", "keep_ingredients_simple", "list_ops"
  ],
  "properties": {
    "acknowledgement": { "type": "string", "maxLength": 120 },
    "clear": {
      "type": "array",
      "maxItems": 6,
      "items": {
        "type": "string",
        "enum": [
          "text_residue", "max_minutes", "max_minutes_hard", "quick", "different",
          "keep_it_easy", "keep_ingredients_simple", "cuisines", "meal_styles",
          "flavors", "ingredients", "exclude_ingredients", "methods", "equipment",
          "textures", "effort_levels", "ingredient_complexities", "protein_groups",
          "diet", "intent_cues"
        ]
      }
    },
    "text_residue": { "type": ["string", "null"], "maxLength": 40 },
    "max_minutes": { "type": ["integer", "null"], "minimum": 5, "maximum": 240 },
    "max_minutes_hard": { "type": ["boolean", "null"] },
    "quick": { "type": ["boolean", "null"] },
    "different": { "type": ["boolean", "null"] },
    "keep_it_easy": { "type": ["boolean", "null"] },
    "keep_ingredients_simple": { "type": ["boolean", "null"] },
    "list_ops": {
      "type": "array",
      "maxItems": 6,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["field", "op", "value"],
        "properties": {
          "field": {
            "type": "string",
            "enum": [
              "cuisines", "meal_styles", "flavors", "ingredients", "exclude_ingredients",
              "methods", "equipment", "textures", "effort_levels", "ingredient_complexities",
              "protein_groups", "diet", "intent_cues"
            ]
          },
          "op": { "type": "string", "enum": ["add", "remove"] },
          "value": { "type": "string", "maxLength": 40 }
        }
      }
    }
  }
}
```

There is no `planning_intent_delta` or `discovery_intent_delta` task. A first turn sends `state: null`. A follow-up sends the canonical state from the previous response. The output schema does not change.

### 1.5 Canonical planning state

Held by the client and sent back as `state`. Produced only by `applyPlanningDelta`. The model never emits this object.

```json
{
  "dinner_count": 4,
  "date_start": "2026-10-12",
  "date_end": "2026-10-15",
  "keep_it_easy": true,
  "keep_ingredients_simple": null,
  "max_minutes": null,
  "max_minutes_hard": false,
  "effort": null,
  "ingredient_complexity": null,
  "ingredient_complexity_hard": false,
  "special_count": 1,
  "cuisines": [],
  "meal_styles": [],
  "include_ingredients": [],
  "exclude_ingredients": [],
  "exclude_categories": [],
  "frequencies": [{ "token": "fish", "min_count": 2, "max_count": 2 }],
  "intent_cues": ["weeknight"],
  "slots": [
    {
      "position": 2,
      "weekday": "tuesday",
      "date": "2026-10-13",
      "effort": "easy",
      "ingredient_complexity": null,
      "max_minutes": null,
      "max_minutes_hard": false,
      "special": null,
      "cuisine": null,
      "meal_style": null,
      "ingredient": null,
      "category": null
    }
  ]
}
```

Lists are unique and sorted. `keep_it_easy: null` means the user has not spoken about the chip. `false` means they turned it off. Slots are keyed by `date`, else `weekday`, else `position`. At most 14 slots.

**Apply order**

1. Copy `state`, or the empty state when `state` is null (all scalars null, booleans that default false set false, lists empty).
2. Apply `clear`. A scalar clears to `null` (hard flags clear to `false`). A list clears to `[]`. `slots` clears to `[]`.
3. Write each non-null scalar. A scalar present in `clear` and also non-null keeps the non-null value.
4. Apply `list_ops`, then `frequency_ops`, then `slot_ops`. `frequency` `set` replaces that token’s row. `clear` removes it. A slot `set` merges onto the matching slot; a null field inside `set` leaves the slot’s current field. Slot `clear` removes the slot.
5. If this delta sets `max_minutes` and `max_minutes_hard` is null, set `max_minutes_hard` to `true`. The model sends `false` for a soft clock (“preferably”, “not too long”).
6. Resolve targets using `context.today` and the plan’s `dates` when present. `position` is 1-based. A weekday names the date in `context.dates` with that weekday; otherwise it stays weekday-only until the plan has dates. An unresolvable target (bad date, position outside 1..14, end before start, date outside `today-1` … `today+21`) is dropped.
7. Each `include_ingredients` entry with no frequency row gains `{ token, min_count: 1, max_count: null }`. Each `exclude_categories` entry gains `{ token, min_count: null, max_count: 0 }`.
8. `post_validate` drops illegal tokens into `dropped`.
9. Clamp `dinner_count` and frequency counts into 1..14 and 0..14. Record a clamp in `dropped`.

“Fish twice” is `min_count: 2, max_count: 2`. “At least twice” is `min_count: 2, max_count: null`. “Pasta no more than once” is `min_count: null, max_count: 1`. “No pasta” is an exclude category, which step 7 turns into `max_count: 0`.

### 1.6 Canonical discovery state

```json
{
  "text_residue": null,
  "max_minutes": null,
  "max_minutes_hard": false,
  "quick": false,
  "different": false,
  "keep_it_easy": null,
  "keep_ingredients_simple": null,
  "cuisines": [],
  "meal_styles": [],
  "flavors": [],
  "ingredients": [],
  "exclude_ingredients": [],
  "methods": [],
  "equipment": [],
  "textures": [],
  "effort_levels": [],
  "ingredient_complexities": [],
  "protein_groups": [],
  "diet": [],
  "intent_cues": []
}
```

Same apply order, without frequencies or slots. `text_residue` is leftover literal tokens (max 40), never the raw utterance.

### 1.7 What the prompt tells Luna

Bump the templates. Keep the D-05 system lines (JSON only, no chain-of-thought, no authority over allergens, eligibility, servings, membership, votes, versions, taste scores). Add:

- null scalars and empty op arrays leave current state alone
- do not restate constraints that are already in `state` and unchanged
- “fish twice” → frequency `fish` min 2 max 2, not `seafood`
- “pasta no more than once” → frequency `pasta` max 1
- a named day is a `slot_op`, not a global `effort`
- “mostly easy” / “keep it easy” → `keep_it_easy: true` and `effort: null`
- “only easy” / “really easy” on a named day → slot `effort: "easy"`
- “under 30” / “keep everything under 30” → `max_minutes: 30` and `max_minutes_hard: true`
- “simple ingredients” → `keep_ingredients_simple: true`
- “only simple ingredients” → `ingredient_complexity: "simple"` and `ingredient_complexity_hard: true`
- cues come from the nine-word enum only
- `acknowledgement` describes this delta and does not name a dish or a safety claim

---

## 2. Planner composition

`parsePlanIntent` (`src/lib/plan-contract.js`) and `planDinners` (`src/lib/dinner-planner.js`) stay the executor. New fields are optional and default so today’s callers keep today’s behavior: no frequencies, no excludes, soft minutes, no per-slot effort, `special_count: null`.

The interpret route builds this intent from canonical state. It does not pass model JSON to `planDinners`.

| User language | Canonical field | Existing engine input | Engine change |
|---|---|---|---|
| “Three dinners”, “four dinners” | `dinner_count` | `intent.dinner_count` (1..14, `assertDinnerCount`) | None. “This week” is still not a count inside `parsePlanIntent`. The model emits `dinner_count: null` plus `date_start` / `date_end`. The applier sets `dinner_count` to the inclusive day count from `max(today, start)` through `end`, capped at 14. A range that does not yield a count fails with `dinner_count_required` and does not call the planner. |
| “Mostly easy”, “keep it easy” | `keep_it_easy: true` | `planningPreferences` / `preferenceTier` soft ladder | None. This is not `effort_levels`. |
| “Only easy”, “nothing but easy” | `effort: "easy"` and `keep_it_easy: true` | none as a hard pool filter | New optional `intent.require_effort`. When set, the slot pool drops other effort levels. Unknown `effort_level` fails that filter. If the pool is empty, record `constrained_requests` and leave the slot `constrained`. Do not invent a meal. |
| “Tuesday needs to be really easy” | slot `effort: "easy"` | `slots[]` today store only `participant_ids` | Extend the slot. While picking index `i`, merge that slot’s fields over the global intent for the pool filter and for `preferenceTier`. Other indexes keep the global intent. |
| “Simple ingredients” | `keep_ingredients_simple: true` | soft `preferenceTier` on `ingredient_complexity` | None. |
| “Only simple” / “nothing adventurous” | `ingredient_complexity: "simple"`, `ingredient_complexity_hard: true` | none as a hard filter | New optional `intent.require_ingredient_complexity`. Same pool rule as `require_effort`. The soft chip stays the soft chip. |
| “Under 30 minutes”, “keep everything under 30” | `max_minutes: 30`, `max_minutes_hard: true` | `max_cook_minutes` is a +0.2 boost today; `under_30_minutes` hint is also a boost | New `intent.max_cook_minutes_hard`. `false` (the default) keeps the boost. `true` filters `total_minutes <= max`. Unknown minutes fail closed for that slot. Per-slot `max_minutes` uses the same flag on the slot. |
| “Preferably under 45”, “not too long” | `max_minutes: 45`, `max_minutes_hard: false` | the existing boost | None beyond writing `max_cook_minutes`. |
| “Fish twice” | frequency `fish` min 2 max 2 | `requested_ingredient` is one slug, a +2 boost, and `requirementTier`. It does not count. | New `intent.frequencies`. See the pass below. Do not encode this as `requested_ingredient`. |
| “Pasta no more than once” | frequency `pasta` max 1 | `conflicts()` is a soft cuisine/style spread inside the taste band, not a cap | `max_count` is a hard cap relative to eligibility. The picker skips a meal that would exceed it while another meal exists at the same preference tier. If none exist, the slot stays `constrained`. It does not break the cap. |
| “No pasta”, “no shrimp” | `exclude_categories` / `exclude_ingredients` | Discovery has `exclude_ingredients`. The planner does not. | Filter the pool with Discovery’s identity: canonical ingredient id, vocabulary tag, or `primary_ingredient` for ingredients; `PLAN_TOKENS` match for categories. This does not write `constraint_rule`. |
| “One meal that’s a little different”, “Friday something special” | `special_count` and/or slot `special: true` | Catalog `exploration` (number). Discovery uses it in novelty (`NOVELTY_EXPLORATION_MIN` 0.55). The planner ignores it. | On a special slot, sort the chosen preference tier by `exploration` descending, then the existing taste order. Prefer `exploration >= 0.55` when any such meal is in the tier. `special_count` with no named slot marks the Friday slot when Friday is in range, otherwise the last position. Special does not bypass eligibility, effort, excludes, or a hard clock. |
| “Weeknight” | cue `weeknight` | practical hint `weeknight` is unscored (`unscored_hints`) | Score that hint with the weeknight row of the cue table (§3), once. Remove `weeknight` from the unscored set. Still not a hard filter and not `criteria.quick`. |
| “Something we’ll both like” | no field | `scoreDinerTastes` already sums the participants | None. The model adds no taste rank and no averaged preference. |

**Frequency pass** (only when `frequencies` is non-empty):

- **Pass A.** Existing rank and diversity, after the new pool filters (eligibility, excludes, hard effort, hard complexity, hard minutes, `max_count`).
- **Pass B.** For each token with `placed < min_count`, try to replace a non-protected slot with the highest-scored eligible meal that raises that token and keeps every `max_count` and every per-slot hard field. Protected slots are ones with an explicit slot ingredient, category, or cuisine that the replacement would drop. If still short, append `constrained_requests`: `{ field: "frequency", token, min_count, placed, reason: "insufficient_eligible" }`. Do not add a meal that is not in the catalog.

**Stability on refinement.** A full `planDinners` run happens when the previous canonical state was null, or when this delta changes `dinner_count` or the date range. Otherwise re-pick only affected positions and pass the other slots through `usedFromSlots` / `swapSlot`:

| Delta | Positions that may change |
|---|---|
| Slot op | That position only |
| New global hard clock, hard effort, hard complexity, or exclude | Positions whose current meal violates it |
| Frequency min raised | The fewest non-matching, non-protected positions needed, highest position first |
| Frequency max lowered | Matching positions above the cap, highest position first |
| “Swap one for &lt;token&gt;” (frequency min 1 max 1, or a single include, and the utterance is a swap) | One position: the last position that does not already match and is not protected |
| `dinner_count` increased | The new tail positions only. Existing `recipe_version_id`s stay. |
| `dinner_count` decreased | Drop the tail. Survivors stay. |

The response lists `changed_positions` (1-based). The client animates those cards. Unaffected nights keep their pinned version ids.

`requested_ingredient` remains for a single include that is not a counted frequency: one ingredient, no frequency row yet. Step 7 of apply already adds `min_count: 1`, so the frequency pass is the mechanism. Do not also set `requested_ingredient` in that case (it would double-weight). Leave `requested_ingredient` for existing non-Weave callers only.

---

## 3. Fuzzy `intent_cues`

Nine cues. The model emits the enum. The server owns the weights. No meal is sent to Luna for scoring.

The same table feeds Discovery and the planner. Discovery reads cues from `query.intent_cues`. The planner adds the same clamped total inside `scoreFeature` (with the existing taste score). A cue never filters, never writes a taste row, and never changes eligibility.

**Discovery query.** `normalizeQuery` accepts `intent_cues`: a list of the nine slugs, max 4, unique, sorted. Unknown slug → `intent_cues_invalid`. Omitted → `[]`. Query string: repeated `cue`. `QUERY_KEYS` gains `intent_cues`. It is not a `criteria` field and not a hard exclusion code.

**Score.** Each matching signal adds its weight. The meal total is clamped to **[-0.40, 0.40]**. Signals come from `vocabulary_tag_ids` (via `getTasteTerm`) plus catalog `effort_level`, `ingredient_complexity`, `total_minutes`, and `exploration`.

**Discovery sort key** becomes:

`preference_tier` ascending, then `taste_score + cue_score` descending, then `match_score` descending, then `recipe_slug` ascending.

`taste_score` itself stays `scoreDinerTastes`. A Love nudge is +1.5 (`TASTE_NUDGE`), so Love plus the worst cue (−0.40) is still 1.10, above an untasted meal plus the best cue (0.40). A Like is +0.65, which beats an untasted meal unless the cue gap is wider than 0.65. Untasted meals (score 0) reorder by the cue.

Stage 7 still runs. When `intent_cues` is non-empty, `applyNoveltyDiversityRecency` returns the rows in the order it received them, so diversity does not undo the cue. The trace row is still emitted (`in == out`). When the cue list is empty, stage 7 is unchanged.

Add reason code `intent_cue` immediately before `eligible_catalog_fit` in `RANK_REASON_CODES`. It is present when `cue_score > 0`. It does not outrank taste or explicit-criteria codes in `PRIMARY_REASON_PRIORITY`.

| Cue | Weights |
|---|---|
| `cozy` | flavor `rich` +0.15, `savory` +0.10, `umami` +0.10; texture `creamy` +0.10; style `soups` +0.15, `stews` +0.15 |
| `fresh` | flavor `fresh` +0.20, `citrusy` +0.15, `herbaceous` +0.10; flavor `rich` −0.10 |
| `filling` | style `stews` +0.15, `pasta` +0.10, `bowls` +0.10, `curries` +0.10; flavor `rich` +0.10 |
| `light` | flavor `fresh` +0.15, `citrusy` +0.10, `herbaceous` +0.10; flavor `rich` −0.20; texture `creamy` −0.10; style `stews` −0.10 |
| `comforting` | flavor `rich` +0.15, `savory` +0.10, `umami` +0.10; texture `creamy` +0.10, `tender` +0.05; style `soups` +0.10, `stews` +0.10, `pasta` +0.10 |
| `summery` | flavor `fresh` +0.15, `citrusy` +0.15, `herbaceous` +0.10; style `grilled` +0.15; flavor `rich` −0.10 |
| `special` | `exploration >= 0.55` → +0.25, else `exploration * 0.10`; `ingredient_complexity == adventurous` → +0.10. Does not set `criteria.different`. |
| `restaurant_like` | `exploration >= 0.55` → +0.15; flavor `umami` +0.10, `rich` +0.10; complexity `standard` or `adventurous` → +0.10; `effort_level == involved` → +0.05 only when `keep_it_easy` is not true |
| `weeknight` | effort `easy` +0.20, `moderate` +0.05, `involved` −0.15; minutes `<= 30` +0.15, `<= 45` +0.05, `> 45` −0.05, unknown 0; complexity `simple` +0.10. Does not set `criteria.quick` or `effort_levels`. |

Two cues sum, then the clamp runs. `fresh` + `filling` cancels the `rich` terms (+0.10 and −0.10). That is intended.

`restaurant_like` together with `keep_it_easy: true` (“restaurant-like without much effort”) keeps the exploration and flavor weights and drops the involved-effort bonus.

On a plan, cue `special` also sets `special_count` to 1 when `special_count` is null and no slot is already `special`. Cue `weeknight` and the practical hint `weeknight` share one application of that row.

**Discovery clock.** `max_minutes_hard: true` writes `criteria.max_minutes` (existing hard filter). `quick: true` writes `criteria.quick`. `max_minutes_hard: false` writes a new optional `prefer_max_minutes` (integer 5..240). `normalizeQuery` accepts it. It adds +0.15 inside `cue_score` when `total_minutes <= N`, and it does not drop a meal. Hard and prefer both set → hard only.

**Find binding**, matching `NLP_BINDING_RULES`:

| Language | Field |
|---|---|
| “keep it easy”, “easy” inside a longer fuzzy request | `soft.keep_it_easy` |
| “only easy”, or the bare bypass word `easy` | `criteria.effort_levels: ["easy"]` |
| “quick”, “under 30” | `criteria.quick` and, for a stated number, `criteria.max_minutes` |
| “simple ingredients” as a lean | `soft.keep_ingredients_simple` |
| “only simple” | `criteria.ingredient_complexities: ["simple"]` |

---

## 4. Deterministic Find bypass

Run this before `run()`. A bypass does not call Luna, does not reserve budget, and returns `source: "bypass"`.

**Bypass** when the whole normalized string is one lexicon entry. Normalization is `normalizeTasteTerm` (trim, lower case, punctuation to spaces, collapsed whitespace). The lexicon is:

- every active taste term’s slug, display name, and synonyms
- protein groups `fish`, `seafood`, `shellfish`
- diet words `dairy free` → `dairy_free`, `plant`, `vegetarian`, `plant based` → `plant_based`
- effort words `easy`, `moderate`, `involved`
- complexity words `simple`, `standard`, `adventurous`
- closed phrases `quick`, `under 30`, `under 30 minutes`, `30 minutes` → `{ quick: true }`

**Call `discovery_intent`** when any of these is true:

- the normalized string is not a lexicon key
- any token is a function word: `something`, `and`, `with`, `without`, `but`, `not`, `too`, `for`, `like`, `under`, `over`, `more`, `less`, `very`, `really`, `make`, `find`, `show`, `give`, `us`, `me`, `a`, `an`, `the`, `of`, `to`, `that`, `feels`, `feel`, `food`, `dinner`, `dinners`, `meal`, `meals`, `style`, `styled`, `restaurant`, plus the nine cue words

The closed phrases are tested before the function-word check, so `under 30` still bypasses. `easy fish` does not: it is not one lexicon key, and `easy` is not a function word, but the whole string misses the lexicon, so it calls Luna. `something cozy` hits the function word. `korean grill` is two concepts and calls Luna. `stir fry` and `taco night` bypass because they are synonyms of one term.

**Patch the bypass writes** (text stays null; the criterion carries the match):

| Hit | Canonical write |
|---|---|
| cuisine | `cuisines: [slug]` |
| meal style | `meal_styles: [slug]` |
| flavor | `flavors: [slug]` |
| texture | `textures: [slug]` |
| ingredient | `ingredients: [slug]` |
| `fish` / `seafood` / `shellfish` | `protein_groups` |
| diet word | `diet` |
| `easy` / `moderate` / `involved` | `effort_levels` |
| `simple` / `standard` / `adventurous` | `ingredient_complexities` |
| quick phrases | `quick: true` |

Empty text does not call Luna. It returns the current discovery state unchanged.

The composer looks the same on both paths.

---

## 5. Conflicts and acknowledgement

### 5.1 Conflict detection

After apply, before execute. Participants are the session’s active members, or `participant_ids` checked with `assertParticipants`. The client cannot send `constraints`.

For each include ingredient, frequency token, and slot ingredient/category that names a protein or an ingredient:

1. If no catalog meal matches the token, this is the existing `no_catalog_coverage` constrained request, not a conflict.
2. If at least one catalog meal matches and **none** of those meals pass `assessMealEligibility` for the full participant set, emit:

```json
{
  "code": "hard_ineligible",
  "field": "include_ingredients",
  "token": "shrimp",
  "limit_ids": ["no_shellfish"],
  "alternative": { "kind": "category", "token": "fish" }
}
```

3. Remove that token from the executed copy (includes, frequencies, slot copies, excludes that named it).
4. Choose one alternative, in order, stopping at the first with at least one eligible catalog meal:
   - token is `shrimp`, `shellfish`, or an ingredient mapped to shellfish in `INGREDIENT_LIMITS` → category `fish`
   - token is `fish` or a finfish ingredient → `{ "kind": "drop" }` (do not suggest shellfish)
   - anything else → `{ "kind": "drop" }`
5. Run the planner or Discovery on the repaired intent. Results are the native alternatives. The conflict object does not contain a recipe title.

`limit_ids` use `HARD_LIMIT_IDS` (`no_shellfish`, `no_finfish`, `no_dairy`, `no_nuts`, `no_meat`, `no_poultry`). They are for the client chip and for tests. The sentence below does not read them aloud and does not name a diner.

Intersection is unchanged: one diner’s limit blocks the table. A taste rank cannot put the meal back.

### 5.2 Acknowledgement lifecycle

The client types `response.acknowledgement` and nothing else. Provider streaming is not the UI contract.

Keep the model sentence only when all of these hold:

- it is not the sentinel `Got it.`
- `AUTHORITY_CLAIMS` does not match
- `conflicts` is empty
- `dropped` is empty
- no executed token was removed by the conflict pass
- the sentence does not contain the slug or display name of a dropped or conflicted token (case-insensitive)

Otherwise replace it. `acknowledgement_source` is `model` or `reconciled`.

The replacement is a template over the **executed** state, capped at 120 characters, cut on a word boundary:

- Conflict with a fish alternative: `I can't use {display} for everyone at your table, but I can find another seafood dinner.`
- Conflict with `kind: drop`: `I can't use {display} for everyone at your table, so I left that out.`
- Otherwise join the chip phrases in §7 (`3 dinners`, `Easy leaning`, `Fish ×2`, `Friday: special`).

`{display}` comes from `getTasteTerm(slug).display_name`, or the token itself for a category. The template does not say allergic, safe, allowed, or free-from.

A direct chip edit uses the same template with `acknowledgement_source: "reconciled"` and does not call Luna.

---

## 6. Conversation state

One task context, not a transcript.

```json
{
  "task": "planning_intent",
  "revision": 3,
  "state": {},
  "acknowledgement": "Tuesday’s easier.",
  "acknowledgement_source": "reconciled",
  "conflicts": [],
  "chips": [],
  "changed_positions": [2]
}
```

`revision` increments on every successful apply, including chip edits.

**Where it lives**

| Data | Where | Notes |
|---|---|---|
| Canonical discovery state | The existing discovery query string, plus repeated `cue` | Criteria, soft flags, `prefer_max_minutes`. No acknowledgement. |
| Canonical planning state, latest ack, conflicts, revision | `sessionStorage` key `fw-weave:planning:<dinner_plan_id or draft>` | Restores Back from a recipe. Not `localStorage`. Not D1. |
| Latest utterance | In-memory composer only | Stays on error so the person can edit and retry. Cleared on success. Not written to sessionStorage, the URL, the plan row, or analytics. |
| Saved dinners | Existing dinner plan | Version ids, chips that were committed through `set_planning_preferences`, dates. |

The next Luna input is `{ text, state, context }`. `state` has no acknowledgement and no utterance.

Discovery fallback may place the normalized utterance (max 200) on `DiscoveryQuery.text` so the existing text matcher can run and Back can restore that search. That is the only stored copy of user language, and it is the search string, not a conversation log. The successful Luna path writes `text_residue` only. The bypass path leaves `text` null.

Planning never writes the utterance onto the plan.

Leaving the task (a new plan, a cleared Find) drops the session key. Household memory is still the plan, the ratings, and the explicit taste actions.

---

## 7. API

Both routes require a session. Both ignore client `constraints`, `eligible`, and `tastes` (`client_constraints_forbidden`, as Discovery does). Both return JSON. Neither calls `run()` more than once. Neither writes the plan. The client commits a new plan with `POST /api/dinner-plans` and a slot change with the existing mutation route, using `changed_positions` and the preview’s `recipe_version_id`.

### `POST /api/plan/interpret`

```json
{
  "schema_version": 1,
  "text": "Make Tuesday easier.",
  "state": {},
  "dinner_plan_id": "dp_1",
  "participant_ids": ["m1", "m2"],
  "timezone": "America/Chicago"
}
```

`text` required, 1..500 after trim. `state` is the canonical planning state or null. `dinner_plan_id`, when present, must belong to the session household. When `state` is null and a plan id is present, the server seeds state from that plan’s stored intent (dinner count, chips, dates, participants). It does not seed from previous acknowledgements.

```json
{
  "ok": true,
  "task": "planning_intent",
  "source": "provider",
  "model": "gpt-6-luna",
  "prompt_version": "planning_intent@2",
  "acknowledgement": "Making Tuesday easier.",
  "acknowledgement_source": "model",
  "state": {},
  "chips": [{ "id": "slot:tuesday:effort", "label": "Tuesday: easy" }],
  "conflicts": [],
  "dropped": [],
  "changed_positions": [2],
  "preview": {},
  "fallback_code": null
}
```

`source` is `provider`, `cache`, or `fallback`. `preview` is the `planDinners` / retarget result (same slot shape the preview route already returns) plus `changed_positions`. `chips` are server-built from executed state:

| id | Label |
|---|---|
| `dinner_count` | `3 dinners` |
| `keep_it_easy` | `Easy leaning` |
| `keep_ingredients_simple` | `Simple ingredients` |
| `effort` | `Only easy` |
| `ingredient_complexity` | `Only simple ingredients` |
| `max_minutes` | `Under 30 min` |
| `freq:fish` | `Fish ×2` when min=max, otherwise `Fish ≥2` or `Pasta ≤1` |
| `exclude:pasta` | `No pasta` |
| `include:salmon` | vocabulary display name |
| `cuisine:korean` | display name |
| `style:tacos` | display name |
| `cue:light` | `Not too heavy` (`cozy`→`Cozy`, `fresh`→`Fresh`, `filling`→`Filling`, `comforting`→`Comforting`, `summery`→`Summery`, `special`→`Special`, `restaurant_like`→`Restaurant-style`, `weeknight`→`Weeknight`) |
| `slot:friday:special` | `Friday: special` |
| `special_count` | `Something special ×1` when no slot already shows it |

Removing a chip applies the inverse delta locally (`src/weave/apply-delta.js` is pure and shared) and calls the existing preview or search route. It does not call interpret.

### `POST /api/discovery/interpret`

```json
{
  "schema_version": 1,
  "text": "Something cozy but not too heavy",
  "state": null,
  "mode": "standalone",
  "context": { "participant_ids": ["m1"] },
  "timezone": "America/Chicago"
}
```

`mode` is the D-07 set. Plan modes still require the plan id and meal id rules in `docs/D07-QUERY-CONTRACT.md`. The route runs bypass or one `discovery_intent` call, applies the delta, reconciles, then `runDiscoveryPipeline` on the mapped query. The response includes the interpret fields above (`task: "discovery_intent"`) and the search fields (`results`, `query`, `total`, `excluded_counts`, `soft`, `soft_source`). `query.text` follows §6.

Mapping from canonical discovery state to `DiscoveryQuery` extends `intentToDiscoveryQuery`. Lists that are non-empty become `criteria`. `keep_*` null omits `soft` (inherit). `keep_*` true or false sends `soft`. `intent_cues` and `prefer_max_minutes` pass through `normalizeQuery`. Illegal values are dropped, not forced.

### Fallback

Gateway codes stay the D-05 set, including `output_limit` (Responses `incomplete` with reason `max_output_tokens`). The full set is `timeout`, `rate_limited`, `malformed_output`, `output_limit`, `provider_outage`, `disabled`, `budget_exceeded`, `invalid_input`, `provider_unconfigured`. No second model. `output_limit` does not take the repair retry; only `timeout` and `provider_outage` do.

| Situation | HTTP | Body |
|---|---|---|
| Planning, Luna failed or the delta was empty | 200 | `ok: true`, `source: "fallback"`, `fallback_code` set, `state` unchanged, `preview: null`, `acknowledgement: null`. The client shows: “I couldn't quite make sense of that. Try saying it another way, or use the options below.” Composer text stays. |
| Discovery, Luna failed or the delta was empty | 200 | Same code, and `query.text` is the normalized utterance (max 200). Results are the D-07 text search, including a legitimate empty page. No provider wording. |
| Discovery bypass | 200 | `source: "bypass"`, no `fallback_code`. |
| Bad JSON, bad schema version, text length, forbidden constraint keys | 400 | Existing error codes. |
| No session | 401 | |
| Plan or member outside the household | 403 | |

`fallback_code` is for tests and telemetry. The UI does not render it. Rate limit and budget return 200 with the fallback above so the screen stays on chips, search, and the planner.

---

## 8. Output caps and reasoning

`max_output_tokens` on the Responses API includes reasoning tokens. The gateway already records them as `reasoning_tokens` inside usage metadata. Caps replace the current task limits (`planning_intent` inherits the 400 default; `discovery_intent` is 250):

| Task | Cap | Timeout | `reasoning_effort` |
|---|---|---|---|
| `planning_intent` | **560** | 8000 ms | `minimal` (already set; keep it) |
| `discovery_intent` | **320** | 5000 ms | `minimal` (already set; keep it) |

Luna’s model ceiling stays 600 (`MODEL_OUTPUT_CEILINGS`). `effectiveMaxOutputTokens` still takes the minimum. Do not set either task to 600. The explanation task’s raise from 120 to 300 after an `output_limit` smoke is the pattern: size the cap from the schema, and leave a margin the ceiling can still hold.

**Measurement.** Build one JSON object that fills every max-length string and every maxItems array allowed by §1.3 / §1.4. `estimated = ceil(utf8_bytes / 4)`. Add **80** tokens because `minimal` reasoning shares the output cap. Round up to the next 20, and stay ≤ 600.

Saturated fixtures that produced these caps:

- Planning: 120-character acknowledgement, 6 `clear` entries, all scalars set, 4 `list_ops`, 3 `frequency_ops`, 3 fully populated `slot_ops`. **1812 bytes → 453 tokens.** 453 + 80 = 533, rounded to **560**.
- Discovery: 120-character acknowledgement, 6 `clear` entries, all scalars set, 40-character `text_residue`, 6 `list_ops`. **838 bytes → 210 tokens.** 210 + 80 = 290, rounded to **320**.

A typical planning delta (“three easy dinners, fish twice, Friday special”) is about 160 tokens. The cap is headroom over the saturated object, not a guess at the typical one.

If a field is added, remeasure in the same change. If Preview returns `output_limit`, raise that task’s cap by 40, still ≤ 600. That is the only knob. Do not switch models and do not raise `reasoning_effort`.

**Reasoning.** `REASONING_EFFORTS` already requires every task to set an effort. Both D-06 tasks are `minimal`. `run()` already copies `task.reasoning_effort` onto the provider request, and `buildResponsesRequest` already writes `reasoning: { effort }` on the Responses body. Leave that path alone. `buildResponsesRequest` does not copy `temperature` onto the wire; do not add it for these tasks. Do not move either task to `none` or `low` in this cycle. Sol is not a retry, and `run()` does not escalate.

`planning_intent` is enabled by adding it to `AI_TASKS_ENABLED` beside `discovery_intent` on Preview. Leave every other task disabled. Production flags are out of this card.

---

## 9. Telemetry

Emit through the existing client `track()`. `persistEvent` currently posts a fixed column set; extend it only with the properties below. Reject any other property. No utterance, acknowledgement, residue, chip label, or state JSON.

| Event | When | Properties |
|---|---|---|
| `weave_composer_opened` | Composer focused | `task` (`planning_intent` \| `discovery_intent`), `surface` (`plan` \| `find` \| `plan_refine` \| `find_refine`) |
| `weave_submitted` | Submit | `task`, `surface`, `turn_index` (integer ≥ 1) |
| `weave_route_chosen` | After bypass decision | `task`, `route` (`bypass` \| `luna`) |
| `weave_result` | Response applied | `task`, `source` (`provider` \| `cache` \| `bypass` \| `fallback`), `fallback_code` (enum or absent), `provider_latency_ms`, `deterministic_latency_ms`, `total_latency_ms`, `conflict` (`0` \| `1`), `cue_count` (0..4) |
| `weave_refinement` | `turn_index > 1` and Luna or a chip edit | `task`, `turn_index`, `kind` (`luna` \| `chip`) |
| `weave_suggestion_used` | Starter or follow-up chip | `task`, `suggestion_id` matching `^[a-z0-9_]{1,40}$` |
| `weave_chip_edited` | Direct chip edit | `task`, `chip_id` matching `^[a-z0-9_:]{1,40}$`, `op` (`remove` \| `set`) |
| `weave_plan_generated` | Preview returned meals | `dinner_count`, `source` (`weave` \| `manual`) |
| `weave_discovery_selected` | Result opened | `recipe_slug` |
| `weave_downstream` | Cook, add, or swap after a weave result | `action` (`cook` \| `add` \| `swap`), `recipe_slug` |

`suggestion_id` is the chip’s id, not its sentence. These events answer the §44 questions (language vs manual, refinement rate, which cues, bypass rate, failure rate, cook/add/swap) without storing language. `cue_count` is a count. Which cue was used is visible from server logs only as the structured state in `ai_cache`, not as an analytics property. Do not add a free-text `cue` property.

Server logs for the route follow D-05: task id, error code, attempt count, latencies. No prompt and no acknowledgement.

---

## 10. Eval corpus and semantic checks

**File (when Composer builds it):** `test/fixtures/d06-intent-corpus.json`.

**Households** are synthetic. No production export. Limits use `HARD_LIMIT_IDS`. The harness maps them through the existing eligibility adapters.

```json
{
  "clear": { "members": ["a", "b"], "limits": { "a": [], "b": [] } },
  "dairy": { "members": ["a", "b"], "limits": { "a": ["no_dairy"], "b": [] } },
  "shellfish": { "members": ["a"], "limits": { "a": ["no_shellfish"] } },
  "mixed": { "members": ["a", "b"], "limits": { "a": ["no_finfish"], "b": ["no_meat"] } },
  "allergen": { "members": ["a", "b"], "limits": { "a": ["no_nuts"], "b": ["no_shellfish"] } }
}
```

**Case:**

```json
{
  "id": "plan-fish-twice",
  "task": "planning_intent",
  "kind": "initial",
  "text": "Give us four dinners. Fish twice, and don't give us pasta more than once.",
  "state": null,
  "household": "clear",
  "expect": {
    "schema_valid": true,
    "bypass": false,
    "dinner_count": 4,
    "frequencies": [
      { "token": "fish", "min_count": 2, "max_count": 2 },
      { "token": "pasta", "max_count": 1 }
    ],
    "invented_limits": false,
    "conflict": null
  }
}
```

`expect` atoms are semantic. A case may set `frequencies_any` to a list of acceptable frequency arrays when two shapes mean the same thing. `fish` and `seafood` are **not** alternatives for “fish twice”. `seafood` includes shellfish.

**Checker**

1. Validate the model JSON (or the fixture’s recorded delta) against the task output schema.
2. Apply it with `applyPlanningDelta` / `applyDiscoveryDelta`.
3. Assert each `expect` atom on the canonical state, the conflict list, and `source`.
4. `invented_limits: false` means the delta contains no `HARD_LIMIT_IDS`, no `rule_key`, and no allergen strings.
5. `dropped_critical` is empty: every atom is present. Extra unspecified cues or notes fail only when the case sets `exact_cues: true`.
6. Slot atoms match `weekday` / `date` / `position` and the named fields. Other slots may exist only when the case allows them (`slots_exact`).
7. Acknowledgement, when `expect.ack` is `reconciled`, must not contain a conflicted token. Exact acknowledgement equality is not required.
8. Bypass cases assert the gateway was not called.
9. Refinement cases include `state` and assert unaffected fields are unchanged (`preserved: ["dinner_count", "frequencies"]`).

**Required ids**

| id | Kind | Expect |
|---|---|---|
| `plan-count-three` | initial | `dinner_count: 3` |
| `plan-effort-easy` | initial | `keep_it_easy: true`, `effort: null` |
| `plan-simple-ingredients` | initial | `keep_ingredients_simple: true` |
| `plan-fish-twice` | initial | fish min 2 max 2 |
| `plan-pasta-max-once` | initial | pasta `max_count: 1` |
| `plan-tuesday-easy` | initial | slot Tuesday `effort: easy`, global `effort: null` |
| `plan-combined-four` | initial | count 4, fish ×2, pasta ≤1 |
| `plan-fuzzy-not-heavy` | initial | cue `light` |
| `plan-special-one` | initial | `special_count: 1` or Friday `special: true` |
| `plan-conflict-shrimp` | conflict, household `shellfish` | conflict `shrimp` / `no_shellfish`, executed intent has no shrimp, alternative `fish` |
| `plan-refine-tuesday` | refinement | only Tuesday’s effort changes |
| `plan-refine-swap-fish` | refinement | one fish frequency, other nights preserved |
| `plan-refine-no-pasta` | refinement | pasta excluded, non-pasta nights preserved |
| `plan-refine-friday-only` | refinement | Friday `special`, other slots unchanged |
| `plan-multi-diner` | conflict, household `mixed` | finfish request conflicts for the table; meat request conflicts for the table |
| `find-salmon-bypass` | bypass | ingredients `salmon`, Luna not called |
| `find-korean-bypass` | bypass | cuisines `korean` |
| `find-tacos-bypass` | bypass | meal style `tacos` |
| `find-easy-bypass` | bypass | `effort_levels: ["easy"]` |
| `find-cozy-easy` | initial | cues include `cozy`, `keep_it_easy: true` |
| `find-fresh-fish` | initial | cue `fresh`, protein `fish` |
| `find-restaurant-low-effort` | initial | cue `restaurant_like`, `keep_it_easy: true` |
| `find-summery-fish` | initial | cue `summery`, protein `fish` |
| `find-refine-spicier` | refinement | flavor `spicy` added, prior cues kept |
| `find-zero` | initial | schema valid; zero results are a 200 from the pipeline, not a schema failure |
| `find-conflict-shellfish` | conflict, household `shellfish` | shrimp or shellfish token removed, alternative recorded |

Live Luna calls are capped by the oversight budget in the brief ($0.05). CI runs this corpus against the fake provider and recorded deltas. A live sample is not part of CI.

---

## Behaviour

1. Person submits from Plan or Find.
2. The client shows its working state immediately and sends one interpret request with the current canonical `state` (null on the first turn).
3. Find either bypasses or calls `discovery_intent`. Plan calls `planning_intent`. Both are Luna, minimal reasoning, one call.
4. The server applies the delta, resolves dates, drops unknown tokens, runs eligibility, reconciles the acknowledgement, and executes the planner or the Discovery pipeline.
5. The response carries the new state, chips, conflicts, acknowledgement, and native results (`preview` or `results`).
6. The client types that acknowledgement, shows the chips, and updates only `changed_positions` on a plan refinement.
7. A chip removal or a manual D-01 / D-07 control changes the same canonical state through the pure applier and the existing plan or search routes.
8. Commit still goes through `POST /api/dinner-plans` and the existing mutations. Interpret does not persist.

---

## Edge cases

| Case | Result |
|---|---|
| “This week” with no number | Dates for the Monday–Sunday week that contains `context.today`. `dinner_count` becomes the inclusive count from `max(today, Monday)` through Sunday. |
| “Plan dinner through Thursday” | `date_start = today`, `date_end` = Thursday of that week. Count is the inclusive span. Not four slot ops. |
| “Tonight” | One dinner, slot `date = context.today`. |
| Date outside `today-1` … `today+21`, or `date_end < date_start` | Date dropped, acknowledgement reconciled. |
| More than 3 named days in one utterance | The schema caps `slot_ops` at 3. A 4th day is a model-schema failure and takes the one repair retry, then the planning fallback. The prompt tells the model to prefer a date range when the request is a span. |
| “Make Tuesday easier” and there is no Tuesday in range | Slot op dropped as `slot_target_unresolved`. State otherwise unchanged. Reconciled ack. No full replan. |
| “Swap one for fish” when a dinner is already fish | No position changes. Frequency is already satisfied. Ack from the template. |
| Frequency min cannot be filled | `constrained_requests` records the shortfall. Other nights still fill. The plan is not emptied. |
| `max_count` would have to break to fill a night | That night stays `constrained`. The cap holds. |
| Shrimp requested, shellfish blocked, finfish eligible | Conflict, token removed, alternative `fish`, preview is eligible seafood. Ack is the seafood template. |
| Shrimp requested, finfish also blocked | Alternative `drop`. Preview is the rest of the intent with shrimp removed. |
| User asks only for the blocked food | Repaired intent has no token. Planner still fills `dinner_count` with eligible meals. |
| Model acknowledgement claims “safe” or names the dropped token | `post_validate` keeps the delta. The route replaces the sentence with the template. A schema-invalid JSON body still gets the one repair retry inside `run()`. |
| Empty delta | Planning fallback sentence. Discovery text search. |
| Gateway disabled, budget, or rate limit | Fallback in §7. Manual chips, search, and the planner still work. |
| “Something we’ll both like” | No new taste field. Both diners’ existing tastes rank, as they do today. |
| Cue plus a hard filter | Filter runs in pipeline stage 4. Cue only sorts survivors. |
| `intent_cues` empty | Discovery sort and novelty match D-07 exactly. |
| Direct chip removal | No Luna call. `weave_chip_edited` fires. `revision` increments. |
| Reload | Planning context returns from `sessionStorage`. The utterance does not. Chips and the latest ack do. |

---

## Non-goals

- A second planner, a second ranker, or an LLM taste score.
- New task ids for refinement, explanation, or query generation.
- Sol as a retry, and any Astra model.
- Free-form post-meal feedback, recipe adaptation, Sparks, onboarding, or cooking help.
- Persisting a transcript, writing taste evidence from an utterance, or averaging two diners into one preference.
- Model-written allergen explanations. The conflict template is the eligibility sentence.
- Changing `parsePlanIntent` defaults for existing clients.
- UX layout, motion, and copy voice beyond the acknowledgement templates in §5.
- Production flag changes and the production OpenAI-secret check. Those belong to the implementation cycle, not this decision.

---

## Where Composer edits

| Piece | Home |
|---|---|
| Schemas, caps (560 / 320), `executable: true` on `planning_intent`, `post_validate`. Leave `reasoning_effort: "minimal"` | `src/ai/tasks.js` |
| Prompt `@2` | `src/ai/prompts.js` |
| Pure apply, chips, ack template, conflict tokens | `src/weave/apply-delta.js` |
| Bypass lexicon | `src/weave/bypass.js` |
| Cue table | `src/weave/cues.js` |
| `POST /api/plan/interpret`, `POST /api/discovery/interpret` | `src/weave/routes.js`, wired from `src/index.js` |
| Optional intent fields, frequency pass, per-slot merge, hard clock, excludes, special sort, refinement retarget | `src/lib/plan-contract.js`, `src/lib/dinner-planner.js` |
| `intent_cues`, `prefer_max_minutes`, sort key, stage-7 no-op when cues are set, `intent_cue` reason | `src/discovery/query.js`, `src/discovery/constants.js`, `src/discovery/pipeline.js`, `src/discovery/novelty.js`, `src/discovery/reasons.js` |
| Extend `intentToDiscoveryQuery` | `src/ai/intent-adapter.js` |
| Corpus and semantic checker | `test/fixtures/d06-intent-corpus.json`, `test/d06-intent-eval.test.js` |

`interpretFreeText` stays the D-07 stub. Weave does not call it.
