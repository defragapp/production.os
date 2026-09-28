-- 0002 — atomic free-tier daily usage counter
--
-- `chat_usage` replaces the KV read-modify-write counter used for the free-tier
-- daily cap. KV has no compare-and-swap, so two concurrent requests could both
-- pass the pre-check. D1 is transactional, so the slot is claimed with one
-- atomic `INSERT ... ON CONFLICT DO UPDATE ... WHERE used < ?` statement.
--
-- Applied with:
--   npx wrangler d1 execute production-os-db --local  --file=./migrations/0002_chat_usage.sql
--   npx wrangler d1 execute production-os-db --remote --file=./migrations/0002_chat_usage.sql
--
-- (or `npm run db:migrate:0002` / `npm run db:migrate:0002:remote`)
--
-- Existing daily KV counters are intentionally NOT backfilled: the worst case is
-- one free answer granted twice on the deploy day.

CREATE TABLE IF NOT EXISTS chat_usage (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      TEXT NOT NULL,
  used     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
