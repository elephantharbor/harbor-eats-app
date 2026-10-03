-- Cycle 1B: legacy evidence whose origin cannot be proven must not become household.
--
-- 0008_evidence_origin.sql added data_origin NOT NULL DEFAULT 'household'.
-- SQLite backfills that default onto every existing row, so untagged October
-- rows and real Household 001 rows become indistinguishable from an explicit
-- household stamp. This file does not rewrite 0008: that migration already
-- ran on the disposable preview D1 harbor-eats-cycle1-preview. Production D1
-- is not touched here.
--
-- When 0008 and 0009 later run together, apply them in one maintenance step
-- before the new app serves traffic. 0009 then:
--   * keeps data_origin = 'synthetic' as synthetic
--   * marks a household synthetic when acquisition_source is one of
--     synthetic_qa, qa, e2e, smoke, test (same set as evidence-origin.js),
--     and marks that household's activity synthetic too
--   * stores every remaining household value as 'unproven'
-- Rows are not deleted. 'unproven' is not synthetic and does not count as
-- real household evidence. The column default becomes 'unproven', so an
-- insert that omits data_origin fails closed.
--
-- An explicit household stamp written after 0008 and before 0009 cannot be
-- told apart from the 0008 default, so it is quarantined too. Rebuild the
-- disposable preview from empty (replay 0001–0009) before further QA on it.
-- Do not run that rebuild against production.
--
-- D1 applies each file as separate statements. Do not use
-- PRAGMA foreign_keys = OFF. Stash, drop children, recreate, restore.

-- ---------------------------------------------------------------------------
-- 1) Stash every table that must be dropped to rebuild the origin CHECKs
-- ---------------------------------------------------------------------------

CREATE TABLE _he_c1b_household AS SELECT * FROM household;
CREATE TABLE _he_c1b_member AS SELECT * FROM member;
CREATE TABLE _he_c1b_constraint_rule AS SELECT * FROM constraint_rule;
CREATE TABLE _he_c1b_plan AS SELECT * FROM plan;
CREATE TABLE _he_c1b_meal_option AS SELECT * FROM meal_option;
CREATE TABLE _he_c1b_selection AS SELECT * FROM selection;
CREATE TABLE _he_c1b_cook AS SELECT * FROM cook;
CREATE TABLE _he_c1b_rating AS SELECT * FROM rating;
CREATE TABLE _he_c1b_invite AS SELECT * FROM invite;
CREATE TABLE _he_c1b_share_choice AS SELECT * FROM share_choice;
CREATE TABLE _he_c1b_preference_evidence AS SELECT * FROM preference_evidence;
CREATE TABLE _he_c1b_member_session AS SELECT * FROM member_session;
CREATE TABLE _he_c1b_recovery_token AS SELECT * FROM recovery_token;
CREATE TABLE _he_c1b_meal_vote AS SELECT * FROM meal_vote;
CREATE TABLE _he_c1b_event AS SELECT * FROM event;

-- ---------------------------------------------------------------------------
-- 2) Drop FK dependents first, then parents
-- ---------------------------------------------------------------------------

DROP TABLE selection;
DROP TABLE cook;
DROP TABLE rating;
DROP TABLE meal_vote;
DROP TABLE share_choice;
DROP TABLE meal_option;
DROP TABLE invite;
DROP TABLE preference_evidence;
DROP TABLE member_session;
DROP TABLE recovery_token;
DROP TABLE constraint_rule;
DROP TABLE plan;
DROP TABLE member;
DROP TABLE household;
DROP TABLE event;

-- ---------------------------------------------------------------------------
-- 3) Recreate. Default origin is unproven. household | synthetic | unproven.
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
  acquisition_source TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  meal_choice_count INTEGER NOT NULL DEFAULT 3,
  scheduling_cadence TEXT NOT NULL DEFAULT 'on_demand'
                   CHECK (scheduling_cadence IN ('on_demand','weekly','biweekly')),
  settings_json    TEXT,
  data_origin      TEXT NOT NULL DEFAULT 'unproven'
                   CHECK (data_origin IN ('household', 'synthetic', 'unproven'))
);

INSERT INTO household (
  household_id, display_name, status, timezone, servings_default, acquisition_source,
  created_at, updated_at, meal_choice_count, scheduling_cadence, settings_json, data_origin
)
SELECT
  household_id, display_name, status, timezone, servings_default, acquisition_source,
  created_at, updated_at, meal_choice_count, scheduling_cadence, settings_json,
  CASE
    WHEN data_origin = 'synthetic' THEN 'synthetic'
    WHEN COALESCE(acquisition_source, '') IN ('synthetic_qa', 'qa', 'e2e', 'smoke', 'test') THEN 'synthetic'
    ELSE 'unproven'
  END
FROM _he_c1b_household;

CREATE TABLE member (
  member_id        TEXT PRIMARY KEY,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  display_name     TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'member'
                   CHECK (role IN ('owner','member','invited')),
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('invited','active','left','revoked')),
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

INSERT INTO member (
  member_id, household_id, display_name, role, status, invite_code, inviter_member_id,
  invite_channel, invited_at, accepted_at, inherits_household_eligibility, created_at, updated_at
)
SELECT
  member_id, household_id, display_name, role, status, invite_code, NULL,
  invite_channel, invited_at, accepted_at, inherits_household_eligibility, created_at, updated_at
FROM _he_c1b_member;

UPDATE member
SET inviter_member_id = (
  SELECT s.inviter_member_id FROM _he_c1b_member s WHERE s.member_id = member.member_id
)
WHERE member_id IN (
  SELECT member_id FROM _he_c1b_member WHERE inviter_member_id IS NOT NULL
);

CREATE TABLE constraint_rule (
  constraint_id    TEXT PRIMARY KEY,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT REFERENCES member(member_id),
  rule_key         TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('prohibited','permitted')),
  includes_json    TEXT,
  note             TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (household_id, member_id, rule_key)
);

CREATE INDEX idx_constraint_household ON constraint_rule(household_id);

INSERT INTO constraint_rule
SELECT * FROM _he_c1b_constraint_rule;

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
  attribution_last_touch TEXT,
  attribution_kind TEXT
                   CHECK (attribution_kind IS NULL OR attribution_kind IN (
                     'invite_code','share_object_id','organic','unknown'
                   )),
  data_origin      TEXT NOT NULL DEFAULT 'unproven'
                   CHECK (data_origin IN ('household', 'synthetic', 'unproven'))
);

CREATE INDEX idx_plan_household ON plan(household_id);
CREATE INDEX idx_plan_batch ON plan(batch_id);

INSERT INTO plan (
  plan_id, household_id, batch_id, status, created_at, updated_at,
  attribution_last_touch, attribution_kind, data_origin
)
SELECT
  p.plan_id, p.household_id, p.batch_id, p.status, p.created_at, p.updated_at,
  p.attribution_last_touch, p.attribution_kind,
  CASE
    WHEN p.data_origin = 'synthetic' THEN 'synthetic'
    WHEN h.data_origin = 'synthetic' THEN 'synthetic'
    ELSE 'unproven'
  END
FROM _he_c1b_plan p
LEFT JOIN household h ON h.household_id = p.household_id;

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
SELECT * FROM _he_c1b_meal_option;

CREATE TABLE selection (
  selection_id     TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  meal_option_id   TEXT NOT NULL REFERENCES meal_option(meal_option_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  source           TEXT NOT NULL
                   CHECK (source IN ('app','email','sms','share_link','ops')),
  actor_member_id  TEXT REFERENCES member(member_id),
  share_object_id  TEXT,
  created_at       TEXT NOT NULL,
  data_origin      TEXT NOT NULL DEFAULT 'unproven'
                   CHECK (data_origin IN ('household', 'synthetic', 'unproven'))
);

CREATE INDEX idx_selection_plan ON selection(plan_id);

INSERT INTO selection (
  selection_id, plan_id, meal_option_id, household_id, source, actor_member_id,
  share_object_id, created_at, data_origin
)
SELECT
  s.selection_id, s.plan_id, s.meal_option_id, s.household_id, s.source, s.actor_member_id,
  s.share_object_id, s.created_at,
  CASE
    WHEN s.data_origin = 'synthetic' THEN 'synthetic'
    WHEN h.data_origin = 'synthetic' THEN 'synthetic'
    ELSE 'unproven'
  END
FROM _he_c1b_selection s
LEFT JOIN household h ON h.household_id = s.household_id;

CREATE TABLE cook (
  cook_id          TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  meal_option_id   TEXT NOT NULL REFERENCES meal_option(meal_option_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  source           TEXT NOT NULL
                   CHECK (source IN ('app','email','sms','ops')),
  actor_member_id  TEXT REFERENCES member(member_id),
  cooked_at        TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  data_origin      TEXT NOT NULL DEFAULT 'unproven'
                   CHECK (data_origin IN ('household', 'synthetic', 'unproven'))
);

CREATE INDEX idx_cook_plan ON cook(plan_id);

INSERT INTO cook (
  cook_id, plan_id, meal_option_id, household_id, source, actor_member_id,
  cooked_at, created_at, data_origin
)
SELECT
  c.cook_id, c.plan_id, c.meal_option_id, c.household_id, c.source, c.actor_member_id,
  c.cooked_at, c.created_at,
  CASE
    WHEN c.data_origin = 'synthetic' THEN 'synthetic'
    WHEN h.data_origin = 'synthetic' THEN 'synthetic'
    ELSE 'unproven'
  END
FROM _he_c1b_cook c
LEFT JOIN household h ON h.household_id = c.household_id;

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
  recipe_version_id TEXT,
  data_origin      TEXT NOT NULL DEFAULT 'unproven'
                   CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  UNIQUE (meal_option_id, member_id)
);

CREATE INDEX idx_rating_plan ON rating(plan_id);
CREATE INDEX idx_rating_recipe_version ON rating(recipe_version_id);

INSERT INTO rating (
  rating_id, plan_id, meal_option_id, household_id, member_id, score, note, source,
  created_at, updated_at, recipe_version_id, data_origin
)
SELECT
  r.rating_id, r.plan_id, r.meal_option_id, r.household_id, r.member_id, r.score, r.note, r.source,
  r.created_at, r.updated_at, r.recipe_version_id,
  CASE
    WHEN r.data_origin = 'synthetic' THEN 'synthetic'
    WHEN h.data_origin = 'synthetic' THEN 'synthetic'
    ELSE 'unproven'
  END
FROM _he_c1b_rating r
LEFT JOIN household h ON h.household_id = r.household_id;

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

INSERT INTO invite SELECT * FROM _he_c1b_invite;

CREATE TABLE share_choice (
  share_object_id  TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  created_by_member_id TEXT REFERENCES member(member_id),
  token            TEXT NOT NULL UNIQUE,
  option_letters   TEXT NOT NULL DEFAULT 'A,B,C',
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','expired','revoked','consumed')),
  referrer_household_id TEXT,
  expires_at       TEXT,
  created_at       TEXT NOT NULL,
  options_snapshot_json TEXT,
  channel          TEXT
                   CHECK (channel IS NULL OR channel IN (
                     'share_sheet','copy','email','sms','other'
                   ))
);

CREATE INDEX idx_share_choice_plan ON share_choice(plan_id);
CREATE INDEX idx_share_choice_token ON share_choice(token);

INSERT INTO share_choice (
  share_object_id, plan_id, household_id, created_by_member_id, token, option_letters,
  status, referrer_household_id, expires_at, created_at, options_snapshot_json, channel
)
SELECT
  share_object_id, plan_id, household_id, created_by_member_id, token, option_letters,
  status, referrer_household_id, expires_at, created_at, options_snapshot_json, channel
FROM _he_c1b_share_choice;

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
  created_at       TEXT NOT NULL,
  data_origin      TEXT NOT NULL DEFAULT 'unproven'
                   CHECK (data_origin IN ('household', 'synthetic', 'unproven'))
);

CREATE INDEX idx_pref_evidence_household ON preference_evidence(household_id, created_at);

INSERT INTO preference_evidence (
  evidence_id, household_id, member_id, source, kind, tag, weight, note, created_at, data_origin
)
SELECT
  e.evidence_id, e.household_id, e.member_id, e.source, e.kind, e.tag, e.weight, e.note, e.created_at,
  CASE
    WHEN e.data_origin = 'synthetic' THEN 'synthetic'
    WHEN h.data_origin = 'synthetic' THEN 'synthetic'
    ELSE 'unproven'
  END
FROM _he_c1b_preference_evidence e
LEFT JOIN household h ON h.household_id = e.household_id;

CREATE TABLE member_session (
  session_id       TEXT PRIMARY KEY,
  session_token    TEXT NOT NULL UNIQUE,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT NOT NULL REFERENCES member(member_id),
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  revoked_at       TEXT,
  user_agent       TEXT,
  last_seen_at     TEXT NOT NULL,
  session_token_hash TEXT
);

CREATE INDEX idx_member_session_household ON member_session(household_id);
CREATE INDEX idx_member_session_member ON member_session(member_id);
CREATE INDEX idx_member_session_expires ON member_session(expires_at);
CREATE UNIQUE INDEX idx_member_session_token_hash
  ON member_session(session_token_hash)
  WHERE session_token_hash IS NOT NULL;

INSERT INTO member_session (
  session_id, session_token, household_id, member_id, created_at, expires_at,
  revoked_at, user_agent, last_seen_at, session_token_hash
)
SELECT
  session_id, session_token, household_id, member_id, created_at, expires_at,
  revoked_at, user_agent, last_seen_at, session_token_hash
FROM _he_c1b_member_session;

CREATE TABLE recovery_token (
  recovery_id      TEXT PRIMARY KEY,
  token_hash       TEXT NOT NULL UNIQUE,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT NOT NULL REFERENCES member(member_id),
  destination_path TEXT,
  expires_at       TEXT NOT NULL,
  used_at          TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_recovery_member ON recovery_token(member_id);
CREATE INDEX idx_recovery_expires ON recovery_token(expires_at);

INSERT INTO recovery_token SELECT * FROM _he_c1b_recovery_token;

CREATE TABLE meal_vote (
  vote_id          TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plan(plan_id),
  meal_option_id   TEXT NOT NULL REFERENCES meal_option(meal_option_id),
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT NOT NULL REFERENCES member(member_id),
  created_at       TEXT NOT NULL,
  data_origin      TEXT NOT NULL DEFAULT 'unproven'
                   CHECK (data_origin IN ('household', 'synthetic', 'unproven')),
  UNIQUE (plan_id, member_id)
);

CREATE INDEX idx_meal_vote_plan ON meal_vote(plan_id);

INSERT INTO meal_vote (
  vote_id, plan_id, meal_option_id, household_id, member_id, created_at, data_origin
)
SELECT
  v.vote_id, v.plan_id, v.meal_option_id, v.household_id, v.member_id, v.created_at,
  CASE
    WHEN v.data_origin = 'synthetic' THEN 'synthetic'
    WHEN h.data_origin = 'synthetic' THEN 'synthetic'
    ELSE 'unproven'
  END
FROM _he_c1b_meal_vote v
LEFT JOIN household h ON h.household_id = v.household_id;

CREATE TABLE event (
  event_id         TEXT PRIMARY KEY,
  event_name       TEXT NOT NULL,
  household_id     TEXT,
  member_id        TEXT,
  plan_id          TEXT,
  meal_option_id   TEXT,
  invite_code      TEXT,
  share_object_id  TEXT,
  channel          TEXT,
  attribution_last_touch TEXT,
  props_json       TEXT,
  created_at       TEXT NOT NULL,
  data_origin      TEXT NOT NULL DEFAULT 'unproven'
                   CHECK (data_origin IN ('household', 'synthetic', 'unproven'))
);

CREATE INDEX idx_event_name_time ON event(event_name, created_at);
CREATE INDEX idx_event_household ON event(household_id, created_at);
CREATE INDEX idx_event_invite ON event(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX idx_event_share ON event(share_object_id) WHERE share_object_id IS NOT NULL;

INSERT INTO event (
  event_id, event_name, household_id, member_id, plan_id, meal_option_id,
  invite_code, share_object_id, channel, attribution_last_touch, props_json,
  created_at, data_origin
)
SELECT
  e.event_id, e.event_name, e.household_id, e.member_id, e.plan_id, e.meal_option_id,
  e.invite_code, e.share_object_id, e.channel, e.attribution_last_touch, e.props_json,
  e.created_at,
  CASE
    WHEN e.data_origin = 'synthetic' THEN 'synthetic'
    WHEN h.data_origin = 'synthetic' THEN 'synthetic'
    ELSE 'unproven'
  END
FROM _he_c1b_event e
LEFT JOIN household h ON h.household_id = e.household_id;

DROP TABLE _he_c1b_household;
DROP TABLE _he_c1b_member;
DROP TABLE _he_c1b_constraint_rule;
DROP TABLE _he_c1b_plan;
DROP TABLE _he_c1b_meal_option;
DROP TABLE _he_c1b_selection;
DROP TABLE _he_c1b_cook;
DROP TABLE _he_c1b_rating;
DROP TABLE _he_c1b_invite;
DROP TABLE _he_c1b_share_choice;
DROP TABLE _he_c1b_preference_evidence;
DROP TABLE _he_c1b_member_session;
DROP TABLE _he_c1b_recovery_token;
DROP TABLE _he_c1b_meal_vote;
DROP TABLE _he_c1b_event;
