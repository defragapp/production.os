/**
 * Custom Worker entry point for Sovereign OS.
 *
 * OpenNext's generated `.open-next/worker.js` only exports a `fetch` handler.
 * Cloudflare Cron Triggers require a `scheduled` handler on the Worker's
 * default export. This file re-uses the generated fetch handler and adds the
 * scheduled cleanup job.
 *
 * Wrangler's `main` points here instead of `.open-next/worker.js`.
 *
 * Cron schedule: daily at 03:00 UTC (see wrangler.jsonc "triggers").
 *
 * Cleanup targets:
 * 1. Expired email-verification tokens (users.verification_token)
 * 2. Expired/stale invites (invites.expires_at + 7-day grace)
 * 3. Old chat_usage rows (chat_usage.day — never queried past the rolling window)
 * 4. Journey events from completed journeys older than 180 days (audit trail retention)
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .open-next/worker.js is generated at build time
import { default as handler } from "../.open-next/worker.js";

interface ScheduledController {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
}

interface Env {
  DB: D1Database;
  SESSION_KV: KVNamespace;
}

async function runCleanup(env: Env): Promise<string[]> {
  const results: string[] = [];
  const now = new Date();
  const isoNow = now.toISOString();

  // 1. Purge expired verification tokens (72-hour expiry set at signup).
  //    The signup flow already does opportunistic cleanup, but that only
  //    touches new signups — existing rows with stale tokens are never cleaned.
  const tokenPurge = await env.DB.prepare(
    "UPDATE users SET verification_token = NULL, verification_expires = NULL WHERE verification_expires IS NOT NULL AND verification_expires < ?",
  )
    .bind(isoNow)
    .run();
  results.push(`verification_tokens: ${tokenPurge.meta.changes ?? 0} purged`);

  // 2. Expire stale invites: those past their `expires_at` + 7 days of grace
  //    become "revoked" so the owner sees a clean state in /invite.
  const graceMs = 7 * 24 * 60 * 60 * 1000;
  const graceDate = new Date(now.getTime() - graceMs).toISOString();
  const invitePurge = await env.DB.prepare(
    "UPDATE invites SET status = 'revoked' WHERE status = 'pending' AND expires_at < ?",
  )
    .bind(graceDate)
    .run();
  results.push(`expired_invites: ${invitePurge.meta.changes ?? 0} revoked`);

  // 3. Purge chat_usage rows older than 90 days.
  //    Free-tier daily cap only queries current-day rows;
  //    older rows are historical noise that inflates the table.
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD
  const usagePurge = await env.DB.prepare(
    "DELETE FROM chat_usage WHERE day < ?",
  )
    .bind(ninetyDaysAgo)
    .run();
  results.push(`chat_usage: ${usagePurge.meta.changes ?? 0} rows removed`);

  // 4. Journey events from completed journeys older than 180 days.
  //    The journey_events table is an append-only audit trail; completed
  //    journeys that are 6+ months old are unlikely to need replay but
  //    accumulate read cost.
  const hundredEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const eventPurge = await env.DB.prepare(
    `DELETE FROM journey_events
     WHERE created_at < ?
       AND journey_id IN (SELECT id FROM journeys WHERE status = 'complete')`,
  )
    .bind(hundredEightyDaysAgo)
    .run();
  results.push(`journey_events: ${eventPurge.meta.changes ?? 0} archived`);

  return results;
}

export default {
  fetch: handler.fetch,

  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    try {
      const results = await runCleanup(env);
      console.log(`[cron ${controller.cron}] ${results.join(" | ")}`);
    } catch (err) {
      // Log but don't throw — Cloudflare retries a failed scheduled handler
      // up to 3 times. Most cleanup failures are transient (D1 cold path).
      console.error(`[cron ${controller.cron}] FAILED:`, err);
      throw err; // Let CF retry; the operations are idempotent.
    }
  },
} satisfies ExportedHandler<Env>;

// Required for DO Queue / Tag Cache support (unused now but future-safe).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — these may not exist on the generated handler object
export const { DOQueueHandler, DOShardedTagCache } = handler;
