/**
 * Stripe integration — extracted from sovv-web.
 * Pricing tiers: Free vs Sovereign+ (monthly/annual).
 * Stripe API version: 2026-06-24.dahlia
 */
import type { AppEnv } from "./env";

const STRIPE_API_VERSION = "2026-06-24.dahlia";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired", "retained_billing_record"]);

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

export type PlanTier = "free" | "sovereign_plus";

/** Check if Stripe is configured. */
export function stripeConfigured(env: AppEnv): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_SUCCESS_URL && env.STRIPE_CANCEL_URL);
}

/** Get the configured Stripe price ID for a billing interval. */
export function configuredPrice(env: AppEnv, interval: "monthly" | "annual"): string | undefined {
  return interval === "monthly"
    ? env.STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY
    : env.STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL;
}

/** Map a Stripe price ID to a subscription plan. */
export function priceToSubscription(
  env: AppEnv,
  priceId: string | undefined,
): { plan: PlanTier; interval?: "monthly" | "annual" } {
  if (!priceId) return { plan: "free" };
  if (priceId === env.STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY) {
    return { plan: "sovereign_plus", interval: "monthly" };
  }
  if (priceId === env.STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL) {
    return { plan: "sovereign_plus", interval: "annual" };
  }
  return { plan: "free" };
}

/** Verify a Stripe webhook signature using WebCrypto HMAC-SHA256. */
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);

  if (!timestamp || !v1) return false;

  const eventTime = parseInt(timestamp, 10);
  if (Number.isNaN(eventTime) || Math.abs(Date.now() / 1000 - eventTime) > 300) {
    return false;
  }

  const expected = hexToBytes(v1);
  if (expected.byteLength !== 32) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signedPayload = `${timestamp}.${payload}`;
  return crypto.subtle.verify("HMAC", key, expected, new TextEncoder().encode(signedPayload));
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Determine the plan tier from a subscription status. */
export function tierFromSubscriptionStatus(status: string): PlanTier {
  if (ACTIVE_SUBSCRIPTION_STATUSES.has(status)) return "sovereign_plus";
  return "free";
}

/** Create a Stripe checkout session for Sovereign+ subscription. */
export async function createCheckoutSession(
  env: AppEnv,
  accountId: string,
  email: string,
  interval: "monthly" | "annual",
  idempotencyKey: string,
  // When the account already has a Stripe customer (from a prior subscription
  // or the portal), reuse it instead of letting Stripe create a duplicate by
  // email. Keeps billing history and the portal tied to one customer id.
  customerId?: string | null,
): Promise<{ url: string }> {
  const price = configuredPrice(env, interval);
  if (!price) throw new Error("Stripe price is not configured");

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("line_items[0][price]", price);
  body.set("line_items[0][quantity]", "1");
  if (customerId) {
    body.set("customer", customerId);
  } else {
    body.set("customer_email", email);
  }
  body.set("client_reference_id", accountId);
  body.set("success_url", env.STRIPE_SUCCESS_URL);
  body.set("cancel_url", env.STRIPE_CANCEL_URL);
  body.set("metadata[account_id]", accountId);
  body.set("metadata[plan]", "sovereign_plus");
  body.set("metadata[interval]", interval);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Stripe-Version": STRIPE_API_VERSION,
      "Idempotency-Key": idempotencyKey,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.json() as { error?: { message?: string } };
    throw new Error(`Stripe checkout failed: ${err.error?.message || response.statusText}`);
  }

  const session = await response.json() as { url: string };
  return { url: session.url };
}

/**
 * Create a Stripe Billing Portal session so customers can self-serve manage
 * or cancel their subscription (upgrade/downgrade handled by Stripe itself).
 */
export async function createPortalSession(env: AppEnv, customerId: string): Promise<{ url: string }> {
  if (!env.STRIPE_PORTAL_RETURN_URL) throw new Error("Stripe portal return URL is not configured");

  const body = new URLSearchParams();
  body.set("customer", customerId);
  body.set("return_url", env.STRIPE_PORTAL_RETURN_URL);

  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Stripe-Version": STRIPE_API_VERSION,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.json() as { error?: { message?: string } };
    throw new Error(`Stripe portal failed: ${err.error?.message || response.statusText}`);
  }

  const session = await response.json() as { url: string };
  return { url: session.url };
}

/**
 * Best-effort cancel all active Stripe subscriptions for a customer.
 * Used on account deletion so billing stops without requiring a dashboard step.
 * Swallows failures (local account erasure proceeds regardless).
 */
export async function cancelActiveSubscriptions(env: AppEnv, customerId: string | null | undefined): Promise<void> {
  if (!env.STRIPE_SECRET_KEY || !customerId) return;
  try {
    const listRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=active&limit=100`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_API_VERSION },
    });
    if (!listRes.ok) return;
    const data = await listRes.json() as { data?: Array<{ id: string }> };
    for (const sub of data.data ?? []) {
      await fetch(`https://api.stripe.com/v1/subscriptions/${sub.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_API_VERSION },
      });
    }
  } catch (err) {
    console.error("[stripe] failed to cancel subscriptions on account deletion:", err);
  }
}

/**
 * Reconcile a user's tier against Stripe's source of truth. Webhooks are
 * best-effort — a dropped `customer.subscription.deleted` (or a Worker cold
 * start that missed a delivery) can leave a lapsed subscriber on Sovereign+.
 * Pull the customer's live subscriptions and correct `users.subscription_tier`
 * when it disagrees. Returns the effective tier so the caller can act on it.
 * Best-effort: any Stripe failure is swallowed (we keep the stored tier).
 */
export async function syncStripeTier(
  env: AppEnv,
  userId: string,
  customerId: string,
): Promise<"free" | "sovereign+"> {
  if (!env.STRIPE_SECRET_KEY) return "free";
  let tier: "free" | "sovereign+" = "free";
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=active&limit=1`,
      { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_API_VERSION } },
    );
    if (res.ok) {
      const data = await res.json() as { data?: Array<{ status?: string }> };
      const active = (data.data ?? []).some((s) => tierFromSubscriptionStatus(s.status || "") === "sovereign_plus");
      if (active) tier = "sovereign+";
    }
  } catch (err) {
    console.error("[stripe] tier sync failed:", err);
    return "free";
  }
  try {
    // `IS NOT ?` is SQLite null-safe inequality: only write when the stored
    // tier actually differs (including when it was NULL).
    await env.DB.prepare("UPDATE users SET subscription_tier = ? WHERE id = ? AND subscription_tier IS NOT ?").bind(tier, userId, tier).run();
  } catch (err) {
    console.error("[stripe] tier sync DB write failed:", err);
  }
  return tier;
}

export {
  STRIPE_API_VERSION,
  ACTIVE_SUBSCRIPTION_STATUSES,
  TERMINAL_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_EVENTS,
};
