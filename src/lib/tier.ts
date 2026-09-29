/**
 * Tier resolution — the single source of truth for "is this person Sovereign+?"
 *
 * The stored `users.subscription_tier` column is a cache, not the answer.
 * Three things can make it stale in either direction:
 *
 *  - the owner account (verified `OWNER_EMAIL`) is Sovereign+ by right, with
 *    no Stripe row behind it — the column is corrected on the first
 *    authenticated read and stays put afterwards;
 *  - a gifted pass (`gift_expires_at`) that has lapsed — without a paid
 *    subscription underneath, Sovereign+ ends the moment the pass does;
 *  - a dropped Stripe webhook (handled by the existing ≤1×/6h sync in
 *    /api/auth, which this module does not replace or duplicate).
 *
 * `resolveTier` reads the live signals, self-heals the column in both
 * directions, and returns the effective tier. Every surface that gates on
 * Sovereign+ (the session probe, /api/chat, the connections helper behind
 * invites and relationships) goes through here, so an owner and a just-gifted
 * person are treated identically everywhere at once — and a lapsed gift stops
 * working everywhere at once.
 */
import type { AppEnv } from "./env";
import type { SubscriptionTier } from "./types";

/** The owner's email. Comparison is always lowercase and trimmed. */
export const OWNER_EMAIL = "chadowen93@gmail.com";

/** The owner's automated test/verification identity, kept available so the
 *  Playwright walks can exercise real account surfaces. */
export const TEST_ACCOUNT_EMAIL = "defragapp@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === OWNER_EMAIL;
}

/** D1's datetime('now') shape: UTC, no marker, second precision. Gift
 *  expiries are written in the same shape so they read back identically on
 *  every surface; a JS Date is normalised here, never at the call site. */
export function toSqliteUtc(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

/** Parse either shape (SQLite UTC or full ISO) to milliseconds. */
export function parseSqliteUtc(value: string): number {
  return value.includes("T")
    ? Date.parse(value)
    : Date.parse(value.replace(" ", "T") + "Z");
}

export interface TierUser {
  id: string;
  email?: string | null;
  subscription_tier?: SubscriptionTier | string | null;
  stripe_customer_id?: string | null;
  email_verified?: number | null;
  /** null = no pass; undefined = the caller's row was selected without the
   *  column (pre-migration databases) and must be probed. */
  gift_expires_at?: string | null;
}

export interface TierResolution {
  tier: SubscriptionTier;
  /** True only for the verified owner account. */
  isOwner: boolean;
  /** A paid (Stripe-backed) Sovereign+ — distinguishes from a gifted pass in
   *  the account surface; usage limits do not care. */
  paid: boolean;
  /** True while a gift pass is live, whatever the column says. */
  giftActive: boolean;
  /** Raw `gift_expires_at` (SQLite UTC) when a pass exists. */
  giftExpiresAt: string | null;
}

function giftIsLive(raw: string | null, now: Date): boolean {
  if (!raw) return false;
  const ms = parseSqliteUtc(raw);
  return Number.isFinite(ms) && ms > now.getTime();
}

/**
 * Resolve the live tier for a loaded user row, self-healing
 * `users.subscription_tier` when the column disagrees with reality.
 */
export async function resolveTier(env: AppEnv, user: TierUser): Promise<TierResolution> {
  const now = new Date();
  const isOwner = isOwnerEmail(user.email ?? null) && Number(user.email_verified) === 1;
  let gift = user.gift_expires_at ?? null;
  let tier = (user.subscription_tier === "sovereign+" ? "sovereign+" : "free") as SubscriptionTier;

  if (isOwner) {
    if (tier !== "sovereign+") await writeTier(env, user.id, "sovereign+");
    return { tier: "sovereign+", isOwner: true, paid: Boolean(user.stripe_customer_id), giftActive: false, giftExpiresAt: gift };
  }

  // Probe the live expiry when the caller's row predates the migration or was
  // selected without the column (the defensive-select pattern used across
  // routes). A `null` the caller explicitly carried is truth — no re-probe.
  if (gift === null && user.gift_expires_at === undefined) {
    const probed = await probeGiftExpiry(env, user.id);
    if (probed !== undefined) gift = probed;
  }

  const live = giftIsLive(gift, now);
  if (live && tier !== "sovereign+") {
    await writeTier(env, user.id, "sovereign+");
    tier = "sovereign+";
  }
  // A lapsed pass with no Stripe customer behind it is free — the pass was the
  // only thing holding Sovereign+ up. (A paying customer keeps its tier; the
  // 6-hourly sync owns that column.) `gift` is truthy here, so an account that
  // was always free — never a pass row — is left exactly as it was.
  if (!live && tier === "sovereign+" && !user.stripe_customer_id && gift) {
    await writeTier(env, user.id, "free");
    tier = "free";
  }

  return {
    tier,
    isOwner: false,
    paid: tier === "sovereign+" && Boolean(user.stripe_customer_id),
    giftActive: live,
    giftExpiresAt: gift,
  };
}

/** `undefined` = the signal is unavailable (no column, read failed) — keep
 *  whatever the caller had. `null` = genuinely no pass. */
async function probeGiftExpiry(env: AppEnv, userId: string): Promise<string | null | undefined> {
  try {
    const row = await env.DB.prepare("SELECT gift_expires_at FROM users WHERE id = ?")
      .bind(userId)
      .first<{ gift_expires_at: string | null }>();
    return row ? row.gift_expires_at ?? null : null;
  } catch {
    // Pre-migration databases have no column; the caller proceeds on the
    // stored tier, exactly as before this resolver existed.
    return undefined;
  }
}

async function writeTier(env: AppEnv, userId: string, tier: SubscriptionTier): Promise<void> {
  try {
    // `IS NOT ?` is SQLite null-safe inequality: only write when the stored
    // tier actually differs (the same guard syncStripeTier uses).
    await env.DB.prepare(
      "UPDATE users SET subscription_tier = ?, updated_at = datetime('now') WHERE id = ? AND subscription_tier IS NOT ?",
    ).bind(tier, userId, tier).run();
  } catch (err) {
    // Self-healing is best-effort: a failed write costs one correction pass,
    // never the request — the returned tier is still the live truth.
    console.error("[tier] tier write failed:", err);
  }
}

/**
 * The Sovereign+ gate for API routes: resolve the live tier, then answer the
 * one question every plus-gated surface asks. Gifted passes and owner
 * elevation count exactly as paid subscriptions do here, and a lapsed gift
 * stops counting everywhere at once — because this is the only shape the
 * gates should use.
 */
export async function hasPlusEntitlement(env: AppEnv, user: TierUser): Promise<boolean> {
  return (await resolveTier(env, user)).tier === "sovereign+";
}
