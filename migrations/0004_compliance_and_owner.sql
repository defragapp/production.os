-- Compliance (clickwrap proof, 18+ consent on the Baseline) + Owner Console
-- (30-day Sovereign+ gift passes).
-- Run once per database (fresh schema.sql already includes these):
--   npx wrangler d1 execute production-os-db --local  --file=./migrations/0004_compliance_and_owner.sql
--   npx wrangler d1 execute production-os-db --remote --file=./migrations/0004_compliance_and_owner.sql
-- (or `npm run db:migrate:0004` / `npm run db:migrate:0004:remote`)
-- CREATEs are IF NOT EXISTS; the ALTERs run once (SQLite/D1 have no
-- ADD COLUMN IF NOT EXISTS).

-- Provable clickwrap: the Terms version the account accepted, and when.
ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
-- Owner-minted gift entitlement: SQLite UTC expiry (see lib/tier.ts); the
-- tier resolver reverts the account to free the first time it reads a lapse.
ALTER TABLE users ADD COLUMN gift_expires_at TEXT;

-- Timestamped consent receipt on the Baseline submission itself (the 18+
-- affirmation happens at DOB entry, not only at signup).
ALTER TABLE baselines ADD COLUMN consent_accepted_at TEXT;

-- Owner-minted 30-day Sovereign+ passes. D1 stores only the SHA-256 hash of
-- the code (same posture as invite/reset tokens) — the raw code lives only in
-- the owner's clipboard and the redemption link. Columns mirror
-- PROMO_GRANT_SELECT in src/lib/promo.ts exactly.
CREATE TABLE IF NOT EXISTS promo_grants (
  code_hash           TEXT PRIMARY KEY,
  created_by          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duration_days       INTEGER NOT NULL DEFAULT 30,
  max_redemptions     INTEGER NOT NULL DEFAULT 1,
  redeemed_count      INTEGER NOT NULL DEFAULT 0,
  redeemed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  note                TEXT,
  expires_at          TEXT,
  revoked_at          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promo_grants_owner ON promo_grants(created_by, created_at);
