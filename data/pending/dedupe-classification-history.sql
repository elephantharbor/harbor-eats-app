-- PENDING (hardening-1). DATA-ONLY cleanup. NOT a schema migration. NOT applied to preview or prod.
-- Decision Card: docs/release/hardening-1/DECISION-CARD-classification-history.md
-- Removes later duplicate rows in catalog_classification_history that repeat an already-recorded
-- transition (same recipe_version_id, prior/new effort_level, prior/new ingredient_complexity, source).
-- Keeps the EARLIEST row (min created_at, then min history_id). Dropped rows differ only in
-- history_id / reason (batch label) / created_at. Expected on prod and preview today: 100 -> 75 rows.
-- Apply only with Oversight authorization, after a Time Travel bookmark:
--   npx wrangler d1 execute <db> --remote --config <env config> --file data/pending/dedupe-classification-history.sql
DELETE FROM catalog_classification_history
WHERE history_id IN (
  SELECT h.history_id
  FROM catalog_classification_history h
  WHERE EXISTS (
    SELECT 1 FROM catalog_classification_history k
    WHERE k.recipe_version_id = h.recipe_version_id
      AND COALESCE(k.prior_effort_level, '') = COALESCE(h.prior_effort_level, '')
      AND COALESCE(k.prior_ingredient_complexity, '') = COALESCE(h.prior_ingredient_complexity, '')
      AND k.new_effort_level = h.new_effort_level
      AND k.new_ingredient_complexity = h.new_ingredient_complexity
      AND k.source = h.source
      AND (k.created_at < h.created_at OR (k.created_at = h.created_at AND k.history_id < h.history_id))
  )
);
