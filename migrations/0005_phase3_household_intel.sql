-- Phase 3: household settings, taste evidence, client errors, meal_option A–E
--
-- D1 / SQLite: do NOT rely on PRAGMA foreign_keys = OFF across Wrangler migration
-- batches. Child tables (selection, cook, rating) reference meal_option; expand the
-- parent CHECK by stashing rows, dropping dependents, rebuilding meal_option, then
-- recreating dependents and restoring data.

-- ---------------------------------------------------------------------------
-- 1) Stash dependent + parent rows
-- ---------------------------------------------------------------------------

CREATE TABLE _he_migrate_meal_option AS SELECT * FROM meal_option;
CREATE TABLE _he_migrate_selection AS SELECT * FROM selection;
CREATE TABLE _he_migrate_cook AS SELECT * FROM cook;
CREATE TABLE _he_migrate_rating AS SELECT * FROM rating;

-- ---------------------------------------------------------------------------
-- 2) Drop FK dependents, then meal_option
-- ---------------------------------------------------------------------------

DROP TABLE selection;
DROP TABLE cook;
DROP TABLE rating;
DROP TABLE meal_option;

-- ---------------------------------------------------------------------------
-- 3) meal_option with letters A–E
-- ---------------------------------------------------------------------------

CREATE TABLE meal_option (
  meal_option_id   TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  letter           TEXT NOT NULL CHECK (letter IN ('A','B','C','D','E')),
  name             TEXT NOT NULL,
  recipe_slug      TEXT,
  recipe_version   TEXT,
  description_short TEXT,
  attributes_json  TEXT,
  selected         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  UNIQUE (plan_id, letter)
);

CREATE INDEX idx_meal_option_plan ON meal_option(plan_id);

INSERT INTO meal_option
  SELECT meal_option_id, plan_id, letter, name, recipe_slug, recipe_version,
         description_short, attributes_json, selected, created_at
  FROM _he_migrate_meal_option;

-- ---------------------------------------------------------------------------
-- 4) Recreate dependents (same shape as 0001_init.sql)
-- ---------------------------------------------------------------------------

CREATE TABLE selection (
  selection_id     TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  meal_option_id   TEXT NOT NULL REFERENCES meal_option(meal_option_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  source           TEXT NOT NULL
                   CHECK (source IN ('app','email','sms','share_link','ops')),
  actor_member_id  TEXT REFERENCES member(member_id),
  share_object_id  TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_selection_plan ON selection(plan_id);

INSERT INTO selection SELECT * FROM _he_migrate_selection;

CREATE TABLE cook (
  cook_id          TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  meal_option_id   TEXT NOT NULL REFERENCES meal_option(meal_option_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  source           TEXT NOT NULL
                   CHECK (source IN ('app','email','sms','ops')),
  actor_member_id  TEXT REFERENCES member(member_id),
  cooked_at        TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_cook_plan ON cook(plan_id);

INSERT INTO cook SELECT * FROM _he_migrate_cook;

CREATE TABLE rating (
  rating_id        TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  meal_option_id   TEXT NOT NULL REFERENCES meal_option(meal_option_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT NOT NULL REFERENCES member(member_id),
  score            INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  note             TEXT,
  source           TEXT NOT NULL
                   CHECK (source IN ('app','email','sms','ops')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (meal_option_id, member_id)
);

CREATE INDEX idx_rating_plan ON rating(plan_id);

INSERT INTO rating SELECT * FROM _he_migrate_rating;

DROP TABLE _he_migrate_meal_option;
DROP TABLE _he_migrate_selection;
DROP TABLE _he_migrate_cook;
DROP TABLE _he_migrate_rating;

-- ---------------------------------------------------------------------------
-- 5) Phase 3 columns + new tables (no meal_option FK)
-- ---------------------------------------------------------------------------

ALTER TABLE household ADD COLUMN meal_choice_count INTEGER NOT NULL DEFAULT 3;
ALTER TABLE household ADD COLUMN scheduling_cadence TEXT NOT NULL DEFAULT 'on_demand'
  CHECK (scheduling_cadence IN ('on_demand','weekly','biweekly'));
ALTER TABLE household ADD COLUMN settings_json TEXT;

CREATE TABLE preference_evidence (
  evidence_id      TEXT PRIMARY KEY,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT REFERENCES member(member_id),
  source           TEXT NOT NULL
                   CHECK (source IN ('onboarding_spark','taste_correction','rating_note','manual')),
  kind             TEXT NOT NULL CHECK (kind IN ('like','dislike','neutral')),
  tag              TEXT NOT NULL,
  weight           REAL NOT NULL DEFAULT 1,
  note             TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_pref_evidence_household ON preference_evidence(household_id, created_at);

CREATE TABLE client_error (
  error_id         TEXT PRIMARY KEY,
  household_id     TEXT,
  member_id        TEXT,
  surface          TEXT NOT NULL,
  code             TEXT,
  message          TEXT,
  path             TEXT,
  props_json       TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_client_error_time ON client_error(created_at);
CREATE INDEX idx_client_error_surface ON client_error(surface, created_at);
