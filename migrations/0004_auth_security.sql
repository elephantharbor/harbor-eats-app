-- Phase 2: session token hashing + passwordless recovery tokens
PRAGMA foreign_keys = ON;

ALTER TABLE member_session ADD COLUMN session_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_session_token_hash
  ON member_session(session_token_hash)
  WHERE session_token_hash IS NOT NULL;

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
