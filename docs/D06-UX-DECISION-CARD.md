# D-06 UX Decision Card: the Weave

Binding UX for conversational planning and natural-language Find. Composer builds from this; Grok owns schemas, routing and state. Where this card and the D-06 architecture contract disagree on data, the contract wins and Composer reports the gap. This card adds no runtime code.

Still binding underneath: `docs/D07-UX.md` (Find surface, chips, history), `docs/CYCLE3-UX.md` (plans, swap sheet), `docs/D03-D01-RELEASE.md` (Keep it easy / Keep ingredients simple), `docs/FLAVORWEAVE-BRAND.md` (tokens, voice).

## 0. Rules

1. **One system, four contexts.** Every piece below is shared code (`public/weave-ui.js`, classes prefixed `.weave-`). Contexts differ only through an adapter (§2.3). No per-screen widgets.
2. **The product is the answer.** Language takes at most two short lines on screen (the person's request and one reply sentence). Dinner cards, chips and shelves carry the result.
3. **Not a chat.** No bubbles, avatars, transcript, left/right alignment or "typing…" dots. Text sits on the page like any other copy.
4. **Never on screen:** AI, assistant, chat, bot, GPT, Luna, model, prompt, token, quota, budget, rate limit, generate, magic. No sparkle, wand, robot or brain icons. No purple or multi-stop gradients.
5. **Voice:** warm, short, factual. Prefer no pronoun ("Got it — …"). When one is needed, use "we". Typographic `’` and `—`. `{braces}` are substitutions. Strings in “quotes” are final copy.
6. **Nothing invented.** The reply only restates what was understood. It never promises taste ("you’ll love…") or explains eligibility. Conflict lines come from deterministic codes (§9).
7. **No paid call for anything already structured.** Chip edits, starter fills, conflict choices and deterministic suggestions run locally or through the planner/Discovery engine directly.

## 1. Decisions at a glance

| # | Decision | Answer |
|---|----------|--------|
| 1 | Placement | Top of the page head, inline in a single **Weave strip**. Never bottom-docked or floating. |
| 2 | Plan entry | `planCount` leads with the composer. The count picker stays below it as “Or choose how many”. |
| 3 | Find entry | The D-07 search field *becomes* the composer. One field, not two. |
| 4 | Refinement | `planReview` and Find results show the same strip with a collapsed composer. |
| 5 | Working state | The composer’s woven mark expands and its three strands interlace. The label reads “Weaving that together…”. No spinner. |
| 6 | Reply reveal | Word-by-word reveal starts when the validated response arrives. It runs in parallel with the results, takes at most 900ms, and is announced once. |
| 7 | Understood | Editable/removable chips. Edits are deterministic and never call the model. |
| 8 | Transition | Plan: cards keyed by `meal_id`, and only changed cards transform. Find: the results replace shelves, and new applied chips pop. |
| 9 | Suggestions | Two to four, state-aware, in one wrapped row. A tap submits. |
| 10 | Failure | The text is kept. The manual controls are always one tap away. The copy never names the system. |
| 11 | Back | Restores the strip statically from history state. No re-reveal, no working state, no call. |

## 2. The Weave system

### 2.1 Components

| Component | Role | Markup root |
|-----------|------|-------------|
| `WeaveStrip` | Container that lays out everything below in one card at the top of the page head. Owns `aria-busy` and the live region. | `<section class="weave-strip weave-accent" aria-label="{adapter.regionLabel}">` |
| `WeaveComposer` | Woven mark, autogrowing field, submit button. Expanded or collapsed. | `<form class="weave-composer" role="search"\|none>` |
| `WeaveStarters` | Seed chips under an empty, focused composer. A tap fills the field and does not submit. | `<div class="weave-starters" role="group" aria-label="Ideas">` |
| `WeaveWorking` | The branded working state in place of the composer. | `<div class="weave-working">` |
| `WeaveEcho` | The person’s latest request, one line, quiet, with “Edit”. | `<p class="weave-echo">` |
| `WeaveReply` | The validated reply sentence, with visual reveal. | `<p class="weave-reply" aria-hidden="true">` + sr-only status (§11) |
| `WeaveUnderstood` | Intent chips. Removable, some editable. | `<ul class="weave-understood" aria-label="What we understood">` |
| `WeaveNext` | Two to four follow-up suggestions. | `<div class="weave-next" role="group" aria-label="Try next">` |
| `WeaveNotice` | Conflict, error and fallback line, with optional actions. | `<div class="weave-notice" role="status"\|"alert">` |
| `WeaveController` | State machine + adapter + history persistence. No DOM of its own. | `FlavorWeaveWeave.create(adapter)` |

### 2.2 Controller states

```
idle ──focus──▶ composing ──submit──▶ working ──response──▶ revealing ──≤900ms──▶ settled
  ▲                 │  ▲                 │  │                                       │
  └──── blur/empty ─┘  └──cancel/Back────┘  ├─conflict─▶ settled + WeaveNotice(info) │
                                            ├─error────▶ composing + WeaveNotice(alert)
                                            └─unavailable▶ fallback (manual mode)   │
settled ──type in collapsed composer──▶ composing (refine adapter) ◀────────────────┘
settled ──chip edit / conflict choice / deterministic suggestion──▶ applying ──▶ settled
```

- `applying` uses the deterministic path. Show no `WeaveWorking`; changed cards use the §7 transform. If it takes over 400ms, the strip’s top accent runs the thread line (§5).
- `fallback` lasts for this tab session: the composer hides in Plan and becomes plain search in Find.
- Cancel (`AbortController`) returns to `composing` with the text kept and nothing applied.

### 2.3 Context adapters

| | `plan` | `planRefine` | `find` | `findRefine` |
|---|---|---|---|---|
| Lives on | `planCount` | `planReview` | `find` first open (no query) | `find` with NL results |
| Field label (sr) | “Describe your dinners” | “Change your plan” | “Search or describe a dinner” | “Refine these dinners” |
| Placeholder | “What should dinner look like this week?” | “Change anything?” | “What sounds good?” | “Refine these…” |
| `enterkeyhint` | `go` | `go` | `search` | `search` |
| Default state | expanded | collapsed | expanded | collapsed |
| Above the field | — | Echo + Reply + Understood | — | Echo + Reply |
| Below the field | Starters | Next | Starters | Next |
| Understood host | — | in strip | the D-07 `.disc-chips` row (§6.2) | the D-07 `.disc-chips` row |
| Task | `planning_intent` | `planning_intent` delta | bypass or `discovery_intent` | `discovery_intent` delta |
| Result target | `#planMealCards` (after `show("planReview")`) | changed `.plan-meal-card`s | `#findRoot` results | `#findRoot` results |
| Focus after settle | strip heading | first changed card title | results header | results header |
| History key | `dinner_plan_id` | `dinner_plan_id` | canonical `/find` URL | canonical `/find` URL |

Composer adds no other contexts in D-06. Future features register a new adapter. They must not add a new widget.

## 3. Placement and entry points

**Planning**
- Entry points stay as they are: Home “Plan a few nights”, Tonight “Plan a few dinners”, and plan “Start over”. All of them land on `planCount`.
- `planCount` header copy:
  - eyebrow “Plan our dinners”
  - title “Plan your dinners”
  - lede “Tell us what the week needs, or choose how many below.”
- Order on the page: the `WeaveStrip` (expanded `plan` composer and starters), then a divider label “Or choose how many”, then the existing `#planCountOptions` and `#planCountPrefs`.
- The sticky “Choose a number” button hides while the composer has focus or text. It returns when the field is empty and blurred.
- On `planReview` the strip sits between the lede and `#planMealCards`. It replaces `#planReviewPrefs` (§6.1) and appears whether the plan came from language or from the count picker. A manual plan shows only the collapsed composer and Next.
- Single-dinner mode (`meal_count === 1`) uses the same strip with placeholder “Change anything?”.

**Find**
- The `#discSearch` field is replaced by `WeaveComposer` in the `find` context, in the same place.
- While the person types, results update live through D-07 only when the router classifies the text as a simple term (e.g. “salmon”, “Korean”). When the text reads as natural language, live results hold their current state and the submit button lights. Interpretation runs only on explicit submit, never per keystroke.
- A bypass submit shows D-07 skeletons with no `WeaveWorking`, no Echo and no Reply. The same field still looks identical, so the person never sees which path ran.
- Starters show only on first open (no query), between the field and the first shelf.
- Tonight gains no composer of its own. In the “Not feeling any of these?” card, add a composer-styled button “What sounds good tonight?” above “See all dinners”. It opens `/find` with the `find` composer focused.
- Plan modes (`replace_plan_meal`, `choose_for_plan`) use the same composer with the `find` adapter. The D-07 eyebrow and CTAs are unchanged.

## 4. Copy

**Starters.** A tap fills the full sentence, places the caret at the end and keeps focus.

| Context | Chip label → fills |
|---|---|
| plan | “Three easy dinners” → “Plan three easy dinners this week.” · “Fish twice” → “Fish twice this week.” · “Keep weeknights simple” → “Keep weeknights simple.” · “Make Friday special” → “Make Friday something special.” |
| find | “Something cozy” · “Easy fish dinner” · “Fresh but filling” · “Spicy, with tofu” (each fills itself) |

Hide any starter that the household’s hard limits make impossible. For example, a no-fish table never sees fish starters. Replace it with “Something summery” or “Not too heavy”, and show at most four.

**Reply examples.** The reply comes from the validated response and is one sentence of at most 120 characters. The client never edits it.
- “Got it — three dinners, mostly easy, fish twice, with something special for Friday.”
- “Tuesday’s now an easy one.”
- “Something cozy that isn’t too heavy — here’s what fits.”
- “Fresh and easy, with fish.”

**Fixed strings**
- Working: “Weaving that together…”. After 3s: “Still weaving — nearly there.”. Cancel link: “Cancel”.
- Echo: `“{request}”` · Edit link: “Edit”.
- Strip heading (sr-only on phone, visible ≥768px): plan “Your request” · find “Looking for”.
- Plan divider: “Or choose how many”.
- Chip undo: “Removed {chip}.” with “Undo” (§6).

## 5. Working state and motion

**The mark.** At rest, the composer’s left edge shows three short strands, 20×14px, in `--weave-1`, `--weave-2` and `--weave-3`, stacked 4px apart. It is a static, decorative brand cue (`aria-hidden`) and is not a button.

**On submit** (t = 0, before any network):
1. The field text moves into the Echo line, the field collapses, and the keyboard dismisses.
2. The mark grows to 44×28px, the size of the existing `.weave-loader__strands`, over `--duration-base` with `--ease-emphasized`. The strands start the existing `weave` keyframe on a 1.2s loop, offset 0, 150 and 300ms, with the middle strand reversed. This is the same grammar as “Weaving your plan…”, so the brand stays continuous.
3. Under the strip, a 2px thread line (the three weave colours in thirds) travels left to right on a 1.6s loop.
4. The result region gets `aria-busy="true"`. Existing cards stay in place, dimmed to `opacity: .55`, with no skeletons and no blank screen.

**On settle**
- The strands stop and collapse upward into the strip’s 4px `.weave-accent` top stripe (translateY plus fade, 240ms). The thread line fades out. The woven stripe becomes the strip’s resting accent.

**Limits**
- One animated element at a time.
- No pulsing glow, no particles, no colour cycling.
- Total motion budget per interaction is at most 1.5s once results arrive.
- This amends the brand note “weave loader reserved for building a plan”: interpretation in Plan and Find may use it. Deterministic Find keeps skeletons.

## 6. Reply reveal

- **Starts** when the full validated response, interpretation and deterministic result together, has arrived. A reply is therefore never shown and then contradicted.
- **Cadence:** reveal word by word. Each word fades in over 80ms, with a 45ms step between words. Long replies compress the step so the whole reveal takes at most 900ms. There is no caret and no cursor glyph.
- **Never a gate.** Results, chips and Next render at reveal start and are interactive immediately. Any tap, scroll or keypress completes the reveal instantly.
- **Reduced motion:** the full sentence appears at once with a 120ms fade.
- **Restore** (Back, refresh, re-render) is always static.

## 7. Understood chips (`WeaveUnderstood`)

### 7.1 Plan (in the strip)

- Order: count, global prefs, frequency and composition, per-slot directives, then mood.
- Labels:
  - Count: “3 dinners”
  - Global prefs: “Keep it easy”, “Keep ingredients simple”
  - Frequency and composition: “Fish twice”, “Pasta once at most”, “No pasta”, “One a little different”
  - Per-slot: “Tue: easy”, “Fri: special” (from `planMealLabel`; undated plans read “Dinner 2: easy”)
  - Mood: “Not too heavy”, “Cozy”
- “Keep it easy” and “Keep ingredients simple” *are* the D-01 toggles. When the strip shows, it absorbs `#planReviewPrefs`. Both toggles always render at the end of the row, filled when on and outlined when off (same `data-plan-pref` and `togglePref`). Never render them twice.
- Every applied chip is a filled pill with a separate × button (`aria-label="Remove {chip}"`, 44px hit area).
- Count and frequency chips are also editable: tapping the label opens a stepper sheet (“How many dinners?” / “How many fish dinners?”) built from the existing count sheet. Other chips are remove-only.
- Removing or editing a chip re-runs the deterministic planner on the current structured state. There is no model call. The planner holds unaffected dinners where it can, and changed cards transform as in §8.
- After a removal, the chip’s slot shows “Removed {chip}. Undo” for 6s. Undo restores the prior state locally.

### 7.2 Find (in the D-07 chip row)

- There is one chip row. Interpreted criteria appear as normal D-07 applied chips (“Easy”, “Under 30 min”, “Fish & seafood”, cuisines).
- Mood cues with no D-07 control (“Cozy”, “Fresh”, “Not too heavy”, “Restaurant-style”, “Summery”) go at the start of the row as applied chips with the 3-strand mini mark. They remove the same way.
- Chips that are new in this turn pop in with the existing `pop` keyframe, staggered 40ms.
- “Clear all” resets to the `find` context and clears the Echo and Reply.

## 8. Native-result transition

**Initial plan** (`planCount` → `planReview`)
- `show("planReview")` as today. The strip arrives already settled with the Echo, starts the Reply, and dinner cards enter with `view-in`, staggered 60ms (at most 7 cards, 420ms in total).
- “Looks good” is usable at once.

**Plan refine and slot-specific transforms**
- Cards are keyed by `meal_id`. Unchanged cards are not re-rendered and must not move, flash or reflow. “Make Tuesday easier” touches only Tuesday’s card.
- A changed card:
  1. Its content fades out over 120ms.
  2. The new photo, title and meta fade in over 200ms.
  3. A 4px woven stripe draws across its top (`scaleX` 0→1 from the left, 360ms) and fades after 3s.
- A meta-only change, such as the same dinner gaining a different side, still gets the stripe. A preference change that alters no dinner keeps all cards still, and the reply says so (“Tuesday was already an easy one.”).
- Focus moves to the first changed card’s title, which scrolls it into view (smooth unless reduced motion). If the change added or removed a dinner, focus moves to the strip instead.
- Weekday targeting:
  - A named day that matches a dated slot applies to that slot.
  - On an undated plan, or a day that isn’t in the plan, show the conflict choice in §9 instead of guessing.

**Find**
- The first NL submit cross-fades the shelves out and the D-07 results layout in (hero, then grid), with cards staggered 40ms.
- A refine cross-fades the result grid over 200ms. A card that stays in the results keeps its element, so its image doesn’t reload.
- Focus moves to the results header (“{n} dinners”).

## 9. Follow-up suggestions (`WeaveNext`)

- Show two to four, in one row that wraps to at most two lines on phone. Never scroll it horizontally.
- Show them only in `settled`. Hide them in `working` and while the composer has text.
- A tap is a submit. Suggestions that map to structured ops apply deterministically, and the rest go through interpretation.
- Rules decide which suggestions show. Each is suppressed when it’s already true or impossible:

| Context | Candidates (pick by state) |
|---|---|
| planRefine | “Make one more adventurous” (none marked different) · “Keep everything under 30 min” · “Change {weekday or Dinner n}” (the hardest slot) · “Add another dinner” (count < max) · “No pasta this week” (pasta present) |
| findRefine | “Make it easier” (not Easy) · “Something spicier” · “Try fish” (fish eligible, not applied) · “More Mediterranean” · “Surprise me” |

## 10. Conflict, error, retry and fallback

**Conflict.** `WeaveNotice`, `role="status"`, info style (§13). The text comes from a deterministic code. The reply sentence is replaced, never shown alongside.

| Code (indicative) | Copy | Actions |
|---|---|---|
| hard restriction on a requested item | “Shrimp doesn’t work for everyone at your table, so here’s another seafood dinner.” | none; the result shows the valid alternative |
| not enough eligible | “Only two fish dinners work for your table, so the third is something else.” | — |
| slot ambiguous or absent | “Your dinners don’t have days yet. Which one should be easier?” / “There’s no Tuesday in this plan. Which one?” | slot chips: “{Dinner 1}” “{Dinner 2}” …. A tap applies the delta deterministically. |
| contradictory | “Fish twice and no fish can’t both happen. Which one?” | “Fish twice” · “No fish” |
| count over max | “Plans go up to {max} dinners, so here are {max}.” | — |
| Find, zero results | D-07 §11 empty states, unchanged | D-07 “Remove …” chips |

- Never name the restricted person or ingredient source.
- Never relax a hard limit.
- Never leave an empty plan. If nothing fits, keep the previous plan and say “Nothing fits that for your table, so your plan is unchanged.”

**Errors.** `WeaveNotice role="alert"`. Back in `composing`, the field is re-expanded with the person’s text intact.

| Situation | Copy | Actions |
|---|---|---|
| Not understood, or unusable result | “Couldn’t quite make sense of that. Try saying it another way, or use the options below.” | “Edit” (focus the field) |
| Slow or failed (timeout, outage, cut-off) | “That took longer than it should.” | “Try again” · “Use the options below” |
| Second consecutive failure | “That’s not working right now. The options below still work.” | — (Try again hidden) |
| Offline | “You’re offline. Your words are saved here — try again when you’re back.” | “Try again” |
| Unavailable (rate or daily limit) → `fallback` | Plan: “Typing a request isn’t available right now. Choose how many below.” · Find: no message; the field acts as plain search and runs the text through D-07 with the line “Showing dinners that match your words.” | — |

- At 8s of working, add “Taking longer than usual.” under the label. At 12s, abort and show the slow copy.
- Retry is capped at one automatic attempt (the “Try again” tap). After that, the second-failure copy shows.
- “Use the options below” scrolls to and focuses the count picker in Plan, or the chip row in Find.

## 11. Mobile-first behaviour (360–430px)

**Field**
- `<textarea rows="1">` that autogrows to four lines, then scrolls internally.
- Font size `--text-base` (16px, which prevents iOS zoom). Min height `--control-h`.
- `maxlength="280"`. A counter shows from 240 characters (“{n} left”).
- `autocapitalize="sentences"`, `spellcheck="true"`, `autocomplete="off"`.

**Submit**
- 44px coral circle inside the field’s right edge, with the existing `#i-arrow-right` icon and `aria-label="Go"` (plan) or “Search” (find).
- Disabled-looking when empty, but still focusable.
- Enter submits and never inserts a newline. On a hardware keyboard, Shift+Enter inserts a newline.

**Focus and keyboard**
- On focus, scroll the strip to the top of the visual viewport (offset `--space-4`) so the starters stay visible above the keyboard.
- While `visualViewport.height` is more than 150px below the window height, hide `.tabbar` and the page’s `.sticky-actions`.
- On submit, call `blur()` first so the keyboard closes and the working state is visible.
- In collapsed refine contexts, a tap on the collapsed composer (the placeholder pill) expands it and focuses it.
- Swiping the page while composing doesn’t dismiss the text.

**Scroll**
- Never auto-scroll during reveal. The only scroll is the refine focus move in §8.
- After an error, focus the notice (`tabindex="-1"`) rather than the field, so the keyboard doesn’t jump back up. Desktop focuses the field.

**Layout from 768px:** the strip is a card capped at `--page-max`. The composer is limited to 640px wide, and Next sits to the right of Understood when it fits.

## 12. Accessibility

- **Labels:** the field has a visible-on-focus label via `<label class="sr-only">` (per-adapter text in §2.3). The submit button has a text label, not just an icon.
- **One announcement per turn.** A single sr-only `role="status" aria-live="polite" aria-atomic="true"` in the strip receives, once at reveal start:
  - Plan: “{reply} {n} dinners ready.”
  - Plan refine: “{reply} {slot} changed to {title}.”
  - Find: “{reply} {n} dinners.”
- The visible `WeaveReply` stays `aria-hidden="true"` during and after the reveal, so screen readers never hear it character by character or twice.
- Working: the status receives “Weaving that together…” once at submit. The result region carries `aria-busy`. Errors use `role="alert"`.
- **Keyboard:** Tab order is Echo “Edit”, Understood chips (label, then ×), Next, then results. Escape in a focused composer clears the text the first time and collapses the composer the second. In `working`, Escape cancels.
- **Nothing conveyed by motion alone.** Changed cards also get a visually-hidden “Changed” prefix on the title for 1 turn, and the status names the slot.
- **Reduced motion:** strands static, no thread line, reply instant, no stagger, the stripe appears static for 3s, `scroll-behavior: auto`. The existing global `prefers-reduced-motion` block covers the keyframes. Composer still gates reveal JS on `matchMedia`.
- **Forced colors:** strands and stripe use `CanvasText`, and chips keep borders.
- **Contrast:** all pairs from existing tokens already enforced by `test/theme-contrast.test.js`. Add `.weave-*` pairs to it.

## 13. Back-navigation restoration

- **Persist:** at `settled`, write `history.state.weave = { adapter, echo, reply, understood, next, stateRef }` with `replaceState`. Mirror it to `sessionStorage` keyed by the §2.3 history key, with a 30-minute life.
  - A Find refine is a `replaceState`, following the D-07 rule.
  - The first NL submit on Find, and `planCount` → `planReview`, each use `pushState`.
- **Plan → recipe → Back:** `planReview` re-renders from plan state. The strip restores statically: Echo, Reply text with no reveal, chips and Next. The scroll position and the focused card follow D-07 §9.3. If the cache is missing, show the collapsed composer only. Never show an empty strip.
- **Find NL → recipe → Back:** the URL rebuilds the D-07 criteria and the mood cues (the architecture adds a cue parameter, e.g. `cue=cozy`). Refresh therefore restores results with no model call. Echo and Reply come from the cache when present.
- **Unsent drafts** survive recipe → Back for the same history key.
- **Leaving mid-request** (Back during `working`) aborts the request, applies nothing and keeps the text as a draft.
- “Start over” on a plan and “Clear all” on Find delete that key.
- The Find tab’s remembered URL (D-07 §9.4) includes cue params.

## 14. Phone wireframes (≈375px)

```
A  planCount · plan, focused, empty            B  planCount · working
┌───────────────────────────────────────┐      ┌───────────────────────────────────────┐
│ ‹ Home                                │      │ ‹ Home                                │
│ PLAN OUR DINNERS                      │      │ Plan your dinners                     │
│ Plan your dinners                     │      │ ┌▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┐ │
│ Tell us what the week needs, or       │      │ │ “Plan three easy dinners this     │ │
│ choose how many below.                │      │ │  week. Fish twice.”               │ │
│ ┌▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┐ │      │ │ ≋≋  Weaving that together…        │ │
│ │ ≡ What should dinner look   (→)  │ │      │ │                          Cancel   │ │
│ │   like this week?                 │ │      │ └─═══────────────────────────────── ┘ │
│ └───────────────────────────────────┘ │      │   (thread line travelling →)          │
│ (Three easy dinners) (Fish twice)     │      │ Or choose how many                    │
│ (Keep weeknights simple)              │      │ [2] [3] [4] [5] …        (dimmed .55) │
│ (Make Friday special)                 │      └───────────────────────────────────────┘
│▓▓▓▓▓▓▓▓▓▓▓▓ keyboard ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└───────────────────────────────────────┘

C  planReview · settled                        D  “Make Tuesday easier” · only Tue changes
┌───────────────────────────────────────┐      ┌───────────────────────────────────────┐
│ ‹ Back                 YOUR PLAN   ⋯  │      │ ┌▀▀▀▀▀▀ woven stripe ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀┐ │
│ Here’s a good plan                    │      │ │ “Make Tuesday easier”       Edit  │ │
│ ┌▀▀▀▀▀▀ woven stripe ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀┐ │      │ │ Tuesday’s now an easy one.        │ │
│ │ “Plan three easy dinners…”  Edit  │ │      │ │ [3 dinners×][Fish twice×][Tue:    │ │
│ │ Got it — three dinners, mostly    │ │      │ │  easy×][Keep it easy]             │ │
│ │ easy, fish twice, Friday special. │ │      │ └───────────────────────────────────┘ │
│ │ [3 dinners ×] [Fish twice ×]      │ │      │ ┌ Mon 12 · Lemon salmon ──────────┐   │
│ │ [Fri: special ×] [Keep it easy ●] │ │      │ │ (unchanged, did not move)        │   │
│ │ [Keep ingredients simple ○]       │ │      │ └──────────────────────────────────┘   │
│ │ ┌ ≡ Change anything?        (→) ┐ │ │      │ ┏▀▀▀▀ stripe draws → ▀▀▀▀▀▀▀▀▀▀▀▀▀┓   │
│ │ (Make one more adventurous)       │ │      │ ┃ Tue 13 · Sheet-pan chicken  ◀focus┃   │
│ │ (Keep everything under 30 min)    │ │      │ ┃ 25 min · Easy                     ┃   │
│ └───────────────────────────────────┘ │      │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│ ┌ Mon 12 · Lemon salmon ───────────┐  │      │ ┌ Fri 16 · Miso cod ───────────────┐   │
│ └──────────────────────────────────┘  │      │ └──────────────────────────────────┘   │
│ [          Looks good          ]      │      │ [          Looks good          ]       │
└───────────────────────────────────────┘      └───────────────────────────────────────┘

E  Find · first open                           F  Find · “something cozy but not too heavy”
┌───────────────────────────────────────┐      ┌───────────────────────────────────────┐
│ Find a dinner                         │      │ ┌▀▀▀▀▀▀ woven stripe ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀┐ │
│ ┌───────────────────────────────────┐ │      │ │ “Something cozy but not too…” Edit│ │
│ │ ≡ What sounds good?          (⌕)  │ │      │ │ Something cozy that isn’t too     │ │
│ └───────────────────────────────────┘ │      │ │ heavy — here’s what fits.         │ │
│ (Something cozy) (Easy fish dinner)   │      │ │ ┌ ≡ Refine these…           (⌕) ┐ │ │
│ (Fresh but filling) (Spicy, with tofu)│      │ └───────────────────────────────────┘ │
│ Good matches                    See all│      │ [≋Cozy×][≋Not too heavy×][Easy×] Refine│
│ [photo][photo][photo] →               │      │ 12 dinners                            │
│ Easy                            See all│      │ ┌ hero photo 4:3 ──────────────────┐  │
│ [photo][photo][photo] →               │      │ └──────────────────────────────────┘  │
│ ─────── Home Tonight Find … ───────── │      │ (Make it easier) (Try fish)           │
└───────────────────────────────────────┘      └───────────────────────────────────────┘

G  Conflict (shellfish table)                  H  Error, text kept
┌───────────────────────────────────────┐      ┌───────────────────────────────────────┐
│ │ “Give us shrimp tonight”    Edit  │ │      │ ┌───────────────────────────────────┐ │
│ │ ▌Shrimp doesn’t work for everyone │ │      │ │ ≡ something warm, no fuss,  (→)   │ │
│ │ ▌at your table, so here’s another │ │      │ │   kinda like that place…          │ │
│ │ ▌seafood dinner.        (info)    │ │      │ └───────────────────────────────────┘ │
│ │ [Seafood ×] [Tonight]             │ │      │ ▌Couldn’t quite make sense of that.   │
│ └───────────────────────────────────┘ │      │ ▌Try saying it another way, or use    │
│ ┌ Tonight · Miso cod ──────────────┐  │      │ ▌the options below.    Edit           │
│ └──────────────────────────────────┘  │      │ Or choose how many                    │
└───────────────────────────────────────┘      └───────────────────────────────────────┘
```

## 15. CSS token guidance

Use semantic tokens only, with no raw hex and no gradients beyond the existing `.weave-accent` hard-stop stripe. Every theme, including Dark Mode, works by token swap.

| Element | Tokens |
|---|---|
| `.weave-strip` | bg `--color-surface`, 1px `--color-border`, radius `--radius-lg`, padding `--space-4` (phone) / `--space-6`, gap `--space-3`, shadow as `.card`; top stripe `.weave-accent` |
| `.weave-composer` | bg `--color-surface-quiet`, 1.5px `--color-border-strong`, radius `--radius-xl`, min-height `--control-h`, text `--text-base` `--color-text`, placeholder `--color-text-tertiary`; focus: border `--color-focus` + existing focus ring |
| collapsed composer | same, height `--control-h-sm`, text `--text-sm` |
| `.weave-composer__submit` | 44px (`--target-min`), bg `--color-primary` → `-hover` / `-pressed`, icon `--color-on-primary` `--icon-md`; empty: bg `--color-surface-sunken`, icon `--color-text-tertiary` |
| `.weave-mark` / working strands | `--weave-1..3`, strand height 5px, radius `--radius-pill`; reuse `@keyframes weave` |
| thread line | 2px, hard-stop thirds of `--weave-1..3`; `transform: translateX` loop 1.6s linear |
| `.weave-echo` | `--text-sm`, `--color-text-secondary`, one line with ellipsis; “Edit” is `.btn-quiet.btn-sm` |
| `.weave-reply` | `--text-md`, `--weight-semibold`, `--leading-snug`, `--color-text` |
| `.weave-understood` chips (applied) | bg `--color-structure-soft`, text `--color-text`, × `--color-text-secondary`, radius `--radius-pill`, height 36px with 44px hit area; D-01 toggles keep `.chip-tog` / `.is-on` |
| mood mini mark | 10×8 three strands `--weave-1..3` |
| `.weave-starters`, `.weave-next` | existing outlined `.chip-tog` look: 1px `--color-border`, text `--color-text`, bg `--color-surface`; pressed `--color-selected-bg` / `--color-selected-border` |
| `.weave-notice--info` | bg `--color-accent-soft`, text `--color-accent-text`, 3px left bar `--color-accent` |
| `.weave-notice--error` | bg `--color-error-soft`, text `--color-error-text`, 3px left bar `--color-error` |
| changed-card stripe | `.weave-accent::before`, `transform-origin: left`, `--duration-slow` `--ease-standard` |

**Motion constants** (add to `:root` next to the `--duration-*` scale):
- `--weave-reveal-step: 45ms`
- `--weave-reveal-max: 900ms`
- `--weave-stagger: 60ms`
- `--weave-stripe-hold: 3s`

Everything else uses `--duration-fast`, `--duration-base`, `--duration-slow`, `--ease-standard` and `--ease-emphasized`.

## 16. Acceptance checks (UX)

1. Grepping consumer strings for §0.4 terms returns nothing, and no sparkle or robot icon exists.
2. “Make Tuesday easier” on a dated three-dinner plan re-renders exactly one `.plan-meal-card`, and focus lands on its title.
3. With results ready, the reveal never delays interaction. Clicking a card mid-reveal opens it.
4. VoiceOver/TalkBack hear the reply once, as a whole sentence.
5. Removing “Fish twice” makes zero model requests (network panel) and updates the plan.
6. “salmon” in Find shows no `WeaveWorking` and makes no model request.
7. Under reduced motion there is no animation, and the reply text and changed-slot information are still present.
8. In the unavailable state, Plan shows the count picker with the §10 copy, Find searches literally, and nothing looks broken.
9. Plan → recipe → Back, and Find NL → recipe → Back, restore the strip, chips, results and scroll with no reveal and no request.
10. On a 375px phone with the keyboard open, the field, submit button and starters are visible, and the tab bar and sticky actions are hidden.
