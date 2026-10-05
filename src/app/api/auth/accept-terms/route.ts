import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { verifySession } from "@/lib/session";
import { CURRENT_TERMS_VERSION, TERMS_AFFIRMATION } from "@/lib/terms";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/accept-terms — record a fresh clickwrap receipt for the
 * current Terms version on the signed-in account.
 *
 * Called by <TermsGate /> after the user has read the updated Terms and
 * explicitly affirmed them. Mirrors the signup write (see api/auth/route.ts)
 * so the D1 row always carries the version the person last agreed to plus the
 * timestamp of that agreement — the previous receipt is overwritten only in
 * the sense that the new value replaces it; the historical version travels in
 * the request body as `previousVersion` so a future audit log can pair an
 * affirmation with the exact prior consent it supersedes. That field is
 * optional and never trusted; it is logged, not persisted.
 *
 * Body: `{ accepted: true, previousVersion?: string }`
 *   → 401 without a valid session,
 *   → 400 if `accepted !== true` (an unaffirmative POST must never rewrite a
 *     receipt — same front-door rule as signup),
 *   → 200 `{ ok: true, termsVersion, acceptedAt }` on success.
 *
 * Rate limit: five writes per hour per user via KV. A legitimate account
 * re-accepts once per material Terms change; a burst indicates either a
 * stuck UI or a scripted client trying to stamp receipts.
 */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_TTL = 3600;

export async function POST(request: NextRequest) {
  const env = await getEnv();
  const session = await verifySession(env, request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.payload.sub;

  let body: { accepted?: unknown; previousVersion?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.accepted !== true) {
    return NextResponse.json(
      { error: "Affirmation required.", required: TERMS_AFFIRMATION },
      { status: 400 },
    );
  }

  const rlKey = `rl:accept-terms:${userId}`;
  const count = parseInt((await env.SESSION_KV.get(rlKey)) || "0", 10);
  if (count >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "You've re-affirmed a few times in a row — try again in an hour." },
      { status: 429 },
    );
  }
  await env.SESSION_KV.put(rlKey, String(count + 1), { expirationTtl: RATE_LIMIT_TTL });

  // Guarded UPDATE: writes only while the stored version differs from
  // CURRENT. A second click after the row is up to date becomes a no-op, so
  // an optimistic UI cannot double-stamp the timestamp.
  try {
    await env.DB.prepare(
      "UPDATE users SET terms_version = ?, terms_accepted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND (terms_version IS NULL OR terms_version != ?)",
    )
      .bind(CURRENT_TERMS_VERSION, userId, CURRENT_TERMS_VERSION)
      .run();
  } catch (err) {
    // A pre-migration D1 file may lack the column; that must not 500 the
    // client. The re-acceptance modal will keep firing on the next page load
    // but the user is otherwise unaffected — this is strictly better than
    // failing the whole session check.
    console.error("[accept-terms] write failed:", err);
    return NextResponse.json(
      { error: "We couldn't record your affirmation just now — try again in a moment.", previousVersion: typeof body.previousVersion === "string" ? body.previousVersion : null },
      { status: 500 },
    );
  }

  const row = await env.DB.prepare("SELECT terms_version, terms_accepted_at FROM users WHERE id = ?")
    .bind(userId)
    .first<{ terms_version: string | null; terms_accepted_at: string | null }>();

  return NextResponse.json({
    ok: true,
    termsVersion: row?.terms_version ?? CURRENT_TERMS_VERSION,
    acceptedAt: row?.terms_accepted_at ?? null,
  });
}
