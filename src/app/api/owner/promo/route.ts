import { NextRequest, NextResponse } from "next/server";
import { requireOwner, ownerNotFound } from "@/lib/owner";
import { createGrant, revokeGrant, giftLink, GIFT_CODE_MAX_LENGTH } from "@/lib/promo";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Mint a 30-day Sovereign+ pass. The raw code and its link are returned ONCE
 * here — D1 stores only the SHA-256 hash, so this response is the only place
 * the redeemable secret ever exists. The console shows it, the owner copies it
 * into iMessage/email, and it is never retrievable again.
 */
export async function POST(request: NextRequest) {
  const { session, denial } = await requireOwner(request);
  if (denial) return denial;
  if (!session) return ownerNotFound();
  const { env, userId, email } = session;

  let body: { durationDays?: unknown; maxRedemptions?: unknown; note?: unknown };
  try { body = await request.json(); } catch { body = {}; }

  try {
    const { code, grant } = await createGrant(env, userId, {
      durationDays: body.durationDays,
      maxRedemptions: body.maxRedemptions,
      note: body.note,
    });
    // Durable, fail-silent record of the entitlement action (#49). The target
    // is the grant's code_hash and counts only — never the redeemable code.
    await writeAuditLog(env, {
      actorId: userId,
      actorEmail: email,
      action: "promo.grant_mint",
      targetType: "promo_grant",
      targetId: grant.code_hash,
      metadata: { durationDays: grant.duration_days, maxRedemptions: grant.max_redemptions },
    });
    const origin = new URL(request.url).origin;
    return NextResponse.json(
      {
        code,
        link: giftLink(origin, code),
        grant: {
          durationDays: grant.duration_days,
          maxRedemptions: grant.max_redemptions,
          note: grant.note,
          expiresAt: grant.expires_at,
          createdAt: grant.created_at,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[owner/promo] mint failed:", err);
    return NextResponse.json({ error: "Could not mint the pass — the grants table may not be migrated yet." }, { status: 500 });
  }
}

/**
 * Revoke a minted pass. An unclaimed link simply closes; a claimed one also
 * truncates the recipient's pass when that grant was the last pass they took
 * (see revokeGrant). Body carries the code_hash the overview listed — a hash,
 * never a redeemable secret.
 */
export async function DELETE(request: NextRequest) {
  const { session, denial } = await requireOwner(request);
  if (denial) return denial;
  if (!session) return ownerNotFound();
  const { env, userId, email } = session;

  let body: { codeHash?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const codeHash = body.codeHash?.trim();
  if (!codeHash || codeHash.length > GIFT_CODE_MAX_LENGTH * 4) {
    return NextResponse.json({ error: "A valid grant is required." }, { status: 400 });
  }

  try {
    const result = await revokeGrant(env, userId, codeHash);
    if (!result.revoked) return NextResponse.json({ error: "That pass was already closed or doesn't belong to you." }, { status: 409 });
    await writeAuditLog(env, {
      actorId: userId,
      actorEmail: email,
      action: "promo.grant_revoke",
      targetType: "promo_grant",
      targetId: codeHash,
      metadata: { recipientDowngraded: result.recipientDowngraded },
    });
    return NextResponse.json({ revoked: true, recipientDowngraded: result.recipientDowngraded });
  } catch (err) {
    console.error("[owner/promo] revoke failed:", err);
    return NextResponse.json({ error: "Could not revoke the pass." }, { status: 500 });
  }
}
