import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, generateResetToken, hashResetToken } from "@/lib/auth";
import { emailVerificationEnabled, sendTemplate } from "@/lib/email";
import { recipientMailAllowed } from "@/lib/email-guard";
import { getEnv } from "@/lib/env";

/** Resend cooldown per user (seconds). */
const RESEND_COOLDOWN = 600;

/**
 * POST /api/auth/resend — re-issue the verification email for the signed-in
 * user. Rate-limited to one email per 10 minutes per user.
 */
export async function POST(request: NextRequest) {
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  if (!emailVerificationEnabled(env)) {
    return NextResponse.json({ error: "Email verification is not configured" }, { status: 400 });
  }

  // Bare JWT is enough here (unlike DELETE /api/auth/account): this only
  // re-sends the verification email to the account's OWN address, and it is
  // capped per user and per recipient. Re-verification is independent of
  // session revocation, so a `verifySession` read buys nothing and costs a D1
  // round-trip.
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyJWT(cookie, secret);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rlKey = `verify-resend:${payload.sub}`;
  if (await env.SESSION_KV.get(rlKey)) {
    return NextResponse.json({ error: "That email's already on its way — check your inbox. You can ask for another in 10 minutes." }, { status: 429 });
  }
  // F-F: the cooldown protects this account; the recipient cap protects this
  // address from everyone else's signups. Checked before the cooldown is
  // spent, so a capped refusal costs this user nothing.
  if (!(await recipientMailAllowed(env, payload.email))) {
    return NextResponse.json({ error: "Too many verification emails were just sent to this address — try again in an hour." }, { status: 429 });
  }
  await env.SESSION_KV.put(rlKey, "1", { expirationTtl: RESEND_COOLDOWN });

  const token = generateResetToken();
  const tokenHash = await hashResetToken(token);
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "UPDATE users SET verification_token = ?, verification_expires = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(tokenHash, expires, payload.sub).run();

  const origin = new URL(request.url).origin;
  // sendTemplate reports the delivery outcome; a failed send must release the
  // cooldown we just spent, or a mail hiccup locks a waiting user out of
  // retrying for 10 minutes on a "success" that never arrived.
  let delivered = false;
  try {
    delivered = await sendTemplate(env, "verify", payload.email, { origin, token });
  } catch (e) {
    console.error("[resend] verification email failed:", e);
  }
  if (!delivered) {
    await env.SESSION_KV.delete(rlKey).catch(() => {});
    return NextResponse.json({ error: "Couldn't send the email just now — try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
