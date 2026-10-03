-- Campaign cycle 1: mark household learning rows as real or synthetic.
-- Additive columns with a default of 'household'. Existing rows stay household
-- until a writer stamps them synthetic. Do not apply this file to production D1
-- as part of cycle 1; it is safe to apply on isolated dev/test databases.

ALTER TABLE household ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'household'
  CHECK (data_origin IN ('household', 'synthetic'));

ALTER TABLE plan ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'household'
  CHECK (data_origin IN ('household', 'synthetic'));

ALTER TABLE selection ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'household'
  CHECK (data_origin IN ('household', 'synthetic'));

ALTER TABLE cook ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'household'
  CHECK (data_origin IN ('household', 'synthetic'));

ALTER TABLE rating ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'household'
  CHECK (data_origin IN ('household', 'synthetic'));

ALTER TABLE preference_evidence ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'household'
  CHECK (data_origin IN ('household', 'synthetic'));

ALTER TABLE event ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'household'
  CHECK (data_origin IN ('household', 'synthetic'));

ALTER TABLE meal_vote ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'household'
  CHECK (data_origin IN ('household', 'synthetic'));
