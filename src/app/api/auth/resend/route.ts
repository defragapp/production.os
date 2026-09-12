import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, generateResetToken, hashResetToken } from "@/lib/auth";
import { emailVerificationEnabled, emailShell, sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";

/** Resend cooldown per user (seconds). */
const RESEND_COOLDOWN = 600;

/**
 * POST /api/auth/resend — re-issue the verification email for the signed-in
 * user. Rate-limited to one email per 10 minutes per user.
 */
export async function POST(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  if (!emailVerificationEnabled(env)) {
    return NextResponse.json({ error: "Email verification is not configured" }, { status: 400 });
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyJWT(cookie, secret);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rlKey = `verify-resend:${payload.sub}`;
  if (await env.SESSION_KV.get(rlKey)) {
    return NextResponse.json({ error: "Verification email already sent. Please check your inbox — you can request another in 10 minutes." }, { status: 429 });
  }
  await env.SESSION_KV.put(rlKey, "1", { expirationTtl: RESEND_COOLDOWN });

  const token = generateResetToken();
  const tokenHash = await hashResetToken(token);
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "UPDATE users SET verification_token = ?, verification_expires = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(tokenHash, expires, payload.sub).run();

  const origin = new URL(request.url).origin;
  const link = `${origin}/api/auth/verify?token=${token}`;
  await sendTransactionalEmail(env, {
    to: payload.email,
    subject: "Verify your Sovereign OS email",
    html: emailShell(
      "Verify your email",
      `<p>Confirm your email address to unlock your Sovereign OS baseline and AI chat.</p><p><a href="${link}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Verify Email</a></p><p style="color:#71717a;font-size:13px">This link expires in 48 hours. If you didn't create an account, you can ignore this email.</p>`,
    ),
  });

  return NextResponse.json({ ok: true });
}
