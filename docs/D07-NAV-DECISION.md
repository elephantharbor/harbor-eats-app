# D-07 navigation decision: where Find a dinner lives

Status: **Decided** for D-07 V1. The full UX is in `docs/D07-UX.md`. This document is binding on the D-07 implementation and supersedes the Cycle 3 rule “Do not add a fifth tab” (`docs/CYCLE3-UX.md` §1 and §14).

Mode names are the contract’s (`DISCOVERY_MODES` in `src/discovery/constants.js`, draft [PR #24](https://github.com/elephantharbor/harbor-eats-app/pull/24)): `standalone`, `replace_plan_meal`, `choose_for_plan`. Navigation decides which mode a screen opens; the contract decides what each mode searches and which mutation a pick sends.

## Decision

**Hybrid.** Find is a primary nav destination, and the same surface also opens from actions inside a plan.

| How you get there | Discovery mode | Chrome | Lit nav item |
|-------------------|----------------|--------|--------------|
| Find tab (phone), Find in the top nav (tablet, desktop) | `standalone` | `full` | Find |
| Home hero “Find a dinner” | `standalone` | `full` | Find |
| Tonight “Find a dinner” (no plan), Tonight “See all dinners” (with a plan) | `standalone` | `full` | Find |
| Swap sheet “See all options” | `replace_plan_meal` | `focus` | The section that opened the sheet (Home or Tonight) |
| Plan meal “More” → “Find something else” | `replace_plan_meal` | `focus` | Same as above |
| Empty slot “Pick one yourself” | `choose_for_plan` | `focus` | Same as above |

Leftovers and eating-out rows are not search targets in the contract, so “Plan a dinner here instead” keeps the Cycle 3 §6.4 swap-sheet flow and does not open Discovery in V1.

URLs use the contract’s query-string names: `/find`, `/find?mode=replace_plan_meal&dinner_plan_id={id}&meal_id={meal_id}`, `/find?mode=choose_for_plan&dinner_plan_id={id}&meal_id={row_id}&position={p}` (`docs/D07-UX.md` §9).

The primary nav becomes five items, in this order:

**Home · Tonight · Find · History · Profile**

- Phone tab bar: five equal columns. At 390px wide each tab is 78px, above the 44px target minimum. Icon: a new `#i-search` symbol (magnifier), label “Find”.
- Tablet and desktop top nav: “Find” sits between “Tonight” and “History”.
- Settings stays in the header icon button, as today.

## Why hybrid

1. **“Let me look around” is a mode, not a step.** FlavorWeave promises two ways to get to dinner: choose for me, and let me look around. Choose for me already has homes (Home hero, Tonight, plans). Look around has none. Today the only way to see the menu is through three swap alternatives. A browse surface that is only reachable from inside a plan flow tells people the menu is something you get handed, not something you can explore.
2. **It is the only surface that is useful with no plan and with a plan.** Home and Tonight change shape depending on plan state. Find always shows the whole menu, filtered to your table. That stability is what a primary destination should have.
3. **Plan-bound work stays contextual.** Replacing Dinner 2 or filling Dinner 3 is a task with an exit (“Use this”, “Add this”). Those modes open in `focus` chrome with no tab bar, a clear title (“Find something else”, “Pick a dinner”), and Back to where you were. They never light the Find tab, so the person always knows they are mid-task inside their plan, not browsing.
4. **Desktop has room, and wants it.** On ≥768px the top nav is text links with plenty of space. On desktop, browsing the menu is a primary activity (planning the week on a laptop), and hiding it behind a hero button would under-serve that.
5. **Tonight and Find do not compete.** Tonight answers “what from our plan do we cook now?”. Find answers “what is on the menu for us?”. Tonight links into Find; Find never duplicates Tonight’s plan cards.

## Why not the alternatives

| Option | Why not |
|--------|---------|
| **Action-driven only** (no nav item) | Browse stays invisible to anyone who doesn’t tap the Home hero’s secondary button. Desktop users planning a week get no way in. It also overloads the words “Find a dinner”, which today mean “pick one for me”. |
| **Find as a tab, plan modes also under the tab** | Swapping Dinner 2 would light “Find” and show the tab bar, so a person could tap Home mid-swap and lose the task. Plan tasks need `focus` chrome and a Back that returns to the plan. |
| **Replace Tonight with Find** | Tonight is the cook-now surface for an active plan (Cycle 3 §11). It carries state badges, ratings, and Kitchen mode re-entry. Merging it into a browse grid buries that. |

## Vocabulary this decision locks

These two phrases mean one thing each, everywhere in the consumer UI:

| Phrase | Means | Opens |
|--------|-------|-------|
| “Find a dinner” | Look around the menu yourself | Discovery, `standalone` |
| “Pick one for us” | FlavorWeave chooses one dinner | The existing single-mode `planReview` flow (`startFindDinner`, Cycle 3 §4.2) |

Consequences for existing copy (all specified in `docs/D07-UX.md` §3):

- Home hero with no plan: primary “Plan our dinners”, secondary “Find a dinner” (now opens Discovery).
- Tonight with no plan: primary “Pick one for us”, secondary “Find a dinner”, quiet “Plan a few dinners”.
- Discovery standalone header offers a quiet “Pick one for us”, so choose-for-me is one tap from browsing.
- Tonight with a plan: the bottom card “Not feeling any of these?” button becomes “See all dinners” and opens Discovery standalone. The Cycle 3 §11.4 auto-propose step is replaced by Discovery’s “Cook tonight”, which adds the dinner to the plan with the same ops (`set_count`, `add_meal`, `select_meal`).
- “Find something else” now names only `replace_plan_meal` (swapping one specific dinner). It no longer means “add another dinner to tonight”.
- e2e specs that click `data-action="find-dinner"` expecting a single proposal must switch to the new “Pick one for us” action (`data-action="pick-one"`). Update them on purpose.

## nav-context.js changes

- Add `"find"` to `SECTIONS` and `LABELS.find = "Find"`.
- `chrome("find", ctx)`: `full` when `ctx.mode === "standalone"`, otherwise `focus`.
- `navSection("find", ctx)`: `"find"` in standalone; otherwise `ctx.origin`’s section (`choices` for Tonight and plan edit, `home` for plan review opened from Home).
- `backTarget("find", ctx)`: in plan modes, `ctx.origin` (`planReview`, `choices`, or `home`). In standalone there is no Back button (it is a section).
- `contextFor("detail", "find", …)`: `{ origin: "find", source: "discovery", mode }`. `backTarget` for that context is `"find"`, and `backLabel` reads “Back” (the browser history entry restores the query, see `docs/D07-UX.md` §9).

## Out of scope

No change to Settings placement, onboarding chrome, guest share, or Kitchen mode. No badge counts on the Find tab.
