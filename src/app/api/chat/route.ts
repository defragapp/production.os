import { NextRequest } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, generateUUID } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { deriveBaseline, buildSystemPrompt } from "@/lib/sovereign-prompt";
import type { Baseline, ChatMessage, Thread, User } from "@/lib/types";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

/** Free-tier message limit per day. */
const FREE_TIER_DAILY_LIMIT = 5;

export async function POST(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return new Response(JSON.stringify({ error: "JWT_SECRET is not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const payload = await verifyJWT(token, secret);
  if (!payload) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const user = await env.DB.prepare("SELECT subscription_tier FROM users WHERE id = ?").bind(payload.sub).first<User>();
  if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  if (user.subscription_tier === "free") {
    const todayKey = `chat-limit:${payload.sub}:${new Date().toISOString().slice(0, 10)}`;
    const count = parseInt((await env.SESSION_KV.get(todayKey)) || "0", 10);
    if (count >= FREE_TIER_DAILY_LIMIT) {
      return new Response(JSON.stringify({
        error: "You've reached your free tier limit of " + FREE_TIER_DAILY_LIMIT + " messages per day. Upgrade to Sovereign+ for unlimited access.",
        upgradeRequired: true,
        limit: FREE_TIER_DAILY_LIMIT,
        used: count,
      }), { status: 402, headers: { "Content-Type": "application/json" } });
    }
    await env.SESSION_KV.put(todayKey, String(count + 1), { expirationTtl: 86400 });
  }

  let body: { messages: ChatMessage[]; threadId?: string };
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) return new Response(JSON.stringify({ error: "messages array is required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const baseline = await env.DB.prepare("SELECT tob, pob, dob, nasa_jpl_json_data FROM baselines WHERE user_id = ?").bind(payload.sub).first<Baseline>();
  if (!baseline || !baseline.nasa_jpl_json_data) return new Response(JSON.stringify({ error: "Baseline not found. Please complete onboarding first." }), { status: 403, headers: { "Content-Type": "application/json" } });

  let rawBaselineData: Record<string, unknown> = {};
  try { rawBaselineData = JSON.parse(baseline.nasa_jpl_json_data) as Record<string, unknown>; } catch { rawBaselineData = {}; }
  const derived = deriveBaseline(rawBaselineData);
  const systemPrompt = buildSystemPrompt(derived);

  let contextMessages: ChatMessage[] = body.messages;
  let threadId = body.threadId;
  if (threadId) {
    const thread = await env.DB.prepare("SELECT message_history FROM threads WHERE id = ? AND user_id = ?").bind(threadId, payload.sub).first<Thread>();
    if (thread) { try { contextMessages = JSON.parse(thread.message_history) as ChatMessage[]; } catch {} }
  }
  const messagesForModel: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...contextMessages];

  const gatewayId = env.AI_GATEWAY_ID || "sovereign-ai-gateway";
  let aiResponse: unknown;
  try {
    aiResponse = await env.AI.run(MODEL, { messages: messagesForModel, stream: true }, { gateway: { id: gatewayId } });
  } catch (aiErr) {
    console.error("[chat] AI.run() failed:", aiErr);
    try {
      aiResponse = await env.AI.run(MODEL, { messages: messagesForModel, stream: true });
    } catch (aiErr2) {
      console.error("[chat] AI.run() fallback also failed:", aiErr2);
      return new Response(JSON.stringify({ error: "AI service is temporarily unavailable. Please try again." }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
  }

  const aiStream = aiResponse as unknown as ReadableStream<Uint8Array>;
  const encoder = new TextEncoder();
  if (!threadId) {
    threadId = generateUUID();
    const userMessages = body.messages.filter((m) => m.role !== "system");
    await env.DB.prepare("INSERT INTO threads (id, user_id, message_history) VALUES (?, ?, ?)").bind(threadId, payload.sub, JSON.stringify(userMessages)).run();
  }
  const currentThreadId = threadId;
  const userMessages = body.messages.filter((m) => m.role !== "system");
  const userId = payload.sub;
  const sseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = (aiStream as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ threadId: currentThreadId })}\n\n`));
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          fullResponse += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`));
        console.error("[chat] Stream error:", err);
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        if (currentThreadId && fullResponse) {
          try {
            const updatedMessages = [...userMessages, { role: "assistant" as const, content: fullResponse }];
            const existing = await env.DB.prepare("SELECT message_history FROM threads WHERE id = ? AND user_id = ?").bind(currentThreadId, userId).first<Thread>();
            let merged: ChatMessage[] = [];
            if (existing) { try { merged = JSON.parse(existing.message_history) as ChatMessage[]; } catch {} }
            for (const msg of updatedMessages) {
              const last = merged[merged.length - 1];
              if (last && last.role === msg.role && last.content === msg.content) continue;
              merged.push(msg);
            }
            await env.DB.prepare("UPDATE threads SET message_history = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(merged), currentThreadId).run();
          } catch (persistErr) { console.error("[chat] Failed to persist thread:", persistErr); }
        }
      }
    },
  });
  return new Response(sseStream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
