# D-06.1 UX Decision Card: which dinner, how many, and the phone keyboard

Binding UX for Oversight brief D-06.1 §19–24. Composer builds from this, and Grok owns the semantic mapping. Where this card and Grok's D-06.1 semantic architecture disagree on data, the architecture wins and Composer reports the gap. This card adds no runtime code.

Still binding underneath: `docs/D06-UX-DECISION-CARD.md` (the Weave system, motion, tokens) and `docs/FLAVORWEAVE-BRAND.md` (voice, tokens). This card **amends** D-06 §4 (starters), §7.1 (count chip), §10 (the slot-ambiguous row) and §11 (focus and keyboard). Nothing else in D-06 changes: no new surfaces, no docked composer and no new visual language. App-wide Back is D-04 and is out of scope. §2.8 only adds one field to the existing D-06 §13 restore payload.

## 0. Rules

1. **Language interprets; native controls take over.** Once intent is structured, a tap on a day chip, the stepper, a starter or "Never mind" never calls the model. Telemetry proves it (`provider_calls: 0`).
2. **Never guess a slot.** A dinner the person didn't name (by day, date, position or a unique dish) is never picked for them, by the model or by code.
3. **Say only what was used.** Chips and replies name the semantics that changed the result, and nothing else.
4. **No health claims, ever.** We describe direction ("lighter", "veggie-forward"), not outcomes.
5. **Voice:** confident, friendly, a little clever, food-first. Short sentences, no jargon, D-06 §0.4 ban list still applies. `{braces}` are substitutions and “quoted” strings are final copy.

## 1. Decisions at a glance

| # | Decision | Answer |
|---|----------|--------|
| 1 | Ambiguous day | `WeaveChoice` takes the Reply slot in the strip: context line, “Which dinner did you mean?”, then one chip per dinner. |
| 2 | Resolve | A tap applies the held slot directive through `/api/plan/apply`. It is deterministic and only the chosen card transforms. |
| 3 | Plural (“the weekend”) | Chips toggle, and a “Go with these two” button applies. |
| 4 | Cancel | “Never mind” or Escape restores the previous turn locally. Nothing is applied and no request is sent. |
| 5 | Count | The “3 dinners” chip becomes an inline stepper `− 3 dinners +`. It holds the existing dinners, adds or removes one, and makes no model call. |
| 6 | Starters | A static pool, filtered on the client by every active diner's hard limits. The same filter applies to Next and no-results suggestions. |
| 7 | Keyboard | Keep the browser default `resizes-visual`. A `visualViewport` watcher sets `html[data-keyboard="open"]` while a Weave field owns focus. |
| 8 | Tab bar | Hidden (`visibility`, no reflow) while the Weave keyboard is open. It fades back after the keyboard has fully closed. |
| 9 | Follow-up composer | The collapsed pill is the real `<textarea>`. Focus expands it in place, without a re-render, so iOS opens the keyboard on the first tap. |
| 10 | Soft acks | Fixed words per concept, a lead/contrast grammar, and a test-enforced ban on health words. |

---

## 2. “Which dinner did you mean?”

### 2.1 When it appears (plan surfaces only)

Deterministic resolution runs after the model returns a slot op. The model's target is a hint; the code decides.

| Request vs plan | Outcome |
|---|---|
| Named weekday or date matches exactly one dated dinner | Apply. No chooser. |
| “Weekend” and the plan has dated Sat and/or Sun | Apply to those dinners. No chooser. The reply names them (“Saturday and Sunday are now easy ones.”). |
| Any day word (“Tuesday”, “tonight”, “weekend”) on an **undated** plan | Chooser. **Do not** use `fallbackDatesForUndatedPlan` to target. It is a guess the person never saw. |
| Dated plan, named day not in it | Chooser. |
| Dish reference matches more than one dinner (“the pasta night”, with two pastas) | Chooser, listing only the matches. |
| Position named in the text (“dinner 2”, “the last one”) | Apply. The model may only return a `position` target when the text names one. |
| On `planCount` (no dinners exist yet) | Build the plan without the slot directive and hand off to `planReview`. The chooser opens there with the directive held. |

Any change on the create path must leave the D-06 handoff and the plan → recipe → Back restore working (brief §25).

### 2.2 Data the UI needs (indicative; Grok/Composer own the schema)

```json
{
  "acknowledgement": null,
  "changed_positions": [],
  "state": { "...": "...", "pending_slot": { "effort": "easy" } },
  "conflicts": [{
    "code": "slot_ambiguous",
    "reason": "undated | day_absent | weekend_undated | weekend_absent | multiple",
    "asked": "tuesday",
    "multi": false,
    "candidates": [{ "position": 2, "meal_id": "m_…", "label": "Dinner 2", "title": "Cottage pie" }]
  }]
}
```

- `pending_slot` is the validated slot patch (the same fields as `slot_ops`) with no target. It rides in `state`, so it round-trips with no model.
- `label` comes from `planMealLabel` (“Dinner 2”, or “Tue, Oct 13” when dated).
- The preview is unchanged, so no card moves.

### 2.3 Placement and layout

`WeaveChoice` replaces `WeaveReply` in the strip, between the Echo and Understood. The Understood chips stay, Next hides, and the collapsed composer stays visible (typing a new request supersedes the question). There is no tinted box: the question *is* the reply.

```
┌▀▀▀▀▀▀▀▀▀▀▀▀ woven stripe ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀┐
│ “Make Tuesday easier”             Edit  │  Echo
│ Your dinners don’t have days yet.       │  context  (--text-sm, secondary)
│ Which dinner did you mean?              │  question (= .weave-reply type)
│ (Dinner 1  Miso-ginger salmon)          │
│ (Dinner 2  Cottage pie) (Dinner 3  Saag…│  chips, wrap, never scroll sideways
│ Add days   Never mind                   │  quiet actions
│ [− 3 dinners +] [Fish twice ×] …        │  Understood (unchanged)
│ ┌ ≡ Change anything?             (→) ┐  │
└─────────────────────────────────────────┘
```

- **Chip:** the outlined `.chip-tog` look. Inside it, `<strong>{label}</strong>` and then `{title}`, which truncates with an ellipsis (`max-width: 100%`). Min height 44px. Chips are in position order.
- **Actions:** `.btn-quiet.btn-sm`. “Add days” shows only for `undated` and `weekend_undated`. It opens the existing `#planDatesSheet`. On Save, re-run the deterministic resolution with `pending_slot`: one match applies, otherwise the chooser re-renders with dated labels.
- **Plural** (`multi: true`, e.g. “weekend”): chips get `aria-pressed` and nothing is preselected. A primary small button appears after the first pick: “Go with this one” / “Go with these two” / “… three”. It uses number words up to four, then “Go with these {n}”.

### 2.4 Copy

| `reason` | Context line | Question |
|---|---|---|
| `undated` | “Your dinners don’t have days yet.” | “Which dinner did you mean?” |
| `day_absent` | “There’s no {Tuesday} in this plan.” | “Which dinner did you mean?” |
| `weekend_undated` | “Your dinners don’t have days yet.” | “Which ones are the weekend?” |
| `weekend_absent` | “There’s no weekend in this plan.” | “Which dinners did you mean?” |
| `multiple` | “{Two} dinners could be the {pasta} night.” | “Which dinner did you mean?” |

Retire the D-06 strings “Which one should be easier?” and “Which one did you mean?” (`weave-bridge.js` `conflictCopy`). The question never repeats the action, because the Echo already shows it.

### 2.5 Resolve

1. Tap → state `applying`. The tapped chip shows `is-on` and the other chips get `aria-disabled="true"`. There is no `WeaveWorking`. After 400ms the strip accent runs the thread line (D-06 §2.2).
2. `POST /api/plan/apply { state, dinner_plan_id, slot_choice: { positions: [2] } }`. The server builds position-targeted slot ops from `pending_slot`, clears it and runs `executePlanning`. There is no provider call.
3. The client uses the **full** `applyResult` path (`swap_meal` for each `changed_positions`), not `chipOnly`, so the plan is persisted.
4. The chooser leaves (fade 120ms). The Reply is the deterministic refinement line (“Dinner 2’s now Sheet-pan lemon herb chicken, about 25 min.”, or “Dinner 2’s already one of the easiest — no change needed.”). The card transforms (D-06 §8) and focus goes to its title.
5. The new per-slot chip reads “Dinner 2: easy” on an undated plan. `buildPlanningChips` must emit position labels, not only weekday ones.
6. Telemetry: `weave_slot_chosen { reason, multi, positions_count, provider_calls: 0 }`.

### 2.6 Cancel

- Triggers: “Never mind”, Escape while focus is inside the strip, or submitting new text, which clears `pending_slot` before the request.
- “Never mind” and Escape restore the pre-turn snapshot (Echo, Reply, chips, Next, state without `pending_slot`) entirely on the client, and persist it.
- Focus moves to the strip heading (`tabindex="-1"`, `preventScroll`), never to the field, so the keyboard stays down. The live region says “Okay, nothing changed.”

### 2.7 Accessibility

- `<div class="weave-choice" role="group" aria-labelledby="{questionId}">`. The question `<p>` has `tabindex="-1"` and receives focus when the chooser appears (`preventScroll`).
- One live announcement: “{context} {question} {n} choices.” The visible question is not also read as the reply.
- Each chip is a `<button>` with `aria-label="{label}, {full title}"`. Plural chips add `aria-pressed`. Tab order: chips, the apply button, “Add days”, “Never mind”.
- Reduced motion: no fade. Forced colors: chip borders `CanvasText`, and pressed chips get a 2px border.

### 2.8 Restore

Add `choice` (the conflict row) to the D-06 §13 persisted payload. Plan → recipe → Back restores the chooser statically, using the same 30-minute TTL. If `pending_slot` has expired or the plan has changed (different `dinner_plan_id`, or a missing `meal_id`), drop the chooser and show the previous reply.

---

## 3. Count stepper

### 3.1 Placement and anatomy

The `dinner_count` chip in the `planRefine` Understood row becomes a stepper and stays first in the row. The × goes, because a plan always has a count. It shows only when the strip shows Understood chips and `meal_count > 1`. Manual plans and single-dinner mode keep “Change the number of dinners” in the ⋯ menu.

```html
<div class="weave-stepper" role="group" aria-label="Number of dinners">
  <button type="button" class="weave-stepper__btn" data-step="-1" aria-label="One fewer dinner"><svg class="icon"><use href="#i-minus"/></svg></button>
  <output class="weave-stepper__value">3 dinners</output>
  <button type="button" class="weave-stepper__btn" data-step="1" aria-label="One more dinner"><svg class="icon"><use href="#i-plus"/></svg></button>
</div>
```

- The shell is identical to `.weave-chip` (`--color-structure-soft`, 36px, pill). Buttons are 36px visual with a 44px hit area (`::after`, as `.weave-chip__remove`), icons 14px, `--color-text-secondary` → `--color-text` on hover. Add an `#i-minus` symbol to the sprite (one horizontal stroke, matching `#i-plus`).
- `aria-disabled` buttons use `--color-text-tertiary`, stay focusable and stay in place.

### 3.2 Behaviour

- **+**: `POST /api/plan/apply { state, dinner_plan_id, set: { dinner_count: n + 1 } }`. The planner **holds every existing dinner** (`previous_slots`) and fills only the new position while honouring standing rules. Fish twice stays twice, so the new dinner isn't fish if two already are. The client then commits `set_count` + `add_meal` with the preview's `recipe_version_id`.
- **−**: removes the highest-position dinner that is still `planned` and not starred, using `remove_meal` + `set_count`. The deterministic apply then re-checks the standing rules quietly. Only a rule that now fails says anything, using the existing `frequency_unfilled` copy. To remove a specific dinner, people use that card's own options menu.
- **Bounds:** the minimum is `max(1, minAllowedMealCount())`. The maximum is 14, or fewer when nothing more is eligible.
- The Next suggestion “Add a dinner” performs **+**. It must not go through interpretation. Typed requests (“make it four”) still go through language.

### 3.3 Copy

| Event | Reply (≤120) | Live region |
|---|---|---|
| + | “Four dinners now — {Miso-ginger salmon} joins the lineup.” | “4 dinners. Added {title}.” |
| − | “Three dinners now — {Cottage pie} is off the plan.” + inline “Undo” (6s, D-06 §7.1) | “3 dinners. Removed {title}.” |
| + at catalog limit | “That’s every dinner that fits your table right now.” | same |
| + at 14 | “Plans go up to 14 dinners.” | same |
| − blocked by cooked dinners | “Dinners you’ve already cooked stay on the plan.” | same |
| Failure | Notice (error): “Couldn’t change that just now.” · “Try again” | — |

Limit lines are `WeaveNotice` info that clears on the next step. Undo restores the removed `meal_id` through the existing mutation path, with no model call.

### 3.4 Motion and loading

- The number updates **optimistically** on tap. The value cross-fades with a 4px `translateY` over `--duration-fast`.
- **+**: a `.skeleton` card (same height as `.plan-meal-card`) appears at the new position immediately. It is replaced by the real card with `view-in` + the woven stripe (D-06 §8).
- **−**: the removed card fades out over 120ms and its height collapses over `--duration-base`. The cards below simply reflow and don't animate.
- While a step is in flight, both buttons are `aria-disabled` and the group has `aria-busy="true"`. There is no queueing, so a tap during flight does nothing. Past 400ms the strip thread line runs. On failure the number and the skeleton revert.
- Focus stays on the pressed button, so repeated taps work. There is no auto-scroll to the new card: the stripe and the live region carry it.
- Reduced motion: instant value, skeleton swap with no fade, static stripe.

### 3.5 No-AI contract

`weave_count_stepped { from, to, direction, provider_calls: 0, latency_ms }`. A test asserts zero fake-provider calls for **+**, **−**, Undo and “Add a dinner” (brief §37).

### 3.6 Discoverability

The visible − and + are the affordance. Don't add a coachmark, tooltip or pulse. “Add a dinner” in Next teaches the control by animating the stepper value on tap. The `planCount` surface keeps “Or choose how many” as it is.

---

## 4. Household-safe starters

### 4.1 Content principles

1. **Deterministic and local.** A static pool lives in `weave-bridge.js`, filtered by the hard limits of the diners the request will run for (`activeMemberIds()` and their `snap.constraints` rows). There is no request and no model.
2. **Never lead toward a limit.** Hide any starter whose tags touch a diner's limit. Seafood is conservative: a **shellfish** starter hides for `no_shellfish` *or* `no_finfish`, while a **fish** starter hides only for `no_finfish` (the limit tile reads “Salmon, cod, and other finfish”). Never use the word “seafood” in a starter.
3. **Never mention the limit.** No “shellfish-free ideas”. The row just fits.
4. **Hide the redundant.** “Two veggie nights” disappears for a no-meat table.
5. **One of each, four at most.** Each slot (mood, protein-led, lighter, wildcard) takes the first eligible entry in its list. If a slot has nothing eligible, drop it; never repeat a slot.
6. **No day words.** A starter must not lead into the chooser, so “Make Friday special” is retired in favour of “One special night”.
7. **No health words** (§6.2). Labels are at most 24 characters. Plan fills are whole sentences, and Find fills are the label.
8. **Catalog-backed.** A deterministic test asserts that each starter returns at least 3 eligible dinners for every limit set it survives.

### 4.2 Pool

Entries are in fallback order: the first eligible entry wins its slot.

| Slot | Plan | Find |
|---|---|---|
| A · mood or ease | Three easy dinners | Something cozy / Something summery |
| B · protein-led | Fish twice `[finfish]` / Two veggie nights `[redundant: no_meat]` | Easy fish dinner `[finfish]` / Spicy, with tofu |
| C · lighter | Lighter this week | Lighter, veggie-forward / Fresh but filling |
| D · wildcard | One special night / Keep weeknights simple | Garlicky shrimp `[shellfish]` / Bright and lemony |

Plan fills:
- “Three easy dinners” → “Plan three easy dinners this week.”
- “Fish twice” → “Fish twice this week.”
- “Two veggie nights” → “Make two of them vegetarian.”
- “Lighter this week” → “Plan three lighter, veggie-forward dinners.”
- “One special night” → “Make one night something special.”
- “Keep weeknights simple” → “Keep weeknights simple.”

Find fills are the label itself, except “Lighter, veggie-forward” → “Something lighter and veggie-forward”.

Tags map to limit ids: `finfish` → `no_finfish`. `shellfish` → `no_shellfish`, `no_finfish`. Use `meat`, `poultry`, `dairy` and `nuts` if new entries need them, and keep them in sync with `rulesFromLegacyKeys`. Tags never reach the DOM.

### 4.3 Example sets

| Table | Plan | Find |
|---|---|---|
| Clear (no limits) | Three easy dinners · Fish twice · Lighter this week · One special night | Something cozy · Easy fish dinner · Lighter, veggie-forward · Garlicky shrimp |
| Shellfish-free | Three easy dinners · Fish twice · Lighter this week · One special night | Something cozy · Easy fish dinner · Lighter, veggie-forward · Bright and lemony |
| No fish | Three easy dinners · Two veggie nights · Lighter this week · One special night | Something cozy · Spicy, with tofu · Lighter, veggie-forward · Bright and lemony |

### 4.4 Same filter everywhere

`WeaveNext` (the `findRefine` fallback “Try fish”), server `NO_RESULTS_SUGGESTIONS` and `noResultsAcknowledgement` (“Try fish, …”) all pass through the same limit check. On the server, use `dinerLimitIds(participantIds, constraints)`. A no-fish table never sees “Try fish” anywhere.

---

## 5. Mobile keyboard and composer

Targets: iOS Safari 16+ (tab and home-screen PWA) and Chrome Android 108+. The composer stays inline in the strip (D-06 §1.1). Nothing gets docked.

### 5.1 Viewport policy

- Keep `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. **Do not** add `interactive-widget=resizes-content`. It would lift the fixed tab bar and sticky actions above the Android keyboard and reflow `dvh` layouts, and iOS ignores it anyway. Both browsers then share one model: the layout viewport stays put and only `visualViewport` shrinks.
- Older Chrome and WebViews that still resize the layout viewport are covered by the same watcher, because `visualViewport.height` shrinks there too.

### 5.2 Keyboard watcher: `public/keyboard.js` → `window.FlavorWeaveKeyboard`

```js
const vv = window.visualViewport, root = document.documentElement, listeners = new Set();
const OPEN = 150, CLOSE = 80;               // px of lost height; hysteresis absorbs URL-bar moves
let base = 0, width = 0, open = false, t = null;
const EDITABLE = 'textarea, input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=range],[type=file],[type=color])';

function measure() {
  if (!vv || vv.scale > 1.01) return;      // pinch-zoom: keep current state
  if (vv.width !== width) { width = vv.width; base = vv.height; }   // rotation resets the baseline
  base = Math.max(base, vv.height);
  const lost = base - vv.height;
  const el = document.activeElement;
  const focused = !!el?.matches?.(EDITABLE);
  const next = focused && (open ? lost > CLOSE : lost > OPEN);
  const owner = next ? (el.closest('.weave-strip') ? 'weave' : 'other') : '';
  root.dataset.keyboardOwner = owner;
  root.style.setProperty('--kb-inset', next ? lost + 'px' : '0px');
  if (next === open) return;
  open = next;
  root.dataset.keyboard = open ? 'open' : '';
  listeners.forEach((fn) => fn(open));
}
vv?.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(measure, 50); });
document.addEventListener('focusin', measure);
document.addEventListener('focusout', () => setTimeout(measure, 350)); // iOS keyboard slide-down
```

- With no `visualViewport`, fall back to `focusin`/`focusout` on a Weave field with `(pointer: coarse)`.
- API: `isOpen()`, `onChange(fn)`. Load it before `weave-ui.js`. Don't put any per-surface logic in it.

### 5.3 What hides, what stays

| While `data-keyboard-owner="weave"` | Behaviour |
|---|---|
| `.tabbar` | `visibility: hidden; opacity: 0; pointer-events: none`. Keep `.app-main` padding as it is, so there is no reflow. |
| `.sticky-actions` (“Looks good”, “Choose a number”) | Same treatment. This replaces the `btnPlanCountSubmit` focus/blur juggling for the keyboard case, but keep that logic for “field has text”. |
| `.app-header` | Stays sticky. Partly panned off on iOS is acceptable. |
| Composer, submit, starters | Always visible above the keyboard (§5.4). |

Other inputs (onboarding, Taste search, sheets) keep today's behaviour. Generalising it is D-04's call.

On close, both return with `transition: opacity var(--duration-fast)`, and only after the watcher reports closed, so the tab bar never flashes mid-screen during iOS's slide-down. Reduced motion: no transition.

```css
.tabbar, .sticky-actions { transition: opacity var(--duration-fast) var(--ease-standard); }  /* return: fade in */
html[data-keyboard-owner="weave"] .tabbar,
html[data-keyboard-owner="weave"] .sticky-actions {
  visibility: hidden; opacity: 0; pointer-events: none; transition: none;               /* leave: instant */
}
.weave-composer,
.weave-strip { scroll-margin-top: calc(var(--header-h) + env(safe-area-inset-top) + var(--space-3)); }
@media (prefers-reduced-motion: reduce) { .tabbar, .sticky-actions { transition: none; } }
```

### 5.4 Composer position on focus

On a coarse pointer, when the watcher first reports `open` for a Weave field, run `reveal(form)` once. Also run it on `input` whenever autogrow changes the field's height.

```js
// Rects are layout-viewport relative in both engines, hence vv.offsetTop. headerBottom() = .app-header rect bottom.
function reveal(form) {
  const r = form.getBoundingClientRect();
  const top = Math.max(vv.offsetTop, headerBottom()) + 12;
  const bottom = vv.offsetTop + vv.height - 12;
  const starters = form.parentElement.querySelector('.weave-starters');
  const want = Math.min(r.bottom + (starters ? 44 : 0), r.top + (bottom - top));
  let dy = 0;
  if (r.top < top) dy = r.top - top;
  else if (want > bottom) dy = want - bottom;
  if (Math.abs(dy) > 2) { window.scrollBy({ top: dy, behavior: 'auto' }); lastAuto = window.scrollY; }
}
```

- Priority: the field and its 44px submit button must be fully visible, then the first row of starters. Never scroll the composer's top under the header to show more starters.
- Use `behavior: 'auto'`: smooth scrolling fights the iOS keyboard animation. Without `visualViewport`, use `form.scrollIntoView({ block: 'nearest' })`.
- Record `scrollBeforeFocus = window.scrollY` on focus.

### 5.5 Submit and focus after submit

- The submit button stays inside the field's right edge (D-06 §11). It is `flex: none`, and the counter never pushes it out. At 320px the field must still be at least 120px wide; check this in the 390px and 320px e2e runs.
- On Enter/Go, or a submit tap: `field.blur()` first (as today). When the watcher reports closed, or after 400ms, if the strip's top is not inside the visual viewport, `strip.scrollIntoView({ block: 'start' })` with the scroll margin. That makes the Echo and working state visible. Don't restore `scrollBeforeFocus` after a submit.
- Every programmatic focus after settle uses `focus({ preventScroll: true })`, and the adapter decides any scroll:

| Adapter | Focus after settle | Scroll |
|---|---|---|
| `plan` → `planReview` | strip heading | new view, top |
| `planRefine`, card changed | changed card title | `scrollIntoView({ block: 'nearest' })` (existing `focusPlanMeal`) |
| `planRefine`, chooser shown | chooser question | none |
| `planRefine`, no change / stepper | stays put (strip / stepper button) | none |
| `find` / `findRefine` | results header | only if the header is below the fold: bring it to just under the strip |
| error (coarse pointer) | notice | none, and the keyboard stays down |

### 5.6 Scroll restoration

- **Dismiss without submit** (Done, a tap outside, Android back closing the keyboard): if `|scrollY − lastAuto| ≤ 2`, so the person didn't scroll, restore `scrollBeforeFocus`. Otherwise leave the scroll where it is.
- **iOS offset after the keyboard closes:** 150ms after close, if `vv.offsetTop > 0`, call `window.scrollTo(window.scrollX, window.scrollY)` to re-sync the layout viewport.
- Recipe → Back keeps D-07 §9.3 / D-06 §13 restoration as it is. Keyboard code never writes `history` and never stores a scroll position.

### 5.7 The follow-up composer

- The collapsed pill is already the real `<textarea>`. **Don't re-render on expand.** On `focus`, remove `.weave-composer--collapsed`, set state `composing` and hide Next, all in place. The current `expand()` → `render()` → `focus()` path swaps the element under the finger and can drop or flicker the iOS keyboard. Remove the click-to-expand re-render.
- On `blur` with an empty field, add `--collapsed` back after the watcher reports closed, so the pill doesn't shrink under the keyboard animation.
- Any programmatic focus that should open the keyboard (Echo “Edit”, an error's “Edit”) must run synchronously inside the tap handler, with no `setTimeout` or `requestAnimationFrame`, or iOS won't show the keyboard.
- Escape behaviour is unchanged from D-06 §12.

### 5.8 Safe areas

- The tab bar and sticky actions already add `env(safe-area-inset-bottom)`. Leave them alone.
- For landscape on notched iPhones, set `.page { padding-inline: max(var(--page-pad), env(safe-area-inset-left)) max(var(--page-pad), env(safe-area-inset-right)); }` so the strip never sits under the sensor housing.
- With the keyboard open, nothing is pinned to the bottom, so `--kb-inset` is only exposed for toasts: `html[data-keyboard="open"] .toast { bottom: calc(var(--kb-inset) + var(--space-4)); }`.

### 5.9 Browser notes

| | iOS Safari / PWA | Chrome Android |
|---|---|---|
| Keyboard opens | Visual viewport shrinks and may pan (`offsetTop > 0`), while fixed elements stay on the layout viewport | Visual viewport shrinks from the bottom (`offsetTop` ≈ 0) |
| Risk without this card | Tab bar floats mid-screen while scrolling, the page stays offset after close, and the first tap on the pill may not raise the keyboard | Tab bar and “Looks good” cover the starters on WebViews that resize the layout |
| Verify on device | iPhone SE (small), 15 Pro (Dynamic Island, landscape), home-screen PWA | Pixel 7 Chrome, Samsung Internet |

The e2e run covers 390×844 and 320×640 with an emulated `visualViewport` resize, asserting that the tab bar is hidden, the submit button is in view, and the tab bar is visible again after blur.

---

## 6. Acknowledgement copy for soft semantics

### 6.1 Rules

1. **Server-composed and deterministic** (`src/weave/ack.js`). One sentence of at most 120 characters, plus at most one short “Still …” or “Add …” sentence. The model's sentence is kept only under D-06 rules, **and** only if it passes §6.2 and names no concept outside the executed chips.
2. **Hard items are nouns, soft cues are feel.** Name ingredients, proteins and exclusions plainly (“with salmon”, “no mushrooms”, “nothing fried”). Describe soft cues as direction (“lighter”, “cozy”). Reserve “all” and “only” for hard constraints (“all under 30 min”).
3. **Fit order when space runs out:** hard items and exclusions, then flavors, then soft cues, then ease. Never drop a hard item or an applied flavor to fit a soft cue. Every applied flavor (spicy, smoky, lemony, garlicky…) appears in the reply. This fixes the D-06 gap where reconciled replies lost them.
4. **Lead and contrast.** Lead cues (`light`, `vegetable_forward`, `fresh`) go before the noun. A contrast cue that pulls the other way becomes a fixed tail: `filling` → “that still fill you up”, `hearty` → “that still feel hearty”, `cozy` → “that still feel cozy”, `comforting` → “that still feel comforting”, `indulgent` → “with a little indulgence”. The order of the person's words doesn't matter.
5. **At most two adjectives before “dinners” or “ideas”.** Further *derived* cues become “, leaning {veggie-forward}”.
6. **Unknown words are dropped silently.** They never get a chip, a quote or an apology. If *nothing* was understood, say: “Here are a few strong picks for your table. Add a flavor or an ingredient to narrow it down.”

### 6.2 Never say (acks, chips, starters, Next, notices; the Echo is exempt)

healthy/healthier/health, nutritious, nutrition, balanced, clean, wholesome, guilt-free, good for you, lean, light on calories, calorie(s), low-fat/carb/cal, superfood, detox, diet-friendly, and any body or medical claim. Add this to `test/d06-ux-copy.test.js`:

```js
const HEALTH = /\b(health(y|ier|iest)?|nutri\w*|balanced|clean|wholesome|guilt[- ]free|good for you|lean|calori\w*|low[- ](fat|carb|cal)\w*|superfood|detox|diet[- ]friendly)\b/i;
```

Drop `\bweeknight\b` from the `NOTATION` regex, because §6.4 now uses it on purpose.

### 6.3 Concept words (fixed; one label per concept)

| Concept | Chip | In a reply |
|---|---|---|
| `light` | Lighter | lighter |
| `vegetable_forward` | Veggie-forward | veggie-forward |
| `fish_forward` | More fish | with more fish |
| fried-method avoidance | Nothing fried | nothing fried |
| `fresh` / `summery` / `cozy` / `comforting` / `hearty` / `filling` | Fresh / Summery / Cozy / Comforting / Hearty / Filling | same, lowercase (contrast tails per §6.1) |
| `indulgent` | A little indulgent | a little indulgent |
| `restaurant_like` | Restaurant-style | restaurant-style |
| `adventurous` | Something different | a little different (plan: “one a little different”) |
| `special` | Something special (plan, unplaced: One special night; slot: Fri: special) | see §6.5 |
| `weeknight` (soft) | Weeknight-friendly | weeknight (next to the noun) |
| Find `criteria.quick` (≤30, hard) | Quick | quick |
| Plan `max_minutes` (hard) | Under {n} min | all under {n} min |

There is never a “Healthy” chip. A canonical concept with no row here gets no chip and no reply word, and a test asserts that every canonical concept has a row. That means adding a concept requires adding its words.

### 6.4 Chips show only what was used

A chip renders only when its concept is in the **executed** state, its support status is recognized or derived, and it actually shaped the result (as a preference, boost, exclusion or filter). There is no chip for any of these:
- unsupported-soft terms
- model concepts outside the vocabulary
- items removed by a hard limit
- concepts dropped by broadening
- derived concepts the catalog couldn't apply

Removing a chip re-composes the reply deterministically. Derived chips (“Lighter”, “Veggie-forward” from “healthy”) remove individually.

### 6.5 Quick vs weeknight, and special/steak

**Quick vs weeknight**
- “Quick” and “quick” only appear when a real clock filter ran: Find `criteria.quick`. Plans say “all under {n} min” and never “quick”.
- The soft `weeknight` cue uses the chip “Weeknight-friendly”, and replies use “weeknight” next to the noun: “three easy weeknight dinners”. In portion form it reads “one weeknight-friendly”. Change `CUE_LABELS.weeknight` and `CUE_ADJECTIVES.weeknight` accordingly.
- If the person typed “quick” but only the soft cue ran, the reply says “weeknight”, because it describes what was used.

**Special**
- **Find:** always the tail “that feel a little special”. Never “Something a little special with steak.”
- **Plan:**
  - unplaced: “plus one special night”
  - dated slot: “and {Friday}’s something special”
  - Never stack two “with” clauses, and never name a day the plan doesn't have.
- **Hard-limit conflict that leaves special standing:**
  - Find: “{Steak} doesn’t work for everyone at your table, so here are some special dinners without it.”
  - Plan with a dated slot: “… so {Friday}’s still special, just without it.”
  - Plan, unplaced: “… so we left it out — still one special night.”
  - This retires the stilted “Something special is still on.”
- “Special but easy”: “Here are some easy ideas that feel a little special.”

### 6.6 Templates and examples

- **Find, soft only:** “Here are some {adj}{, adj} ideas{tail}.”
- **Find, with one hard item:** “Here are some {adj} {item} dinners{tail}.”
- **Find, with two or more items:** “… dinners with {a} and {b}.”
- **Find, exclusions:** “ — {no x}”.
- **Plan:** the D-06 head “Got it — {n} {adj} dinners” plus clauses in the §6.1 rule 3 order.

| Request (table) | Chips | Reply |
|---|---|---|
| something healthy | Lighter · Veggie-forward | “Here are some lighter, veggie-forward ideas.” |
| healthy but filling | Lighter · Veggie-forward · Filling | “Here are some lighter, veggie-forward ideas that still fill you up.” |
| cozy but not heavy | Cozy · Lighter | “Here are some lighter ideas that still feel cozy.” |
| nothing fried | Nothing fried | “Got it — nothing fried.” |
| crispy but not deep fried | Crispy · Nothing fried | “Here are some crispy ideas — nothing fried.” |
| smoky salmon, light | Lighter · Salmon · Smoky | “Here are some lighter, smoky salmon dinners.” |
| something healthy with shrimp (shellfish limit) | Lighter · Fish | “Shellfish doesn’t work for everyone at your table, so here are some lighter fish ideas.” |
| steak, something special | Steak · Something special | “Here are some steak dinners that feel a little special.” |
| something glimmery | — | “Here are a few strong picks for your table. Add a flavor or an ingredient to narrow it down.” |
| three healthy weeknight dinners | 3 dinners · Lighter · Veggie-forward · Weeknight-friendly | “Got it — three lighter weeknight dinners, leaning veggie-forward.” |
| three healthy dinners, fish twice | 3 dinners · Lighter · Veggie-forward · Fish twice | “Got it — three lighter dinners, fish twice, leaning veggie-forward.” |
| four dinners, steak once, one special | 4 dinners · Steak once · One special night | “Got it — four dinners, steak once, plus one special night.” |
| a quick one plus two filling dinners | 3 dinners · Weeknight-friendly · Filling | “Got it — three dinners: one weeknight-friendly and two filling.” |

The chip column shows the mapping Grok's layer is assumed to produce. If the mapping differs, the reply follows the chips, not this table.

---

## 7. Acceptance checks (UX)

1. On an undated three-dinner plan, “Make Tuesday easier” shows the chooser, changes no card, and creates no slot. A tap on “Dinner 2” changes exactly that card, makes zero provider calls, and focus lands on its title.
2. “Make the weekend easier” changes Sat and Sun directly on a dated plan, and shows “Which ones are the weekend?” on an undated plan. Applying two picks transforms two cards and nothing else.
3. “Never mind” and Escape send no request and restore the previous reply and chips. recipe → Back restores an open chooser statically.
4. + on a plan with fish twice adds one non-fish dinner and leaves every other card untouched. − removes the last planned, unstarred dinner, and Undo restores it. All steps make zero provider calls.
5. A no-fish table never sees “Fish twice”, “Easy fish dinner”, “Garlicky shrimp” or “Try fish”, in starters, Next or no-results.
6. At 390×844 and 320×640 with the keyboard open, the field and submit button are visible, the first starter row is visible on `plan`/`find`, and the tab bar and sticky actions are hidden. After blur they return with no layout shift.
7. A single tap on the collapsed “Change anything?” pill raises the iOS keyboard (device check), and the textarea element is the same node before and after.
8. Submitting with the keyboard open leaves the Echo and “Weaving that together…” in view.
9. No consumer string matches `HEALTH`. “Quick” appears only with a clock filter, and every applied flavor appears in its reply.
10. Typing reveal, chips, card transforms, the branded composer and D-06 Back restore are unchanged (brief §24, §25).
