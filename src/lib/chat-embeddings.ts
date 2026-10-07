/**
 * Chat Embeddings — semantic recall over server-memory chat history.
 *
 * Workers Paid feature surface. Each turn produced by /api/chat under
 * memory_mode='server' is embedded via Workers AI
 * (`@cf/baai/bge-large-en-v1.5`, 1024-dim cosine) and upserted into the
 * Vectorize index `chat-embeddings` under a per-user namespace. Threads
 * written by other paths (the PUT /api/threads merge, pre-feature history)
 * are not embedded until something calls `embedThread`. Search
 * embeds the query once and asks Vectorize for the top-K matches scoped
 * to that namespace.
 *
 * Privacy posture (aligned with the rest of the platform):
 *   - The plaintext of a message NEVER lives inside Vectorize — only the
 *     `{ userId, threadId, turnIndex, role }` coordinates needed to
 *     hydrate the snippet back out of D1 on demand. Those coordinates ride
 *     in the vector's `metadata`, and the vector id itself is an opaque,
 *     fixed-length digest of them (see `vectorId`). The erasure hooks remove
 *     the vectors along with the rows (`deleteThreadEmbeddings` on thread
 *     delete, `deleteUserEmbeddings` on account delete); both enumerate ids
 *     from the thread's message count read with `json_array_length(
 *     message_history)` directly (see api/threads DELETE and the account
 *     sweep) — an earlier `json_extract` wrapper made the thread path return
 *     NULL and silently orphan every vector of a deleted thread, which is
 *     fixed. Either way the only persistent artifact is a fixed-length float
 *     vector that is not reversible.
 *   - memory_mode='local' bypasses this path entirely: no server-side
 *     write, no embedding. The 'Device-Only' contract stays true.
 *
 * Failure posture:
 *   - Each public function wraps its own Vectorize / Workers AI calls in a
 *     try/catch and returns a benign fallback (0 vectors upserted, empty
 *     match list, 0 ids deleted) when those calls fail, so a chat write or
 *     read is not failed by the semantic layer — the plain thread listing
 *     is the source of truth; embeddings are an index. This is scoped to
 *     the store/model path, not a blanket no-throw guarantee: a malformed
 *     argument still surfaces, e.g. a non-string `turn.text` reaching
 *     `truncate()` throws before any try block is entered.
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

/**
 * FNV-1a, 32-bit. Synchronous, dependency-free, and sufficient as an identity
 * digest: the inputs are our own coordinates (not adversarial fingerprints),
 * and what we need is determinism plus a space wide enough that collisions
 * between two turns are remote rather than ruled out — 800 sampled turns
 * produced 800 distinct ids. `seed` picks between two independent passes so
 * the combined digest carries 64 bits, not 32.
 */
function fnv1a32(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic Vectorize id for one turn.
 *
 * Vectorize caps ids at 64 BYTES. The previous composite
 * `${userId}::${threadId}::${turnIndex}::${role}` measured 87 bytes for a user
 * turn and 92 for an assistant turn (two 36-char UUIDs plus separators), so it
 * could never be accepted: every turn captured in the production `wrangler
 * tail` during the latency study was rejected with
 * `VECTOR_UPSERT_ERROR (code 40008)` — and because `embedTurn` is
 * fire-and-forget under `waitUntil` and swallows its own errors, semantic
 * recall stayed silently dead while chat kept returning 200s.
 *
 * The tuple is now folded into a fixed-length digest: `ce` + 8 hex from
 * FNV-1a(seed A) + 8 hex from FNV-1a(seed B) = 18 bytes, constant regardless of
 * how long any coordinate grows. Properties that mattered and are preserved:
 *   - Deterministic, so `deleteThreadEmbeddings` / `deleteUserEmbeddings` still
 *     enumerate ids instead of needing a metadata query (Vectorize has no
 *     filter-by-prefix delete).
 *   - `userId` stays INSIDE the digest. It is no longer merely decorative:
 *     `threadId` is partly caller-supplied, so hashing it in keeps one account
 *     from ever composing the id of another account's turn.
 *   - No call site reads structure OUT of the id (checked this file and its
 *     importers). `searchChat` hydrates matches from Vectorize `metadata`
 *     (userId / threadId / turnIndex / role / indexedAt), and recall ordering
 *     uses `metadata.indexedAt` — not the id — so losing the old natural sort
 *     by id costs nothing.
 */
function vectorId(turn: Turn, userId: string): string {
  const tuple = `${userId}\u0000${turn.threadId}\u0000${turn.turnIndex}\u0000${turn.role}`;
  const a = fnv1a32(tuple, 0x811c9dc5).toString(16).padStart(8, "0");
  const b = fnv1a32(tuple, 0x9e3779b9).toString(16).padStart(8, "0");
  return `ce${a}${b}`;
}

function truncate(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";
  return trimmed.length > MAX_EMBED_CHARS ? trimmed.slice(0, MAX_EMBED_CHARS) : trimmed;
}

/**
 * Batch-embed one turn and upsert it into Vectorize. The endpoint takes an
 * array, so the single-text call here could be widened to a pair without an
 * extra round-trip if a caller ever needs that; today it embeds exactly one
 * side and returns 1 on success or 0 (binding missing, empty text after
 * truncation, no vector back, or a logged failure). `embedLatestTurn` is the
 * one that pairs a user message with its reply, so it returns 0..2.
 *
 * Error posture: a failed model call or upsert is logged and returns 0, so
 * the caller's `waitUntil` stays cheap and the chat response is unaffected.
 * That covers the store/model path only — `truncate()` throws on a
 * non-string `turn.text` before the try block is entered, which is a caller
 * bug rather than a transient failure worth swallowing.
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
 * landed, so a turn that the person can see in the thread listing is also
 * the turn the index is aimed at. It is best-effort in the other direction:
 * a swallowed embedding failure leaves that turn unindexed while D1 stays
 * authoritative.
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
 * Delete every vector associated with a thread. The caller supplies the
 * thread's message count, and this builds the deterministic id for every
 * `(turnIndex, user|assistant)` pair below it, so the sweep is a single
 * `deleteByIds` call rather than a metadata query (Vectorize has no
 * filter-delete). Passing a count lower than the thread's real length
 * leaves the tail vectors orphaned.
 *
 * For account deletion, use `deleteUserEmbeddings`, which does the same
 * enumeration across every thread the account still has rows for.
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
  /**
   * Per-turn index time (ISO, from Vectorize metadata `indexedAt`). This is
   * what the recall freshness gate compares against — NOT the owning thread's
   * `updated_at`, which stays 'today' for a long-lived thread and would blind
   * recall to genuinely-old turns. Null when the vector predates the field.
   */
  indexedAt: string | null;
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
    // `all`, not `indexed`: the freshness gate needs `indexedAt`, which is
    // stored metadata but not declared an indexed dimension on the index, so
    // `returnMetadata: "indexed"` would omit it and drop every match.
    const res = await index.query(vector, { topK, namespace: userId, returnMetadata: "all" });
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
      const indexedAt = typeof meta.indexedAt === "string" ? meta.indexedAt : null;
      matches.push({ threadId, turnIndex, role, score: m.score, indexedAt });
    }
    return matches;
  } catch (err) {
    console.error("[searchChat] failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return [];
  }
}

/**
 * Full erasure sweep for a single account. Called from DELETE /api/auth/account
 * before the D1 cascade runs, so a GDPR/CCPA right-to-erasure request aims to
 * remove the vector coordinates as well as the underlying rows. Because Vectorize
 * ids are deterministic digests of (userId, threadId, turnIndex, role) and
 * the account's threads are still readable in D1 at this point, we can
 * enumerate every id without a metadata query.
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
 * Backfill helper: embed and upsert every user/assistant message in a
 * thread. It does NOT check whether a turn is already indexed — it
 * re-upserts the whole thread, which is idempotent in content (same
 * deterministic ids) but pays for the embeddings again.
 *
 * Currently has no callers in the repo: /api/chat only uses
 * `embedLatestTurn`, and neither a backfill script nor a reindex-on-search
 * path exists yet. Kept exported as the intended entry point for indexing
 * pre-existing history once the feature is wired up.
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
