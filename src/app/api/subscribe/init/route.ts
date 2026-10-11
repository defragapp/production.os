import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  configuredPrice,
  createStripeCustomer,
  createSubscriptionWithClientSecret,
  getSubscription,
  type SubscribeInitResult,
} from "@/lib/stripe";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";

/**
 * On-site checkout init (the embedded Payment Element flow that replaces the
 * user-facing redirect to hosted Checkout). Everything money-bearing stays
 * server-side: the price comes from the allowlisted env config via
 * `configuredPrice()`, the customer is ours or freshly minted by us, and the
 * subscription is created with our secret key. The client only ever receives
 * a publishable client secret for Stripe.js — never a price id, a customer
 * id, or an entitlement. Activation remains exclusively the webhook's job
 * (invoice.paid / customer.subscription.updated); a browser reporting
 * "success" grants nothing by itself.
 *
 * Duplicate-submission model:
 *   • a stored `sovereign+` tier is refused with 409 (already subscribed);
 *   • an init within the reuse window re-reads the SAME subscription instead
 *     of POSTing a new one, so double-clicks and retry-after-error cannot
 *     stack incomplete subscriptions;
 *   • if a race still gets a second POST through, Stripe itself rejects it
 *     ("customer already has a subscription…") and we answer 409, not 502.
 */

interface InitBody { interval?: string; }

/** How long a started-but-unpaid init may be reused, in seconds. */
const REUSE_TTL = 1800;

function reuseKey(userId: string, interval: string): string {
  return `subscribe-inflight:${userId}:${interval}`;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * /api/auth self-heals the tier against live Stripe, but rate-limits that
 * reconciliation to 1×/6h per account (`tier-sync:` in the auth route). When
 * checkout starts, clear the stamp so the client's post-payment poll sees
 * Stripe's truth almost immediately instead of a cached "free" — the poll is
 * still just reading what the server decides; entitlement itself is written
 * only by the signature-verified webhook or this reconciliation.
 */
async function reopenTierSync(env: Awaited<ReturnType<typeof getEnv>>, userId: string): Promise<void> {
  try { await env.SESSION_KV.delete(`tier-sync:${userId}`); } catch (e) { console.error("[subscribe:init] tier-sync stamp clear failed:", e); }
}

/**
 * Shape the init result for the client. `succeeded` (rare — the webhook beat
 * us to it) and `pending`/`canceled` map to the same "no on-site confirmation
 * possible" contract as `active`/`trialing`.
 */
function respondToInit(init: SubscribeInitResult): NextResponse {
  const { status } = init;
  if ((status === "incomplete" || status === "paused") && init.clientSecret) {
    return NextResponse.json({ subscriptionId: init.subscriptionId, status, clientSecret: init.clientSecret });
  }
  if (status === "requires_action" || status === "incomplete_expired") {
    // 3DS/hosted confirmation required, or the attempt lapsed — the Payment
    // Element cannot continue either state; the client shows a recovery note.
    return NextResponse.json({ subscriptionId: init.subscriptionId, status, clientSecret: null });
  }
  // active, trialing, succeeded, canceled — no on-site payment to confirm.
  return NextResponse.json({ subscriptionId: init.subscriptionId, status, clientSecret: null }, { status: 409 });
}

export async function POST(request: NextRequest) {
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return unauthorized();
  const payload = await verifyJWT(token, secret);
  if (!payload) return unauthorized();

  // Rate-limit init to discourage abuse/double-submission. Distinct key from
  // /api/checkout so the hosted fallback keeps its own budget.
  const rlKey = `rl:subscribe_init:${payload.sub}`;
  const rlRaw = await env.SESSION_KV.get(rlKey);
  const rlCount = parseInt(rlRaw || "0", 10);
  if (rlCount >= 20) {
    return NextResponse.json({ error: "That was a little fast — try again in a moment." }, { status: 429 });
  }
  await env.SESSION_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  let body: InitBody;
  try { body = await request.json() as InitBody; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  // interval is allowlisted to the two configured strings; any tampered value
  // is a 400, never a fallthrough to some other price.
  const interval = body.interval === "annual" ? "annual" : body.interval === "monthly" ? "monthly" : null;
  if (!interval) return NextResponse.json({ error: "interval must be 'monthly' or 'annual'" }, { status: 400 });

  const priceId = configuredPrice(env, interval);
  if (!priceId) return NextResponse.json({ error: "Stripe price is not configured" }, { status: 500 });

  // The account row carries both the Stripe customer (reuse, never trust a
  // client-supplied one) and the stored tier (our own cheap duplicate guard).
  let stripeCustomerId: string | null = null;
  let storedTier: string | null = null;
  try {
    const row = await env.DB.prepare("SELECT stripe_customer_id, subscription_tier FROM users WHERE id = ?")
      .bind(payload.sub).first<{ stripe_customer_id: string | null; subscription_tier: string | null }>();
    stripeCustomerId = row?.stripe_customer_id ?? null;
    storedTier = row?.subscription_tier ?? null;
  } catch (e) {
    console.error("[subscribe:init] failed to read account row:", e);
    return NextResponse.json({ error: "Couldn't start payment — try again in a moment." }, { status: 502 });
  }
  if (storedTier === "sovereign+") {
    return NextResponse.json({ error: "You're already on Sovereign+." }, { status: 409 });
  }

  // Reuse an init that is still awaiting payment (double-click, refresh,
  // retry-after-network-error). A missing/corrupt stamp falls through and
  // creates fresh; a Stripe read failure falls through too — the POST's
  // idempotency key and Stripe's own single-active-subscription rule are the
  // backstops if the stamp was a stale lie.
  const inflight = await env.SESSION_KV.get(reuseKey(payload.sub, interval));
  if (inflight) {
    const existing = await getSubscription(env, inflight);
    if (existing && (existing.status === "incomplete" || existing.status === "paused")) {
      // Keep the stamp warm for the remainder of the window.
      await env.SESSION_KV.put(reuseKey(payload.sub, interval), existing.subscriptionId, { expirationTtl: REUSE_TTL });
      await reopenTierSync(env, payload.sub);
      return respondToInit(existing);
    }
    if (existing) {
      // The subscription moved on (paid, lapsed, cancelled) — answer from its
      // authoritative status rather than creating over it.
      return respondToInit(existing);
    }
  }

  // No customer yet — create one and persist the id, mirroring the reuse
  // contract the hosted flow and the billing portal already rely on.
  if (!stripeCustomerId) {
    try {
      const customer = await createStripeCustomer(env, payload.sub, payload.email, `cust_${payload.sub}`);
      stripeCustomerId = customer.id;
      try {
        await env.DB.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").bind(stripeCustomerId, payload.sub).run();
      } catch (e) { console.error("[subscribe:init] failed to write stripe_customer_id:", e); }
    } catch (err) {
      console.error("[subscribe:init] Stripe customer create failed:", err);
      return NextResponse.json({ error: "Couldn't start payment — try again in a moment." }, { status: 502 });
    }
  }

  try {
    const init = await createSubscriptionWithClientSecret(
      env,
      stripeCustomerId,
      payload.sub,
      interval,
      `subscribe_${payload.sub}_${interval}`,
    );
    await env.SESSION_KV.put(reuseKey(payload.sub, interval), init.subscriptionId, { expirationTtl: REUSE_TTL });
    await reopenTierSync(env, payload.sub);
    return respondToInit(init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[subscribe:init] Stripe subscription create failed:", message);
    // Stripe refuses a second active subscription for the same price; surface
    // that as "already subscribed", not as a generic gateway error.
    if (/already has|active subscription/i.test(message)) {
      return NextResponse.json({ error: "A subscription is already active on this account." }, { status: 409 });
    }
    return NextResponse.json({ error: "Couldn't start payment — try again in a moment." }, { status: 502 });
  }
}
