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

### 4. Set secrets

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
```

### 5. Generate Cloudflare types

```bash
npm run cf-typegen
```

### 6. Local dev / build / preview / deploy

```bash
npm run dev        # Next.js dev server (local)
npm run build      # Plain Next.js build (OpenNext runs this internally)
npx opennextjs-cloudflare build   # OpenNext compiler → .open-next/ (what CI runs)
npm run preview    # OpenNext build + preview in Workers runtime (workerd)
npm run deploy     # OpenNext build + deploy to Cloudflare edge
```

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
│   │   ├── auth/route.ts              # POST login/signup, GET session, DELETE logout
│   │   ├── auth/reset/route.ts        # POST password reset (email via Resend)
│   │   ├── baseline/route.ts          # GET/POST natal baseline (NASA/JPL Horizons)
│   │   ├── chat/route.ts              # SSE streaming chat via Workers AI + AI Gateway
│   │   ├── threads/route.ts           # Chat history CRUD (persist to D1)
│   │   └── webhooks/stripe/route.ts   # Stripe webhook → subscription_tier
│   ├── account/page.tsx               # Account management
│   ├── baseline/page.tsx              # Baselines list
│   ├── chat/chat-client.tsx           # Chat client component (streaming, threads)
│   ├── chat/page.tsx                  # Chat page (server wrapper around ChatClient)
│   ├── onboard/page.tsx               # Birth data intake form + login/signup
│   ├── upgrade/page.tsx               # Paywall → Stripe Checkout
│   ├── terms/page.tsx                 # Terms of service
│   ├── privacy/page.tsx               # Privacy policy
│   ├── globals.css                    # Tailwind + shadcn theme tokens
│   ├── layout.tsx                     # Root layout
│   └── page.tsx                       # Landing page
├── components/
│   ├── nav.tsx                        # Nav + sign-out (DELETE /api/auth)
│   └── ui/                            # shadcn/ui (accordion, button, card, input, label)
├── lib/
│   ├── auth.ts                        # WebCrypto PBKDF2 + JWT (HS256), reset tokens
│   ├── email.ts                       # Resend transactional email
│   ├── env.ts                         # AppEnv type + getEnv() helper
│   ├── nasa-jpl.ts                    # NASA/JPL Horizons API → natal positions
│   ├── sovereign-prompt.ts            # Baseline derivation + system prompt
│   ├── stripe.ts                      # Stripe pricing tiers + webhook verification
│   ├── types.ts                       # Shared TypeScript types
│   └── utils.ts                       # cn() class merger
└── middleware.ts                      # Auth gate: public routes, 401 JSON / redirect
```

## Notes

- Routes run in the Cloudflare Workers runtime via the OpenNext adapter (compatibility flag `nodejs_compat`; no explicit `runtime = "edge"` exports).
- Passwords are hashed with PBKDF2 (100k iterations, SHA-256) via the WebCrypto API; login is rate-limited (10 attempts / 5 min per IP+email) and thread chat is capped for free tier (5 msgs/day, KV-backed).
- JWT session tokens are stored in an httpOnly, Secure, SameSite=Lax cookie (7-day expiry) and verified on every API call via middleware + route guards.
- The chat route verifies the AI Gateway call and falls back to a direct Workers AI call if the gateway is unavailable. Responses stream as Server-Sent Events (SSE) and persist to D1 threads.
- The baseline is computed server-side against the NASA/JPL Horizons API; raw data and derived astrology/numerology/Human Design fields are stored in D1.
- The AI's system prompt is a "Pattern Interruption" directive: non-clinical, evidence-separated (Observed / Baseline-supported / Interpretive / Unknown), with four levels of inquiry.
- Transactional emails are sent from `info@sovereign.os` via Resend (console-log fallback if `RESEND_API_KEY` is unset).
- Observability is enabled in `wrangler.jsonc` (traces at head sampling rate 1.0).