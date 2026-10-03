# Cycle 1B automated verification

**Verified integration SHA:** `e6c8306c02c2a1c7d758f2f39d24607a66a6ad3c`  
**Prior Cycle 1 tip on branch:** `bb6b414f38e4e6a1242cb36e1d32b072e3cb3e1e`  
**Branch under test:** `feature/flavorweave-alpha-remediation`  
**Agent model:** Composer 2.5 (`composer-2.5`)

## Cycle 1B merges (order)

| # | Branch | SHA | Notes |
|---|--------|-----|-------|
| 1 | `feature/fw-c1b-origin` | `9543a882551754e58f2f768c43d22fd487ff7b15` | `migrations/0009_evidence_origin_unproven.sql`, `docs/CYCLE1B-ORIGIN.md` |
| 2 | `feature/fw-c1b-verify` | `179008f5a59416e2b65387f2635e814ea06500b5` | Verification doc, manifest titles (FW awaiting Oversight; D-05/D-06 titles) |
| 3 | `feature/fw-c1b-layout` | `f0b693d66e5fb72c451316593ec1c843759059e7` | Header overflow fix, service worker `fw-sw-v7` |

`main` was **not** merged or pushed. `main` remains `97952206ef03363be726f22e0df6152251c0b931`.

## Commands (local CI parity)

Environment: Node `v22.14.0` (`engines.node` is `>=22`). Working directory: repository root. D1: **local only** (no `--remote`; production database id `23aa3db3-1090-471b-8c8a-b6fe71f5c053` not used).

| Step | Command | Result |
|------|---------|--------|
| Install | `npm ci` | **PASS** (174 packages) |
| Migrations | `npm run test:migrations` | **PASS** — `OK: 9 migration file(s)` |
| Unit | `npm run test:unit` | **PASS** — 27 files, **281** tests |
| Lint | `npm run lint` | **PASS** (`--max-warnings=0`) |
| Playwright browser | `npx playwright install chromium --with-deps` | **PASS** |
| E2E | `CI=true npm run test:e2e` | **PASS** — **27** tests (~1.5m, 1 worker) |

Matches `.github/workflows/ci.yml` step order and `CI=true` for e2e.

## Behavior coverage on this SHA

| Requirement | Automated evidence |
|-------------|-------------------|
| **FW-01:** Rate meal A, inspect B, enter/leave cook without completing, reload — A keeps rating, B unrated | `test/meal-identity.test.js` — `acceptance: rate A, inspect B, cook enter/exit without complete, reload keeps A rated and B unrated`; related reducer/reload tests in the same file |
| Synthetic rows excluded from taste learning, completed meal loop, funnel, alpha ops, traction | `test/evidence-origin.test.js`; `test/migration-0009.test.js` (SQL + post-0009 counts) |
| Unproven legacy rows excluded the same way | `test/evidence-origin.test.js` (`unproven legacy origin`); `test/migration-0009.test.js` |
| Explicit `household` rows still count | `test/evidence-origin.test.js` — `keeps a row that is explicitly marked household`; `test/migration-0009.test.js` — `hh_live` / `hh_real` counts |

## Scope exclusions (honored)

- Did not merge to `main`, deploy, or apply migrations to remote/production D1.
- Did not implement D-01–D-06 or write Household 001.
