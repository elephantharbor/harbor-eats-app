-- Durable member sessions (alpha returning-user restore)
-- Forward-only; do not delete rows in production without backup.

CREATE TABLE member_session (
  session_id       TEXT PRIMARY KEY,
  session_token    TEXT NOT NULL UNIQUE,
  household_id     TEXT NOT NULL REFERENCES household(household_id),
  member_id        TEXT NOT NULL REFERENCES member(member_id),
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  revoked_at       TEXT,
  user_agent       TEXT,
  last_seen_at     TEXT NOT NULL
);

CREATE INDEX idx_member_session_household ON member_session(household_id);
CREATE INDEX idx_member_session_member ON member_session(member_id);
CREATE INDEX idx_member_session_expires ON member_session(expires_at);
