# Catalog artifacts

The repo is the catalog source of truth. D1 is filled only by `scripts/import-catalog.mjs`. Do not hand-edit meal rows in D1.

`catalog/<dish-slug>/v1.json` is one immutable recipe version.

- `flavorweave-legacy-catalog-package` — the original 24 meals, copied from `src/lib/recipe-store.js`. Provenance is unknown where the repo does not state it. Image rights are unverified. `factory_certified` is false. `kitchen_tested` is false. These are not modern factory certifications.
- `flavorweave-catalog-package` — factory packages copied as-is. Do not edit their ingredients, quantities, steps, tags, eligibility, ids, or imagery.

Staging publication of the factory packages is an import policy (`--target staging` writes `publication_status = published`). The factory file's own `publication_status` stays in `artifact_publication_status`. Only `published` global versions enter normal recommendations. `certified` is a real state and is not on the menu until a later publish.

Images stay files at `/images/meals/<slug>.webp` and `/images/meals/<slug>-640.webp`. D1 stores those paths. There is no image binary in D1 and no R2 migration.

`src/lib/recipe-store.js` remains the parity fixture for the original 24. When `CATALOG_SOURCE=d1`, the worker and Pages function read D1 and do not fall back to recipe-store. Production wrangler config does not set that variable.

A later certified batch is another `catalog/<slug>/v1.json`, the same importer, and the same staging database. A legacy audit can add `v2.json` for an existing dish without a new table: version ids are immutable, and the dish's current pointer moves only to a higher version number.
