-- Batch 2 (P2): goal-driven journeys + memory-mode preference.
-- Run once per database (fresh schema.sql already includes these):
--   npx wrangler d1 execute production-os-db --local  --file=./migrations/0003_journeys.sql
--   npx wrangler d1 execute production-os-db --remote --file=./migrations/0003_journeys.sql
-- (or `npm run db:migrate:0003` / `npm run db:migrate:0003:remote`)
-- CREATEs are IF NOT EXISTS; the two ALTERs run once (SQLite/D1 have no
-- ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS journeys (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal             TEXT,
  current_step     TEXT NOT NULL,
  steps_json       TEXT NOT NULL DEFAULT '[]',
  milestones_json  TEXT NOT NULL DEFAULT '[]',
  visual_progress  REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_journeys_user ON journeys(user_id, status);

CREATE TABLE IF NOT EXISTS journey_events (
  id          TEXT PRIMARY KEY,
  journey_id  TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone   TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'derived',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_journey_events_journey ON journey_events(journey_id, created_at);

ALTER TABLE users ADD COLUMN memory_mode TEXT NOT NULL DEFAULT 'server';
ALTER TABLE threads ADD COLUMN journey_id TEXT REFERENCES journeys(id) ON DELETE SET NULL;
