/**
 * POST /api/chat/search — semantic recall over a user's server-memory chat
 * history. Workers Paid surface.
 *
 * Request body:
 *   { q: string; topK?: number }     (q trimmed; 200-char hard cap)
 *
 * Response 200:
 *   {
 *     results: [{ threadId, turnIndex, role, score, snippet, updatedAt }],
 *     indexed: boolean,   // false → nothing indexed yet for this account
 *     memoryMode: 'server' | 'local',
 *   }
 *
 * Failure modes are deliberately soft:
 *   - memory_mode='local' → { results: [], indexed: false, memoryMode: 'local' }
 *     (200 OK; Device-Only memory has no server index by design)
 *   - Vectorize or Workers AI hiccup → { results: [], indexed: false, ... }
 *     with a `warning` field so the UI can retry. Never 500 on a search miss.
 *   - 429 on >20 req/min burst; 400 on missing/empty q.
 *
 * Auth: middleware already gates /api/* behind a valid session, so this
 * handler can trust `payload.sub` implicitly. It re-verifies the JWT because
 * every other /api/chat route does — defense in depth against a future
 * middleware matcher change.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv, type AppEnv } from "@/lib/env";
import { searchChat, type ChatSearchMatch } from "@/lib/chat-embeddings";
import type { ChatMessage, Thread, User } from "@/lib/types";

const MAX_QUERY_CHARS = 200;
const SEARCH_RATE_LIMIT_MAX = 20;
const SEARCH_RATE_LIMIT_WINDOW_MS = 60_000;

type HydratedResult = {
  threadId: string;
  turnIndex: number;
  role: "user" | "assistant";
  score: number;
  snippet: string;
  updatedAt: string | null;
};

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

/**
 * Fetch every distinct thread referenced by the match list once and pull the
 * exact turn text out of the JSON blob in memory. One D1 read for the whole
 * result set rather than one per match.
 */
async function hydrate(env: AppEnv, userId: string, matches: ChatSearchMatch[]): Promise<HydratedResult[]> {
  if (matches.length === 0) return [];
  const ids = Array.from(new Set(matches.map((m) => m.threadId)));
  const placeholders = ids.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT id, message_history, updated_at FROM threads WHERE user_id = ? AND id IN (${placeholders})`,
  )
    .bind(userId, ...ids)
    .all<Pick<Thread, "id" | "message_history" | "updated_at">>();
  const byId = new Map<string, { messages: ChatMessage[]; updatedAt: string | null }>();
  for (const r of rows.results ?? []) {
    let parsed: ChatMessage[] = [];
    try { parsed = JSON.parse(r.message_history) as ChatMessage[]; } catch { parsed = []; }
    byId.set(r.id, { messages: parsed, updatedAt: r.updated_at ?? null });
  }
  const out: HydratedResult[] = [];
  for (const m of matches) {
    const entry = byId.get(m.threadId);
    if (!entry) continue;
    const msg = entry.messages[m.turnIndex];
    if (!msg) continue;
    // Belt-and-braces: the vector's role hint and the row's role must agree.
    // A mismatch means the stored thread was truncated/edited after
    // indexing; skip the stale vector rather than show the wrong bubble.
    if (msg.role !== m.role) continue;
    const raw = String(msg.content ?? "").replace(/\s+/g, " ").trim();
    const snippet = raw.length > 320 ? `${raw.slice(0, 317)}…` : raw;
    if (!snippet) continue;
    out.push({ threadId: m.threadId, turnIndex: m.turnIndex, role: m.role, score: m.score, snippet, updatedAt: entry.updatedAt });
  }
  return out;
}

export async function POST(request: NextRequest) {
  const { env, error, payload } = await getPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit — 20 searches/min per user. Higher than any honest pattern
  // (a person doing a single ⌘K lookup and reading results uses ~1-2), lower
  // than the cost of an unbounded scrape draining Workers AI neurons.
  const rlNow = Date.now();
  let rlStamps: number[] = [];
  const rlRaw = await env.SESSION_KV.get(`rl:chat-search:${payload.sub}`);
  if (rlRaw) { try { rlStamps = JSON.parse(rlRaw) as number[]; } catch {} }
  rlStamps = rlStamps.filter((t) => rlNow - t < SEARCH_RATE_LIMIT_WINDOW_MS);
  if (rlStamps.length >= SEARCH_RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Slow down a moment — search is rate-limited to keep every user's experience snappy." }, { status: 429 });
  }
  await env.SESSION_KV.put(`rl:chat-search:${payload.sub}`, JSON.stringify([...rlStamps, rlNow]), { expirationTtl: 60 });

  let body: { q?: string; topK?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const q = (body.q ?? "").toString().trim().slice(0, MAX_QUERY_CHARS);
  if (!q) return NextResponse.json({ error: "Search query is empty." }, { status: 400 });
  const topK = typeof body.topK === "number" ? body.topK : undefined;

  // Honour memory_mode='local' with a friendly empty result (the person has
  // opted into zero-retention; nothing to search on our side).
  const user = await env.DB.prepare("SELECT memory_mode FROM users WHERE id = ?").bind(payload.sub).first<Pick<User, "memory_mode">>();
  const memoryMode = user?.memory_mode === "local" ? "local" : "server";
  if (memoryMode === "local") {
    return NextResponse.json({ results: [], indexed: false, memoryMode: "local" });
  }

  const matches = await searchChat(env, payload.sub, q, { topK });
  const results = await hydrate(env, payload.sub, matches);
  return NextResponse.json({ results, indexed: matches.length > 0, memoryMode: "server" });
}
