import { NextRequest, NextResponse } from "next/server";
import { requireOwner, ownerNotFound } from "@/lib/owner";
import { listGrants, isGrantOpen } from "@/lib/promo";
import { resolveTier, OWNER_EMAIL } from "@/lib/tier";
import { FREE_TIER_DAILY_LIMIT, SOVEREIGN_PLUS_DAILY_LIMIT } from "@/lib/limits";

export const dynamic = "force-dynamic";

/** Count over a query that may touch a not-yet-migrated column/table. A
 *  missing signal reads as zero rather than failing the whole overview — the
 *  console must open even on a database that predates a feature. */
async function count(env: { DB: D1Database }, sql: string, ...binds: unknown[]): Promise<number> {
  try {
    const row = await env.DB.prepare(sql).bind(...(binds as never[])).first<{ n: number }>();
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

/** The Owner Console's read surface: live platform metrics for the owner only.
 *  Any signed-in non-owner gets the same 404 an unknown path gets, so the
 *  console's existence is not observable from outside. */
export async function GET(request: NextRequest) {
  const { session, denial } = await requireOwner(request);
  if (denial) return denial;
  if (!session) return ownerNotFound();
  const { env, userId } = session;

  // Single UTC day key shared with the chat route's error counter and the
  // usage table's `day` column.
  const today = new Date().toISOString().slice(0, 10);

  const [
    totalUsers,
    verifiedUsers,
    baselinesCompleted,
    journeysActive,
    journeysComplete,
    tierFree,
    tierPaidPlus,
    tierGiftedPlus,
  ] = await Promise.all([
    count(env, "SELECT COUNT(*) AS n FROM users"),
    count(env, "SELECT COUNT(*) AS n FROM users WHERE email_verified = 1"),
    count(env, "SELECT COUNT(*) AS n FROM baselines"),
    count(env, "SELECT COUNT(*) AS n FROM journeys WHERE status = 'active'"),
    count(env, "SELECT COUNT(*) AS n FROM journeys WHERE status = 'complete'"),
    count(env, "SELECT COUNT(*) AS n FROM users WHERE subscription_tier = 'free'"),
    count(env, "SELECT COUNT(*) AS n FROM users WHERE subscription_tier = 'sovereign+' AND stripe_customer_id IS NOT NULL"),
    count(env, "SELECT COUNT(*) AS n FROM users WHERE subscription_tier = 'sovereign+' AND stripe_customer_id IS NULL AND gift_expires_at > datetime('now')"),
  ]);

  // Today's AI turns across the platform (the free + plus counters alike).
  let turnsToday = 0;
  try {
    const row = await env.DB.prepare("SELECT COALESCE(SUM(used), 0) AS n FROM chat_usage WHERE day = ?").bind(today).first<{ n: number }>();
    turnsToday = Number(row?.n ?? 0);
  } catch {}

  // Model failures the chat route counts when BOTH the gateway and the direct
  // binding drop. Best-effort read; absence simply reads as a clean day.
  let modelErrorsToday = 0;
  try {
    const raw = await env.SESSION_KV.get(`ops:model-errors:${today}`);
    modelErrorsToday = parseInt(raw || "0", 10) || 0;
  } catch {}

  const grants = await listGrants(env, userId, 50);

  // ── Billing health ────────────────────────────────────────────────────
  // The Stripe webhook stamps `dunning:<stripe_customer_id>` (last-nudge ms,
  // 14-day TTL) when a charge fails. A live key therefore means "this paid
  // account missed a payment within the last 14 days" — exactly the window
  // Smart Retries and the portal email are working through. KV list gives
  // the ids; D1 resolves them back to accounts so the owner can act.
  let dunning: Array<{ customerId: string; email: string | null; lastNudgeAt: number | null }> = [];
  try {
    const listed = await env.SESSION_KV.list({ prefix: "dunning:" });
    const keys = listed.keys.slice(0, 25);
    const ids = keys.map((k) => k.name.slice("dunning:".length)).filter(Boolean);
    const emails = new Map<string, string>();
    if (ids.length > 0) {
      try {
        const rows = await env.DB.prepare(
          `SELECT stripe_customer_id, email FROM users WHERE stripe_customer_id IN (${ids.map(() => "?").join(",")})`,
        ).bind(...(ids as never[])).all<{ stripe_customer_id: string; email: string }>();
        for (const r of rows.results ?? []) emails.set(r.stripe_customer_id, r.email);
      } catch {}
    }
    dunning = keys.map((k) => {
      const customerId = k.name.slice("dunning:".length);
      // The put() carried a 14-day TTL; if the platform echoes expiration we
      // can back-compute the failed-charge moment the nudge was stamped at.
      const lastNudgeAt = typeof k.expiration === "number"
        ? (k.expiration - 60 * 60 * 24 * 14) * 1000
        : null;
      return { customerId, email: emails.get(customerId) ?? null, lastNudgeAt };
    });
  } catch {}

  // ── Gift-pass funnel ──────────────────────────────────────────────────
  // Aggregate view over the grants listed below, so minted-vs-claimed is one
  // glance rather than a scroll. The count helper degrades to 0 on a
  // pre-migration database, keeping the console open.
  const [passesMinted, passesClaimed, passRedemptions, passesRevoked] = await Promise.all([
    count(env, "SELECT COUNT(*) AS n FROM promo_grants"),
    count(env, "SELECT COUNT(*) AS n FROM promo_grants WHERE redeemed_count > 0"),
    count(env, "SELECT COALESCE(SUM(redeemed_count), 0) AS n FROM promo_grants"),
    count(env, "SELECT COUNT(*) AS n FROM promo_grants WHERE revoked_at IS NOT NULL"),
  ]);

  // Optional single-account inspection: the owner pastes an email to see that
  // person's live entitlement and diagnose a support ticket without DB access.
  const lookupParam = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  let lookup: unknown = null;
  if (lookupParam) {
    try {
      const row = await env.DB.prepare(
        "SELECT id, email, subscription_tier, email_verified, stripe_customer_id, gift_expires_at FROM users WHERE email = ?",
      ).bind(lookupParam).first<{
        id: string; email: string; subscription_tier: string; email_verified: number;
        stripe_customer_id: string | null; gift_expires_at: string | null;
      }>();
      if (row) {
        const tierInfo = await resolveTier(env, row);
        const hasBaseline = !!(await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?").bind(row.id).first());
        lookup = {
          email: row.email,
          tier: tierInfo.tier,
          paid: tierInfo.paid,
          isOwner: tierInfo.isOwner,
          giftActive: tierInfo.giftActive,
          giftExpiresAt: tierInfo.giftExpiresAt,
          emailVerified: Number(row.email_verified) === 1,
          hasBaseline,
        };
      } else {
        lookup = { email: lookupParam, found: false };
      }
    } catch {
      lookup = { email: lookupParam, error: "lookup_unavailable" };
    }
  }

  return NextResponse.json({
    isOwner: true,
    ownerEmail: OWNER_EMAIL,
    limits: { freeDaily: FREE_TIER_DAILY_LIMIT, plusDaily: SOVEREIGN_PLUS_DAILY_LIMIT },
    metrics: {
      totalUsers,
      verifiedUsers,
      baselinesCompleted,
      journeysActive,
      journeysComplete,
      tiers: { free: tierFree, paidPlus: tierPaidPlus, giftedPlus: tierGiftedPlus },
      turnsToday,
      modelErrorsToday,
      dayKey: today,
    },
    billing: {
      dunningCount: dunning.length,
      dunning,
    },
    promos: {
      minted: passesMinted,
      claimed: passesClaimed,
      redemptions: passRedemptions,
      revoked: passesRevoked,
      open: grants.filter((g) => isGrantOpen(g)).length,
    },
    grants: grants.map((g) => ({
      codeHashTail: g.code_hash.slice(-8),
      durationDays: g.duration_days,
      maxRedemptions: g.max_redemptions,
      redeemedCount: g.redeemed_count,
      redeemed: Boolean(g.redeemed_by_user_id),
      note: g.note,
      expiresAt: g.expires_at,
      revokedAt: g.revoked_at,
      createdAt: g.created_at,
      open: isGrantOpen(g),
      // The console needs the hash back to revoke, but never re-exposes it as
      // a redeemable secret — the raw code was only ever shown once at mint.
      revokeKey: g.code_hash,
    })),
    lookup,
  });
}
