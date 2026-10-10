-- 0009 — answer feedback (WS3, docs/ai-improvement-plan.md)
--
-- A lightweight, content-free live-quality signal: the "Did this land?" control
-- under a finished answer records one enum per (person, thread, turn). No
-- answer text, no snippet, no free-text — only which turn and which of two
-- values. The offline rubric (src/lib/answer-eval) stays the regression gate;
-- this table is the live signal a recorded replay can never be.
--
-- Writes are server-memory only. A memory_mode='local' account carries a
-- zero-retention contract (/api/chat writes nothing for it), so the feedback
-- route refuses to persist for those accounts and the client never offers them
-- the control. There is deliberately no FK on thread_id: a thread can be purged
-- while its signal stays useful in aggregate, and a cascading FK would erase
-- the history the table exists to keep (same reasoning as admin_audit_log,
-- migration 0008).
--
-- Applied with:
--   npx wrangler d1 execute production-os-db --local  --file=./migrations/0009_answer_feedback.sql
--   npx wrangler d1 execute production-os-db --remote --file=./migrations/0009_answer_feedback.sql
--
-- (or `npm run db:migrate:0009` / `npm run db:migrate:0009:remote`)
--
-- The CREATE block below is byte-identical to the one appended to schema.sql
-- (the local-D1 seed the release ratchet applies), so a fresh environment and a
-- migrated one agree.

CREATE TABLE IF NOT EXISTS answer_feedback (
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id   TEXT    NOT NULL,
  turn_index  INTEGER NOT NULL,
  value       TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, thread_id, turn_index)
);
CREATE INDEX IF NOT EXISTS idx_answer_feedback_user  ON answer_feedback(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_answer_feedback_value ON answer_feedback(value, created_at);
