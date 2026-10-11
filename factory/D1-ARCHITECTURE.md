# FlavorWeave Catalog D1 Architecture

Runtime path: **version-controlled certified catalog artifacts → deterministic importer → D1**.

`src/lib/recipe-store.js` is the parity fixture for the original legacy meals. It is not the live catalog once `CATALOG_SOURCE=d1`. Do not grow the catalog by editing `recipe-store.js`.

The factory does not authorize a migration. Author and auditor runs do not import D1, deploy, or publish. An integrator imports only when a task explicitly allows it, and then only through `scripts/import-catalog.mjs`.

## Principles

- The repository is the source of truth for what is approved
- D1 is the runtime copy, not a hand-edited content store
- Nobody hand-edits production recipe rows in D1
- Image binaries stay out of D1. D1 stores paths. Files live at `/images/meals/<slug>.webp` and `/images/meals/<slug>-640.webp`
- Prefer first-class columns (dish, recipe, version, ingredients, steps, taste tags, dietary and allergen data, publication, provenance, image refs) over one opaque blob
- Imports are idempotent. A malformed package or an identity collision is refused
- Certified factory JSON is not rewritten by the importer

## Artifact layout

Current convention, which the importer already walks:

```text
catalog/<dish-slug>/v1.json
catalog/<dish-slug>/v2.json          # only when a later version exists
catalog/<dish-slug>/FREEZE_INTEGRITY.json
```

`dish.slug` matches the directory name. `catalog_contract` is `flavorweave-catalog-package` for factory meals and the legacy contract for the original set. See `catalog/README.md`.

Factory work in progress does **not** go in `catalog/`. It lives at:

```text
factory/waves/<wave>/candidates/<dish-slug>/v1.json
factory/waves/<wave>/candidates/<dish-slug>/d03-classification.json
factory/waves/<wave>/candidates/<dish-slug>/image-plating-brief.md
factory/waves/<wave>/candidates/<dish-slug>/image-prompt.md
```

The integrator copies a PASS-certified candidate into `catalog/<dish-slug>/` without changing culinary content. Until that copy, the meal is not on the import path. `scripts/import-catalog.mjs` only reads `catalog/`.

## Importer

`scripts/import-catalog.mjs` validates packages and writes an isolated staging sqlite file. It refuses production. Relevant code:

- `src/lib/catalog-import.js` — `normalizeFactoryPackage`
- `src/lib/factory-package-tokens.js` — allergen, dietary-label, and provenance maps
- `catalog/staging-publication.json` — staging publication policy

Staging (`--target staging`) may mark a version published inside the staging database. The package file's own `publication_status` stays on the artifact as `artifact_publication_status`. `certified` is not "on the menu." Only a published global version enters normal recommendations.

Unknown allergen tokens, unknown dietary labels, and unknown provenance strings fail the import. Nothing is dropped silently.

`kitchen_tested` must be false for factory packages. Household cook count and rating count must be 0.

## Migration sequence

Still the sequence, still not this task:

1. Certified package contract (this directory)
2. Existing meals already live as versioned artifacts in `catalog/`
3. Stable ids preserved
4. Unknown legacy provenance stays unknown
5. Legacy images tracked through legacy audit
6. Import into preview D1
7. Parity against `recipe-store.js` for the original set
8. Eligibility, ranking, and planning inputs verified
9. Recommender reads D1 in preview
10. Behavior equivalent or intentionally better
11. Preview runtime reads D1
12. Regression test
13. Production switch only after an explicit release approval
14. `recipe-store.js` leaves the live read path

Do not keep a long-lived dual write.

## Who does what

- **Author** writes factory candidates. Does not import.
- **Independent auditor** certifies. Does not import.
- **Integrator** copies certified packages into `catalog/` and runs the staging importer when a task allows it. Does not rewrite recipes. Does not deploy unless that same task includes a release.

Design changes to the importer or to D1 schema are engineering work, not a catalog-authoring side effect.
