# Data integrity

No schema migration. `catalog_version.version_number` is already an integer with uniqueness on `(recipe_id, version_number)` and `(dish_id, version_number)`. v3 rows fit the existing table.

No production or preview D1 was opened. No household data was read.

## What a new version does

The importer in `scripts/import-catalog.mjs` uses `src/lib/catalog-disk.js`. It reads every `vN.json`, publishes the highest version, and retires the earlier ones. `catalog_dish.current_version_id` moves only when the incoming version number is at least the current one. Retired rows stay in the table. Their ingredient and step rows stay with that `recipe_version_id`.

`loadPublishedCatalog` returns `publication_status = published` only. A swap onto a retired id fails as an unknown recipe. `test/d03-d01-swap.test.js` covers salmon v2 and miso v1.

## Active plans

A dinner-plan meal and a history meal load the recipe and cook screens from `recipe_version_id` (`GET /api/recipes/version/:id` in `public/app.js`). That read returns the pinned catalog row, including a retired one, for a signed-in household. A newer published version does not change those screens. A meal with no version id, and a new selection, still load the latest published recipe by slug.

Shopping is built from `pinned_ingredients`. Cook attribution and ratings use `cooked_recipe_version_id` or `recipe_version_id`. `adopt_version` is the explicit move onto a published version, and only from `planned` or `selected`. It repins ingredients and steps, so the recipe, the shopping list, and the next cook all use that version. A cooked meal cannot adopt.

`resolvedRecipe` in `src/lib/plan-mutations.js` is not called by the app. The pinned-version test hits the worker: a salmon meal pinned to v2 still returns v2 ingredients and steps after v3 is published, shopping and the cook/rating version stay on v2, a new selection gets v3, and `adopt_version` moves the recipe, the shopping list, and the cook onto v3.

A separate S-08 test inserts a cooked salmon meal pinned to v2, imports v3, and asserts the stored pin is still the v2 ingredient list.

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

The path that matches the code is now generated:

1. `node scripts/s08-catalog-delta.mjs` builds a fresh local sqlite with `loadCatalogFromDisk`, `planImport`, and `applyCatalogWrites`, then writes `data/s08-catalog-delta.sql`.
2. The file inserts the 30 S-08 version rows (`package_revision` starting with `s08-`) with `INSERT OR IGNORE`, replaces child rows for those ids only, retires any other still-published version of those dishes, and updates `catalog_dish` the way `upsertDish` does (`current_version_id` plus the display columns). It inserts `recipe` with `ON CONFLICT DO NOTHING`.
3. It does not rewrite `content_hash` on a version that is already stored. It has no `BEGIN`. `wrangler d1 execute` on a file is atomic per batch, and the delta guard allows only INSERT, UPDATE, and DELETE, so the file is not one transaction. For a few seconds a dish can have two published versions. That window is harmless, and running the file again is idempotent. It does not mention household, plan, rating, or shop tables.
4. A second apply is a no-op for version count and published count.

Verified locally, not applied. See `docs/catalog/s08/RELEASE.md` for Preview, then Production. S-07 is landing first. This branch does not deploy.

`test/helpers/catalog-import-fixture.js` still publishes factory v1 only, on purpose, so older fixture tests do not change meaning. The production-shaped loader is `loadCatalogFromDisk`, which does publish factory v2 and legacy v3.
