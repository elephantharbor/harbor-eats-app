-- D-05 provider completion: pricing version + cached-token accounting on usage rows, and the
-- single limiter's counter table (UTC minute/day windows, conditional atomic increments).
-- Additive only.

ALTER TABLE ai_usage ADD COLUMN pricing_version TEXT;
ALTER TABLE ai_usage ADD COLUMN cached_input_tokens INTEGER NOT NULL DEFAULT 0;

CREATE TABLE ai_limit_counters (
  bucket      TEXT PRIMARY KEY,   -- e.g. hh_min:<hk>:2026-10-10T15:04, hh_day:<hk>:2026-10-10, global_day:..., sol_hh_day:..., spend_day:...
  count       INTEGER NOT NULL DEFAULT 0, -- requests, or micro-USD for spend_day
  expires_at  TEXT NOT NULL       -- pruned opportunistically after the window closes
);
CREATE INDEX idx_ai_limit_counters_expires ON ai_limit_counters(expires_at);
