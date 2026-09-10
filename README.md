# production.os — Sovereign OS

A fullstack Next.js app deployed on Cloudflare Workers via the OpenNext adapter.
Baseline engine uses the NASA/JPL Horizons API for natal chart computation.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router + Tailwind CSS + shadcn/ui |
| Adapter | `@opennextjs/cloudflare` (OpenNext) |
| Runtime | Cloudflare Workers (edge) |
| Database | Cloudflare D1 (SQLite) |
| Sessions | Cloudflare KV (`SESSION_KV`) |
| AI Inference | Workers AI (`@cf/meta/llama-3.1-8b-instruct`) |
| AI Routing | AI Gateway (ID: `sovereign-ai-gateway`) |
| Baseline Engine | NASA/JPL Horizons API (planetary positions) |
| Auth | Email/Password + WebCrypto PBKDF2 + JWT |
| Payments | Stripe (Free vs Sovereign+ monthly/annual) |

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
```

### 5. Generate Cloudflare types

```bash
npm run cf-typegen
```

### 6. Dev / Build / Deploy

```bash
npm run dev       # Next.js dev server (local)
npm run build     # Build with OpenNext for Workers
npm run preview   # Preview in Workers runtime (workerd)
npm run deploy    # Deploy to Cloudflare edge
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/route.ts              # Email/password auth + JWT sessions
│   │   ├── baseline/route.ts          # TOB/POB/DOB → NASA/JPL natal positions
│   │   ├── chat/route.ts              # SSE streaming chat via Workers AI + AI Gateway
│   │   ├── threads/route.ts           # Chat history CRUD (persist to D1)
│   │   └── webhooks/stripe/route.ts   # Stripe webhook → subscription_tier
│   ├── chat/page.tsx                 # Chat UI with baseline data accordion + thread history
│   ├── onboard/page.tsx              # Birth data intake form
│   ├── globals.css                   # Tailwind + shadcn theme tokens
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Landing page
├── components/ui/                     # shadcn/ui (accordion, button, card, input, label)
├── lib/
│   ├── auth.ts                       # WebCrypto PBKDF2 + JWT
│   ├── email.ts                      # Transactional email (from info@sovereign.os)
│   ├── env.ts                        # Self-contained AppEnv type + getEnv() helper
│   ├── nasa-jpl.ts                   # NASA/JPL Horizons API → natal positions
│   ├── stripe.ts                     # Stripe pricing tiers + webhook verification
│   ├── types.ts                      # Shared TypeScript types
│   └── utils.ts                      # cn() class merger
```

## Notes

- All API routes use `export const runtime = "edge"` for the Workers runtime.
- Passwords are hashed with PBKDF2 (100k iterations, SHA-256) via the WebCrypto API.
- JWT session tokens are stored in an httpOnly cookie and verified on every API call.
- The chat route streams Workers AI responses as Server-Sent Events (SSE).
- The baseline is computed server-side using the NASA/JPL Horizons API.
- Chat history is persisted to D1 threads and hydrated on page load.
- The AI's system prompt is a "Pattern Interruption" directive.
- Transactional emails are sent from `info@sovereign.os`.
