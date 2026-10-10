import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { verifySession } from "@/lib/session";
import { getEnv, waitUntil } from "@/lib/env";
import { cancelActiveSubscriptions } from "@/lib/stripe";
import { deleteUserEmbeddings } from "@/lib/chat-embeddings";
import type { User } from "@/lib/types";

/**
 * DELETE /api/auth/account — self-serve account deletion (right to erasure).
 * Cancels active Stripe billing (best-effort), then deletes the user row.
 * baselines, threads, invites, relationships, passkeys, journeys, journey_events,
 * chat_usage, and nudge are all removed via ON DELETE CASCADE on the user row.
 * promo_grants.created_by CASCADE-deletes grants this account minted; a grant
 * this account *redeemed* becomes anonymous via ON DELETE SET NULL so the
 * minting owner still sees their redemption count without knowing who did it.
 *
 * Cloudflare Vectorize rows are not D1-cascadable: they live in a separate
 * index keyed by deterministic userId-prefixed ids. We enumerate the id list
 * from D1 *before* the cascade (the message counts and thread ids disappear
 * with the threads rows) and hand the sweep to ctx.waitUntil so the response
 * is not blocked on Vectorize write throughput.
 */
export async function DELETE(request: NextRequest) {
  const env = await getEnv();
  // `/api/auth/*` is exempt from the middleware gate (sign-in has to be public),
  // so this route's own check is the only one. It must run the FULL session
  // check — `verifySession` compares the token's generation against the live
  // `users.token_version`, so signing out or resetting a password revokes every
  // cookie already issued. A bare JWT check would honour a revoked cookie and
  // let it delete the account and cancel billing.
  const session = await verifySession(env, request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.payload.sub;

  const user = await env.DB.prepare("SELECT id, stripe_customer_id FROM users WHERE id = ?")
    .bind(userId)
    .first<User>();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Stop active Stripe billing associated with this account (best-effort).
  await cancelActiveSubscriptions(env, user.stripe_customer_id);

  // Snapshot the id list for the Vectorize sweep while the D1 rows still
  // exist. json_array_length gives us the number of messages in each thread
  // without parsing the JSON blob; the embed loop indexes pairs 0..N-1.
  let threadSnapshot: Array<{ threadId: string; turnCount: number }> = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT id, json_array_length(message_history) AS n FROM threads WHERE user_id = ?",
    )
      .bind(userId)
      .all<{ id: string; n: number | null }>();
    threadSnapshot = (rows.results ?? []).map((r) => ({
      threadId: r.id,
      turnCount: Math.ceil((r.n ?? 0) / 1), // one vector per message; conservative
    }));
  } catch (err) {
    console.error("[account-delete] thread snapshot failed:", err);
  }

  // Deleting the user cascades to baselines and threads (ON DELETE CASCADE).
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

  // Fire the Vectorize sweep after the response; the D1 cascade above has
  // already removed the authoritative rows, so a failure here leaves only
  // orphaned coordinates (no plaintext) which are safe by construction.
  if (threadSnapshot.length > 0) {
    waitUntil(deleteUserEmbeddings(env, userId, threadSnapshot));
  }

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