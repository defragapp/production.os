# Cloudflare Readiness — Security, Trust & Scale

Audience: the platform owner + any Cloudflare-side agent. Purpose: a single,
prioritized map of what is **already built in code**, what must be **enabled in
the Cloudflare dashboard** (the Workers deploy token cannot write security
settings), and what to add before Sovereign OS takes public traffic — including
the media-spike scenario where visitor and signup volume jump ~100× for hours.

Everything recommended here is available on the **Free** plan unless noted.

> **Companion doc:** [`scaling-plan.md`](./scaling-plan.md) is the operational twin
> of this readiness map — it records what has actually been applied via the API
> token, the current free-plan ceilings, a thresholds→action matrix, the upgrade
> ladder, and ready-to-paste prompts for Cloudflare agent "Lee" for the moment
> traffic approaches a limit.

- Account ID: `8b1954d216d65077c6480d62583fe2c2`
- Worker: `production-os` · Zone: `defrag.app` · App origin: `sovereign.defrag.app`
- D1: `production-os-db` · KV: `SESSION_KV` · AI Gateway: `sovereign-ai-gateway`

---

## 1. What is already in place (no action needed)

| Layer | Already done | Where |
|---|---|---|
| Auth | Passkey-first + password, PBKDF2+pepper, httpOnly JWT, server-side gates | `docs/auth.md` |
| Bot check | Turnstile best-effort on signup **and** login (strict toggle ready) | `src/lib/turnstile.ts` |
| Rate limiting | KV counters: login 10/5min per IP+email, passkey-auth, checkout 10/hr | `src/app/api/auth/**` |
| Transport | HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, strict CSP | `next.config.ts` |
| Edge | Everything proxied through Cloudflare (Orange cloud) via the custom domain | `wrangler.jsonc` route |
| Observability | Workers Logs enabled (10% head sampling) | `wrangler.jsonc` |
| Web analytics | Cookieless Cloudflare Web Analytics beacon | `src/components/web-analytics.tsx` |

The Workers runtime itself is the scale story: it auto-scales to the request
rate with **no capacity planning** — a media spike does not require "adding
servers." The real limits are **D1 writes, KV/AI cost, and abuse surface**, so
that is what this plan focuses on.

---

## 2. Enable in the dashboard NOW (owner / "Lee" action)

These need a token with **Zone → Security:Edit** (or the dashboard). The project's
wrangler OAuth token is Workers-scoped only (zone **read**), so I cannot apply
them from here.

### 2.1 Bot Fight Mode (free, one toggle)
Zone → **Security → Bots → Bot Fight Mode: ON**.
Blocks the mass commodity-bot traffic before it reaches the Worker. Note: the
**free** plan only offers legacy Bot Fight Mode (detects known bad bots);
**Super Bot Fight Mode** (custom bot rules, verified-bot allowlisting) is
Pro/Business. Legacy BFM is enough for launch.

### 2.2 A managed ruleset (free WAF)
Zone → **Security → WAF → Managed rules** → enable the **Cloudflare Managed
Rules** + **OWASP Core** (free tier exposes a curated subset). This catches
common web attacks at the edge for $0.

### 2.3 Rate-limiting rule on the auth endpoints (free: 1 rule)
Zone → **Security → WAF → Rate limiting rules → Create**. The free plan allows
**one** rate-limit rule, so scope it to the paths that matter:

- Field: `URI Path` → **does not equal** … use **contains** `/api/auth`
- With characteristics: `IP Source Address`
- When requests **exceed 20 per 60 seconds** → action **Block** (challenge) for the window.

This sits **in front of** the KV limiter: it sheds scripted floods at the edge
(cheaper, faster) while the in-app KV limiter stays the precise per-account
backstop. Keep the value generous enough to never hit a real human.

Copy-paste for "Lee" (needs a Zone-security-edit token; `${ZONE_ID}` from
`GET /zones?name=defrag.app`):

```bash
curl -X POST https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets \
  -H "Authorization: Bearer ${CF_TOKEN}" -H "Content-Type: application/json" \
  --data '{
    "name": "sovereign-auth-shield",
    "phase": "http_ratelimit",
    "rules": [{
      "action": "block",
      "expression": "(http.request.uri.path contains \"/api/auth\")",
      "description": "Shield signup/login/passkey endpoints from scripted floods",
      "ratelimit": {
        "characteristics": ["ip.src"],
        "period": 60,
        "requests_per_period": 20,
        "mitigation_timeout": 300,
        "mitigation_extensions": { "responses": ["challenge"] }
      }
    }]
  }'
```

### 2.4 Misc zone hygiene (free)
- **Security → Settings → Security Level: I'm Under Attack** *only during* a
  spike; normally **Medium** / **Essentially Off**.
- **Speed → Optimization → Rocket Loader**: optional (can defer the Turnstile
  script — test if enabled). Leave **Off** for launch to avoid surprising the
  Turnstile loader timing.
- **SSL/TLS → Full (strict)**, **Always Use HTTPS: ON**, **Min TLS: 1.2**.
- Turn on **DNSSEC** for `defrag.app` (free) — strengthens domain/DNS trust.

---

## 3. Recommended Cloudflare additions (prioritized)

### P0 — protects money + the AI bill during a spike
1. **AI Gateway caching + rate-limit + logging** (already routed through
   `sovereign-ai-gateway`). Add a **cache rule** (even a short TTL for
   identical prompts) and a **per-key rate limit**. This directly caps Workers AI
   spend — the single most important control before going public, because every
   chat is a metered AI call. Configure in **Zero Trust → AI Gateway → your
   gateway → Caching / Rate Limiting / Logging**.
2. **Budget / spend alerts** on Workers AI and on the account (billing alerts).
   Non-technical but the highest-leverage guardrail against a viral-day bill.

### P1 — resilience under load
3. **Queues (free tier)** to decouple slow, spiky work from request latency:
   verification/welcome emails and any heavy AI fan-out. A signup burst should
   enqueue email, not block the request or retry-storm Resend. The token already
   has `queues: write`, so I can provision these from here when we wire it up.
4. **D1 read replicas / caching hot reads.** The app already caches the daily
   usage counter in KV. Keep reads off D1 where possible; D1 free tier is
   generous on reads but write-limited — signup bursts are writes, so the AI
   Gateway/queue buffering above matters more than DB tuning right now.
5. **Static asset caching.** Next/OpenNext emits hashed `_next/static` assets;
   confirm long `Cache-Control` (immutable) so the edge serves the JS/CSS during
   a spike (the beacon + images should be cache hits, not origin hits).

### P2 — trust & visibility
6. **Turnstile strict mode** — flip `TURNSTILE_REQUIRED=true` only after we
   confirm the widget loads for the real audience (see `docs/auth.md §6`). Once
   passkeys carry most logins, keep Turnstile best-effort on those paths.
7. **Real User Monitoring (RUM)** in Cloudflare Zero Trust — free, gives Core
   Web Vitals from real visitors during the spike (when you most want to see it).
8. **Security Analytics** (free, from BFM/WAF/managed rules) — confirms what the
   rules are actually blocking. **Firewall Events** log for audit.
9. **Page Shield** — paid add-on; revisit only if client-side skimming of the
   Stripe fields becomes a concern. Checkout uses **Stripe-hosted fields**
   (`js.stripe.com`), so raw card data never touches our origin — Page Shield is
   a nice-to-have, not a launch blocker.
10. **Logpush / Observability analytics tables** for the Workers logs if we want
    long-retention dashboards (free tier is limited; fine to defer).

### Deliberately NOT used
- **Cloudflare Access / Zero Trust identity for app users** — wrong tool for a
  public consumer app (it gates a private network, not per-user accounts). Our
  per-user auth + passkeys is the right model. (See `docs/auth.md §2`.)
- **Workers AI guardrails beyond what we built** — the sovereign safety/reasoning
  layer is app-side by design; keep model policy in code, use AI Gateway only for
  cost/routing/observability.

---

## 4. Media-spike playbook (the scenario you flagged)

> The step-by-step operational version (thresholds, monitoring, and the exact
> Lee prompts) lives in [`scaling-plan.md`](./scaling-plan.md). This section is the
> strategic summary; that one is what you hand an agent mid-spike.

The architecture is already edge-native, so the plan is about **cost + abuse +
perceived latency**, not server capacity:

- **Before:** AI Gateway cache + rate limit ON (§3.1); billing alert ON (§3.2);
  BFM + managed rules + auth rate limit ON (§2); Turnstile best-effort so it can
  never hard-block a real rush; checkout + signup paths already throttled.
- **During:** Security Level → Under Attack if a bot swarm rides the press wave;
  watch AI Gateway spend + RUM in real time; D1 has headroom (reads), KV absorbs
  counters. No redeploy needed to scale traffic.
- **After:** review Security Analytics (what was blocked), Firewall Events, and
  the AI spend report; keep any tightened rules that didn't hurt real users.

---

## 5. Suggested execution order

1. **§2 now** (dashboard): BFM, managed rules, the one auth rate-limit rule, TLS
   & DNSSEC hygiene. — *owner/Lee, ~15 min, $0*
2. **§3.1–3.2** (this week): AI Gateway caching + rate limit + logging, billing
   alerts. — *highest cost-protection ROI before publicity*
3. **§3.3 Queues** for email/AI fan-out — *I implement in code when greenlit.*
4. **§3.6 Turnstile strict** — *after we see real-audience widget success.*
5. **§3.7 RUM** — *before the announcement, so we have data on day one.*

Nothing here changes the app's privacy stance: every addition is either at the
edge or metered server-side, and no new cookies or third-party trackers are
introduced.
