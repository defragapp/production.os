-- Sovereign OS — D1 Schema
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  password_salt       TEXT NOT NULL,
  email_verified      INTEGER NOT NULL DEFAULT 1,
  verification_token  TEXT,
  verification_expires TEXT,
  stripe_customer_id  TEXT,
  subscription_tier    TEXT NOT NULL DEFAULT 'free',
  display_name        TEXT,
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

-- Connection invitations (email delivery + a shareable link). Inviting is a
-- Sovereign+ feature; receiving/accepting is available to every account.
CREATE TABLE IF NOT EXISTS invites (
  id            TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'friend',
  token_hash    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | revoked
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT NOT NULL,
  accepted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_invites_owner ON invites(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email, status);

-- Two-way consented connections. Each side owns their own label for the other
-- person and their own sharing flag. Birth data is NEVER exchanged: a person
-- appears inside another account only as a name + role.
CREATE TABLE IF NOT EXISTS relationships (
  id               TEXT PRIMARY KEY,
  user_a           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  a_label          TEXT NOT NULL DEFAULT 'friend',  -- A's label for B
  b_label          TEXT NOT NULL DEFAULT 'friend',  -- B's label for A
  a_share_baseline INTEGER NOT NULL DEFAULT 1,      -- A consents to B reading A's baseline
  b_share_baseline INTEGER NOT NULL DEFAULT 1,      -- B consents to A reading B's baseline
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_pair ON relationships(user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_relationships_user_a ON relationships(user_a);
CREATE INDEX IF NOT EXISTS idx_relationships_user_b ON relationships(user_b);
