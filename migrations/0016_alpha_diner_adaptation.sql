-- Alpha readiness: per-dinner guest covers and meal-level recipe adaptation overrides.
-- guest_count: unnamed diners 0..6 (enforced in set_guest_count).
-- dinner_meal_adaptation: cook/shopping overlay; catalog pins stay immutable.

ALTER TABLE dinner_plan_meal ADD COLUMN guest_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS dinner_meal_adaptation (
  meal_id TEXT PRIMARY KEY,
  dinner_plan_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  recipe_version_id TEXT NOT NULL,
  override_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (meal_id) REFERENCES dinner_plan_meal(meal_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dinner_meal_adaptation_plan
  ON dinner_meal_adaptation(dinner_plan_id);
