# Stripe Monetization Plan — Free → Sovereign+

Goal (yours, restated): turn the signup → free-use → upgrade path into a
**hands-off passive-income engine** that is safe to run publicly, cannot be
circumvented to get paid features for free, and needs no manual work per
subscriber (checkout, receipt, and monthly/cancel management are Stripe-hosted).

This was an **evaluation + plan**; the four revenue-hardening gaps in §2.1–§2.4 are
now **implemented** (see the ✅ status markers). The remaining §2.5–§2.6 items are
dashboard/config, and the §3 funnel items are product moves. Cloudflare side is
shipped (passkeys live; hardening in `docs/cloudflare-readiness.md` and the
operations runbook in `docs/scaling-plan.md`).

---

## 1. What already exists (and is genuinely solid)

| Piece | File | Status |
|---|---|---|
| Checkout session (server-created) | `src/app/api/checkout/route.ts` | ✅ auth-gated + rate-limited (10/hr/user) |
| Price allowlist | `configuredPrice()` `src/lib/stripe.ts` | ✅ client can only pick `monthly`/`annual`; **prices come from server env**, never from the request |
| Stripe-hosted Checkout | `createCheckoutSession()` | ✅ card fields never touch our origin (PCI SAQ-A) |
| Webhook (signature-verified) | `src/app/api/webhooks/stripe/route.ts` | ✅ WebCrypto HMAC verify + 5-min timestamp window + KV idempotency (7-day dedupe) |
| Entitlement write | webhook → `users.subscription_tier` | ✅ set on `checkout.session.completed` + `customer.subscription.*`; cleared to `free` on `deleted` |
| Self-serve billing / cancel | `src/app/api/billing-portal/route.ts` → Stripe Portal | ✅ "cancel in two clicks," no code to maintain |
| Cancel-on-delete | `cancelActiveSubscriptions()` | ✅ stops billing when a user erases their account |
| **Free-limit enforcement** | `src/app/api/chat/route.ts` | ✅ server-side: free tier = 5/day (KV), `sovereign+` = unlimited; the cap is checked in the API, **not** trusted to the client |
| Funnel entry | `/upgrade` + after-baseline redirect (`/upgrade?from=baseline`) | ✅ new users land on the paywall right after building a Baseline |

**Bottom line on "can a user surpass free limits?"** — No, as built today. The
daily counter is keyed by `user_id`+date in KV and incremented by the chat API;
tier is read from D1 on every request; the upgrade only flips `sovereign+` via
the signature-verified webhook. The client can *ask*, but the server decides.
That is the correct, un-bypassable shape — keep it.

---

## 2. Hardening gaps to close (prioritized) — before relying on it for revenue

> Status legend: ✅ implemented in code this pass · 🔧 dashboard/config step.

1. ✅ **Duplicate Stripe customers.** Checkout sent `customer_email` (and
   `client_reference_id`) but never the stored `stripe_customer_id`. A returning
   subscriber got a *new* Stripe customer each time → split receipts/portal
   history. **Done:** `createCheckoutSession()` now takes an optional
   `customerId` and, when present, sets `customer=<id>` (dropping `customer_email`);
   `/api/checkout` reads `users.stripe_customer_id` and passes it. Receipts and the
   billing portal now always point at one customer.
2. ✅ **Missed payment / dunning events.** The webhook handled
   `customer.subscription.*` and `checkout.session.completed` but **not** the
   invoice lifecycle. **Done:** `invoice.payment_failed` (keeps tier during Stripe's
   retries per best practice + sends a throttled `payment-failed` email),
   `invoice.paid`/`invoice.payment_succeeded` (ensures `sovereign+` + sends an
   on-brand `payment-received` receipt once, deduped per invoice),
   `invoice.payment_action_required` (SCA nudge), and
   `checkout.session.async_payment_failed` (demote to `free`). Users are resolved
   by `customer` → `users.stripe_customer_id` with a `metadata.account_id` /
   `client_reference_id` fallback. **🔧 Also turn on Stripe's Automated dunning +
   Smart Retries in the dashboard** — that is the hands-off involuntary-churn
   recovery that complements these events.
3. 🔧 **Receipt emails.** Stripe only emails its own receipts/invoices if
   **Settings → Emails → "Email customers about… receipts / subscription
   invoices"** are ON (verify in the dashboard; SPF/DKIM must pass so they don't
   spam). **Belt-and-suspenders now in code:** the app itself sends branded
   `payment-received` / `payment-failed` / `subscription-canceled` templates
   (`src/lib/email.ts`) from the webhook, so revenue confirmation survives even if
   that toggle is off.
4. ✅ **Webhook-loss reconciliation (safety net).** If a webhook is dropped, a payer
   could be stuck on `free` or a canceler left on `sovereign+`. **Done:**
   `syncStripeTier()` in `src/lib/stripe.ts` re-fetches the customer's active
   subscription and corrects the DB; it is called from `GET /api/auth` only when a
   `stripe_customer_id` exists and a KV `tier-sync:<id>` stamp is older than ~6h
   (bounded cost), so a lost `customer.subscription.deleted` self-heals on the
   user's next session.
5. **Portal/checkout config.** In the dashboard, enable in the Customer Portal:
   plan switching (monthly↔annual), cancellation-at-period-end, and update
   payment method. That is the entire "manage my subscription" UX with zero
   code.
6. **Price-change safety.** `priceToSubscription` maps the two known price ids to
   `sovereign+`. If you ever add/rotate prices, update both env price vars and the
   mapping together; unknown prices already default to `free` (fail-closed),
   which is correct.

---

## 3. The income funnel (product moves, not just plumbing)

The engineering already routes the right way (build Baseline → land on
`/upgrade`). To maximize free→paid without hurting trust:

- **Value moment first, paywall second.** The Baseline reveal is the "wow." Keep
  the upgrade prompt immediately after it (done) and again when the free daily
  meter fills.
- **Show the meter, honestly.** The account page already renders
  `used / 5 today`. Surface the same in-chat with a soft "3 of 5 left today →
  unlock unlimited" nudge at the cap (the API already returns `limit`/`used`).
- **Anchor annual.** Present annual with a clear "save ~2 months" framing; keep a
  monthly option. Both prices already exist as env vars.
- **Consider a 7-day Sovereign+ trial** (Stripe Checkout supports `trial_period_days`)
  — highest-leverage conversion lever for a $ product, and it's one field in
  `createCheckoutSession`.
- **Welcome-after-upgrade email** (`src/lib/email.ts` template) confirming what
  unlocked — reinforces the purchase and cuts "did it work?" support tickets.
- **Invites as a growth loop.** The invite/relationship feature is a built-in
  viral surface; a "shared reading" that requires an account pulls the second
  person into the same funnel.
- **Post-paywall retention:** if a user stays free, a single day-2 email with one
  concrete "here's what you're missing" is fine; keep it to a low cadence and
  honor the product's privacy stance (no dark patterns, cancel in two clicks —
  already true).

Keep the funnel **honest**: the whole brand is trust/safety, so conversion should
come from demonstrating value, not from locking the user out or hiding the exit.

---

## 4. Later (enterprise / company scaling)

- **Seats & team plans** via the existing invites (per-seat pricing) once there's
  demand signal — a metered add-on, not a launch need.
- **Usage-based AI** guardrails tie back to the AI Gateway rate limit in
  `docs/cloudflare-readiness.md §3.1` so a Sovereign+ subscriber can't run the
  model into a loss; consider a fair-use ceiling even on "unlimited."
- **Tax & invoicing:** enable **Stripe Tax** if you have non-US buyers; it slots
  into the same Checkout/Portal already wired.
- **Migration to a business account** (Stripe entity, contracts) is a paperwork
  step, not an architecture change — the code above is entity-agnostic.

---

## 5. Suggested build order (when you green-light Stripe work)

1. §2.1 reuse existing customer id + §2.3 verify receipt emails — *I implement
   the code; you flip the dashboard email/portal toggles.*
2. §2.2 payment-failed/async events + enable Smart Retries & dunning (dashboard).
3. §3 trial + annual anchoring + upgrade confirmation email.
4. §2.4 reconciliation safety net (login-time or DO alarm).

Each step is independently testable in **Stripe test mode** before switching to
live keys. Nothing here changes the enforcement model in §1 — it hardens and
markets what's already un-bypassable.
