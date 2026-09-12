import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { cancelActiveSubscriptions } from "@/lib/stripe";
import type { User } from "@/lib/types";

/**
 * DELETE /api/auth/account — self-serve account deletion (right to erasure).
 * Cancels active Stripe billing (best-effort), then deletes the user row.
 * baselines and threads are removed via ON DELETE CASCADE.
 */
export async function DELETE(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await env.DB.prepare("SELECT id, stripe_customer_id FROM users WHERE id = ?")
    .bind(payload.sub)
    .first<User>();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Stop active Stripe billing associated with this account (best-effort).
  await cancelActiveSubscriptions(env, user.stripe_customer_id);

  // Deleting the user cascades to baselines and threads (ON DELETE CASCADE).
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(payload.sub).run();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}