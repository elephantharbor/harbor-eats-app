-- D-03 classification metadata on the existing recipe version.
-- Classification is not a new culinary version. content_hash stays the culinary
-- hash and is not rewritten by this migration.
-- effort and effort_band are removed. Do not dual-write them.

ALTER TABLE catalog_version ADD COLUMN effort_level TEXT;
ALTER TABLE catalog_version ADD COLUMN ingredient_complexity TEXT;
ALTER TABLE catalog_version ADD COLUMN classification_hash TEXT;

ALTER TABLE catalog_version DROP COLUMN effort;
ALTER TABLE catalog_dish DROP COLUMN effort_band;

ALTER TABLE dinner_plan_meal ADD COLUMN effort_level TEXT;
ALTER TABLE dinner_plan_meal ADD COLUMN ingredient_complexity TEXT;

CREATE TABLE catalog_classification_history (
  history_id                    TEXT PRIMARY KEY,
  recipe_version_id             TEXT NOT NULL REFERENCES catalog_version(recipe_version_id),
  prior_effort_level            TEXT,
  prior_ingredient_complexity   TEXT,
  new_effort_level              TEXT NOT NULL,
  new_ingredient_complexity     TEXT NOT NULL,
  source                        TEXT NOT NULL,
  reason                        TEXT,
  created_at                    TEXT NOT NULL
);

CREATE INDEX idx_classification_history_version
  ON catalog_classification_history(recipe_version_id, created_at);
