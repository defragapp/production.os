/**
 * Promo grants — owner-minted passes to Sovereign+.
 *
 * A grant is a high-entropy link the owner mints in the Owner Console and sends
 * through iMessage or email. The recipient opens /redeem, signs in (or creates
 * an account first), and the pass lands: `subscription_tier = 'sovereign+'`
 * with `gift_expires_at` thirty days out. When the pass lapses the tier
 * resolver returns the account to free — unless a paid subscription was added
 * underneath, which owns the tier from then on.
 *
 * Posture, deliberately:
 *  - a pass attaches to whoever redeems it. There is no recipient email and no
 *    name in `promo_grants` — only the owner's own optional note;
 *  - D1 stores only the SHA-256 hash of the code, for the same reason invite
 *    and reset tokens are hashed: a leaked table must not mint free passes.
 *    The raw code exists only in the owner's clipboard and the link;
 *  - the claim is one conditional UPDATE, so capacity, expiry, revocation and
 *    a double-redeem are enforced in the WHERE clause — the same atomic-claim
 *    shape `usage.ts` uses for the daily cap (KV read-modify-write was the
 *    pattern this repo already rejected for being bypassable).
 */
import { hashResetToken } from "./auth";
import { toSqliteUtc, parseSqliteUtc } from "./tier";
import type { AppEnv } from "./env";

export const GIFT_DEFAULT_DAYS = 30;
export const GIFT_MIN_DAYS = 1;
export const GIFT_MAX_DAYS = 365;
export const GIFT_MAX_REDEMPTIONS = 10;
/** An unclaimed link stops working after 90 days; the pass starts its own clock. */
export const GIFT_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** Codes are `sov_gift_` + 32 base64url characters (24 random bytes). */
export const GIFT_CODE_MAX_LENGTH = 64;

export interface PromoGrantRow {
  code_hash: string;
  created_by: string;
  duration_days: number;
  max_redemptions: number;
  redeemed_count: number;
  redeemed_by_user_id: string | null;
  note: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

/** Columns every grant read uses — one place, so a shape change is one edit. */
export const PROMO_GRANT_SELECT =
  "SELECT code_hash, created_by, duration_days, max_redemptions, redeemed_count, redeemed_by_user_id, note, expires_at, revoked_at, created_at FROM promo_grants";

export function isGrantOpen(
  g: Pick<PromoGrantRow, "max_redemptions" | "redeemed_count" | "expires_at" | "revoked_at">,
  now: Date = new Date(),
): boolean {
  if (g.revoked_at) return false;
  if (g.redeemed_count >= g.max_redemptions) return false;
  if (!g.expires_at) return true;
  const ms = parseSqliteUtc(g.expires_at);
  return Number.isFinite(ms) && ms > now.getTime();
}

/** Clamp mint input to what the surface allows. The route trusts nothing the
 *  console brought: a hand-crafted request cannot mint a 100-year pass. */
export function sanitizeDuration(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return GIFT_DEFAULT_DAYS;
  return Math.min(GIFT_MAX_DAYS, Math.max(GIFT_MIN_DAYS, n));
}

export function sanitizeMaxRedemptions(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(GIFT_MAX_REDEMPTIONS, Math.max(1, n));
}

export function sanitizeNote(value: unknown): string | null {
  const cleaned = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  return cleaned || null;
}

/** `sov_gift_<24 random bytes, base64url>`. crypto.getRandomValues is the only
 *  entropy source — a minted code must not be guessable from its neighbours. */
export function generateGiftCode(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const rand = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `sov_gift_${rand}`;
}

/** The link the console copies. `origin` comes from the request, never from a
 *  stored value, so a mint on preview can't hand out a production URL. */
export function giftLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/redeem?code=${encodeURIComponent(code)}`;
}

export async function lookupGrant(env: AppEnv, codeHash: string): Promise<PromoGrantRow | null> {
  try {
    return await env.DB.prepare(`${PROMO_GRANT_SELECT} WHERE code_hash = ?`).bind(codeHash).first<PromoGrantRow>();
  } catch {
    // Pre-migration database: the surface simply has no passes.
    return null;
  }
}

export async function listGrants(env: AppEnv, ownerUserId: string, limit = 50): Promise<PromoGrantRow[]> {
  try {
    const res = await env.DB.prepare(`${PROMO_GRANT_SELECT} WHERE created_by = ? ORDER BY created_at DESC LIMIT ?`)
      .bind(ownerUserId, limit).all<PromoGrantRow>();
    return res.results || [];
  } catch {
    return [];
  }
}

export interface MintResult {
  code: string;
  grant: PromoGrantRow;
}

/** Insert a grant and return it with the one-time plaintext code. */
export async function createGrant(
  env: AppEnv,
  ownerUserId: string,
  opts: { durationDays?: unknown; maxRedemptions?: unknown; note?: unknown },
): Promise<MintResult> {
  const durationDays = sanitizeDuration(opts.durationDays);
  const maxRedemptions = sanitizeMaxRedemptions(opts.maxRedemptions);
  const note = sanitizeNote(opts.note);
  const expiresAt = toSqliteUtc(new Date(Date.now() + GIFT_LINK_TTL_MS));
  const code = generateGiftCode();
  const codeHash = await hashResetToken(code);
  await env.DB.prepare(
    `INSERT INTO promo_grants (code_hash, created_by, duration_days, max_redemptions, redeemed_count, note, expires_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).bind(codeHash, ownerUserId, durationDays, maxRedemptions, note, expiresAt).run();
  const grant = await lookupGrant(env, codeHash);
  if (!grant) throw new Error("promo grant write failed");
  return { code, grant };
}

export type RedeemClaim =
  | { ok: true; durationDays: number }
  | { ok: false; status: number; error: string; code: string };

/**
 * Claim one redemption atomically. Returns the grant's duration on success;
 * every refusal names itself so the page can say something specific.
 */
export async function claimGrant(env: AppEnv, userId: string, codeHash: string): Promise<RedeemClaim> {
  const nowSql = toSqliteUtc(new Date());
  const claimed = await env.DB.prepare(
    `UPDATE promo_grants
     SET redeemed_count = redeemed_count + 1, redeemed_by_user_id = ?
     WHERE code_hash = ?
       AND revoked_at IS NULL
       AND redeemed_count < max_redemptions
       AND (expires_at IS NULL OR expires_at > ?)
       AND (redeemed_by_user_id IS NULL OR redeemed_by_user_id != ?)
     RETURNING duration_days`,
  ).bind(userId, codeHash, nowSql, userId).first<{ duration_days: number }>();
  if (claimed) return { ok: true, durationDays: Number(claimed.duration_days) };

  const grant = await lookupGrant(env, codeHash);
  if (!grant) return { ok: false, status: 404, error: "That pass doesn't exist or its link has been used.", code: "gift_not_found" };
  if (grant.revoked_at) return { ok: false, status: 410, error: "That pass was withdrawn by the sender.", code: "gift_revoked" };
  if (grant.redeemed_by_user_id === userId) return { ok: false, status: 409, error: "You already redeemed this pass.", code: "gift_already_redeemed" };
  if (grant.redeemed_count >= grant.max_redemptions) return { ok: false, status: 409, error: "That pass has already been claimed.", code: "gift_claimed" };
  return { ok: false, status: 410, error: "That pass link has expired. Ask the sender for a new one.", code: "gift_expired" };
}

/**
 * The expiry a claim produces: a live pass gains its days on top of the time
 * remaining (a second gift is a longer trial, not a reset), an expired or
 * absent pass starts a fresh clock at now.
 */
export function nextGiftExpiry(current: string | null, durationDays: number, now: Date = new Date()): string {
  let base = now.getTime();
  if (current) {
    const ms = parseSqliteUtc(current);
    if (Number.isFinite(ms) && ms > base) base = ms;
  }
  return toSqliteUtc(new Date(base + durationDays * 24 * 60 * 60 * 1000));
}

/** Write the pass. Shared by the recipient's redemption and the owner's
 *  direct grant, so both upgrade through exactly one semantic. */
export async function applyGift(env: AppEnv, userId: string, giftExpiresAt: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE users SET gift_expires_at = ?, subscription_tier = 'sovereign+', updated_at = datetime('now') WHERE id = ?",
  ).bind(giftExpiresAt, userId).run();
}

/**
 * Truncate a pass (the owner's "revoke access" on a known account, and the
 * revoke path for a claimed grant). `datetime('now')` rather than NULL keeps
 * the history readable: the account shows it held a pass that has ended.
 */
export async function truncateGift(env: AppEnv, userId: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE users SET gift_expires_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  ).bind(userId).run();
}

export interface RevokeResult {
  revoked: boolean;
  recipientDowngraded: boolean;
}

/**
 * Revoke a minted grant. An unclaimed link simply closes. A claimed one also
 * truncates the recipient's pass — but only when that grant was the pass they
 * last took, so withdrawing one link never silently deletes a different pass
 * still running.
 */
export async function revokeGrant(env: AppEnv, ownerUserId: string, codeHash: string): Promise<RevokeResult> {
  const nowSql = toSqliteUtc(new Date());
  const updated = await env.DB.prepare(
    "UPDATE promo_grants SET revoked_at = ? WHERE code_hash = ? AND created_by = ? AND revoked_at IS NULL RETURNING redeemed_by_user_id",
  ).bind(nowSql, codeHash, ownerUserId).first<{ redeemed_by_user_id: string | null }>();
  if (!updated) return { revoked: false, recipientDowngraded: false };
  const recipient = updated.redeemed_by_user_id;
  if (!recipient) return { revoked: true, recipientDowngraded: false };

  const last = await env.DB.prepare(
    "SELECT code_hash FROM promo_grants WHERE redeemed_by_user_id = ? ORDER BY created_at DESC LIMIT 1",
  ).bind(recipient).first<{ code_hash: string }>();
  if (last && last.code_hash === codeHash) {
    await truncateGift(env, recipient);
    return { revoked: true, recipientDowngraded: true };
  }
  return { revoked: true, recipientDowngraded: false };
}
