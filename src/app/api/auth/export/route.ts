import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { verifySession } from "@/lib/session";
import { loadUser, relationshipViews, maskEmail } from "@/lib/connections";
import type { Baseline, ChatMessage, Invite, Thread } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/auth/export` — the "see your data" half of the privacy promise.
 *
 * The policy has always said a person can ask to see their data; until now that
 * meant emailing us and waiting. This serves it directly, in one file, with no
 * interpretation applied — the same rows that are stored, nothing summarised.
 *
 * Deliberately excluded: password hash and salt (not readable, and copying
 * credential material into a downloadable file only weakens it), the live email
 * verification token, and the session generation counter.
 */
const EXPORT_RATE_LIMIT_MAX = 3;
const EXPORT_RATE_LIMIT_TTL = 3600;

export async function GET(request: NextRequest) {
  const env = await getEnv();
  // `/api/auth/*` is public in middleware (sign-in has to be), so the full
  // session check happens here — including the revocation generation.
  const session = await verifySession(env, request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.payload.sub;

  const rlKey = `rl:export:${userId}`;
  const count = parseInt((await env.SESSION_KV.get(rlKey)) || "0", 10);
  if (count >= EXPORT_RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "You've already downloaded your data a few times. Try again in an hour." },
      { status: 429 },
    );
  }
  await env.SESSION_KV.put(rlKey, String(count + 1), { expirationTtl: EXPORT_RATE_LIMIT_TTL });

  const user = await loadUser(env, userId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Clickwrap receipt (migration 0004): the user's own export carries proof of
  // the version they affirmed and when. A separate guarded read keeps `loadUser`
  // — and every pre-migration database behind it — unaffected.
  let consent: { termsVersion: string | null; termsAcceptedAt: string | null } | null = null;
  try {
    const row = await env.DB.prepare("SELECT terms_version, terms_accepted_at FROM users WHERE id = ?")
      .bind(userId)
      .first<{ terms_version: string | null; terms_accepted_at: string | null }>();
    if (row) consent = { termsVersion: row.terms_version ?? null, termsAcceptedAt: row.terms_accepted_at ?? null };
  } catch (err) {
    console.error("[export] consent receipt read failed:", err);
  }

  // ── Baseline ────────────────────────────────────────────────────────
  let baseline: Record<string, unknown> | null = null;
  try {
    const row = await env.DB.prepare(
      "SELECT dob, tob, pob, nasa_jpl_json_data, created_at, updated_at FROM baselines WHERE user_id = ?",
    )
      .bind(userId)
      .first<Baseline>();
    if (row) {
      let computed: unknown = null;
      try { computed = row.nasa_jpl_json_data ? JSON.parse(row.nasa_jpl_json_data) : null; } catch { computed = null; }
      baseline = { dob: row.dob, tob: row.tob, pob: row.pob, computed, createdAt: row.created_at, updatedAt: row.updated_at };
    }
  } catch (err) {
    console.error("[export] baseline failed:", err);
  }

  // ── Conversations ───────────────────────────────────────────────────
  const conversations: Array<{ id: string; createdAt: string; updatedAt: string; messages: ChatMessage[] }> = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT id, created_at, updated_at, message_history FROM threads WHERE user_id = ? ORDER BY created_at",
    )
      .bind(userId)
      .all<Thread>();
    for (const t of rows.results ?? []) {
      let messages: ChatMessage[] = [];
      try { messages = JSON.parse(t.message_history) as ChatMessage[]; } catch { messages = []; }
      conversations.push({ id: t.id, createdAt: t.created_at, updatedAt: t.updated_at, messages });
    }
  } catch (err) {
    console.error("[export] threads failed:", err);
  }

  // ── Journeys (table appears with the journeys migration; absent is fine) ──
  let journeys: unknown[] = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT id, goal, current_step, steps_json, milestones_json, visual_progress, status, created_at, updated_at FROM journeys WHERE user_id = ? ORDER BY created_at",
    )
      .bind(userId)
      .all<Record<string, unknown>>();
    journeys = rows.results ?? [];
  } catch {
    journeys = [];
  }

  // ── Journey events (append-only audit trail of milestone unlocks) ──
  let journeyEvents: unknown[] = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT id, journey_id, milestone, source, created_at FROM journey_events WHERE user_id = ? ORDER BY created_at",
    )
      .bind(userId)
      .all<Record<string, unknown>>();
    journeyEvents = rows.results ?? [];
  } catch {
    journeyEvents = [];
  }

  // ── Chat usage (per-UTC-day message counters; no content, just counts) ──
  let chatUsage: Array<{ day: string; used: number }> = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT day, used FROM chat_usage WHERE user_id = ? ORDER BY day",
    )
      .bind(userId)
      .all<{ day: string; used: number }>();
    chatUsage = rows.results ?? [];
  } catch {
    chatUsage = [];
  }

  // ── Passkeys (metadata only — public_key stays in D1; it's a crypto
  // artefact whose disclosure has no user-facing value and only widens blast
  // radius if the export file leaks). ──
  let passkeys: Array<Record<string, unknown>> = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT credential_id, label, transports, counter, created_at, last_used_at FROM passkeys WHERE user_id = ? ORDER BY created_at",
    )
      .bind(userId)
      .all<Record<string, unknown>>();
    passkeys = rows.results ?? [];
  } catch {
    passkeys = [];
  }

  // ── Promo grants (both directions: passes this account minted, and any
  // pass this account redeemed — see schema.sql promo_grants). The raw code
  // is never stored (only its SHA-256), so `code_hash` is safe to include. ──
  let promoGrantsCreated: Array<Record<string, unknown>> = [];
  let promoGrantsRedeemed: Array<Record<string, unknown>> = [];
  try {
    const created = await env.DB.prepare(
      "SELECT code_hash, duration_days, max_redemptions, redeemed_count, note, expires_at, revoked_at, created_at FROM promo_grants WHERE created_by = ? ORDER BY created_at",
    )
      .bind(userId)
      .all<Record<string, unknown>>();
    promoGrantsCreated = created.results ?? [];
  } catch {
    promoGrantsCreated = [];
  }
  try {
    const redeemed = await env.DB.prepare(
      "SELECT code_hash, duration_days, redeemed_count, expires_at, revoked_at, created_at FROM promo_grants WHERE redeemed_by_user_id = ?",
    )
      .bind(userId)
      .all<Record<string, unknown>>();
    promoGrantsRedeemed = redeemed.results ?? [];
  } catch {
    promoGrantsRedeemed = [];
  }

  // ── Connections (name + role + consent flags — never another person's data) ──
  let connections: unknown[] = [];
  try {
    connections = await relationshipViews(env, user);
  } catch (err) {
    console.error("[export] relationships failed:", err);
  }

  // ── Invitations this account has sent ───────────────────────────────
  let invitations: Array<Record<string, unknown>> = [];
  try {
    const rows = await env.DB.prepare(
      "SELECT id, email, role, invitee_name, status, created_at, expires_at, accepted_at FROM invites WHERE owner_user_id = ? ORDER BY created_at",
    )
      .bind(userId)
      .all<Invite>();
    invitations = (rows.results ?? []).map((i) => ({
      id: i.id,
      // Masked: this is the user's own record of who they invited, and an export
      // file is the easiest artefact in the product to lose.
      emailMasked: maskEmail(i.email),
      role: i.role,
      name: i.invitee_name ?? null,
      status: i.status,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
      acceptedAt: i.accepted_at,
    }));
  } catch (err) {
    console.error("[export] invites failed:", err);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    formatVersion: 2,
    account: {
      id: user.id,
      email: user.email,
      displayName: user.display_name ?? null,
      emailVerified: Boolean(user.email_verified),
      subscriptionTier: user.subscription_tier,
      stripeCustomerId: user.stripe_customer_id ?? null,
      memberSince: user.created_at,
      // Server-side memory preference — 'local' accounts keep their chat
      // history only in the browser's encrypted IndexedDB, so it is not
      // present in this payload and cannot be reconstructed from the server.
      memoryMode: user.memory_mode ?? "server",
      // The consent receipt travels with the data it authorises.
      consent,
    },
    baseline,
    conversations,
    journeys,
    journeyEvents,
    chatUsage,
    passkeys,
    connections,
    invitations,
    promoGrantsCreated,
    promoGrantsRedeemed,
    notes: [
      "Passwords are stored only as a salted, one-way hash and are not included in this export.",
      "Live email-verification and password-reset tokens are not included; they expire on their own.",
      "Payment records (invoices, receipts, card details) are held by Stripe as our payment processor and are not stored on our servers. Open the billing portal to retrieve them from Stripe.",
      "Passkey public keys are not included — they are cryptographic material only your device and this server ever need, and copying them into a downloadable file only widens exposure.",
      "If your memory mode is set to 'local', your chat history is kept encrypted in this browser only and is not stored on our servers — nothing under `conversations` will appear for those threads.",
      "Semantic-recall embeddings for your messages are stored in Cloudflare Vectorize as high-dimensional coordinates with no readable text; deleting your account sweeps them.",
      "Deleting your account removes every row above immediately. A few operational records survive only until their short expiry: rate-limit counters (up to an hour) and email-delivery markers (up to 30 days).",
    ],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sovereign-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}