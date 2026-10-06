# D-07 Find a dinner: Opus UX review

**Verdict: PASS WITH NOTES** once the `timeChipIsOn` stack-overflow hotfix (or this PR) is on the preview. At `2c76864` as deployed, Find does not render (see Blocker).

| | |
|---|---|
| Reviewed | Preview at `e3fda96` (PR #26), then main at `2c76864` (PR #27), then this branch rebased on `2c76864` |
| Widths | 390×844 (phone) and 1280×900 (desktop) |
| Signed in | Yes. A throwaway household tagged `synthetic`, “Opus UX Review (synthetic)” (`hh_67c933c3651b`, members Avery and Sam, a few tastes), created on preview through the public onboarding API. HH001 (Tom / Renata) was not used; no credentials were available. |
| How | Headless Chrome against the preview API. This branch’s `public/` was served locally and `/api/*` was proxied to the preview, so the UI under review used the real 50-meal D1 catalog. A separate hosted walkthrough of `e3fda96` (three screenshots) is folded in below. |
| Not done | Full Playwright, production deploy, catalog changes, D-05/D-06. |

## Blocker found on main (`2c76864`)

`timeChipIsOn` and `timeChipTogglePatch` called `deps.timeChipIsOn` / `deps.timeChipTogglePatch` when set, and `init()` set those to the same functions. Every chip-row paint recursed until “Maximum call stack size exceeded”. On the live preview `/find` showed no chips and no shelves. This branch makes both helpers plain local functions, with no `deps` hook. `test/d07-discovery-app.test.js` fails if `deps.timeChipIsOn` or `deps.timeChipTogglePatch` comes back.

`public/*.js` are classic scripts with no bundler, so they cannot `import` from `src/discovery/client-ui.js`. Keep such helpers local and pure; never route them through `deps` to themselves. The `src` versions keep their unit tests.

## PASS

| Area | Evidence |
|------|----------|
| Nav integration | Five tabs at 390px with Find lit; Find sits between Tonight and History in the desktop top nav. |
| Shelves | Six shelves for the review table, in spec order: Fits your table, Easy, Under 30 minutes, Simple ingredients, Fish & seafood, Plant-forward. Shelf 1 is “Fits your table”, which is honest for a table without taste hits. No “Something adventurous”. |
| Search | “korean” → 3 dinners; “bowl” + Easy → 6. The field keeps focus while results update. |
| Quick ≠ Easy | Under 30 min → 11 dinners. A second tap clears it (URL back to `/find`, shelves return). The chip says “Under 30 min”, never “Quick”. |
| Refine | Time, Effort, Ingredients, Cuisine (12), Type of dinner (8), Main ingredient (12), Flavor (4), Lean toward. The footer counts live: “Show 6 dinners”, then “Show 1 dinner” after adding Japanese. |
| Recipe from Find | `/meal/{slug}?from=find`. “Just looking. Nothing changes until you choose.” Cook tonight and Add to my shopping list (no plan). Nothing changes on open. |
| Back restoration | From `/find?text=bowl&effort=easy`, scrolled 300px, opening the 3rd card and pressing Back restores the URL, the search text, Easy pressed, scroll 300, and focus on the opened card. |
| Card hygiene | No rank, score, match, tier, emoji or dietary lists. At most one meta line and one reason line. |
| Brand | Bright canvas, photo-first cards, coral reserved for primary actions. No desk jargon on screen. |

## Fixed in this PR (on top of #27)

| Finding | Fix |
|---------|-----|
| Find crashes at `2c76864` (above) | Helpers no longer delegate to `deps`. |
| Card titles drawn on the photo as underlined link text; “Search dinners” label visible | The markup used `.visually-hidden`, which doesn’t exist. Switched to the repo’s `.sr-only`, including the new hero card from #27. |
| Refine showed Cuisine, Type of dinner, Main ingredient and Flavor headings with no options | The sheet keyed on `group.kind \|\| group.id`; `/api/tastes/catalog` sends `group.category`. |
| Shelf order changed between loads | Shelves rendered in request-completion order. They now follow `DISCOVERY_SHELVES`. |
| Search lost focus while typing; the field collapsed to “korr” on phone | `paint()` rebuilt the whole view (input included) after each response. It now repaints only the chips, results and table note once the shell exists. |
| “Loading…” text | Skeleton shelves on `--color-surface-sunken`; pulse is off under reduced motion. |
| Busy state ended before shelves arrived; URL updated late | `loading` stays true until the shelves load, then the URL syncs. |
| Undefined tokens in D-07 CSS | `--color-surface-raised` → `--color-surface` (cards had no surface), `--color-border-subtle` → `--color-border`, `--page-padding` → `--page-pad`. |
| Search field unstyled; text “Clear search” used up to 40% of the row on phone | Pill field with a search icon, focus ring, and an inline × that keeps #27’s show-when-text behavior. Sticks under the app header instead of behind it. `role="search"` landmark. |
| Every shelf’s first card became a hero | One lead card, on the first shelf only. Hero height is capped at 16:9 on tablet and 21:9 on desktop, so it doesn’t fill the screen. |
| Desktop shelves scrolled sideways | Rows of 4 at ≥1024 (5 at ≥1440), no horizontal scroll, per §12.1. |
| Same “Easy” / “Simple” on every card of the Easy or Simple shelf | The meta line drops a trait that the shelf or an applied chip already guarantees. |
| “Clear all” on its own line under the count | Count and “Clear all” share one row. |
| Card hover/focus | Shadow and 1.02 photo scale on hover (pointer only), a visible focus ring on the card, `aria-labelledby` on each shelf, “See all {title}” accessible names. |

Already fixed by #27, so not duplicated here: Under 30 min toggle, Clear search hidden when empty, 5-column tab bar, one-line meta row, “Pick one for us” as a secondary button.

## NOTES (not fixed here; Composer or follow-up)

Notes 1, 3, 4 and 8 are decided in `docs/D07-CLOSURE-UX.md` (time chip toggle without caret; Diet group removed in favor of “On the plate”; Why this one and servings; seafood sub-line). Note 2 (group chips) is optional for V1 closure.

1. **Time chip caret.** “Under 30 min ▾” and `aria-haspopup="menu"` promise a menu that doesn’t exist; the chip is a toggle. Either build the §6.2 menu or drop the caret and `aria-haspopup`. 45 and 60 minutes are reachable only through Refine.
2. **Group chips missing.** §6.1 puts Cuisine ▾, Type ▾ and Main ▾ in the chip row. Only Refine offers them today.
3. **Refine has a Diet group** (Plant-forward, Vegetarian, Dairy-free) and Protein/Texture groups. §17 says no dietary chip in V1. “Dairy-free” next to the household’s real limits invites confusion. Product call.
4. **Recipe from Find, “Why this one”** shows the filler “Clears your household’s hard limits.” §8.5 says to show it only when the card had a taste reason. The servings stat read “1 serving” for a two-person table in the hosted walkthrough.
5. **Refine on phone** opens as a centered dialog rather than a bottom sheet (§6.4).
6. **No-text-match empty state** lacks the shelves below it and the “Change who’s eating” button (§11.1). The relax state works.
7. **Recipe Back label** reads “Find”; the spec says “Back”. Harmless.
8. **Shelf subtitle copy.** “From the sea, not land meat” (Fish & seafood) reads oddly; suggest “Fish and shellfish dinners”.
9. **Good matches never triggered.** A member with Love: Japanese and Like: Salmon still saw “Fits your table”. Check that `primary_reason` returns `taste_love` / `taste_like` for discovery results.
10. **Thai Basil Eggplant Stir-Fry** shows the placeholder plate in shelves although `public/images/meals/thai-basil-eggplant-stir-fry*.webp` exist.
11. **Hero scrim colors** use `var(--color-text-on-dark, #fff)` (not a defined token) and raw `rgb()` values. That works in every theme because the scrim is always dark, but it bends the tokens-only rule.
12. Non-D-07 CSS still references `--color-border-subtle` (four places around line 4020–4160).

## Remaining risks before E2E

- The preview must carry the stack-overflow fix before any E2E run; otherwise every Find spec fails at first paint.
- Plan modes (`replace_plan_meal` from Swap → See all options, `choose_for_plan` from Pick one yourself), Add to plan with open slots, and Cook tonight mutations were not exercised here. The review household has no plan. These are the riskiest flows for E2E.
- Discovery is the first `pushState` user. Back is verified for Find → recipe → Back. Not verified: Back after Cook tonight (should land on Tonight) or after Use this (`history.go(-n)`).
- Dark Mode and the other themes were not screenshotted for the new search field and card border.
