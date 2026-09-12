-- Sovereign OS — D1 Schema
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  password_salt       TEXT NOT NULL,
  email_verified      INTEGER NOT NULL DEFAULT 1,
  verification_token  TEXT,
  stripe_customer_id  TEXT,
  subscription_tier    TEXT NOT NULL DEFAULT 'free',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS baselines (
  user_id              TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tob                  TEXT,
  pob                  TEXT,
  dob                  TEXT,
  nasa_jpl_json_data   TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS threads (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_history  TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
