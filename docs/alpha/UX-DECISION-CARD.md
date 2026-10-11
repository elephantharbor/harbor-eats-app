# Alpha Readiness UX Decision Card: Back, who’s eating, “What would you change?”, and “Why this one?”

Binding UX for the Alpha Readiness brief (`docs/alpha/BRIEF.md` §4–10, 14, 19–22, 24, 27, 29–31, 38–41, 49–51). Composer builds from this, and Grok owns navigation state, scaling, adaptation schemas and evidence. Where this card and Grok’s architecture disagree on data, the architecture wins and Composer reports the gap. This card adds no runtime code.

Still binding underneath: `docs/D06-UX-DECISION-CARD.md` (the Weave system, motion, tokens, reveal), `docs/D061-UX-DECISION-CARD.md` (keyboard, chooser, copy bans), `docs/D07-NAV-DECISION.md` (Find modes and chrome), `docs/FLAVORWEAVE-BRAND.md` (tokens, Plus Jakarta Sans, contrast). This card **amends** D-07 nav labels, the plan card’s “Why this one” line, the recipe detail servings note and the Who’s eating sheet. It adds one Weave adapter (`recipe`) and no new widget.

## 0. Rules

1. **Back is navigation, Undo is for data.** Back never un-rates, un-applies or un-saves anything. Every data change gets its own visible Undo.
2. **Say the default once, call out the exceptions.** The diner count is always findable, but it only gets loud when a dinner differs from the household.
3. **Advice until Apply.** A recipe answer changes nothing until the person taps an explicit Apply that names its scope (“Apply to Dinner 2”).
4. **FlavorWeave decides why; the words only say it.** No reason appears that isn’t in the evidence. When evidence is thin, say less.
5. **Native result is the payoff.** Changed ingredient rows, changed steps, updated shopping lines and a short reason line carry the result. Prose is at most two sentences.
6. **Voice:** confident, friendly, food-aware, short. Prefer no pronoun; use “we” when needed. Never on screen: D-06 §0.4 ban list, D-06.1 §6.2 health words, and these desk words: *instance, override, canonical, certified, adaptation, evidence, participants, servings scale, fallback, parent, session, validation, safe/unsafe* (as a claim about food). Use instead: *this dinner, who’s eating, original recipe, your version, change*.
7. **Same system everywhere.** Adaptation uses `WeaveStrip`; explanations use the Weave mini mark and D-06 §6 reveal rules. No feature-specific AI widgets, bubbles, sparkles or avatars.

## 1. Decisions at a glance

| # | Decision | Answer |
|---|----------|--------|
| 1 | Back mental model | “Back takes you to where you just were.” Three layers: places (tabs), steps (task flows), and surfaces (sheets). Back peels the top layer first. |
| 2 | Tabs | Tabs are places, not steps. Switching tabs doesn’t stack. Back from any tab goes to Home, and Back from Home leaves the app. |
| 3 | Finished tasks fold | Confirming a plan, finishing cooking or saving ratings removes those steps from Back. You never Back into a form you already completed. |
| 4 | On-screen vs system Back | Same destination, always. The on-screen Back label names it (“‹ Shopping list”). |
| 5 | Kitchen mode Back | Steps out to the recipe with “Resume step {n}”. Never walks back through steps. |
| 6 | Deep links | Land with an on-screen Back that names a real parent. No fake history. System Back on the landing returns to wherever the link was tapped. |
| 7 | Diner label | “For {n}” on cards, “Cooking for {n}” on recipe and cook, and a header line on shopping. |
| 8 | Changing it | One sheet everywhere: “Who’s eating {Dinner 2}?” with member tiles and a Guests stepper. |
| 9 | Browsing a recipe not in a plan | A temporary `− 2 +` viewing stepper that is never saved. |
| 10 | Adaptation entry | A collapsed `recipe` composer “What would you change?” on recipe detail, and in a sheet from kitchen mode. |
| 11 | Changed recipe | A “Your version” badge, marked rows and steps, “See what changed”, per-change Undo and “Back to the original”. |
| 12 | Explanation | A reason line on the card, then “Why this one?” expands in place with 1–2 sentences. It is fetched only on tap. |
| 13 | Cold start | Personal phrasing only for things the household said or rated. Otherwise factual, or nothing. |

---

## 2. Back

### 2.1 The model people should hold

> **Back takes you to where you just were. If something is open on top, Back closes it first.**

| Layer | What it is | Examples | Back does |
|---|---|---|---|
| **Places** | The five tabs, with full chrome | Home · Tonight · Find · History · Profile | From Home: leave the app. From any other tab: go to Home. |
| **Steps** | Screens inside a task, with focus chrome and an on-screen “‹ {Parent}” | Plan review, replace/choose Find, recipe detail, shopping list, rate, kitchen mode | Return to the previous step with its state restored. |
| **Surfaces** | Things that open on top | Swap sheet, ⋯ menu, Who’s eating, Find refine sheet, confirm dialog, “See what changed”, kitchen-mode “Change something” sheet, the open keyboard | Close it. Nothing underneath moves. |

Priority on any Back press (system, browser, on-screen or Escape): 1) dismiss the keyboard (OS-owned), 2) close the top surface, 3) cancel an in-flight Weave request and keep the draft (D-06 §13), 4) return to the previous step, 5) go to the place’s parent (Home), 6) leave the app.

### 2.2 Rules that make it predictable

- **One destination.** On-screen Back and system Back always go to the same place. If they could differ, the on-screen label is wrong. Fix the label, not the behavior.
- **The label names the destination**, not the word “Back”: “‹ Plan”, “‹ Tonight”, “‹ Find”, “‹ Shopping list”, “‹ Recipe”, “‹ History”, “‹ Home”. Use “‹ Back” only when the destination has no short name. This amends `nav-context.js` `LABELS` (`planReview`, `planConfirm`, `shopList` currently read “Back”).
- **Surfaces never reopen on Back.** Swap sheet → “See all options” → recipe → Back → Back lands on the plan with the swap sheet closed (brief §7). If you went deeper, the sheet’s job is over.
- **Closing a surface by ×, Cancel, scrim tap or Save leaves no dead Back press.** A Back press must always do something visible. Whatever mechanism Grok picks, a “ghost” entry that does nothing is a defect.
- **Unsaved surface drafts are discarded silently** (Who’s eating, refine sheet). They are cheap to redo, so there is no “Discard changes?” dialog. Back never asks for confirmation anywhere in the app.
- **Finished tasks fold.** After “Confirm plan”, the plan steps collapse into Tonight: Back from Shopping list goes to Tonight, not to the confirm screen. After saving ratings, Back goes to Home. After the last cook step → “Done cooking”, Back goes to Tonight (or Home with no plan), never into kitchen mode.
- **Leaving the app is honest.** From Home with nothing open, system Back leaves or minimizes. No “Press again to exit” toast, and no trap.
- **Back is instant.** Restored screens appear statically, with no `view-in`, no skeletons, no reveal and no request (extends D-06 §13 app-wide). Forward navigation keeps the existing `view-in`.
- **Focus returns to where you were.** On Back, focus goes to the control that opened the child (the dinner title, the Find card, the shopping row), with `preventScroll` and the restored scroll. Forward navigation keeps focus-to-heading.

### 2.3 What Back restores (the required cases)

| Journey | Back lands on | Restored exactly |
|---|---|---|
| Find → query/chips → recipe | Find | Query, interpreted chips and mood cues, filters, Weave echo/reply, scroll (D-07 §9.3) |
| Plan → Swap → See all options → recipe | Replace-mode Find (“Find something else”), focus chrome | Same as Find, plus mode header. Back again → plan, swap sheet closed. |
| Empty slot → Pick one yourself → recipe | Choose-for-plan Find (“Pick a dinner”) | Same as Find |
| Weave request → plan → recipe | Plan review | Strip (echo, reply, chips, Next, open chooser), card focus, scroll |
| Shopping list → recipe | Shopping list | Scroll, checks, open section. Never re-sorted. |
| Kitchen mode → “Ingredients” / recipe | Kitchen mode | Same step, same scroll |
| Kitchen mode → system Back | Recipe detail | Primary button reads “Resume step {n}” for the rest of the visit |
| History → past dinner | History | Scroll and the opened row focused |
| Recipe with an unapplied suggestion → kitchen mode → Back | Recipe | The suggestion card and the composer draft |

### 2.4 Deep links: logical parents

The landing shows its normal focus chrome with an on-screen Back that names the parent. Tapping it **replaces** the landing with the parent and from then on behaves normally. System Back on the landing returns to the app or message the link came from. This matches Android’s expectations and avoids fake history (brief §8).

| Link | Lands on | On-screen Back → |
|---|---|---|
| `/meal/{slug}?from=find` | Recipe | “‹ Find” (Find rebuilt from the saved URL, or standalone first open) |
| `/meal/{slug}`, dinner is in the active plan | Recipe, with that dinner’s diner count | “‹ Tonight” |
| `/meal/{slug}`, not in a plan | Recipe, viewing stepper (§3.4) | “‹ Find” |
| `/find?mode=replace_plan_meal…` / `choose_for_plan…`, slot still valid | Focus Find | “‹ Plan” or “‹ Tonight” per D-07 |
| Same, plan or slot gone | Standalone Find, note “That dinner plan has changed, so here’s the full menu.” | Find is a tab, so there is no Back button |
| `/rate/{plan_id}` | Rate | “‹ Home”. Already rated: Home with toast “Those ratings are already in.” |
| `/invite/…`, `/recover/…` | Their flows, unchanged | — |
| `/share/…` (guest) | Guest choice, brand chrome | No app Back. System Back leaves. |
| Signed out on any of the above | Recovery/welcome, then the original destination (DEEP-LINKS.md) | As above, once landed |

A PWA cold start (home-screen icon) opens Home. If the last session was mid-cook within 3 hours, Home leads with “Back to {Miso cod} — step 4” rather than auto-opening kitchen mode.

---

## 3. Who’s eating: diner count

### 3.1 Words

| Where | Default (matches household) | Differs from household |
|---|---|---|
| Plan card meta row | “For 2” | “For 1 · just Renata” · “For 4 · 2 guests” · “For 3 · Sam’s out” |
| Recipe detail (planned dinner) | “Cooking for 2” | Same, plus “· 1 guest” |
| Kitchen mode bar | “Cooking for 2” | Same |
| Shopping header | “3 dinners · cooking for 2” | “3 dinners · cooking for 2, Fri for 4” (up to two exceptions; then “· amounts match each dinner”) |
| Live/toast after a change | “Dinner 2 is now for 3. Shopping list updated.” | — |

- Use the number, never “servings” or “portions”. The recipe’s base yield appears once, quietly: “Recipe written for 4 — amounts adjusted.” Only show it when the count differs from the base.
- Name people only to say who *is* eating (“just Renata”) or who’s out when exactly one member is (“Sam’s out”). Never name anyone with a limit.
- Leftovers and eating-out cards keep “Nothing to shop for.” and show no count.

### 3.2 Placement

- **Plan card:** at the end of the existing meta row (`25 min · Easy · For 2`), with the `users` icon (14px, `aria-hidden`). It is a quiet text button (44px hit area via `::after`) that opens the Who’s eating sheet. Default state is `--color-text-secondary`. When it differs from the household, it uses `--color-structure-soft` pill fill so the exception is scannable. It does not count toward the three-pill limit, because it isn’t a badge.
- **Recipe detail:** the line moves up out of the Ingredients tab into the header, under the badges and above the composer: `Cooking for 2 · Change`. The Ingredients tab repeats it as its first line (people land there from Shop). Retire `#detailServingsNote` copy “Scaled for {n} (written for {base}).” and the stats-row “Serves”.
- **Kitchen mode:** a second line under `cook__meal` in the bar: “Cooking for 2” (`--text-sm`, secondary). Tapping it opens the same sheet on top of kitchen mode. Back closes it, and step amounts update in place.
- **Shopping list:** the eyebrow becomes the header line in §3.1, and tapping it opens a small sheet “Who’s eating” listing each dinner with its count and a “Change” for each. Lines don’t carry per-dinner counts.

### 3.3 The Who’s eating sheet (amends `#participantsSheet`)

```
┌───────────────────────────────────────┐
│ Who’s eating Dinner 2?                │  title = existing
│ [✓ Renata] [✓ Tom] [  Sam  ]          │  member tiles (existing)
│ Guests                     ( − 1 + )  │  new row
│ We only check limits for people in    │  shows when guests > 0
│ your kitchen.                         │
│ Cooking for 3                          │  live summary
│ [ Cancel ]              [ Save ]      │
└───────────────────────────────────────┘
```

- Guests are a count, not people. No names or profiles (brief §20). The stepper uses the D-06.1 `.weave-stepper` anatomy, clamped so the total stays at or below 8. At the cap: “Recipes go up to 8.”
- The guest note is the one honest safety line. It never says “safe”.
- At least one person must be eating (existing “Someone has to eat it.”). Guests alone count.
- Save closes the sheet, transforms only that card (D-06 §8 stripe) and announces “Dinner 2 is now for 3. Shopping list updated.” Changed shopping lines get the existing change tags. Checks are kept.
- Default on a new dinner: every active, eligible member, which matches the copy “For {n}” with no exception styling.

### 3.4 Recipe outside a plan

On a recipe opened from Find (not a planned dinner), the header shows `Cooking for ( − 2 + )`. It defaults to the household, updates amounts instantly, is never saved and resets on the next visit. There is no second serving state anywhere: a planned dinner always shows its saved count and opens the sheet, and there is no viewing stepper on a planned dinner.

### 3.5 Rate

The rate screen asks only the members who ate (tiles from that dinner’s count, minus guests). Guests never rate.

---

## 4. “What would you change?”: recipe adaptation

### 4.1 Adapter (`recipe`, added to D-06 §2.3)

| | `recipe` (recipe detail) | `recipeCook` (kitchen mode) |
|---|---|---|
| Lives in | Header, under “Cooking for 2”, above the tabs | Sheet opened from “Change something” (`btn-quiet btn-sm`) in the cook bar |
| Field label (sr) | “Change this recipe” | same |
| Placeholder | “What would you change?” | same |
| Default | collapsed pill | expanded and focused |
| After an Apply | “Change anything else?” | same |
| Starters | Up to four, from recipe data (§4.2) | same |
| Task | `recipe_adaptation` | same |
| History | Unapplied result kept while you stay on this recipe or its kitchen mode | same |

This is the existing `WeaveStrip`. The recipe surface adds a change preview (§4.4) in the result slot. Nothing is docked and there is no transcript. A new request replaces the previous result.

### 4.2 Starters

Deterministic and only offered when the recipe can plausibly support them. A tap fills the field and doesn’t submit.

| Starter | Shows when | Fills |
|---|---|---|
| “Less spicy” | recipe has heat | “Make this less spicy.” |
| “No {cilantro}” | the first herb or specialty item | “I don’t have {cilantro}.” |
| “Make it simpler” | more than 8 steps or 12 ingredients | “Make this simpler.” |
| “Use the air fryer” | the method allows it (a recipe tag) | “Can I use the air fryer?” |
| “Prep ahead?” | always last | “What can I prep ahead?” |

Starters go through the D-06.1 household filter and never suggest an ingredient that touches a diner’s limit.

### 4.3 Working and reveal

- Same as D-06 §5–6: strands expand, “Weaving that together…”, the thread line runs, the recipe dims to `.55`, and the reply reveals word by word only after the validated, deterministically checked result arrives. At most 900ms, and any tap completes it.
- The change preview renders at reveal start and is interactive at once.
- Reply is one sentence (≤120 characters), plus at most one “Expect …” sentence for flavor or texture.

### 4.4 Result: advice, then an explicit Apply

Every result is advice. Its shape depends on what came back:

| Result | Shows | Actions |
|---|---|---|
| **A change** (swap, remove, less/more, method) | Reply + change preview card | “Apply to {Dinner 2}” (primary small) · “Not now” |
| **Tips only** (“What can I prep ahead?”) | Reply + up to three tips, each tied to a step (“Step 2: chop the veg up to a day ahead.”) | “Got it” |
| **Recipe not in a plan** | Reply + change preview | “Got it”, and note “Add it to your plan to keep this change.” No Apply. |
| **Can’t or shouldn’t** | Notice (§4.7) | “Edit” |

**Change preview card** (`.weave-change`, bg `--color-surface-quiet`, 1px `--color-border`, `--radius-md`):

```
┌ Suggested change ─────────────────────┐
│ Flat-leaf parsley, 1 bunch            │  new row, as it would appear
│ instead of cilantro                   │  old item, secondary, no strike-only
│ Step 4 · scatter parsley with lime    │  affected step(s), one line each
│ Expect: milder and grassier, still    │  flavor/result line, only if supplied
│ bright.                               │
│ [ Apply to Dinner 2 ]       Not now   │
└───────────────────────────────────────┘
```

- Quantities shown are the deterministic ones, at the dinner’s diner count.
- When the method changes the result (air fryer, no pressure cooker), the “Expect” line is mandatory and specific: “Expect: a drier crust and about 10 minutes less.” Never “just as good”.
- “Not now” clears the card and keeps the reply. Nothing is saved.
- Apply is the only mutating action. Its label always names the scope: “Apply to tonight’s dinner”, “Apply to Dinner 2”, “Apply to {Tue}”.

### 4.5 After Apply: how a changed recipe is marked

- Toast: “Applied to Dinner 2. Shopping list updated.” with “Undo” (6s, existing toast pattern). If shopping isn’t affected: “Applied to Dinner 2.”
- **Badge:** “Your version” (`--color-accent-soft` / `--color-accent-text`) next to the title on recipe detail, the plan card and the kitchen mode bar. It replaces nothing and counts toward the three-pill limit (drop the lowest-priority badge first).
- **Header line:** “Your version · 1 change · See what changed”.
- **Rows and steps:** changed ingredient rows and steps get a 3px `--color-accent` left bar plus a visible “Changed” label (`--text-xs`, `--color-accent-text`). Removed items aren’t shown in the list (they’re in “See what changed”).
- **Shopping:** the new item appears with the existing “New” tag. A dropped item moves to “No longer needed” if it was checked, otherwise it disappears.
- Focus after Apply moves to the “Your version” header line.
- The adaptation is **not** Taste evidence. Never say “We’ll remember that.”

### 4.6 See what changed, Undo, Back to the original

“See what changed” opens a sheet (a surface: Back closes it):

```
┌ What changed in Dinner 2 ─────────────┐
│ You asked: “I don’t have cilantro.”   │
│ • Parsley instead of cilantro         │  Undo
│   Ingredients · Step 4                │
│ • Milder: half the chili flakes       │  Undo
│   Ingredients · Step 2                │
│ [ Back to the original ]              │  secondary
└───────────────────────────────────────┘
```

- Per-change “Undo” removes just that change. “Back to the original” removes all of them, closes the sheet and toasts “Back to the original recipe.” with “Undo”. There is no confirm dialog, because everything is undoable.
- When nothing is left, the badge and header line disappear, and the composer placeholder returns to “What would you change?”.
- Changes stay with that dinner through Shop, Cook and Rate. They never touch the menu recipe or other dinners.

### 4.7 Can’t, shouldn’t, or not a recipe change

`WeaveNotice`, info style unless noted. Copy comes from deterministic codes, and the model’s sentence never replaces it.

| Situation | Copy | Actions |
|---|---|---|
| Touches a limit at this table | “{Peanuts} don’t work for everyone eating Dinner 2, so we’d leave that out.” Add “{Toasted sunflower seeds} give a similar crunch.” only if a checked alternative exists, shown as a change preview. | Alternative’s Apply, or none |
| Guest asked for, limits unknown | (no special copy; guests aren’t checked, see §3.3) | — |
| Method can’t be replaced | “That pressure cooker is doing most of the work here. We’d stick with the original method for this one.” | — |
| Not confident | “We’re not sure that swap would work here, so we’d keep the original.” | “Edit” |
| About amounts or people (“double it”, “for 6”) | “Amounts follow who’s eating.” followed by the native control inline: `Cooking for 2 · Change` | opens the sheet |
| Not about cooking | “That’s not something we can change in a recipe. Try an ingredient, a tool, or how much effort.” | “Edit” |
| Too vague (“make it better”) | “Happy to — what should change?” plus starters | starters |
| Errors, slow, offline, unavailable | D-06 §10 copy. When unavailable, the composer hides on recipe detail and no message shows. | as D-06 |

Never say “safe”, “allergy-friendly” or “dairy-free” as a promise. Never name the person a limit belongs to.

---

## 5. “Why this one?”: explanations

### 5.1 Three levels

| Level | Where | What | Cost |
|---|---|---|---|
| **1 · Reason line** | Plan cards, Tonight hero, swap alternatives, Find hero and wide cards (D-07 rule unchanged), recipe detail why-card | One structured line from deterministic evidence, ≤40 characters, no kicker | none |
| **2 · “Why this one?”** | Plan cards, Tonight hero, swap alternatives, recipe detail why-card. Not on small Find grid cards. | `btn-quiet btn-sm` disclosure under the reason line | — |
| **3 · Reveal** | Expands in place under the button | 1–2 sentences, ≤200 characters | one call on first open, then cached |

**Reason line copy** (lead with the strongest fact, join at most two with “ · ”):
- Learned: “Smoky, like you both rate highly” · “A favorite flavor for Tom”
- Told: “You said you like ginger”
- Context: “Easy, like you asked” · “Simple ingredients”
- Plan and novelty: “A break from pasta this week” · “Not on your table lately” · “Something new for you”

**Retire** the plan card’s static “Why this one / Fits everyone’s limits”. Every dinner fits everyone’s limits, so it says nothing. With no reason, show no line and no button. Recipe detail keeps the “Fits your household” badge as the limits promise.

### 5.2 The reveal

```
Smoky, like you both rate highly            ← reason line
Why this one? ▾                             ← button, aria-expanded
≋ You both keep scoring smoky, savory       ← reveal, mini mark, reveal per D-06 §6
  dinners high, and this one stays easy on
  a weeknight.
```

- First open: the Weave mini mark (10×8, three strands) animates beside the button label for up to 6s. There is no “Weaving…” label, because it’s too small a moment.
- Then the D-06 word reveal (≤900ms). Already cached: show it at once with a 120ms fade, with no fake delay.
- Over 6s, or any failure: show the deterministic sentence built from the same reason facts (“Smoky and savory, easy, and not on your table lately.”). Never show an error for an explanation.
- “Why this one? ▴” collapses it. The reveal stays expanded for that card while you’re on the screen and restores statically on Back.
- Never show scores, percentages, “match”, rank, “algorithm” or anything that implies the words chose the dinner.

### 5.3 Cold-start honesty

| What FlavorWeave has | Allowed phrasing | Never |
|---|---|---|
| Ratings (learned) | “you both rate smoky dinners highly”, “Tom scored the last two curries high” | “you love…” unless rated or stated |
| Onboarding likes (told) | “you said you like…”, “you told us…” | “we noticed…” |
| This plan or request (context) | “you asked for easy this week”, “a break from the pasta on Tuesday” | implying it’s a taste |
| Only exploration | “Something different that still keeps tonight easy.” | any personal claim |
| Nothing useful | no line, no button | “Picked just for you” |

- When no learned evidence was used, add one quiet line under the reveal (`--text-sm`, secondary): “Rate a few dinners and these get sharper.” Show it once per visit.
- People: use “you both” for 2 and “everyone” for 3–4 (`householdCopy`). Name one person only for a positive fact. Never name a dislike or a limit, and never say who disagrees.

---

## 6. Visual

- **Type:** Plus Jakarta Sans throughout (`--font-sans`). Reason line `--text-sm` `--weight-medium` `--color-text-secondary`. Reveal `--text-base` `--leading-snug` `--color-text`. “Cooking for 2” `--text-sm` `--weight-semibold` `--color-text`.
- **Bright and clean:** surfaces stay `--color-surface` on the warm canvas, food photos lead, and the coral primary is reserved for the one main action per screen (Start cooking, Save, Looks good). “Apply to Dinner 2” is primary *small* inside its card, so it doesn’t compete with the page’s main button.
- **New tokens:** none. “Your version” and changed rows use the accent family. The diner-exception pill uses structure-soft. The change card uses surface-quiet. Add `.weave-change`, the “Your version” badge and the changed-row label to `test/theme-contrast.test.js`.
- **Icons:** existing `users`, `arrow-left` and `check`. No sparkle, wand, robot or bulb on the new explanation button (the existing why-card bulb stays).

## 7. Motion and reduced motion

| Moment | Default | `prefers-reduced-motion` |
|---|---|---|
| Forward navigation | existing `view-in` | none |
| Back | instant static restore | same |
| Sheet open/close | existing sheet transition | instant |
| Diner change | card stripe (D-06 §8), amounts cross-fade 120ms | static stripe 3s, instant amounts |
| Adaptation working / reveal | D-06 §5–6 | static strands, instant reply |
| Apply | changed rows’ accent bar draws top to bottom over 240ms, once | bar static |
| “Why this one?” | mini mark loop, then word reveal | static mark, instant text |

One animated element at a time, and nothing loops after settle.

## 8. Accessibility

- **Back:** the on-screen Back is a `<button>` whose accessible name includes the destination (“Back to Shopping list”). Escape behaves exactly like Back on desktop. Focus returns to the opener (§2.2). Every surface is a `<dialog>` with focus trapped and returned to its trigger on close.
- **Diner count:** the plan card button is named “For 2, change who’s eating Dinner 2”. The Guests stepper is `role="group"` with “One fewer guest” / “One more guest”. The live summary “Cooking for 3” is `aria-live="polite"`. After saving, there is one announcement.
- **Adaptation:** one live announcement per turn: “{reply} Suggested change: {new} instead of {old}.” The change card is `role="group" aria-label="Suggested change"`, and “instead of” is real text, never strikethrough alone. Changed rows carry a persistent visible “Changed” label (state, not a one-turn hint). Apply announces “Applied to Dinner 2. Shopping list updated.” Undo is reachable by keyboard for the full 6s and is also in “See what changed”.
- **Explanation:** a disclosure button with `aria-expanded` and `aria-controls`. The reveal region is announced once as a whole sentence, and the visual reveal is `aria-hidden` (D-06 §12 pattern). Focus stays on the button.
- **Targets and contrast:** 44px minimum targets, existing focus ring, forced colors (accent bars and pills become `CanvasText` borders), 4.5:1 for all new text pairs.
- **Nothing by color alone:** exceptions, changes and “Your version” all have words.

## 9. Acceptance checks (UX)

1. Every journey in §2.3 lands where the table says, with system Back and with the on-screen Back, and the two always agree. The swap sheet never reopens on Back.
2. On Android/PWA, Back with any sheet open closes only the sheet. From Home with nothing open, Back leaves the app. From any other tab, Back goes to Home.
3. After “Confirm plan”, Back from Shopping list goes to Tonight. After saving ratings, Back never shows the rating form.
4. Kitchen mode → system Back → recipe shows “Resume step {n}”, and resuming lands on that step.
5. Each §2.4 deep link shows a Back that names its parent, with no extra history entries created on landing.
6. A two-person plan shows “For 2” on every card. Changing Dinner 2 to 1 + 2 guests shows “For 3 · 2 guests”-style exception styling, “Cooking for 3” on its recipe and cook bar, an updated shopping header, and shopping quantities that change with checks kept.
7. Recipe detail and shopping never show different counts for the same dinner. A Find-only recipe’s viewing stepper is never saved.
8. “I don’t have cilantro” on a planned dinner shows a change card, and nothing changes until “Apply to Dinner 2”. After Apply, the badge, marked rows, shopping update and Undo toast all appear. “Back to the original” restores everything.
9. A peanut swap at a peanut-limited table is refused without naming anyone or saying “safe”. Butter Chicken “without a pressure cooker” gets the stick-with-the-original copy and no Apply.
10. A new household with no ratings never sees “you love”, “we noticed” or a learned-taste phrase. Plan cards with no evidence show no reason line and no “Why this one?”.
11. Opening “Why this one?” twice makes one request. Opening it with the network off shows the deterministic sentence, not an error.
12. Under reduced motion, every state above is still present with no animation. Screen readers hear each reply or explanation once.
13. No consumer string matches the D-06 §0.4, D-06.1 `HEALTH` or §0.6 desk-word lists.
