-- Owner audit log (#49): a durable, append-only record of owner entitlement
-- actions (mint / revoke a Sovereign+ gift pass) so those actions become
-- provable after the fact instead of living only in ephemeral console state.
-- Run once per database (fresh schema.sql already includes this table):
--   npx wrangler d1 execute production-os-db --local  --file=./migrations/0008_admin_audit_log.sql
--   npx wrangler d1 execute production-os-db --remote --file=./migrations/0008_admin_audit_log.sql
-- (or `npm run db:migrate:0008` / `npm run db:migrate:0008:remote`)
-- The DDL below is byte-identical to the block in schema.sql — `seedLocalD1()`
-- applies schema.sql only, so drift between the two would leave the fresh-test
-- database and existing databases shaped differently.

-- Three deliberate divergences from the legacy `SOVV:utils/audit.ts` +
-- `0024_admin_audit_log.sql`, each forced by a rule in this repo:
--   1. No `ip` column. An audit table is durable storage; the only IP use here
--      is an ephemeral KV rate-limit key, and we do not start that habit here.
--   2. `actor_email_hash`, never `actor_email`/`target_email` — the SHA-256-only
--      posture of the promo grant table. Targets are identified by id, not email.
--   3. `actor_id` carries NO FK, so `account/route.ts`'s hard delete with
--      `ON DELETE CASCADE` cannot self-erase the record of what the account did
--      before it went. `created_at` is TEXT datetime('now') for consistency with
--      promo_grants / users / threads.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id                TEXT PRIMARY KEY,
  actor_id          TEXT NOT NULL,
  actor_email_hash  TEXT NOT NULL,
  action            TEXT NOT NULL,
  target_type       TEXT,
  target_id         TEXT,
  metadata          TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_log(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action, created_at);
