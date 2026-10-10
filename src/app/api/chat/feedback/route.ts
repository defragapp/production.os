/**
 * POST /api/chat/feedback — the live "Did this land?" signal (WS3).
 *
 * Request body:
 *   { threadId: string; turnIndex: number; value: "landed" | "missed" }
 *
 * Response 200:
 *   { ok: true, stored: boolean }   // stored:false for a zero-retention account
 *
 * This is the one product-quality signal the offline rubric can never be: a
 * person telling us the answer did (or did not) land. It is deliberately
 * content-free — one enum per (person, thread, turn), no answer text — and
 * server-memory only. A `memory_mode='local'` account has a zero-retention
 * contract (/api/chat writes nothing for it), so this route refuses to persist
 * for those accounts and answers `stored:false`; the client does not offer the
 * control to them either. The two are independent guards on the same promise.
 *
 * Failure modes:
 *   - invalid/absent body fields → 400
 *   - thread not owned by the caller → 404 (defense in depth; rows are already
 *     user-scoped, this just keeps junk thread ids out of the table)
 *   - >30 writes/min → 429
 *
 * Auth: middleware already gates /api/* behind a valid session, so `payload.sub`
 * can be trusted implicitly. The JWT is re-verified anyway because every other
 * /api/chat route does — defense in depth against a future middleware change.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import type { User } from "@/lib/types";

const FEEDBACK_VALUES = new Set(["landed", "missed"]);
const FEEDBACK_RATE_LIMIT_MAX = 30;
const FEEDBACK_RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_ID_CHARS = 128;
const MAX_TURN_INDEX = 100_000;

async function getPayload(request: NextRequest) {
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return { env, error: NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 }) } as const;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { env, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const payload = await verifyJWT(token, secret);
  if (!payload) return { env, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  return { env, payload } as const;
}

export async function POST(request: NextRequest) {
  const { env, error, payload } = await getPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit — 30 writes/min per user. Higher than any honest signal (a person
  // marks the answer they just read, ~1-2/turn), lower than an unbounded script
  // that would hammer D1.
  const rlNow = Date.now();
  let rlStamps: number[] = [];
  const rlRaw = await env.SESSION_KV.get(`rl:chat-feedback:${payload.sub}`);
  if (rlRaw) { try { rlStamps = JSON.parse(rlRaw) as number[]; } catch {} }
  rlStamps = rlStamps.filter((t) => rlNow - t < FEEDBACK_RATE_LIMIT_WINDOW_MS);
  if (rlStamps.length >= FEEDBACK_RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Slow down a moment — feedback is rate-limited." }, { status: 429 });
  }
  await env.SESSION_KV.put(`rl:chat-feedback:${payload.sub}`, JSON.stringify([...rlStamps, rlNow]), { expirationTtl: 60 });

  let body: { threadId?: string; turnIndex?: number; value?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const threadId = typeof body.threadId === "string" ? body.threadId.trim().slice(0, MAX_ID_CHARS) : "";
  const value = typeof body.value === "string" ? body.value : "";
  const turnIndex = typeof body.turnIndex === "number" ? body.turnIndex : NaN;
  if (!threadId) return NextResponse.json({ error: "threadId is required" }, { status: 400 });
  if (!FEEDBACK_VALUES.has(value)) return NextResponse.json({ error: "value must be 'landed' or 'missed'" }, { status: 400 });
  if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex > MAX_TURN_INDEX) {
    return NextResponse.json({ error: "turnIndex must be a non-negative integer" }, { status: 400 });
  }

  // Zero-retention contract: a Device-Only account writes nothing server-side.
  // (The client does not offer the control there; this is the server-side half.)
  const user = await env.DB.prepare("SELECT memory_mode FROM users WHERE id = ?").bind(payload.sub).first<Pick<User, "memory_mode">>();
  if (user?.memory_mode === "local") return NextResponse.json({ ok: true, stored: false });

  // Only the owner of the thread may attach a signal to it.
  const owned = await env.DB.prepare("SELECT 1 AS ok FROM threads WHERE id = ? AND user_id = ?").bind(threadId, payload.sub).first<{ ok: number }>();
  if (!owned) return NextResponse.json({ error: "Unknown thread" }, { status: 404 });

  // Upsert: changing your mind on the same answer replaces the row rather than
  // stacking a duplicate, so (person, thread, turn) is the unit of signal.
  try {
    await env.DB.prepare(
      "INSERT INTO answer_feedback (user_id, thread_id, turn_index, value) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (user_id, thread_id, turn_index) DO UPDATE SET value = excluded.value, created_at = datetime('now')",
    ).bind(payload.sub, threadId, turnIndex, value).run();
  } catch (e) {
    console.error("[feedback] write failed:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return NextResponse.json({ error: "Couldn't save that — try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: true });
}
