# production.os — Sovereign OS

A fullstack Next.js app deployed on Cloudflare Workers via the OpenNext adapter.
Baseline engine uses the NASA/JPL Horizons API for natal chart computation.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router + React 19 + Tailwind CSS + shadcn/ui |
| Adapter | `@opennextjs/cloudflare` (OpenNext) |
| Runtime | Cloudflare Workers (edge, `nodejs_compat`) |
| Database | Cloudflare D1 (SQLite) — **10 tables**: `users`, `baselines`, `threads`, `invites`, `relationships`, `passkeys`, `chat_usage`, `journeys`, `journey_events`, `promo_grants` |
| Sessions | Cloudflare KV (`SESSION_KV`) — rate-limit + reset/verify + `ops:` counters (JWTs live in the cookie; `users.token_version` revokes them early) |
| Device-Only memory | Client-side AES-GCM 256 non-extractable `CryptoKey` in IndexedDB `sovereign-memory` (`memory_mode='local'` → zero-retention edge inference, no D1 thread write) |
| AI Inference | Workers AI (`@cf/meta/llama-3.1-8b-instruct-fp8`, explicit `max_tokens=1024`, 2,000-char input cap) |
| AI Routing | AI Gateway (ID: `sovereign-ai-gateway`) + direct Workers AI fallback |
| Entitlements | `tier.ts resolveTier()` — Free vs `sovereign+` (Stripe) vs owner (`chadowen93@gmail.com`) vs SHA-256-hashed 30-day gift passes (`promo.ts`) |
| Baseline Engine | NASA/JPL Horizons API (planetary positions) |
| Auth | Passkeys (WebAuthn, passkey-first) + Email/Password fallback (PBKDF2-100k + HMAC pepper) + JWT (HS256) |
| Bot Protection | Cloudflare Turnstile (best-effort, env-gated) |
| Email | Resend (`sovereign@defrag.app`, verified domain, click/open tracking) |
| Payments | Stripe (Free vs Sovereign+ monthly/annual) |

> The full authentication model — session handling, password hashing/pepper,
> the Cloudflare Workers PBKDF2 ceiling, best-effort Turnstile, and the
> implemented passkey (WebAuthn) flow — is documented in [`docs/auth.md`](docs/auth.md).
>
> Related: [`docs/cloudflare-readiness.md`](docs/cloudflare-readiness.md)
> (edge security + scale/media-spike plan), its operational twin
> [`docs/scaling-plan.md`](docs/scaling-plan.md) (free-plan ceilings, thresholds →
> action matrix, upgrade ladder, and copy-paste "agent Lee" prompts), and
> [`docs/stripe-plan.md`](docs/stripe-plan.md) (free → Sovereign+ monetization).

## Release flow

The proven, reliable path is **verify → push → confirm**.
Workers Builds (git integration) is connected and verified as of 2026-10-06.
A push to `main` is the canonical production path and must build/deploy both
Workers projects (`production-os` and `sovereign-tail`).

Before push, run the full ratchet:

```bash
npm run verify:release                          # every gate green, or do not ship
git push origin main                            # canonical path (Workers Builds)
```

Then confirm both check-runs and both Worker rollouts in the dashboard Builds view.

> **This deploys two Workers, not one.** `production-os` and `sovereign-tail`
> are separate Workers with separate `wrangler.jsonc` files and separate
> version streams. `npm run deploy` chains `npm run tail:deploy` after the main
> OpenNext deploy, so a Tail Worker config change reaches production with the
> same command.
>
> Do not drop that chain. `redact_query_string: true` was committed to
> `tail-worker/wrangler.jsonc` and still sat unapplied in production, because
> only the main deploy ran; the drift was only caught by hand. Gate 33 in
> `verify:release` now asserts the chain exists, so a main-only deploy fails the
> ratchet instead of shipping half a release.
>
> If you deploy the main Worker by any *other* route — including a future
> Workers Builds wiring — you must run `npm run tail:deploy` yourself.

If a build is in flight, do not also run a CLI deploy — two builds of the same
commit collide and stall static-asset binding propagation (the 503/hang seen on
`/`, `/privacy`, `/terms`).

`npm run deploy` runs `opennextjs-cloudflare build` (which calls `next build`),
then `wrangler deploy` for `production-os` (100% of traffic; live at
`sovereign.defrag.app`), then `npm run tail:deploy` for `sovereign-tail`. Both
land at 100%. A CLI-authored version shows your email as Author in the listing; a
build-system version shows `undefined`; a version created by a direct API PATCH
shows `Automatic deployment on upload` — which is how you can tell a config was
hand-patched into production rather than shipped through the release path.

Confirm both landed:

```bash
npx wrangler versions list                      # production-os
cd tail-worker && npx wrangler versions list    # sovereign-tail
```

Do **not** run `npm run deploy` while a push-triggered build is still in flight:
that is a second build of the same commit colliding, and the collision stalls
static-asset binding propagation (the 503/hang previously seen on `/`, `/privacy`,
`/terms`). Use CLI deploy only as fallback when a push build fails or does not fire.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Cloudflare resources (already provisioned)

The following resources are already created on your account and their IDs are pre-filled in `wrangler.jsonc`:

- **D1 database:** `production-os-db`
- **KV namespace:** `SESSION_KV`
- **AI Gateway:** `sovereign-ai-gateway`

The binding IDs themselves live in `wrangler.jsonc` (required at deploy time) and
are deliberately not repeated in documentation.

### 3. Run the D1 migration

```bash
npm run db:migrate         # local
npm run db:migrate:remote  # production
```

> Schema changes should be applied through a versioned migration going forward
> (`wrangler d1 migrations create production-os-db <name>`); `schema.sql`
> remains the canonical baseline for the current tables.

### 4. Set secrets

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put PASSWORD_PEPPER
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

`PASSWORD_PEPPER` is a long random secret (e.g. `openssl rand -hex 32`) layered
over each PBKDF2 hash as an HMAC. It must be set before the first signup and
**never rotated** afterward — rotating it invalidates every existing password
check. See [`docs/auth.md`](docs/auth.md).

The `FROM_EMAIL` binding is set in `wrangler.jsonc` (default: `sovereign@defrag.app`). Resend domain verification requires:
- SPF TXT record at apex (`v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all`)
- DKIM TXT record at `resend._domainkey.defrag.app`
- Click-tracking CNAME at `click.defrag.app` → `links1.resend-dns.com`

Turnstile is opt-in and degrades gracefully: until `TURNSTILE_SITE_KEY`
(is a plain var in `wrangler.jsonc`) **and** `TURNSTILE_SECRET_KEY` are both
set to real values, the widget is hidden and the API accepts signup without a
token. Set both to enforce bot protection on `/onboard`.

### 5. Generate Cloudflare types

```bash
npm run cf-typegen
```

### 6. Local dev / build / preview / deploy

```bash
npm run dev        # Next.js dev server (local)
npm run typecheck  # tsc --noEmit (TypeScript)
npm run lint       # ESLint (next/core-web-vitals + next/typescript)
npm run test       # Vitest unit tests (auth, stripe, sovereign safety/reasoning/evals/model/prompt)
npm run build      # Plain Next.js build (OpenNext runs this internally)
npx opennextjs-cloudflare build   # OpenNext compiler → .open-next/ (what CI runs)
npm run preview    # OpenNext build + preview in Workers runtime (workerd)
npm run deploy     # OpenNext build + deploy to Cloudflare edge
```

Run `npm run verify:release` before pushing — it is the whole ratchet. Its own
header enumerates the gates and is the single source of truth for the count; it
currently runs **116 checks across 33 numbered gates**: types, lint, the
34 Vitest suites (396 tests), committed contract wiring, a clean OpenNext build,
the browser AES-GCM vault round-trip, the zero-CLS JourneyBar veil, a live
authenticated walk over every surface in both memory modes, draft/503 recovery,
whole-surface ergonomics (44px + 0 overflow at 390/768/1440), the PWA manifest,
and the launch gates — compliance & 18+ age gate, IP & bundle isolation, owner
console & 30-day gift pass, and the iOS 16px input auto-zoom floor. Preview-backed
gates run against LOCAL D1 only and report SKIPPED (never a false PASS) if the
environment cannot boot.

> Note: `next build` alone does NOT produce `.open-next/`. To build the
> Workers bundle locally, always use `npx opennextjs-cloudflare build`

> **Do not shorten the release path to `typecheck && lint && test`.**
> Those three are necessary but not sufficient: they passed 100% green on a
> commit whose Workers bundle could not build at all. A dependency override
> pinning `brace-expansion` to v5 forced an ESM-only package onto
> `minimatch@3`, which imports the CommonJS default export — so the OpenNext
> bundle died with `does not provide an export named 'default'`, while
> `tsc`, ESLint and all 396 Vitest tests reported success. Nothing in the
> type system or the unit suite loads `.open-next/worker.js`.
>
> Gate 1 (the clean OpenNext build) is the **only** check that catches
> ESM/CJS interop and bundling regressions. If you are ever tempted to run a
> subset of the gates, run Gate 1 too, or run the whole ratchet.

## Project Structure

```
open-next.config.ts            # OpenNext Cloudflare config (defaults)
wrangler.jsonc                 # Worker config: D1, KV, AI, AI Gateway, static assets
schema.sql                     # Canonical D1 baseline — 10 tables (users, baselines, threads, invites, relationships, passkeys, chat_usage, journeys, journey_events, promo_grants); migrations/0001–0004 layer onto existing DBs
assets/ace-of-cups.jpg         # Canonical brand artwork (source of truth for the mark)
scripts/build-brand-assets.mjs # Regenerates public/brand/*.png from the source artwork (node scripts/build-brand-assets.mjs)
public/brand/                  # Emitted raster mark: emblem-full, emblem-core, emblem-core-bold, icon, apple-icon
src/
├── app/
│   ├── api/
│   │   ├── auth/route.ts              # POST login/signup (clickwrap-before-Turnstile + 18+ affirm), GET session, DELETE logout; token_version revoke
│   │   ├── auth/verify/route.ts       # GET email verification
│   │   ├── auth/resend/route.ts       # POST re-send verification email (KV cooldown)
│   │   ├── auth/reset/route.ts         # POST password reset (email via Resend)
│   │   ├── auth/account/route.ts      # DELETE account (self-serve data removal)
│   │   ├── auth/export/route.ts       # GET portable data export (incl. consent receipt)
│   │   ├── auth/passkey/register/route.ts   # WebAuthn enrollment (POST options / PUT verify), session-gated
│   │   ├── auth/passkey/authenticate/route.ts # WebAuthn login (POST options / PUT verify), issues session cookie
│   │   ├── baseline/route.ts          # GET/POST natal baseline (NASA/JPL Horizons; 18+ DOB floor; consent receipt)
│   │   ├── chat/route.ts              # Sovereign chat: pre-model safety+extraction guard, non-streaming gen as one SSE event, atomic D1 usage ceiling
│   │   ├── checkout/route.ts          # POST → Stripe Checkout session (JWT-guarded)
│   │   ├── billing-portal/route.ts    # POST → Stripe customer portal
│   │   ├── threads/route.ts           # Chat history CRUD (D1) — paginated GET
│   │   ├── journeys/route.ts + [id]   # Journey lifecycle (active arc, complete/archive, events)
│   │   ├── invites/route.ts + info/accept/[id] # Connection invitations (Sovereign+ to send; accept sets explicit share opt-in)
│   │   ├── relationships/route.ts     # Consented two-way connections (derived signals only)
│   │   ├── redeem/route.ts            # POST claim a sov_gift_ pass (rate-limited, atomic conditional UPDATE)
│   │   ├── owner/overview/route.ts    # GET live platform metrics — owner only, 404 to everyone else
│   │   ├── owner/promo/route.ts       # POST mint / DELETE revoke a 30-day gift pass — owner only
│   │   ├── support/route.ts           # POST support message → SUPPORT_INBOX
│   │   └── webhooks/stripe/route.ts   # Stripe webhook → subscription_tier
│   ├── account/page.tsx               # Account management
│   ├── baseline/page.tsx              # Baselines list
│   ├── chat/chat-client.tsx           # Chat client (SSE streaming, thread switcher)
│   ├── chat/page.tsx                  # Chat page (server wrapper around ChatClient)
│   ├── onboard/page.tsx               # Server wrapper (force-dynamic) — redirects authed users with a baseline to /chat
│   ├── onboard/onboard-server.tsx     # Onboard server gate (legacy re-export; superseded by page.tsx)
│   ├── onboard/onboard-content.tsx    # Client two-phase flow: account → baseline → plan (Turnstile-gated)
│   ├── upgrade/checkout-client.tsx    # Upgrade client → POST /api/checkout
│   ├── upgrade/page.tsx               # Paywall → Stripe Checkout
│   ├── terms/page.tsx                 # Terms of service
│   ├── privacy/page.tsx               # Privacy policy
│   ├── globals.css                    # Tailwind + shadcn theme tokens
│   ├── layout.tsx                     # Root layout
│   └── page.tsx                       # Landing page (server shell + JSON-LD; renders LandingClient)
├── components/
│   ├── nav.tsx                        # Nav + sign-out (DELETE /api/auth)
│   ├── passkey.tsx                    # "Continue with passkey" (login) + "Add a passkey" (account)
│   ├── rich-text.tsx                  # Renders assistant answers from markdown-lite (headings, lists, bold, code)
│   ├── turnstile.tsx                  # Turnstile widget (client, env-gated)
│   └── ui/                            # shadcn/ui (accordion, button, card, input, label) + logo.tsx (renders public/brand/emblem-core-bold.png) + section.tsx (airy titled group)
├── lib/
│   ├── auth.ts                        # WebCrypto PBKDF2 + JWT (HS256), reset tokens
│   ├── passkeys.ts                    # WebAuthn (@simplewebauthn/server): register/authenticate, KV challenges
│   ├── base64url.ts                   # workerd-safe base64url <-> bytes (passkey keys)
│   ├── email.ts                       # Resend transactional email
│   ├── env.ts                         # AppEnv type + getEnv() helper
│   ├── nasa-jpl.ts                    # NASA/JPL Horizons API → natal positions
│   ├── sovereign-prompt.ts            # Baseline derivation + system prompt
│   ├── sovereign-types.ts             # Reasoning contracts (ReasoningContext, SafetyValidation, …)
│   ├── sovereign-baseline.ts          # Provenance-aware BaselineSignal derivation
│   ├── sovereign-reasoning.ts         # Classification, meaning detection, corrections, context, generation pipeline
│   ├── sovereign-safety.ts            # Layer-1 deterministic validation, negation-aware, leakage guard, high-risk routing
│   ├── sovereign-model.ts             # Non-streaming model adapter (gateway-first + direct fallback; explicit max_tokens)
│   ├── chat-history.ts                # Idempotent merge of stored + client-sent transcript (prevents duplicate-turn writes)
│   ├── markdown-lite.ts               # Dependency-free markdown subset → tokens for assistant answers
│   ├── limits.ts                      # FREE_TIER_DAILY_LIMIT (5 msgs/day) + related ceilings
│   ├── stripe.ts                      # Stripe pricing tiers + webhook verification
│   ├── turnstile.ts                   # verifyTurnstileToken (env-gated)
│   ├── terms.ts                       # CURRENT_TERMS_VERSION + clickwrap copy source
│   ├── date-of-birth.ts               # DOB parse + 18+ age floor (UTC) shared by client + API
│   ├── usage.ts                       # atomic D1 daily-turn ceiling read/claim
│   ├── tier.ts                        # resolveTier(): owner / paid sovereign+ / gift / free + auto-revert
│   ├── promo.ts                       # SHA-256-hashed 30-day gift passes (mint/claim/revoke)
│   ├── owner.ts                       # requireOwner() — owner-only surface, identical 404 to non-owners
│   ├── journeys.ts                    # server journey persistence + lifecycle
│   ├── sovereign-journey.ts           # deterministic Journey Engine (step catalog, milestones, progress)
│   ├── journey-store.ts               # Device-Only journey vault (sealed envelopes in IndexedDB)
│   ├── local-memory.ts                # AES-GCM 256 non-extractable key + sovereign-memory IndexedDB primitives
│   ├── threads.ts                     # thread/transcript CRUD helpers
│   ├── connections.ts                 # shared auth-payload + user-load helpers for API routes
│   ├── invite-status.ts               # invite state machine
│   ├── sovereign-connections.ts       # relationship/baseline-signal derivation for connected people
│   ├── sovereign-humandesign.ts       # Human Design bodygraph derivation
│   ├── dictation.ts                   # progressive Web Speech dictation (iOS-resilient)
│   ├── viewport.ts                    # visualViewport keyboard-height helper
│   ├── share-card.ts                  # OG/social share-card composition
│   ├── brand-emblem-data.ts           # inlined brand emblem data
│   ├── types.ts                       # Shared TypeScript types (incl. MemoryMode)
│   ├── utils.ts                       # cn() class merger + D1 date helpers (formatD1Date, formatDateOfBirth)
│   └── *.test.ts                      # Vitest unit tests (auth, stripe, sovereign-* modules; 28 files / 296 tests)
└── middleware.ts                      # Auth gate: public routes, 401 JSON / redirect
```

## Sovereign Reasoning Engine

`/api/chat` runs a full-response → deterministic-validate → bounded-repair pipeline
(`generateSovereignResponse` in `sovereign-reasoning.ts`):

1. **Input safety routing** (`detectSafetyMode`): self-harm disclosures short-circuit
   to a non-clinical escalation response and abuse disclosures to a grounded
   resource response — no model call, raw content never returned.
2. **Context building** (`buildReasoningContext`): phrase-level question
   classification (Levels 1–4, 11 domains), meaning-target detection with
   user-definition extraction, pattern/correction/unknown/authorization scanning,
   and windowed history that preserves corrections.
3. **Non-streaming generation** (`createCloudflareModel`): a single complete
   answer via `@cf/meta/llama-3.1-8b-instruct-fp8` (explicit `max_tokens`),
   routed through AI Gateway `sovereign-ai-gateway` with direct Workers AI
   fallback. The validated text is then delivered to the client as one SSE
   `content` event (transport is SSE; the model call itself is not token-streamed).
4. **Layer 1 validation** (`validateSovereignText`): a negation-aware lexicon over
   11 prohibited categories (diagnosis, identity-verdict, motive-certainty,
   hidden-emotion-certainty, relationship-verdict, system-blame,
   baseline-determinism, destiny, overvalidation, prescriptive-authority,
   unsupported-claim), plus rejected-hypothesis re-assertion blocking and an
   internal-context leakage guard.
5. **Bounded repair**: one regeneration with `buildRepairInstruction`; if the
   repaired draft still fails, a deterministic grounded fallback is returned.
6. **SSE shipment + persistence**: only validated text is streamed
   (`data: {"content":…}`), then the thread is persisted to D1; the free-tier
   daily counter increments only after successful generation + persistence.

Golden-case evals (helping, manipulation, family patterns, failure, baseline,
correction, leakage) and §53 regressions are covered in
`sovereign-evals.test.ts` / `sovereign-safety.test.ts`.

## Notes

- Routes run in the Cloudflare Workers runtime via the OpenNext adapter (compatibility flag `nodejs_compat`; no explicit `runtime = "edge"` exports).
- Passwords are hashed with PBKDF2-HMAC-SHA256 at **100,000 iterations** (the Cloudflare Workers / workerd WebCrypto ceiling — values above 100k throw at runtime) and then keyed with an HMAC using the `PASSWORD_PEPPER` secret, so a leaked D1 dump is not crackable on its own. Stored hashes are versioned (`pbkdf2$<iter>$pepper$<hmac>`) and older/un-peppered rows are transparently upgraded on successful login. Login is rate-limited (10 attempts / 5 min per IP+email) and thread chat is capped for free tier (5 msgs/day, KV-backed). See [`docs/auth.md`](docs/auth.md).
- JWT session tokens are stored in an httpOnly, Secure, SameSite=Lax cookie (7-day expiry) and verified on every API call via middleware + route guards.
- **Passkeys (WebAuthn) are live** and passkey-first for return logins: `@simplewebauthn/server` v13 (edge-compatible), a `passkeys` D1 table, and `/api/auth/passkey/{register,authenticate}` endpoints (POST options / PUT verify; challenges are single-use in KV). A "Continue with passkey" button tops the login card and an "Add a passkey" control lives on the account page; enrollment requires an existing session and the password stays as the fallback, so nobody is locked out. Raw WebAuthn `DOMException`s are mapped to friendly, actionable messages instead of being surfaced to the user. The browser ceremony must be validated on a real device. See [`docs/auth.md`](docs/auth.md) §9.
- The chat route verifies the AI Gateway call and falls back to a direct Workers AI call if the gateway is unavailable. Generation is non-streaming (one complete, validated answer); it is delivered to the client as a single SSE `content` event and persisted to D1 threads.
- The chat route windows conversation context to the most recent 20 messages (`MAX_CONTEXT_MESSAGES`) before inference, capping token spend while full history remains stored in D1.
- The `GET /api/threads` list is paginated (`page`/`limit`, default 50, max 50) and returns `{ threads, total, page, pageSize }`; the `?id=` detail lookup is unchanged.
- All routes set security headers (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy) plus a CSP in `next.config.ts`. `Permissions-Policy` ships `camera=(), microphone=(self), geolocation=()` so first-party Web Speech dictation is never blocked; `productionBrowserSourceMaps` is `false`.
- **Compliance & consent are provable, not just stated.** Signup requires an explicit clickwrap (`termsAccepted: true`) checked before Turnstile, persisting `users.terms_version` + `terms_accepted_at` (a receipt returned in the data export); `date-of-birth.ts` + `/api/baseline` enforce an 18+ floor and stamp `baselines.consent_accepted_at`; `/invite` accept uses an explicit baseline-share opt-in. `/terms` carries the 18+ eligibility, non-therapy + Express Release of Liability, crisis lines (988 / 741741 / 1-800-799-7233), the liability cap, and a §15 class-action waiver; `/privacy` discloses every `localStorage`/`IndexedDB` key, vendor cookies, transfers, retention, and a `#security` anchor that `security.txt` points at.
- **Dual memory architecture.** `memory_mode='server'` (default) persists threads + journeys in D1 for multi-device continuity; `memory_mode='local'` is zero-retention — `/api/chat` skips the D1 thread write and the client keeps an AES-GCM-256 non-extractable-key vault in IndexedDB `sovereign-memory` (stores `keys` + `records`).
- **Deterministic Journey Engine** (`sovereign-journey.ts`) drives the out-of-flow `.journey-veil` (reveals with `CLS = 0.0000`); server journeys persist to `journeys`/`journey_events`, Device-Only journeys to the vault.
- **Monetization & owner.** `tier.ts resolveTier()` elevates the owner (`chadowen93@gmail.com`) and any active gift to `sovereign+` and auto-reverts on lapse. The owner-only console in `/account` mints SHA-256-hashed 30-day `sov_gift_` passes (`promo.ts`) redeemed via `/redeem`; `/api/owner/*` answers non-owners with the same 404 an unknown path gets, so the surface does not leak.
- **Anti-extraction IP guard + fair-use ceilings.** `/api/chat` deflects prompt-injection/system-prompt-extraction *before* any model call (zero token cost), caps per-message input at 2,000 chars, windows context to 20 messages (`max_tokens=1024`), and enforces atomic D1 daily ceilings (5 free / 150 `sovereign+`, owner exempt).
- **iOS input floor.** On coarse pointers every `input`/`textarea`/`select`/`contenteditable` computes `font-size ≥ 16px` (`globals.css` `!important` floor) so Safari never auto-zooms on tap.
- The baseline is computed server-side against the NASA/JPL Horizons API; raw data and derived astrology/numerology/Human Design fields are stored in D1.
- The AI's system prompt is a "Pattern Interruption" directive: non-clinical, evidence-separated (Observed / Baseline-supported / Interpretive / Unknown), with four levels of inquiry. Baseline is context, never a fixed identity or verdict.
- Transactional emails are sent from `sovereign@defrag.app` via Resend (verified domain with DKIM/SPF, click and open tracking enabled). Fallback to console-log when `RESEND_API_KEY` is unset.
- Five email templates ship in `src/lib/email.ts` (welcome, verify, password-reset, billing-success, trial-ending), each using the branded `emailShell`/`emailButton` design system.
- Observability is enabled in `wrangler.jsonc` with head sampling at rate 0.1 (10% of traces).
- **One brand mark, sourced from artwork.** The mark is the canonical Ace-of-Cups engraving in `assets/ace-of-cups.jpg`. `scripts/build-brand-assets.mjs` (run with `node scripts/build-brand-assets.mjs`) isolates the line-art into transparent PNGs and emits `public/brand/`: `emblem-core-bold.png` (nav/footer logo + social card — the engraving with hairlines thickened by a morphological dilate so it reads at header size instead of collapsing into a smudge), `emblem-core.png`/`emblem-full.png` (thin cuts), and `icon.png`/`apple-icon.png` (graphite plates for the tab favicon and iOS home-screen icon). Every surface draws from these files — there is no separate or hand-redrawn logo. The retired SVG glyph system (`lib/brand-mark.ts`, `icon.svg`, `apple-icon.tsx`) has been deleted; `icon.test.ts` guards that the PNGs exist and the surfaces reference them.
- `npm audit` is clean (0 vulnerabilities). The `postcss` advisory previously inherited via `next@15` is resolved by a root `overrides` pinning `postcss@^8.5.28`; no Next 16 upgrade is required.
- This project intentionally has no `open-next.config.ts` `buildCommand`: OpenNext runs `npm run build` internally, and overriding it causes infinite build recursion.