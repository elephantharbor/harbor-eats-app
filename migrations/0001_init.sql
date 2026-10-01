-- Harbor Eats consumer product — D1 schema v1
-- Ratings: 1–10 per HH-001 rating_protocol (Thomas OPERATING CORRECTION 2026-09-28)
-- Bloom PLG: invite + share_choice + last-touch attribution (docs/growth/PLG-SURFACES.md)
-- Do not invent usage metrics; empty stays empty.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Core household tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE household (
  household_id     TEXT PRIMARY KEY,
  display_name     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'incubation_pilot'
                   CHECK (status IN (
                     'incubation_pilot','invited','active','paused','archived'
                   )),
  timezone         TEXT NOT NULL DEFAULT 'America/Chicago',
  servings_default INTEGER NOT NULL DEFAULT 2,
  acquisition_source TEXT,          -- utm / organic / invite (household create)
  created_at       TEXT NOT NULL,   -- ISO-8601
  updated_at       TEXT NOT NULL
);

CREATE TABLE member (
  member_id        TEXT PRIMARY KEY,  -- e.g. tom, renata, or generated
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  display_name     TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'member'
                   CHECK (role IN ('owner','member','invited')),
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('invited','active','left','revoked')),
  -- Bloom S1 attribution (set when invited; preserved after accept)
  invite_code      TEXT,
  inviter_member_id TEXT REFERENCES member(member_id),
  invite_channel   TEXT
                   CHECK (invite_channel IS NULL OR invite_channel IN (
                     'share_sheet','copy','email','sms','other'
                   )),
  invited_at       TEXT,
  accepted_at      TEXT,
  inherits_household_eligibility INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX idx_member_household ON member(household_id);
CREATE UNIQUE INDEX idx_member_invite_code ON member(invite_code)
  WHERE invite_code IS NOT NULL;

-- Absolute eligibility / hard constraints (row-per-rule; never soft-ranked)
CREATE TABLE constraint_rule (
  constraint_id    TEXT PRIMARY KEY,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT REFERENCES member(member_id), -- NULL = household-wide
  rule_key         TEXT NOT NULL,   -- e.g. dairy, shellfish, nuts_except_cashew
  status           TEXT NOT NULL CHECK (status IN ('prohibited','permitted')),
  includes_json    TEXT,            -- JSON array of ingredient tokens
  note             TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (household_id, member_id, rule_key)
);

CREATE INDEX idx_constraint_household ON constraint_rule(household_id);

-- ---------------------------------------------------------------------------
-- Plans / options / selection / cook / rating
-- ---------------------------------------------------------------------------

CREATE TABLE plan (
  plan_id          TEXT PRIMARY KEY,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  batch_id         TEXT,
  status           TEXT NOT NULL DEFAULT 'Generated'
                   CHECK (status IN (
                     'Generated','Unselected','Selected','Cooked','Rated',
                     'Archived','Skipped'
                   )),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  -- Bloom last-touch for loop_completed (invite_code | share_object_id | organic)
  attribution_last_touch TEXT,
  attribution_kind TEXT
                   CHECK (attribution_kind IS NULL OR attribution_kind IN (
                     'invite_code','share_object_id','organic','unknown'
                   ))
);

CREATE INDEX idx_plan_household ON plan(household_id);
CREATE INDEX idx_plan_batch ON plan(batch_id);

CREATE TABLE meal_option (
  meal_option_id   TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  letter           TEXT NOT NULL CHECK (letter IN ('A','B','C')),
  name             TEXT NOT NULL,
  recipe_slug      TEXT,
  recipe_version   TEXT,
  description_short TEXT,
  attributes_json  TEXT,            -- cuisine, flavors, exploration, etc.
  selected         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  UNIQUE (plan_id, letter)
);

CREATE INDEX idx_meal_option_plan ON meal_option(plan_id);

CREATE TABLE selection (
  selection_id     TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  meal_option_id   TEXT NOT NULL REFERENCES meal_option(meal_option_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  source           TEXT NOT NULL
                   CHECK (source IN ('app','email','sms','share_link','ops')),
  actor_member_id  TEXT REFERENCES member(member_id),
  share_object_id  TEXT,            -- if selected via S2 share link
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_selection_plan ON selection(plan_id);

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

-- Dual ratings 1–10; never impute; Rated lifecycle only when all active diners present
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

-- ---------------------------------------------------------------------------
-- Bloom PLG: invites (S1) + shareable choice sets (S2)
-- ---------------------------------------------------------------------------

CREATE TABLE invite (
  invite_code      TEXT PRIMARY KEY,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  inviter_member_id TEXT NOT NULL REFERENCES member(member_id),
  channel          TEXT NOT NULL
                   CHECK (channel IN (
                     'share_sheet','copy','email','sms','other'
                   )),
  status           TEXT NOT NULL DEFAULT 'sent'
                   CHECK (status IN ('sent','accepted','expired','revoked')),
  invited_member_id TEXT REFERENCES member(member_id),
  sent_at          TEXT NOT NULL,
  accepted_at      TEXT,
  expires_at       TEXT
);

CREATE INDEX idx_invite_household ON invite(household_id);

-- Share token for a specific plan's A/B/C (FamilyPlate-class)
CREATE TABLE share_choice (
  share_object_id  TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  created_by_member_id TEXT REFERENCES member(member_id),
  token            TEXT NOT NULL UNIQUE,
  option_letters   TEXT NOT NULL DEFAULT 'A,B,C', -- subset allowed
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','expired','revoked','consumed')),
  referrer_household_id TEXT,       -- viral; alpha may leave NULL / disable
  expires_at       TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_share_choice_plan ON share_choice(plan_id);
CREATE INDEX idx_share_choice_token ON share_choice(token);

-- ---------------------------------------------------------------------------
-- Analytics events (append-only; real events only)
-- ---------------------------------------------------------------------------

CREATE TABLE event (
  event_id         TEXT PRIMARY KEY,
  event_name       TEXT NOT NULL,
  household_id     TEXT,
  member_id        TEXT,
  plan_id          TEXT,
  meal_option_id   TEXT,
  -- Bloom attribution fields (nullable per event type)
  invite_code      TEXT,
  share_object_id  TEXT,
  channel          TEXT,
  attribution_last_touch TEXT,
  props_json       TEXT,            -- additional typed props as JSON
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_event_name_time ON event(event_name, created_at);
CREATE INDEX idx_event_household ON event(household_id, created_at);
CREATE INDEX idx_event_invite ON event(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX idx_event_share ON event(share_object_id) WHERE share_object_id IS NOT NULL;

-- Expected event_name values (contract; not enforced by CHECK for evolvability):
-- plan_generated, options_presented, selection_recorded, cook_recorded,
-- rating_submitted, loop_completed,
-- eligibility_reject, explanation_shown, explore_slot_filled,
-- invite_sent, invite_accepted,
-- share_choice_created, share_choice_viewed, share_choice_acted
