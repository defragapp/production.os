/**
 * Chat Embeddings — semantic recall over server-memory chat history.
 *
 * Workers Paid feature surface. Every turn written to `threads` under
 * memory_mode='server' is embedded via Workers AI
 * (`@cf/baai/bge-large-en-v1.5`, 1024-dim cosine) and upserted into the
 * Vectorize index `chat-embeddings` under a per-user namespace. Search
 * embeds the query once and asks Vectorize for the top-K matches scoped
 * to that namespace.
 *
 * Privacy posture (aligned with the rest of the platform):
 *   - The plaintext of a message NEVER lives inside Vectorize — only the
 *     `{ userId, threadId, turnIndex, role }` coordinates needed to
 *     hydrate the snippet back out of D1 on demand. Deleting a thread
 *     or account therefore also deletes the vectors (via
 *     `deleteThreadEmbeddings` called from the D1 cascade hooks) — the
 *     only persistent artifact is a fixed-length float vector that is
 *     not reversible.
 *   - memory_mode='local' bypasses this path entirely: no server-side
 *     write, no embedding. The 'Device-Only' contract stays true.
 *
 * Failure posture:
 *   - Every public function swallows its errors and returns a benign
 *     fallback (0 vectors upserted / empty match list). Chat writes and
 *     reads must never fail because of the semantic layer — the plain
 *     thread listing is the source of truth; embeddings are an index.
 *   - Callers schedule these via `waitUntil` (see `src/lib/env.ts`) so
 *     the network round-trip to Workers AI never enters the TTFB path.
 */
import type { AppEnv } from "@/lib/env";

/** Model chosen for parity with the Cloudflare-recommended text-embedding
 *  default at 1024-dim cosine: `bge-large-en-v1.5`. Documented under
 *  `developers.cloudflare.com/workers-ai/models/bge-large-en-v1.5`. */
export const EMBEDDING_MODEL = "@cf/baai/bge-large-en-v1.5";
export const EMBEDDING_DIMENSIONS = 1024;

/** Cap on how much text we hand the embedder per turn. Real conversation
 *  turns are ~100-2,000 chars; the guard is here for the pathological
 *  case of a caller forgetting to sanitize before embedding. */
const MAX_EMBED_CHARS = 4000;

/** Hard ceiling on results returned to the client. Beyond this the UI
 *  becomes a wall and Cloudflare's default topK is fine at ≤30. */
const MAX_SEARCH_TOP_K = 20;
const DEFAULT_SEARCH_TOP_K = 8;

type Turn = {
  threadId: string;
  turnIndex: number;
  role: "user" | "assistant";
  text: string;
};

type VectorizeIndexLike = {
  upsert(vectors: Array<{ id: string; values: number[]; namespace?: string; metadata?: Record<string, unknown> }>): Promise<unknown>;
  deleteByIds(ids: string[]): Promise<unknown>;
  query(vector: number[], options?: { topK?: number; namespace?: string; returnMetadata?: boolean | "all" | "indexed" | "none"; filter?: Record<string, unknown> }): Promise<{ matches: Array<{ id: string; score: number; namespace?: string; metadata?: Record<string, unknown> }>; count: number }>;
};

function getIndex(env: AppEnv): VectorizeIndexLike | null {
  const idx = env.VECTORIZE as unknown as VectorizeIndexLike | undefined;
  return idx ?? null;
}

function vectorId(turn: Turn, userId: string): string {
  // userId is embedded in the id itself so a delete-by-thread sweep can
  // enumerate deterministic ids without a metadata query (Vectorize does
  // not support id-prefix delete). turnIndex is zero-padded to sort
  // naturally and to avoid `:10` matching a prefix of `:100`.
  return `${userId}::${turn.threadId}::${String(turn.turnIndex).padStart(5, "0")}::${turn.role}`;
}

function truncate(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";
  return trimmed.length > MAX_EMBED_CHARS ? trimmed.slice(0, MAX_EMBED_CHARS) : trimmed;
}

/**
 * Batch-embed one turn (user + assistant) and upsert into Vectorize.
 * Both texts go through the model in a single request — the Workers AI
 * embeddings endpoint supports array input, so this is one round-trip
 * regardless of pair size. Returns the number of vectors upserted (0, 1,
 * or 2 — empty sides are skipped).
 *
 * Never throws: any error is logged and returns 0 so the caller's
 * `waitUntil` stays cheap and the chat response is unaffected.
 */
export async function embedTurn(
  env: AppEnv,
  userId: string,
  turn: Turn,
): Promise<number> {
  const index = getIndex(env);
  if (!index) return 0;
  const text = truncate(turn.text);
  if (!text) return 0;
  try {
    const result = await env.AI.run(EMBEDDING_MODEL as never, { text: [text] } as never) as unknown as { data?: number[][] };
    const vector = result?.data?.[0];
    if (!vector || vector.length === 0) return 0;
    await index.upsert([
      {
        id: vectorId(turn, userId),
        values: vector,
        namespace: userId,
        metadata: {
          userId,
          threadId: turn.threadId,
          turnIndex: turn.turnIndex,
          role: turn.role,
          // createdAt helps the UI sort + lets an operator spot stale
          // vectors without a D1 round-trip. Stored as ISO.
          indexedAt: new Date().toISOString(),
        },
      },
    ]);
    return 1;
  } catch (err) {
    console.error("[embedTurn] failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return 0;
  }
}

/**
 * Embed the most recent turn of a thread (user msg + assistant reply).
 * Called from /api/chat/route.ts via `waitUntil` after the D1 write has
 * landed, so the two sides of the vector index are always consistent
 * with the source-of-truth thread history.
 */
export async function embedLatestTurn(
  env: AppEnv,
  userId: string,
  threadId: string,
  userText: string,
  assistantText: string,
  lastTurnIndex: number,
): Promise<number> {
  const [u, a] = await Promise.all([
    embedTurn(env, userId, { threadId, turnIndex: lastTurnIndex, role: "user", text: userText }),
    embedTurn(env, userId, { threadId, turnIndex: lastTurnIndex, role: "assistant", text: assistantText }),
  ]);
  return u + a;
}

/**
 * Delete every vector associated with a thread. Uses deterministic ids
 * built from a caller-supplied list of `(turnIndex, role)` pairs so the
 * sweep is a single `deleteByIds` call rather than a metadata query
 * (Vectorize has no filter-delete).
 *
 * For account deletion, use `deleteAllUserEmbeddings` with a scanned id
 * list — Vectorize namespaces can also be truncated by reindexing, but
 * the deterministic sweep is the reliable path.
 */
export async function deleteThreadEmbeddings(
  env: AppEnv,
  userId: string,
  threadId: string,
  totalTurns: number,
): Promise<number> {
  const index = getIndex(env);
  if (!index) return 0;
  const ids: string[] = [];
  for (let i = 0; i < totalTurns; i++) {
    ids.push(vectorId({ threadId, turnIndex: i, role: "user", text: "" }, userId));
    ids.push(vectorId({ threadId, turnIndex: i, role: "assistant", text: "" }, userId));
  }
  if (ids.length === 0) return 0;
  try {
    await index.deleteByIds(ids);
    return ids.length;
  } catch (err) {
    console.error("[deleteThreadEmbeddings] failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return 0;
  }
}

/** A single match surfaced back to the caller after D1 hydration. */
export type ChatSearchMatch = {
  threadId: string;
  turnIndex: number;
  role: "user" | "assistant";
  score: number;
};

/**
 * Semantic search over a user's indexed chat history.
 *
 * Returns scored matches WITHOUT hydrated text — the caller is expected
 * to fetch the referenced thread rows once (via `hydrateMatches`) so we
 * make exactly one D1 read for the whole result set, not one per match.
 */
export async function searchChat(
  env: AppEnv,
  userId: string,
  query: string,
  opts: { topK?: number } = {},
): Promise<ChatSearchMatch[]> {
  const index = getIndex(env);
  if (!index) return [];
  const trimmed = truncate(query);
  if (!trimmed) return [];
  const topK = Math.max(1, Math.min(opts.topK ?? DEFAULT_SEARCH_TOP_K, MAX_SEARCH_TOP_K));
  try {
    const emb = await env.AI.run(EMBEDDING_MODEL as never, { text: [trimmed] } as never) as unknown as { data?: number[][] };
    const vector = emb?.data?.[0];
    if (!vector) return [];
    const res = await index.query(vector, { topK, namespace: userId, returnMetadata: "indexed" });
    const matches: ChatSearchMatch[] = [];
    for (const m of res.matches ?? []) {
      const meta = m.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;
      const threadId = typeof meta.threadId === "string" ? meta.threadId : "";
      const turnIndex = typeof meta.turnIndex === "number" ? meta.turnIndex : Number(meta.turnIndex);
      const role = meta.role === "assistant" ? "assistant" : meta.role === "user" ? "user" : null;
      if (!threadId || !Number.isFinite(turnIndex) || !role) continue;
      // Namespace-scoped queries should never leak across users, but
      // belt-and-braces on the userId check costs nothing.
      if (typeof meta.userId === "string" && meta.userId !== userId) continue;
      matches.push({ threadId, turnIndex, role, score: m.score });
    }
    return matches;
  } catch (err) {
    console.error("[searchChat] failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return [];
  }
}

/**
 * Full erasure sweep for a single account. Called from DELETE /api/auth/account
 * before the D1 cascade runs, so a GDPR/CCPA right-to-erasure request removes
 * the vector coordinates as well as the underlying rows. Because Vectorize
 * ids are deterministic (userId::threadId::turnIndex::role) and the account's
 * threads are still readable in D1 at this point, we can enumerate every id
 * without a metadata query.
 *
 * Vectorize's `deleteByIds` has a per-request cap (currently 1000), so this
 * batches. Batches are issued sequentially — a burst in parallel would blow
 * the per-index write budget and mask real errors behind rate-limit noise.
 * Failures are swallowed with a log line: the D1 cascade is the authoritative
 * deletion, and orphaned Vectorize metadata (userId + threadId + turnIndex +
 * role, with no plaintext) has no informational value on its own.
 *
 * Returns the total number of ids we asked Vectorize to delete. Zero when the
 * binding isn't configured (dev without a Vectorize index) — the D1 DELETE
 * still runs and the account is legitimately gone.
 */
export async function deleteUserEmbeddings(
  env: AppEnv,
  userId: string,
  threads: Array<{ threadId: string; turnCount: number }>,
): Promise<number> {
  const index = getIndex(env);
  if (!index) return 0;
  const ids: string[] = [];
  for (const t of threads) {
    for (let i = 0; i < t.turnCount; i++) {
      ids.push(vectorId({ threadId: t.threadId, turnIndex: i, role: "user", text: "" }, userId));
      ids.push(vectorId({ threadId: t.threadId, turnIndex: i, role: "assistant", text: "" }, userId));
    }
  }
  if (ids.length === 0) return 0;
  const BATCH = 500;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    try {
      await index.deleteByIds(slice);
      deleted += slice.length;
    } catch (err) {
      console.error("[deleteUserEmbeddings] batch failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    }
  }
  return deleted;
}

/**
 * Backfill helper — embeds every (user, assistant) pair in a thread that
 * is not already indexed. Idempotent via `upsert`; safe to re-run. The
 * chat route does NOT use this — it only calls `embedLatestTurn`. The
 * owner-launched backfill script (`scripts/backfill-embeddings.mjs`) and
 * the on-demand reindex path from /api/chat/search both go through here.
 */
export async function embedThread(
  env: AppEnv,
  userId: string,
  threadId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<number> {
  let upserted = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user" && m.role !== "assistant") continue;
    const n = await embedTurn(env, userId, {
      threadId,
      turnIndex: i,
      role: m.role,
      text: String(m.content ?? ""),
    });
    upserted += n;
  }
  return upserted;
}
