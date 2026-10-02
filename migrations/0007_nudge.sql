-- 0007: Deterministic transit-nudge queue (Turn 10).
-- The daily cron (custom-worker.ts runTransitScan) computes significant transits
-- against every account's natal baseline and enqueues a short, epistemically
-- soft nudge. This table holds those pending nudges until the user sees or
-- dismisses them. `kind` is 'transit' today; kept as TEXT so future nudge
-- sources (e.g. journey milestones) can share the queue. Idempotency is
-- enforced at insert time (one transit nudge per user per UTC day), and the
-- read path only ever surfaces the newest undismissed row within 72 hours.
CREATE TABLE IF NOT EXISTS nudge (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  text          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_nudge_user_dismissed ON nudge(user_id, dismissed_at);
