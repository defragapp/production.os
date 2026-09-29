import { NextRequest, NextResponse } from "next/server";
import { hashResetToken } from "@/lib/auth";
import { getAuthPayload, loadUser } from "@/lib/connections";
import {
  claimGrant, applyGift, nextGiftExpiry, GIFT_CODE_MAX_LENGTH,
} from "@/lib/promo";
import { resolveTier } from "@/lib/tier";

export const dynamic = "force-dynamic";

/** Burst limit on the claim surface. Redemption guesses at a hashed code, so a
 *  script grinding combinations must not spin against D1. Same KV-window shape
 *  the chat route uses — a per-user rolling minute, cheap and self-expiring. */
const REDEEM_RATE_LIMIT_MAX = 20;
const REDEEM_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  let stamps: number[] = [];
  const raw = await env.SESSION_KV.get(`rl:redeem:${payload.sub}`);
  if (raw) { try { stamps = JSON.parse(raw) as number[]; } catch {} }
  stamps = stamps.filter((t) => now - t < REDEEM_RATE_LIMIT_WINDOW_MS);
  if (stamps.length >= REDEEM_RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "That's a few too many at once — give it a moment and try again." },
      { status: 429 },
    );
  }
  await env.SESSION_KV.put(`rl:redeem:${payload.sub}`, JSON.stringify([...stamps, now]), { expirationTtl: 60 });

  let body: { code?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const code = body.code?.trim() || "";
  if (!code || code.length > GIFT_CODE_MAX_LENGTH) {
    return NextResponse.json({ error: "That pass link doesn't look right.", code: "gift_invalid" }, { status: 400 });
  }

  const user = await loadUser(env, payload.sub);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // One conditional UPDATE claims capacity, expiry, revocation, and a
  // double-redeem atomically; every refusal names itself so the card can say
  // something specific rather than a generic failure.
  const codeHash = await hashResetToken(code);
  const claim = await claimGrant(env, user.id, codeHash);
  if (!claim.ok) {
    return NextResponse.json({ error: claim.error, code: claim.code }, { status: claim.status });
  }

  // A live pass extends; a fresh one starts its own clock. Then write the pass.
  const giftExpiresAt = nextGiftExpiry(user.gift_expires_at ?? null, claim.durationDays);
  await applyGift(env, user.id, giftExpiresAt);

  // Read back through the resolver so the response is the effective tier, not
  // just the write we made — a paying or owner account keeps its own truth.
  const refreshed = await loadUser(env, user.id);
  const tierInfo = await resolveTier(env, refreshed ?? user);

  return NextResponse.json({
    redeemed: true,
    tier: tierInfo.tier,
    giftExpiresAt,
    days: claim.durationDays,
  });
}
