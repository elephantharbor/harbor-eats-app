-- Cycle 3 dinner plans: one household plan, per-meal participants, pinned
-- recipe versions, and one consolidated shopping list.
--
-- Apply 0008, 0009, and 0010 before this file. The guard below fails closed
-- unless 0009 accepts data_origin = 'unproven' and 0010 has created
-- taste_vocabulary. Do not apply this file to production D1
-- 23aa3db3-1090-471b-8c8a-b6fe71f5c053. Do not write Household 001.
--
-- New rows default to data_origin 'unproven'. This file does not update
-- existing household, plan, rating, or preference rows.
-- Voting cannot be required: dinner_plan has no votes_required gate.
-- D1 splits migration files on semicolons, so this file does not use triggers.

-- ---------------------------------------------------------------------------
-- Guard: 0009 must accept 'unproven', and 0010 must already be present
-- ---------------------------------------------------------------------------

INSERT INTO household (
  household_id, display_name, status, timezone, servings_default,
  created_at, updated_at, data_origin
) VALUES (
  '__fw_c3_0009_guard__', '__fw_c3_0009_guard__', 'archived', 'UTC', 2,
  '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z', 'unproven'
);

DELETE FROM household WHERE household_id = '__fw_c3_0009_guard__';

SELECT COUNT(*) FROM taste_vocabulary;

-- ---------------------------------------------------------------------------
-- One household dinner plan. Not one plan per diner.
-- Status values are internal: draft, ready, shopping, active, completed.
-- ---------------------------------------------------------------------------

CREATE TABLE dinner_plan (
  dinner_plan_id          TEXT PRIMARY KEY,
  household_id            TEXT NOT NULL REFERENCES household(household_id),
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'ready', 'shopping', 'active', 'completed')),
  meal_count              INTEGER NOT NULL CHECK (meal_count BETWEEN 1 AND 14),
  entry_point             TEXT NOT NULL
                          CHECK (entry_point IN ('plan_dinners', 'tonight', 'find_dinner')),
  intent_json             TEXT NOT NULL DEFAULT '{}',
  shopping_started_at     TEXT,
  data_origin             TEXT NOT NULL DEFAULT 'unproven'
                          CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  created_by_member_id    TEXT NOT NULL REFERENCES member(member_id),
  finalized_by_member_id  TEXT REFERENCES member(member_id),
  finalized_at            TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE INDEX idx_dinner_plan_household ON dinner_plan(household_id, status);

-- ---------------------------------------------------------------------------
-- Slots. Leftovers and eating out occupy a slot and have no recipe version.
-- Fulfilled is only for those two kinds. A recipe meal cannot be fulfilled.
-- ---------------------------------------------------------------------------

CREATE TABLE dinner_plan_meal (
  meal_id                    TEXT PRIMARY KEY,
  dinner_plan_id             TEXT NOT NULL REFERENCES dinner_plan(dinner_plan_id) ON DELETE CASCADE,
  position                   INTEGER NOT NULL,
  kind                       TEXT NOT NULL CHECK (kind IN ('recipe', 'leftovers', 'eating_out')),
  state                      TEXT NOT NULL DEFAULT 'planned'
                             CHECK (state IN (
                               'planned', 'selected', 'cooking', 'cooked',
                               'partially_rated', 'fully_rated', 'skipped',
                               'abandoned', 'fulfilled'
                             )),
  scheduled_date             TEXT,
  recipe_slug                TEXT,
  recipe_id                  TEXT,
  recipe_version_id          TEXT,
  version_number             INTEGER,
  cooked_recipe_version_id   TEXT,
  title                      TEXT,
  base_servings              INTEGER,
  pinned_ingredients_json    TEXT,
  pinned_steps_json          TEXT,
  allergens_json             TEXT NOT NULL DEFAULT '[]',
  vocabulary_json            TEXT NOT NULL DEFAULT '[]',
  tags_json                  TEXT NOT NULL DEFAULT '[]',
  data_origin                TEXT NOT NULL DEFAULT 'unproven'
                             CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  created_at                 TEXT NOT NULL,
  updated_at                 TEXT NOT NULL,
  UNIQUE (dinner_plan_id, position),
  CHECK (
    (kind = 'recipe' AND recipe_version_id IS NOT NULL AND recipe_id IS NOT NULL
      AND state != 'fulfilled')
    OR
    (kind IN ('leftovers', 'eating_out') AND recipe_version_id IS NULL AND recipe_id IS NULL
      AND state IN ('planned', 'skipped', 'abandoned', 'fulfilled'))
  )
);

CREATE INDEX idx_dinner_plan_meal_plan ON dinner_plan_meal(dinner_plan_id, position);

-- Participants belong to the meal, not to household membership alone.
CREATE TABLE dinner_plan_participant (
  meal_id       TEXT NOT NULL REFERENCES dinner_plan_meal(meal_id) ON DELETE CASCADE,
  member_id     TEXT NOT NULL REFERENCES member(member_id),
  household_id  TEXT NOT NULL REFERENCES household(household_id),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  PRIMARY KEY (meal_id, member_id)
);

CREATE INDEX idx_dinner_plan_participant_member ON dinner_plan_participant(household_id, member_id);

-- Rating identity is the meal plus the cooked recipe version plus the diner.
CREATE TABLE dinner_plan_rating (
  rating_id          TEXT PRIMARY KEY,
  meal_id            TEXT NOT NULL REFERENCES dinner_plan_meal(meal_id) ON DELETE CASCADE,
  dinner_plan_id     TEXT NOT NULL REFERENCES dinner_plan(dinner_plan_id) ON DELETE CASCADE,
  household_id       TEXT NOT NULL REFERENCES household(household_id),
  member_id          TEXT NOT NULL REFERENCES member(member_id),
  recipe_version_id  TEXT,
  score              INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  data_origin        TEXT NOT NULL DEFAULT 'unproven'
                     CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (meal_id, member_id)
);

CREATE INDEX idx_dinner_plan_rating_plan ON dinner_plan_rating(dinner_plan_id);

-- One consolidated list. list_state is the line, not a pantry.
-- still_needed = 0 keeps a purchased or already-have line after the ingredient drops off.
CREATE TABLE dinner_shop_line (
  line_id            TEXT PRIMARY KEY,
  dinner_plan_id     TEXT NOT NULL REFERENCES dinner_plan(dinner_plan_id) ON DELETE CASCADE,
  ingredient_id      TEXT NOT NULL,
  display_name       TEXT NOT NULL,
  preparation        TEXT,
  unit               TEXT NOT NULL,
  quantity           REAL,
  list_state         TEXT NOT NULL DEFAULT 'open'
                     CHECK (list_state IN ('open', 'already_have', 'purchased')),
  still_needed       INTEGER NOT NULL DEFAULT 1 CHECK (still_needed IN (0, 1)),
  surplus_quantity   REAL NOT NULL DEFAULT 0,
  meal_ids_json      TEXT NOT NULL DEFAULT '[]',
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (dinner_plan_id, ingredient_id, unit)
);

CREATE INDEX idx_dinner_shop_line_plan ON dinner_shop_line(dinner_plan_id);

CREATE TABLE dinner_shop_delta (
  delta_id        TEXT PRIMARY KEY,
  dinner_plan_id  TEXT NOT NULL REFERENCES dinner_plan(dinner_plan_id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('added', 'no_longer_needed')),
  ingredient_id   TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  unit            TEXT NOT NULL,
  quantity        REAL NOT NULL,
  meal_id         TEXT,
  created_at      TEXT NOT NULL
);

CREATE INDEX idx_dinner_shop_delta_plan ON dinner_shop_delta(dinner_plan_id, created_at);

-- Optional and non-blocking. Finalize does not read this table.
CREATE TABLE dinner_plan_vote (
  vote_id         TEXT PRIMARY KEY,
  dinner_plan_id  TEXT NOT NULL REFERENCES dinner_plan(dinner_plan_id) ON DELETE CASCADE,
  meal_id         TEXT,
  household_id    TEXT NOT NULL REFERENCES household(household_id),
  member_id       TEXT NOT NULL REFERENCES member(member_id),
  data_origin     TEXT NOT NULL DEFAULT 'unproven'
                  CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  created_at      TEXT NOT NULL,
  UNIQUE (dinner_plan_id, member_id)
);

CREATE INDEX idx_dinner_plan_vote_plan ON dinner_plan_vote(dinner_plan_id);
