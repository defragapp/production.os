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
 *
 * Transit scan (Turn 10): after cleanup, one daily pass computes the significant
 * transits against every account's stored natal baseline and enqueues at most
 * one soft nudge per user per UTC day (see runTransitScan below).
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .open-next/worker.js is generated at build time
import handler, { DOQueueHandler, DOShardedTagCache } from "../.open-next/worker.js";
import type { AppEnv } from "./lib/env";
import { computeNatalPositions } from "./lib/nasa-jpl";
import { detectSignificantTransits, nudgeText, resolveConjunctionOrb, type NatalPositions } from "./lib/transit-signals";

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

/**
 * Extract { body → { longitude } } from a stored baseline payload. Inlined (and
 * kept free of any next/server dependency) because the Worker entry must not
 * pull Next.js route runtime into the scheduled handler. Mirrors the natal parse
 * sovereign-connections uses, reading only `astrology.planets[*].longitude`.
 */
function natalFromBaseline(raw: Record<string, unknown> | undefined): NatalPositions {
  const astrology = (raw?.astrology as Record<string, unknown> | undefined) ?? {};
  const planets = (astrology.planets as Record<string, Record<string, unknown>> | undefined) ?? {};
  const out: NatalPositions = {};
  for (const [body, p] of Object.entries(planets)) {
    const lon = p?.longitude;
    if (typeof lon === "number" && Number.isFinite(lon)) out[body] = { longitude: lon };
  }
  return out;
}

/** D1 page size for the global baseline sweep — bounded so a large table never
 *  loads every row into one isolate at once. Keyset-free OFFSET paging is fine
 *  here: the scan runs once a day and baselines are keyed by user_id. */
const TRANSIT_SCAN_PAGE = 50;

/**
 * One daily transit pass (Turn 10).
 *
 * Fetches the live sky at a fixed 00:00 UTC instant for today and yesterday
 * (two JPL fan-outs, KV-cached and coalesced — negligible at current volume),
 * then pages every account's stored natal baseline, detects the transits that
 * crossed in the last day, and enqueues the first hit per user per UTC day.
 *
 * Idempotency is enforced by a same-day existence check, so a re-run (or a
 * scheduled-handler retry) never double-inserts. Returns a compact count string
 * for the cron log. May throw — the caller isolates it so a scan failure never
 * masks a successful cleanup run.
 */
async function runTransitScan(env: AppEnv): Promise<string> {
  const now = new Date();
  // Day-granularity instants: a fixed 00:00 UTC boundary reused for the whole
  // UTC day, so the minute-precision ephemeris cache key is stable all day.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today.getTime() - 86_400_000);
  const dateTag = today.toISOString().slice(0, 10);

  const cur = await computeNatalPositions(env, today);
  const prev = await computeNatalPositions(env, yesterday);
  const orb = resolveConjunctionOrb(env);

  let created = 0;
  let scanned = 0;
  let offset = 0;
  for (;;) {
    const page = await env.DB.prepare(
      "SELECT user_id, nasa_jpl_json_data FROM baselines WHERE nasa_jpl_json_data IS NOT NULL ORDER BY user_id LIMIT ? OFFSET ?",
    )
      .bind(TRANSIT_SCAN_PAGE, offset)
      .all<{ user_id: string; nasa_jpl_json_data: string }>();
    const rows = page.results ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned++;
      let natal: NatalPositions;
      try {
        natal = natalFromBaseline(JSON.parse(row.nasa_jpl_json_data) as Record<string, unknown>);
      } catch {
        continue; // a malformed baseline blob is skipped, never fatal to the sweep
      }
      const hits = detectSignificantTransits(natal, cur, prev, orb, dateTag);
      if (hits.length === 0) continue;

      // One nudge per user per UTC day: skip if today's transit row already exists.
      const existing = await env.DB.prepare(
        "SELECT 1 AS x FROM nudge WHERE user_id = ? AND kind = 'transit' AND date(created_at) = date('now') LIMIT 1",
      )
        .bind(row.user_id)
        .first();
      if (existing) continue;

      await env.DB.prepare(
        "INSERT INTO nudge (id, user_id, kind, text) VALUES (?, ?, 'transit', ?)",
      )
        .bind(crypto.randomUUID(), row.user_id, nudgeText(hits[0]))
        .run();
      created++;
    }

    if (rows.length < TRANSIT_SCAN_PAGE) break;
    offset += TRANSIT_SCAN_PAGE;
  }

  return `transit_nudges: ${created} created (${scanned} baselines scanned)`;
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
    // Transit scan runs after cleanup in its own boundary: a JPL hiccup or a
    // bad baseline blob must not mask an already-successful cleanup, and the
    // scan is idempotent (same-day dedup) so it simply retries tomorrow. Do NOT
    // re-throw here — that would re-trigger the cleanup pass above.
    try {
      const scan = await runTransitScan(env as unknown as AppEnv);
      console.log(`[cron ${controller.cron}] ${scan}`);
    } catch (err) {
      console.error(`[cron ${controller.cron}] transit scan FAILED:`, err);
    }
  },
} satisfies ExportedHandler<Env>;

// OpenNext's Durable Object exports must be re-exported BY NAME from this
// module. They used to be destructured off the default export
// (`export const { DOQueueHandler, DOShardedTagCache } = handler`), but the
// default export only carries `fetch` — so both names re-exported `undefined`,
// and workerd refused to start the Worker at all ("Cannot initialize
// ExportedHandler with required members from an undefined or null value").
// Deploys kept working (the platform tolerates undefined exports), which is
// why this went unnoticed, but every LOCAL boot failed — and because
// verify:release SKIPS its live gates when the preview worker cannot come up,
// the ratchet reported 99/99 PASS with ~60 checks never actually executed.
export { DOQueueHandler, DOShardedTagCache };
