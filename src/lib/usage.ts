/**
 * Free-tier daily AI usage.
 *
 * The previous implementation kept a JSON array of timestamps in KV and did a
 * read-modify-write. KV has no compare-and-swap, so two concurrent requests
 * could both read "4 used" and both be admitted — the 5/day cap was advisory
 * under concurrency (the old code noted this in a comment). D1 is transactional,
 * so the slot is now claimed with a single atomic UPSERT.
 *
 * Claim-then-release rather than count-after-success: the gate has to run
 * BEFORE generation (there is no point generating an answer we will refuse to
 * serve), so a claim that turns out to be wasted is returned with
 * `releaseFreeAnswer`.
 */
import type { AppEnv } from "./env";

/** UTC calendar day, matching the previous `toISOString().slice(0, 10)` key. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface UsageClaim {
  /** True when a slot was claimed; false when the daily cap is already spent. */
  claimed: boolean;
  /** Slots used today, after the claim (or the current total when refused). */
  used: number;
  /**
   * True when the counter could not be consulted at all. Callers let the
   * request through — a missing table is a deploy-ordering bug, not a reason to
   * take the product offline for every free account.
   */
  degraded: boolean;
}

/**
 * Atomically claim one of `limit` daily answers for `userId`.
 *
 * The `WHERE used < ?` lives on the DO UPDATE branch, so once the cap is spent
 * the statement matches nothing and returns no row. That single statement is
 * what makes the limit exact under concurrent requests.
 */
export async function claimFreeAnswer(env: AppEnv, userId: string, limit: number): Promise<UsageClaim> {
  const day = todayUtc();
  try {
    const claimed = await env.DB.prepare(
      `INSERT INTO chat_usage (user_id, day, used) VALUES (?, ?, 1)
       ON CONFLICT(user_id, day) DO UPDATE SET used = used + 1
       WHERE chat_usage.used < ?
       RETURNING used`,
    )
      .bind(userId, day, limit)
      .first<{ used: number }>();

    if (claimed) return { claimed: true, used: Number(claimed.used), degraded: false };

    // No row returned: the conflict branch's WHERE was false, i.e. the cap is
    // spent. Read the live total so the UI can show an accurate gauge.
    const current = await readUsage(env, userId);
    return { claimed: false, used: current, degraded: false };
  } catch (err) {
    console.error("[usage] claim failed — is migration 0002_chat_usage.sql applied?", err);
    return { claimed: true, used: 0, degraded: true };
  }
}

/**
 * Give a claimed slot back when generation failed, so a person is not charged
 * for an answer they never received. Never drops below zero.
 */
export async function releaseFreeAnswer(env: AppEnv, userId: string): Promise<void> {
  try {
    await env.DB.prepare(
      "UPDATE chat_usage SET used = used - 1 WHERE user_id = ? AND day = ? AND used > 0",
    )
      .bind(userId, todayUtc())
      .run();
  } catch (err) {
    // Losing a refund costs one free answer; never fail the request over it.
    console.error("[usage] release failed:", err);
  }
}

/** Slots used today. Returns 0 when the counter cannot be read. */
export async function readUsage(env: AppEnv, userId: string): Promise<number> {
  try {
    const row = await env.DB.prepare("SELECT used FROM chat_usage WHERE user_id = ? AND day = ?")
      .bind(userId, todayUtc())
      .first<{ used: number | null }>();
    return Number(row?.used ?? 0) || 0;
  } catch (err) {
    console.error("[usage] read failed — is migration 0002_chat_usage.sql applied?", err);
    return 0;
  }
}
