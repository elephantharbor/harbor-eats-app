# Final UX review — FlavorWeave Alpha Readiness

Reviewed on the candidate branch against the UX decision card (Back, who’s eating, recipe changes, Why this one?) and brief sections 44–51, 57, and 61. Screenshots are in `docs/alpha/review/`.

The walk used Playwright at 390×844 (phone) and 1280×800 (desktop). Adapt, explain, and interpret calls were mocked or blocked so the daily model budget was not spent. Find “salmon” used the lexicon path (no interpret call). The hosted preview (`https://90d178c9.harbor-eats-cycle1-preview.pages.dev`) was the starting point; the shots and the fixes below are from this candidate, served locally with the same 85-meal catalog and consumer Weave turned on in the browser.

Household used for the phone walk: Renata, Tom, and Sam, with nuts off for Renata.

## Release-blocking

These failed the card’s Back rule: system Back and the on-screen Back must do the same thing, and an open sheet closes before the screen changes.

1. **System Back with a sheet open left the plan.** The first history entry was Home. Opening Who’s eating or Swap pushed a sheet entry on top of that. System Back landed on Home and left the sheet open. On-screen Back already closed the sheet. Fixed: one in-app history guard per screen, system Back closes the top sheet and stays put, and Back from Home still leaves. Find keeps its own history, and leaving Find does not leave a Find address under the plan.
2. **System Back from the kitchen did not offer “Resume step {n}”.** Back correctly returned to the recipe, then the primary button still said “Start cooking” and would begin again at step 1. It now reads “Resume step 1” (or the step you were on) and reopens that step. Leaving with Exit still asks first and does not pretend the dinner was cooked.

Both are covered by `e2e/specs/alpha-navigation.spec.js` and `test/alpha-navigation.test.js`.

## High-value bounded polish

Fixed on this branch, with tests where the behavior is deterministic.

| What was on screen | What it is now |
|---|---|
| Welcome pillar “Safe” | “Limits”. “Safe” is not a food claim. |
| “Hard limits always win” on the limits step, and “Hard limits win, likes nudge” on Home | “These always win…” and “Limits win, likes nudge”. |
| Who’s eating tile said “You” | The name you entered (Renata, Tom, Sam). |
| Shop header used the smallest diner count and dropped a second exception | “3 dinners · cooking for 3, Dinner 2 for 4” when one dinner has two guests. Zero exceptions stay “cooking for {household}”. More than two exceptions say “amounts match each dinner”. |
| Someone absent was “someone’s out” | “Sam’s out” when exactly one person is away. One person eating is “For 1 · just Renata”. |
| Shop had no top Back | Top Back says Tonight. After the plan is confirmed, system Back from the list also lands on Tonight. |
| “See all options” Back said only “Back” | The label is Plan (or Tonight / Shopping list / Home, from where you opened it). Accessible name is “Back to Plan”. |
| A requested substitute that conflicts with a diner’s limits waited for the model | “swap cashews for peanuts” with a no-nuts diner is refused before any provider call. Removals and unknown names still go to the model, then fail closed. A permitted cashew exception is not blocked. |
| A 404 in the first moments after deploy failed the binding check | `/api/health` and `/sw.js` retry a 404 twice (three tries, 400ms apart). Any other status is not retried. |

Service worker cache is `fw-sw-v59` because the shell (including `index.html` and `app.js`) changed.

## Nice-to-have

Left as they are.

- Plan cards put “For 3” on its own control under the title. The time and effort sit on the photo. Readable, just not one meta line.
- The teaching screen “How it works” still says “Hard limits” as a diagram label. That screen is not on the household path.
- Some shop lines stay in decimals when the amount is not a common fraction (`0.188 tsp`, `0.751 tsp`). Common fractions already snap (`3/4 cup`, `2 1/4`).
- “Back to your plan” at the bottom of the list goes to Tonight, same as the top Back, but the words don’t say Tonight.
- Recipe ideas such as “Prep ahead?” did not appear in the first composer screenshot. The starters exist in code; this pass did not treat a missed first paint as a blocker.
- “Fits both of you” / “Fits everyone cooking tonight” is the existing fit line. It does not say “safe”.

## Household checklist

| Step | Result |
|---|---|
| Onboarding | Welcome, kitchen name, three people, limits, tastes, invite skip, then Home. Voice on the limits step matches the card. |
| Plan, Weave | Composer opens with “Three easy dinners”, “Fish twice”, “Lighter this week”, “One special night”. No interpret call on that open. |
| Plan, manual | Three dinners: spring rolls, quesadillas, arctic char. Dinners 2 and 3 say “Easy, like you asked” and offer Why this one? Dinner 1 (not easy) correctly has neither. |
| Diner counts and guests | Who’s eating closes on system Back and stays on the plan. Two guests save as “For 4 · 2 guests” and “Cooking for 4”. |
| Find | “salmon” returns meals with no interpret call. A fuzzy line is mocked and does not hit the provider. |
| Swap | Sheet closes on system Back and stays on the plan. See all options returns to the plan with the sheet closed. Back on that screen says Plan. |
| Recipe change | Advice first (“Parsley works here instead.”), Apply to Dinner 1, Your version, See what changed, Undo, system Back closes the sheet. Nothing changes before Apply. |
| Why this one? | Expands under the dinner. Copy stays on the table’s request. |
| Shop | Header names the household and the one exception. Top Back is Tonight. Checking a line works. System Back returns to Tonight. |
| Cook | “Cooking for 2”, step 1 of 3. System Back returns to the recipe with “Resume step 1” and resumes step 1. |
| Rate | “How did you like it?” with a separate score for each person. System Back from the form returns Home. |
| Back elsewhere | Plan review Back is Home. Recipe from the plan is Plan. Reduced motion: welcome animation is `none`. Desktop welcome and the members step use the same voice and the side-by-side welcome layout. |

Console 401s before a kitchen exists are the session probe, not a broken screen.

## Screenshots

Phone, 390×844, unless noted.

- `01-welcome-mobile.png` — welcome, Limits pillar
- `02-create-kitchen.png` through `08-home.png` — onboarding and Home
- `09-plan-weave-composer.png`, `10-plan-starters.png`, `11-plan-review.png` — Weave and the three-dinner plan
- `12-whos-eating.png`, `13-guests.png`, `14-plan-after-guests.png` — names, guests, “For 4 · 2 guests”
- `15-find.png`, `16-find-salmon.png`, `18-find-fuzzy.png`
- `19-swap-sheet.png`, `20-swap-see-all.png` — Back label Plan
- `22-recipe-detail.png` through `26-see-what-changed.png` — advice, Apply, Your version
- `27-why-this-one.png`, `28-plan-confirm.png`, `29-shop.png`
- `30-tonight-cook.png`, `30-cook.png`, `31-resume-step.png`, `32-rate.png`
- `33-reduced-motion-welcome.png` — motion reduced, same layout
- `34-desktop-welcome.png`, `35-desktop-members.png` — 1280×800
