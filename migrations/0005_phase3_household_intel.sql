-- Phase 3: household settings, taste evidence, client errors, meal_option A–E

PRAGMA foreign_keys = OFF;

CREATE TABLE meal_option_new (
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

INSERT INTO meal_option_new
  SELECT meal_option_id, plan_id, letter, name, recipe_slug, recipe_version,
         description_short, attributes_json, selected, created_at
  FROM meal_option;

DROP TABLE meal_option;
ALTER TABLE meal_option_new RENAME TO meal_option;
CREATE INDEX idx_meal_option_plan ON meal_option(plan_id);

PRAGMA foreign_keys = ON;

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
