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
  -- Bumped on sign-out and password reset so outstanding session cookies can be
  -- revoked before their 7-day expiry. Embedded in the JWT as `tv` and compared
  -- on every authenticated request (see lib/session.ts).
  token_version       INTEGER NOT NULL DEFAULT 1,
  -- Memory preference: 'server' persists threads in D1 (multi-device
  -- continuity, the default). 'local' means zero-retention inference — /api/chat
  -- skips the threads write and the client keeps an encrypted IndexedDB copy.
  memory_mode         TEXT NOT NULL DEFAULT 'server',
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

-- Fresh databases include the new columns inline. Existing databases pick them
-- up through migration 0003 (ALTER TABLE has no IF NOT EXISTS in SQLite/D1).
CREATE TABLE IF NOT EXISTS threads (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_history  TEXT NOT NULL DEFAULT '[]',
  journey_id       TEXT REFERENCES journeys(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);

-- Connection invitations (email delivery + a shareable link). Inviting is a
-- Sovereign+ feature; receiving/accepting is available to every account.
-- invitee_name is the owner's label for who this is for ("Mom", "Alex") — it
-- personalizes the email and the share text. Nullable: rows predate the field.
CREATE TABLE IF NOT EXISTS invites (
  id            TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'friend',
  invitee_name  TEXT,
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

-- Passkeys (WebAuthn). One row per registered authenticator; a user may hold
-- several (laptop + phone). Password stays as the recovery path, so losing a
-- device never locks anyone out. credential_id is the base64url authenticator
-- id (primary key for fast lookup during login); public_key stores the CBOR
-- COSE key as base64url; counter supports replay detection.
CREATE TABLE IF NOT EXISTS passkeys (
  credential_id  TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key     TEXT NOT NULL,
  counter        INTEGER,
  transports     TEXT,
  label          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);

-- Free-tier daily AI usage. Replaces the previous KV read-modify-write counter,
-- which had no compare-and-swap and so could be bypassed by concurrent requests.
-- The row is claimed with a single atomic upsert (see api/chat/route.ts) so the
-- daily cap is exact under concurrency. One row per user per UTC day.
CREATE TABLE IF NOT EXISTS chat_usage (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      TEXT NOT NULL,                 -- YYYY-MM-DD (UTC)
  used     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Goal-driven journeys (Batch 2, P2). A journey is AI-inferred first and
-- user-editable second: rows may exist before the person ever names a goal
-- (`goal` nullable until they rename it). One active journey per user is the
-- steady state; history is preserved by pausing/completing rather than
-- deleting. `steps_json` is the step catalog with per-step status;
-- `milestones_json` is the append-only list of unlocked milestone ids.
CREATE TABLE IF NOT EXISTS journeys (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal             TEXT,
  current_step     TEXT NOT NULL,
  steps_json       TEXT NOT NULL DEFAULT '[]',
  milestones_json  TEXT NOT NULL DEFAULT '[]',
  visual_progress  REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active', -- active | paused | complete
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_journeys_user ON journeys(user_id, status);

-- Append-only audit trail + replay log: each unlock is a row, so the canvas
-- can be redrawn at any point in time and "why did it unlock that?" is
-- answerable. `source` distinguishes derived unlocks from user confirmations.
CREATE TABLE IF NOT EXISTS journey_events (
  id          TEXT PRIMARY KEY,
  journey_id  TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone   TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'derived',  -- derived | user-confirmed
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_journey_events_journey ON journey_events(journey_id, created_at);

-- Memory-mode preference (Batch 2 schema, Batch 3 behaviour). 'server' keeps
-- today's behaviour (threads persisted in D1, multi-device continuity).
-- 'local' means zero-retention inference: /api/chat skips the threads write
-- and the client keeps an encrypted IndexedDB copy instead.
-- Fresh databases include memory_mode/journey_id inline above; pre-migration
-- D1 files pick them up through migrations/0003_journeys.sql.


