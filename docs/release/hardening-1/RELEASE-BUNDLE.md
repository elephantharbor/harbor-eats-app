# Release Bundle — hardening-1 (Hardening + Execution Efficiency Preparation)

Authorized by Oversight 2026-10-10. Owner: Grok Bot integration owner (single owner, single base).

- **INTEGRATION_BASE** = `444d79ec5f89793c6ff45c86d4e9eaf3b8a0a361` (main; prod app built from 959114b, diff = e2e spec only)
- **Branch** = `hardening/bundle-1` → **one runtime PR** (#37), logical commits, no rebases planned.
- **Deploys this cycle**: none. **Schema migrations applied to preview/prod**: none.
- **Only prod write**: deletion of test households `hh_de61f752999f`, `hh_d7ac1bfe9a49` (Part C, Time Travel bookmark first).

## Workstreams

| # | Workstream | Depends on | Routing | Tests owned | Validate now | Needs next deployed candidate |
|---|---|---|---|---|---|---|
| W1 | Wave-12 E2E spec fix (9) | — | integration owner (mechanical) | `e2e/specs/wave12-catalog.spec.js`, helpers | local wrangler+seeded D1 (75) — fixed spec PASS, old spec FAIL reproduced | hosted run on preview via hosted-e2e.yml |
| W2 | Deploy safety + preflight + E2E modes + hosted-E2E CI (10–16, 40) | — | mechanical; design captured in Decision Card | `test/deploy-safety.test.js` | unit + mocks + dry-run | post-deploy `verify-binding` (health vars ship with next deploy) |
| W3 | SW invariant (17) | W2 metadata | mechanical | `test/deploy-safety.test.js` (SW block), brand-smoke | now | served `/sw.js` check in verify-binding |
| W4 | Structural catalog smoke (18) | — | mechanical | `scripts/smoke/catalog-structural-smoke.mjs`, unit test | local seed DB + read-only live preview API | prod read-only smoke after promote |
| W5 | Catalog residuals (19–24) | Factory rules | Grok Bot factory (Juniper create / independent Vale audit) | factory gate records, freeze_integrity | now (packages) | import of any new freeze-rN into D1 = next release |
| W6 | D-07 no-results + coverage (25–27) | — | mechanical | `test/d07-*.test.js`, `e2e/specs/d07-find.spec.js` | unit + local Playwright | hosted Find run on next preview |
| W7 | Prod cleanup (28) | bookmark | integration owner | integrity SQL | done | — |
| W8 | Effort-history duplicate (29) | — | reasoning → Decision Card | migration test on local D1 | local only | apply migration = next release gate |
| W9 | Efficiency doctrine docs + skills (30–41) | — | docs | none (docs-only) | — | — |

## Verification budget
Targeted tests per workstream → `npm test` → **one** broad local E2E run on the stabilized runtime tree. Docs-only commits after that do not re-run E2E (`tested_product_sha` recorded in HANDOFF).
