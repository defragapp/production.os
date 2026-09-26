# Scaling & Operations Runbook — Sovereign OS on Cloudflare (Free → Paid)

**Audience:** the platform owner + any Cloudflare-side AI agent ("Lee").
**Purpose:** a single operational twin to [`cloudflare-readiness.md`](./cloudflare-readiness.md).
Readiness explains *what to enable*; this runbook explains *how much headroom we
have today, what to watch, at what number to act, and the exact commands/prompts
to hand a Cloudflare agent the moment a media spike or revenue growth pushes us
toward the free-plan ceiling.*

Sovereign OS launches entirely on the **Cloudflare Free** plan. The Workers
runtime auto-scales traffic with **no capacity planning** — a press spike does
**not** mean "add servers." The real first ceilings are **cost + abuse +
per-capita metered limits** (AI neurons, D1 writes, KV writes, Worker requests).
This doc is the ladder from "free and fine" to "paid and unbothered."

- Account ID: `8b1954d216d65077c6480d62583fe2c2`  (name: *Sovereign.os Platform Build*)
- Worker: `production-os` · Zone: `defrag.app` (`45a59d754ece9221fc97c92c461eb01f`) · App origin: `sovereign.defrag.app`
- D1: `production-os-db` · KV: `SESSION_KV` · Workers AI model: `@cf/meta/llama-3.1-8b-instruct-fp8` via AI Gateway `sovereign-ai-gateway`
- API token: stored **gitignored** in `.dev.vars` as `CF_API_TOKEN` (+ `CLOUDFLARE_ACCOUNT_ID`). **Never commit or echo its value.** Referenced below by name.

> All free-plan figures below were refreshed from Cloudflare's docs (pages last
> updated **2026-09-26**, re-verified against this build's `DEFAULT_MAX_TOKENS =
> 1024` and `FREE_TIER_DAILY_LIMIT = 5`). Plans change — verify against the live plan in
> **dash.cloudflare.com → Account → Overview / your Worker → Metrics** before
> acting on a number here. Sources: Workers `platform/limits`, D1 `platform/limits`
> + `platform/pricing`, KV `platform/limits`, Workers AI `platform/pricing`.

---

## 1. Current free-plan ceilings (the wall chart)

| Resource | Free limit | What hitting it looks like | Workers Paid |
|---|---|---|---|
| **Worker requests** | **100,000 / day** (resets 00:00 UTC) | HTTP **Error 1027** to visitors | No daily cap |
| **Worker CPU / invocation** | **10 ms** | **Error 1102** "exceeded resource limits" on heavy routes | 5 min (default 30 s) |
| Worker memory / isolate | 128 MB | Error 1102 (`exceededMemory`) | 128 MB (same) |
| Worker subrequests / invocation | **50** | Error 1102 on fan-out paths | 10,000 (up to 10M) |
| **Workers AI** | **10,000 Neurons / day** (free allocation) | AI calls error out; chat fails even though the Worker is fine | 10,000/day free + **$0.011 / 1,000 Neurons** beyond |
| **D1 rows read** | **5,000,000 / day** | D1 queries return "daily limit exceeded" errors | First 25B / month incl. + $0.001/M |
| **D1 rows written** | **100,000 / day** | Inserts/updates fail (signup, chat persist, counters) | First 50M / month incl. + $1.00/M |
| D1 storage | **5 GB total** (account) | Writes/DDL blocked until cleanup | First 5 GB incl. + $0.75/GB-mo |
| D1 queries / invocation | 50 | Complex reads error | 1,000 |
| D1 databases / account | 10 | Can't create more | 50,000 |
| **KV reads** | **100,000 / day** | Session/counter lookups error → logouts | Unlimited |
| **KV writes** | **1,000 / day** (different keys); **1 / sec** (same key) | New sessions / daily counters / webhook idempotency fail | Unlimited (1/sec/key still applies) |
| KV storage | 1 GB | Puts rejected | Unlimited |
| **WAF rate-limit rules** | **1 rule**, 10 s window, 10 s block | Can't add a 2nd edge rule | More rules, longer windows (up to 24 h), throttling %, more characteristics |
| Bot protection | Legacy **Bot Fight Mode** (free) | Known-bad bots only | Super Bot Fight Mode (custom bot rules, verified-bot allowlist) on Pro+ |
| Turnstile | Unlimited (free) | — | — |
| R2 (if wired later) | 10 GB storage, free ops | Overflow media storage | pay-as-you-go |

### The order we will hit the wall (mental model for a spike)

1. **Workers AI neurons (~10,000/day) — FIRST.** On our model a single chat is
   roughly **21–38 neurons** (13,778 in / 26,128 per 1M tokens — i.e. ~73 input
   tokens and ~38 output tokens per neuron; a ~800-in + ~400-out turn ≈ 21
   neurons, a full-length ~1,024-token answer ≈ 38). Sovereign always sends an
   explicit `max_tokens` of **1,024** (`DEFAULT_MAX_TOKENS` in
   `src/lib/sovereign-model.ts`) so an answer never truncates mid-sentence, which
   raises the worst-case per-turn cost well above the old ~400-token assumption.
   That is only **~250–450 free AI completions per day** (≈260 if every reply runs
   to the 1,024-token ceiling; ≈475 for short ~400-token replies). The earlier
   "~400–500" figure assumed a ~400-token output cap and now **over-states
   headroom** — plan against the low end. A few hundred enthusiastic users, or a
   bot swarm hammering `/api/chat`, exhausts this *long before* 100k requests.
   → **AI Gateway caching + a tight per-identity rate limit is the single
   highest-value guardrail** (see §3, §4).
2. **D1 writes (100k/day)** — every signup, chat-message persist, and counter
   bump writes rows. A signup burst of a few thousand is fine; a bot-driven mass
   signup is not. BFM + the auth rate-limit rule + Turnstile are the mitigation.
   On the chat path specifically, the idempotent transcript merge
   (`mergeChatHistories` in `src/lib/chat-history.ts`) keeps the stored
   `message_history` blob growing **linearly** with the conversation: a previous
   merge that only compared against the stored tail re-appended the entire prior
   exchange on every turn, so each per-turn `UPDATE` wrote a quadratically
   bloated blob. That write amplification is gone — one bounded UPDATE per turn.
3. **KV writes (1,000/day diff keys)** — sessions, passkey challenges, webhook
   idempotency, dunning counters, tier-sync stamps. This is **low**; a busy day
   can approach it. Watch it; consider consolidating counters if it trends up.
4. **Worker requests (100k/day)** and **KV reads (100k/day)** — high, unlikely
   first, but the media-spike "everyone loads the page" counter.
5. **CPU 10 ms/invocation** — the SSR + PBKDF2 login path is the heaviest; login
   is CPU-bound (100k PBKDF2 iterations). A login flood could throw 1102s. Passkeys
   (WebAuthn) sidestep PBKDF2 entirely, which is part of why they're first-class.

---

## 2. Monitoring — knowing where we are *before* the wall

| Signal | Where to look | Grab it programmatically |
|---|---|---|
| Worker requests, CPU, errors (1027/1102) | dash → Workers → `production-os` → **Metrics** | GraphQL **Analytics Engine / Metrics & Analytics API** |
| Workers AI neuron usage | dash → **Workers AI** (Neuron usage chart) | `GET /accounts/{ACC}/ai/gateway/...` usage or model analytics |
| D1 rows read/written + size | dash → D1 → `production-os-db` → **Metrics → Row Metrics** | each query's `meta.rows_read/rows_written`; GraphQL API |
| KV reads/writes | dash → Storage & Databases → **KV → SESSION_KV → Metrics** | account-level metrics |
| What WAF/BFM is blocking | dash → Zone → **Security → Events / Analytics** | `GET /zones/{Z}/security/events` |
| Spend blowout | dash → **Account → Billing → Usage + set a spend/budget alert** | dashboard-only |

**Early-warning posture:** set a Cloudflare **billing alert** the moment we move
to Paid, and check the four dashboards above **daily during any publicity window**.
The three numbers that matter most on free: **AI neurons, D1 writes, KV writes.**

"Report current usage vs free limits" is the #1 Lee prompt in §6 — run it at the
first sign of traction and again mid-spike.

---

## 3. Thresholds → action matrix

Percentages are of the **free** ceiling. "Upgrade" = enable Workers Paid (billing
on) — a plan change, **not a code change** (see §5).

| Resource | ~70% (headroom thinning) | ~90% (act now) | 100% / breach (emergency) |
|---|---|---|---|
| **AI neurons** | Turn **AI Gateway caching** ON; raise the in-app free daily limit only if converting; watch for bots | Tighten AI Gateway per-IP rate limit; enable response caching TTL; consider short free-tier cap in app | Temporarily disable AI on unverified emails; upgrade to Paid (neurons become pay-as-you-go, $0.011/1k) |
| **D1 writes** | Confirm no bot signups (Security Events); ensure email verification gating is on | Turnstile **strict** (`TURNSTILE_REQUIRED=true`) on signup; tighten auth rate-limit | Mass-signup flood → Zone → **Under Attack** mode; upgrade Paid (writes become billed, uncapped) |
| **KV writes** | Audit new key fan-out (idempotency/dunning stamps); batch/consolidate counters | Raise TTLs / reuse keys; move chatty counters to D1 or in-isolate | Upgrade Paid |
| **Worker requests** | Verify static assets are cache hits (hashed `_next/static`) | Add cache rules for anonymous pages | Upgrade Paid (no daily cap) |
| **CPU 10ms** | Profile the login path; keep passkey-first (no PBKDF2) | Raise per-route work off the request (Queues for email) | Upgrade Paid → 30s–5min CPU |
| **WAF rules** | — | Consolidate into the 1 free rule (done: auth+chat) | Upgrade → more rules + longer windows |

The **in-app** free-tier gate (`src/lib/limits.ts`, `FREE_TIER_DAILY_LIMIT = 5`
enforced by a KV counter in `src/app/api/chat/route.ts`) already caps AI spend per
user per day. That is the first line of defense against neurons (§1.1); the edge
controls above are the second.

---

## 4. What is ALREADY configured (this runbook's baseline)

Applied during launch prep via `CF_API_TOKEN` (account + zone-security write).
Re-runnable; all idempotent.

| Control | State | How |
|---|---|---|
| **Always Use HTTPS** | ✅ `on` | `PATCH /zones/{Z}/settings/always_use_https` |
| **Min TLS** | ✅ `1.2` | `PATCH .../settings/min_tls_version` |
| **Security Level** | ✅ `high` (left stricter than the planned `medium`) | `PATCH .../settings/security_level` |
| **WAF rate-limit rule** | ✅ 1 free rule: `(path contains "/api/auth" or path == "/api/chat")`, 20 req / 10 s, block 10 s, `cf.colo.id`+`ip.src` | `PUT /zones/{Z}/rulesets/{RS_ID}` (ruleset `Sovereign Rate Limits`, id `39c1ece9d26446179d81f0d792d9346a`) |
| **DNSSEC** | 🟡 enabled, **status `pending`** — DS record created, not yet at registrar | see §4.1 |
| **Custom firewall rules** | ✅ present ("Sovereign Security Rules": block high threat score / confirmed bots, CVE-2025-29927 block, verified-bot skip) | pre-existing |
| **Bot Fight Mode (free)** | ⚠️ **dashboard only** — the legacy `settings/bots` API is retired on this zone (no bot-named zone setting exists). Toggle at **Zone → Security → Bots → Bot Fight Mode: On**. | §4.2 |
| **AI Gateway caching + rate limit** | ⚠️ **not reachable via this token** — `/accounts/{ACC}/ai/gateway/*` returns "No route for that URI". Configure at **Zero Trust → AI Gateway → `sovereign-ai-gateway`** (or a token scoped for AI Gateway). | §4.3 |
| **Stripe receipt/invoice emails** | ⚠️ **Stripe dashboard**, not Cloudflare | §4.4 |

### 4.1 Finish DNSSEC (owner, one-time at the registrar)
Cloudflare already generated the DS record for `defrag.app`; register it at your
domain registrar to move DNSSEC from `pending` → `enabled`:
- **Algorithm:** 13 (ECDSAP256SHA256) · **Digest type:** 2 (SHA256)
- **DS record:** `defrag.app. 3600 IN DS 2371 13 2 E1250818CF27B66AED4CDEEDAF5BF510107C3E3118B03DDB410FB8EC41E0E664`
- Zone NS: `rudy.ns.cloudflare.com`, `vida.ns.cloudflare.com` (already fully on Cloudflare).
Lee prompt: *"Report DNSSEC status for zone defrag.app and confirm whether the DS
record is still pending registrar registration."*

### 4.2 Bot Fight Mode (dashboard, $0)
**Zone → Security → Bots → Bot Fight Mode → On.** Free BFM catches known-bad
commodity bots before they hit the Worker (protects D1 writes + AI neurons).
Super Bot Fight Mode (custom bot rules / verified-bot allowlisting) is Pro+ —
revisit if a spike brings sophisticated scrapers.

### 4.3 AI Gateway — the #1 cost guardrail (dashboard or AI-Gateway-scoped token)
For gateway `sovereign-ai-gateway` enable:
- **Response caching** (cache identical prompts; even a short TTL on the baseline
  prompts saves neurons).
- **Rate limiting** per identity/IP (a tight ceiling on completions).
- **Logging** + **Unified billing** optional (prepaid credits raise model rate limits).
Nav: **Zero Trust (one.dash) → AI → AI Gateway → `sovereign-ai-gateway` →
Caching / Rate limiting / Logging.** If you mint a token with **Account → AI
Gateway → Edit**, Lee can do it via API (see §6 prompt, which includes the
`PUT .../ai/gateway/configurations/{id}/cache/settings` and `/ratelimit/settings`
calls).

### 4.4 Stripe emailed receipts (Stripe dashboard, $0)
**Stripe → Settings → Emails →** enable **receipts** and **subscription-invoice**
emails. This is belt-and-suspenders: the app already sends branded
`payment-received` / `payment-failed` / `subscription-canceled` emails from the
webhook (`src/app/api/webhooks/stripe/route.ts`, `src/lib/email.ts`), so revenue
confirmation survives even if this toggle is off.

---

## 5. Upgrade ladder (the "money arrived" path)

Most free limits are lifted **the moment you add a payment method and enable
Workers Paid** — it is a plan toggle in the dashboard, **no redeploy, no code
change**. Concretely:

| Step | Cost | Unlocks | What changes for Sovereign |
|---|---|---|---|
| **Workers Paid** | $5/mo + usage | 100k req/day cap removed, CPU→5min, subrequests→10k, D1 rows billed-not-blocked, KV reads/writes unlimited, AI neurons billed beyond 10k/day | **Do this first at the first sustained spike.** Eliminates 1027/1102/D1-block failures. |
| **Zone Pro (~$20/mo)** | per-zone | **Super Bot Fight Mode**, more WAF rules/features, image resizing, mobile SDK | Only if bots outgrow free BFM / you need richer WAF. |
| **R2 (pay-as-you-go)** | storage+ops | Overflow media/blob storage without egress fees | Wire the staged R2 creds (`.dev.vars`) if you ever store generated assets. |
| **Queues / DO / Vectorize** | usage | Decouple spiky work (email, AI fan-out) | Implement in code when greenlit (readiness doc §3.3). |

**Migration is additive, not disruptive.** Enabling billing raises ceilings
in-place; nothing is re-provisioned. When you upgrade, also:
1. Turn on a **billing/spend alert** (Account → Billing → Budgets/alerts).
2. Re-check the threshold matrix (§3) — the "action" for each row becomes "raise
   the app's `FREE_TIER_DAILY_LIMIT` / add AI Gateway budget," not "panic."
3. Keep the free-tier in-app gate anyway — it's your margin, not just a limit.

**Lee prompt:** *"Prepare this account to upgrade from Workers Free to Workers
Paid and confirm which of D1, KV, and Workers AI limits are raised immediately
versus require a per-service setting."*

---

## 6. "Agent Lee" prompt library (copy-paste the moment limits bite)

Context to give Lee once (never paste the token itself — tell Lee to read it from
the local `.dev.vars` / env; **do not echo its value**):

> **Standing context for Lee**
> Cloudflare Account `8b1954d216d65077c6480d62583fe2c2`; Worker `production-os`;
> Zone `defrag.app` (id `45a59d754ece9221fc97c92c461eb01f`); app origin
> `sovereign.defrag.app`; D1 `production-os-db`; KV namespace `SESSION_KV`;
> AI Gateway `sovereign-ai-gateway`; model `@cf/meta/llama-3.1-8b-instruct-fp8`.
> Authenticate with `CF_API_TOKEN` from `.dev.vars`. All calls use
> `https://api.cloudflare.com/client/v4` with header
> `Authorization: Bearer $CF_API_TOKEN`.

Then, per situation:

**A. "Report current usage vs free limits"** (run daily during publicity)
> Using the Cloudflare API and dashboard metrics, report for the last 24h and the
> month-to-date: Worker `production-os` request count (vs 100k/day), CPU/invocation
> (vs 10ms), any 1027/1102 errors; D1 `production-os-db` rows read (vs 5M/day), rows
> written (vs 100k/day), total size (vs 5GB); KV `SESSION_KV` reads (vs 100k/day) and
> writes (vs 1,000/day); Workers AI neuron usage (vs 10,000/day). Flag anything ≥70%
> and recommend the matching action from docs/scaling-plan.md §3.

**B. "Raise / edit the WAF rate-limit"** (the existing free ruleset is `Sovereign Rate Limits`)
> Update the zone `defrag.app` `http_ratelimit` ruleset (phase entrypoint) so its
> single rule blocks `(http.request.uri.path contains "/api/auth" or
> http.request.uri.path eq "/api/chat")` at [N] requests per 10s with a [M]s block,
> characteristics `cf.colo.id` and `ip.src`. Use `PUT
> /zones/45a59d754ece9221fc97c92c461eb01f/rulesets/{ruleset_id}` (POST is not allowed
> for in-place edits; `cf.colo.id` is mandatory). On Workers Paid, extend the window
> toward the 20 req / 60s originally intended.

**C. "Enable AI Gateway caching + tighten rate limit"** (needs AI-Gateway token scope)
> For AI Gateway `sovereign-ai-gateway` on account `8b1954d216d65077c6480d62583fe2c2`,
> enable response caching (`PUT .../ai/gateway/configurations/sovereign-ai-gateway/cache/settings`
> `{"cache":{"max_age":3600,"stale_while_revalidate":86400}}`) and a per-IP rate limit
> (`.../ratelimit/settings`) sized to keep daily neuron use under [budget]. Confirm
> the Worker's AI binding routes through this gateway id.

**D. "Toggle Under Attack for a window"** (bot swarm on a press day)
> Set Zone `defrag.app` **Security Level → I'm Under Attack** now (`PATCH
> /zones/45a59d754ece9221fc97c92c461eb01f/settings/security_level {"value":"under_attack"}`),
> and schedule/remember to return it to `high` after [window]. Warn that this adds a
> interstitial JS challenge to all visitors.

**E. "Set a spend/budget alert at $X"** (dashboard)
> Walk me through creating an Account billing alert at $[X]/month on Workers AI and
> overall usage, so a viral day pages me before the bill does.

**F. "Turn on Bot Fight Mode"** (dashboard — API retired on free zone)
> In Zone `defrag.app` → Security → Bots, enable **Bot Fight Mode**. Confirm in
> Security → Events that known bots are being challenged, and report which paths they
> were hitting.

**G. "Upgrade to Workers Paid"** (see §5)
> Confirm the account is ready to enable Workers Paid: which limits lift immediately
> and whether any per-service (D1/KV/AI) setting must also change. Then list the
> post-upgrade checklist from docs/scaling-plan.md §5.

> **Secrets discipline for every Lee task:** load `CF_API_TOKEN` from `.dev.vars`;
> never print it, never write it into a committed file, never include it in a
> screenshot or log. The value is a live service token and rotation is a dashboard
> action.

---

## 7. Media-spike playbook (operational twin of readiness §4)

- **Before going public:** §4.2 BFM On · §4.3 AI Gateway caching+rate limit On ·
  billing alert On (§6E) · verify the auth+chat rate-limit rule is live (§4) ·
  keep Turnstile best-effort so a real rush is never hard-blocked · confirm
  `FREE_TIER_DAILY_LIMIT` is a sane per-user ceiling.
- **During a spike:** watch AI neurons + D1 writes first (§2); flip **Under Attack**
  (§6D) if a bot swarm rides the wave; if any 1027/1102/D1-block appears, enable
  **Workers Paid** immediately (§5) — it is a plan toggle, not a redeploy.
- **After:** review Security Events (what was blocked), the AI spend report, and KV
  write volume; keep the rules that didn't hurt real users; raise the in-app free
  limit if conversion looks strong.

---

## 8. Follow-ups deliberately deferred (not silent)
- **Queues for email/AI fan-out** — the token has `queues:write`; implement in code
  when greenlit (readiness §3.3). A signup burst should enqueue Resend calls, not
  retry-storm them.
- **R2 overflow storage** — creds staged in `.dev.vars`, unused; wire only if we
  start generating/storing media.
- **Turnstile strict mode** — flip `TURNSTILE_REQUIRED=true` (env only, no secret
  rotation) after the passkey device test passes (auth doc §6).
- **KV write consolidation** — if KV writes trend toward 1,000/day, batch the daily
  usage counter and idempotency stamps.

Nothing here changes the privacy stance: every control is at the edge or metered
server-side; no new cookies or third-party trackers are introduced.
