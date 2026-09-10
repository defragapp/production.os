import { NextRequest } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, generateUUID } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import type { Baseline, ChatMessage, Thread } from "@/lib/types";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const SYSTEM_PROMPT_PREFIX = "You are the Sovereign OS — a Pattern Interruption tool. You read the user's baseline (Astrology, Human Design, Gene Keys, Numerology) to synthesize their emotional expression, identify toxic and historical family patterns, and present grounded choices. Use simple, grounded language. Do not mystify. When you detect a recurring pattern, name it directly and offer a specific, actionable interruption the user can practice today.";

export async function POST(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return new Response(JSON.stringify({ error: "JWT_SECRET is not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const payload = await verifyJWT(token, secret);
  if (!payload) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  let body: { messages: ChatMessage[]; threadId?: string };
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) return new Response(JSON.stringify({ error: "messages array is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const baseline = await env.DB.prepare("SELECT tob, pob, dob, nasa_jpl_json_data FROM baselines WHERE user_id = ?").bind(payload.sub).first<Baseline>();
  if (!baseline || !baseline.nasa_jpl_json_data) return new Response(JSON.stringify({ error: "Baseline not found. Please complete onboarding first." }), { status: 403, headers: { "Content-Type": "application/json" } });
  let baselineData: Record<string, unknown> = {};
  try { baselineData = JSON.parse(baseline.nasa_jpl_json_data) as Record<string, unknown>; } catch { baselineData = { raw: baseline.nasa_jpl_json_data }; }
  const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n\nBaseline data:\n${JSON.stringify(baselineData, null, 2)}`;
  let contextMessages: ChatMessage[] = body.messages;
  let threadId = body.threadId;
  if (threadId) {
    const thread = await env.DB.prepare("SELECT message_history FROM threads WHERE id = ? AND user_id = ?").bind(threadId, payload.sub).first<Thread>();
    if (thread) { try { contextMessages = JSON.parse(thread.message_history) as ChatMessage[]; } catch {} }
  }
  const messagesForModel: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...contextMessages];
  const gatewayId = env.AI_GATEWAY_ID || "sovereign-ai-gateway";
  const aiResponse = await env.AI.run(MODEL, { messages: messagesForModel, stream: true }, { gateway: { id: gatewayId } });
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
      const reader = aiStream.getReader();
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
