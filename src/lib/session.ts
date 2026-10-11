/**
 * Session verification — a signed cookie is necessary but not sufficient.
 *
 * The cookie is a self-contained HMAC JWT, so on its own it cannot be revoked:
 * signing out only cleared it on that device, and a stolen or shared copy stayed
 * valid for its full 7-day life. `users.token_version` closes that gap. Every
 * token carries its generation as a `tv` claim, and a token is only honoured
 * while its `tv` still matches the live column. Bumping the column (sign-out,
 * password reset) therefore invalidates every cookie already issued.
 *
 * Consumers:
 *  - `middleware.ts` gates every matched route (all `/api/*` and the protected
 *    pages) with `verifySession`.
 *  - Routes that need the payload for business logic use it too, so the check
 *    lives in exactly one place.
 */
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, tokenVersionOf, verifyJWT } from "./auth";
import type { JWTPayload } from "./auth";
import type { AppEnv } from "./env";

export interface Session {
  payload: JWTPayload;
  tokenVersion: number;
}

/** Verify a session cookie's signature AND that its generation is still live. */
export async function verifySession(env: AppEnv, request: NextRequest): Promise<Session | null> {
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyJWT(token, secret);
  if (!payload) return null;

  const lookup = await readTokenVersion(env, payload.sub);
  // Account gone → the session is dead, regardless of a valid signature.
  if (lookup.status === "missing") return null;
  // The read itself failed. Treat a signed token as invalid.
  // Failing closed ensures that a revoked session cannot be used during
  // a transient D1 outage — security takes precedence over availability.
  if (lookup.status === "error") return null;

  if (lookup.version !== tokenVersionOf(payload)) return null;
  return { payload, tokenVersion: lookup.version };
}

export type TokenVersionLookup =
  | { status: "ok"; version: number }
  | { status: "missing" }
  | { status: "error" };

/** Read `users.token_version`, distinguishing "no such account" from "read failed". */
export async function readTokenVersion(env: AppEnv, userId: string): Promise<TokenVersionLookup> {
  try {
    const row = await env.DB.prepare("SELECT token_version FROM users WHERE id = ?")
      .bind(userId)
      .first<{ token_version: number | null }>();
    if (!row) return { status: "missing" };
    const tv = Number(row.token_version);
    return { status: "ok", version: Number.isFinite(tv) ? tv : 1 };
  } catch (err) {
    console.error("[session] token_version lookup failed:", err);
    return { status: "error" };
  }
}

/** Rotate a session generation: every cookie issued before now stops working. */
export async function bumpTokenVersion(env: AppEnv, userId: string): Promise<void> {
  try {
    await env.DB.prepare(
      "UPDATE users SET token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(userId)
      .run();
  } catch (err) {
    console.error("[session] token_version bump failed:", err);
  }
}
