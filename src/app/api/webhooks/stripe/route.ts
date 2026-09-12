import { NextRequest, NextResponse } from "next/server";
import { verifyStripeSignature, priceToSubscription, tierFromSubscriptionStatus, SUBSCRIPTION_EVENTS, type PlanTier } from "@/lib/stripe";
import { getEnv } from "@/lib/env";

interface StripeEvent {
  id: string;
  type: string;
  data: { object: { customer?: string; status?: string; metadata?: Record<string, string>; lines?: { data: Array<{ price?: { id?: string } }> } } };
}

export async function POST(request: NextRequest) {
  const env = getEnv();
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
  const accountId = obj.metadata?.account_id;
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
      if (customerId) await env.DB.prepare(`UPDATE users SET subscription_tier = 'free' WHERE stripe_customer_id = ?`).bind(customerId).run();
      break;
    }
    default: break;
  }
  return NextResponse.json({ received: true });
}
