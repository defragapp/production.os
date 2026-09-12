# production.os — Sovereign OS

A fullstack Next.js app deployed on Cloudflare Workers via the OpenNext adapter.
Baseline engine uses the NASA/JPL Horizons API for natal chart computation.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router + React 19 + Tailwind CSS + shadcn/ui |
| Adapter | `@opennextjs/cloudflare` (OpenNext) |
| Runtime | Cloudflare Workers (edge, `nodejs_compat`) |
| Database | Cloudflare D1 (SQLite) — `users`, `baselines`, `threads` |
| Sessions | Cloudflare KV (`SESSION_KV`) |
| AI Inference | Workers AI (`@cf/meta/llama-3.1-8b-instruct-fp8`) |
| AI Routing | AI Gateway (ID: `sovereign-ai-gateway`) + direct fallback |
| Baseline Engine | NASA/JPL Horizons API (planetary positions) |
| Auth | Email/Password + WebCrypto PBKDF2 + JWT (HS256) |
| Bot Protection | Cloudflare Turnstile (opt-in, env-gated) |
| Email | Resend (`info@sovereign.os`, logs to console when unset) |
| Payments | Stripe (Free vs Sovereign+ monthly/annual) |

## CI/CD

Deploys are managed by Cloudflare CI (external webhooks — no `.github/workflows`):

1. Push to `main` triggers the build.
2. Build runs `npx opennextjs-cloudflare build` (the OpenNext compiler; it internally calls `npm run build`, i.e. `next build`).
3. Deploy runs `npx wrangler deploy` and rolls out to 100% of traffic.
4. Live at `sovereign.defrag.app` / `app.defrag.app`.

A preview-branches trigger exists for non-`main` branches using the same build command.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Cloudflare resources (already provisioned)

The following resources are already created on your account and their IDs are pre-filled in `wrangler.jsonc`:

- **D1 database:** `production-os-db` (`f4274cce-4444-4501-85a9-58c28bff27ac`)
- **KV namespace:** `SESSION_KV` (`8ccb87e3a5554f849d69053df7275a29`)
- **AI Gateway:** `sovereign-ai-gateway`

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
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

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
npm run test       # Vitest unit tests (auth, stripe, sovereign-prompt)
npm run build      # Plain Next.js build (OpenNext runs this internally)
npx opennextjs-cloudflare build   # OpenNext compiler → .open-next/ (what CI runs)
npm run preview    # OpenNext build + preview in Workers runtime (workerd)
npm run deploy     # OpenNext build + deploy to Cloudflare edge
```

Run `npm run typecheck && npm run lint && npm test && npx opennextjs-cloudflare build`
locally before pushing to verify the exact CI pipeline output.

> Note: `next build` alone does NOT produce `.open-next/`. To build the
> Workers bundle locally, always use `npx opennextjs-cloudflare build`
> (or `npm run preview` / `npm run deploy`).

## Project Structure

```
open-next.config.ts            # OpenNext Cloudflare config (defaults)
wrangler.jsonc                 # Worker config: D1, KV, AI, AI Gateway, static assets
schema.sql                     # D1 schema (users, baselines, threads)
src/
├── app/
│   ├── api/
│   │   ├── auth/route.ts              # POST login/signup, GET session, DELETE logout (Turnstile)
│   │   ├── auth/reset/route.ts        # POST password reset (email via Resend)
│   │   ├── baseline/route.ts          # GET/POST natal baseline (NASA/JPL Horizons)
│   │   ├── chat/route.ts              # SSE streaming chat via Workers AI + AI Gateway
│   │   ├── checkout/route.ts          # POST → Stripe Checkout session (JWT-guarded)
│   │   ├── threads/route.ts           # Chat history CRUD (D1) — paginated GET
│   │   └── webhooks/stripe/route.ts   # Stripe webhook → subscription_tier
│   ├── account/page.tsx               # Account management
│   ├── baseline/page.tsx              # Baselines list
│   ├── chat/chat-client.tsx           # Chat client component (streaming, threads)
│   ├── chat/page.tsx                  # Chat page (server wrapper around ChatClient)
│   ├── onboard/page.tsx               # Birth data intake form + login/signup (Turnstile)
│   ├── upgrade/checkout-client.tsx    # Upgrade client → POST /api/checkout
│   ├── upgrade/page.tsx               # Paywall → Stripe Checkout
│   ├── terms/page.tsx                 # Terms of service
│   ├── privacy/page.tsx               # Privacy policy
│   ├── globals.css                    # Tailwind + shadcn theme tokens
│   ├── layout.tsx                     # Root layout
│   └── page.tsx                       # Landing page
├── components/
│   ├── nav.tsx                        # Nav + sign-out (DELETE /api/auth)
│   ├── turnstile.tsx                  # Turnstile widget (client, env-gated)
│   └── ui/                            # shadcn/ui (accordion, button, card, input, label)
├── lib/
│   ├── auth.ts                        # WebCrypto PBKDF2 + JWT (HS256), reset tokens
│   ├── email.ts                       # Resend transactional email
│   ├── env.ts                         # AppEnv type + getEnv() helper
│   ├── nasa-jpl.ts                    # NASA/JPL Horizons API → natal positions
│   ├── sovereign-prompt.ts            # Baseline derivation + system prompt
│   ├── stripe.ts                      # Stripe pricing tiers + webhook verification
│   ├── turnstile.ts                   # verifyTurnstileToken (env-gated)
│   ├── types.ts                       # Shared TypeScript types
│   ├── utils.ts                       # cn() class merger
│   └── *.test.ts                      # Vitest unit tests (auth, stripe, sovereign-prompt)
└── middleware.ts                      # Auth gate: public routes, 401 JSON / redirect
```

## Notes

- Routes run in the Cloudflare Workers runtime via the OpenNext adapter (compatibility flag `nodejs_compat`; no explicit `runtime = "edge"` exports).
- Passwords are hashed with PBKDF2 (100k iterations, SHA-256) via the WebCrypto API; login is rate-limited (10 attempts / 5 min per IP+email) and thread chat is capped for free tier (5 msgs/day, KV-backed).
- JWT session tokens are stored in an httpOnly, Secure, SameSite=Lax cookie (7-day expiry) and verified on every API call via middleware + route guards.
- The chat route verifies the AI Gateway call and falls back to a direct Workers AI call if the gateway is unavailable. Responses stream as Server-Sent Events (SSE) and persist to D1 threads.
- The chat route windows conversation context to the most recent 20 messages (`MAX_CONTEXT_MESSAGES`) before inference, capping token spend while full history remains stored in D1.
- The `GET /api/threads` list is paginated (`page`/`limit`, default 50, max 50) and returns `{ threads, total, page, pageSize }`; the `?id=` detail lookup is unchanged.
- All routes set security headers (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy) plus a CSP in `next.config.ts`.
- The baseline is computed server-side against the NASA/JPL Horizons API; raw data and derived astrology/numerology/Human Design fields are stored in D1.
- The AI's system prompt is a "Pattern Interruption" directive: non-clinical, evidence-separated (Observed / Baseline-supported / Interpretive / Unknown), with four levels of inquiry.
- Transactional emails are sent from `info@sovereign.os` via Resend (console-log fallback if `RESEND_API_KEY` is unset).
- Observability is enabled in `wrangler.jsonc` with head sampling at rate 0.1 (10% of traces).
- `npm audit` reports 1 high + 1 moderate advisory from the `postcss` bundled inside `next` (build-time only). They can only be cleared by upgrading to Next 16 (breaking); the app currently stays pinned on Next 15.5.x.
- This project intentionally has no `open-next.config.ts` `buildCommand`: OpenNext runs `npm run build` internally, and overriding it causes infinite build recursion.