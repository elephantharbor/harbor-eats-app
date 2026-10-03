# Cycle 1 integration

Long-lived branch: `feature/flavorweave-alpha-remediation`.
Integration model: Grok 4.7 (`grok-4.7`).

This commit merges Campaign Cycle 1 onto that branch, tags walnut dishes as nuts in the catalog, and keeps a single service-worker cache newer than both parents. It does not merge to `main`, deploy Pages or a Worker, or apply a D1 migration.

**Integration SHA:** `acdb92f3794a70adcd89c1c15e73d2670544502b`

That commit contains the merged tree, the walnut allergen tags, `fw-sw-v6`, and the first copy of this file. The branch tip is the following commit, which only replaces the placeholder with this SHA. Product code is identical at both. `git rev-parse HEAD` on `feature/flavorweave-alpha-remediation` is the tip.

## Parents

| Role | SHA |
|------|-----|
| Start (`feature/flavorweave-alpha-remediation`, FW-01, FW-02, evidence isolation) | `cda0dc75079ba82a4c2c9248a2301835b50b26b7` |
| Catalog parent (`feature/fw-c1-catalog`, FW-03, FW-04, FW-08) | `2303898dbc2f9439d4f39fe0e682b69489f48949` |
| Catalog merge | `1f15a1626d13198ef1dbb9ede46e76e17e84c979` |
| UX parent (`feature/fw-c1-ux`, FW-05, FW-06, FW-07, FW-09, FW-10) | `8b3e2f793a5e39837720306063d2b02c11fbaf38` |
| UX merge | `fc94bc65dc52dab3d1a5980635c99e339bdeb75e` |
| `main` (untouched) | `97952206ef03363be726f22e0df6152251c0b931` |

Merge order was catalog, then UX. Both merges used `--no-ff`.

## Conflicts

Overlapping files were `public/app.js`, `public/styles.css`, and `public/sw.js`. Git's ort strategy auto-merged all three. There were no conflict markers and no hand-edited hunks during the merge.

- `public/app.js` keeps the catalog meal-image shell (`meal-media__img`, ready/error classes, no DOM removal on error) and the UX diet, navigation, explanation, and next-dinner changes.
- `public/styles.css` keeps the catalog `.meal-media--ready` / `.meal-media--error` rules and the UX exception-tile and screen rules.
- `public/sw.js` took the catalog cache name `fw-sw-v5` and the UX precache entry `/nav-context.js`.

The UX branch did not bump the cache constant (it stayed `fw-sw-v4` while adding `/nav-context.js`). The catalog branch bumped `fw-sw-v4` to `fw-sw-v5` without that file. Leaving the merged shell on `fw-sw-v5` would let a client that already installed the catalog worker keep a cache that has no `nav-context.js`. This integration sets one cache version, `fw-sw-v6`, newer than both parents.

## Walnut allergen

`mushroom-walnut-bolognese` was tagged only `plant`, `dairy-free`, and `pasta`. The UX name scan blocked "No nuts" from the word walnut in the title. That guard is still in `ingredientTagsFromName`. The catalog now carries the allergen itself:

- `tags` and `dietary_tags` include `nuts` and `walnut`.
- `validateNutAllergenTags` scans the dish name, ingredient names, and step text for walnut, almond, pecan, hazelnut, pistachio, macadamia, pine nut, peanut, and cashew. Coconut, nutmeg, butternut, and nutritional yeast are not treated as nuts. A hit requires `nuts` plus the specific nut on both `tags` and `dietary_tags`.
- `peanut-noodle-stir-fry` already had `nuts` and `peanut`.
- `cashew-pesto-pasta` already had `nuts` and `cashew` on `tags`. Its `dietary_tags` now include `nuts` as well, so the recipe payload matches eligibility. Cashew is still allowed only by an explicit `{ rule_key: "cashew", status: "permitted" }` row. The HH001 floor in `validateDefaultEligibilityFloor` still prohibits nuts and does not add that permission. No Household 001 row was written.

`walnut` and the other specific nut tags are non-style tags in the taste model, so the allergen does not become similarity evidence.

## Tests

Node `v22.14.0`. `npm test` (migration file check, vitest, eslint):

| Check | Result |
|-------|--------|
| `scripts/check-migrations.sh` | OK: 8 migration files. None applied. |
| Vitest | 274 passed, 26 files |
| ESLint | pass, `--max-warnings=0` |

Playwright cycle 1 e2e was not run. `e2e/playwright.config.js` starts the app with `npm run db:migrate:local`, which applies migrations to local D1. This integration does not apply migrations to any D1 database. The UX branch recorded 26 of 26 Playwright tests passing on `8b3e2f79` against its own local D1; that run was not repeated here.

## Untouched

- `main` is still `97952206ef03363be726f22e0df6152251c0b931`. This branch was not merged to `main`.
- No Cloudflare Pages deploy, preview or production.
- No Worker deploy, preview or production.
- No migration was applied to any D1 database, including production. `migrations/0008_evidence_origin.sql` is committed and not applied. Existing October 1 rows would default to `household` if that file were applied later. Do not backfill production.
- Household 001 data was not read or written.
- D-01 through D-06 were not implemented.
