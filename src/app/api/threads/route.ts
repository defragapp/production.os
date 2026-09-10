import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, generateUUID } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import type { Thread, ChatMessage } from "@/lib/types";

export const runtime = "edge";

async function getAuthPayload(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return { env, error: NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 }) } as const;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { env, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const payload = await verifyJWT(token, secret);
  if (!payload) return { env, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  return { env, payload } as const;
}

export async function GET(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const threadId = url.searchParams.get("id");
  if (threadId) {
    const thread = await env.DB.prepare("SELECT id, user_id, message_history, created_at, updated_at FROM threads WHERE id = ? AND user_id = ?").bind(threadId, payload.sub).first<Thread>();
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    let messages: ChatMessage[] = [];
    try { messages = JSON.parse(thread.message_history) as ChatMessage[]; } catch {}
    return NextResponse.json({ thread: { ...thread, messages } });
  }
  const result = await env.DB.prepare("SELECT id, created_at, updated_at FROM threads WHERE user_id = ? ORDER BY updated_at DESC").bind(payload.sub).all<{ id: string; created_at: string; updated_at: string }>();
  return NextResponse.json({ threads: result.results || [] });
}

export async function POST(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { threadId?: string; messages?: ChatMessage[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  const userFacingMessages = body.messages.filter((m) => m.role !== "system");
  if (body.threadId) {
    const existing = await env.DB.prepare("SELECT message_history FROM threads WHERE id = ? AND user_id = ?").bind(body.threadId, payload.sub).first<Thread>();
    if (!existing) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    let existingMessages: ChatMessage[] = [];
    try { existingMessages = JSON.parse(existing.message_history) as ChatMessage[]; } catch {}
    const merged = [...existingMessages];
    for (const msg of userFacingMessages) {
      const last = merged[merged.length - 1];
      if (last && last.role === msg.role && last.content === msg.content) continue;
      merged.push(msg);
    }
    await env.DB.prepare("UPDATE threads SET message_history = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(merged), body.threadId).run();
    return NextResponse.json({ threadId: body.threadId, messageCount: merged.length });
  }
  const newThreadId = generateUUID();
  await env.DB.prepare("INSERT INTO threads (id, user_id, message_history) VALUES (?, ?, ?)").bind(newThreadId, payload.sub, JSON.stringify(userFacingMessages)).run();
  return NextResponse.json({ threadId: newThreadId, messageCount: userFacingMessages.length });
}

export async function DELETE(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const threadId = url.searchParams.get("id");
  if (!threadId) return NextResponse.json({ error: "Thread id is required" }, { status: 400 });
  await env.DB.prepare("DELETE FROM threads WHERE id = ? AND user_id = ?").bind(threadId, payload.sub).run();
  return NextResponse.json({ ok: true });
}
