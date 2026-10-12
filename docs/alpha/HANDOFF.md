# HARBOR EATS → OVERSIGHT HANDOFF
## Alpha Readiness + D-04 + Household Scaling + AI Expansion Released

**In plain terms:** FlavorWeave Alpha Readiness is live in production (deploy `8dbf56b6`, main `0786a1d`). Here is what changed:
- Back now behaves predictably on phone and desktop.
- Every dinner is planned and shopped for the right number of people, including guests.
- You can ask "What would you change?" on a recipe, and nothing changes until you tap Apply.
- "Why this one?" explains a pick using only the facts behind it.

The release took **7 Preview deploys** against a target of one. The causes are listed under Execution Efficiency. The final hosted E2E was clean (67 pass / 0 fail). The production smoke passed and its synthetic data was cleaned up. **No real household Plan → Shop → Cook → Rate loops are recorded yet.** That is the next thing to get.

---

### Starting state
- D-06.1: complete before this cycle began (ARCHITECTURE card says "This base already contains D-06.1 and the wave-13 catalog integration").
- Queued 10-meal expansion (Wave-13): complete before this cycle. It ran on Grok 4.7 cloud agents (PR #53 merged).
  - Catalog went from 75 to 85, merge `18b77d2`, prod deploy `bd2cc584`.
  - The audit found 2 FAILs. Both were fixed and re-audited, giving 10/10 PASS.
- Starting catalog: **85** (`catalog_runtime_meals=85` on every preview and on production).

### D-04
- **Navigation model:** there are three layers:
  - places: top-level tabs Home, Tonight, Find, History, Profile
  - steps: task flows plan / shop / cook / detail / rate
  - surfaces: `<dialog>` sheets

  Tab switches use `replaceState`, so they don't stack. Back from any tab goes Home, and Back from Home leaves the app. Finished tasks (plan confirmed, cook finished, ratings saved) drop out of Back.
- **Back precedence:** one function serves both the on-screen Back and `popstate`. It applies these rules in order:
  1. Close the top sheet.
  2. From detail or cook, return to the task that opened it and restore its state.
  3. From a task step, go to the step's logical parent.
  4. Go to the earlier destination.
  5. Let the platform leave.

  The Find `history.back()` path was removed. The on-screen Back label names where it goes ("Plan", "Tonight", "Shopping list").
- **PWA/mobile:** each forward navigation pushes one `{fw:1,…}` frame, and a sheet open pushes a transient frame. System Back closes an open sheet and stays on the screen. The final UX review found and fixed a blocker where system Back left the plan with the sheet still open. Back from the kitchen returns to the recipe with "Resume step {n}". The SW stays network-first (now `fw-sw-v61`).
- **Deep links:** a cold open gets a named logical parent through `replaceState`, with no fake history entry:
  - `/meal/:slug?from=find` → Find
  - a plan meal → Tonight or planReview
  - a meal with no plan row → Find
  - `/find?mode=…` → planReview
  - `/rate/:id` → Tonight
- **State restoration:**
  - Find: query, mode, scroll and focused slug.
  - Replace and choose-for-plan: plan id, meal and position.
  - Weave plan: the sessionStorage state.
  - Shop: scroll position. Checked lines stay on the server.
  - Cook: `cookStep` and `dinnerCookMealId`.

| Flow | Result |
|---|---|
| shop → recipe → Back | PASS |
| cook → recipe → Back → Resume | PASS (after two hosted-only timing fixes; see Testing) |
| deep links into and out of the plan | PASS |
| swap sheet: system Back closes it | PASS |
| choose-for-plan → Find → Back | PASS |
| plan → recipe → Back | PASS |
| Prod: Tonight → recipe → system Back | PASS (Back labeled "Tonight") |

### Household diner model
- **Default:** `diner_count = eligible_participant_ids.length + guest_count`. Participants default to every **active** member. "Add someone who eats with you" now creates an active member. Invited members don't count.
- **Eligibility:** `assessMealEligibility` still intersects the full set. An ineligible member is never silently dropped to make a meal fit. Cooking it for the others is an explicit override.
- **Per-dinner override:** `set_participants` and `set_guest_count` in one "Who's eating {Dinner N}?" sheet with member tiles and a Guests stepper. Each change re-runs eligibility and `syncShopping`.
- **Guests:** implemented. `guest_count` is 0–6 and the total is clamped to 1–8 diners. Guests are unnamed covers: no member id, limits, taste or rating.
- **Source of truth:** the plan meal's participants plus `guest_count` (migration 0016). `diner_count` is derived and never stored. `servings_default` stays unused.

### Shopping scaling
- **Root cause of the one-person behavior:** the scaling math was fine. The diner count fed into it was wrong:
  - Only *active* members counted, and onboarding stored added people as `invited`, so a two-person kitchen planned for 1.
  - The `/for serving/i` skip froze lines such as rice.
  - Recipe detail used a separate count (`activeMemberCount`, which falls back to 1).
  - `Math.max(1, …)` floored countables.
- **Recipe scaling:** `scaleForDiners` is now the only quantity function for recipe detail, cook and shopping. Ratio is `diner_count / base_servings`. Countables under 0.5 stay fractions, and per-serving rows give one per diner.
- **Shopping scaling:** prod smoke for 3 diners showed pinto beans at 22.5 oz (base 30 oz / 4). With +1 guest it became 30 oz, and cilantro went from 0.375 to 0.5 cup.
- **Aggregation:** `aggregateContributions` merges lines with the same id and a compatible unit. Preview R4: chili parsley 0.375 cup + mussels parsley 0.188 cup merged into one 0.563-cup line.
- **Checked state:** a diner-count change, swap, add or remove updates quantities without clearing `purchased` or `already_have`. A substitution retires the old line and adds a new open one.
- **Diner changes:** preview scenario changed 17 of 28 lines after a +2 guest override (3 → 5). The prod +1 guest change is shown above.
- **Tests:** the servings matrix from ARCH §6.3 covers:
  - active default, invited and ineligible exclusion, override, guests
  - scales 1–4, fractions, `for serving` rice
  - onion aggregation, swap, diner change, purchased-line preservation
  - detail and shop agreeing

  All of these are inside `npm test` (986 passed on `887b93c`).

### Quantity UX
- "For N" on plan cards, e.g. "For 4 · 2 guests", "For 1 · just Renata", "Sam's out".
- "Cooking for N" on recipe detail and in kitchen mode (prod smoke: "Cooking for 4").
- A shop header line, e.g. "3 dinners · cooking for 3, Dinner 2 for 4". More than two exceptions show "amounts match each dinner".
- A recipe browsed outside a plan gets a temporary viewing stepper that is never saved.

### Recipe adaptation
- **Weave UX:** recipe detail has a collapsed "What would you change?" composer (opened as a sheet from kitchen mode).
  - Working state: "Weaving that together…".
  - The validated reply is revealed after it arrives.
  - A change preview follows, then "Apply to Dinner N".
  - Once applied, the recipe shows a "Your version" badge, marked rows and steps, and "See what changed" with per-change Undo and "Back to the original".
- **Task schema:** `recipe_adaptation@3`, Luna only (`gpt-6-luna`), `reasoning_effort: none`, cap 520, cache on.
  - Strict output: acknowledgement, kind, support, `ingredient_ops` (replace/remove/add with policy `keep_scaled`/`omit`/`to_taste`), step_notes, equipment_supported, flavor_impact and warning.
  - The output has **no quantity, servings, allergen or eligibility fields**.
- **Structured model:** the server resolves `to_name` and builds `override_json` after the safety check. The model payload is never stored raw.
- **Advice vs Apply:** `POST /api/recipes/adapt` only gives advice. Writes happen only through `apply_adaptation`, undone by `clear_adaptation`. Both are allowed only while a meal is planned or selected.
- **Canonical protection:** the override lives on the meal, keyed by `recipe_version_id`, and `catalog_version` is never updated. Swapping the meal clears the override. These routes don't write taste or ratings.
- **Safety validation** runs at two layers:
  - Before the model: a deterministic substitute check refuses, for example, peanuts for a no_nuts diner with no provider call.
  - At apply: `validateAdaptationSafety` re-runs. The peanut check returned 409 in R3, R4, R5 and on prod. Forged `override_json` was also blocked.
  - Ops for an ingredient that isn't in the recipe are rejected (409).
- **Shopping effects:** rebuilt from the overridden pin. Prod: the cilantro line disappeared and parsley 0.5 cup appeared.
- **Undo:** `clear_adaptation` deletes the row and the catalog pin is kept. Back never undoes data.

| Example | Result | Evidence |
|---|---|---|
| Substitution (cilantro→parsley, chili) | PASS | R3 eval and scenario; prod Luna call 1 (replace, keep_scaled) |
| Flavor (less spicy, chipotle tofu tacos) | PASS | R5: remove chipotle powder plus step note; the apply removed the shop line |
| Simplify (lomo saltado) | PASS | R3 `kind: simplify`. R4 showed its ops dropped (defect R4-1, fixed in R5) |
| Equipment (air fryer, spring rolls) | PASS | R5 reply: "The recipe already uses an air fryer.", no Apply |
| Unsafe (cashews→peanuts, no_nuts) | PASS | rejected_safety (R3/R4); peanut apply 409 (R3/R4/R5/prod) |
| Unsupported (Butter Chicken, no pressure cooker) | PASS | deterministic `unsupported`, 0 provider calls (R4/R5). It FAILED in R3 (malformed output → fallback), and that was fixed |

### Personalized explanations
- **Packet:** built deterministically by the ranker.
  - Up to 6 closed facts. Kinds: taste_agreement, taste_like, easy, simple_ingredients, quick, novelty, fatigue, plan_fit, find_intent.
  - `basis` is learned, onboarding, run or cold.
  - `strength` is strong or weak.
  - An `evidence_fingerprint`.
  - Allergens and eligibility are never facts.
- **Grounding contract:** `explanation@3`, Luna, cap 300. Output is `{text, used_fact_ids}`. `post_validate` rejects:
  - fact ids that aren't in the packet
  - authority claims
  - digits that weren't allowed
  - phrases that weren't attached to a used fact
  - "you love/tend" wording on a cold or run basis

  A rejected output gets one repair, then the template.
- **Cold start:** weak or cold packets get the server template, or nothing, with no Luna call. Verified in R3 and R4 (cold and weak gave the template, 0 calls).
- **UX placement:** a deterministic reason line sits on plan cards. "Why this one?" expands in place and is fetched only on tap. Small Find grid cards are omitted, and the static "Fits everyone's limits" line was removed.
- **Caching:** uses the gateway `ai_cache` key (task, prompt version, model, input including the fingerprint), so a changed packet misses the cache. R4-4 found that a prompt change without a version bump served stale rows. Bumping to @3 rotated the keys.
- **Representative evidence:** every grounded provider output we have is the same sentence, "Easy on a weeknight with simple ingredients." (used: easy, simple; R4, R5 and prod). No taste-based (learned) explanation has been observed live yet.

### AI safety
The LLM cannot authoritatively decide any of the following. Each is enforced by the schema or by server code:
- **Allergens:** not in the schema; the server checks them before the model and at apply.
- **Dietary eligibility:** `assessMealEligibility` is server-only.
- **Servings:** derived `diner_count`.
- **Ingredient scaling:** `scaleForDiners`; the model only gives a `policy`.
- **Shopping quantities:** `syncShopping` from the pin.
- **Recommendation eligibility:** the ranker or planner.
- **Taste score:** no `diner_taste` writes from these routes.
- **Canonical recipe mutation:** the override is per meal and the catalog is immutable.

Sol: 0 calls. Plan, Find, Shop, Cook and Rate still do not import `src/ai`.

### Unified AI UX
- **Reuse:** adaptation uses `WeaveStrip` (`public/recipe-weave.js`). Explanations use the Weave mini mark and the D-06 reveal rules. There are no feature-specific widgets.
- **Typing reveal:** word by word, only after validation, at most 900 ms, and a tap completes it.
- **Motion/working state:**
  - The strands expand while the recipe dims to .55.
  - On Apply, an accent bar draws once (240 ms).
  - With reduced motion: static strands, instant text, and the welcome animation is `none` (verified).
- **Mobile:** reviewed at 390×844 and 1280×800. Kitchen mode opens the composer in a sheet.
- **Opus findings:** Opus 5.5 produced the UX decision card only (1 invocation). It set the Back model, diner wording, advice-then-Apply flow and explanation levels. Opus did not review the rendered build: Thomas reassigned the final design review to Grok 4.7.

### Alpha-readiness review
- **Journey reviewed** (FINAL-UX-REVIEW, phone household Renata/Tom/Sam, AI calls mocked): onboarding → Weave and manual plan → who's eating and guests → Find → Swap → recipe change → Why this one? → Shop → Cook → Rate → Back everywhere.
- **Blocking issues, both fixed:**
  1. System Back with a sheet open left the plan.
  2. Kitchen → Back didn't offer "Resume step {n}".
- **High-value polish, fixed:**
  - "Safe" became "Limits".
  - "Hard limits…" copy softened.
  - The Who's eating tile shows the real name instead of "You".
  - The shop header lists multiple exceptions and the "{Name}'s out" wording was added.
  - Shop got a top Back to Tonight, and the "See all options" Back is named.
  - The peanut-type conflict is refused before any provider call.
  - `verify-binding` retries a 404.
- **Defects found in Preview rounds, all fixed before prod:**
  - D1: AI tasks disabled in config.
  - D2: adapt returned 500 on gateway fallback.
  - D3 (P0): peanuts were accepted for a no_nuts diner.
  - D4: hardcoded taste phrase.
  - R3-1 to R3-4.
  - R4-1 to R4-4.
  - Two hosted-only cook-CTA timing regressions.
- **Intentionally deferred:** see Deferred items.

### Real-household readiness
Tom/Renata real-use checklist:
1. Make sure both of you are **active** members (not invited). Check that plan cards say "For 2".
2. Plan 3 dinners for this week. Use Weave once ("three easy dinners") and swap one dinner using Find.
3. Mark one dinner with a guest, check the shop header line, and shop from the list in the store. Note any odd amounts.
4. Before cooking one dinner, ask "What would you change?" once. Apply only if you'd really cook it that way.
5. Open "Why this one?" on at least one card and see whether it rings true.
6. Cook from kitchen mode at least twice. Use phone Back mid-cook at least once.
7. Rate each dinner (both of you) the same night.
8. Keep a one-line note per dinner on anything confusing, wrong or delightful.

### Telemetry
- **Coverage on the dinner-plan path:**
  - plan: `plan_created`, `plan_edited`, `dinner_selected`
  - shop: `shopping_opened`
  - cook: `cook_started`, `cook_completed`, with legacy `cook_recorded` kept
  - rate: `ratings_completed`, with `loop_completed` kept
  - adaptation: `adaptation_requested`, `_applied`, `_undone`
  - explanation: `explanation_opened` (source, basis)
  - NLP: `weave_route_chosen` with `route: luna|bypass`
- **Privacy:** the `persistEvent` allowlist drops any field that isn't on it. No prompt, utterance, acknowledgement, adaptation sentence or explanation text is persisted. `ai_usage` stores no prompts or outputs. Synthetic ai_usage rows were kept for audit, as policy requires.
- Not yet verified with real users: no real-household events exist.

### Live AI evaluation
- **Luna calls:** 15 on preview on 2026-10-11 (R3 11, R4 2, R5 2; cap 15) plus 2 production smoke calls. **Sol: 0.** R1 made 0 calls because tasks were disabled.
- **Cost:** preview $0.001481 (R3 $0.001206 + R4 $0.000068 + R5 $0.000207). Production smoke $0.000165. Total ≈ $0.001646.
- **Latency (ledger):**
  - Adaptation: 1304–2714 ms on single attempts. The R3 Butter Chicken case took 5232 ms over 2 attempts. Prod: 3344 ms.
  - Explanation: 1378–2253 ms.
- **Adaptation accuracy:** R3 was 5/6 PASS; Butter Chicken was malformed and got the fallback. Rules were then fixed:
  - Butter Chicken was moved to a deterministic pre-check.
  - Name-keyed ops are no longer dropped.
  - Air-fryer confirmation is no longer shown as unsupported.

  R5 live re-check: 2/2 PASS. Prod: 1/1 PASS.
- **Explanation grounding failures:**
  - 0 unsupported facts in any provider output.
  - The R3 output was grounded but read as fragments, so the prompt was tuned.
  - Stale @2 cache rows failed the new validator and fell back to the template (R4-4, fixed by bumping to @3).
- **Corrections:**
  - Eval fixtures: the weak packet and the cilantro recipe were wrong.
  - The eval script's call counter and manual-fill bug were fixed.
- **Not run:** a live peanut interpret check after the @3 cache rotation, to stay within budget. Its pre-model refusal shipped afterwards.

### Testing
- **Unit/integration:** `npm test` on `887b93c`: **986 passed**, lint clean.
- **Targeted navigation:** `alpha-navigation.spec.js`, `d07-find.spec.js` and `test/alpha-navigation.test.js`. Against preview: 11/11 (R1, R3).
- **Serving/shopping:** the ARCH §6.3 matrix, inside `npm test`, plus the hosted scenario checks in R1, R3, R4 and prod.
- **AI:** the fake-provider adaptation and explanation suites, `alpha-readiness-ui.spec.js`, plus the live eval above.
  - Caveat: the UI specs mock `/api/recipes/adapt` and `/api/explain`, so they cannot catch real-endpoint failures (D2 slipped past them).
  - `meal-loop`, `alpha-navigation` and `alpha-readiness-ui` were also run with `E2E_COOK_DELAY_MS=1500`: 16 passed.
- **Full hosted E2E:**
  - `41049fa9` (e679efe): 63 pass / 1 fail. Cook → recipe → Back showed "Start cooking".
  - `72fffac0` (bdfa4c3): 63 pass / 1 fail / 1 flaky. The meal loop never reached the kitchen. The flaky test was Weave NL plan on a `goto` timeout.
  - **`d72cadd8` (887b93c): 67 pass / 0 fail / 0 flaky / 1 expected skip** (d06-no-ai), 16.8 min, 0 AI calls.
- **Retries:** `--retries=1` on every run. One flake in R7. The final run had no retries.
- **Tested runtime SHA:** `887b93c`. It shipped as squash `e41c942` (into the base) → main `0786a1d`, and production was deployed from `0786a1d`.

### Preview
- **Deployment:** final preview `d72cadd8` (https://d72cadd8.harbor-eats-cycle1-preview.pages.dev).
- **D1 binding:** `65bc636d`. Migration 0016 applied in R1, with a restore point taken first.
- **Catalog:** 85. consumer_ui true. SW `fw-sw-v61`.
- **AI config:** planning_intent, discovery_intent, recipe_adaptation@3 and explanation@3, all on gpt-6-luna. Sol only on recipe_draft, which is disabled.
- **Hosted household walkthrough:** synthetic 3-diner household (one no_nuts).
  - Every step passed: plan, default counts, override, shopping, Find, swap, adapt, apply, shopping change, explanation, cook, rate, Back.
  - Steps 8–9 needed fixes first (D1–D3).
  - Synthetic preview data was left as is; only the production cleanup was required.

### Production
- **Deployment:** `8dbf56b6` (https://8dbf56b6.harbor-eats-app.pages.dev; alias harbor-eats-app.pages.dev), from clean main `0786a1d`. Auto-review held the deploy, and Thomas approved it through the approval card.
- **D1 binding:** `23aa3db3`. Bookmark taken before the migration: `000000b5-00000000-00005102-cfc254fd0b8bb1db43196bf045056fb5`. Migration 0016 applied.
- **Catalog:** 85. consumer_ui true. SW `fw-sw-v61`.
- **AI config:** recipe_adaptation@3, explanation@3, planning/discovery @4, all gpt-6-luna. 0 Sol.
- **Targeted smoke:** synthetic household `hh_6c084587c98c`, 3 diners. Everything passed:
  - plan: 3×3 diners
  - scaling and guest change
  - Luna adaptation and apply
  - peanut apply 409
  - Luna explanation
  - cook and rate all 200
  - Back on prod

  2 calls, $0.000165.
- **Cleanup:** bookmark `000000b5-00000062-00005102-7eca672b3819c5da64285fdd30e99600`. `cleanup-synthetic-households.mjs`: 62 changes, orphan check 0/44. The re-query found 0 rows for the household, members, plan, shop lines, adaptation and sessions. ai_usage was kept for audit.
  - Housekeeping: the smoke output file that held the dead synthetic session cookie was deleted.

### Execution Efficiency
- **Workstreams:**
  1. Architecture card (#55)
  2. UX card (#54)
  3. Runtime implementation (#56)
  4. Final UX review
  5. Preview eval and E2E rounds 1–8
  6. Promotion
- **Models:**
  - Grok 4.7: architecture card, all defect fixes, final design review and full E2E. Thomas reassigned the last two.
  - Composer 2.5: main implementation.
  - Opus 5.5: early UX card only.
- **Opus invocations:** 1, for the UX decision card. The planned second Opus review of the rendered Preview went to Grok 4.7 instead.
- **Runtime PR count:** 1 (#56, 17 commits), merged via base PR #57. #54 and #55 were closed as superseded.
- **Rebases:** not recorded in the sources.
- **Preview deploys:** **7** (8224fd2f, 250f7fe6, 404b09be, 90d178c9, 41049fa9, 72fffac0, d72cadd8) against a target of one. Causes:
  - AI tasks disabled in config (D1)
  - the peanut safety bug (D3), along with the adapt 500 (D2)
  - eval regressions (R3/R4 rule and fixture defects)
  - two hosted-only cook-Back timing regressions (R6, R7)

  R2 stopped at CI with no deploy.
- **Full E2E runs:** 3 hosted, 2 of them failed broad runs. CI `verify` also failed once (R2: 61 pass / 1 fail / 1 flaky).
- **Steering turns:** not recorded in the sources.
- **Approximate wall-clock:** about 4h40m from the first preview eval to production (4:42 PM → about 9:20 PM CT, 2026-10-11). Design and implementation time before that was not recorded.

### Product evidence
- Real household plan, cook and rate loops: **none recorded**. All loops this cycle were synthetic, and the production one was deleted.
- Kitchen-tested meal count: **unknown / none recorded** in the sources.

### Deferred items
All non-blocking:
- Decimal shop amounts where the amount isn't a common fraction (e.g., `0.188 tsp`).
- "Hard limits" label on the "How it works" teaching screen, which is not on the household path.
- "Back to your plan" at the bottom of the shop list goes to Tonight, but the words don't say Tonight.
- "For 3" sits as its own control under the plan-card title, not in one meta line.
- Find-origin swap Escape edge case.
- Multi-dinner shop eyebrow picker.
- Pending cleanup of dedupe-classification history.
- `DEPLOYMENTS.md` row for `8dbf56b6` not added.

### Recommended Next Prompt for Oversight
> Do not start a new feature. For the next 1–2 weeks, Tom and Renata run the real-use checklist above on production: at least 3 planned dinners, shopping from the list, cooking in kitchen mode, and both rating each dinner. Then pull a read-only evidence report from production telemetry, covering:
> - plan_created / shopping_opened / cook_started / cook_completed / ratings_completed counts and drop-off
> - adaptation_requested / applied / undone, and the support mix
> - explanation_opened, by source and basis
> - weave_route_chosen, luna vs bypass
> - Luna calls and cost from ai_usage
> - client_errors on production
>
> Combine this with Tom and Renata's notes. Rank the deferred list and any new friction by how often it actually got in their way. Propose at most one bounded fix bundle (likely shop amount formatting and Back wording), using one Preview and one E2E. As housekeeping, add the `DEPLOYMENTS.md` row for `8dbf56b6`. Only propose a larger initiative if the real evidence shows a clear gap. Report kitchen-tested meal count and loop count honestly, including zero.
