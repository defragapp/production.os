import { NextRequest } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, generateUUID } from "@/lib/auth";
import { emailVerificationEnabled } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { deriveBaseline } from "@/lib/sovereign-prompt";
import type { DerivedBaseline } from "@/lib/sovereign-prompt";
import { buildReasoningContext, generateSovereignResponse } from "@/lib/sovereign-reasoning";
import { buildConsentedPeers } from "@/lib/sovereign-connections";
import { createCloudflareModel, ModelError } from "@/lib/sovereign-model";
import { FREE_TIER_DAILY_LIMIT } from "@/lib/limits";
import { claimFreeAnswer, releaseFreeAnswer } from "@/lib/usage";
import { mergeChatHistories } from "@/lib/chat-history";
import { deriveJourneyState, type JourneyState } from "@/lib/sovereign-journey";
import { loadActiveJourney, persistJourneyState, prevStateFromRow } from "@/lib/journeys";
import type { Baseline, ChatMessage, Thread, User } from "@/lib/types";

/** Max content length per message accepted from the client. */
const MAX_MESSAGE_LENGTH = 5000;

/** Burst rate limit: max requests per user per window to protect the LLM endpoint. */
const CHAT_RATE_LIMIT_MAX = 20;
const CHAT_RATE_LIMIT_WINDOW_MS = 60_000;

const encoder = new TextEncoder();

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, MAX_MESSAGE_LENGTH) }))
    .filter((m) => m.content.trim().length > 0);
}

async function handleChat(request: NextRequest) {
  // Cold-path diagnostic: Workers AI generation dominates latency, but a slow
  // D1/consent prelude or isolate cold start shows up in `pre`. One compact
  // line per request into `wrangler tail` settles the load-latency questions.
  const tStart = Date.now();
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return new Response(JSON.stringify({ error: "JWT_SECRET is not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const payload = await verifyJWT(token, secret);
  if (!payload) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  // Burst rate limit to protect the LLM endpoint from automated abuse.
  const rlNow = Date.now();
  let rlStamps: number[] = [];
  const rlRaw = await env.SESSION_KV.get(`rl:chat:${payload.sub}`);
  if (rlRaw) { try { rlStamps = JSON.parse(rlRaw) as number[]; } catch {} }
  rlStamps = rlStamps.filter((t) => rlNow - t < CHAT_RATE_LIMIT_WINDOW_MS);
  if (rlStamps.length >= CHAT_RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: "That's a few too many at once — give Sovereign a moment and try again." }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  await env.SESSION_KV.put(`rl:chat:${payload.sub}`, JSON.stringify([...rlStamps, rlNow]), { expirationTtl: 60 });

  // Defensive user lookup: older D1 snapshots may lack the email_verified
  // column (added after initial schema). Fall back to the pre-verification
  // shape and treat the user as verified rather than crashing the route.
  let user: User | null;
  try {
    user = await env.DB.prepare("SELECT subscription_tier, email_verified, memory_mode FROM users WHERE id = ?").bind(payload.sub).first<User>();
  } catch {
    console.error("[chat] email_verified column missing, falling back to legacy user lookup");
    user = await env.DB.prepare("SELECT subscription_tier FROM users WHERE id = ?").bind(payload.sub).first<User>();
  }
  if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  // Device-Only memory: inference stays zero-retention. The legacy fallback
  // select has no memory_mode, which normalises to the 'server' default —
  // the safe direction for an un-migrated database.
  const memoryMode = user.memory_mode === "local" ? "local" : "server";

  // Email verification gate — active only when email delivery is configured.
  if (emailVerificationEnabled(env) && !user.email_verified) {
    return new Response(JSON.stringify({ error: "Please verify your email address to use AI chat.", code: "email_unverified" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  // Gate: must have completed baseline (onboarding) — required for API access too.
  const userBaseline = await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?").bind(payload.sub).first<{ user_id: string }>();
  if (!userBaseline) return new Response(JSON.stringify({ error: "Please complete your Baseline before using AI chat.", code: "baseline_required" }), { status: 403, headers: { "Content-Type": "application/json" } });

  // Gate: must have chosen a subscription tier (free or sovereign+).
  if (!user.subscription_tier) return new Response(JSON.stringify({ error: "Choose a plan to keep chatting — the free tier is always available.", code: "subscription_required" }), { status: 403, headers: { "Content-Type": "application/json" } });

  let body: { messages: ChatMessage[]; threadId?: string };
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) return new Response(JSON.stringify({ error: "messages array is required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const incoming = sanitizeMessages(body.messages);
  if (incoming.length === 0) return new Response(JSON.stringify({ error: "No readable messages provided" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const baseline = await env.DB.prepare("SELECT tob, pob, dob, nasa_jpl_json_data FROM baselines WHERE user_id = ?").bind(payload.sub).first<Baseline>();
  if (!baseline || !baseline.nasa_jpl_json_data) return new Response(JSON.stringify({ error: "Baseline not found. Please complete onboarding first." }), { status: 403, headers: { "Content-Type": "application/json" } });

  let rawBaselineData: Record<string, unknown> = {};
  try { rawBaselineData = JSON.parse(baseline.nasa_jpl_json_data) as Record<string, unknown>; } catch { rawBaselineData = {}; }
  const derived: DerivedBaseline = deriveBaseline(rawBaselineData);

  // Consent-gated connections: each person controls their own sharing flag.
  // Allowed-to-share peers contribute a derived summary + between-design notes
  // (never their raw chart or birth data).
  let consented: Awaited<ReturnType<typeof buildConsentedPeers>>;
  try {
    consented = await buildConsentedPeers(env, payload.sub, rawBaselineData);
  } catch (consentErr) {
    console.error("[chat] building consented peers failed:", consentErr);
    consented = [];
  }

  let threadId = body.threadId;
  let conversation: ChatMessage[] = incoming;
  if (threadId) {
    const thread = await env.DB.prepare("SELECT message_history FROM threads WHERE id = ? AND user_id = ?").bind(threadId, payload.sub).first<Thread>();
    if (thread) {
      let stored: ChatMessage[] = [];
      try { stored = JSON.parse(thread.message_history) as ChatMessage[]; } catch {}
      conversation = mergeChatHistories(stored, incoming);
    } else {
      threadId = undefined;
    }
  }

  // Free-tier daily cap, claimed atomically in D1 (KV had no compare-and-swap,
  // so concurrent requests could both pass the old read-modify-write check).
  // Claimed here — after every validation and lookup — so a malformed request
  // can never burn one of today's answers, and released below if generation
  // produces nothing.
  let usageClaimed = false;
  if (user.subscription_tier === "free") {
    const claim = await claimFreeAnswer(env, payload.sub, FREE_TIER_DAILY_LIMIT);
    if (!claim.claimed) {
      return new Response(JSON.stringify({
        error: `You've used today's answers — come back tomorrow, or continue without limit with Sovereign+.`,
        upgradeRequired: true,
        limit: FREE_TIER_DAILY_LIMIT,
        used: claim.used,
      }), { status: 402, headers: { "Content-Type": "application/json" } });
    }
    usageClaimed = !claim.degraded;
  }

  const model = createCloudflareModel(env);
  // Deterministic journey state is derived from the already-classified
  // reasoning context — no model call, <50ms, runs before generation. The
  // `{ state }` frame is enqueued into the SSE stream FIRST (before the model
  // is awaited) so the canvas animates during the 1-2s inference wait, while
  // validated text follows only after validateSovereignText + any repair pass
  // complete — raw tokens never reach the screen unvalidated. The journey row
  // is created lazily: the first turn with an unlock or a suggested goal
  // materializes it.
  let context;
  try {
    context = buildReasoningContext({ history: conversation, baseline: derived, consented });
  } catch (err) {
    console.error("[chat] reasoning prelude failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    if (usageClaimed) await releaseFreeAnswer(env, payload.sub);
    return new Response(JSON.stringify({ error: "Sovereign couldn't finish that answer — try again." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  let journeyState: JourneyState | null = null;
  let activeJourneyId: string | null = null;
  try {
    // loadActiveJourney only ever returns an 'active' row (or null). A paused
    // journey is deliberately invisible here: the canvas still animates for
    // this turn from derived state, but nothing is persisted over the paused
    // row — resuming it is an explicit PATCH, never a side effect of chatting.
    // In Device-Only mode nothing is read or written at all: the client
    // derives the same state from this frame and seals it into its local vault.
    if (memoryMode === "server") {
      const activeJourney = await loadActiveJourney(env, payload.sub);
      journeyState = deriveJourneyState(context, conversation, prevStateFromRow(activeJourney));
      activeJourneyId = await persistJourneyState(env, payload.sub, journeyState, activeJourney);
    } else {
      journeyState = deriveJourneyState(context, conversation, null);
    }
  } catch (journeyErr) {
    // Journey persistence must never fail a chat turn: log and continue.
    console.error("[chat] journey derive/persist failed:", journeyErr instanceof Error ? `${journeyErr.name}: ${journeyErr.message}` : journeyErr);
    journeyState = null;
  }
  // Generation runs fully (model call + validateSovereignText + repair) and the
  // thread write lands BEFORE the SSE stream opens, so every byte the client
  // receives — `{ threadId }`, `{ state }`, `{ content }` — is final and safe.
  // The canvas still converges first: the `{ state }` frame is enqueued ahead
  // of `{ content }`, so when generation completes the UI paints progress
  // before text in the same flush. True token-streaming is deliberately NOT
  // wired here: flushing raw model tokens before validation would paint tone
  // or clinical-jargon violations the repair pass is required to catch. If
  // streaming is ever added, the `{ state }` frame must be flushed in a
  // pre-generation stream while `{ content }` chunks stay gated behind
  // per-chunk validation — that seam is NOT built yet.
  let result;
  const tPre = Date.now();
  try {
    result = await generateSovereignResponse(context, conversation, derived, model);
  } catch (err) {
    console.error("[chat] generation failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    if (usageClaimed) await releaseFreeAnswer(env, payload.sub);
    if (err instanceof ModelError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Sovereign couldn't finish that answer — try again." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const tGen = Date.now();
  console.log(`[chat] timing pre=${tPre - tStart}ms gen=${tGen - tPre}ms total_to_response=${tGen - tStart}ms`);
  const currentThreadId = threadId ?? generateUUID();
  const userId = payload.sub;
  const messagesToStore: ChatMessage[] = [...conversation, { role: "assistant", content: result.text }];
  try {
    if (threadId) {
      await env.DB.prepare("UPDATE threads SET message_history = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?").bind(JSON.stringify(messagesToStore), currentThreadId, userId).run();
    } else if (memoryMode === "local") {
      // Zero retention means no new server row: a Device-Only thread lives in
      // the client's history (and the transcript above is never written).
      // Threads that predate the switch keep updating — deleting someone's
      // own stored history as a side effect of a preference flip would be the
      // opposite of privacy. They can clear it deliberately in the UI.
    } else {
      await env.DB.prepare("INSERT INTO threads (id, user_id, message_history) VALUES (?, ?, ?)").bind(currentThreadId, userId, JSON.stringify(messagesToStore)).run();
    }
  } catch (persistErr) {
    console.error("[chat] Failed to persist thread:", persistErr);
  }
  const stateEvent = journeyState
    ? { state: journeyState, inquiryLevel: context.level, journeyId: activeJourneyId }
    : null;
  const sseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ threadId: currentThreadId })}\n\n`));
      // Confirmed `{ state }` frame first so the canvas converges before text
      // paints, then the single validated `{ content }` event, then DONE.
      if (stateEvent) controller.enqueue(encoder.encode(`data: ${JSON.stringify(stateEvent)}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: result.text })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(sseStream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}

/** Outer backstop: converts any uncaught pre-generation throw into a logged
 *  JSON 500 instead of an empty-body failure. */
export async function POST(request: NextRequest) {
  try {
    return await handleChat(request);
  } catch (err) {
    const name = err instanceof Error ? err.name : typeof err;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chat] uncaught: ${name}: ${message}`);
    return new Response(JSON.stringify({ error: "Something went wrong on our side — try again." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}