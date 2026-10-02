/**
 * Chat Recall — turns the existing semantic index into reasoning context.
 *
 * The index itself lives in `chat-embeddings.ts` (write path via
 * `embedLatestTurn`, read path via `searchChat`). This module is the thin
 * bridge that lets the AI see the user's OWN earlier conversations inside a
 * fresh turn, without the person having to open the ⌘K search panel first.
 *
 * Two responsibilities:
 *   1. `hydrateMatches` — batch D1 hydration of Vectorize match coordinates
 *      into snippet text. Extracted verbatim from /api/chat/search so the
 *      search route and the recall path share exactly one implementation of
 *      "turn coordinate -> what was actually said" (and one role-agreement
 *      guard against stale vectors). Behavior-identical to the search route's
 *      prior local `hydrate`.
 *   2. `recallPriorSignals` — the auto-recall gate. Deliberately strict:
 *      only undeniably-tight, genuinely-old, not-current-thread matches survive.
 *      A weak or fresh match is worse than no match, because it invites the
 *      model to fabricate a connection that isn't there. So every failure
 *      mode collapses to `[]`.
 *
 * Privacy posture (inherited from the whole platform):
 *   - memory_mode='local' never reaches here — the caller short-circuits to
 *     `[]`. This module does not re-check memory mode; it trusts its caller,
 *     exactly as it trusts the userId namespace in searchChat.
 *   - Only coordinates + snippet text flow onward; the plaintext never lands
 *     in Vectorize (see chat-embeddings.ts header).
 *
 * Failure posture: every public function swallows its own errors and returns
 * an empty result. Chat must never fail, block, or slow because of recall —
 * the thread history in D1 is the source of truth; this is only an index view.
 */
import type { AppEnv } from "./env";
import { searchChat, type ChatSearchMatch } from "./chat-embeddings";
import type { PriorSignal } from "./sovereign-types";
import { parseD1Date } from "./utils";
import type { ChatMessage, Thread } from "./types";

/** Re-exported so callers can name the type without importing from two places. */
export type { PriorSignal } from "./sovereign-types";

/** A Vectorize match with its snippet + owning thread's timestamp resolved. */
export type HydratedMatch = {
  threadId: string;
  turnIndex: number;
  role: "user" | "assistant";
  score: number;
  snippet: string;
  updatedAt: string | null;
};

/**
 * Ask Vectorize for this many raw candidates, then prune hard down to
 * RECALL_MAX_SIGNALS survivors. Over-fetching gives the filters room to
 * reject the near-misses and stale/fresh rows without starving the result.
 */
const RECALL_TOP_K = 8;
/** Hard cosine floor. bge-large-en-v1.5 clusters similar paraphrase high; below
 *  this the "same thought, earlier" claim is not honest. Default only — the
 *  live floor is resolved per call via `resolveScoreFloor` so it can be tuned
 *  from prod (env.RECALL_MIN_SCORE) without a redeploy of logic. */
const RECALL_MIN_SCORE = 0.82;
/** A match newer than this is almost certainly the same live thread of thought,
 *  not a genuine earlier conversation. Excluded to stop echo-looping. */
const RECALL_FRESHNESS_DAYS = 7;
/** Cap what reaches the prompt. Beyond this it is a wall, not a signal. */
const RECALL_MAX_SIGNALS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fetch every distinct thread referenced by the match list once and pull the
 * exact turn text out of the JSON blob in memory. One D1 read for the whole
 * result set rather than one per match. (Moved verbatim from the search route;
 * the search route now imports this so both callers share one implementation.)
 */
export async function hydrateMatches(
  env: AppEnv,
  userId: string,
  matches: ChatSearchMatch[],
): Promise<HydratedMatch[]> {
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
  const out: HydratedMatch[] = [];
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

/** Stable join key for one turn, shared between the match list and hydrated rows. */
function matchKey(m: { threadId: string; turnIndex: number; role: string }): string {
  return `${m.threadId}::${m.turnIndex}::${m.role}`;
}

/**
 * Resolve the cosine floor for this call. Wrangler plain-text `vars` can deliver
 * the value as a string, so coerce defensively and clamp to a real cosine range:
 * a malformed or out-of-band value falls back to the module default rather than
 * silently disabling (or over-firing) recall.
 *
 * Exported so the peer-history path (sovereign-connections.ts) enforces exactly
 * the same env-tunable floor rather than a second hardcoded 0.82.
 */
export function resolveScoreFloor(env: AppEnv): number {
  const raw = env.RECALL_MIN_SCORE as unknown;
  const n = typeof raw === "string" ? Number(raw) : (raw as number | undefined);
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1 ? n : RECALL_MIN_SCORE;
}

/**
 * A per-turn index timestamp is "settled" (genuine earlier history, not this
 * week's live thread of thought) only when it parses AND is older than the
 * freshness window. Undated/unparseable turns (vectors indexed before
 * `indexedAt` existed, or a backfill sweep) collapse to false rather than being
 * trusted. `floorTs` defaults to the module window; callers that already
 * computed it (self-recall) pass it in to share one clock.
 *
 * Exported so self-recall and peer-recall apply the identical freshness gate.
 */
export function isSettled(
  indexedAt: string | null,
  floorTs: number = Date.now() - RECALL_FRESHNESS_DAYS * DAY_MS,
): boolean {
  if (!indexedAt) return false;
  const then = parseD1Date(indexedAt);
  if (!then) return false;
  return then.getTime() <= floorTs;
}

/**
 * The auto-recall gate. Returns up to RECALL_MAX_SIGNALS verbatim past turns
 * that clear every bar: not the current thread, above the score floor, older
 * than the freshness window, and resolvable to real snippet text.
 *
 * Freshness is judged on each turn's own `indexedAt` (when it entered the
 * index), NOT the owning thread's `updated_at` — a persistent month-long thread
 * would otherwise stay 'today' forever and hide everything said earlier in it.
 *
 * Never throws and never blocks: any failure (Vectorize miss, embedder hiccup,
 * D1 cold read) is logged and collapses to `[]`, which simply means "this turn
 * had no recall to offer." Callers may run this concurrently with other reads.
 */
export async function recallPriorSignals(
  env: AppEnv,
  userId: string,
  latestUserText: string,
  currentThreadId?: string,
): Promise<PriorSignal[]> {
  try {
    const matches = await searchChat(env, userId, latestUserText, { topK: RECALL_TOP_K });
    if (matches.length === 0) return [];

    // 1. Never echo the live thread — that is not recall, it is the present.
    const scoped = matches.filter((m) => m.threadId !== currentThreadId);
    if (scoped.length === 0) return [];

    const hydrated = await hydrateMatches(env, userId, scoped);

    // Per-turn index time keyed by turn coordinate. Hydrated rows deliberately
    // do NOT carry `indexedAt` — the search-route response contract is fixed to
    // { threadId, turnIndex, role, score, snippet, updatedAt } — so rejoin it
    // here from the match list. Freshness compares against THIS, not the
    // owning thread's `updated_at`.
    const turnTimeByKey = new Map(scoped.map((m) => [matchKey(m), m.indexedAt]));

    // 2 + 3. Score floor and freshness, applied together on the resolved rows.
    // `isSettled` is the shared gate (peer-recall uses the same predicate).
    const floorTs = Date.now() - RECALL_FRESHNESS_DAYS * DAY_MS;
    const minScore = resolveScoreFloor(env);
    const signals: PriorSignal[] = [];
    for (const h of hydrated) {
      if (h.score < minScore) continue;
      const occurredAt = turnTimeByKey.get(matchKey(h)) ?? null;
      if (!isSettled(occurredAt, floorTs)) continue;
      signals.push({
        snippet: h.snippet,
        role: h.role,
        score: h.score,
        occurredAt,
        threadId: h.threadId,
        turnIndex: h.turnIndex,
      });
    }

    // 4. Tightest matches first, bounded to keep the prompt lean.
    signals.sort((a, b) => b.score - a.score);
    return signals.slice(0, RECALL_MAX_SIGNALS);
  } catch (err) {
    console.error("[recall] failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return [];
  }
}
