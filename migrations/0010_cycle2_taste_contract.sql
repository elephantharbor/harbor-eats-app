-- Cycle 2 contract tables for taste vocabulary, diner tastes, planning hints,
-- recipe packages, shopped ingredient snapshots, and targeted feedback.
--
-- Apply 0008 and 0009 before this file. 0008 alone leaves data_origin unable
-- to store 'unproven'. The guard below fails closed unless 0009 has already
-- widened that check. Do not apply this file to production D1
-- 23aa3db3-1090-471b-8c8a-b6fe71f5c053. Do not write Household 001.
--
-- The vocabulary rows live in src/lib/taste-vocabulary.js. This migration
-- does not copy them and does not rewrite the 24 alpha recipes.
-- No current recipe is inserted, and none is marked kitchen-tested.
-- Version immutability is enforced by src/lib/recipe-package.js. D1 splits
-- migration files on semicolons, so this file does not use triggers.

-- ---------------------------------------------------------------------------
-- Guard: 0009 must already accept data_origin = 'unproven'
-- ---------------------------------------------------------------------------

INSERT INTO household (
  household_id, display_name, status, timezone, servings_default,
  created_at, updated_at, data_origin
) VALUES (
  '__fw_c2_0009_guard__', '__fw_c2_0009_guard__', 'archived', 'UTC', 2,
  '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z', 'unproven'
);

DELETE FROM household WHERE household_id = '__fw_c2_0009_guard__';

-- ---------------------------------------------------------------------------
-- Taste vocabulary. Search does not insert rows; a writer loads the module.
-- ---------------------------------------------------------------------------

CREATE TABLE taste_vocabulary (
  slug          TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  category      TEXT NOT NULL
                CHECK (category IN ('cuisine', 'flavor', 'texture', 'meal_style', 'ingredient')),
  parent_slug   TEXT REFERENCES taste_vocabulary(slug),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  synonyms_json TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_taste_vocabulary_category ON taste_vocabulary(category, active);

-- ---------------------------------------------------------------------------
-- Personal tastes. One row per diner per term. Not a household average.
-- less_often is a rank, not a prohibition. Remove deletes the row.
-- ---------------------------------------------------------------------------

CREATE TABLE diner_taste (
  taste_id         TEXT PRIMARY KEY,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT NOT NULL REFERENCES member(member_id),
  vocabulary_slug  TEXT NOT NULL REFERENCES taste_vocabulary(slug),
  rank             TEXT NOT NULL CHECK (rank IN ('love', 'like', 'less_often')),
  stance           TEXT NOT NULL CHECK (stance IN ('explicit', 'inferred')),
  confidence       REAL,
  data_origin      TEXT NOT NULL DEFAULT 'unproven'
                   CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (member_id, vocabulary_slug)
);

CREATE INDEX idx_diner_taste_member ON diner_taste(household_id, member_id);
CREATE INDEX idx_diner_taste_origin ON diner_taste(data_origin);

-- ---------------------------------------------------------------------------
-- Practical planning hints. Overridable. Not eligibility. Not taste evidence.
-- ---------------------------------------------------------------------------

CREATE TABLE diner_practical_hint (
  hint_id      TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES household(household_id),
  member_id    TEXT NOT NULL REFERENCES member(member_id),
  hint_key     TEXT NOT NULL
               CHECK (hint_key IN (
                 'under_30_minutes', 'low_cleanup', 'grill_friendly', 'equipment', 'weeknight'
               )),
  detail       TEXT NOT NULL DEFAULT '',
  stance       TEXT NOT NULL CHECK (stance IN ('explicit', 'inferred')),
  overridden   INTEGER NOT NULL DEFAULT 0 CHECK (overridden IN (0, 1)),
  data_origin  TEXT NOT NULL DEFAULT 'unproven'
               CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (member_id, hint_key, detail)
);

CREATE INDEX idx_diner_practical_member ON diner_practical_hint(household_id, member_id);

-- ---------------------------------------------------------------------------
-- Dish → recipe → immutable recipe version.
-- Household visibility cannot be published as a global recipe.
-- ---------------------------------------------------------------------------

CREATE TABLE recipe (
  recipe_id     TEXT PRIMARY KEY,
  dish_id       TEXT NOT NULL,
  visibility    TEXT NOT NULL DEFAULT 'global'
                CHECK (visibility IN ('global', 'household')),
  household_id  TEXT REFERENCES household(household_id),
  created_at    TEXT NOT NULL,
  CHECK (
    (visibility = 'global' AND household_id IS NULL)
    OR (visibility = 'household' AND household_id IS NOT NULL)
  )
);

CREATE INDEX idx_recipe_dish ON recipe(dish_id);

CREATE TABLE recipe_package_version (
  recipe_version_id     TEXT PRIMARY KEY,
  recipe_id             TEXT NOT NULL REFERENCES recipe(recipe_id),
  version_number        INTEGER NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  ingredients_json      TEXT NOT NULL,
  base_servings         INTEGER NOT NULL,
  equipment_json        TEXT NOT NULL DEFAULT '[]',
  prep_minutes          INTEGER,
  cook_minutes          INTEGER,
  total_minutes         INTEGER,
  steps_json            TEXT NOT NULL,
  heat                  TEXT,
  doneness              TEXT,
  dietary_json          TEXT NOT NULL DEFAULT '[]',
  allergen_json         TEXT NOT NULL DEFAULT '[]',
  vocabulary_tag_ids_json TEXT NOT NULL DEFAULT '[]',
  provenance            TEXT NOT NULL
                        CHECK (provenance IN (
                          'original_team_created', 'licensed', 'ai_assisted',
                          'household_submitted', 'unknown_unverified'
                        )),
  image_ref             TEXT,
  image_provenance      TEXT NOT NULL
                        CHECK (image_provenance IN (
                          'original_photo', 'licensed_photo', 'ai_illustration', 'unknown'
                        )),
  publication_status    TEXT NOT NULL
                        CHECK (publication_status IN ('draft', 'published', 'unpublished', 'invalid')),
  rights_state          TEXT NOT NULL
                        CHECK (rights_state IN (
                          'not_cleared_for_external_release',
                          'cleared_for_external_release',
                          'unknown'
                        )),
  kitchen_tested        INTEGER NOT NULL DEFAULT 0 CHECK (kitchen_tested IN (0, 1)),
  validation_kind       TEXT NOT NULL DEFAULT 'structural_only'
                        CHECK (validation_kind IN ('structural_only', 'kitchen_tested')),
  visibility            TEXT NOT NULL DEFAULT 'global'
                        CHECK (visibility IN ('global', 'household')),
  household_id          TEXT REFERENCES household(household_id),
  data_origin           TEXT NOT NULL DEFAULT 'unproven'
                        CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  created_at            TEXT NOT NULL,
  UNIQUE (recipe_id, version_number),
  CHECK (
    (visibility = 'global' AND household_id IS NULL)
    OR (
      visibility = 'household'
      AND household_id IS NOT NULL
      AND publication_status != 'published'
    )
  )
);

CREATE INDEX idx_recipe_package_recipe ON recipe_package_version(recipe_id);
CREATE INDEX idx_recipe_package_publication ON recipe_package_version(publication_status, visibility);

-- Frozen ingredients for a plan. Publishing a later version does not update this.
CREATE TABLE shopped_plan_line (
  plan_id            TEXT NOT NULL REFERENCES plan(plan_id),
  recipe_version_id  TEXT NOT NULL,
  ingredients_json   TEXT NOT NULL,
  shopped_at         TEXT NOT NULL,
  PRIMARY KEY (plan_id, recipe_version_id)
);

-- ---------------------------------------------------------------------------
-- Optional targeted feedback on one cooked version. Not a required survey.
-- ---------------------------------------------------------------------------

CREATE TABLE targeted_feedback (
  feedback_id        TEXT PRIMARY KEY,
  household_id       TEXT NOT NULL REFERENCES household(household_id),
  member_id          TEXT NOT NULL REFERENCES member(member_id),
  meal_option_id     TEXT,
  recipe_version_id  TEXT NOT NULL,
  code               TEXT NOT NULL
                     CHECK (code IN ('loved_the_crunch', 'too_spicy', 'great_sauce', 'too_rich')),
  stance             TEXT NOT NULL DEFAULT 'explicit'
                     CHECK (stance IN ('explicit', 'inferred')),
  data_origin        TEXT NOT NULL DEFAULT 'unproven'
                     CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  created_at         TEXT NOT NULL
);

CREATE INDEX idx_targeted_feedback_member ON targeted_feedback(household_id, member_id);
