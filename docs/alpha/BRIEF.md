# Harbor Eats — Alpha Readiness Integrated Product Cycle
## D-04 Navigation + Household Serving/Shopping Accuracy + Recipe Adaptation + Personalized Explanations
### Full Product Review → Fix Friction → One Integrated Preview/E2E/Production Lifecycle

Cora / Harbor Eats team —

Oversight is defining the next major Harbor Eats / FlavorWeave cycle.

# IMPORTANT SEQUENCING

Do NOT begin this work until the currently queued work is complete:

1. Finish:
   **D-06.1 — Semantic Breadth + Weave UX Hardening**

2. Then complete the already-planned:
   **10-meal catalog expansion**

3. Only after both are complete, begin the work in this prompt.

Do not interrupt, reorder, or partially start this cycle while those earlier items are still in progress.

When this cycle begins, treat the catalog state after the 10-meal expansion as the authoritative starting point.

---

# 1. Objective

This next cycle should combine four major goals:

## A. D-04 — PWA Navigation / Back Behavior

Make FlavorWeave navigation coherent, native-feeling, predictable, and task-aware across:

- Home
- Tonight
- Find
- Plan
- Shop
- Cook
- Rate
- recipe detail
- Weave interactions
- replace mode
- choose-for-plan
- modal/sheet flows
- deep links
- browser/PWA Back

## B. Integrated Alpha Readiness

Perform the first deliberate whole-product review from the perspective of a real household attempting to:

Plan  
→ choose/refine  
→ shop  
→ cook  
→ rate  
→ learn  
→ return for another meal.

Find and fix meaningful friction discovered during that review.

## C. Household Serving + Shopping Quantity Accuracy

Ensure recipe servings and shopping-list ingredient quantities reflect the actual number of people eating each dinner.

The app should:

- default sensibly from the household,
- support per-dinner overrides,
- clearly communicate the diner count being used,
- deterministically scale recipe/shopping quantities.

## D. Next LLM integration points

Implement the next two approved FlavorWeave LLM capabilities:

### #4 — Recipe Adaptation / “Fix this”

Examples:

- Make this less spicy.
- I don't have cilantro.
- Can I make this with an air fryer?
- Simplify this.
- Make this more filling.
- I don't have gochujang.
- Can I prep this differently?
- Make this work with what I have.

### #6 — Personalized Recommendation Explanations

Use authoritative FlavorWeave evidence to explain naturally:

> Why is this being recommended to us?

Examples:

> “This looks like a strong fit because you both tend to enjoy smoky, savory dinners, and it keeps tonight fairly easy.”

The LLM may phrase structured facts.

It must never invent the underlying reason.

---

# 2. One integrated Release Bundle

Use the hardened Elephant Harbor / Harbor Eats execution model.

This cycle should have:

- one Release Bundle,
- one integration owner,
- one dependency graph,
- one integration base,
- one stable runtime candidate,
- one Preview release,
- one broad E2E lifecycle,
- one Production promotion.

Do not create separate release lifecycles for:

- D-04,
- servings/shopping,
- adaptation,
- explanations,
- alpha-readiness fixes.

Use targeted testing throughout development.

Pay the expensive integrated lifecycle once.

---

# 3. Efficiency / model routing

Continue the established model policy.

## Composer 2.5

Default for:

- mechanical implementation,
- tests,
- scripts,
- straightforward UI wiring,
- refactors,
- data/config changes.

## Grok 4.7

Preferred reasoning model for:

- navigation/state architecture,
- serving/shopping calculations,
- recipe adaptation architecture,
- explanation grounding,
- LLM contracts,
- difficult bugs,
- cross-cutting product logic.

## Opus 5.5

Use only where high-level UX judgment materially benefits from it.

Appropriate here for:

- app-wide navigation mental model,
- PWA Back behavior UX,
- alpha-readiness consumer-flow review,
- recipe-adaptation interaction UX,
- personalized explanation presentation,
- final rendered UX critique.

Do not use Opus for:

- backend logic,
- serving math,
- LLM gateway mechanics,
- debugging,
- tests,
- routine coding.

Favor Grok over Opus unless the task genuinely requires high-level UX / interaction / visual judgment.

---

# PART A — D-04 NAVIGATION / BACK BEHAVIOR

# 4. Product goal

FlavorWeave should behave like a coherent application, not a collection of routes and modals.

Users should be able to predict:

> Where will Back take me?

without needing to understand the route implementation.

The experience must work naturally both:

- in a normal browser,
- when installed as a PWA.

---

# 5. Establish a navigation model

Use Grok + selective Opus to define the authoritative navigation model.

Distinguish:

## Top-level destinations

Examples:

- Home
- Tonight
- Find
- History
- Profile

## Task flows

Examples:

Plan  
→ Find / refine  
→ plan review

Tonight  
→ Swap  
→ full Find  
→ replace

Shop  
→ recipe

Cook  
→ recipe detail / step context

## Transient surfaces

Examples:

- dialog
- sheet
- filter
- refinement overlay
- confirmation.

Back behavior should reflect these distinctions.

---

# 6. Back priority

A sensible conceptual priority is:

1. close transient surface,
2. return from detail to originating task/context,
3. restore prior in-task state,
4. return to logical parent,
5. then follow browser history.

Use the cleanest implementation for the app architecture.

Do not blindly call:

`history.back()`

if that produces a nonsensical user journey.

---

# 7. Required Back cases

Explicitly test:

### Find

Find  
→ query/filter  
→ recipe  
→ Back

Restores:

- query,
- interpreted NLP criteria,
- filters,
- approximate scroll state where practical.

### Replace mode

Plan  
→ Swap  
→ See all options / Find  
→ recipe  
→ Back

Returns to replace-mode Find.

Back again returns to plan without losing state.

### Choose-for-plan

Plan empty slot  
→ Find  
→ recipe  
→ Back

Restores choose-for-plan context.

### Weave planning

Weave request  
→ generated plan  
→ recipe  
→ Back

Returns to generated plan.

### Shop

Shopping list  
→ recipe  
→ Back

Returns to the shopping list.

### Cook

Cook flow  
→ supporting recipe/detail  
→ Back

Returns to the active cook context rather than Home.

---

# 8. Deep links

A direct deep link should still have a logical parent.

Example:

direct recipe URL

should not strand the user.

Define sensible fallback parent behavior.

Do not create arbitrary browser-history entries solely to fake navigation.

---

# 9. PWA/mobile Back

Test real installed-style/mobile semantics as far as tooling permits.

The previous issue where device/browser Back minimized or left the app instead of navigating logically should be addressed.

On Android/browser-style Back:

- close active transient UI first,
- then navigate within FlavorWeave,
- leave/minimize only when there is genuinely no meaningful app history remaining.

---

# 10. Avoid navigation regressions

Do not disrupt:

- standalone Find full nav,
- replace/choose focus chrome,
- Weave state restoration,
- direct-manipulation state,
- recipe non-mutation semantics.

D-04 should unify these, not flatten them.

---

# PART B — HOUSEHOLD SERVINGS + SHOPPING QUANTITY ACCURACY

# 11. Investigate current behavior first

Oversight has observed that shopping-list quantities appear to behave as though only one person is eating.

Before changing code, reproduce and establish:

- current default recipe servings,
- current dinner diner count,
- current ingredient scaling,
- current shopping aggregation,
- whether recipe detail and shopping use the same scale,
- whether plan participant state is actually consulted.

Identify the root cause.

Do not merely multiply the shopping-list display by household size without understanding the existing data model.

---

# 12. Canonical diner-count rule

The app should have one authoritative diner count for each planned dinner.

Preferred behavior:

## Default

When a meal is added/planned:

> default the dinner participants to the eligible members of the active household.

For a typical two-person household:

default = 2 diners.

For a four-person household:

default = 4 diners.

Respect eligibility.

Do not automatically count a household member who cannot eat that dinner.

---

# 13. Per-dinner override

Users must be able to change who's eating a specific dinner.

Examples:

- one person is out,
- guests are coming,
- only some household members want the meal.

Use the existing participant/diner model if already present.

Do not create an unrelated serving counter if the existing participant model can remain authoritative.

---

# 14. Make diner count visible

The user should clearly understand:

> These ingredient quantities are for X people.

Display this where it matters.

At minimum evaluate:

- plan dinner card,
- recipe detail,
- shopping list,
- cook flow.

Potential language:

> For 2 people

or:

> Cooking for 2

Use Opus/product judgment for placement.

Do not overwhelm the UI.

---

# 15. Scaling must be deterministic

Serving/ingredient scaling must remain deterministic.

The LLM must NEVER calculate:

- ingredient quantities,
- servings,
- shopping totals.

Canonical calculation should derive from:

recipe base servings  
→ active dinner participant count  
→ scaled ingredient quantities.

---

# 16. Ingredient quantity scaling

Verify correctness for:

- whole quantities,
- fractions,
- decimals,
- ranges where supported,
- countable items,
- weight,
- volume,
- optional/garnish ingredients,
- subcomponents,
- multiple meals sharing an ingredient.

Scaling must not corrupt:

- units,
- recipe versions,
- shopping aggregation.

---

# 17. Shopping-list aggregation

When multiple dinners require the same ingredient:

aggregate appropriately when units are compatible.

Example conceptually:

Dinner A:
2 onions

Dinner B:
1 onion

Shopping:
3 onions

But do not combine incompatible representations incorrectly.

Preserve existing normalization behavior where correct.

---

# 18. Participant changes update shopping

If the user changes:

Dinner 2:
2 diners → 1 diner

shopping quantities must update accordingly.

If they later change:

1 → 3

shopping quantities should update deterministically.

Test:

- checked shopping items,
- delta updates,
- add/remove meals,
- swap meal,
- participant count changes.

Do not unnecessarily reset shopping state.

---

# 19. Recipe detail consistency

If Dinner 1 is for 2 diners:

recipe detail should show quantities appropriate to those 2 diners.

Shopping and recipe detail must not disagree.

If recipe detail allows local serving adjustment, define whether that adjustment:

- changes the planned dinner,
- or is temporary viewing only.

Avoid multiple competing serving states.

---

# 20. Guests

If the current model supports only named household participants, determine the cleanest V1 way to support:

> 2 household diners + 1 guest

without requiring creation of a fake household member.

If existing architecture already supports a diner count independently, use it.

If not, propose the smallest clean model.

Do not overbuild guest profiles.

---

# PART C — LLM #4: RECIPE ADAPTATION / “FIX THIS”

# 21. Product concept

Create a reusable recipe adaptation capability.

The user should be able to open a recipe and naturally ask:

> Can I make this less spicy?

> I don't have cilantro.

> I don't have gochujang.

> Can I make this easier?

> Can I use the air fryer?

> Make this more filling.

> Can I prep any of this ahead?

This should feel like an extension of the existing FlavorWeave **Weave** interaction system.

Do not introduce a generic chatbot.

---

# 22. Reuse the unified Weave UX

Recipe adaptation should use the same branded interaction grammar:

- contextual composer,
- Weave working state,
- typing reveal,
- short acknowledgment,
- structured interpretation,
- native recipe adaptation result.

Potential composer language:

> What would you change?

or equivalent.

Use Opus for the high-level adaptation UX.

---

# 23. D-05 task

Use the existing:

`recipe_adaptation`

typed D-05 task.

Do not build a bypass provider integration.

All calls must continue through:

GenerationService / LLM Gateway.

---

# 24. Separate advice from mutation

Very important:

A user asking:

> “Can I use parsley instead of cilantro?”

does not automatically rewrite the canonical recipe.

Initially distinguish:

## Advice

A temporary suggestion for this cooking session.

## Apply adaptation

An explicit user action that applies the adapted version to the active planned/cook instance.

Do not silently mutate canonical catalog recipes.

---

# 25. Canonical catalog recipes remain immutable

An LLM adaptation must not edit the certified catalog recipe/version.

Conceptually:

Catalog Recipe Version  
→ contextual adaptation  
→ household/cook instance override

The catalog remains unchanged.

If an adaptation is later considered universally superior, that is Catalog Factory work, not an LLM side effect.

---

# 26. Structured adaptation output

Do not accept a free-form paragraph as the machine-consumed adaptation.

The task should return structured fields such as conceptually:

- adaptation type,
- affected ingredient(s),
- proposed substitution,
- quantity adjustment if deterministically derived,
- affected steps,
- equipment change,
- flavor impact,
- warning/constraint status,
- short user-facing explanation.

Exact schema is up to the team.

---

# 27. Allergen / dietary safety

The LLM does not decide whether a substitution is safe.

Example:

> Replace cashews with peanuts.

The LLM may propose something conceptually, but deterministic validation must check:

- household allergens,
- dietary restrictions,
- current diners.

Unsafe adaptation must be rejected.

Never tell a user an ingredient is safe based solely on the model.

---

# 28. Quantity authority

If an adaptation changes an ingredient:

the LLM may identify the substitution concept.

Deterministic application code should handle quantities where possible.

Do not trust model arithmetic for:

- scaling,
- serving quantities,
- shopping math.

---

# 29. Equipment adaptation

Examples:

> Can I use an air fryer?

> I don't have a pressure cooker.

The model can suggest a technique alternative only when the task supports it.

But:

- clearly distinguish when results differ,
- do not imply equivalence where uncertain,
- preserve food-safety/doneness requirements.

Butter Chicken is a useful test case because its canonical recipe genuinely requires a pressure cooker.

---

# 30. Adaptation confidence / unsupported cases

Do not force an answer.

If a safe/useful adaptation cannot be made:

say so naturally.

Example:

> “That pressure cooker is doing most of the work in this version. I'd stick with the original method for this recipe.”

Do not hallucinate a replacement method merely to be helpful.

---

# 31. Apply / undo

If the user applies an adaptation to the active meal:

make it obvious.

Provide an ability to:

- see what changed,
- undo/reset to original.

Do not make users wonder whether they are still following the certified recipe.

---

# 32. Shopping impact

If an applied adaptation changes ingredients:

the active plan's shopping list should update appropriately.

Example:

cilantro → parsley

shopping should reflect parsley rather than cilantro for that dinner.

This must use deterministic shopping state, not model-generated list text.

---

# 33. Taste evidence

An adaptation request is not automatically permanent Taste evidence.

Example:

> “Make this less spicy tonight.”

does not necessarily mean:

> permanent dislike of spice.

Treat adaptation context separately unless the user explicitly makes a durable preference change later.

---

# PART D — LLM #6: PERSONALIZED RECOMMENDATION EXPLANATIONS

# 34. Product goal

FlavorWeave should be able to answer:

> Why this one?

in a genuinely useful, natural way.

The explanation should make recommendations feel intelligent and personal without exposing internal scores or pretending the LLM chose the meal.

---

# 35. Deterministic evidence first

The recommendation system must provide an explicit structured evidence packet.

Potential evidence includes:

- Taste match,
- agreement between diners,
- known liked flavor attributes,
- exploration/novelty,
- recent repetition/fatigue,
- active `Keep it easy`,
- active `Simple ingredients`,
- quick/time preference,
- plan composition,
- contextual Find intent.

The LLM receives only approved evidence.

It does not inspect arbitrary household history and invent the explanation.

---

# 36. LLM = verbalizer, not reason generator

Lock this invariant:

> FlavorWeave decides WHY.
>
> The LLM decides HOW to SAY IT.

If deterministic evidence says:

- strong savory preference,
- easy effort,
- hasn't been served recently,

the LLM may phrase:

> “This looks like a good fit because you both tend to enjoy savory dinners, it's easy to make, and it hasn't been in the rotation lately.”

It may NOT introduce:

- “you love mushrooms”

unless that fact is actually supplied.

---

# 37. Explanation task

Use the existing D-05:

`explanation`

task.

No direct provider call.

No new model unless evidence demonstrates Luna is insufficient.

Start with Luna.

Sol should not be needed for ordinary recommendation explanations.

---

# 38. Explainability UI

Integrate explanations naturally into the existing product.

Potential surfaces:

- recommendation cards,
- recipe preview,
- plan suggestions,
- Find result detail,
- Swap alternatives.

Avoid putting paragraphs on every card.

A likely hierarchy:

short structured reason on card  
→ optional **Why this one?**  
→ short natural explanation.

Use Opus for the presentation design.

---

# 39. Don't over-explain

Keep explanations short.

Usually:

1–2 sentences.

Do not write:

- essays,
- generic praise,
- repeated meal descriptions.

The explanation should add information the user did not already get from the title/image.

---

# 40. No explanation when evidence is weak

If FlavorWeave lacks sufficient evidence:

do not fabricate personalization.

Use a factual explanation such as:

> “This gives you something different while still keeping dinner easy.”

or omit the personalized explanation entirely.

---

# 41. New households

There is currently limited/no real Taste data.

The explanation system must behave honestly during cold start.

Potential evidence may come from:

- explicit onboarding preferences,
- current run intent,
- household restrictions,
- contextual planning choices,
- exploration logic.

Do not imply learned personal preferences that do not exist.

---

# 42. Explanation caching

Because deterministic evidence packets can be stable:

use sensible caching where safe.

Cache key should include relevant:

- meal/version,
- evidence fingerprint,
- prompt version,
- model,
- household-safe semantic context where needed.

Do not reuse an explanation after its evidence changed.

---

# 43. Cost discipline

Do not generate explanations proactively for all 75/85 meals.

Only call the LLM when:

- the user opens `Why this one?`,
- or the UX has a strong reason to generate one for a very small visible recommendation set.

Avoid dozens of paid explanation calls on page load.

---

# PART E — INTEGRATED ALPHA READINESS REVIEW

# 44. Whole-product mindset

After the above functionality is integrated, run a deliberate alpha-readiness product review.

The question is:

> Can a real two-to-four-person household use FlavorWeave naturally over multiple dinners without understanding how the system works?

Review the full experience, not isolated features.

---

# 45. Core household journey

Validate:

## Onboarding

- create household,
- invite/join,
- dietary constraints,
- initial preferences.

## Plan

- choose-for-me,
- Weave planning,
- manual planning,
- diner count.

## Find

- deterministic search,
- NLP search,
- fuzzy intent,
- manual filters.

## Select / refine

- swaps,
- full Discovery,
- recipe adaptation.

## Shop

- consolidated ingredients,
- correct quantities for diners,
- checked state.

## Cook

- recipe quantities,
- equipment,
- applied adaptation.

## Rate

- all diners,
- partial ratings,
- completion.

## Return

- History,
- next plan,
- Taste learning.

---

# 46. Alpha friction backlog

During the review, distinguish:

## Release-blocking / serious

Examples:

- data loss,
- wrong quantities,
- broken navigation,
- unsafe eligibility,
- broken household separation,
- inaccessible core actions.

Fix these in the cycle.

## High-value polish

Fix if bounded and directly improves core household use.

## Nice-to-have

Record for later.

Do not allow the alpha review to become unbounded feature ideation.

---

# 47. First real household readiness

The product should be ready for Tom/Renata to perform repeated real loops.

Do not manufacture evidence.

But the UI should clearly support:

Plan  
→ Shop  
→ Cook  
→ Rate.

At completion, provide a concise recommended real-use checklist for the household.

---

# 48. Real loop instrumentation

Confirm telemetry can answer:

- plan created,
- plan edited,
- dinner selected,
- shopping opened,
- cook started,
- cook completed,
- ratings completed,
- adaptation requested/applied,
- explanation opened,
- NLP used.

Do not log raw private LLM prompts in ordinary analytics.

---

# PART F — AI UX COHERENCE

# 49. One branded LLM system

D-06 introduced the Weave.

Recipe adaptation and recommendation explanations must feel like part of the same product language.

Maintain:

- same working animation,
- same conversational tone,
- same typing-reveal conventions where appropriate,
- same accessibility behavior,
- same motion system,
- same FlavorWeave visual identity.

Avoid feature-specific AI widgets.

---

# 50. Typing reveal

Use typing reveal where it adds conversational value:

## Recipe adaptation

Yes — likely appropriate for the short adaptation acknowledgment/explanation.

## Recommendation explanation

Potentially appropriate when opened interactively.

Do not artificially delay already-available content.

Do not expose raw provider token streaming.

Use validated output then reveal.

Respect reduced-motion/accessibility.

---

# 51. Native transformation remains the payoff

Recipe adaptation:

language  
→ acknowledgment  
→ changed ingredient/step state.

Explanation:

tap `Why this one?`  
→ concise natural explanation grounded in real evidence.

Do not let AI prose become the primary interface.

---

# PART G — TESTING

# 52. Serving/shopping tests

Add durable tests for:

- default household diner count,
- restricted household member exclusion,
- per-dinner override,
- guest count if supported,
- 1/2/3/4 diner scaling,
- fractions,
- shopping aggregation,
- swap,
- diner-count change,
- checked shopping items,
- recipe vs shopping consistency.

---

# 53. Navigation tests

Cover:

- transient UI closes first,
- Find recipe Back,
- replace mode Back,
- choose-for-plan Back,
- Weave plan recipe Back,
- shopping recipe Back,
- cook flow Back,
- deep-link fallback,
- mobile/PWA logical Back.

Avoid brittle implementation-detail assertions.

---

# 54. Adaptation tests

Cover:

- substitution,
- simplify,
- flavor change,
- equipment request,
- unsafe substitution,
- unsupported adaptation,
- apply,
- undo,
- shopping update,
- canonical recipe unchanged,
- no automatic Taste mutation.

Use fake provider for normal CI.

---

# 55. Explanation tests

Cover:

- evidence grounding,
- no unsupported facts,
- cold-start explanation,
- active run preference,
- household disagreement,
- weak-evidence fallback,
- cache invalidation,
- no proactive mass-generation.

---

# 56. Live AI evaluation

Use a bounded real Luna evaluation in Preview.

Do not use live API calls as the debugging loop.

Evaluate representative:

## Adaptation

- less spicy
- ingredient substitution
- simplify
- equipment alternative
- unsafe substitution
- unsupported adaptation

## Explanation

- strong evidence,
- weak evidence,
- cold start,
- active plan preference.

Set a small explicit Preview evaluation budget/call allowance consistent with current limits.

No Sol unless Luna demonstrably cannot meet a requirement and Oversight approves escalation.

---

# PART H — OPUS UX REVIEW

# 57. Use Opus strategically

Use Opus for two high-value passes:

## Early Decision Card

Cover:

- app-wide Back mental model,
- serving/diner communication,
- adaptation UX,
- explanation presentation.

## Final rendered review

Cover actual:

- mobile navigation,
- plan/shop/cook quantity clarity,
- adaptation flow,
- explanation experience,
- overall Alpha cohesion.

Do not use Opus for routine iteration between those passes.

---

# PART I — PREVIEW / RELEASE

# 58. Integrated candidate

Do not preview-deploy each sub-feature.

Complete:

- navigation,
- serving/shopping,
- adaptation,
- explanations,
- bounded alpha friction fixes

then freeze one runtime candidate.

Run:

- preflight,
- targeted tests,
- local/fake-provider validation.

---

# 59. Preview validation

Deploy once through the canonical Preview path.

Verify:

- correct Preview D1,
- expected post-expansion catalog count,
- intended AI configuration,
- no cross-environment binding.

Perform hosted walkthroughs.

---

# 60. Hosted household scenario

Run at least one realistic synthetic household scenario end-to-end:

1. create/use household with multiple diners,
2. plan several dinners,
3. confirm default diner counts,
4. override one dinner,
5. inspect shopping quantities,
6. Find another meal,
7. swap it,
8. request recipe adaptation,
9. apply adaptation,
10. verify shopping changes,
11. inspect recommendation explanation,
12. cook flow,
13. rating flow,
14. navigate Back throughout.

This should be a product-level validation, not just endpoint checking.

---

# 61. Full E2E

After the candidate is stable and hosted validation passes:

run one complete E2E suite.

Use the hardened broad-suite rule.

If a runtime defect appears:

isolate  
→ fix narrowly  
→ prove narrowly  
→ one final full rerun.

---

# 62. Production promotion

Production promotion is authorized if:

- navigation passes,
- diner/shopping scaling passes,
- adaptation safety passes,
- explanation grounding passes,
- Alpha review finds no release-blocking issue,
- hosted Preview passes,
- full E2E passes.

Promote the exact accepted candidate.

---

# 63. Production smoke

Use minimal paid LLM calls.

Verify:

- one safe recipe adaptation,
- one grounded recommendation explanation,

plus:

- plan,
- diner count,
- shopping quantity,
- navigation,
- cook/rate core flow.

Do not create unnecessary OpenAI traffic.

---

# 64. Production test-data cleanup

Any synthetic household created for Production smoke must be deleted after validation under the established cleanup policy.

Take the normal backup/bookmark.

Do not accumulate production test households.

---

# 65. Definition of Done

This cycle is complete when:

## Navigation

- D-04 completed,
- Back behavior coherent,
- PWA/mobile behavior logical,
- deep-link fallback defined,
- task state preserved.

## Household scaling

- dinner defaults reflect actual eligible household diners,
- users can override diner participation,
- diner count is visible,
- recipe quantities scale correctly,
- shopping quantities scale correctly,
- multi-meal aggregation remains correct.

## Recipe adaptation

- reusable Weave adaptation flow exists,
- structured output,
- deterministic validation,
- safe substitution behavior,
- canonical recipes unchanged,
- apply/undo works,
- shopping updates.

## Personalized explanations

- grounded evidence packet exists,
- LLM only verbalizes real evidence,
- cold-start honesty,
- optional/concise UX,
- no mass explanation generation.

## Alpha readiness

- full household journey reviewed,
- serious friction resolved,
- bounded polish completed,
- real household use checklist ready.

## AI UX

- adaptation/explanation feel like one coherent FlavorWeave system,
- no generic chatbot UI,
- no raw provider mechanics exposed.

## Quality

- targeted tests green,
- bounded live Luna eval passes,
- Opus UX review satisfactory,
- hosted Preview household scenario passes,
- full E2E passes,
- Production smoke passes.

---

# 66. Required handoff

Return:

# HARBOR EATS → OVERSIGHT HANDOFF
## Alpha Readiness + D-04 + Household Scaling + AI Expansion Released

Include:

### Starting state

Confirm:

- D-06.1 was complete before this cycle began,
- the queued 10-meal expansion was complete,
- starting catalog count.

### D-04

Describe:

- navigation model,
- Back precedence,
- PWA/mobile behavior,
- deep-link behavior,
- Find/Plan/Shop/Cook state restoration.

PASS/FAIL for major flows.

### Household diner model

Report:

- default diner calculation,
- eligibility interaction,
- per-dinner override,
- guest behavior if implemented,
- authoritative source of truth.

### Shopping scaling

Report:

- root cause of prior one-person behavior,
- recipe scaling,
- shopping scaling,
- aggregation,
- checked-state behavior,
- diner-count changes,
- tests.

### Quantity UX

Show where/how FlavorWeave communicates:

> cooking for X

or equivalent.

### Recipe adaptation

Describe:

- Weave UX,
- task schema,
- structured adaptation model,
- advice vs Apply,
- canonical recipe protection,
- safety validation,
- shopping effects,
- undo behavior.

PASS/FAIL examples for:
- substitution,
- flavor adjustment,
- simplify,
- equipment adaptation,
- unsafe request,
- unsupported request.

### Personalized explanations

Describe:

- deterministic evidence packet,
- LLM grounding contract,
- cold-start behavior,
- UX placement,
- caching.

Include representative examples supported by actual evidence.

### AI safety

Confirm LLM cannot authoritatively decide:

- allergens,
- dietary eligibility,
- servings,
- ingredient scaling,
- shopping quantities,
- recommendation eligibility,
- Taste score,
- canonical recipe mutation.

### Unified AI UX

Report:

- reuse of Weave system,
- typing reveal,
- motion/working state,
- mobile behavior,
- Opus findings.

### Alpha-readiness review

Report:

- complete household journey reviewed,
- blocking/high-value issues discovered,
- what was fixed,
- what was intentionally deferred.

### Real-household readiness

Provide a short recommended Tom/Renata real-use sequence for generating genuine:

Plan → Shop → Cook → Rate

evidence.

### Telemetry

Confirm coverage for:
- plan,
- shop,
- cook,
- rate,
- adaptation,
- explanation,
- NLP.

Confirm raw prompt privacy remains intact.

### Live AI evaluation

Report:

- Luna calls,
- cost,
- latency,
- adaptation accuracy,
- explanation grounding failures,
- corrections.

### Testing

Report:

- unit/integration totals,
- targeted navigation tests,
- serving/shopping tests,
- AI tests,
- full hosted E2E result,
- flakes/retries,
- tested runtime SHA.

### Preview

Report:

- deployment,
- D1 binding,
- catalog count,
- AI config,
- hosted household walkthrough.

### Production

Report:

- deployment,
- D1 binding,
- catalog count,
- AI config,
- targeted smoke,
- synthetic test cleanup.

### Execution Efficiency

Report:

- workstreams,
- models used,
- Opus invocations and why,
- runtime PR count,
- rebases,
- Preview deploy count,
- full E2E runs,
- failed broad runs,
- steering turns,
- approximate wall-clock.

### Product evidence

Report actual:

- real plan/cook/rate loops,
- kitchen-tested meal count.

Do not infer or manufacture evidence.

### Deferred items

List only genuinely non-blocking remaining Alpha items.

### Recommended Next Prompt for Oversight

Recommend next work based primarily on:

- real household evidence,
- Alpha-readiness findings,
- observed AI usage,

rather than automatically proposing another major feature.

Do not begin the next initiative automatically.

Proceed only after the currently queued D-06.1 work and 10-meal expansion are complete. Then execute this integrated Alpha Readiness release autonomously through design, implementation, targeted validation, one Preview lifecycle, one broad E2E gate, and Production promotion.