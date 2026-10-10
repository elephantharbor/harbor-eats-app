-- D-05 AI gateway: usage/cost accounting and output cache.
-- Additive only. No prompts, raw user text, outputs-with-PII or chain-of-thought are stored
-- in ai_usage. household_key is a salted hash, never the household id.

CREATE TABLE ai_usage (
  usage_id         TEXT PRIMARY KEY,
  task             TEXT NOT NULL,
  prompt_version   TEXT NOT NULL,
  provider         TEXT NOT NULL,
  model            TEXT NOT NULL,
  household_key    TEXT,
  status           TEXT NOT NULL,           -- ok | cache_hit | fallback:<error_code>
  input_tokens     INTEGER NOT NULL DEFAULT 0,
  output_tokens    INTEGER NOT NULL DEFAULT 0,
  attempts         INTEGER NOT NULL DEFAULT 1,
  latency_ms       INTEGER,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  usage_metadata_json TEXT,                 -- finish reason, provider request id; no content
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_ai_usage_task_time ON ai_usage(task, created_at);
CREATE INDEX idx_ai_usage_household_time ON ai_usage(household_key, created_at);

CREATE TABLE ai_cache (
  cache_key        TEXT PRIMARY KEY,         -- sha256(task|prompt_version|model|normalized_input)
  task             TEXT NOT NULL,
  prompt_version   TEXT NOT NULL,
  model            TEXT NOT NULL,
  output_json      TEXT NOT NULL,            -- post-validated structured output only
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL
);
CREATE INDEX idx_ai_cache_expires ON ai_cache(expires_at);
