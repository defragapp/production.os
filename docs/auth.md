# Authentication & Security Model

This document describes how Sovereign OS authenticates users, protects
credentials, and binds each account to its Baseline data — and why each choice
was made for a public app running entirely on Cloudflare Workers.

For the AI/reasoning pipeline see [`ai-system.md`](ai-system.md).

---

## 1. Design constraints

- **Runs on Cloudflare Workers (workerd).** Every primitive must exist in the
  Workers WebCrypto runtime, not just Node. This is the source of the single
  biggest gotcha below (§4).
- **Free Cloudflare account.** Prefer first-party, zero- or no-cost platform
  features (Workers, D1, KV, Turnstile, Web Analytics, AI Gateway) over managed
  identity vendors.
- **Personal, sensitive data.** The Baseline (natal chart + derived
  personality/communication model) and chat history are intimate. Privacy is a
  product promise, so the threat model weights data confidentiality heavily.
- **Public self-serve signup.** Account creation must never dead-end a real
  human. Availability of the auth entry point is itself a security property.

---

## 2. What "Cloudflare secure auth" does and does not mean here

A common misconception is that Cloudflare Access / Zero Trust should sit in
front of the app as the login. It should not, for this product:

- **Cloudflare Access (Zero Trust)** authenticates visitors to a *whole*
  hostname against an org IdP (Google/Okta/etc.). It is built for private
  dashboards and internal tools. It does **not** give each visitor their own
  account, role, or private data boundary. Sovereign OS is a public consumer
  app where every user owns a personal Baseline — that requires **per-user
  accounts**, which we implement ourselves.
- **Turnstile** is the correct Cloudflare product for the *bot vs human*
  question on a public form. It is wired in (§6), best-effort.
- **Web Crypto API** is the correct Cloudflare primitive for the *crypto*
  (hashing, signing). We use it directly (§4, §5).
- **D1 + KV** are the correct Cloudflare stores for accounts and sessions.

So the Cloudflare-native stack is: **Workers + WebCrypto + D1 + KV + Turnstile +
AI Gateway**. Identity (who each user is) is ours, which is exactly the pattern
for a consumer product.

---

## 3. Account ↔ Baseline binding

`schema.sql` keys everything off the immutable user id (`users.id`, a UUID v4):

```
users (id PK, email UNIQUE, password_hash, password_salt, email_verified, …)
baselines (user_id PK/FK → users.id, nasa_jpl_json_data, …)   -- ON DELETE CASCADE
threads   (id PK, user_id FK → users.id, message_history, …)  -- ON DELETE CASCADE
passkeys  (planned: credential_id PK, user_id FK → users.id, …)
```

A passkey or password is only ever an *unlock mechanism* that resolves to a
`user_id`; the Baseline and threads hang off that id. Authentication therefore
never duplicates or moves the sensitive data — it only proves you may read it.
Session claims carry `{ sub: userId, email }` (§5). Account deletion cascades
the Baseline and threads automatically.

---

## 4. Password hashing (and the Workers PBKDF2 ceiling)

Implemented in [`src/lib/auth.ts`](../src/lib/auth.ts).

**Algorithm:** PBKDF2-HMAC-SHA256, **100,000 iterations**, 16-byte random
per-user salt, then an **HMAC-SHA256 pepper** over the PBKDF2 output.

**Why 100,000 and not OWASP's recommended 600,000:** workerd's WebCrypto
rejects PBKDF2 `deriveBits` with iteration counts above 100,000. Requesting
600k throws `NotSupportedError` at runtime, which surfaced as a silent HTTP 500
on every signup (the client showed a confusing "Unexpected end of JSON input").
It passes local Vitest because Node's WebCrypto allows 600k — a reminder that
crypto limits must be exercised in the *actual* workerd runtime.

**Why a pepper:** 100k PBKDF2 alone is a weaker target than 600k. Adding an
`HMAC-SHA256(PASSWORD_PEPPER, pbkdf2Hex)` keyed layer means a leaked D1 dump is
useless on its own — an attacker needs both the database *and* the Workers
secret. It recovers most of the margin lost to the platform cap at negligible
cost. The peppered digest is what is stored; the raw PBKDF2 hex never hits the
DB for new/updated rows.

**Storage format (versioned, so it can evolve):**

| Format | Example | Meaning |
|---|---|---|
| Peppered (current) | `pbkdf2$100000$pepper$<hmac-hex>` | create/reset/upgrade |
| Un-peppered versioned | `pbkdf2$<iter>$<pbkdf2-hex>` | early rows, pre-pepper |
| Legacy raw hex | `<64-hex>` | earliest rows (assume 100k) |

`verifyPassword` detects the format from the stored string and verifies
accordingly; `passwordNeedsRehash(hash, target, wantPepper)` returns true for
sub-target **or** un-peppered rows, and the login path transparently rewrites
them on successful auth (upgrade-on-login). No outage, no forced resets.

**Secret rotation:** `PASSWORD_PEPPER` must be generated once (e.g.
`openssl rand -hex 32`) and never changed while peppered rows exist — rotation
would break every peppered verification. If it ever must rotate, do it via a
dual-pepper migration keyed by a version tag.

---

## 5. Sessions

- Signed **JWT (HS256)** with the `JWT_SECRET` Workers secret. Payload:
  `{ sub: userId, email, iat, exp }`, **7-day** expiry.
- Delivered as an **httpOnly, Secure, SameSite=Lax** cookie
  (`sovereign_session`). Not readable by JS → XSS cannot mint or steal a
  usable session cookie; SameSite=Lax blunts CSRF on top-level navigations.
- Verified in `src/middleware.ts` (route gate) and again per-route where the
  user row/entitlement is needed. `GET /api/auth` returns the current session.
- No server-side session table: statelessness suits Workers; `SESSION_KV` holds
  only counters/rate-limits and password-reset tokens, not the session itself.

Trade-off (accepted for now): a logout cannot revoke an already-issued JWT
before expiry (mitigated by the short window and `DELETE /api/auth` clearing the
cookie). If instant revocation becomes a requirement, add a small KV denylist
keyed by `jti`.

---

## 6. Turnstile bot protection (best-effort)

Implemented in [`src/lib/turnstile.ts`](../src/lib/turnstile.ts) +
[`src/components/turnstile.tsx`](../src/components/turnstile.tsx).

Turnstile is **defense-in-depth, not a hard gate**:

- Not configured (no site key or secret) → skipped.
- Configured but **no token** → **allowed** by default. The widget can fail to
  load legitimately (content blockers, iOS/Safari ITP, strict networks), and
  hard-blocking those users is a worse failure than a missing bot check. Fallback
  security = the login/signup rate limiter + email verification.
- A token **is** submitted → it must pass `siteverify`, so forged/garbage tokens
  are always rejected regardless of mode.
- Set the `TURNSTILE_REQUIRED="true"` env var to restore strict enforcement
  (a missing token is then rejected) once you confirm the widget loads reliably
  for your real audience.

The client also runs an 8-second fallback timer so a silently-blocked script
resolves to the "continue without it" path instead of an empty, non-working box.

**Widget config** (Cloudflare dashboard): mode `managed`, hostnames
`localhost` + `sovereign.defrag.app`. Site key is a plain var
(`TURNSTILE_SITE_KEY`); the secret key is a Workers secret.

---

## 7. Email verification & password reset

- On signup a one-time **verification token** is stored as a SHA-256 hash
  (`verification_token`) with a 48h expiry; verification is gated on Resend
  actually being configured (`emailVerificationEnabled`). AI chat is unlocked
  only after verification.
- **Reset** issues a single-use, 30-minute token held in KV
  (`reset-token:<sha256>`), emailed to `/onboard?reset=<token>`. The legacy
  `/reset` route redirects to the same place. Setting a new password re-hashes
  with the current peppered policy.

---

## 8. Transport & platform hardening

- **HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy** and a
  strict **CSP** (see `next.config.ts`) — the CSP already allows
  `challenges.cloudflare.com` for Turnstile and `js.stripe.com`/`api.stripe.com`
  for billing.
- **Rate limiting** in KV: login (10 / 5 min per IP+email), reset (5 / hour).
- **Free-tier AI cap** (5 msgs/day) tracked in KV to bound cost/abuse.
- All auth/entitlement checks are server-side; the client is never trusted.

### Recommended Cloudflare additions (free tier)
- **Bot Fight Mode** + a **WAF rate-limiting rule** on `/api/auth` at the zone
  level → edge-level abuse protection behind (not instead of) the KV limiter.
- Keep **Turnstile** on signup *and* login.
- **Web Analytics** (already integrated) is privacy-first and cookieless —
  consistent with the product's stance.

---

## 9. Passkeys (WebAuthn) — decided direction, not yet built

Passkeys are the correct next step and directly serve the iOS-native, low-friction
UX goal. **They also sidestep the entire §4 hashing-ceiling debate**, because a
passkey involves no shared secret to hash — Workers WebCrypto's ES256/Ed25519
verification is fully supported.

Recommended model: **passkey-first, password as an optional fallback** (never
passkey-only, to avoid lockout with no recovery path).

Planned surface (kept deliberately small so the UI stays uncluttered):
- `passkeys(credential_id PK, user_id FK, public_key, counter, transports, created_at)`.
- `POST /api/auth/passkey/register/{options,verify}` and
  `POST /api/auth/passkey/authenticate/{options,verify}`, using
  `@simplewebauthn/server` (edge-compatible; handles CBOR/COSE/attestation so we
  do not hand-roll it). Challenges stored in KV with a short TTL.
- UI: one "Continue with a passkey" button on login; "Add a passkey" on the
  account page after email/password signup. Password sign-in remains the visible
  fallback.

Deliberately **not** recommended: WASM Argon2id/scrypt. It adds a fragile
CPU/memory-heavy dependency on Workers, and passkeys remove the need for it.
If passkeys are ever dropped, revisit Argon2id via a vetted WASM module with
parameters tuned to the Workers memory limit.

---

## 10. Testing the auth path

Because local Node and workerd differ, always validate crypto-sensitive flows
against the **real runtime**:

```bash
npm run typecheck && npm run lint && npm test   # unit: auth, stripe, sovereign-*
npm run deploy                                   # build + deploy to Workers
# then drive the live flow and watch the actual runtime:
npx wrangler tail production-os
curl -X POST https://sovereign.defrag.app/api/auth \
  -H 'content-type: application/json' \
  -d '{"email":"someone@example.com","password":"…"}'
```

A `200 {user, hasBaseline}` + `set-cookie: sovereign_session=` confirms the
hash + verify + JWT round-trip in workerd. The 500-with-empty-body signature is
the tell for a runtime-only crypto failure.
