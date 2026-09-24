import { NextRequest, NextResponse } from "next/server";
import { verifyStripeSignature, priceToSubscription, tierFromSubscriptionStatus, SUBSCRIPTION_EVENTS, type PlanTier } from "@/lib/stripe";
import { sendTemplate } from "@/lib/email";
import { getEnv, type AppEnv } from "@/lib/env";

interface StripeObject {
  id?: string;
  customer?: string;
  status?: string;
  billing_reason?: string;
  attempt_count?: number;
  amount_due?: number;
  currency?: string;
  created?: number;
  lines?: { data: Array<{ price?: { id?: string } }> };
  metadata?: Record<string, string>;
  client_reference_id?: string;
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeObject };
}

/** Best-effort account lookup for invoice/checkout events (customer-first). */
async function resolveUser(
  env: AppEnv,
  customerId?: string,
  accountId?: string,
): Promise<{ id: string; email: string; customerId: string | null } | null> {
  if (customerId) {
    const byCust = await env.DB.prepare("SELECT id, email, stripe_customer_id FROM users WHERE stripe_customer_id = ?").bind(customerId).first<{ id: string; email: string; stripe_customer_id: string | null }>();
    if (byCust) return { id: byCust.id, email: byCust.email, customerId: byCust.stripe_customer_id };
  }
  if (accountId) {
    const byId = await env.DB.prepare("SELECT id, email, stripe_customer_id FROM users WHERE id = ?").bind(accountId).first<{ id: string; email: string; stripe_customer_id: string | null }>();
    if (byId) return { id: byId.id, email: byId.email, customerId: byId.stripe_customer_id };
  }
  return null;
}

function appOrigin(env: AppEnv): string {
  try { return new URL(env.STRIPE_SUCCESS_URL).origin; } catch { return "https://sovereign.defrag.app"; }
}

function money(amountDue: number | undefined, currency: string | undefined): string | undefined {
  if (amountDue == null) return undefined;
  const major = (amountDue / 100).toFixed(2);
  return currency === "usd" || !currency ? major : `${major} ${currency.toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  const env = await getEnv();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 500 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  const rawBody = await request.text();
  const valid = await verifyStripeSignature(rawBody, signature, secret);
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  let event: StripeEvent;
  try { event = JSON.parse(rawBody) as StripeEvent; } catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }

  // Idempotency: Stripe may re-deliver webhooks. Record the event ID in KV and
  // skip any already-processed event so subscription updates are never applied twice.
  const eventKey = `stripe-event:${event.id}`;
  const alreadyProcessed = await env.SESSION_KV.get(eventKey);
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  await env.SESSION_KV.put(eventKey, "1", { expirationTtl: 60 * 60 * 24 * 7 });

  const obj = event.data.object;
  const customerId = obj.customer;
  // account_id lives in checkout/subscription metadata; invoice events carry it
  // only if we set it, so also fall back to client_reference_id.
  const accountId = obj.metadata?.account_id || obj.client_reference_id;
  const origin = appOrigin(env);
  switch (event.type) {
    case "checkout.session.completed": {
      if (accountId) await env.DB.prepare(`UPDATE users SET subscription_tier = 'sovereign+', stripe_customer_id = ? WHERE id = ?`).bind(customerId || null, accountId).run();
      else if (customerId) await env.DB.prepare(`UPDATE users SET subscription_tier = 'sovereign+' WHERE stripe_customer_id = ?`).bind(customerId).run();
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      if (!SUBSCRIPTION_EVENTS.has(event.type)) break;
      const tier = tierFromSubscriptionStatus(obj.status || "");
      const priceId = obj.lines?.data?.[0]?.price?.id;
      const sub = priceToSubscription(env, priceId);
      const finalTier: PlanTier = sub.plan === "free" ? tier : sub.plan;
      if (customerId) await env.DB.prepare(`UPDATE users SET subscription_tier = ? WHERE stripe_customer_id = ?`).bind(finalTier === "sovereign_plus" ? "sovereign+" : "free", customerId).run();
      break;
    }
    case "customer.subscription.deleted": {
      if (customerId) {
        await env.DB.prepare(`UPDATE users SET subscription_tier = 'free' WHERE stripe_customer_id = ?`).bind(customerId).run();
        const user = await resolveUser(env, customerId);
        if (user?.email) { try { await sendTemplate(env, "subscription-canceled", user.email, { origin }); } catch (e) { console.error("[webhook] cancel email failed:", e); } }
      }
      break;
    }

    // ── Payment / dunning events (invoice lifecycle) ────────────────────
    // A successful charge. Confirms entitlement (in case the subscription event
    // was missed) and emails an on-brand receipt once per invoice —
    // invoice.paid and invoice.payment_succeeded both fire for one invoice, so
    // we dedupe on the invoice id, not the event id.
    case "invoice.paid":
    case "invoice.payment_succeeded": {
      if (customerId) await env.DB.prepare(`UPDATE users SET subscription_tier = 'sovereign+' WHERE stripe_customer_id = ?`).bind(customerId).run();
      const isSubscriptionInvoice = obj.billing_reason === "subscription_create" || obj.billing_reason === "subscription_cycle" || obj.billing_reason === "subscription_update";
      if (isSubscriptionInvoice && obj.id) {
        const receiptKey = `receipt-sent:${obj.id}`;
        if (!(await env.SESSION_KV.get(receiptKey))) {
          await env.SESSION_KV.put(receiptKey, "1", { expirationTtl: 60 * 60 * 24 * 30 });
          const user = await resolveUser(env, customerId, accountId);
          if (user?.email) {
            try {
              await sendTemplate(env, "payment-received", user.email, {
                origin,
                amount: money(obj.amount_due, obj.currency),
                date: obj.created ? new Date(obj.created * 1000).toDateString() : undefined,
              });
            } catch (e) { console.error("[webhook] receipt email failed:", e); }
          }
        }
      }
      break;
    }
    // A charge failed. Per Stripe guidance we keep the tier during the retry
    // window (Smart Retries will recover most failures); we nudge the user to
    // fix their payment method, throttled to one email per 24h per customer.
    case "invoice.payment_failed": {
      if (customerId) {
        const dunningKey = `dunning:${customerId}`;
        const last = parseInt((await env.SESSION_KV.get(dunningKey)) || "0", 10) || 0;
        const now = Date.now();
        if (now - last > 1000 * 60 * 60 * 24) {
          await env.SESSION_KV.put(dunningKey, String(now), { expirationTtl: 60 * 60 * 24 * 14 });
          const user = await resolveUser(env, customerId, accountId);
          if (user?.email) {
            try { await sendTemplate(env, "payment-failed", user.email, { origin, attempt: obj.attempt_count }); } catch (e) { console.error("[webhook] dunning email failed:", e); }
          }
        }
      }
      break;
    }
    // The charge needs extra customer action (3DS / SCA). Point them at the
    // portal to complete it before the subscription lapses.
    case "invoice.payment_action_required": {
      const user = await resolveUser(env, customerId, accountId);
      if (user?.email) { try { await sendTemplate(env, "payment-failed", user.email, { origin, attempt: obj.attempt_count }); } catch (e) { console.error("[webhook] action-required email failed:", e); } }
      break;
    }
    // A deferred payment method (e.g. SEPA, bank debit) ultimately failed at
    // checkout — there is no active subscription, so drop to free.
    case "checkout.session.async_payment_failed": {
      if (accountId) await env.DB.prepare(`UPDATE users SET subscription_tier = 'free' WHERE id = ?`).bind(accountId).run();
      else if (customerId) await env.DB.prepare(`UPDATE users SET subscription_tier = 'free' WHERE stripe_customer_id = ?`).bind(customerId).run();
      break;
    }
    default: break;
  }
  return NextResponse.json({ received: true });
}
