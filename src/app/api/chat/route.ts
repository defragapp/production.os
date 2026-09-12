import { NextRequest } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, generateUUID } from "@/lib/auth";
import { emailVerificationEnabled } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { deriveBaseline } from "@/lib/sovereign-prompt";
import type { DerivedBaseline } from "@/lib/sovereign-prompt";
import { buildReasoningContext, generateSovereignResponse } from "@/lib/sovereign-reasoning";
import { createCloudflareModel, ModelError } from "@/lib/sovereign-model";
import type { Baseline, ChatMessage, Thread, User } from "@/lib/types";

/** Free-tier message limit per day. */
const FREE_TIER_DAILY_LIMIT = 5;

/** Max content length per message accepted from the client. */
const MAX_MESSAGE_LENGTH = 5000;

/** Burst rate limit: max requests per user per window to protect the LLM endpoint. */
const CHAT_RATE_LIMIT_MAX = 20;
const CHAT_RATE_LIMIT_WINDOW_MS = 60_000;

const encoder = new TextEncoder();

/**
 * Merge a stored thread history with the client's cumulative message list.
 * The client resends the full conversation, so entries already present at the
 * tail of the stored history are skipped — only genuinely new ones append.
 */
function mergeChatHistories(base: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [...base];
  for (const msg of incoming) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role && last.content === msg.content) continue;
    merged.push(msg);
  }
  return merged;
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, MAX_MESSAGE_LENGTH) }))
    .filter((m) => m.content.trim().length > 0);
}

async function handleChat(request: NextRequest) {
  const env = getEnv();
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
    return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  await env.SESSION_KV.put(`rl:chat:${payload.sub}`, JSON.stringify([...rlStamps, rlNow]), { expirationTtl: 60 });

  // Defensive user lookup: older D1 snapshots may lack the email_verified
  // column (added after initial schema). Fall back to the pre-verification
  // shape and treat the user as verified rather than crashing the route.
  let user: User | null;
  try {
    user = await env.DB.prepare("SELECT subscription_tier, email_verified FROM users WHERE id = ?").bind(payload.sub).first<User>();
  } catch {
    console.error("[chat] email_verified column missing, falling back to legacy user lookup");
    user = await env.DB.prepare("SELECT subscription_tier FROM users WHERE id = ?").bind(payload.sub).first<User>();
  }
  if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  // Email verification gate — active only when email delivery is configured.
  if (emailVerificationEnabled(env) && !user.email_verified) {
    return new Response(JSON.stringify({ error: "Please verify your email address to use AI chat.", code: "email_unverified" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const todayKey = `chat-limit:${payload.sub}:${new Date().toISOString().slice(0, 10)}`;

  if (user.subscription_tier === "free") {
    const count = parseInt((await env.SESSION_KV.get(todayKey)) || "0", 10);
    if (count >= FREE_TIER_DAILY_LIMIT) {
      return new Response(JSON.stringify({
        error: "You've reached your free tier limit of " + FREE_TIER_DAILY_LIMIT + " messages per day. Upgrade to Sovereign+ for unlimited access.",
        upgradeRequired: true,
        limit: FREE_TIER_DAILY_LIMIT,
        used: count,
      }), { status: 402, headers: { "Content-Type": "application/json" } });
    }
  }

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

  const model = createCloudflareModel(env);
  let result;
  try {
    const context = buildReasoningContext({ history: conversation, baseline: derived });
    result = await generateSovereignResponse(context, conversation, derived, model);
  } catch (err) {
    console.error("[chat] generation failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    if (err instanceof ModelError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Something went wrong while generating a response. Please try again." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const currentThreadId = threadId ?? generateUUID();
  const userId = payload.sub;
  const messagesToStore: ChatMessage[] = [...conversation, { role: "assistant", content: result.text }];

  try {
    if (threadId) {
      await env.DB.prepare("UPDATE threads SET message_history = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?").bind(JSON.stringify(messagesToStore), currentThreadId, userId).run();
    } else {
      await env.DB.prepare("INSERT INTO threads (id, user_id, message_history) VALUES (?, ?, ?)").bind(currentThreadId, userId, JSON.stringify(messagesToStore)).run();
    }
  } catch (persistErr) {
    console.error("[chat] Failed to persist thread:", persistErr);
  }

  if (user.subscription_tier === "free") {
    // Consumption is counted only after a successful generation + persistence.
    // KV has no compare-and-swap, so concurrent requests on free tier may each
    // pass the pre-check; the limit remains enforced per day per user in practice.
    try {
      const current = parseInt((await env.SESSION_KV.get(todayKey)) || "0", 10);
      await env.SESSION_KV.put(todayKey, String(current + 1), { expirationTtl: 86400 });
    } catch (kvErr) {
      console.error("[chat] Failed to record free tier usage:", kvErr);
    }
  }

  const sseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ threadId: currentThreadId })}\n\n`));
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
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}