# Execution efficiency doctrine (Harbor Eats; adopted hardening-1, 2026-10-10)

Floor: `elephant-harbor-execution-standard`. Model choice: `cloud-agent-model-routing`. This file is the repo-local short form.

## 1. Release Bundle (the unit of delivery)
One bundle = workstreams that share one test/deploy lifecycle. Plan in `docs/release/<bundle>/RELEASE-BUNDLE.md`:
workstreams, dependencies, routing, owner, branch, test ownership, "validate now" vs "needs next deployed candidate".

## 2. Fewer agent boundaries
Every hand-off costs context and a rebase. Default is ONE executor carrying a complete written contract. Split only for
genuinely independent, long work. Never split a single integration surface across agents.

## 3. Single integration owner, single base
One owner declares `INTEGRATION_BASE=<sha>` once. All work lands on one integration branch. No repeated rebases, no
mid-flight steering; changes to scope go into the contract, not into chat nudges.

## 4. One integrated runtime PR by default
One PR per bundle, logical commits. More PRs only when a change must ship on a different lifecycle.

## 5. Model routing
Composer 2.5 for mechanical work; Grok 4.7 for root cause, environment/CI/data design; **Grok preferred over Opus**
except a genuine high-level UX judgment. Validate the live catalog id; no silent fallback.

## 6. Decision Card
Reasoning output is committed as a compact card in `docs/` — Decision, Invariants, Behavior, Edge cases, Non-goals —
and executors build from the card, not from the transcript.

## 7. Change-aware verification
| Change class | Required verification |
|---|---|
| Docs only | none (record `tested_product_sha`) |
| Catalog content | Factory gates + Freeze Integrity + media checks (`smoke:catalog`) |
| Catalog metadata | schema + importer tests |
| UI | targeted unit/Playwright + one broad run at release |
| Runtime / data | preflight + integration tests + hosted check + one broad run |
| Deploy / config | binding assertions (`deploy:verify-binding`) + prod smoke |

## 8. Broad E2E budget
One full E2E run per stable candidate. Failures are isolated and re-proven narrowly; re-run broad only if runtime changed after.

## 9. Automated failure-class guards (make the last failure impossible)
- Shared request-context cookie leak → `apiCreateIsolatedHousehold` + status-asserting helpers; restricted search must be < 75.
- Wrong D1 binding → env-specific configs, deploy refusals, `verify-binding`.
- Unseeded D1 E2E → `preflight:e2e` in the web server script.
- Stale service worker → SW shell hash invariant.
- Catalog regressions (missing image, empty recipe, untagged hard-limit ingredient, Sabich sesame) → `smoke:catalog`.
- Hosted run against prod → target guard in `hosted-e2e.yml`.

## 10. Execution Efficiency report section (every handoff)
Agents launched, runtime PRs, rebases, broad E2E runs, deploys, failed runs (and class), config failures, steering events,
wall-clock duration, and what became an automated guard this cycle.
