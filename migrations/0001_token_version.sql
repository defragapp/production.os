-- 0001 — session revocation: users.token_version
--
-- Adds the counter that makes a signed session cookie revocable. Existing
-- accounts are backfilled to 1 by the column default, which is also what the
-- verifier assumes for JWTs minted before this migration (no `tv` claim).
--
-- Applied with:
--   npx wrangler d1 execute production-os-db --local  --file=./migrations/0001_token_version.sql
--   npx wrangler d1 execute production-os-db --remote --file=./migrations/0001_token_version.sql
--
-- (or `npm run db:migrate:0001` / `npm run db:migrate:0001:remote`)

ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
