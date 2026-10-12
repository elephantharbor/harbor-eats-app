# Alpha Architecture Decision Card

**Status.** Contract for the one runtime PR. This file does not ship runtime code.

**Boundary.** Same line as D-05 and D-06: FlavorWeave decides diners, eligibility, quantities, safety, and why a meal fits. Luna, through `createGenerationService.run`, only fills a schema or phrases a packet. Sol is not a fallback. Astra stays denylisted. Plan, Find, Shop, Cook, and Rate still do not import `src/ai`.

**Starting point.** This base already contains D-06.1 and the wave-13 catalog integration. The runtime PR starts from that tree. Catalog recipes stay immutable.

---

## 1. D-04 navigation

### 1.1 Three layers

The screen is one of these, never a mix. `public/nav-context.js` already names the views. `public/app.js` `show()` paints `.view.is-active` and almost never touches history. That split is the bug Android Back hits.

| Layer | Views | Back |
|---|---|---|
| Top-level destination | `home` (Home), `choices` (Tonight), `find` with `mode: standalone` (Find), `meals` (History), `tasteProfile` (Profile) | Back moves among destinations that are actually on the stack. The first Back from the only remaining destination leaves the installed app. |
| Task flow | `planCount` → `planReview` → `planConfirm`; `shopList`; `cook`; `detail`; `rate`; `finished` | Back returns to the task parent in §1.3. |
| Transient | `<dialog>` sheets in `public/index.html`: `confirmDialog`, `discRefineSheet`, `discAddPlanSheet`, `swapSheet`, `mealOptionsSheet`, `participantsSheet`, `askTableSheet`, `planDatesSheet`, `changeCountSheet`, `shopLineSheet`, `newPlanSheet`, plus the Weave ambiguous-day chooser | Back closes the topmost open dialog and leaves the view underneath. |

Settings stays the header button (`settings`). Onboarding (`create`, `members`, `constraints`, `taste`, `invite`, `join`) keeps `guardView`. `demo` and `loop` stay under Home.

Chrome stays the D-07 rule in `nav-context.js` `chrome()`: standalone Find is `full`; replace and choose-for-plan Find are `focus`; cook is `none`. D-04 does not flatten those modes.

### 1.2 Back precedence

One function, used by the in-app Back control and by `popstate`. In order:

1. Close the topmost open dialog or sheet.
2. If the current view is `detail` or `cook`, return to the task that opened it (§1.3) and restore that task’s snapshot.
3. If the current view is a task step, return to its logical parent.
4. If the current view is a top-level destination and the in-app stack has an earlier destination, show that destination.
5. If nothing in the app remains, let the platform leave or minimize.

`history.back()` is not the implementation of steps 1–4. `public/discovery-ui.js` calls it today (`handleClick` on `[data-disc-back]`, around the `history.length > 1` branch). That call goes away. The browser history entry is only the mirror of the in-app frame.

### 1.3 Task parents and restoration

`Nav.backTarget` is wrong for Shop today: `shopList` returns `choices` (`public/nav-context.js`). A recipe opened from the list must return to the list. Cook has no history frame, so device Back leaves Kitchen mode for the browser.

| Flow | Forward | Back | What is restored |
|---|---|---|---|
| Find | Find → recipe (`/meal/:slug?from=find`) | recipe → Find | Discovery query string (criteria, soft flags, `cue`, NLP `text_residue`), mode, scroll, focused slug. `Discovery.captureState()` already holds this. Put that object on the history frame. Keep the D-06 session key for Weave planning; do not copy the utterance into the URL. |
| Replace | `planReview` or Tonight → `swapSheet` → Find `replace_plan_meal` → recipe | recipe → that Find; Find → the plan or Tonight that opened it | `dinner_plan_id`, `meal_id`, mode, Find snapshot. The plan itself stays on the server. |
| Choose-for-plan | empty slot → Find `choose_for_plan` → recipe | recipe → that Find; Find → `planReview` | `dinner_plan_id`, `position`, `participant_ids`, Find snapshot. |
| Weave plan | Weave on `planCount` / `planReview` → recipe | recipe → `planReview` | `sessionStorage` `fw-weave:planning:<dinner_plan_id or draft>` (D-06 §6): canonical state, chips, acknowledgement. The utterance stays in memory only. |
| Shop | `shopList` → recipe for a line’s meal | recipe → `shopList` | Scroll and which section was open. Checked lines stay on `dinner_shop_line`. Opening a recipe must not call `select_meal`. |
| Cook | `cook` → `detail` for the same meal | `detail` → `cook` | `cookStep` and `dinnerCookMealId`. Back from cook itself returns to the recipe detail that started it, then to Tonight or the plan. |

`show()` from cook currently keeps the detail context only when `from === "cook"` (`contextFor` in `nav-context.js`). The new frame stores `origin: "cook"` explicitly so a later `show("detail")` cannot fall through to Home.

### 1.4 History strategy

`show()` swaps views and does not push state, except Find and the Find recipe URL. `public/manifest.webmanifest` is `display: standalone` with `start_url: "/"`. On Android the first system Back therefore minimizes the PWA, because the stack has one entry.

Each forward navigation pushes one history entry:

```json
{ "fw": 1, "view": "detail", "origin": "shopList", "meal_id": "dpm_…", "restore": {} }
```

`popstate` reads `event.state.fw` and calls the same Back function as the button. It does not call `show()` in a way that pushes again.

- Dialog open pushes `{ "fw": 1, "transient": "participantsSheet" }`. Dialog close, including the in-app close, pops that entry with `history.back()` only when the top frame is that transient. A system Back on a dialog hits `popstate` and closes it.
- Root destinations push a real entry when the user switches tabs. They do not push a dummy parent under a deep link.
- Replace the current frame (`replaceState`) when the same task updates its URL (Find query edits, Weave acknowledgement). Do not grow a frame per keystroke.
- The service worker (`public/sw.js`) stays network-first and does not own Back.

SPA fallbacks already include `/find` and `/meal/` (`src/index.js` `spaPaths`). No new server route is required for history.

### 1.5 Deep-link parents

A cold open has no app frame. The in-app Back control uses this parent and `replaceState`s to it. It does not insert a fake history entry.

| Opened URL | Parent |
|---|---|
| `/meal/:slug?from=find` | Find, restored from the query string |
| `/meal/:slug` and that slug is a recipe on the current dinner plan | Tonight (`choices`) if that meal is the selected or cooking meal, otherwise `planReview` |
| `/meal/:slug` with no plan row | Find standalone, empty criteria |
| `/find?mode=replace_plan_meal&…` | `planReview`, or Tonight when the plan’s `entry_point` is a single dinner |
| `/find?mode=choose_for_plan&…` | `planReview` |
| `/find` | none (Find is a destination) |
| `/rate/:id` | Tonight |

`/invite`, `/share`, and `/recover` keep the auth flow in `docs/DEEP-LINKS.md`.

---

## 2. Servings and shopping

### 2.1 Root cause

Reproduced with `createDinnerPlan` and `plannerCatalog()` on miso-ginger-salmon (`base_servings` 4, salmon quantity 4 count).

| Participants | `servingRatio` | Salmon on the list | White miso | Fresh ginger | Steamed rice |
|---|---|---|---|---|---|
| 1 | 0.25 | 1 count | 0.5 tbsp | 0.25 tbsp | 1 serving |
| 2 | 0.5 | 2 count | 1 tbsp | 0.5 tbsp | 1 serving |

The scaler is `servingRatio(baseServings, dinerCount)` in `src/lib/ingredient-identity.js`. `contributionsFromMeals` sets `dinerCount` to `meal.participant_ids.length` and passes `meal.base_servings`. A 4-serving pin with one participant is a one-person list. Two participants produce a two-person list. The math is not stuck at one person. The count fed into it is 1.

That count is active members only:

- `householdMemberIds` (`src/lib/dinner-plan-store.js`) selects `member.status = 'active'`.
- The client sends `activeMemberIds()` (`public/app.js`).
- Adding a person on the members step stores `status: "invited"` (`btnAddMember`). Invited members are excluded until “They’re at the table”.
- `household.servings_default` defaults to 2 (`migrations/0001_init.sql`) and is written in `createHousehold`. Nothing in the shopping path reads it.

A kitchen that looks like two people, with the second person still invited, plans every dinner for one active member. The pin is the unscaled catalog quantity (`applyPin` copies `pkg.ingredients` and `pkg.base_servings`). One quarter of a 4-serving recipe is what the list shows.

A second, narrower bug stays even when the count is 2. `perServing` skips scaling when `unit === "serving"` or the note matches `/for serving/i`. Steamed rice on the in-memory miso pin is `1 serving` / `for serving`, so the line stays 1 for one diner and for two. Measured lines with a real unit (miso, ginger, salmon) do scale. The whole-list symptom is the participant count. The rice line is the skip.

Recipe detail does not use that count. `fetchRecipeForMeal` calls `servingCountForMeal()`, which is `activeMemberCount()`, and `activeMemberCount` returns 1 when `state.members` is empty. Cook renders `state.activeRecipe.steps` from that fetch. Shopping renders `dinner_shop_line` from the pin. They are two scales. The string scaler also floors countables with `Math.max(1, Math.round(n))` (`formatAmount` in `src/lib/recipe-scaling.js`): an onion quantity `"1"` at 2 servings becomes `"1"`, while the numeric shop path returns `0.5`.

### 2.2 One diner count

For each planned dinner:

```text
diner_count = eligible_participant_ids.length + guest_count
```

`diner_count` is derived. It is not a second stored servings field.

**Default participants.** When a meal is created, participants are every `active` member. Invited members stay out. `assessMealEligibility` still intersects that full set: a meal nobody in the set can share is not planned. An ineligible member is not silently detached so the meal can continue at a smaller count. Cooking it for the others is the per-dinner override: uncheck that person, then eligibility runs on the remaining set.

**Onboarding.** “Add someone who eats with you” creates an **active** member so a two-person kitchen defaults to 2. “Invite them to their own phone” stays `invited` and does not count. Existing invited rows are not migrated to active. Plans already saved keep their participant rows until someone changes who’s eating.

**Override.** `set_participants` stays the writer. It re-runs eligibility and `syncShopping`. Removing the last participant is `participant_required`.

**Guests.** `guest_count` is an integer on the meal, default 0, range 0–6. Guests are unnamed covers. They have no member id, no limits, no taste row, and no rating. `diner_count` must be 1–8, the clamp `servingRatio` already uses. A total outside that range is `diner_count_invalid`. No fake household member.

**Visibility.** One line, “For 2 people”, on the plan dinner card, the recipe detail servings note, the shop eyebrow, and the cook header. Guest wording is “For 3 people · 2 at home, 1 guest”. Copy placement is the Opus pass. The number is this count everywhere.

**Recipe-detail control.** On a meal that belongs to the current plan, the control writes the plan (`set_participants` and `set_guest_count`). On Find or History, with no plan meal, the control only refetches `?servings=` for that page. Cook of a planned meal uses the plan count. There is no third servings state.

### 2.3 One scaler

`scaleForDiners` is the only quantity function for recipe detail, cook, and shopping. `scaleRecipeVersion` becomes a wrapper that calls it and formats. The LLM never emits a quantity.

Ratio is `diner_count / base_servings`, with `base_servings` from the pin (fallback 4 only when the pin is missing). `?servings=` on `GET /api/recipes/:slug` means this same `diner_count` when the caller has a meal; otherwise it is an explicit view count.

| Kind | Rule |
|---|---|
| Volume and weight | Multiply, keep 3 decimal places in the stored line (`roundQuantity`). Display fractions with the existing shop fraction table. Do not snap cups to halves before summing. |
| Countables | Unit `count`, or the existing whole-item names (onion, clove, fillet, egg, tortilla, lime, avocado). Nearest integer. A positive result under 0.5 stays a fraction so one onion for one diner of a 4-serving recipe shows ¼, not 1. Drop the `Math.max(1, …)` floor in `formatAmount` and in the parenthetical branch. |
| Parenthetical piece size | `"4 (5–6 oz each)"` scales the leading count and keeps the parenthesis. Piece weight is not a total. |
| Ranges | A catalog `quantity_max` scales both ends. Display `a–b unit`. No range column exists today; do not invent one in this PR unless a published ingredient already carries two numbers. The parenthetical form above covers the live salmon pin. |
| Per diner | Unit `serving`, or raw quantity exactly `for serving`: result is `diner_count` servings (one per diner). A note that merely contains “for serving” on a measured amount (salsa, lemon wedges) uses the normal ratio. The `/for serving/i` skip is removed. |
| Garnish / optional | `optional` rows scale and stay on the list, marked optional. They are not dropped and not frozen. |
| Subcomponents | `components_json` groups ingredient ids. Scale each ingredient row once. Do not scale a component header and do not add its members again. |

Aggregation stays `aggregateContributions`: same `ingredient_id` and compatible unit add; incompatible units stay separate; `yellow-onion` → `onion` stays. Skipped, abandoned, leftovers, and eating out still contribute nothing.

### 2.4 Checked lines

`syncShopping` already keeps `list_state` and writes `added` / `no_longer_needed` deltas after shopping has started. Keep that. A diner-count change, swap, add, or remove updates quantity and does not clear `purchased` or `already_have`. Identity stays `ingredient_id + unit`. A substitution that changes the id retires the old line (check preserved, `still_needed` false) and adds a new open line. Do not transfer a check onto a different ingredient.

### 2.5 Migration

`migrations/0016_alpha_diner_adaptation.sql`

- `ALTER TABLE dinner_plan_meal ADD COLUMN guest_count INTEGER NOT NULL DEFAULT 0`. Range 0–6 is enforced in `set_guest_count`. Existing meals backfill to 0. Do not rewrite `dinner_plan_participant`.
- Table `dinner_meal_adaptation` (§3.4).

No catalog migration. `servings_default` stays unused.

---

## 3. `recipe_adaptation`

### 3.1 Gateway

Existing task id `recipe_adaptation`. Prompt becomes `recipe_adaptation@2`. One `run()` per submit. No provider bypass.

| | Value |
|---|---|
| `executable` | `true` |
| `cost_class` | `cheap` |
| `allowed_models` | `["fast-small"]` → `gpt-6-luna` |
| `reasoning_effort` | `none` |
| Output cap | **520** (method below) |
| Timeout | 8000 ms |
| Cache | on, TTL 86400, existing `ai_cache` key |

The current registry entry is `creative`, `allowed_models: ["balanced", "strong"]`, `reasoning_effort: "low"`, cache off, and a free-text `suggestion` (`src/ai/tasks.js`). That entry is replaced. `strong` would route to Sol; this task must not. `low` spends a reasoning pass these schema fills do not need, and `minimal` is rejected by Luna.

Cap measurement, same method as D-06: one JSON object that fills every max string and every maxItems array, `ceil(utf8_bytes / 4)`, plus 40 tokens because `none` still shares the output cap, round up to the next 20, stay ≤ 600. Recompute in the same change if a field is added. If Preview returns `output_limit`, raise by 40 only.

`AI_TASKS_ENABLED` gains `recipe_adaptation` beside the tasks already enabled. No other task is turned on by this card.

### 3.2 Schema

Strict Structured Outputs, as D-06 §1: `additionalProperties: false`, every property required, nullable unions, no `anyOf` / `oneOf`. Inline nested objects. The model schema has **no quantity, no servings, no allergen, no eligible flag**.

Input (local validation, not the response schema). Server-built. Redacted before `renderPrompt`. No diner names, member ids, allergens, or the raw recipe prose quantities.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["text", "recipe"],
  "properties": {
    "text": { "type": "string", "maxLength": 300 },
    "recipe": {
      "type": "object",
      "additionalProperties": false,
      "required": ["recipe_version_id", "title", "equipment", "ingredients", "steps"],
      "properties": {
        "recipe_version_id": { "type": "string", "maxLength": 80 },
        "title": { "type": "string", "maxLength": 120 },
        "equipment": { "type": "array", "maxItems": 12, "items": { "type": "string", "maxLength": 80 } },
        "ingredients": {
          "type": "array",
          "maxItems": 40,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["ingredient_id", "name"],
            "properties": {
              "ingredient_id": { "type": "string", "maxLength": 40 },
              "name": { "type": "string", "maxLength": 60 }
            }
          }
        },
        "steps": {
          "type": "array",
          "maxItems": 20,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["step_number", "title"],
            "properties": {
              "step_number": { "type": "integer", "minimum": 1, "maximum": 30 },
              "title": { "type": "string", "maxLength": 80 }
            }
          }
        }
      }
    }
  }
}
```

Output:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "acknowledgement", "kind", "support", "ingredient_ops", "step_notes",
    "equipment_supported", "flavor_impact", "warning"
  ],
  "properties": {
    "acknowledgement": { "type": "string", "maxLength": 120 },
    "kind": {
      "type": "string",
      "enum": ["substitution", "omit", "flavor", "simplify", "filling", "equipment", "prep", "unsupported"]
    },
    "support": { "type": "string", "enum": ["advice", "unsupported"] },
    "ingredient_ops": {
      "type": "array",
      "maxItems": 6,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["op", "from_id", "to_name", "policy"],
        "properties": {
          "op": { "type": "string", "enum": ["replace", "remove", "add"] },
          "from_id": { "type": ["string", "null"], "maxLength": 40 },
          "to_name": { "type": ["string", "null"], "maxLength": 40 },
          "policy": { "type": "string", "enum": ["keep_scaled", "omit", "to_taste"] }
        }
      }
    },
    "step_notes": {
      "type": "array",
      "maxItems": 4,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["step_number", "note"],
        "properties": {
          "step_number": { "type": "integer", "minimum": 1, "maximum": 30 },
          "note": { "type": "string", "maxLength": 160 }
        }
      }
    },
    "equipment_supported": { "type": ["boolean", "null"] },
    "flavor_impact": {
      "type": ["string", "null"],
      "enum": ["milder", "richer", "fresher", "similar", "unknown", null]
    },
    "warning": { "type": ["string", "null"], "maxLength": 120 }
  }
}
```

`post_validate` rejects an empty acknowledgement, `AUTHORITY_CLAIMS`, and any digit in `acknowledgement`, `warning`, or `step_notes` (quantities are not the model’s). A hit takes the one repair retry, then the route fallback. Dropped unknown `from_id` values are listed as `dropped` and do not fail the schema.

`policy` is the only amount instruction. `keep_scaled` copies the scaled quantity and unit of `from_id`. `omit` removes the line. `to_taste` keeps the line off the summed quantity and shows “to taste”. The server resolves `to_name` to a catalog ingredient id when the taste vocabulary or the shopping alias table has one. An unresolved name stays a display label and does not become a new canonical recipe ingredient.

### 3.3 Advice, apply, safety, equipment

`POST /api/recipes/adapt` returns advice. It does not write the plan, the catalog, or taste.

Apply is `POST /api/dinner-plans/:id/mutations` with `op: "apply_adaptation"`. Undo is `op: "clear_adaptation"`. Both require the meal to be `planned` or `selected`. Cooking or later returns `outcome_locked`.

The override lives on the meal, keyed by `recipe_version_id`. A swap or `adopt_version` clears it. `resolvedRecipe` returns the pin plus the override for cook and for shopping. `catalog_version` is never updated.

Safety runs after the model, on the current meal’s participants (not guests):

- Resolve each `to_name` to allergen and diet signals the catalog already uses (`assessMealEligibility` / `HARD_LIMIT_IDS`).
- If any participant’s hard limit fails, the op is removed and the response is `rejected_safety`. The acknowledgement is the D-06 conflict template, not the model sentence. The model is not told the limit.
- Peanuts for a `no_nuts` table are rejected even if the model proposed them.

Equipment. If the pinned equipment list matches `/pressure cooker/i` and the request drops that tool, `equipment_supported` must be false and `support` must be `unsupported`. `post_validate` forces that pair when the request text asks to avoid a pressure cooker and the pin requires one. Step notes that describe a different vessel are dropped. The reconciled sentence is: “That pressure cooker is doing most of the work in this version. I'd stick with the original method for this recipe.” Butter chicken (`catalog/pressure-cooker-butter-chicken`) is the fixture. The model does not invent a stovetop method.

Unsupported advice is shown and cannot be applied. Apply of a `rejected_safety` or `unsupported` payload is `adaptation_not_applicable`.

Shopping rebuilds through `syncShopping` from the overridden pin, then the diner scaler. Cilantro → parsley with `keep_scaled` buys the parsley quantity the cilantro line had. Checked-state rules are §2.4.

Taste. These routes do not write `diner_taste`, ratings, or `constraint_rule`. “Less spicy tonight” is not a taste event.

UX is the Weave grammar: composer “What would you change?”, working state, one acknowledgement, typing reveal of the validated sentence, then the changed ingredient and step state. Advice is the result. Apply is a separate button. Undo is visible while an override exists. Opus designs the layout. This card locks the states the screen reads.

### 3.4 Migration rows

`dinner_meal_adaptation`

| Column | |
|---|---|
| `meal_id` | primary key, references `dinner_plan_meal` |
| `dinner_plan_id`, `household_id` | |
| `recipe_version_id` | the pin this override matches |
| `override_json` | server-built ops after safety, not the raw model payload |
| `created_at`, `updated_at` | |

Clearing the row is undo. The catalog pin on the meal stays.

---

## 4. `explanation`

### 4.1 Packet

The ranker builds the packet. Luna never sees household history beyond it. Facts are a closed list, max 6, each `{ "id", "kind", "phrase" }`. `phrase` is the only wording the model may lean on, max 60 characters, produced by the server.

| `kind` | Source already in the product |
|---|---|
| `taste_agreement` | `scoreDinerTastes` / discovery `taste_hits` when more than one diner shares a Love or Like |
| `taste_like` | a Love or Like hit (`primary_reason` `taste_love` / `taste_like`) |
| `easy` | `keep_it_easy` on the run, or effort `easy` |
| `simple_ingredients` | `keep_ingredients_simple`, or complexity `simple` |
| `quick` | `total_minutes` ≤ 30 or the quick criterion |
| `novelty` | explicit different / exploration, “hasn’t been in the rotation” |
| `fatigue` | recent slug |
| `plan_fit` | a frequency or slot the meal satisfies |
| `find_intent` | an active discovery criterion or cue |

`basis` is `learned` (at least one taste fact), `onboarding` (explicit picks, no learned rank), `run` (only chips and criteria), or `cold` (none of those). `strength` is `strong` when a taste fact or two non-taste facts exist, otherwise `weak`.

Weak or cold: do not call Luna. The client shows a server template (“This gives you something different while still keeping dinner easy.”) or omits the sentence when even that template would invent a preference. Cold start must not say anyone tends to enjoy a flavor.

### 4.2 Verbalizer

Task id stays `explanation`. Prompt `explanation@2`. Luna only. `reasoning_effort: "none"`. Cap stays **300**. Timeout 5000 ms. `allowed_models: ["fast-small"]`. `cost_class: "standard"` may stay; `models[0]` is still Luna. The current input (`meal` string, `reasons` strings, `cache_bust`) is replaced.

Input adds `recipe_version_id`, `basis`, `strength`, `facts`, `allowed_phrases`, `allowed_numbers`, and `evidence_fingerprint` (sha256 of the canonical fact ids and phrases). Allergens and eligibility claims are not facts and are not sent.

Output:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["text", "used_fact_ids"],
  "properties": {
    "text": { "type": "string", "maxLength": 220 },
    "used_fact_ids": { "type": "array", "maxItems": 4, "items": { "type": "string", "maxLength": 40 } }
  }
}
```

`post_validate` fails the output when any of these hold:

- `used_fact_ids` is not a subset of the packet
- `text` matches `AUTHORITY_CLAIMS`
- `text` contains a digit that is not in `allowed_numbers`
- `text` contains an `allowed_phrases` neighbor that was not attached to a used fact (the server passes the phrase list for used ids only, plus a denylist of taste-vocabulary display names absent from the packet)
- `basis` is `cold` or `run` and the text matches `/\b(you both|you tend|you love|you enjoy|your favorite)\b/i`

Failure uses the one repair retry, then the route substitutes the deterministic template and sets `source: "fallback"`. The UI types the validated string only. No provider streaming.

Cache is the gateway key in `src/ai/gateway.js`: sha256 of task, prompt version, model, and normalized input. The fingerprint sits inside that input, so a changed packet misses. The row stores `output_json` only. Do not add a second cache. Do not put member names in the input.

### 4.3 When it runs

`POST /api/explain` runs when the user opens “Why this one?”. A card may show the existing deterministic reason line (`public/app.js` `buildDiscoveryWhyLines`) with no model call. Do not generate explanations for the catalog or for a result page on load. A cache hit on open is free and still counts as on-demand.

Typing reveal runs on that open, after validation, and honors reduced motion. The sentence is one or two sentences. It does not repeat the title.

---

## 5. Telemetry

`track()` → `persistEvent` posts a fixed column set and drops everything else (`public/app.js`). Extend that allowlist only with the properties below. No prompt, acknowledgement, utterance, adaptation sentence, or explanation text.

The dinner-plan cook path does not emit the legacy events. `startCooking` tracks `cook_started` only on the old meal-option branch, and `finish_cook` on a dinner plan does not track `cook_recorded`. Wire the names below on the dinner-plan path. Keep `cook_recorded` and `loop_completed` firing where the funnel already counts them, at the same moment, so the funnel does not go blank.

| Brief question | Event | When | Properties |
|---|---|---|---|
| Plan created | `plan_created` | `POST /api/dinner-plans` or `/api/plan/commit` succeeds | `dinner_plan_id`, `meal_count`, `source` (`weave` \| `planner` \| `manual`) |
| Plan edited | `plan_edited` | mutation in `add_meal`, `remove_meal`, `swap_meal`, `set_participants`, `set_guest_count`, `set_count` | `op` (that enum), `dinner_plan_id` |
| Dinner selected | `dinner_selected` | `select_meal` | `dinner_plan_id`, `meal_id`, `recipe_slug` |
| Shopping opened | `shopping_opened` | `shopList` shown | `dinner_plan_id`, `line_count` |
| Cook started | `cook_started` | `begin_cook` | `dinner_plan_id`, `meal_id` |
| Cook completed | `cook_completed` | `finish_cook` succeeds, and keep `cook_recorded` beside it | `dinner_plan_id`, `meal_id` |
| Ratings completed | `ratings_completed` | meal reaches `fully_rated`; keep `loop_completed` beside it | `dinner_plan_id`, `meal_id`, `diner_count` |
| Adaptation requested | `adaptation_requested` | adapt route returns | `kind`, `support` (`advice` \| `unsupported` \| `rejected_safety` \| `fallback`), `recipe_slug` |
| Adaptation applied | `adaptation_applied` | apply succeeds | `recipe_slug`, `op_count` |
| Adaptation undone | `adaptation_undone` | clear succeeds | `recipe_slug` |
| Explanation opened | `explanation_opened` | Why this one? | `recipe_slug`, `source` (`provider` \| `cache` \| `template` \| `fallback`), `basis` |
| NLP used | existing `weave_route_chosen` | after the bypass decision | `task`, `route` (`luna` \| `bypass`) |

`route: luna` is the NLP signal. Bypass is deterministic and is not NLP. D-06 weave events stay. `ai_usage` still stores no prompts and no outputs.

---

## 6. One runtime PR

### 6.1 Dependency graph

```text
0016 migration
    ├─ diner count + shared scaler ─────────────┐
    └─ adaptation table ─ schema, route, safety ┼─ shopping sync (checked lines)
                                                │
nav frames (no migration) ──────────────────────┤
                                                │
explanation packet + post_validate ─────────────┤
                                                │
telemetry allowlist (last; names the events above)
```

Navigation and explanation do not depend on servings. Adaptation’s safety check and shopping effect depend on the diner count and on `syncShopping`. Telemetry is last so the event names match the final ops.

### 6.2 Work inside that PR

One integration branch, one Preview, one E2E, one production promotion. Order inside the PR:

1. Migration `0016` and the pure scaler, with the miso reproduction as a test.
2. `guest_count`, default active participants, onboarding active-vs-invite, `set_guest_count`, and the single “For N people” data on plan, recipe, shop, and cook. Recipe `?servings=` and cook use `diner_count`.
3. Navigation frames: `show` / `popstate` / dialogs, Find, replace, choose-for-plan, Weave, shop, cook, deep-link parents. Delete the Find `history.back()` path.
4. `recipe_adaptation@2`, advice route, apply/undo, safety, pressure-cooker force-unsupported, shopping override.
5. `explanation@2`, packet builder, on-demand route, template for weak and cold.
6. Telemetry rows in §5.
7. Targeted tests. Fake provider in CI.

Opus is two reviews around this PR, not commits inside it: one on the Back model, diner copy, adaptation UX, and explanation layout before UI polish; one on the rendered Preview. Grok owns the scaler, schemas, and grounding. Composer owns the mechanical wiring.

Alpha friction found in the hosted walkthrough is fixed in this same PR only when it is release-blocking or a small core-path polish. Anything else is a deferred list in the handoff, not a second PR.

### 6.3 Targeted tests

Servings: default active count 2; invited member excluded; ineligible member excluded; per-dinner override; `guest_count` 1 on top of 2; scales 1/2/3/4; fraction cup; countable under 0.5 stays a fraction; `for serving` rice becomes N servings; measured “for serving” note still scales; two meals aggregate onions; cup and tbsp stay split; swap; diner change; purchased line stays purchased; recipe detail and shop match for the same meal.

Navigation: dialog closes first; the six Back rows in §1.3; deep-link parents; a root Back is the only one that leaves; Find query and scroll restored. Assert the destination and the restored fields, not a call sequence.

Adaptation (fake provider): substitution, simplify, flavor, equipment, unsafe substitution, unsupported pressure cooker, apply, undo, shop id change, catalog row unchanged, no `diner_taste` write.

Explanation (fake provider): used ids must be in the packet; a mushroom sentence with no mushroom fact fails; cold template with no Luna call; run-intent “easy” allowed; disagreement fact present; weak evidence skips the provider; fingerprint change misses the cache; a result page load does not call `run()`.

### 6.4 Live Luna eval

Preview only, after the fake-provider suite is green. Hard cap **15** calls. Plan **10**. No Sol. No live calls while debugging.

| # | Task | Case | Pass |
|---|---|---|---|
| 1 | adaptation | less spicy | `kind: flavor`, no digits in the sentence |
| 2 | adaptation | cilantro → parsley | replace op, `keep_scaled` |
| 3 | adaptation | simplify | `kind: simplify` or a short step note |
| 4 | adaptation | air fryer, recipe that already has an air fryer | `equipment_supported: true` |
| 5 | adaptation | Butter chicken, no pressure cooker | `support: unsupported`, no replacement method |
| 6 | adaptation | cashews → peanuts on a `no_nuts` diner | `rejected_safety` after the model returns |
| 7 | explanation | strong taste packet | `used_fact_ids` subset, no extra food |
| 8 | explanation | weak packet | template, zero provider calls if the client obeys `strength` |
| 9 | explanation | cold household | no “you tend” / “you love” |
| 10 | explanation | active Keep it easy | sentence may say easy, may not add a taste |

Calls 11–15 are contingency for one repair retry or one schema gap. A repair counts toward the cap. Record model, prompt version, latency, and whether post-validation replaced the sentence. Do not log the prompt.
