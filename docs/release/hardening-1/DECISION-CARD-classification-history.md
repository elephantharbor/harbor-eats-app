# Decision Card — Classification history "duplicate" (hardening-1, item 29)

**Finding.** There is ONE table, `catalog_classification_history` (migration 0013). No second effort-history table exists
in migrations, code, local, preview or prod. The defect is **duplicate rows**: prod and preview each hold 100 rows for
75 versions — the 25 wave-12 versions carry two identical `NULL → X` rows (`clh_d03-classification-backfill-…` at
2026-10-04 and `clh_wave-12-catalog-integration_…` at 2026-10-08). Same version, same transition, same source; they differ
only in `history_id`, `reason` (batch label) and `created_at`.

**Consumers.** Writes: `src/lib/catalog-write.js#rememberClassification` (importer), `src/lib/catalog-staging-sql.js`
(rendered staging SQL), `scripts/apply-d03-backfill.mjs` (d03 SQL). Reads: none at runtime (audit log only).
Authoritative table: `catalog_classification_history`. Current classification lives on `catalog_version`.

**Root cause.** Rendered import SQL used batch-scoped `history_id` with `INSERT OR IGNORE`, and the staging renderer
DELETE-then-INSERTs child rows per version — so applying two batch SQL files to one live DB re-records the same
transition (and a staging re-import would rewrite history).

**Decision.** Data-only cleanup + importer guard. No schema migration.
- Code (in PR): history is append-only in rendered SQL (no DELETE) and each insert is `… WHERE NOT EXISTS` the same
  version/transition/source. Test: `test/classification-history-dedupe.test.js`.
- Data (PENDING, not applied): `data/pending/dedupe-classification-history.sql` keeps the earliest row per transition.
  Read-only dry count on prod and preview: **25 rows would be deleted (100 → 75)**. Validated on a local D1 copy (100 → 75,
  idempotent, FK check clean). Real amendments (different prior/new) are preserved.

**Non-goals.** Not applied to preview/prod (Oversight gate); no table drop/rename; `catalog_version` untouched.
