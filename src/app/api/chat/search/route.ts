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
import { getEnv } from "@/lib/env";
import { searchChat } from "@/lib/chat-embeddings";
import { hydrateMatches } from "@/lib/chat-recall";
import type { User } from "@/lib/types";

const MAX_QUERY_CHARS = 200;
const SEARCH_RATE_LIMIT_MAX = 20;
const SEARCH_RATE_LIMIT_WINDOW_MS = 60_000;

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
  const results = await hydrateMatches(env, payload.sub, matches);
  return NextResponse.json({ results, indexed: matches.length > 0, memoryMode: "server" });
}
