/**
 * Owner audit log (#49) — a durable, append-only record of owner entitlement
 * actions so mint/revoke of a Sovereign+ gift pass is provable after the fact,
 * not just visible in ephemeral console state.
 *
 * Three forced divergences from the legacy `SOVV:utils/audit.ts`, each pinned by
 * `audit.test.ts`:
 *   1. No `ip` column — an audit table is durable storage and must not adopt the
 *      raw-IP habit that #62 just removed from the ephemeral KV keys.
 *   2. `actor_email_hash` (SHA-256), never the raw email — the SHA-256-only
 *      posture already used for promo codes and reset/invite tokens.
 *   3. `actor_id` has no FK, so `account/route.ts`'s `ON DELETE CASCADE` hard
 *      delete cannot erase the record of what the account did beforehand.
 */
import type { AppEnv } from "./env";

/**
 * The actions we actually record today. Scoped to what has a real caller (the
 * owner promo route) so the union cannot rot into a list of intentions — the
 * coverage test greps the route to prove every member is reachable.
 */
export type AuditAction = "promo.grant_mint" | "promo.grant_revoke";

export interface AuditEntry {
  actorId: string;
  /** Raw email. Hashed here; never written to the row. */
  actorEmail: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  /** Small, structured detail (ids/counts only) — never a redeemable secret. */
  metadata?: Record<string, unknown>;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Append one audit row. Fail-silent by design: this records a mutation that has
 * ALREADY succeeded, so throwing would turn a completed owner action into a 500
 * and invite a retry that double-applies it. Losing one audit row is strictly
 * better than breaking the user-facing write. The catch is deliberate, not lazy.
 */
export async function writeAuditLog(env: AppEnv, entry: AuditEntry): Promise<void> {
  try {
    const actorEmailHash = await sha256Hex(entry.actorEmail);
    const metadata = entry.metadata ? JSON.stringify(entry.metadata) : null;
    await env.DB.prepare(
      `INSERT INTO admin_audit_log (id, actor_id, actor_email_hash, action, target_type, target_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), entry.actorId, actorEmailHash, entry.action, entry.targetType ?? null, entry.targetId ?? null, metadata)
      .run();
  } catch (err) {
    // Swallowed on purpose (see the doc above). One console line is the only
    // observable signal — it must never become a thrown error.
    console.warn("[audit] write failed (non-fatal):", err);
  }
}
