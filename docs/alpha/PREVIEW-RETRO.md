# Alpha Readiness — Preview Retro (PR #56)

Target was **1** Preview deploy; we used **7**. Sources: `/workspace/alpha/PREVIEW-EVAL.md` rounds 1–8 (copied context in [`HANDOFF.md`](HANDOFF.md)) and the 17-commit log of PR #56 (`5813ae1` → `887b93c`). Round 2 (`20fc95a`) failed CI and never deployed — CI did its job there.

## Classification

| # | Deploy | Head | What forced the next round | Class |
|---|---|---|---|---|
| 1 | `8224fd2f` | 5813ae1 | D1 preview `AI_TASKS_ENABLED` missing `recipe_adaptation,explanation`; D2 `/api/recipes/adapt` 500 on any gateway non-ok result; D3 peanuts accepted for a `no_nuts` diner; D4 hard-coded "smoky, savory" explanation phrase. UI specs mocked both AI endpoints, so CI was green. | **Should have been caught before Preview** |
| 2 | `250f7fe6` | 3238caf | First real Luna run (legitimately needed after #1). But the defects it found were mostly deterministic: R3-2 `from_id: null` op accepted; R3-3 `parsley` vs `fresh-parsley` shop key; R3-4 eval script bugs (`meal_count_mismatch`, call counter ignoring `source:"advice"`, wrong "weak" fixture); R3-1 fallback path skipped the deterministic pressure-cooker check. Only R3-5 (Luna wording) and the malformed output itself were model behavior. | **Should have been caught** (mostly) |
| 3 | `404b09be` | c154295 | R4-1 name-keyed ops dropped (catalog rows with null `ingredient_id`); R4-2 "already uses an air fryer" shown as unsupported; R4-3 eval fixture targets a recipe with no cilantro; R4-4 prompt text changed without a version bump, so stale cache served. All reproducible offline with a fake provider and the real catalog. | **Should have been caught** |
| 4 | `90d178c9` | fb4d9a4 | No new defects; existed only to re-verify the R4 fixes live. | **Should have been caught** (cost of #3) |
| 5 | `41049fa9` | e679efe | Hosted E2E: cook → recipe → Back showed "Start cooking" instead of "Resume step" — the `begin_cook` round trip is slow on hosted, local web server passes. | **Genuinely needed hosted behavior** |
| 6 | `72fffac0` | bdfa4c3 | Fix for #5 set `dinnerCookMealId` before `begin_cook` returned, breaking meal-loop "Start cooking" — again only visible with hosted latency. | **Genuinely needed hosted behavior** |
| 7 | `d72cadd8` | 887b93c | Release candidate: full hosted E2E 67/0/0, promoted to production `8dbf56b6`. | Required gate (the one planned deploy) |

**Tally:** 4 avoidable deploys (#1–#4), 2 hosted-only (#5–#6), 1 planned. With the safeguards below the likely path is #1 (live Luna eval) → hosted timing round(s) → release, i.e. 2–4 deploys instead of 7.

## Safeguards (for the "should have been caught" class only)
All small, deterministic, run in the existing `verify` CI job. No new process.

1. **AI task config test** — assert every AI task the UI/routes call (`recipe_adaptation`, `explanation`, `planning_intent`, `discovery_intent`) is in `AI_TASKS_ENABLED` in **both** `deploy/pages/preview` and `production` wrangler.toml. Catches D1.
2. **Unmocked fake-provider route tests for every new AI route** — hit the real `/api/recipes/adapt` and `/api/explain` handlers with a fake provider returning: ok, disabled, malformed, provider error, and name-keyed ops against real catalog rows. Catches D2, R3-1, R4-1, R4-2. Rule: a new AI route is not done without one.
3. **Substitution safety-matrix unit test** — table of {substitute × diner limit × entry point (interpret, apply, forged override)} plus null/absent `from_id`. Catches D3, R3-2.
4. **Eval-script dry-run in CI** — run `eval-alpha-live.mjs` against local wrangler with the fake provider: fixtures must resolve (recipe contains the ingredient, "weak" really has ≤1 fact), setup calls must return 200, the call counter must count every provider attempt. Catches R3-4, R4-3.
5. **Prompt-version-bump lint** — fail CI if a prompt's text hash changed but its `@version` didn't. Catches R4-4.

Not recommended now: the slow-network Playwright project. It targets the hosted-only class (#5–#6); revisit only if timing regressions recur after the HOLD.
