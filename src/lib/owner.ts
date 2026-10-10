/**
 * Owner-only surface guard.
 *
 * The Owner Console is not a separate app — it is a route inside this Worker,
 * and the whole security value of that shape sits in one rule: a person who is
 * not the owner must not be able to tell the surface exists. So every owner
 * route answers a non-owner with the same 404 an unknown path gets, before any
 * data is read, and 401 only when there is no session at all (which is already
 * the middleware's contract for `/api/*`).
 *
 * Identity comes from the database, not from the cookie. The session JWT
 * carries an `email` claim, but a claim is a snapshot: an account that changed
 * address, or a token minted before a rename, would keep an owner-shaped claim
 * for the rest of its seven-day life. `requireOwner` therefore verifies the
 * session, reads the live row, and requires both the owner address and a
 * verified email — an unverifiable owner account gets nothing.
 */
import type { NextRequest, NextResponse } from "next/server";
import { JWT_SECRET_ENV_KEY } from "./auth";
import { isOwnerEmail } from "./tier";
import { verifySession } from "./session";
import { getEnv } from "./env";
import type { AppEnv } from "./env";

export interface OwnerSession {
  env: AppEnv;
  userId: string;
  /**
   * The owner's live email, read from the row during the identity check. The
   * owner audit log (#49) hashes this to a SHA-256 digest for its actor record —
   * it is never written raw, and requiring it here keeps the routes from making
   * a second DB read just to know who acted.
   */
  email: string;
}

/**
 * The single refusal shape. One construction site on purpose: a route cannot
 * invent its own wording and so cannot leak the surface into a message.
 */
export function ownerNotFound(): NextResponse {
  return Response.json({ error: "Not Found" }, { status: 404 }) as unknown as NextResponse;
}

/**
 * Resolve the caller as the owner, or return the refusal to send.
 *
 * `undefined` result = this is the owner, continue. A `NextResponse` = deny —
 * 401 with no session, 404 for anyone signed in who is not the owner.
 */
export async function requireOwner(
  request: NextRequest,
): Promise<{ session: OwnerSession; denial?: undefined } | { session?: undefined; denial: NextResponse }> {
  const env = await getEnv();
  if (!env[JWT_SECRET_ENV_KEY]) {
    return { denial: Response.json({ error: "Server configuration error" }, { status: 500 }) as unknown as NextResponse };
  }
  // The middleware already 401s an unsigned request to any /api/* path, so
  // reaching here without a session means a dead or revoked one — the same
  // answer every other API gives, and nothing about the owner surface.
  const session = await verifySession(env, request);
  if (!session) {
    return { denial: Response.json({ error: "Unauthorized" }, { status: 401 }) as unknown as NextResponse };
  }
  const userId = session.payload.sub;
  let row: { email: string; email_verified: number } | null = null;
  try {
    row = await env.DB.prepare("SELECT email, email_verified FROM users WHERE id = ?").bind(userId).first<{ email: string; email_verified: number }>();
  } catch (err) {
    console.error("[owner] identity read failed:", err);
    return { denial: ownerNotFound() };
  }
  if (!row || !isOwnerEmail(row.email) || Number(row.email_verified) !== 1) {
    return { denial: ownerNotFound() };
  }
  return { session: { env, userId, email: row.email } };
}
