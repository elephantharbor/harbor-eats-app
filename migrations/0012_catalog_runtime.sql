-- Runtime catalog. Repo artifacts are the source of truth. This migration
-- only creates tables. It does not insert meals and it does not mark any
-- recipe kitchen-tested or factory-certified.
--
-- Was gated until Oversight authorized the production catalog cutover (2026-10-04).
-- Production application to D1 23aa3db3-1090-471b-8c8a-b6fe71f5c053 is now authorized;
-- apply via controlled migrate + catalog import only. Do not write Household 001.
--
-- Publication: draft, qa_failed, certified, published, retired.
-- unpublished and invalid remain so a bad package can be refused.
-- Only published global versions are read by the normal menu.

PRAGMA foreign_keys = ON;

CREATE TABLE catalog_dish (
  dish_id              TEXT PRIMARY KEY,
  slug                 TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  name                 TEXT,
  description          TEXT,
  cuisine              TEXT,
  meal_format          TEXT,
  primary_ingredient   TEXT,
  texture              TEXT,
  flavor_profile       TEXT,
  effort_band          TEXT,
  weeknight            INTEGER,
  exploration          REAL,
  plate                TEXT,
  tone                 TEXT,
  tags_json            TEXT NOT NULL DEFAULT '[]',
  sparks_json          TEXT NOT NULL DEFAULT '[]',
  chips_json           TEXT NOT NULL DEFAULT '[]',
  current_recipe_id    TEXT,
  current_version_id   TEXT,
  created_at           TEXT NOT NULL
);

CREATE TABLE catalog_version (
  recipe_version_id          TEXT PRIMARY KEY,
  recipe_id                  TEXT NOT NULL,
  dish_id                    TEXT NOT NULL,
  version_number             INTEGER NOT NULL,
  title                      TEXT NOT NULL,
  description                TEXT,
  base_servings              INTEGER NOT NULL,
  prep_minutes               INTEGER,
  cook_minutes               INTEGER,
  total_minutes              INTEGER,
  effort                     TEXT,
  heat                       TEXT,
  doneness                   TEXT,
  methods_json               TEXT NOT NULL DEFAULT '[]',
  dietary_tags_json          TEXT NOT NULL DEFAULT '[]',
  substitutions_json         TEXT NOT NULL DEFAULT 'null',
  components_json            TEXT NOT NULL DEFAULT '[]',
  publication_status         TEXT NOT NULL
                             CHECK (publication_status IN (
                               'draft', 'qa_failed', 'certified', 'published', 'retired',
                               'unpublished', 'invalid'
                             )),
  artifact_publication_status TEXT,
  visibility                 TEXT NOT NULL DEFAULT 'global'
                             CHECK (visibility IN ('global', 'household')),
  household_id               TEXT,
  content_hash               TEXT NOT NULL,
  source_contract            TEXT NOT NULL,
  source_path                TEXT NOT NULL,
  created_at                 TEXT NOT NULL,
  UNIQUE (recipe_id, version_number),
  UNIQUE (dish_id, version_number),
  CHECK (
    (visibility = 'global' AND household_id IS NULL)
    OR (
      visibility = 'household'
      AND household_id IS NOT NULL
      AND publication_status != 'published'
    )
  )
);

CREATE INDEX idx_catalog_version_menu
  ON catalog_version(publication_status, visibility);

CREATE TABLE catalog_ingredient (
  recipe_version_id  TEXT NOT NULL REFERENCES catalog_version(recipe_version_id),
  position           INTEGER NOT NULL,
  ingredient_id      TEXT,
  name               TEXT NOT NULL,
  display_name       TEXT,
  quantity           REAL,
  unit               TEXT,
  raw_quantity       TEXT,
  note               TEXT,
  preparation        TEXT,
  optional           INTEGER NOT NULL DEFAULT 0 CHECK (optional IN (0, 1)),
  role               TEXT,
  PRIMARY KEY (recipe_version_id, position)
);

CREATE TABLE catalog_step (
  recipe_version_id    TEXT NOT NULL REFERENCES catalog_version(recipe_version_id),
  step_number          INTEGER NOT NULL,
  title                TEXT,
  body                 TEXT NOT NULL,
  ingredient_refs_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (recipe_version_id, step_number)
);

CREATE TABLE catalog_taste_tag (
  recipe_version_id  TEXT NOT NULL REFERENCES catalog_version(recipe_version_id),
  vocabulary_slug    TEXT NOT NULL,
  PRIMARY KEY (recipe_version_id, vocabulary_slug)
);

CREATE TABLE catalog_dietary_label (
  recipe_version_id  TEXT NOT NULL REFERENCES catalog_version(recipe_version_id),
  label              TEXT NOT NULL,
  PRIMARY KEY (recipe_version_id, label)
);

CREATE TABLE catalog_allergen (
  recipe_version_id  TEXT NOT NULL REFERENCES catalog_version(recipe_version_id),
  allergen           TEXT NOT NULL,
  PRIMARY KEY (recipe_version_id, allergen)
);

CREATE TABLE catalog_equipment (
  recipe_version_id  TEXT NOT NULL REFERENCES catalog_version(recipe_version_id),
  item               TEXT NOT NULL,
  PRIMARY KEY (recipe_version_id, item)
);

CREATE TABLE catalog_eligibility_tag (
  recipe_version_id  TEXT NOT NULL REFERENCES catalog_version(recipe_version_id),
  tag                TEXT NOT NULL,
  PRIMARY KEY (recipe_version_id, tag)
);

CREATE TABLE catalog_image_ref (
  recipe_version_id  TEXT NOT NULL REFERENCES catalog_version(recipe_version_id),
  role               TEXT NOT NULL CHECK (role IN ('master', 'card')),
  path               TEXT NOT NULL,
  provenance         TEXT NOT NULL,
  rights_state       TEXT NOT NULL,
  PRIMARY KEY (recipe_version_id, role)
);

CREATE TABLE catalog_provenance (
  recipe_version_id      TEXT PRIMARY KEY REFERENCES catalog_version(recipe_version_id),
  certification_class    TEXT NOT NULL
                         CHECK (certification_class IN ('legacy_structural', 'factory_certified')),
  factory_certified      INTEGER NOT NULL CHECK (factory_certified IN (0, 1)),
  text_provenance        TEXT NOT NULL,
  text_provenance_raw    TEXT,
  image_provenance       TEXT NOT NULL,
  image_rights           TEXT NOT NULL,
  kitchen_tested         INTEGER NOT NULL CHECK (kitchen_tested IN (0, 1)),
  household_cook_count   INTEGER,
  rating_count           INTEGER,
  freeze_integrity       TEXT,
  gates_a_o              TEXT,
  image_gates            TEXT,
  evidence_basis         TEXT NOT NULL,
  package_self_report_json TEXT NOT NULL DEFAULT '{}',
  evidence_note          TEXT NOT NULL
);
