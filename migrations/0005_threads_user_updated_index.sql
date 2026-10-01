-- 0005: Composite index for thread listing queries.
-- /api/threads uses: SELECT ... FROM threads WHERE user_id = ? ORDER BY updated_at DESC
-- Without this, D1 scans idx_threads_user_id then sorts in memory.
-- At 50+ threads per user this becomes measurable under load.
CREATE INDEX IF NOT EXISTS idx_threads_user_updated
  ON threads(user_id, updated_at DESC);
