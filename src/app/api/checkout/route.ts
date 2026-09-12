import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, generateUUID } from "@/lib/auth";
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe";
import { getEnv } from "@/lib/env";

export async function POST(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!stripeConfigured(env)) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  let body: { interval?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const interval = body.interval === "annual" ? "annual" : body.interval === "monthly" ? "monthly" : null;
  if (!interval) return NextResponse.json({ error: "interval must be 'monthly' or 'annual'" }, { status: 400 });

  const idempotencyKey = `checkout_${payload.sub}_${interval}_${generateUUID()}`;
  try {
    const { url } = await createCheckoutSession(env, payload.sub, payload.email, interval, idempotencyKey);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[checkout] Stripe checkout session failed:", err);
    return NextResponse.json({ error: "Failed to create checkout session. Please try again." }, { status: 502 });
  }
}