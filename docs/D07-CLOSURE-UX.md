# D-07 Find a dinner: closure UX decisions

Status: **Decided.** Product decisions that close D-07 V1. Reviewed against `main` at `410f045`. A Composer agent implements this; this document changes no runtime code.

Binding order is unchanged: the contracts (`D07-ARCHITECTURE.md`, `D07-QUERY-CONTRACT.md`) win, then this document, then `D07-UX.md`. Where this document changes `D07-UX.md`, that file is amended in the same PR so the two agree.

Constraints carried forward: no LLM or NLP, no favorites, no new meals (catalog stays 50), no D-04, D-05, or D-06 work. Consumer copy follows `D07-UX.md` §0.4 and §0.6 (no “eligibility”, “mode”, “effort level”, “moderate”, and so on).

---

## Summary for the implementer

| # | Topic | Decision |
|---|-------|----------|
| 1 | Replace entry | **Confirmed as built.** Keep the compact Swap sheet. Its quiet “See all options” and the meal ⋯ “Find something else” both open replace mode. Change the URL so it carries only `mode`, `dinner_plan_id`, and `meal_id`; the server works out who’s eating, the current dinner, and the plan’s Keep it easy / Keep ingredients simple settings. |
| 2 | Time chip | **Drop the caret.** The chip is a plain on/off toggle for “Under 30 min”. 45 and 60 minutes stay in Refine → Time. Remove `aria-haspopup`. |
| 3 | Diet group | **Remove it.** Replace the Diet and Protein groups with one group, “On the plate”: Anything · Fish & seafood · Plant-forward (pick one). No Vegetarian or Dairy-free anywhere in Find. |
| 4a | Why this one | Up to three short lines built only from facts in the result (taste hit, Something different, under 30 minutes, Easy, Simple ingredients). If none apply, hide the section. Delete the filler “Clears your household’s hard limits.” |
| 4b | Servings | Recipe detail scales to the number of people eating, taken from the Discovery response. Never fall back to “1 serving”. Cards show no servings. |
| 5 | Replace chrome | Eyebrow “Swap Dinner {p}”, title “Find something else”, lede “Now: {current title}”, table note “For Dinner {p}: {names}”. Cards say “Use this”; the recipe says “Use this for Dinner {p}”. Back pops history. After a pick, return to the plan with “Swapped in” on the card and focus on it. |

---

## 1. Replace-mode entry

### What `main` does today

| Piece | Location | State |
|-------|----------|-------|
| Swap sheet: three alternatives, each “Use this”, plus “Keep this one” | `openSwapSheet` in `public/app.js`, `#swapSheet` in `public/index.html` | Matches Cycle 3 / D-03 |
| Swap sheet: quiet “See all options” first in the footer, hidden when there are no alternatives, “See all options for tonight” on a one-dinner plan | `#btnSwapSeeAll`, `data-action="swap-see-all"` | Matches `D07-UX.md` §10 |
| Meal ⋯ sheet: first row “Find something else” on recipe meals in `planned` or `selected` | `openMealOptionsSheet`, `data-action="mo-find-else"` | Matches §3.1 |
| Both call `openDiscoveryReplace(mealId, state.view, entry)` → `Discovery.open({ mode: "replace_plan_meal", … })` | `public/app.js` | One surface, no second catalog browser |
| Chrome: `focus` in plan modes; `navSection` returns null, so the Find tab isn’t lit | `public/nav-context.js` | Matches §12.2 |
| URL and API request also carry `position` and one `participant_id` per diner | `findPathFromState`, `buildApiUrl` in `public/discovery-ui.js` | **Diverges.** See below. |

The hypothesis holds: the entry points are built and placed correctly on Tonight, on plan review, and on the Home plan cards, because all three render the same `renderPlanMealCard` with Swap and ⋯. No new entry point is needed.

### Decision

Keep both entry points exactly as built:

- **Compact Swap stays** the “give me another suggestion” path. Three alternatives, one tap, no navigation.
- **Swap sheet footer, first, quiet:** “See all options” (one-dinner plan: “See all options for tonight”). Accessible name “See all options for Dinner {p}” / “See all options for tonight”. Hidden when the sheet has zero alternatives. Tap closes the sheet with no mutation and no toast, then opens replace mode.
- **Meal ⋯ sheet, first row:** “Find something else”. Only on recipe meals in `planned` or `selected`. Not on leftovers, eating-out, cooking, cooked, rated, or skipped rows.

**Why both, and why not more.** “See all options” catches the person at the moment the three alternatives didn’t land, which is the highest-intent moment. “Find something else” covers the person who already knows they want to browse and shouldn’t have to sit through three suggestions first. Anything more (a third button on the card, a link in the hero) would compete with Swap and turn plan cards into a menu of verbs.

### URL and what it carries

Replace URL, exactly:

```
/find?mode=replace_plan_meal&dinner_plan_id={dinner_plan_id}&meal_id={meal_id}
```

Plus the person’s own refinements (`text`, `effort`, `quick`, `keep_it_easy`, …) as `replaceState` updates, per `D07-UX.md` §9.

**Do not put `participant_id` or `position` in the replace URL or the API request.** For `replace_plan_meal` the server reads that meal from the plan (`src/discovery/context.js`) and derives:

| Needed for the search | Where it comes from |
|-----------------------|---------------------|
| Who’s eating | That meal’s `participant_ids` (server). Client values are ignored in this mode. |
| Current recipe and version | That meal’s `recipe_slug` is hidden from results (server). The client shows “Now: {title}” from the plan it already holds. |
| Keep it easy / Keep ingredients simple | The plan’s `intent` (`soft_source: "plan_intent"`) while the request omits `soft`. |
| Position | `context.position` in the response. |

Carrying these by reference (plan id + meal id) instead of by value means a refreshed or shared URL can’t show stale diners or a stale “Now:” dinner after someone edits the plan. Sending `participant_id` today is harmless but misleading: it suggests the URL controls who’s eating, and it doesn’t.

Implementation notes:

- `openDiscoveryReplace` passes only `dinner_plan_id` and `meal_id` (plus `origin` and `entry`, which aren’t in the URL).
- `findPathFromState` and `buildApiUrl` emit `participant_id` only in `standalone`, and `position` only in `choose_for_plan`.
- Read `position` and `participant_ids` for display from `response.context`.
- `Discovery.open` pushes the full replace URL (currently it pushes `/find`, then repairs it).
- Leave the Lean toward settings alone until the person touches one. Then send both flags for this search only. Never call `set_planning_preferences` from Find.

---

## 2. Time chip

### What `main` does today

Off, the chip reads “Under 30 min ▾” with `aria-haspopup="menu"`. Tapping it sets `quick: true`. Tapping it again clears the time limit. There is no menu. With Under 45 or Under 60 chosen in Refine, the chip reads “Under 45 min” and a tap clears it.

### Decision: a plain toggle, no caret

| Query state | Chip label | Look | Tap |
|-------------|------------|------|-----|
| No time limit | “Under 30 min” | Unfilled | Sets `quick: true`, `max_minutes: null` |
| `quick: true` | “Under 30 min” + × | Filled `.is-on` | Clears (`quick: false`, `max_minutes: null`) |
| `max_minutes: 45` or `60` (from Refine) | “Under 45 min” / “Under 60 min” + × | Filled | Clears |

- Remove the “▾” glyph and `aria-haspopup`. Keep `aria-pressed`. When the chip is on, its accessible name is “Remove {label}”, like the other applied chips.
- 45 and 60 minutes stay in Refine → Time (“Any time · Under 30 min · Under 45 min · Under 60 min”). The 30-minute chip covers the most common choice in one tap. The longer limits are rarer and fit where people go to fine-tune.
- **Why not build the menu?** It would be the only menu button in the chip row, it needs its own focus and keyboard handling, and it would duplicate Refine’s Time group. A caret that opens nothing is a broken promise. A plain toggle is the honest V1.

Also update the group-chip glyphs: `D07-UX.md` §6.1 draws “Cuisine ▾ / Type ▾ / Main ▾” in the chip row. Those chips are not built (Opus note 2) and are **not required for D-07 closure**; Refine covers them. If a later slice adds them, they open a dialog, so their caret is honest.

---

## 3. Diet group in Refine

### What `main` does today

Refine has a “Diet” group (Plant-forward, Vegetarian, Dairy-free → `criteria.diet`) and a separate “Protein” group (Fish & seafood → `criteria.protein_groups`), as well as Texture.

### Decision: remove “Diet”; merge what’s worth keeping into “On the plate”

Remove the Diet group and the Protein group. Add one group in their place, after Flavor and before Texture:

| | |
|---|---|
| Group heading | “On the plate” |
| Helper | “Everyone’s limits are already covered.” |
| Options (radio, one at a time) | “Anything” (default) · “Fish & seafood” · “Plant-forward” |
| Sends | Anything: nothing. Fish & seafood: `criteria.protein_groups: ["seafood"]`. Plant-forward: `criteria.diet: ["plant"]`. |
| Applied chip / Remove chip | “Fish & seafood” / “Plant-forward” |

Why:

1. **Hard limits are automatic and the final word.** Every result already fits everyone eating; the page says so (“Everything here fits your table”, “Fits everyone’s limits”). An optional “Dairy-free” or “Vegetarian” toggle beside that promise suggests the person has to turn it on to be safe, or that the household’s No dairy limit is a preference they can switch off for one search. Neither is true, and the second is dangerous to imply.
2. **The labels don’t mean the same as the limits.** `diet: ["dairy_free"]` keeps only meals with that stored label. A No-dairy household already sees every meal without dairy, labeled or not. So turning on “Dairy-free” would *hide* safe dinners and look like the safer choice. That’s the opposite of helpful.
3. **Plant-forward and Fish & seafood are about taste, not limits.** “I feel like fish tonight” is a craving. Both already have shelves with the same names. Putting them in one “On the plate” group frames them as a choice of food. A radio avoids the near-empty “fish *and* plant” combination.
4. **Vegan stays out.** The contract has no vegan label (`diet_invalid`).

Rules:

- Find never shows the words “Vegetarian”, “Dairy-free”, “Vegan”, or “Diet” as controls. “Plant-forward” is allowed only as the shelf title and this option.
- The canonical query expands `plant` to `plant`, `plant_based`, and `vegetarian`. Plant-forward is “on” when `criteria.diet` contains `plant`. Don’t show the expanded values as separate chips.
- A hand-edited URL with any other `diet` value (`dairy_free`, or `vegetarian` without `plant`): drop that value, and `replaceState` the cleaned URL silently, like other URL repairs in `D07-UX.md` §9.1. This edits the person’s query. It does not filter results on the client.
- Shelf sub-lines (Opus note 8): Fish & seafood → “Fish and shellfish dinners”. Plant-forward stays “Vegetarian-friendly dinners” (it describes, it doesn’t promise).
- Hard eligibility does not change in any way: server-side, before every other stage, never shown as a control.

---

## 4. “Why this one” and servings (recipe detail from Find)

### What `main` does today

- `syncDiscoveryDetailActions` writes a taste line into `#detailWhy`. Then `renderDetail` overwrites it with `pers.line || "Clears your household’s hard limits."`, so recipes from Find show the filler.
- Servings use `servingCountForMeal()` → `activeMemberCount()`, which returns 1 when members aren’t loaded yet. That’s how a two-person table saw “1 serving”. It also ignores a subset in Who’s eating and, in replace mode, that dinner’s actual diners.
- The Effort stat prints `effort_label`, which can be “Moderate” or “Involved” (banned words, `D07-UX.md` §0.6).

### 4a. Why this one

On recipe detail opened from Find (any mode), “Why this one” is a short list of **at most three** lines. Build it from the Discovery result row the person opened, in this priority order, and stop after three:

| Reason | Shown when (all from the result row) | Line |
|--------|---------------------------------------|------|
| Great match (taste) | `primary_reason` is `taste_love` or `taste_like` and `taste_hits` has at least one display name | Existing wording: “You told us you love {terms}” / “You said you like {terms}”; another diner’s hit: “{Name} loves {terms}” / “{Name} likes {terms}”. `{terms}` is up to two names, “A and B”. |
| Something different | `reasons` contains `explicit_different` (the result survived Something different with real cook history) | “You haven’t made this one lately” |
| Quick | `total_minutes` ≤ 30 | “On the table in {m} minutes” |
| Easy | `effort_level === "easy"` | “Easy: short on steps, light on fuss” |
| Simple ingredients | `ingredient_complexity === "simple"` | “Familiar ingredients, nothing hard to find” |

- **No reason, no section.** Hide the “Why this one” label and body together. Never fall back to filler.
- **Never** “Clears your household’s hard limits”, “Fits everyone’s limits”, “Great match”, “Top pick”, or a reason built from `text_match`, `soft_*`, `recent_demoted`, `diversity_preferred`, `novelty_tiebreak`, `eligible_catalog_fit`, `taste_less_often`, or `soft_pref_relaxed`. Fitting the table is the premise of Find, not a reason to pick one dinner. The table note already says it.
- “Something different” needs the server’s confirmation (`explicit_different`). Don’t infer it from history the client holds.
- **Cold deep link** (`/meal/{slug}?from=find` with no Discovery row in memory or the session cache): taste and Something different aren’t known, so leave them out. Quick, Easy, and Simple come from the recipe payload (`total_minutes`, `effort_level`, `ingredient_complexity`).
- Cards are unchanged: at most one reason line, taste only (`D07-UX.md` §7.1). The detail page can say more because it has room. It never says anything the card data can’t back.
- Fix the overwrite: when `meal.discovery` is true, `renderDetail` must not write `pers.line` or the filler into `#detailWhy`.
- Plan cards outside Find (“Why this one · Fits everyone’s limits” in `renderPlanMealCard`) are Cycle 3 surfaces and are **not** changed by D-07.

### 4b. Servings

| Surface | Behavior |
|---------|----------|
| Discovery cards (shelf, lead, grid) | No servings, ever (unchanged, §7.1). |
| Recipe detail from Find | Scale to **n = `response.context.participant_ids.length`** from the Discovery response that showed this dinner. Standalone: everyone, or the Who’s eating subset. Replace or choose: that dinner’s diners. Fetch `/api/recipes/{slug}?servings={n}`. |
| “Serves” stat | “{n} servings”. Use “1 serving” only when one person really is eating (“Just you”). |
| Servings note | Unchanged: “Scaled for {n} (written for {base}).” or “Amounts for {n}.” |
| n unknown (cold deep link before the household loads) | Don’t guess and don’t use the `|| 1` fallback. Fetch without `servings`, show “{base_servings} servings”, note “Written for {base}.” Re-fetch and re-render once the household or Discovery context arrives. |

Effort stat on recipe detail from Find: show “Easy” when `effort_level === "easy"`. Otherwise leave the Effort stat out. Never show “Moderate” or “Involved” in Find or recipe detail opened from Find.

Fit badge on recipe detail from Find: “Fits everyone eating”. This is always true because the server checked it for exactly these diners. Don’t use the household-wide “Fits both of you” style, which is wrong for a Who’s eating subset.

---

## 5. Replace-mode chrome and CTA

### What `main` does today

Title “Find something else”. Lede “Every option fits everyone at this dinner.” No eyebrow. Table note always “For everyone · Fits everyone’s limits”. The Back button calls `showView(origin)` without popping history. “Use this” from a card works (`history.go(-1)`). From a recipe it also does `go(-1)`, which lands back on Find, not the plan. Toast “Swapped in.” with no title and no “Swapped in” badge on the plan card. `mutateDinnerPlan` isn’t told to hold its own toast, so a shopping-list toast can stack on top.

### Decision

**Header** (focus chrome: no tab bar on phone, nothing lit in the top nav, Back at top left):

| Slot | Multi-dinner plan | One-dinner plan |
|------|-------------------|-----------------|
| Back | “Back” | “Back” |
| Eyebrow | “Swap Dinner {p}” | “Swap tonight’s dinner” |
| Title (`h1`) | “Find something else” | “Find something else” |
| Lede | “Now: {current title}” | “Now: {current title}” |
| Table note (read-only) | “For Dinner {p}: everyone” or “For Dinner {p}: {names}” | “For tonight: everyone” / “For tonight: {names}” |
| Lean line (when on) | “Easier dinners first · from your plan  Change” (§4 of `D07-UX.md`) | same |
| “Pick one for us” | Not shown | Not shown |

`{p}` and `{names}` come from `response.context` (`position`, `participant_ids`). `{current title}` comes from the plan meal for `meal_id`. The lede deliberately repeats the Swap sheet’s “Now:” line, so moving from the sheet to Find feels like the same task getting bigger, not a new screen.

**Nav lighting.** Nothing is lit, which matches what’s built and `D07-UX.md` §12.2. `D07-NAV-DECISION.md`’s “lit nav item: the section that opened the sheet” column is amended to match. The focus header plus the “Swap Dinner {p}” eyebrow is enough to show that this is a task inside the plan.

**Cards.** Same shelves, search, chips, and results as standalone. Each card has `btn-secondary btn-sm` “Use this”, accessible name “Use {title} for Dinner {p}” (one dinner: “Use {title} for tonight”). Other nights’ dinners can appear with the eyebrow “On your plan · Dinner {q}”. They stay pickable, because repeating a dinner is the person’s call. The current dinner never appears (server).

**Opening a recipe never changes anything.** Tapping the card or title opens `/meal/{slug}?from=find` (`pushState`). Context line: “Swapping Dinner {p} · Now: {current title}” (one dinner: “Swapping tonight’s dinner · Now: {current title}”). The only sticky action is primary “Use this for Dinner {p}” (one dinner: “Use this for tonight”), with no secondary. Back is labeled “Back” and returns to Find with the query, scroll, and focus restored (§9.3).

**Pick.** Card “Use this” and recipe “Use this for …” do the same thing:

1. Disable every “Use this” control while the request runs (no label change, `aria-busy` on the card or bar).
2. Send `POST selection.path` with `{ op: "swap_meal", meal_id: selection.meal_id, recipe_version_id: <this result's>, participant_ids: selection.participant_ids }`, calling `mutateDinnerPlan` with `suppressToast: true`.
3. On success, do what the compact Swap does: mark `state.swappedMealIds[meal_id] = true`. Then, if a shopping-list toast is pending, flush it with `flushDinnerToast()`; otherwise show the toast “Swapped in {title}.”.
4. Return to the plan surface that opened Find:
   - Opened in-app: `history.go(-1)` from a card, `history.go(-2)` from the recipe. Store how many entries Find pushed (Find = 1, plus 1 if a recipe is open) rather than hard-coding.
   - Cold-loaded (`/find?mode=replace_plan_meal…` was the first entry): `replaceState` to the origin and show it. The origin is Tonight (`choices`) when the plan is finalized, otherwise `planReview`.
5. On the plan: the swap sheet stays closed, the card shows “Swapped in” (Cycle 3 §5.3), and focus moves to that card’s title button. Tonight’s pick stays Tonight’s pick (the server keeps the meal’s state on a swap).

**Errors** (copy from `D07-UX.md` §8.3, unchanged): `outcome_locked` / `version_locked` / `illegal_transition` → “That dinner’s already cooking or done, so it can’t change now.” with “Back to your plan”. `hard_limit_blocked` → inline on the card or sticky bar with Cycle 3 copy; stay put and re-request. Network → “We couldn’t reach the kitchen. Try again.”

**Back without picking.**

- The in-app Back button and the browser Back button behave the same: `history.back()` to the plan surface, sheet closed. Focus goes to that card’s “Swap” if Find was opened from the sheet, or to its ⋯ if opened from the More sheet. Nothing changes and there’s no toast.
- On a cold load with no previous entry, Back does `replaceState` to the origin (same rule as the pick).

**Choose mode** (`choose_for_plan`, “Pick one yourself”) follows the same chrome and return rules, with the existing copy: eyebrow “Dinner {p}”, title “Pick a dinner”, lede “Anything here works for this dinner.”, CTAs “Add this” / “Add this to Dinner {p}”, toast “{title} is on Dinner {p}.”. Its URL keeps `position` because the contract allows it for that mode.

---

## Acceptance checks added for closure

1. From Tonight with a plan: Swap → “See all options” → URL is exactly `/find?mode=replace_plan_meal&dinner_plan_id=…&meal_id=…` (no `participant_id`, no `position`). The Find tab isn’t lit and the tab bar is hidden on phone.
2. The header reads “Swap Dinner {p}” / “Find something else” / “Now: {current title}” / “For Dinner {p}: …”. The current dinner isn’t in the results.
3. Plan with Keep it easy on: the lean line reads “Easier dinners first · from your plan”, and the request has no `soft`.
4. Open a recipe from replace mode: the plan doesn’t change, and the only sticky button is “Use this for Dinner {p}”.
5. “Use this” from the recipe returns to the plan (not Find) with “Swapped in” on the card, focus on its title, one toast, and browser Back doesn’t reopen Find.
6. Back without a pick returns to the plan with the sheet closed and no mutation.
7. The time chip never shows “▾” and has no `aria-haspopup`. Tap → `quick=1`. Tap again → cleared. Refine Under 45 → the chip reads “Under 45 min”, and a tap clears it.
8. Refine has no “Diet” or “Protein” heading and no Vegetarian or Dairy-free option. “On the plate” is a radio group: Anything / Fish & seafood / Plant-forward. `/find?diet=dairy_free` repairs to `/find`.
9. Recipe from Find for a two-person table: “2 servings”, amounts scaled for 2. With Who’s eating = one person: “1 serving”. No Find recipe ever shows “Clears your household’s hard limits”, “Moderate”, or “Involved”.
10. Recipe from Find for a moderate 45-minute dinner with standard ingredients and no taste hit: no “Why this one” section at all.
