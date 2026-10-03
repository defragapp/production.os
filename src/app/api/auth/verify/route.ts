import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, hashResetToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import type { User } from "@/lib/types";

/**
 * Email verification: GET /api/auth/verify?token=<token>
 * Marks the signed-in user's account as verified when the token matches a
 * stored (hashed) verification token that has not expired. The token is only
 * accepted for the account it was issued to.
 *
 * Why GET (vs the invite-status lookup, which is POST): this URL is the target
 * of a link clicked in an email, and a browser can only open a clicked link with
 * GET — a POST is not achievable here. The token is therefore protected at rest
 * rather than by transport placement: it is SHA-hashed (`hashResetToken`) before
 * storage, single-use, expiring, and requires the caller's session cookie. The
 * Worker config also sets `redact_query_string: true`, so the token never lands
 * in Workers Logs. See docs/auth.md.
 */
export async function GET(request: NextRequest) {
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!token) return NextResponse.redirect(new URL("/account?verify=missing", request.url));

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return NextResponse.redirect(new URL("/onboard?mode=login&verify=required", request.url));
  const payload = await verifyJWT(cookie, secret);
  if (!payload) return NextResponse.redirect(new URL("/onboard?mode=login&verify=required", request.url));

  const tokenHash = await hashResetToken(token);
  const user = await env.DB.prepare(
    "SELECT id, verification_token, verification_expires FROM users WHERE id = ?",
  ).bind(payload.sub).first<User & { verification_token: string | null; verification_expires: string | null }>();
  if (!user || !user.verification_token || user.verification_token !== tokenHash) {
    return NextResponse.redirect(new URL("/account?verify=invalid", request.url));
  }
  const expires = user.verification_expires ? Date.parse(user.verification_expires) : 0;
  if (!expires || expires < Date.now()) {
    return NextResponse.redirect(new URL("/account?verify=expired", request.url));
  }

  await env.DB.prepare(
    "UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL, updated_at = datetime('now') WHERE id = ?",
  ).bind(user.id).run();

  return NextResponse.redirect(new URL("/account?verify=ok", request.url));
}
