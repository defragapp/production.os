-- 0006: Per-side consent flags for sharing chat HISTORY with a connection.
-- Baseline sharing (a_share_baseline/b_share_baseline) already exists and
-- defaults to 1 (opt-out). History sharing is stricter: it lets a peer's
-- *own earlier conversation snippets* surface inside the other person's
-- reasoning turn, so it is opt-IN and defaults to 0. Consent is still
-- per-side: only the PEER's flag governs whether their history is read.
ALTER TABLE relationships ADD COLUMN a_share_history INTEGER NOT NULL DEFAULT 0;
ALTER TABLE relationships ADD COLUMN b_share_history INTEGER NOT NULL DEFAULT 0;
