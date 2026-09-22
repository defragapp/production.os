import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { createPortalSession, stripeConfigured } from "@/lib/stripe";
import { getEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!stripeConfigured(env)) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const user = await env.DB.prepare("SELECT stripe_customer_id FROM users WHERE id = ?").bind(payload.sub).first<{ stripe_customer_id: string | null }>();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription found on this account." }, { status: 400 });
  }

  try {
    const { url } = await createPortalSession(env, user.stripe_customer_id);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[billing-portal] failed to create portal session:", err);
    return NextResponse.json({ error: "Failed to open billing. Please try again." }, { status: 502 });
  }
}