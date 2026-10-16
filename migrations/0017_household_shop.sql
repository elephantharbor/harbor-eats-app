-- S-02 household shopping list.
-- One open list per household. Recipe rows are a projection of dinner_shop_line.
-- General items live only here. Shopper marks are not a pantry.
-- D1 splits this file on semicolons. No triggers.
-- Safe to inspect on a backup first: node scripts/shop-migration-0017.mjs

CREATE TABLE household_shop_list (
  shop_list_id      TEXT PRIMARY KEY,
  household_id      TEXT NOT NULL REFERENCES household(household_id),
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'archived')),
  revision          INTEGER NOT NULL DEFAULT 1,
  content_revision  INTEGER NOT NULL DEFAULT 1,
  dinner_plan_id    TEXT,
  trip_method       TEXT CHECK (trip_method IS NULL OR trip_method IN ('instore', 'order_online')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_household_shop_list_one_open
  ON household_shop_list(household_id)
  WHERE status = 'open';

CREATE INDEX idx_household_shop_list_household ON household_shop_list(household_id, status);

CREATE TABLE household_shop_line (
  line_id                 TEXT PRIMARY KEY,
  shop_list_id            TEXT NOT NULL REFERENCES household_shop_list(shop_list_id) ON DELETE CASCADE,
  ingredient_id           TEXT,
  general_key             TEXT,
  display_name            TEXT NOT NULL,
  name_custom             INTEGER NOT NULL DEFAULT 0 CHECK (name_custom IN (0, 1)),
  preparation             TEXT,
  unit                    TEXT NOT NULL,
  quantity_required       REAL,
  quantity_manual         REAL,
  quantity_override       REAL,
  override_basis          REAL,
  override_stale          INTEGER NOT NULL DEFAULT 0 CHECK (override_stale IN (0, 1)),
  reconcile_note          TEXT,
  list_state              TEXT NOT NULL DEFAULT 'open'
                          CHECK (list_state IN ('open', 'already_have', 'purchased', 'skipped')),
  still_needed            INTEGER NOT NULL DEFAULT 1 CHECK (still_needed IN (0, 1)),
  surplus_quantity        REAL NOT NULL DEFAULT 0,
  meal_ids_json           TEXT NOT NULL DEFAULT '[]',
  recipe_version_ids_json TEXT NOT NULL DEFAULT '[]',
  category                TEXT NOT NULL DEFAULT 'other',
  category_custom         INTEGER NOT NULL DEFAULT 0 CHECK (category_custom IN (0, 1)),
  unparsed                INTEGER NOT NULL DEFAULT 0 CHECK (unparsed IN (0, 1)),
  note                    TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  CHECK (ingredient_id IS NOT NULL OR general_key IS NOT NULL)
);

CREATE UNIQUE INDEX idx_household_shop_line_identity
  ON household_shop_line (
    shop_list_id,
    ifnull(ingredient_id, ''),
    ifnull(general_key, ''),
    unit
  );

CREATE INDEX idx_household_shop_line_list ON household_shop_line(shop_list_id);

CREATE TABLE household_shop_requirement (
  requirement_id          TEXT PRIMARY KEY,
  line_id                 TEXT NOT NULL REFERENCES household_shop_line(line_id) ON DELETE CASCADE,
  shop_list_id            TEXT NOT NULL,
  origin                  TEXT NOT NULL CHECK (origin IN ('recipe', 'general')),
  dinner_plan_id          TEXT,
  plan_line_id            TEXT,
  meal_ids_json           TEXT NOT NULL DEFAULT '[]',
  recipe_version_ids_json TEXT NOT NULL DEFAULT '[]',
  quantity                REAL,
  unit                    TEXT NOT NULL,
  still_needed            INTEGER NOT NULL DEFAULT 1 CHECK (still_needed IN (0, 1)),
  source_key              TEXT NOT NULL,
  client_request_id       TEXT,
  display_name            TEXT,
  preparation             TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  UNIQUE (shop_list_id, source_key)
);

CREATE INDEX idx_household_shop_requirement_line ON household_shop_requirement(line_id);

CREATE UNIQUE INDEX idx_household_shop_requirement_client
  ON household_shop_requirement(shop_list_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Compare-and-swap guard. A stale revision inserts NULL and the batch aborts.
-- NOT NULL is required: SQLite does not imply it for a TEXT primary key.
CREATE TABLE household_shop_cas (
  shop_list_id TEXT PRIMARY KEY NOT NULL,
  token        TEXT NOT NULL
);

CREATE TABLE shop_share (
  share_id              TEXT PRIMARY KEY,
  shop_list_id          TEXT NOT NULL REFERENCES household_shop_list(shop_list_id),
  household_id          TEXT NOT NULL REFERENCES household(household_id),
  created_by_member_id  TEXT NOT NULL REFERENCES member(member_id),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  expires_at            TEXT NOT NULL,
  created_at            TEXT NOT NULL,
  revoked_at            TEXT,
  snapshot_json         TEXT NOT NULL,
  snapshot_revision     INTEGER NOT NULL
);

CREATE INDEX idx_shop_share_household ON shop_share(household_id, status, created_at);

ALTER TABLE member ADD COLUMN shopping_prefs_json TEXT;

-- Backfill the current non-completed plan so an existing kitchen does not
-- open an empty list. Idempotent: skipped when an open list already exists.
INSERT INTO household_shop_list (
  shop_list_id, household_id, status, revision, content_revision,
  dinner_plan_id, trip_method, created_at, updated_at
)
SELECT
  'hsl_' || p.household_id,
  p.household_id,
  'open',
  1,
  1,
  p.dinner_plan_id,
  NULL,
  p.created_at,
  p.updated_at
FROM dinner_plan p
WHERE p.status != 'completed'
  AND p.dinner_plan_id = (
    SELECT p2.dinner_plan_id
    FROM dinner_plan p2
    WHERE p2.household_id = p.household_id AND p2.status != 'completed'
    ORDER BY p2.updated_at DESC, p2.created_at DESC, p2.dinner_plan_id DESC
    LIMIT 1
  )
  AND EXISTS (
    SELECT 1 FROM dinner_shop_line l WHERE l.dinner_plan_id = p.dinner_plan_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM household_shop_list s
    WHERE s.household_id = p.household_id AND s.status = 'open'
  );

INSERT INTO household_shop_line (
  line_id, shop_list_id, ingredient_id, general_key, display_name, name_custom,
  preparation, unit, quantity_required, quantity_manual, quantity_override,
  override_basis, override_stale, reconcile_note, list_state, still_needed,
  surplus_quantity, meal_ids_json, recipe_version_ids_json, category, category_custom,
  unparsed, note, created_at, updated_at
)
SELECT
  'hl_' || l.line_id,
  s.shop_list_id,
  l.ingredient_id,
  NULL,
  l.display_name,
  0,
  l.preparation,
  l.unit,
  l.quantity,
  NULL,
  NULL,
  NULL,
  0,
  NULL,
  l.list_state,
  l.still_needed,
  COALESCE(l.surplus_quantity, 0),
  l.meal_ids_json,
  '[]',
  CASE
    WHEN lower(l.display_name) LIKE '%paper towel%' OR lower(l.display_name) LIKE '%detergent%' THEN 'household'
    WHEN lower(l.display_name) LIKE '%oat milk%' OR lower(l.display_name) LIKE '%milk%'
      OR lower(l.display_name) LIKE '%cheese%' OR lower(l.display_name) LIKE '%yogurt%'
      OR lower(l.display_name) LIKE '%butter%' THEN 'dairy'
    WHEN lower(l.display_name) LIKE '%onion%' OR lower(l.display_name) LIKE '%cilantro%'
      OR lower(l.display_name) LIKE '%garlic%' OR lower(l.display_name) LIKE '%banana%'
      OR lower(l.display_name) LIKE '%lemon%' OR lower(l.display_name) LIKE '%tomato%' THEN 'produce'
    WHEN lower(l.display_name) LIKE '%chicken%' OR lower(l.display_name) LIKE '%beef%'
      OR lower(l.display_name) LIKE '%pork%' OR lower(l.display_name) LIKE '%salmon%' THEN 'meat'
    WHEN lower(l.display_name) LIKE '%bread%' OR lower(l.display_name) LIKE '%tortilla%' THEN 'bakery'
    WHEN lower(l.display_name) LIKE '%coffee%' OR lower(l.display_name) LIKE '%rice%'
      OR lower(l.display_name) LIKE '%oil%' OR lower(l.display_name) LIKE '%flour%' THEN 'pantry'
    ELSE 'other'
  END,
  0,
  CASE WHEN l.unit = 'unparsed' OR l.quantity IS NULL THEN 1 ELSE 0 END,
  NULL,
  l.created_at,
  l.updated_at
FROM dinner_shop_line l
JOIN household_shop_list s ON s.dinner_plan_id = l.dinner_plan_id AND s.status = 'open'
WHERE NOT EXISTS (
  SELECT 1 FROM household_shop_line h WHERE h.line_id = 'hl_' || l.line_id
);

INSERT INTO household_shop_requirement (
  requirement_id, line_id, shop_list_id, origin, dinner_plan_id, plan_line_id,
  meal_ids_json, recipe_version_ids_json, quantity, unit, still_needed, source_key,
  client_request_id, display_name, preparation, created_at, updated_at
)
SELECT
  'hr_' || l.line_id,
  'hl_' || l.line_id,
  s.shop_list_id,
  'recipe',
  l.dinner_plan_id,
  l.line_id,
  l.meal_ids_json,
  '[]',
  CASE WHEN l.still_needed = 1 THEN l.quantity ELSE 0 END,
  l.unit,
  l.still_needed,
  'recipe:' || l.dinner_plan_id || ':' || l.ingredient_id || ':' || l.unit,
  NULL,
  l.display_name,
  l.preparation,
  l.created_at,
  l.updated_at
FROM dinner_shop_line l
JOIN household_shop_list s ON s.dinner_plan_id = l.dinner_plan_id AND s.status = 'open'
WHERE NOT EXISTS (
  SELECT 1 FROM household_shop_requirement r
  WHERE r.shop_list_id = s.shop_list_id
    AND r.source_key = 'recipe:' || l.dinner_plan_id || ':' || l.ingredient_id || ':' || l.unit
);
