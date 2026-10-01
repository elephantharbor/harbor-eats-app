-- Phase 4: meal concept + recipe version model, meal votes, rating ↔ version
-- Prefer additive changes; no DROP/rebuild of FK parents.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meal_concept (
  concept_id       TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  cuisine          TEXT,
  meal_format      TEXT,
  primary_ingredient TEXT,
  attributes_json  TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_version (
  recipe_version_id TEXT PRIMARY KEY,
  concept_id       TEXT NOT NULL REFERENCES meal_concept(concept_id),
  version_number   INTEGER NOT NULL DEFAULT 1,
  servings         INTEGER NOT NULL DEFAULT 4,
  prep_minutes     INTEGER,
  cook_minutes     INTEGER,
  effort           TEXT,
  methods_json     TEXT,
  dietary_json     TEXT,
  ingredients_json TEXT NOT NULL,
  steps_json       TEXT NOT NULL,
  substitutions_json TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','archived','draft')),
  created_at       TEXT NOT NULL,
  UNIQUE (concept_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_recipe_version_concept ON recipe_version(concept_id);

-- Per-member votes before household winner is resolved (2–4 diners)
CREATE TABLE IF NOT EXISTS meal_vote (
  vote_id          TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  meal_option_id   TEXT NOT NULL REFERENCES meal_option(meal_option_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT NOT NULL REFERENCES member(member_id),
  created_at       TEXT NOT NULL,
  UNIQUE (plan_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_meal_vote_plan ON meal_vote(plan_id);

-- Associate ratings with exact recipe version consumed
ALTER TABLE rating ADD COLUMN recipe_version_id TEXT;
CREATE INDEX IF NOT EXISTS idx_rating_recipe_version ON rating(recipe_version_id);
