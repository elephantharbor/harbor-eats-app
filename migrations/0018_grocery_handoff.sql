-- S-03 grocery handoff.
-- A handoff is a link we sent, not a purchase. No order, cart, or payment columns.
-- D1 splits this file on semicolons. No triggers. No UPDATE of existing rows.
-- Rehearse on a backup first: node scripts/shop-migration-0018.mjs

CREATE TABLE grocery_handoff (
  handoff_id              TEXT PRIMARY KEY,
  shop_list_id            TEXT NOT NULL REFERENCES household_shop_list(shop_list_id),
  household_id            TEXT NOT NULL REFERENCES household(household_id),
  provider_id             TEXT NOT NULL,
  link_type               TEXT NOT NULL DEFAULT 'shopping_list',
  revision_sent           INTEGER NOT NULL,
  content_revision_sent   INTEGER NOT NULL,
  request_hash            TEXT NOT NULL,
  content_fingerprint     TEXT NOT NULL,
  status                  TEXT NOT NULL
                          CHECK (status IN ('prepared', 'link_created', 'stale', 'expired', 'failed', 'cancelled', 'rejected')),
  products_link_url       TEXT,
  expires_at              TEXT,
  retailer_key            TEXT,
  error_code              TEXT,
  provider_code           TEXT,
  line_count              INTEGER NOT NULL DEFAULT 0,
  excluded_count          INTEGER NOT NULL DEFAULT 0,
  created_by_member_id    TEXT NOT NULL REFERENCES member(member_id),
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE INDEX idx_grocery_handoff_list
  ON grocery_handoff(shop_list_id, provider_id, status, created_at);

CREATE UNIQUE INDEX idx_grocery_handoff_live
  ON grocery_handoff(shop_list_id, provider_id, request_hash)
  WHERE status = 'link_created';

-- Which unfinished dinner plan the household list follows.
-- Nullable. Rows that already exist stay NULL. This file does not rewrite them.
ALTER TABLE dinner_plan ADD COLUMN superseded_at TEXT;
