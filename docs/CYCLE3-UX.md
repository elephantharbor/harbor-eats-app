# Cycle 3 UX: Plan → Shop → Cook → Rate

UX specification for FlavorWeave Campaign Cycle 3, D-01. A later Composer agent implements this document in `public/app.js`, `public/index.html`, and `public/styles.css`. This document does not implement anything.

Branch: `feature/fw-c3-ux`, cut from `feature/fw-c3-contract` at `d605032c0cb954cb6366c62306740eeeb96b56b3`. No pull request. Not merged. Not deployed.

`docs/CYCLE3-CONTRACT.md` is binding. This document does not change the domain, the API, migration 0011, or the shopping-started rules. Where the contract and this document seem to disagree, the contract wins and Composer reports the gap rather than working around it.

D-01 stays **In Progress**.

---

## 0. Rules for Composer

1. **One system.** Plan our dinners, What are we cooking tonight?, and Find a dinner all read and write `/api/dinner-plans`. A one-dinner flow is a plan with `meal_count: 1`. Do not build a second list, a second status model, or a client-side planner.
2. **No internal words on screen.** These never appear in consumer UI, in `aria-label`s, or in toasts: Draft, Ready to shop, Active, Completed, status, eligibility, eligible, Completed Meal Loop, data origin, synthetic, unproven, household-origin, constrained, delta, list_state, still_needed, score (as in model score), confidence, rank, pin, version. `status_label` is never rendered. Section 2 maps every API value to what the person sees.
3. **Server decides.** Eligibility, swaps, shopping lines, and state transitions come from server responses. After every mutation, re-render from the returned `plan`. Do not patch local copies optimistically, except for the shopping check animation in section 8.
4. **Exact strings.** Strings in “quotes” in this document are final copy. Use the typographic apostrophe `’` as the existing app does. `{braces}` are substitutions. If a string you need is not here, write it in the same voice and list it in the Composer report. Do not borrow wording from the status table in the contract.
5. **Existing design system only.** Use the tokens and components already in `public/styles.css`: `.page`, `.page--wide`, `.page--medium`, `.page-head`, `.eyebrow`, `.title`, `.display`, `.lede`, `.card`, `.card-kicker`, `.badge` with `--fit`, `--match`, `--time`, `--accent`, `--success`, `--warning`, and `--sm`, `.btn-primary`, `.btn-secondary`, `.btn-quiet`, `.btn-lg`, `.btn-sm` (never primary), `.segmented`, `.chip-tog`, `.check-tile`, `.sheet` (a `<dialog>`), `.empty-state`, `.weave-loader`, `.sticky-actions`, `.link-card`, `.tonight-hero`, and `mealMediaHtml` photos. New classes compose these tokens. Do not use raw hex values.
6. **Nothing invented.** See section 14.

---

## 1. Where things live

The bottom tab bar keeps its four tabs: Home, Tonight, History, Profile. Do not add a fifth tab. The shopping list is reached from the plan surfaces described below, and from Home in one tap.

| Surface | Purpose | Chrome |
|---------|---------|--------|
| Home hero | Entry to Plan our dinners and Find a dinner. When a plan exists, it summarizes that plan and offers the one next action. | `full` |
| Tonight tab | What are we cooking tonight? Meals still available in the current plan, plus a way to find something else. | `full` |
| New view `planCount` | Step 1. How many dinners? | `focus` |
| New view `planReview` | Steps 2 and 3. The proposed plan, review, and swap. | `focus` while composing, `full` when opened later to edit |
| New view `planConfirm` | Step 4. Confirm. | `focus` |
| New view `shopList` | Step 5. Shopping list. | `full` on tablet and desktop, `focus` on phone (no tab bar in the store) |
| Swap sheet | Alternatives for one dinner. | `.sheet` |
| Meal options sheet | Who’s eating, day, leftovers, eating out, skip, remove. | `.sheet` |
| Existing `detail`, `cook`, `rate`, `loop` | Recipe, Kitchen mode, rating. Reused with the plan meal as their subject. | unchanged |

### Current plan pointer

No endpoint lists a household’s dinner plans. The client remembers them:

- `fw_dinner_plan:{household_id}` in `localStorage` holds the current `dinner_plan_id`.
- `fw_dinner_plans:{household_id}` holds up to five recent ids, newest first. Use this so a meal waiting on a rating can still be found after a new plan starts.
- If the id returns `404` or `403`, drop it silently and show the no-plan state.
- The share link `/?dinner_plan={dinner_plan_id}` (section 10) sets the pointer on another member’s device.

This is a known gap. Another device does not see the plan until someone opens the share link. Do not add an endpoint. Record it in the Composer report.

### Legacy Tonight round

The existing `/api/plans` three-pick round still runs, and its tests stay green.

- If the household has an unfinished legacy round (picked, cooking, or waiting on ratings) and no current dinner plan, Home and Tonight show it exactly as they do today.
- New rounds start only from the three new entry points.
- When both exist, the dinner plan takes the Home hero and the Tonight tab. The legacy round stays reachable from History, as it is today.
- The “Find our next dinner” action on the existing `loop` screen opens the no-plan Home hero (section 3.1) instead of starting a legacy round. Update the affected e2e spec on purpose. Do not delete the legacy views.

---

## 2. What the person sees instead of API values

### Plan

Never render the plan status. Derive the Home and Tonight copy from `status`, `finalized_at`, `shopping_started_at`, and the meal states, as described in section 3.2.

### Meal states

Each state gets its own badge. They must not collapse into one “in progress” badge.

| `kind` / `state` | Badge (class) | Supporting line on the card |
|------------------|---------------|-----------------------------|
| recipe `planned` | none | — |
| recipe `selected` | “Tonight’s pick” (`badge--match`) | — |
| recipe `cooking` | “Cooking now” (`badge--accent`) | “Pick up where you left off.” |
| recipe `cooked`, no ratings yet | “Ready to rate” (`badge--warning`) | “How did it go?” |
| recipe `partially_rated` | “Waiting on {names}” (`badge--warning`) | If the viewer has rated: “You’re in. Waiting on {names}.” If not: “Your turn to rate.” |
| recipe `fully_rated` | “Everyone rated” (`badge--success`) | — |
| recipe `skipped` | “Skipped” (`badge--sm`, neutral) | — |
| recipe `abandoned` | “Didn’t happen” (`badge--sm`, neutral) | — |
| leftovers `planned` | “Leftovers night” (neutral) | “Nothing to shop for.” |
| eating out `planned` | “Eating out” (neutral) | “Nothing to shop for.” |
| leftovers or eating out `fulfilled` | “Done” (`badge--success`) | — |
| leftovers or eating out `skipped` / `abandoned` | “Skipped” / “Didn’t happen” | — |

In “Waiting on {names}”, `{names}` lists the participants on that meal who have no rating. Use “you” for the viewer. Show at most two names, then “and 1 more” or “and {n} more”. A household member who is not a participant is never named.

### Shopping line states

| Line | Person sees |
|------|-------------|
| `list_state: open`, `still_needed: true` | Under **Still need**, with an empty check circle |
| `purchased`, `still_needed: true` | Under **Bought**, with a filled check |
| `already_have`, `still_needed: true` | Under **Already have**, with a house icon |
| `still_needed: false`, any state | Under **No longer needed**. The row keeps the mark it had. See section 9. |

### Planner reasons and errors

| Code | What the person sees |
|------|----------------------|
| slot `reason: no_eligible_meal` | Section 7.1 |
| slot `reason: no_unused_eligible_meal` | Section 7.2 |
| `hard_limit_blocked` (swap, add, participants) | “That one doesn’t work for everyone at this dinner. Pick another.” For a participants change, see section 6.3. |
| `outcome_locked`, `version_locked`, `illegal_transition` | “That dinner’s already cooking or done, so it can’t change now.” Then refetch the plan. |
| `plan_full` | “Your plan is full. Add a night first.” |
| `meal_count_too_small` | “Remove a dinner first, then lower the number.” |
| `rating_requires_cooked` | Not reachable from the UI. If it happens: “Finish cooking first, then rate it.” |
| `forbidden_participant` | Not reachable. Raters are filtered to participants. |
| `forbidden_cross_household`, `plan_not_found` on a share link | “This plan isn’t in your kitchen.” Button: “Go home” |
| network or `dinner_plan_save_failed` | “We couldn’t reach the kitchen. Try again.” Button: “Try again” |

---

## 3. Entry points

### 3.1 Home with no current plan

Replace the Home hero content only when there is no current dinner plan and no unfinished legacy round.

- Eyebrow: “Dinner, sorted”
- Title (`.display`): “What’s for dinner?”
- Lede: “Plan a few nights at once, or just find one for tonight.”
- Primary: “Plan our dinners”. This opens `planCount` with `entry_point: plan_dinners`.
- Secondary: “Find a dinner”. This starts section 4.2 with `entry_point: find_dinner`.
- The hero photo stays as it is today. “Around your kitchen” is unchanged below.

### 3.2 Home with a current plan

The hero becomes a plan summary. Title and lede follow the first row that matches:

| Condition | Eyebrow | Title | Lede | Primary | Secondary |
|-----------|---------|-------|------|---------|-----------|
| Not finalized (`finalized_at` null), no meal past `planned` | “Your plan” | “Your plan is almost ready” | “{n} dinners picked. Have a look and make it yours.” | “Finish the plan” → `planReview` | — |
| Finalized, shopping not started | “Your plan” | “{n} dinners planned” | “Your list is ready when you are.” | “Shopping list” | “What are we cooking tonight?” |
| Shopping started, no meal past `planned` | “Your plan” | “{n} dinners planned” | “{k} things left to get.” If {k} is 0: “You’ve got everything.” | “Shopping list” | “What are we cooking tonight?” |
| A meal is `cooking` | “Your plan” | “{title} is cooking” | “Pick up where you left off.” | “Back to the kitchen” | “Shopping list” |
| A meal is `selected` | “Tonight” | “{title}” | “Tonight’s pick. Cook it whenever you’re ready.” | “Start cooking” | “See other dinners” → Tonight |
| Any other open plan | “Your plan” | “{open} dinners left” | “Cook any of them, in any order.” | “What are we cooking tonight?” | “Shopping list” |
| Plan closed (every slot closed) | “Your plan” | “That plan’s a wrap” | “Every dinner is cooked, rated, or set aside.” | “Plan our next dinners” | “Find a dinner” |

- `{n}` is `meal_count`. Use “1 dinner planned” for one.
- `{open}` counts slots not yet closed, including empty slots.
- `{k}` counts Still need rows.
- Under the hero, if the viewer is a participant on a meal waiting on their rating (in this plan or any recent plan), show one `.card` for the oldest such meal:
  - Kicker: “Waiting on your rating”
  - Body: “{title}”
  - Button (`btn-secondary`): “Rate it”
  - If more than one is waiting, add a quiet link: “{n} more to rate”, which goes to Tonight.

“Plan our next dinners” and “Find a dinner” on a closed plan start a new plan and move the pointer. The closed plan stays in the recent list.

Starting “Plan our dinners” while an open plan exists is only possible from Tonight’s overflow menu, as “Start a new plan”. It opens a confirm `<dialog>`:

- Title: “Start a new plan?”
- Body: “Your current plan stays in your recent dinners. Anything left to rate stays there too.”
- Buttons: “Start a new plan”, “Keep this plan”

### 3.3 Tonight tab

This tab answers “What are we cooking tonight?” See section 11.

### 3.4 Which `entry_point` to send

| Started from | `entry_point` | `meal_count` |
|--------------|---------------|--------------|
| Home “Plan our dinners” | `plan_dinners` | chosen in step 1 |
| Home “Find a dinner” | `find_dinner` | 1 |
| Tonight with no plan, “Find a dinner” | `tonight` | 1 |
| Tonight with a plan, “Find something else” | none. It adds to the current plan (section 11.4). | `set_count` +1 |

Default participants for a new plan are the household’s **active** members. Send `participant_ids` explicitly. Do not let the server default to invited members, who cannot rate yet and would keep a meal from ever being fully rated.

---

## 4. Screen sequence

### 4.1 Plan our dinners

```
Home ─ “Plan our dinners”
  └─ 1. planCount ─ “Plan {n} dinners”
        POST /api/dinner-plans { meal_count: n, entry_point: "plan_dinners",
                                 participant_ids: activeMemberIds, fill: "planner" }
        └─ 2. planReview (proposal) ─ ⇄ 3. Swap sheet / Meal options sheet
              └─ “Looks good”
                    └─ 4. planConfirm ─ “Make my shopping list”  (op: finalize)
                          └─ 5. shopList
              planConfirm ─ “We have everything” (op: finalize) → Tonight
```

Creating the plan on “Plan {n} dinners” saves it unfinalized. That is intended. Swaps are mutations on a saved plan. Do not call `/preview` for the first proposal.

Back from `planReview` on a plan that was never finalized returns to Home. The plan stays current, and Home shows “Your plan is almost ready”. Do not ask “Discard?”.

### 4.2 Find a dinner (one meal)

```
Home “Find a dinner”  or  Tonight “Find a dinner”
  POST /api/dinner-plans { meal_count: 1, entry_point, participant_ids, fill: "planner" }
  └─ planReview in single mode (section 5.5) ─ ⇄ Swap sheet
        ├─ “Let’s make this”  → ops finalize, select_meal → recipe detail
        └─ “Add to my shopping list” → op finalize → shopList
```

There is no count step, no confirm step, and no dates. The person never sees “1 dinner” framing.

### 4.3 What are we cooking tonight?

```
Tonight tab
  ├─ plan exists  → meals still available (any order) → recipe detail → Kitchen mode → rate
  │                └─ “Find something else” → single proposal added to this plan
  └─ no plan      → “Find a dinner” (4.2, entry_point tonight) · “Plan a few dinners” (4.1)
```

---

## 5. Step by step

### 5.1 Step 1: How many dinners? (`planCount`)

**On screen:**

- Eyebrow: “Plan our dinners”
- Title: “How many dinners?”
- Lede: “Count the nights you want covered. Leftovers and nights out can take a spot later.”
- A three-option `.segmented` control, with no option preselected:

| Option | Sub-line | Reveals number chips (`.chip-tog`) | Preselected chip |
|--------|----------|-------------------------------------|------------------|
| “Next few days” | “2 to 4 dinners” | 2 · 3 · 4 | none |
| “This week” | “You choose how many” | 3 · 4 · 5 · 6 · 7 | none |
| “Custom” | “Up to 14” | 1 through 14 | none |

- Under the “This week” chips, a hint: “Most weeks have a night or two off.”
- Chips appear only after an option is chosen. Switching options clears the chosen number unless it is also on the new row.
- Sticky primary button:
  - With no number chosen, it is disabled with the label “Choose a number”.
  - With a number chosen: “Plan {n} dinners”, or “Plan 1 dinner”.
- On submit, show the weave loader with “Weaving your plan…”.

**Rules:**

- No path sends `meal_count` without a tapped number. “This week” is never 7 by itself.
- There is no default number, even on repeat visits. Do not remember the last count.
- Nothing else is on this screen: no dates, no diners, no leftovers, no cuisines.

### 5.2 Step 2: The proposal (`planReview`, first view)

FlavorWeave proposes one meal per slot. The screen reads as a finished plan, not a set of questions.

**On screen:**

- Eyebrow: “Your plan · {n} dinners”
- Title: “Here’s a good plan”
- Lede: “One dinner per night, picked for your table. Swap anything that doesn’t feel right.”
- One card per slot, in `position` order. Empty slots go at their position (section 7). Card anatomy is in section 5.4.
- Sticky primary: “Looks good”
- Header overflow button (`aria-label` “Plan options”), with:
  - “Change the number of dinners”
  - “Ask the table” (section 10)
  - “Start over”, which returns to `planCount` and leaves this plan as the current pointer until a new one is created.

**Not on this screen:** dates, the shopping list, votes, the participant editor, per-diner limits, and the list of alternatives. Each is one tap away, behind “Swap”, the card’s “More” button, or the plan options menu.

**Taste note.** At most one honest note, below the last card. It appears only when a participant on this plan has an explicit Love or Like on a vocabulary term with `on_menu: false` (from `/api/tastes/catalog`):

- “{name} loves {term}. Nothing {term} on the menu yet.” For a Like: “{name} likes {term}. Nothing {term} on the menu yet.”
- Use “You love” or “You like” for the viewer.
- Example: “You love Korean. Nothing Korean on the menu yet.”
- Example: “Sam likes Spicy. Nothing spicy on the menu yet.” Use lowercase after “Nothing” for flavor and texture terms, and keep proper nouns for cuisines.
- Never suggest a substitute as if it were that thing. Do not write “Try our Korean-style…”.

### 5.3 Step 3: Review and swap

The same `planReview` screen, while the person makes changes. Each change is one mutation, and only that card re-renders. The plan is never rebuilt.

- After a swap, the changed card shows a `badge--match` reading “Swapped in” for that session. Focus moves to the new card’s title.
- Before shopping starts, changes silently update the list. A quiet toast says “List updated.”
- After shopping starts, see section 9. The toast reads “Your list changed. {a} added, {r} no longer needed.” with the button “See list”. Leave out a zero part.

### 5.4 Plan meal card anatomy

The same card is used on `planReview`, `planConfirm` (compact), and Tonight.

```
┌──────────────────────────────────────────────┐
│ [photo 4:3, mealMediaHtml by recipe_slug]    │
│ Dinner 2                    or  Tue, Oct 6   │  ← .eyebrow
│ Teriyaki Tofu Bowls                          │  ← h2
│ [state badge]  [⏱ About 40 min]  [For 3]     │  ← badges; state badge only on Tonight
│ WHY THIS ONE                                 │  ← .card-kicker
│ · Fits everyone’s limits                     │
│ · You told us you love Japanese              │  ← evidence, max 3 lines
│ · A change from your last few dinners        │
│ Just Sam and Ari                             │  ← only if not everyone
│ [Swap]                               [More ⋯]│
└──────────────────────────────────────────────┘
```

- **Label.** “Dinner {position}” when undated. “{Weekday short}, {Month short} {day}” when `scheduled_date` is set, for example “Tue, Oct 6”. Never “Day 1” or “Night 1 of 7”.
- **Tap.** Tapping the photo or title opens recipe detail in view mode (section 11.3). It never selects.
- **“About {m} min”.** `badge--time`, from `total_minutes` on `/api/recipes/version/{recipe_version_id}`. Omit it if unknown.
- **“For {k}”.** The participant count, which drives servings. Show it only when it differs from the active household size.
- **“Just {names}”.** Shown when the participants are a subset of the active members. One person: “Just {name}”, or “Just you”.
- **Swap.** `btn-secondary btn-sm`, label “Swap”, `aria-label` “Swap Dinner {position}, {title}”. Shown while the meal is `planned` or `selected`.
- **More.** Icon button, `aria-label` “More for Dinner {position}”. Opens the meal options sheet (section 6.2).
- **Leftovers and eating out cards.**
  - No photo. Use a quiet tile with an icon.
  - Title “Leftovers” or “Eating out”, with the line “Nothing to shop for.”
  - No evidence, no Swap. The More button stays.
- Do not reuse `.option-card__pick` or the “Your pick” badge on these cards. See section 13.

### 5.5 Single mode (Find a dinner)

`planReview` with `meal_count: 1`:

- Eyebrow: “Find a dinner”
- Title: “Here’s a good one”
- Lede: “Picked for your table. Swap it if it’s not the night for it.”
- One large card. Use the `.tonight-hero` composition on tablet and desktop.
- Primary: “Let’s make this”
- Secondary: “Add to my shopping list”
- “More” offers only “Who’s eating”. No dates, no leftovers, no eating out, no remove.
- Empty: see section 7.3.

### 5.6 Step 4: Confirm (`planConfirm`)

- Eyebrow: “Almost there”
- Title: “Looks like a plan”
- Lede: “{r} dinners{, 1 leftovers night}{, 1 night out} · {k} things on your list”
  - Example: “3 dinners, 1 leftovers night · 21 things on your list”
  - `{k}` counts lines with `still_needed: true`.
  - If `{k}` is 0: “Nothing to shop for.”
- A compact list of the plan: label and title only, no evidence.
- If any slot is empty: “Dinner {p} is still open. You can fill it later.”
- Two `.link-card` rows, both optional:
  - “Add days”, with the sub-line “Optional. Plans work fine without them.” This opens a sheet with one native `<input type="date">` per dinner, each with a “Clear” button. Saving calls `set_date` once for each change.
  - “Ask the table”, with the sub-line “Let others star a favorite. No need to wait for them.” See section 10.
- Primary: “Make my shopping list”. This calls `finalize` and opens `shopList`.
- Quiet: “We have everything”. This calls `finalize` and opens Tonight.
- Back: “Back to the plan”.

One person finishes the plan. Nothing waits on votes or on other members. Finalizing does **not** call `start_shopping`.

### 5.7 Step 5: Shop

See section 8.

### 5.8 Editing a plan later

“Edit plan” appears in the Tonight overflow menu and the `shopList` overflow menu. It opens `planReview` in `full` chrome with these differences:

- Title: “Your plan”
- Lede: “Swap, move, or set aside any dinner that hasn’t been cooked.”
- Primary: “Done”
- Cards past `selected` show their state badge and no Swap.

---

## 6. Swap and per-meal options

### 6.1 Swap sheet

Open it from “Swap” on a card.

- Title: “Swap Dinner {position}”, or “Swap tonight’s dinner” in single mode.
- A small line at the top: “Now: {current title}”
- Up to **three** alternatives. Each row:
  - a 4:3 thumbnail at 72px wide on phone, 96px on tablet and up
  - the title
  - one evidence line (the first line from section 12 for that meal, or nothing)
  - “About {m} min”
  - a `btn-secondary` reading “Use this”
- Footer:
  - Quiet button: “Keep {current title}”, which closes the sheet.
  - On a multi-dinner plan only, a second quiet button: “Make it leftovers or a night out”, which opens the meal options sheet.

**Where the alternatives come from.** No API change is needed.

1. Call `POST /api/dinner-plans/preview` with `dinner_count: min(14, plan.meals.length + 3)`, `entry_point: plan.entry_point`, `participant_ids: meal.participant_ids`, and the plan’s `intent.meal_styles`, `practical_hints`, and `max_cook_minutes` if present.
2. Keep slots with `result: "recommended"`. Drop any `recipe_slug` already on the plan, in any state.
3. Show the first three, in the order returned.
4. “Use this” sends `{ op: "swap_meal", meal_id, recipe_version_id }`. The server re-checks hard limits.
5. On success, close the sheet and re-render that card. On `hard_limit_blocked`, show the inline error from section 2 and refetch the alternatives.

**Empty swap sheet** (zero alternatives after filtering):

- Text: “That’s every dinner that fits {names} right now.” With everyone eating: “That’s every dinner that fits your table right now.”
- Buttons: “Keep {current title}”, and, on a multi-dinner plan, “Make it leftovers” and “We’re eating out”.

The preview is deterministic, so do not add “Show more” or “Shuffle”. They would return the same meals.

### 6.2 Meal options sheet (“More”)

Title: “Dinner {position}: {title}”. The rows appear only when allowed:

| Row | Shown when | Op |
|-----|-----------|----|
| “Who’s eating” | recipe `planned`/`selected`, leftovers or out `planned` | `set_participants` (6.3) |
| “Set a day” / “Change the day” | not closed | `set_date`. Include “No day”, which clears it. |
| “Make it leftovers” | recipe `planned`/`selected`, or eating out `planned` | `set_leftovers` |
| “We’re eating out” | recipe `planned`/`selected`, or leftovers `planned` | `set_eating_out` |
| “Plan a dinner here instead” | leftovers or eating out `planned` | 6.4 |
| “Move up” / “Move down” | more than one meal | `reorder`. Display order only. |
| “Skip this one” | recipe, leftovers, or out `planned`/`selected`/`cooking` (on Tonight) | `skip_meal`, after a confirm |
| “Remove this night” | `planned` and a multi-dinner plan in review | `remove_meal`, then `set_count` to `meal_count − 1` |

Skip confirm `<dialog>`:

- Title: “Skip {title}?”
- Body before shopping starts: “Its ingredients come off your list.”
- Body after shopping starts: “Anything only it needed moves to No longer needed. Your checks stay.”
- Buttons: “Skip it”, “Keep it”

### 6.3 Who’s eating (per meal)

- A sheet titled “Who’s eating Dinner {position}?”
- One `.check-tile` per active member, with the name and avatar initial. The signed-in diner’s tile says “You”.
- At least one must stay checked. Otherwise Save is disabled and the hint reads “Someone has to eat it.”
- Save sends `set_participants`.
- On `hard_limit_blocked`, the sheet stays open:
  - Text: “{title} doesn’t work for {added names}. Swap the dinner, or keep the table as it was.”
  - Buttons: “Find one that works”, which opens the swap sheet with the new participant set in step 1, and “Keep the table as it was”.
- “Find one that works” uses the new participant set for alternatives. On “Use this”:
  1. Send `swap_meal`, then `set_participants`.
  2. If either fails, refetch the plan and show “That didn’t work. Your dinner is unchanged.”
- Do not swap silently. Do not drop a diner to make a meal fit.
- On leftovers and eating out cards, “Who’s eating” is informational only. It sets participants and changes no list.

### 6.4 Plan a dinner here instead

The contract has no op that turns leftovers or eating out back into a recipe. Compose it:

1. Open the swap sheet with this slot’s participants.
2. On “Use this”, send `remove_meal` and then `add_meal` with `{ kind: "recipe", recipe_version_id, participant_ids, scheduled_date }`.
3. Send `reorder` to put it back at the original position.
4. If any step fails, refetch the plan and show “That didn’t work. Your plan is unchanged.” If the plan did change partway, show the refetched plan as it is.

### 6.5 Changing the number of dinners

Open it from the plan options menu. The sheet shows the 1–14 chips with the current number on.

- **Higher.** Send `set_count`. Then, for each new slot, take preview picks (as in 6.1, all active members) that are not already on the plan, and send `add_meal`. If preview runs out, leave the slot empty (section 7.2).
- **Lower.** Ask “Which dinner should go?” with radio rows of the `planned` meals and empty slots. Send `remove_meal` for the chosen meal (none for an empty slot), then `set_count`.
- The number never drops below the count of meals past `planned`.

---

## 7. Empty and constrained states

Never fill a slot by breaking a limit. Never show a meal the server did not return.

The plan stores only real meals. Empty slots are derived:

- On create: from the `unfilled[]` array in the response, which gives `position` and `reason`.
- On later loads: `meal_count − meals.length`, with reason unknown. Treat an unknown reason as 7.2 if any meal exists, otherwise as 7.1.
- Show empty slots after the existing meals, labeled “Dinner {next position}”.

### 7.1 Nothing fits these diners (`no_eligible_meal`)

An `.empty-state` card in the slot:

- Title: “Nothing on the menu fits this table yet”
- Body: “Between everyone’s limits, none of our dinners work here. Try a different table, or take the night off from cooking.”
- Buttons:
  - “Change who’s eating”. Open 6.3 for a slot with no meal. On Save, call preview with `dinner_count: 1` for those diners. If a meal is recommended, send `add_meal`. If not, show this card again with the new names.
  - “Make it leftovers”, which sends `add_meal` with `kind: "leftovers"`.
  - “We’re eating out”, which sends `add_meal` with `kind: "eating_out"`.
  - “Remove this night”, which sends `set_count`.

### 7.2 We’ve used everything that fits (`no_unused_eligible_meal`)

- Title: “That’s every dinner that fits”
- Body: “Your plan already has all of them. Repeat one you love, or take the night off from cooking.”
- Buttons:
  - “Repeat a dinner”. This lists the recipe meals already on the plan whose participants match. Send `add_meal` with that `recipe_version_id`, and let the server check it.
  - “Make it leftovers”
  - “We’re eating out”
  - “Remove this night”

### 7.3 Single mode with nothing that fits

- Title: “Nothing on the menu fits everyone tonight”
- Body: “Between everyone’s limits, none of our dinners work. Try a smaller table, or call it a night out.”
- Buttons: “Change who’s eating”, “We’re eating out”

### 7.4 Every slot empty

If every slot is empty, the title on `planReview` changes to “We couldn’t fill this plan” and the lede reads “Your table’s limits rule out every dinner we have right now.” The slot cards show 7.1. Hide “Looks good” and show “Back home”.

### 7.5 Catalog gaps

The catalog has 24 meals. It has no Korean dishes, nothing spicy, no swordfish, and no sandwiches. The only honest copy for those is the taste note in section 5.2 or the existing taste-profile line “Nothing on the menu has this yet.” Do not label any meal Korean, spicy, or swordfish. Do not suggest “similar” dishes for a missing term.

### 7.6 Loading and offline

- Creating or loading a plan shows the weave loader: “Weaving your plan…” or “Loading your plan…”.
- Swap alternatives show three skeleton rows, without spinner text.
- When a request fails, the sheet or screen shows “We couldn’t reach the kitchen. Try again.” with “Try again”. Keep the last good render visible behind it.

---

## 8. Shopping list (`shopList`)

This is built for one hand, a phone, and a store aisle.

### 8.1 Screen

- Eyebrow:
  - “For {n} dinners”, or “For {title}” in single mode
  - “For {n} dinners · {d} nights with nothing to buy” when leftovers or eating out are present
- Title: “Shopping list”
- A progress line (`.meta`, `aria-live="polite"`): “{need} to get · {bought} bought · {have} already have”. When `{need}` is 0: “All set. Enjoy dinner.”
- A changes banner, after shopping starts and only when there are unseen changes. See section 9.2.
- Sections, in this order, each with an `h2.section-title` and a count:
  1. **Still need**: open and still needed. Always expanded.
  2. **Bought**: purchased and still needed. Expanded.
  3. **Already have**: already have and still needed. Collapsed by default to one row: “{n} already have · Show”.
  4. **No longer needed**: `still_needed: false`. Shown only when non-empty. See section 9.
- Order within each section: the server’s line order, which is ingredient id, then unit. Do not invent aisles or categories. Section 14 explains why.
- Header overflow (`aria-label` “List options”):
  - “Edit plan”
  - “Mark everything bought”, which sends one `set_line_state` per Still need line, after a confirm with the title “Mark all {n} as bought?” and the buttons “Mark all bought” and “Cancel”
  - “Copy list”, which copies plain text of Still need rows, one per line as “{qty} {name}”
- No sticky primary button on phone. The bottom of the list says “Back to your plan” (quiet), which goes to Tonight.

**Empty list.** For example, every slot is leftovers or eating out, or the only meals are skipped.

- `.empty-state`, title “Nothing to shop for”
- Body: “Leftovers and nights out don’t need a list.”
- Button: “What are we cooking tonight?”

### 8.2 Row anatomy

```
┌─────────────────────────────────────────────────────┐
│ ( ◯ )  Jasmine rice                          [ ⋯ ] │   min-height 64px
│        2 cups                       [Added]         │
└─────────────────────────────────────────────────────┘
  56×56 hit area                               44×44
```

- **The whole row, except the trailing button, is one toggle.** Tapping it moves the line between Still need and Bought, sending `set_line_state` with `purchased` or `open`.
- **Markup.** Use `role="checkbox"` and `aria-checked`. The accessible name is “{name}, {qty}”. The check circle is 28px, drawn inside a 56×56 target.
- **Name.** `display_name` with the first letter capitalized, at `--text-md` or larger, weight 600. Do not show `preparation` in the row.
- **Quantity.** One line below the name, `--color-text-secondary`.
  - With a numeric `quantity` and a `unit`: format with the existing ingredient quantity formatter. Show fractions as fractions, and never round 0.25 cup to ½.
  - With a numeric `quantity` and no unit: just the number.
  - With a string quantity: as given.
  - With none: nothing.
- **Trailing “More” button.** `aria-label` “More for {name}”. It opens a small sheet:
  - The title is the name.
  - A line “For {meal titles}”, from `meal_ids` mapped to plan meal titles. Show at most three, then “and {n} more”.
  - A line “{preparation}”, when present, for example “Minced”.
  - Actions depend on the state: “Already have it” (`already_have`), “Mark bought” (`purchased`), “Still need it” (`open`).
- **Bought animation.** On toggle, fill the check right away (optimistic). Then, after 600ms, move the row to Bought with a short collapse. With `prefers-reduced-motion`, move it immediately. If the request fails, put the row back and show “We couldn’t save that. Try again.”
- **Already have.** The row shows a house icon instead of the circle. Tapping the row returns it to Still need, which sends `open`.
- **No clutter.** No photos, no prices, no store links, no meal chips in the row, no swipe gestures, and no drag-to-reorder.

### 8.3 Shopping started

- Opening the list does not start shopping.
- The first “Mark bought” or “Already have it” starts shopping. The server sets the timestamp.
- Do not call `start_shopping` automatically. Do not show a “Start shopping” button. There is no separate mode, and the list is always in large-target mode.
- Setting a line back to Still need does not undo the start. The UI shows nothing about it.

---

## 9. After the plan changes

### 9.1 Before shopping starts

The list is replaced by the server, and the client just re-renders it. The only feedback is the toast “List updated.” There are no tags, no banner, and no No longer needed section.

### 9.2 After shopping starts

The server appends changes and keeps every check. The client never clears a check.

**Changes banner.** It sits at the top of the list, as a `.card` using `--color-accent-soft`.

- Shown when any change has a `created_at` later than this device’s `fw_shop_seen:{dinner_plan_id}` timestamp.
- Title: “Your plan changed”
- Body: the net change per ingredient and unit since that timestamp, as plain lines, at most five, then “and {n} more”:
  - “Added: {qty} {name}”
  - “No longer needed: {qty} {name}”, or, when that line is marked bought or already have: “No longer needed: {qty} {name}. You already have it.”
- Button: “Got it”. This saves the current time to `fw_shop_seen:{id}` and hides the banner. It writes nothing to the server and does not change any row.

**Row tags.** These appear in the normal sections and persist until “Got it”:

| Situation | Where the row stays | Tag | Quantity line |
|-----------|--------------------|-----|---------------|
| New line, added after start | Still need | “Added” (`badge--accent badge--sm`) | the new quantity |
| Existing open line, more needed | Still need | “More needed” | “{qty} now · was {old}” |
| Existing **bought** or **already have** line, more needed | stays in Bought or Already have | “Get {extra} more” (`badge--warning badge--sm`) | “{qty} now · you have {old}” |
| Existing line, less needed (`surplus_quantity > 0`) | its section | “Less needed” | “{qty} now · was {qty + surplus}” |

A bought line that now needs more does not move back to Still need, and its check is not cleared. The tag and the banner make sure the person sees it. `{extra}` is the added quantity from the changes. If the unit can’t be summed, use “Get more”.

**No longer needed section.** Rows with `still_needed: false` move here and stay here, independent of “Got it”.

- Title: “No longer needed”
- Hint under the title: “Your plan changed. These stay so your checks aren’t lost.”
- Each row keeps its mark, shown with muted text (not struck through) and a trailing plain-text status:
  - bought: “Bought”
  - already have: “Already have”
  - open: “Skip it”
- Tapping a row here still changes its mark, the same as anywhere else. No row is ever removed by the client.

Add “Skip it” to the forbidden-words check in tests only as a consumer string. It is not an API value.

---

## 10. Ask the table (optional voting)

- “Ask the table” creates the link `{origin}/?dinner_plan={id}` and offers “Copy link” and, where available, the native share sheet. Sheet text: “Send this to people in your kitchen. They can star a favorite. You don’t need to wait for them.”
- A member who opens the link, while signed in to the same household, gets `planReview` in star mode:
  - Header line: “{planner name} planned {n} dinners. Star the one you’re most excited about.”
  - Each recipe card shows a “Star it” toggle (`aria-pressed`). Pressing it sends `vote` with that `meal_id`. Pressing it on another card moves the star, and pressing it again clears the star with `meal_id: null`.
  - When someone has starred a card, it shows a quiet line: “Starred by {names}”.
  - Star mode also has “Swap” and “More”, because any member may edit.
- Stars never select, order, or lock a meal. They never gate “Looks good”, “Make my shopping list”, or cooking. Do not show “Waiting for votes”, a vote count requirement, or a deadline.
- A signed-out visitor is sent through the existing recovery and join flow, then returns to `/?dinner_plan={id}`. A visitor from another household sees “This plan isn’t in your kitchen.”

---

## 11. Tonight

### 11.1 Tonight with a plan

- Eyebrow: “From your plan”
- Title: “What are we cooking tonight?”
- Lede, the first that applies:
  - “{title} is cooking. Pick up where you left off.”
  - “Tonight’s pick is {title}. Or cook any other one.”
  - “Cook any of these, in any order.”
- Overflow (`aria-label` “Tonight options”): “Edit plan”, “Shopping list”, “Start a new plan”.

Sections, in this order, each shown only when non-empty:

1. **In the kitchen**: `cooking` meals. Card action, primary: “Back to the kitchen”, which opens `cook`.
2. **Ready to cook**: `selected` meals first, then `planned` recipe meals, then `planned` leftovers and eating out, each group in `position` order. The heading on phone is the section title only. The order is display order. It never says “Next up” or “Day 1”.
   - Recipe card actions: primary “Cook this”, which opens recipe detail. For `planned` meals, a secondary `btn-sm` reading “Pick for tonight” (`select_meal`).
   - Leftovers card: primary “We had leftovers” (`fulfill_meal`).
   - Eating out card: primary “We ate out” (`fulfill_meal`).
   - All cards have “More”, which includes “Skip this one”.
3. **Rate when you’re ready**: `cooked` and `partially_rated` meals.
   - If the viewer is a participant who hasn’t rated: primary “Rate it”.
   - Otherwise there is no button, and the line reads “You’re in. Waiting on {names}.”
4. **Done**: `fully_rated`, `fulfilled`, `skipped`, `abandoned`. Collapsed to “{n} done · Show”.

Below the sections, a `.card` that always shows while the plan is open:

- Kicker: “Not feeling any of these?”
- Button (`btn-secondary`): “Find something else”. See 11.4.

Every remaining meal is cookable now. There is no lock on “earlier” dinners, no forced order, and dates do not hide meals. A meal dated for Friday is still offered on Tuesday, labeled with its day.

**There is no unpick.** The contract has no op from `selected` back to `planned`. Do not offer “Unpick” and do not fake it with `begin_cook` + `exit_cook`. If a person cooks a different meal, the earlier pick keeps “Tonight’s pick” until it is cooked, skipped, or exited from Kitchen mode. Record this gap in the Composer report.

### 11.2 Tonight with no plan

When there is also no unfinished legacy round:

- Eyebrow: “Tonight”
- Title: “What are we cooking tonight?”
- Lede: “We’ll pick one that works for everyone eating.”
- Primary: “Find a dinner” (4.2, `entry_point: tonight`)
- Secondary: “Plan a few dinners” (4.1)

When the current plan is closed, show the same screen with the eyebrow “That plan’s a wrap”, and keep a quiet link “See that plan”, which opens `planReview` read-only.

### 11.3 Recipe detail for a plan meal

Reuse the `detail` view and its existing `.sticky-actions.recipe__actions` bar. Do not add a second sticky bar.

- Read the ingredients and steps from the meal’s pin. Use the meal’s own `pinned_ingredients` and `pinned_steps`, or `/api/recipes/version/{meal.recipe_version_id}?servings={participant count}`. Never use the latest recipe by slug.
- Kicker over the evidence: “Why this one”. Use the section 12 lines, not the legacy `pers.line`.
- Context line under the title:
  - “On your plan · Dinner {position}”, or the date form
  - “Tonight’s pick” when `selected`
  - “Just looking. Nothing changes until you start cooking.” when opened from `planReview`
- Sticky bar:
  - `planned`: primary “Start cooking” (`begin_cook`, then `cook`). Secondary `btn-secondary`: “Pick for tonight”.
  - `selected`: primary “Start cooking” only.
  - `cooking`: primary “Back to the kitchen”.
  - cooked or rated: no cook actions. Show “Rate it” if the viewer still owes a rating.
- Back goes to where the recipe was opened: Tonight, plan review, or Home. This follows the existing `nav-context.js` origin rule. Add origins `planReview` and `tonightPlan`.

### 11.4 Find something else (with a plan)

This adds one dinner to the current plan, so there is still one list and one system.

1. Load preview alternatives exactly as in 6.1, with all active members, excluding every slug on the plan.
2. Show `planReview` in single mode, with the title “Here’s something else” and the lede “It joins your plan for tonight. Everything else stays put.” Swap works as usual, cycling through the preview results.
3. Primary: “Cook this tonight”. Send `set_count` (+1), then `add_meal`, then `select_meal`, then open recipe detail.
   - If `meal_count` is already 14, show “Your plan is full. Skip or remove a dinner first.”
4. After shopping starts, its ingredients arrive as Added rows (section 9). Before that, the list just updates.

Leftovers and eating out never open recipe detail, Kitchen mode, or the rating screen.

### 11.5 Kitchen mode and leaving it

- “Leave kitchen mode” sends `exit_cook`. The meal goes back to Ready to cook without a badge, even if it was Tonight’s pick. Confirm `<dialog>`:
  - Title: “Leave the kitchen?”
  - Body: “{title} goes back on your plan. Nothing is marked cooked.”
  - Buttons: “Leave”, “Keep cooking”
- The existing finish action sends `finish_cook`, then opens `rate`.
- “We stopped partway” is a quiet link in Kitchen mode’s menu. It sends `abandon_meal` after a confirm with the title “Stop cooking {title}?”, the body “It won’t count as cooked or need a rating.”, and the buttons “Stop cooking” and “Keep cooking”.

### 11.6 Rating

- Reuse the `rate` view and its 1–10 rater cards.
- Show rater cards only for `meal.participant_ids`. A household member who did not eat is not listed and does not block.
- Each saved score sends `rate_meal` for that `member_id`.
- A quiet “Rate later” returns to Tonight. The meal waits under Rate when you’re ready, and the waiting card appears on Home (section 3.2). There are no notifications or emails.
- When the last participant rates, show the existing `loop` screen with this plan-aware copy:
  - Title: “Everyone rated {title}”
  - Primary, when meals remain: “Back to tonight’s options”
  - Primary, when the plan just closed: “Plan our next dinners”
  - Secondary: “Back home”
- Never show the average as a model score. A diner’s own number, such as “9/10”, is fine.

---

## 12. Meal explanations (FW-09 style)

Evidence lines appear under the kicker “Why this one”, at most three per card, in this priority. Each line appears only if its data exists and was loaded. Missing data means no line, never a softer guess.

| # | Line | Data it needs | Copy |
|---|------|---------------|------|
| 1 | Dietary fit | At least one participant on this meal has a hard limit in the loaded constraints. The meal came from the server for those participants. | “Fits everyone’s limits”. One participant: “Fits your limits”, or “Fits {name}’s limits”. If no participant has a limit, omit this line. |
| 2 | Taste shown | An explicit `love` or `like` row from a participant on this meal (household origin), whose `vocabulary_slug` is in the meal’s `vocabulary_tag_ids`. Or a past household rating of this recipe, from History. | The existing `tasteHitSentences` wording: “You told us you love {terms}”, “You said you like {terms}”. Use at most two term names. For a past rating, reuse the FW-09 lines: “You gave it {s}/10 last time”, or “Rated {avg}/10 on average when you made it” (needs at least 2 ratings). |
| 3 | Variety | At least 2 cooked meals in the household’s recent history (`/meals/history`), and this meal shares no cuisine and no meal style with the last three. | “A change from your last few dinners” |
| — | Time | `total_minutes` | Not a line. It is the “About {m} min” badge. |

**Rules:**

- Use only these lines, the FW-09 lines already in `taste-model.js`, and the `tasteHitSentences` shapes. Do not write “Perfect for you”, “You’ll love this”, “Healthy”, “Quick”, “Kid-friendly”, “Easy cleanup”, or “Weeknight-friendly”.
  - `low_cleanup` and `weeknight` are unscored on purpose.
  - “Quick” is allowed only as the time badge.
- A “less often” taste never appears as a reason.
- Inferred tastes do not produce a line in this cycle.
- Synthetic or QA households show only line 1 and the time badge. That is correct, not a bug.
- If no line qualifies, hide the kicker. Do not show “Good starting point” filler on plan cards.
- No scores, ranks, percentages, “match” numbers, or “because the model…”.

---

## 13. Responsive layout

| Width | `planCount` | `planReview` | Tonight | `shopList` | Sheets |
|-------|-------------|--------------|---------|------------|--------|
| < 768 (phone) | Single column. The segmented control is full width, chips wrap 7 per row, and the CTA sits in `.sticky-actions` above the tab bar. | One column of cards with a full-width photo. Sticky “Looks good”. | Sections stacked, cards full width. | `focus` chrome (no tab bar), rows full bleed, 64px minimum height. No sticky footer. | Bottom `.sheet`, full width, max 90vh, scrolls inside. |
| ≥ 768 (tablet) | `.page--medium`, the three options as vertical cards in a row, chips below. | A two-column card grid. “Looks good” stays in `.sticky-actions`. | A two-column card grid per section. | One centered column, max 640px. Section headers stick under the header. | Centered dialog, 560px. |
| ≥ 1024 (desktop) | `.page--medium`. The three options are tall cards with a sub-line, and the chosen card expands its chips inline. Not a phone column. | Two panes. Left (about 2/3): plan cards as horizontal rows, photo 200px wide, 4:3, text right. Right (about 1/3): a sticky summary `.card` with “Your plan · {n} dinners”, “{k} things on your list”, “Looks good” (primary), “Add days” and “Ask the table” (quiet). There is no sticky bottom bar on desktop. | `.tonight-hero` for the cooking or selected meal (or the first available), then a three-up grid of the rest. The “Not feeling any of these?” card sits in the grid’s last cell. | Two columns. Left: Still need. Right: the changes banner, Bought, Already have, No longer needed. | Centered dialog, 640px. The swap alternatives show as three columns with 4:3 photos. |
| ≥ 1440 | Same, with the existing wider `--page-max`. | Same. | Same. | Same. | Same. |

**Carry-forward items.** These are not fixed in this cycle. The new screens must not make them worse:

- **QA phone status pill overlap.** On phone, nothing new is placed in the top-right header area or fixed to the top edge. `shopList` headers stick below the app header, not over it.
- **Sticky recipe bar covering tabs.** Plan-meal detail reuses the single existing `.recipe__actions` bar. No new sticky element on `detail`. The Ingredients and Steps tabs must stay reachable when scrolled.
- **Your-pick badge on a phone.** Plan and Tonight cards do not use `.option-card__pick` or the “Your pick” string. “Tonight’s pick” is a normal `.badge` in the badge row, not an overlay on the photo.
- **Desktop Fine-tune whitespace.** No new screen copies the Profile layout. The desktop panes above fill their width.

**Accessibility:**

- Focus moves to the `h1` on every new view.
- Sheets are `<dialog>`s. They trap focus and return it to the opener.
- Chips and the segmented control are radio groups.
- Shopping rows are checkboxes, as in 8.2.
- Badges are text, not color alone. Colors stay theme-token based.
- Check all five themes against `theme-contrast.test.js`.

---

## 14. What Composer must not invent

- **No grocery aisles, store sections, or categories** (Produce, Dairy, Pantry). The contract says recipe metadata has no honest grocery area. Group only by Still need, Bought, Already have, and No longer needed.
- **No pantry, prices, Instacart or store links, or delivery.** Already have is a list mark, not a pantry.
- **No meals outside the 24 returned by the server.** No “Korean-style”, “spicy”, or “swordfish” labels, and no placeholder cards for missing cuisines.
- **No scores, ranks, match percentages, or confidence** in UI, `aria-label`s, or `title` attributes.
- **No evidence lines** beyond section 12.
- **No default dinner count**, no “7” fallback, and no remembered last count.
- **No client-side eligibility or filling.** The client never decides a meal fits. It shows server results.
- **No unpick of Tonight’s pick**, and no begin/exit-cook trick.
- **No plan list endpoint, no new route, and no new API field.** Use the local pointer from section 1.
- **No notifications**, push, email, or badge counts outside the app.
- **No vote requirement**, waiting room, or vote deadline.
- **No cooking order**, “Next up”, or “Day 1 of 7” framing. Position is display order only.
- **No rating** for leftovers or eating out. No ratings from non-participants.
- **No client-side clearing of shopping checks**, and no deleting No longer needed rows.
- **No status text from the API** (`status_label`, enum names) and none of the internal words in section 0.2.
- **No new tab** in the bottom bar.
- **No “Start shopping” mode switch**, and no automatic `start_shopping` on open.

---

## 15. Acceptance checks for the implementation

These are suggested e2e checks in QA mode for the Composer branch. They are not run here.

1. **Count.** “This week” with no chip leaves the CTA disabled. Choosing 5 sends `meal_count: 5`. Repeat for 2 (Next few days) and 4.
2. **Proposal.** A plan of 2, 4, or 5 shows exactly that many slots and one meal each, with no alternatives visible until “Swap” is tapped.
3. **Swap.** One swap changes only that `meal_id`’s recipe. The other meals’ `recipe_version_id`s are unchanged in the response.
4. **Per-meal diners.** Adding a diner with No fish to a salmon dinner shows the 6.3 message, and the meal is unchanged.
5. **Constrained.** A table whose limits exclude everything shows 7.1, and no meal card appears in that slot.
6. **Shopping before start.** A swap re-renders the list with no tags.
7. **Shopping after start.** After one check, a swap shows the banner, “Added” rows, and a No longer needed row that keeps its Bought mark.
8. **Leftovers.** Making a dinner leftovers removes its rows before start (or moves them to No longer needed after start). Its card has no Swap, no recipe, and no rating.
9. **Tonight.** Cooking Dinner 3 first works. Dinner 1 stays under Ready to cook.
10. **Distinct badges.** Tonight’s pick, Cooking now, Ready to rate, Waiting on {names}, and Everyone rated each render with distinct text.
11. **Rate later.** “Rate later”, reload, and Home shows “Waiting on your rating”, then rating completes from there.
12. **Forbidden words.** Scan every new view’s text and `aria-label`s for the words in section 0.2.
13. **Responsive.** Screenshots of `planReview`, Tonight, and `shopList` at 390, 768, and 1280px in Signature and Dark Mode.
