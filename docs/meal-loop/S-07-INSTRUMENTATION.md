# S-07 Goal B: Instrumentation plan (minimal, privacy-safe, no migration)

**Status.** Implemented in this PR.
**Basis.** `origin/main` e57f464.
**Recommendation.** Add one closed-enum field, `completion_source` ∈ {`mark_cooked`, `finish_cook`}, to the existing cook events `cook_completed`, `cook_recorded` and `cook_undone`. The server keeps the field only when its value is in that set.
**Migration: NO.** The field is stored in the existing `event.props_json` column (`migrations/0009_evidence_origin_unproven.sql:486`). No new column, table or index. No escalation needed.
**Answers:** question #7 ("We made this" vs guided Finish), which is unanswerable today (OUTCOME-MEASUREMENT.md §2).

## 1. Why this, and only this
- Both ops share `recordCookedMeal` (`src/lib/plan-mutations.js:739, 746, 762`). Plan state cannot tell them apart. Today's cook events carry only `dinner_plan_id`/`meal_id` (`public/app.js:2933–2939`). The client already knows the op, because `settleDinnerCompletion(plan, meal, op, …)` runs at `app.js:2896`.
- **No `is_synthetic` flag is needed.** `data_origin` on the household and on each row already separates synthetic from real (`src/lib/evidence-origin.js:82, 129, 134`).
- **No new aggregate counter in the health or admin surface (for now).**
  - `/api/health?metrics=alpha` is **unauthenticated** (`src/index.js:206`, route `:2364`). `/api/ops/alpha-metrics` accepts **any member session** (`src/index.js:2496–2499`). Both return cross-household totals.
  - With very few real households, adding outcome counts there would publish near-individual numbers to anyone (public health) or to any member.
  - Oversight can authorise the read-only queries in PROPOSED-AGGREGATE-QUERIES.md instead.
  - Separately, `alphaOpsQueries` (`evidence-origin.js:171`) counts the legacy `plan`/`cook`/`rating` tables, not Cycle 3. That is flagged, not changed here.
- **No server-side emission.** Moving cook events to the server (the dinner-plan route) would make them reliable, but it is a larger change to the S-06 flow. Keep the client emission and record the gap: events are a lower bound (OUTCOME-MEASUREMENT.md §7).

## 2. Exact changes

### 2.1 New `src/lib/cook-telemetry.js` (about 25 lines)
```js
/** Cook completion telemetry. Closed values only; no identities or free text. */
export const COOK_EVENT_NAMES = Object.freeze(["cook_completed", "cook_recorded", "cook_undone"]);
/** The two writes that record a cooked meal (plan-mutations.js finishCook / markCooked). */
export const COMPLETION_SOURCES = Object.freeze(["mark_cooked", "finish_cook"]);

/**
 * Keep completion_source only when it is a known op. Anything else is dropped,
 * not rejected, so a bad value never loses the cook event itself.
 * Non-cook events are returned unchanged.
 */
export function cleanCookEventProps(eventName, props) {
  if (!COOK_EVENT_NAMES.includes(eventName)) return props;
  const out = { ...(props || {}) };
  if (!COMPLETION_SOURCES.includes(out.completion_source)) delete out.completion_source;
  return out;
}
```

### 2.2 `src/index.js`, `createEvent` (lines 860–941)
- Import `cleanCookEventProps` from `./lib/cook-telemetry.js` with the other lib imports.
- Line 884: change `const props = gated.handled ? { ...gated.props } : { ...body };` to `let props = …`.
- After the delete block that ends at line 898 (`delete props.data_origin;`), add:
  ```js
  props = cleanCookEventProps(event_name, props);
  ```
- Nothing else changes. `shop_export` gating (`storedEventProps`, line 882) is untouched, because `cleanCookEventProps` returns non-cook props unchanged.

### 2.3 `public/app.js`
| Where | Change |
|---|---|
| `persistEvent` (496–520) | Add `completion_source: p.completion_source,` next to `source: p.source,` (line 511). Without it the client whitelist drops the field. |
| `settleDinnerCompletion`, `cook_completed` (2933) | Add `completion_source: op` |
| `settleDinnerCompletion`, `cook_recorded` (2934–2939) | Add `completion_source: op` |
| Undo record (2946–2955) | Add `completionSource: op,` to the object |
| `noteCookUndone` (3023–3030) | Add `completion_source: record.completionSource` |
| Legacy `finishCook` path, `cook_recorded` (3105) | Add `completion_source: "finish_cook"` (legacy guided Finish) |

`op` is always `"finish_cook"` or `"mark_cooked"` there. The entry points are `completeDinnerMeal` at 3068 (History, We made this), 3090 (guided Finish) and 7583 (Home/Tonight, We made this).

### 2.4 Docs
- `docs/meal-loop/S-06-COMPLETION.md`, § Idempotency and concurrency: after the bullet at line 30, add:
  > Cook events carry `completion_source` (`mark_cooked` or `finish_cook`). The server keeps only those two values. Events recorded before S-07 have none and count as `unknown`; they are never back-filled.
- Include the line 47 correction from TECHNICAL-RISK-REGISTER.md, Risk 3.

## 3. Tests to add

### 3.1 New `test/s07-cook-telemetry.test.js` (Vitest; same harness as `test/s05c.test.js:436–476`: `migrate`, `seedHousehold`, `asD1`, `call`, `createMemberSession`, `import worker from "../src/index.js"`)
1. **`cleanCookEventProps` keeps known sources and drops others**
   - keeps `mark_cooked` and `finish_cook` on all three cook events
   - drops `"guided"`, `""`, `null`, `{}` and free text
   - leaves `shop_export`/`plan_finalized` props unchanged, including any `completion_source`
2. **`POST /api/events` stores `completion_source` for cook events**
   - `cook_recorded` with `completion_source: "mark_cooked"` returns 201, and `props_json` includes it
   - `cook_undone` with `"finish_cook"` is stored too
3. **An unknown `completion_source` is dropped, not rejected**
   - `cook_recorded` with `completion_source: "nut allergy"` returns 201
   - the stored `props_json` has no `completion_source` and does not contain the text
4. **`shop_export` closed-field gating unchanged**: re-run the s05c expectation that `props_json` equals `{type, ok, surface}` exactly, with `completion_source` sent and not stored.
5. **Netting unaffected**: in an in-memory DB, `cook_recorded`(mark_cooked) → `cook_undone`(mark_cooked) → `cook_recorded`(finish_cook) for one meal; `funnelCookCompletionSql()` (`evidence-origin.js:149`) returns 1. This mirrors `test/s06-meal-completion.test.js:626`.
6. **Static guard on `public/app.js`**: read the source text. Every `track("cook_completed"`, `track("cook_recorded"` and `track("cook_undone"` call's props object must contain `completion_source`, and `persistEvent` must forward `completion_source`.

### 3.2 `e2e/specs/s06-meal-completion.spec.js`
- Test at line 123 ("We made this records a cooking dinner, undo restores it…"): it already collects `/api/events` posts (line 161) and filters `cook_completed` (line 199). Add these assertions:
  - `cook_completed` and `cook_recorded` have `completion_source === "mark_cooked"`
  - after Undo, `cook_undone` has `completion_source === "mark_cooked"`
- Test at line 646 ("Undo after guided Finish returns to the same step on this tab"): add the same request listener and assert `"finish_cook"` on `cook_recorded` and on `cook_undone`.
- Test at line 203 (History logs a superseded cooking meal): assert `"mark_cooked"`.

### 3.3 Existing suites that must stay green
`test/s05c.test.js` (shop_export gating 436–476), `test/s06-meal-completion.test.js` (all), `npm run lint` (the new file falls under `eslint src`).

## 4. Privacy review
- Two fixed enum values. No identity, item, recipe, dietary or rating data.
- Stored in the existing row next to the ids that row already holds (`household_id`, `meal_option_id`), so no new linkage is created.
- The server drops any other value, so free text cannot ride in this key.
- No new endpoint and no new public surface.

## 5. Measurement after it ships
- PROPOSED-AGGREGATE-QUERIES.md Q8 splits net-cooked meals by `completion_source`. Meals cooked before the change report `unknown`.
- First meaningful read: after a window long enough to have at least several real completions. Until then, report counts only, with no rates.
