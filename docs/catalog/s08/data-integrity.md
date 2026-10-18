# Data integrity

No schema migration. `catalog_version.version_number` is already an integer with uniqueness on `(recipe_id, version_number)` and `(dish_id, version_number)`. v3 rows fit the existing table.

No production or preview D1 was opened. No household data was read.

## What a new version does

The importer in `scripts/import-catalog.mjs` uses `src/lib/catalog-disk.js`. It reads every `vN.json`, publishes the highest version, and retires the earlier ones. `catalog_dish.current_version_id` moves only when the incoming version number is at least the current one. Retired rows stay in the table. Their ingredient and step rows stay with that `recipe_version_id`.

`loadPublishedCatalog` returns `publication_status = published` only. A swap onto a retired id fails as an unknown recipe. `test/d03-d01-swap.test.js` covers salmon v2 and miso v1.

## Active plans

`resolvedRecipe` in `src/lib/plan-mutations.js` cooks from `pinned_ingredients` and `pinned_steps`. A newer catalog version does not change a plan. `adopt_version` is explicit, and only from `planned` or `selected`. A cooked meal cannot adopt.

The S-08 test inserts a cooked salmon meal pinned to v2, imports v3, and asserts the pin is still the v2 ingredient list.

## Ratings

`dinner_plan_rating.recipe_version_id` is the version that was cooked. Catalog import does not update it. The same test writes a score of 6 on `rv_maple-mustard-glazed-salmon_v2` and confirms it after a second import. v2 ingredient rows still do not include dill. v3 rows do.

## Shopping

Shop lines are built from pinned ingredients (`neededLines` / plan sync), and a saved `dinner_shop_line` is not rewritten by a catalog import. The test keeps a purchased Dijon line at quantity 2 through the v3 import. Gram salt on the new salmon scales with servings: 8 g at 4 servings is 4 g at 2.

Snapshots and shopped lines stay on the version they were built from. History is the old row, not an edit of it.

## Allergens

Runtime Household 001 eligibility does not read `hh001_eligible`. It uses tags, dietary booleans, and allergens. Salmon v3 and ginger-scallion v3 stay eligible for finfish. Pesto v3 stays cashew, nuts, and wheat, and dairy-free. No miso, fish sauce, or new allergen class was added. Shawarma still does not gain feta. Plant dishes still do not gain cheese.

`hh001_eligible: false` on the salmon package is a stale documentation flag ("not an HH001 plant meal"). The runtime still serves it to Household 001. Changing that boolean was not required for safety and was left as-is so this cycle does not pretend the flag is the eligibility authority.

## D1 at deploy

A catalog import is required before new versions appear when `CATALOG_SOURCE=d1`. It is not a schema migration.

Do not replay `data/staging-catalog-import.sql` onto an existing database. That file rewrites content hashes for rows that are already there.

The path that matches the code:

1. Build a fresh staging sqlite with `scripts/import-catalog.mjs --target staging`.
2. Publish a delta of the new version ids only: insert those `catalog_version` rows and their child rows, set the superseded ids to `retired`, and point `catalog_dish.current_version_id` at the new id when the new version number is higher.
3. Leave every other version row, every dinner plan, every rating, and every shop line alone.

That delta was not generated or applied in this cycle. S-07 is landing first. This branch does not deploy.

`test/helpers/catalog-import-fixture.js` still publishes factory v1 only, on purpose, so older fixture tests do not change meaning. The production-shaped loader is `loadCatalogFromDisk`, which does publish factory v2 and legacy v3.
