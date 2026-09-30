# Cloudflare Account Migration — defragapp@gmail.com → cjowen93@asu.edu

Audience: the platform owner. Purpose: a single, best-practices runbook for
moving `sovereign.defrag.app` (Next.js on Workers via OpenNext) from the
**personal gmail Cloudflare account (Free plan)** to the **ASU .edu Cloudflare
account (Workers Paid via education plan)** without stranding the 6 real user
accounts, breaking auth, or introducing unplanned downtime.

Companion docs: [`cloudflare-readiness.md`](./cloudflare-readiness.md) covers
what is already enabled in the source account; [`auth.md`](./auth.md) covers
`PASSWORD_PEPPER` and `JWT_SECRET` semantics; [`stripe-plan.md`](./stripe-plan.md)
covers the Stripe keys. This document is only about the account move itself.

---

## Why migrate

- **1102 CPU throttle** on Workers Free (10 ms/invocation) is the primary
  risk during a crawler fan-out against the Satori-rendered OG image at
  `/s/<id>/opengraph-image`. Verified empirically: OpenNext force-stamps
  `Cache-Control: public, max-age=0, must-revalidate` on every dynamic
  response from the adapter layer, so no code path (ImageResponse `headers`,
  middleware rewrite, route-handler `Response`) can override it — the only
  real fix is a Zone Cache Rule (Phase 7) **plus** paid-tier CPU headroom.
- **Workers Paid on ASU is $0** via the .edu plan. On the personal account
  it would be $5/mo.
- ASU has no conflicting resources — a clean build, not a merge.

## Scope of the change

The **codebase does not change.** Same commit, same repo, same Workers Builds
git integration — only the *account* and the resource IDs behind
`wrangler.jsonc` differ, plus the DNS zone relocates with the worker. If any
step in this document requires editing TypeScript, it's wrong.

## Pre-flight state (verified 2026-09-30)

| Item | Value |
|---|---|
| Source account | `defragapp@gmail.com` (Workers Free) |
| Target account | `cjowen93@asu.edu` — id `ac9a47ddb8928af2f3535e2a1e4d8349` (Workers Paid via .edu) |
| Live deploy | version `c3a107c`, commit `f40acaa`, 2026-09-30 19:01:22Z |
| Canonical URL | `https://sovereign.defrag.app` |
| Worker (source) | `production-os` — Next.js/OpenNext bundle |
| Worker (target) | `production-os` **stub only** (`return new Response("Hello world")`, no bindings, no routes). Overwritable in Phase 3. |
| Unrelated on target | `behavioral-observer` worker — leave alone |
| D1 (source) | `production-os-db`, id `f4274cce-4444-4501-85a9-58c28bff27ac` |
| D1 (target) | none — create in Phase 2 |
| KV (source) | `SESSION_KV`, id `8ccb87e3a5554f849d69053df7275a29` |
| KV (target) | none — create fresh, do NOT migrate session keys (users re-login) |
| AI Gateway (source) | `sovereign-ai-gateway` (account-scoped) |
| AI Gateway (target) | none — recreate with the same name in Phase 2 |
| Turnstile widget (source) | site key `0x4AAAAAAExjLzsh-Wwl9x4Y` — **account-scoped**, must recreate on ASU in Phase 1 |
| Web Analytics beacon | token `8b2341038462480c95e05d8e11f07213` — account-scoped, recreate in Phase 7 |
| Zone `defrag.app` NS | `rudy.ns.cloudflare.com` / `vida.ns.cloudflare.com` (Cloudflare authoritative) |
| Registrar for `defrag.app` | **TBD by owner** — determines Phase 6 branch |
| Prod D1 backup | `.audit-tmp/prod-d1-backup.sql` (132 lines, includes `PRAGMA defer_foreign_keys=TRUE`) |
| Row counts at backup | users=6, baselines=4, journeys=2, chat_usage=2; relationships/passkeys/promo_grants/invites/journey_events = 0 |

## Two blockers before Phase 5

1. **`PASSWORD_PEPPER` retrieval.** The value is stored as a Worker secret
   on the source account; wrangler has no `secret get`. Either the owner
   has it in a password manager / private doc, or the fallback in Phase 1
   Fork B applies. Getting this wrong silently invalidates every existing
   password hash in D1.
2. **Registrar location for `defrag.app`.** Cloudflare Registrar → Phase 6
   Path A (inter-account transfer, 5-day approval window, 30-day lock).
   External registrar → Phase 6 Path B (change NS at the registrar).

Everything up to Phase 5 can proceed while these are being resolved.

---

## Phase 0 — Insurance (do today, before anything else)

Flip the **source account to Workers Paid ($5/mo)** in the Cloudflare
dashboard. This is unrelated to the migration itself and does three things:

- Removes the 1102 risk tonight, independent of the OG-image cache rule.
- Keeps a working fallback if the ASU cutover stalls.
- Stays on as a safety net for the 7+7 day zone "Moved Away → Deleted"
  window described in Phase 6.

Cancel this subscription in Phase 8 after ASU is green for 14+ days.

Skip Phase 0 and every downstream step is live-surgery without a tourniquet.

---

## Phase 1 — Prep on ASU (no prod impact)

### 1.1 Rotate leaked credentials

The API token beginning with `cfat_...` and the R2 S3 access/secret key pair
were pasted into chat earlier. Rotate both immediately, regardless of the
token's stated expiry (2026-10-07).

Also confirmed: the pasted token's id (`d1aaba0aaa1f4a052e1eac6d3f4769ae`)
equals the R2 Access Key ID — it's an R2/Object-access token, **not**
Workers/D1/KV capable. It cannot be used for any deploy in this runbook.

### 1.2 Authenticate wrangler against ASU

Preferred path: **`npx wrangler login`** while signed out of the gmail
dashboard and signed into `dash.cloudflare.com/?org=ac9a47ddb8928af2f3535e2a1e4d8349`.
OAuth is one click and sidesteps manual scope guessing.

Confirm with `npx wrangler whoami` — the listed account must be
`ac9a47ddb8928af2f3535e2a1e4d8349`.

If OAuth is impractical, mint a scoped token with these permissions:
`Workers Scripts: Edit`, `D1: Edit`, `KV Storage: Edit`, `Zone: Edit`,
`Zone DNS: Edit`, `AI Gateway: Edit`. Then
`CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=ac9a47...` in the shell.

### 1.3 **Fork A** — capture secrets (retrievable case)

For every secret in `src/lib/env.ts` AppEnv, list its existence on the
source account and retrieve its value from the owner's own records (the
dashboard secret list shows names only, never values):

- `PASSWORD_PEPPER` — **must be identical on ASU** (it is PBKDF2 hash input).
- `JWT_SECRET` — same value on ASU keeps any still-valid cookie verifiable.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe is account-independent; same values. Webhook URL is path-based (`/api/stripe/webhook` on the same domain), so it stays valid through Phase 6.
- `RESEND_API_KEY` — same. But see 1.5 for its DKIM/SPF records.
- `TURNSTILE_SECRET_KEY` — see 1.4; likely different.
- `SUPPORT_INBOX` — plain var, not secret. Reuse verbatim.

### 1.4 Turnstile — recreate on ASU

Turnstile widgets are account-scoped. Create a new widget in the ASU
dashboard for hostname `defrag.app` (and `sovereign.defrag.app`). Grab the
**new** `sitekey` and `secret`. The gmail widget stays live through Phase 6
so the current build keeps working during propagation.

Update `wrangler.jsonc`'s `TURNSTILE_SITE_KEY` to the new value on the
`migrate-to-asu` branch. Update `TURNSTILE_SECRET_KEY` secret on ASU to
the matching new secret.

### 1.5 Resend DKIM/SPF/DMARC records

Resend's verification TXT/CNAME records live inside the `defrag.app` zone.
Phase 6 exports and reimports the full zone, so these go with it — but
**visually confirm** they made it into the ASU zone before deleting the
gmail zone, or outbound email breaks silently.

### 1.6 **Fork B** — `PASSWORD_PEPPER` unretrievable

If the original pepper value cannot be recovered:

1. Generate a fresh long-random pepper on ASU (`openssl rand -base64 48`).
2. In Phase 5's cutover import, run `UPDATE users SET password_hash='',
   password_salt='', token_version=token_version+1 WHERE 1=1;` after
   restoring the backup — the empty hash means no password can succeed, and
   the version bump revokes any outstanding JWTs.
3. Send a password-reset email (Resend) to all 6 accounts before flipping
   the DNS. Passkeys are unaffected (0 registered today, but the passkey
   flow does not depend on the pepper).
4. Document the reset event in `docs/auth.md` under a "Pepper rotation"
   section so a future maintainer knows the 2026-09-30 hashes were voided.

Fork B is annoying, not catastrophic, at n=6.

---

## Phase 2 — Create ASU resources

From the workspace root, with wrangler authenticated to ASU:

```
npx wrangler d1 create production-os-db
npx wrangler kv namespace create SESSION_KV
```

Copy the two returned ids. Keep the D1 output near the `migrate-to-asu`
branch's `wrangler.jsonc` diff so the ids are visible to the reviewer.

Recreate **AI Gateway `sovereign-ai-gateway`** in the ASU dashboard:
Zero Trust → AI Gateway → Create → name it exactly `sovereign-ai-gateway`
(used by the `AI_GATEWAY_ID` var). Same config as source: caching, rate
limit, logging all present but payload logging OFF, anonymization ON.

**Do not create** an R2 bucket on ASU. `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`, `CF_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID` in `.dev.vars` are vestigial — not in AppEnv, zero
references under `src/`. They only exist for a local ops script that itself
does not read them. Skip them.

---

## Phase 3 — Deploy the real app to ASU (workers.dev only)

**Delete the ASU `production-os` stub first.** Confirm in the dashboard
it has no routes and no bindings, then `npx wrangler delete --name
production-os` (still authenticated to ASU). Wrangler's `deploy` would
overwrite silently, but an explicit delete means the subsequent create has
clean history and no chance of inheriting the stub's settings.

Branch off main:

```
git switch -c migrate-to-asu
```

Edit `wrangler.jsonc` **on the branch only** with the two new ids from
Phase 2. Do not change worker `name`, `main`, `compatibility_date`,
compatibility_flags, assets, `ai` binding, or the `vars` block beyond
`TURNSTILE_SITE_KEY` (Phase 1.4). Do not push this branch to `main`.

Temporarily **pause Workers Builds on the gmail account** for the deploy
window (dashboard → Workers Builds → project → Pause). This prevents the
dual-deploy collision the skill rules explicitly forbid.

Deploy ASU via CLI:

```
rm -rf .open-next .next
npm run build
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

Set every secret on ASU with `npx wrangler secret put <NAME>` for each
entry in the Phase 1.3 list (or Phase 1.6 fresh pepper if Fork B).

---

## Phase 4 — Import the pre-cutover backup + verify on workers.dev

```
npx wrangler d1 execute production-os-db --remote --file=.audit-tmp/prod-d1-backup.sql
```

The backup already contains `PRAGMA defer_foreign_keys=TRUE;`, so FK order
is safe. `_cf_KV` is a reserved table; if the import complains, strip its
`CREATE TABLE` line and retry.

Confirm the schema matches by running the readiness doc's check:

```
npx wrangler d1 execute production-os-db --remote --command "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"
```

Expected: `_cf_KV, baselines, chat_usage, invites, journey_events, journeys,
passkeys, promo_grants, relationships, threads, users`.

Grab the ASU `*.workers.dev` URL from `npx wrangler deployments list`.
Middleware's `isNonCanonicalAllowed()` allows `.workers.dev` hosts through
without the canonical redirect, so the URL serves the full app.

**Manual verification against the workers.dev URL, not curl:**

- Log in as one of the 6 users with their existing password.
  - Success → `PASSWORD_PEPPER` matches; Phase 5 can proceed.
  - Failure → pepper mismatch; revisit Phase 1.3 or invoke Phase 1.6.
- Send one chat message. Confirm AI Gateway logs it on ASU.
- Open `/s/<existing-sigil-token>` for a shared journey. Confirm the OG
  image renders (still slow, that's fine — cache rule not applied yet).
- Trigger one reset-password email to a sandbox address. Confirm Resend
  sends and lands (not spam) — this is the DKIM/SPF sanity check before
  Phase 6 relocates those records.

---

## Phase 5 — Cutover export + import

**Only after Phase 0 is live and both blockers are resolved.**

Choose a quiet window. A `wrangler d1 export --remote` blocks other DB
requests while it runs; with 6 users that is effectively always, but pick
a moment with no scheduled work.

Re-export prod fresh (captures any writes since Phase 0's backup):

```
# authenticate wrangler back to gmail
npx wrangler d1 export production-os-db --remote --output=.audit-tmp/prod-d1-cutover.sql
# authenticate wrangler back to ASU
npx wrangler d1 execute production-os-db --remote --file=.audit-tmp/prod-d1-cutover.sql
```

The backup is idempotent against an empty target (Phase 4's import is
superseded) and against a partially-populated target (each `INSERT` runs
with `defer_foreign_keys` and the file is schema-then-data in the export
order). If re-running, either `DELETE` all rows first or recreate the
target D1 from scratch.

**Freeze signups** in the app for the 5-minute write window (either a
`TURNSTILE_REQUIRED=true` gate plus a temporary banner or a quick
`middleware.ts` early-return on `/api/auth/signup`). At 6 users this is
optional but honest.

---

## Phase 6 — The DNS move (only risky step)

Cloudflare's authoritative NS for `defrag.app` means Phase 6 is a **real
DNS cutover, not a dashboard handoff**. Per
[developers.cloudflare.com/fundamentals/manage-domains/move-domain/](https://developers.cloudflare.com/fundamentals/manage-domains/move-domain/):

- Universal SSL reissues on the new zone; custom certs (none here) would
  need re-upload.
- DNSSEC must be disabled **at both the zone and the registrar** before
  either path starts. Confirm status in the gmail dashboard; if enabled,
  disable first and wait for the DS record to withdraw at the parent.
- Paid add-ons attached to the zone must be released first.
- The old zone goes "Moved Away" for 7 days, then "Deleted" for 7 more.
  **That 14-day window is the rollback safety margin.**

### 6.0 Export DNS records from gmail (shared prerequisite)

Dashboard → `defrag.app` zone → Advanced → **Export DNS records** → `.txt`.
Visually confirm the file includes at minimum:

- `sovereign` CNAME → Worker (or the A record that Workers Builds writes)
- Apex `A`/`CNAME`/`ALIAS` if `defrag.app` itself resolves
- `_dmarc.defrag.app` TXT
- `default._domainkey.defrag.app` TXT (Resend DKIM)
- `resend._domainkey.defrag.app` TXT
- The `defrag.app` SPF TXT (`v=SPF1 include:resend...`)
- Any `subdomain` records the app or a script relies on

Missing records after import = silent breakage. This is exactly the class
of failure Cloudflare's doc warns about with a 1000-error at the edge.

### 6.A **Path A** — `defrag.app` is on Cloudflare Registrar

1. Add `defrag.app` as a **new site on ASU** (Free plan) → Cloudflare
   assigns an NS pair (which **will differ** from `rudy`/`vida` because
   the same domain was recently active on another Cloudflare account —
   this is documented behavior and cannot be overridden).
2. Import DNS records into the new ASU zone (the `.txt` from 6.0).
3. On the **gmail** account, Registrar → Manage Domain → `defrag.app` →
   **Configuration** tab → **Move domain to another Cloudflare account**
   → target `ac9a47ddb8928af2f3535e2a1e4d8349`.
4. Approve on ASU within **5 days**. Prerequisites from CF docs: domain
   registered >10 days ago, DNSSEC off, not locked, no pending Change of
   Registrant.
5. After completion, the domain is **transfer-locked for 30 days**. All
   source-account registrar configuration for that domain is lost.
6. The DNS zone on the gmail side becomes "Moved Away" (unchanged from
   Path B). Wait until Phase 7 is verified green before letting the 7+7
   timer elapse on the gmail zone.

**Rollback nuance under Path A:** once transferred, you cannot push the
domain back to gmail for 30 days. The zone rollback (NS + records) is
still fine because gmail's zone stays alive for 14 days, but the
*registrar* has moved. If you might regret the move, use Path B semantics
even when CF Registrar is available (i.e., transfer only the site/zone,
keep the domain registered on gmail) — but note this is not a standard
CF flow and may not be supported for a `.app` TLD. When in doubt, decide
before Step 3.

### 6.B **Path B** — `defrag.app` is at an external registrar

1. Add `defrag.app` as a new site on ASU (Free plan) → Cloudflare assigns
   a new NS pair. **This is the NS set you must use; you cannot request
   `rudy`/`vida` again.**
2. Import DNS records into the new ASU zone (the `.txt` from 6.0).
3. Log into the external registrar. Replace the two NS records with the
   ASU-assigned pair. TTL/propagation is registrar-dependent; typical
   1–24h, often <1h for common registrars.
4. Wait for ASU's zone status to flip **Active** (Cloudflare polls NS
   delegation).

### 6.Shared — bind the custom domain on the ASU worker

Only after the zone is Active on ASU:

Add to `wrangler.jsonc` (or verify it already exists — the source has
`sovereign.defrag.app` as a custom-domain route, per
`docs/cloudflare-readiness.md` §1 Edge row):

```jsonc
"routes": [
  { "pattern": "sovereign.defrag.app", "custom_domain": true }
]
```

Merge `migrate-to-asu` → `main`, push. Workers Builds on ASU (Phase 7.3)
will roll the deploy; if it has not fired within ~2 min, run the CLI
deploy once as fallback per the skill's canonical release path.

---

## Phase 7 — Post-cutover

### 7.1 Verify the canonical URL

- `https://sovereign.defrag.app/` returns 200 from the ASU worker (confirm
  via `npx wrangler deployments list` on ASU — the latest version timestamp
  is post-Phase 6).
- Full login flow works with an existing password.
- Chat completes end-to-end against `sovereign-ai-gateway` on ASU.
- `curl -D - https://sovereign.defrag.app/s/<token>/opengraph-image` returns
  a valid PNG. Headers will still show `must-revalidate` — that's the
  OpenNext adapter override, not a regression.

### 7.2 Cloudflare Zone Cache Rules (the real 1102 + SSR-cost fix)

This is what the OpenNext adapter override blocked from code — the adapter
force-stamps `Cache-Control: public, max-age=0, must-revalidate` on every
dynamic response and no `ImageResponse` header, middleware rewrite, or
route-handler `Response` can override it. Only an edge zone rule can.

Dashboard → ASU zone `defrag.app` → Caching → Cache Rules → Create rule.
Three rules, all hostname **`sovereign.defrag.app`** (the canonical app
origin; apex `defrag.app` is not routed to the Worker and must not be
used as a hostname pattern).

**Rule 1 — `sigil-og-immutable`**

- Match: Hostname `sovereign.defrag.app` AND URI Path **starts with**
  `/s/` AND URI Path **ends with** `/opengraph-image`
- Cache eligibility: Eligible for cache
- Browser Cache TTL: Override → 1 month
- Edge Cache TTL: Override → 1 year

The token is content-addressed, so a shared Sigil renders Satori once and
serves byte-identical from then on. Kills the crawler fan-out CPU cost
completely.

**Rule 2 — `legal-static-immutable`**

- Match: Hostname `sovereign.defrag.app` AND URI Path equals any of
  `/about`, `/faq`, `/privacy`, `/terms`
- Cache eligibility: Eligible for cache
- Browser Cache TTL: Override → 1 hour
- Edge Cache TTL: Override → 1 day

Content changes on the order of weeks, so 1-day edge TTL is conservative
and safe.

**Rule 3 — `seo-crawlers-immutable`**

- Match: Hostname `sovereign.defrag.app` AND URI Path equals any of
  `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, `/robots.txt`
- Cache eligibility: Eligible for cache
- Browser Cache TTL: Override → 1 hour
- Edge Cache TTL: Override → 1 day

`/llms.txt` and `/llms-full.txt` are static files under `public/`; the
Next.js route handlers `sitemap.ts` and `robots.ts` are also stable per
build. Crawler-friendly, zero personalization.

**Do NOT add cache rules for:** `/chat`, `/baseline`, `/onboard`,
`/account`, `/settings`, `/api/*`, `/reset`, `/invite`, `/redeem`,
`/upgrade`, `/support`, `/s/<id>` (the HTML page — dynamic per-visitor),
or `/` (the landing page — has client-side state that shouldn't be
served from a stale edge copy).

Test: `curl -D - https://sovereign.defrag.app/s/<token>/opengraph-image`
twice within a minute. The second response carries
`cf-cache-status: HIT`. Same for `/llms.txt`.

### 7.3 Recreate Workers Builds on ASU

Dashboard → Workers & Pages → Builds (Platforms) → Create build → connect
the same `defragapp/production.os` GitHub repo → branch `main` → build
command `npx opennextjs-cloudflare build`, deploy command
`npx opennextjs-cloudflare deploy`. Set the same env-var + secret
inheritance from Phase 1.

Then **re-enable** Workers Builds on gmail (do not delete it) — as the
14-day rollback path — but leave the ASU integration as the one that
ships on push.

### 7.4 New Cloudflare Web Analytics site

Dashboard → ASU account → Web Analytics → Add site → `sovereign.defrag.app`
→ copy new beacon token → set `NEXT_PUBLIC_CF_BEACON_TOKEN` in
`wrangler.jsonc` on main → commit → push.

### 7.5 Retirement of the old Turnstile widget

Once ASU's new widget is confirmed working in production (signup + login
+ reset flows all succeed on the canonical URL), delete the gmail-account
widget. Do not do this earlier — during Phase 6 propagation both accounts
may serve traffic and both widgets need to be live.

---

## Phase 8 — Decommission gmail (T+14 days)

Only after 14+ days of green:

- Delete gmail D1 `production-os-db`.
- Delete gmail KV `SESSION_KV`.
- Delete gmail Worker `production-os`.
- Cancel Workers Paid on gmail (Phase 0 insurance no longer needed).
- Delete gmail Workers Builds project.
- Delete the "Moved Away" zone (it should self-expire after the 7+7 timer).

---

## Rollback matrix

| Failure mode | Recovery window | Recovery action |
|---|---|---|
| Phase 1–5 any issue | No prod impact — gmail still fully live | Just continue working on gmail; ASU is inert until Phase 6 |
| `PASSWORD_PEPPER` mismatch after Phase 4 login test | No prod impact yet | Fix pepper in Phase 1.3 or invoke Phase 1.6 Fork B |
| Phase 6 propagation broke a service | **14 days** (CF's "Moved Away → Deleted" timer) | Flip NS back at registrar to gmail-side pair (Path B) OR initiate an inter-account transfer back (Path A, subject to 30-day lock caveat) |
| Phase 7 canonical URL broken | **14 days** on gmail zone + gmail worker still live | Same as above; also `npx wrangler deployments list` on gmail to confirm the last known-good version is still serving |
| Phase 8 mistake | No rollback — decommissioned | Restore D1 from `.audit-tmp/prod-d1-cutover.sql`; ASU KV is empty and re-populates naturally |

The `.audit-tmp/prod-d1-backup.sql` (pre-migration snapshot) and
`.audit-tmp/prod-d1-cutover.sql` (Phase 5 snapshot) are both **off-box
copies mandatory**: upload them to a private bucket or external disk
before Phase 6. A copy on the same SSD as the repo is one bad disk event
from gone.

---

## Appendix A — AppEnv checklist (`src/lib/env.ts` as source of truth)

| Name | Kind | Identical on ASU? | Notes |
|---|---|---|---|
| `DB` | D1 binding | new id | Phase 2 |
| `SESSION_KV` | KV binding | new id | Phase 2 |
| `AI` | Workers AI binding | same binding name | No id to change |
| `ASSETS` | Assets binding | same | Static |
| `AI_GATEWAY_ID` | var | same value (`sovereign-ai-gateway`) | Gateway recreated with same name on ASU |
| `FROM_EMAIL` | var | same | `sovereign@defrag.app` |
| `SUPPORT_INBOX` | var | same | `chadowen93@gmail.com` |
| `BASELINE_HORIZONS_URL` | var | same | NASA/JPL endpoint |
| `STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY` | var | same | `price_1Te0g9Bk78yJ8Hww8fFZCqhm` |
| `STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL` | var | same | `price_1Tq6nPBk78yJ8Hwwm0pxg4hH` |
| `STRIPE_SUCCESS_URL` | var | same | path-based, unchanged by migration |
| `STRIPE_CANCEL_URL` | var | same | same |
| `STRIPE_PORTAL_RETURN_URL` | var | same | same |
| `JWT_SECRET` | secret | **same value** | Otherwise pre-cutover cookies stop verifying post-Phase 6 |
| `PASSWORD_PEPPER` | secret | **same value or invoke Fork B** | Hash-input; changing it invalidates 6 stored hashes |
| `STRIPE_SECRET_KEY` | secret | same | Stripe is account-independent |
| `STRIPE_WEBHOOK_SECRET` | secret | same | Webhook URL unchanged (same domain + path) |
| `RESEND_API_KEY` | secret | same | Resend is account-independent; only its DKIM/SPF records move |
| `TURNSTILE_SITE_KEY` | var | **different** — new ASU widget | Phase 1.4 |
| `TURNSTILE_SECRET_KEY` | secret | **different** — matching ASU widget | Phase 1.4 |
| `TURNSTILE_REQUIRED` | var | same (`true`) | |
| `NEXT_PUBLIC_CF_BEACON_TOKEN` | var | **different** — new ASU analytics site | Phase 7.4 |

Vestigial in `.dev.vars`, not in AppEnv, zero references under `src/`, do
NOT recreate on ASU: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_S3_ENDPOINT`, `CF_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Appendix B — Command block (copy/paste, ASU-authenticated)

```
# Phase 2 — create resources
npx wrangler d1 create production-os-db
npx wrangler kv namespace create SESSION_KV

# Phase 3 — deploy (from migrate-to-asu branch, wrangler.jsonc updated)
rm -rf .open-next .next
npm run build
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy

# Phase 3 — set secrets
npx wrangler secret put JWT_SECRET
npx wrangler secret put PASSWORD_PEPPER
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY

# Phase 4 — import backup
npx wrangler d1 execute production-os-db --remote --file=.audit-tmp/prod-d1-backup.sql
npx wrangler d1 execute production-os-db --remote \
  --command "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"

# Phase 5 — cutover re-import (after exporting fresh from gmail)
npx wrangler d1 execute production-os-db --remote --file=.audit-tmp/prod-d1-cutover.sql

# Phase 6.5 — post-Active: deploy custom-domain route (wrangler.jsonc edit, push main)
# Workers Builds ships automatically; CLI fallback:
npx wrangler deployments list    # confirm no in-flight build first
rm -rf .open-next .next && npm run deploy

# Phase 7.1 — verify
npx wrangler deployments list    # on ASU
curl -D - -o /dev/null https://sovereign.defrag.app/s/<token>/opengraph-image
```

For the fresh cutover export in Phase 5, temporarily
`npx wrangler logout && npx wrangler login` against gmail, run the export,
then re-auth to ASU. There is no reliable cross-account alias support in
`wrangler.jsonc` today; the two-id branch strategy is simpler and honest.

## Appendix C — Things deliberately NOT done

- **Do not migrate KV session keys.** 6 users re-login; the sessions
  would expire in 7 days anyway.
- **Do not "borrow" the ASU paid plan for a worker on gmail.** Workers
  plan is per-account; there is no cross-account CPU-limit mechanism.
- **Do not use a Cloudflare `zone_share` for a permanent split.** Zone
  share is a temporary diagnostic tool, not a migration architecture.
- **Do not attempt Phase 6 during a traffic spike or before Phase 0 is
  applied.**
- **Do not paste real secrets into the repo's `.dev.vars`** just because
  a `migrate-to-asu` branch is convenient for testing. Set ASU secrets
  via `wrangler secret put` only.
- **Do not delete the gmail zone before Phase 7.3 confirms ASU's Workers
  Builds integration is shipping cleanly.** The 14-day "Moved Away"
  window is not optional if any part of the cutover might need reversing.
