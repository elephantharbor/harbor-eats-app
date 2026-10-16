# S-01 Execution Plan — S-02, S-03, S-04

**Status.** Recommendation to Oversight. Do not start these units from this branch.

**Discipline.** `docs/engineering/EXECUTION-EFFICIENCY.md`. One owner per unit, one integration branch, one runtime PR per unit. Docs-only verification for S-01 is this file set. No broad E2E, no deploy.

## What changed from the proposed split

The three units are the right seams. Two adjustments keep them from restyling the same screen twice:

1. **S-02 ships the Order online sheet in the “not connected” state** and the review layout with no network. S-03 fills the Instacart path. S-03 does not redesign the list.
2. **S-02’s migration includes `revision`, origin, override, and `skipped`.** S-03 adds `grocery_handoff` only. The line table is not migrated twice.

S-03 stays one unit. The mock contract and the dev client land together, flag off. A live call is a recorded check after a human has a dev key, not a second PR. S-04 is the only unit that may turn the flag on in production, and only after Instacart’s production key is actually active.

Shop stays `shopList`. No sixth tab. That avoids a navigation rewrite of D-04.

## S-02 — Household Shopping Foundation

**Scope.** General items, household list projection, in-store check-off, preferences and favorites, share and export. Order online visible and inert.

**Repo areas.** `migrations/0017_*`, `src/lib/plan-mutations.js` (project after `syncShopping`, do not replace it), `src/lib/ingredient-identity.js` (parser only if it belongs beside the aliases), `src/lib/household-settings.js`, `src/lib/dinner-plan-store.js`, `src/lib/dinner-plan-routes.js`, `public/index.html`, `public/app.js`, `public/styles.css` (print and sticky bar only), `public/nav-context.js` (back parent), `src/index.js` SPA path for the share URL, tests under `test/`.

**Prerequisites.** S-01 accepted. No external account. No flag.

**Deliverables.** One open list per household. Recipe projection. General-item parser. States `open`, `already_have`, `purchased`, `skipped`. Override quantity. `updated_at` conflict. Settings card and optional onboarding skip card. Copy, share sheet, print, txt, csv. `HE-SHOP-` link with expiry and revoke. In-store mode. Order online sheet that says not connected.

**Test plan.** Extend `test/alpha-diner-scaling.test.js` and `test/shop-display.test.js` so projection preserves marks. New tests: parser cases (fractions, unknown unit, empty name, yellow onion merge), override survives resync, adaptation id change retires the old line, two-member 409, share payload has no constraint fields, print text excludes skipped by default. Targeted Playwright on add item, check off, and share revoke. One broad E2E only if this is the release candidate. Docs-only files from S-01 need no retest.

**UX acceptance.** The criteria in `S-01-UX-DECISION-CARD.md`, minus a live Instacart button.

**Preview / prod.** Preview deploy is allowed for this unit after tests, because the list behavior changes for real households. Production follows the repo’s deploy binding and is a human confirm. No grocery secret in either Wrangler file.

**External blockers.** None.

**Complexity.** One new migration, a projection inside the existing save, and a focused extension of `shopList`. The scaler stays. Highest risk is the projection disagreeing with `dinner_shop_line`. The test that compares them is the gate.

**Stop / acceptance.** Stop if general items require an LLM or a second aggregation path. Accept when a household can shop recipe lines and a typed staple in store, two members conflict cleanly, export omits diet data, and diner-count tests still pass. Do not start S-03 inside this PR.

## S-03 — Provider Framework and Instacart Dev Handoff

**Scope.** Adapter contract, `instore` and `instacart` adapters, mock contract tests, handoff table, review screen wired to capabilities, flag default off.

**Repo areas.** `src/lib/grocery/*`, `migrations/0018_grocery_handoff.sql`, a route module included from `src/index.js`, `public/shop-handoff.js`, the review markup in `public/index.html`, `test/grocery-adapter-contract.test.js`, preview/production Wrangler comments that `GROCERY_PROVIDERS` defaults empty. No change to `src/ai`.

**Prerequisites.** S-02 accepted and in the integration base. Instacart dev key is **not** a prerequisite to merge the flag-off PR. It is a prerequisite for the optional live check.

**Deliverables.** Capabilities route. Handoff create with hash idempotency, allowlist, and measurement mapping from the Instacart card. Review UI matching `png/04-review.png` and `png/08-missing.png`. Official logo used only if a human has added the asset; otherwise the button ships without a fake mark and the card’s logo slot stays empty until the asset is legally saved. Registry comments on the two adapters.

**Test plan.** The contract tests in the adapter card. A test that a timeout does not set `purchased`. A test that `clove` and `serving` stay off the payload and on the review. No live call in CI.

**UX acceptance.** Flag off: identical to S-02. Flag on in a local or preview env with a mock: review lists included and staying lines, CTA says “Shop on Instacart”, return link does not claim an order.

**Preview / prod.** The PR may deploy to preview with the flag **unset**. It must not set `GROCERY_PROVIDERS` or the secret in production. A live dev call, if the key exists, is a manual note in the registry (`tested` for the dev host only). It is not production-enabled.

**External blockers.** Dev key for a live call. Production approval is S-04, not this unit. Logo asset from Instacart’s logo page, saved by a human.

**Complexity.** One HTTP client and one table. The risk is over-claiming: cart, stock, store pin. The mock’s refusal to return those fields is the gate.

**Stop / acceptance.** Stop if the implementation needs `retailer_key` on a shopping-list URL, the deprecated quantity field as the primary shape, or a health filter from `constraint_rule`. Accept when contract tests pass, the flag is off in preview and production configs, and a code reader can see that a URL is not a purchase. Do not wait for Instacart’s 30–40 day production review inside this unit.

## S-04 — Integrated Validation and Production Rollout

**Scope.** Prove S-02 and S-03 together. Record the Instacart demo. Enable production only after their key is active. No new product behavior.

**Repo areas.** Wrangler production env, registry lifecycle notes, a short release note under `docs/release/`. Possibly a one-line flag change. No new tables.

**Prerequisites.** S-02 and S-03 merged. A human has a development integration that matches the pre-launch checklist. Instacart has activated a production key. Enterprise Help Desk account exists if their review still requires it.

**Deliverables.** Preview pass of in-store plus a dev-host handoff if the key exists. Demo recording for Instacart (their checklist: path to the CTA, the click, the landing URL). Registry row moved to production-enabled only in the change that sets the flag. If they deny the key, the registry records the denial and the flag stays empty. In-store shopping remains the product.

**Test plan.** Targeted shop Playwright plus one broad E2E on the candidate that will be production. No second broad run unless runtime changes after it. Binding check if Wrangler changed (`deploy:verify-binding`).

**UX acceptance.** On production, before the flag: S-02 behavior. After the flag: the CTA matches the June 18, 2026 checklist, forbidden phrases are absent, and a returned shopper still sees an unchecked list.

**Preview / prod.** Preview first. Production deploy is the existing human confirm. The flag flip can be the same production deploy or a follow-up. It is not a silent config edit.

**External blockers.** Instacart production approval email. Impact or Tastemakers only if the household business wants commissions. Logo asset.

**Complexity.** Operational, not architectural. The risk is enabling the flag because the code is ready while the key is still pending. Their docs say a pending production key does not work.

**Stop / acceptance.** Stop on denial, on a checklist mismatch, or on any path that marks a line purchased from the link. Accept when either the flag is on and a dev-verified handoff has been repeated against the production host with a single test list, or the denial is written down and in-store is confirmed still healthy.

## Human decisions

Only these need a person. Defaults are locked in the cards if Oversight does not object.

| # | Decision | Default if no objection |
|---|---|---|
| 1 | Who applies for Instacart, and whether Harbor Eats will accept the Developer Platform terms | No application until a named person accepts. S-02 does not wait. |
| 2 | Whether to pursue affiliate commissions | No. Handoff does not require Impact or Tastemakers. |
| 3 | Which CTA page Instacart will grade | June 18, 2026 pre-launch checklist. Button “Shop on Instacart”. |
| 4 | Whether to append `retailer_key` | No, for shopping-list links. |
| 5 | Official logo file added to the repo by a person | Required before the CTA shows a logo. Words may ship inside their colors only if their checklist still allows a review without the asset; otherwise the CTA waits for the asset in S-04. |

Not decisions: sixth tab (no), clove mapping (do not send), share expiry (7 days), link lifetime we request (14 days), health filters (off), LLM parser (no).

## Recommended next prompt

The prompt Oversight can give the next owner is in the S-01 handoff. It starts S-02 only.
