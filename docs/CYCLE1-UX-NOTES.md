# Cycle 1 UX notes

Branch: `feature/fw-c1-ux`, cut from `feature/flavorweave-alpha-remediation` at `cda0dc75079ba82a4c2c9248a2301835b50b26b7`.
Model: Claude Opus 5.5 (`claude-opus-5-5`).
Pull request: not opened. `ManagePullRequest` refused with `must be a collaborator`. The child branch is pushed; the integration branch was not touched.

Scope: FW-05, FW-06, FW-07, FW-09, FW-10, and the October 1 retest. D-01 through D-06 are not implemented. The tofu recipe text and catalog content belong to the catalog branch (`feature/fw-c1-catalog`) and were not edited.

Untouched: production `main`, Cloudflare Pages and Worker deploys, and production D1. No migration was added or applied. No Household 001 data was read or written. All QA ran against `wrangler dev --local` with a local D1, in QA mode.

## Commits

| SHA | What |
|-----|------|
| `aeebf6b5205331ddc994a598703145638f9b1572` | Hard diet limits per diner, explicit allergy exceptions (FW-06) |
| `f735465d3d00cc5f9b297772c1eb8d05d27cbdde` | Explanation copy gated on stored evidence (FW-09) |
| `36060d7993aa62cb79b0a6801ec69403069783b4` | Invite and recipe origin, view vs choose, next-dinner round, step 1 names (FW-05, FW-07, FW-10, October 1) |
| `1244906ae940ac74344112e148efe1ec9fae3052` | First plan waits for likes; repeated like lines stay honest; cashew tile wording |

## October 1 retest

Each check ran on a fresh synthetic QA kitchen (`?qa=1`, so every write carried `X-FlavorWeave-Data-Origin: synthetic` and the household stored `data_origin = synthetic`, `acquisition_source = synthetic_qa`). It never counts as Household 001 evidence.

| Check | Before (at `cda0dc7`) | After | Regression test |
|-------|----------------------|-------|-----------------|
| Blank kitchen name accepted | **FAIL.** A blank name was silently saved as “Our kitchen”. | **PASS.** Continue stays on step 1, shows an inline error, and marks the field `aria-invalid`. Whitespace-only counts as blank. No household is created. | `e2e/specs/cycle1-ux.spec.js` › blank kitchen name is not accepted |
| Household name becomes the diner’s name | **FAIL.** “The Parkers” became the first diner’s name. A blank kitchen made a diner called “Our kitchen”. | **PASS.** Step 1 now asks for the kitchen name and “Your name” separately. Both are required. Going Back to step 1 renames the same kitchen and diner instead of creating a second household. | cycle1-ux › household name never becomes the diner’s name; › going back to step 1 renames… |
| Added member disappears after reload | **PASS.** Sam persisted as Invited. | **PASS.** Members match after reload in both the API and Settings. | cycle1-ux › added member survives a reload… |
| Empty first set of picks | **PASS.** Three cards. | **PASS.** Three cards with HH001-style limits. If a plan ever comes back empty, Tonight now shows a “Try again” state instead of a blank grid. | cycle1-ux › added member survives a reload, and the first round is not empty |

Note: reloading mid-onboarding after adding a person still lands on Tonight. The server already treats two members as onboarded. That was true before this cycle. Limits stay editable in Settings.

## FW-05 · Invite navigation

**Decision.** One invite screen, two navigation contexts.

- **Onboarding invite** (step 5 of 6) keeps the brand-only chrome, the progress dots, and Back to the taste step.
- **Household invite** (from Settings or Home) runs in household mode:
  - It keeps the full app shell and main nav, with the section it came from lit.
  - The title reads “Pull up another chair”.
  - There are no step numbers or progress dots.
  - Back is labelled with its real origin: Settings or Home.
  - “Done” returns there too.
  - Sending copies the link and stays on the page.
  - A note says the kitchen, limits and likes stay exactly as they are.

**Behavior changes.**

- `public/nav-context.js` (new) decides origin, Back target, Back label, the lit nav section, and chrome for each child screen.
- An established kitchen can no longer reach the create, members, limits or taste steps. Those requests go to Home.
- Taste likes are never touched by the household invite. The e2e check confirms the Profile still shows them afterwards.

## FW-06 · Diet controls

**Decision.** Hard limits and likes are separate vocabularies:

- Limits are on step 3 and in Settings → “Your diet limits”.
- Likes are on step 4 (“These are likes, not limits”).

No asterisks, daggers or footnotes. Each limit tile says what it covers:

| Tile | Covers |
|------|--------|
| No dairy | Milk, cheese, butter, yogurt |
| No meat | Beef, pork, lamb, and poultry too |
| No poultry | Chicken, turkey, duck. For diners who still eat red meat. |
| No fish | Salmon, cod, and other finfish |
| No shellfish | Shrimp, crab, lobster, clams |
| No nuts | Peanuts and tree nuts, cashews included |
| Cashews are OK | Appears only under No nuts: “An exception to No nuts. Every other nut stays off.” Unticking No nuts removes it. |
| No limits | Everything’s on the table |

How the model behaves:

- **Fish is an eligibility rule.** It stays on the menu unless someone switches on No fish.
- **The old “Finfish OK” taste spark is now “Fish dinners”.** It is a like, and it is hidden for diners who have No fish on.
- **The demo card** splits “Hard limits” from “Likes”.

**Behavior changes (`src/lib/eligibility.js`).**

- **Per-diner evaluation.**
  - Each diner’s rows form one profile, and a meal must clear every profile.
  - Rows with no `member_id` apply to everyone.
  - A shared prohibition can never be relaxed by one diner’s exception.
- **Explicit exceptions.**
  - `cashew_ok` is stored as `{ rule_key: "cashew", status: "permitted" }`. It only relaxes that diner’s own `nuts` rule, and only for cashews.
  - A bare `nuts` tag that names no kind is never cleared by an exception.
  - An exception without its parent limit is dropped.
- **Name scan.** Ingredient words in a dish name count as tags even when the stored tags miss them.
  - Whole words only, so coconut is not a nut and butternut is not butter.
  - Peanut butter is treated as peanut, not dairy.
  - This closes a live gap: `mushroom-walnut-bolognese` is tagged only plant, dairy-free and pasta.
- **Replace on save.** `POST /api/members/:id/constraints` accepts `replace: true`, so the submitted list becomes that diner’s full set and unticked limits are deleted.
  - Before, unticking a limit in Settings never removed it.
  - Settings also edited the first member’s limits instead of the signed-in diner’s. Both are fixed.
- **Joining.** Invite join stores exception rows with the right status.

Taste never reaches eligibility. Scoring runs only on meals that already cleared every limit. A test shows a 9-weight like and two 10/10 ratings cannot bring back a prohibited meal.

**HH001 compatibility.**

- HH001’s diet (no dairy, no shellfish, no meat but fish, no poultry, nuts prohibited except cashews) keeps plant and fish dinners eligible.
- Without an explicit `cashew` permission row, No nuts still blocks cashews. That is the same strict default as before, so nothing is weakened.
- Cashew dishes appear only after a diner ticks “Cashews are OK” in Settings. Real Household 001 data was not changed.

D-02 compatibility: the change adds rows and statuses only. Exceptions are a small table (`RULE_EXCEPTIONS`), so a richer dietary model can replace the vocabulary without changing how profiles are intersected.

## FW-07 · Next dinner

**Decision.** A single “Find our next dinner” action after a rated meal. No week planning.

**Where it appears.**

- The “Everyone rated dinner” screen, as the primary action. Back home is secondary.
- The Home done stage.
- Tonight when the round is rated. The header reads “Last round · That round’s a wrap”, and the cards are dimmed with no choose buttons.

**Behavior changes.**

- **New plan.** Starting the next dinner creates a new plan on the server. The finished plan, its selection, cook and ratings are left alone and stay in History.
- **Separate rounds.** The new round says “Fresh picks · new round” and points to the last dinner in History. `/api/sessions/me` now returns `previous_meal`, the latest cooked or rated meal from an earlier plan, so this survives reload. Old picks are dimmed and read-only; current picks are live.
- **Locked rated round.** The reducer refuses to change selection on a rated round. Tests run both the server and client reducer copies.
- **Only when fully rated.** The action appears only when the round is fully rated. A partly rated dinner still points to “Rate dinner” first, as before.

## FW-09 · Explanation copy

**Decision.** The smallest evidence gate that keeps claims honest, inside the existing Taste Model v1. No rewrite.

| Kind | Needs | Label | Example line |
|------|-------|-------|--------------|
| Repeat success | Same recipe, ≥2 ratings, average ≥8 | Worth another round | Rated 8.5/10 on average when you made it |
| Made before | Same recipe, any rating below that bar | Made it before | You gave it 9/10 last time |
| Known preference | A stored like on the meal | Matches your likes | You said you like taco night. With weight ≥3: You keep picking taco night |
| Strong similarity | ≥3 ratings over ≥2 related recipes, average ≥8 | Your kind of dinner | Same family as …, which you rated 8.7/10 |
| Tentative similarity | One related rating averaging ≥7 | Worth a try | A little like …, which you rated 8/10 — an early hunch, not a sure thing |
| Exploration | No evidence, high novelty | Something new | A fresh direction; your ratings will tell us if it’s a keeper |
| Starter / fit | No evidence | Good starting point / Fits your table | Clears everyone’s hard limits… |

**Behavior changes.**

- **Diet tags no longer count as taste.** Diet and protein tags (plant, dairy-free, fish, nuts and so on) no longer create similarity. One rated tofu dinner used to make every plant dinner look “similar”.
- **Shrunk similar evidence.** Similar ratings are shrunk toward neutral by count. The +0.8 boost is reserved for repeat success.
- **Confidence is per meal.** It counts only evidence about this meal, not the household’s total number of ratings.
- **Deduped within a set.**
  - Claim-free labels never repeat within one set of picks; repeats fall back to a factual alternative such as Weeknight quick, Easy win, Something new or Fits your table.
  - Evidence labels are never swapped.
  - If two picks match the same like, the second says “Same like, different dish: fish dinners.” instead of borrowing an unrelated fact.
- **Tags counted once.** Tags and sparks are deduplicated, so the copy cannot say “taco night and taco night”.
- **Labels.** The “Why this one · Why this” stutter is gone. The client drops any stored label starting with “Why this”, and the detail kicker is always “Why this one”, or “Last time” for a past round.
- **Taste profile.** It says “Your first rating: 9.0/10. One dinner in — still early days.” for a single rating. “You keep coming back to …” needs repeated likes.

Note: synthetic QA households never feed learning (the integration branch’s evidence isolation). Their picks therefore always carry claim-free copy, and the evidence tiers are covered by unit tests rather than e2e.

## FW-10 · Recipe navigation and view vs choose

**Decision.** Recipe detail remembers where it was opened.

| Opened from | Back goes to | Lit nav |
|-------------|--------------|---------|
| Tonight | Tonight | Tonight |
| History (“View recipe”) | History | History |
| Home | Home | Home |
| A deep link or unknown origin | Home, or the caller’s `parent` | Home |

Kitchen mode and back keeps the original origin. Contexts are plain JSON, so a future D-04 native Back can store them in `history.state` without changing the rules. D-04 itself is not built; Back is still an in-app button.

**Viewing vs choosing (FW-01 preserved).**

- **Choosing is explicit.** Opening a recipe never selects it. The detail screen says so: “Just looking — nothing’s chosen until you tap Choose this dinner” (or “Vote for this one” with more than one active diner). After choosing, it reads “Tonight’s pick”.
- **Past rounds are read-only.** A recipe opened from History shows “From a past round · rated X/10. Viewing it doesn’t add it to tonight.” It has no choose or cook button and loads the recipe version that was actually cooked.
- **Locked rounds.** When the round is locked, cards and detail drop the choose action.
- **Ratings stay bound to the cooked meal.** Kitchen insights and the rating’s recipe version only use the loaded recipe when it belongs to that meal, so a previewed recipe cannot leak into a rating.

## Tests

`npm test` on Node 22.14.0: migrations check, 241 unit tests in 24 files (194 at baseline), and eslint all pass.

New unit tests:

- **`test/dietary-eligibility.test.js`** (15 tests):
  - HH001 with and without the cashew exception
  - fish as eligibility
  - name-scan edge cases and a bare `nuts` tag
  - No meat covering poultry
  - a cashew-OK diner with a strict-nuts diner
  - No meat with No fish
  - a shared prohibition that cannot be relaxed
  - three- and four-diner unions
  - a no-limits diner
  - taste unable to override a limit
- **`test/explanation-evidence.test.js`** (14 tests): low- vs high-evidence copy, plant-tag non-similarity, confidence per meal, label and line dedupe, and a fresh HH001-style plan with distinct labels.
- **`test/nav-context.test.js`** (18 tests):
  - origin, Back and lit nav for Tonight, History, Home and deep links
  - cook-exit context preservation
  - invite household vs onboarding mode
  - the onboarding-step guard
  - FW-01 preview-not-select and locked-round parity on both reducers
  - `previousCompletedMeal`

E2E: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --config e2e/playwright.config.js` against local `wrangler dev`, 26 of 26 passed.

- **New:** `e2e/specs/cycle1-ux.spec.js` (8 specs, all QA mode) covers the October 1 checks, FW-05, FW-06 and the full FW-10 + FW-07 loop. That loop runs Tonight → view → Back, explicit choose, cook, rate, “Find our next dinner”, a new plan, then History → past recipe → Back.
- **Repaired:** `meal-loop`, `meal-option-b` and both `responsive` specs were already failing at `cda0dc7`. They clicked cards expecting a selection, but FW-01 made cards open the recipe. They now view, then choose explicitly, and assert Back returns to Tonight.
- **Updated:** `helpers.js` fills the new “Your name” field.

## Visual fidelity

PASS WITH NOTES.

- New styles use existing tokens only.
- I checked the step 1 errors, diet limits, Tonight, recipe detail, household invite and Settings limits in Signature at desktop width. I checked Tonight and Settings limits in Dark Mode, at desktop and mobile.
- Citrus Berry, Fresh Herb and Cobalt Coral were not screenshotted, but `appearance.spec.js` passes and no theme tokens changed.
- Notes for FW-08 (images, not in scope here): step 1 uses a roast chicken photo and the invite screen uses peanut noodles. Both are decorative, but they sit oddly beside an HH001 diet.

## Risks and follow-ups

- **Catalog tags:** `mushroom-walnut-bolognese` needs `nuts` and `walnut` tags. The eligibility name scan blocks it for nut-free diners today, but tags are the real source. This is a hand-off to the catalog branch.
- **HH001 cashews** stay blocked until a diner ticks “Cashews are OK”. That is safe, but it hides cashew dishes HH001 can eat. Oversight should decide whether to set it with the household.
- **No meat now includes poultry.** A diner who ticked only “No meat” will no longer see chicken. That is stricter and matches the new tile copy.
- **Duplicated client vocabulary.** The client keeps its own copy of the key/row mapping (`constraintRowsFromKeys`) because `app.js` is not a module. The server copy is tested; the client copy is covered by e2e only.
- **Old plans** keep their stored explanation text until a new round is generated. Only the “Why this” prefix is stripped at render.
- **Partly rated dinners** do not offer the next-dinner action, as before.
- **QA screen switcher.** The debug screen switcher bypasses the onboarding guard by design (`force`) so QA can reach any step. Product buttons and the header nav do not.
