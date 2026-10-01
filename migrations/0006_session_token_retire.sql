-- Retire legacy plain session_token values where hash exists (lookup uses hash only).

PRAGMA foreign_keys = ON;

UPDATE member_session
SET session_token = session_token_hash
WHERE session_token_hash IS NOT NULL
  AND session_token IS NOT NULL
  AND session_token != session_token_hash;
