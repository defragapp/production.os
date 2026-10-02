import { describe, it, expect } from "vitest";
import { recallPriorSignals, hydrateMatches } from "./chat-recall";
import type { AppEnv } from "./env";

const USER = "user-1";

/** D1 `datetime('now')` yields "YYYY-MM-DD HH:MM:SS" in UTC with no zone
 *  marker. Recall compares against that exact shape via parseD1Date, so the
 *  fixtures must use it — an ISO string with a Z suffix would mask a bug. */
function d1DaysAgo(days: number): string {
  const ms = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

/** Vectorize stores per-turn `indexedAt` as a full ISO string (with the Z
 *  marker) — that is what the freshness gate now reads, so these fixtures use
 *  the live shape rather than the D1 space form above. */
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Default index time when a test does not pin one: comfortably older than the
 *  7-day window, so survivors stay in play unless the test opts into recency. */
const OLD_ENOUGH = isoDaysAgo(20);

type Role = "user" | "assistant";
type MatchFixture = { threadId: string; turnIndex: number; role: Role; score: number; indexedAt?: string | null };
type ThreadRow = { id: string; message_history: string; updated_at: string | null };

function thread(
  id: string,
  updatedAt: string | null,
  messages: Array<{ role: Role; content: string }>,
): ThreadRow {
  return { id, message_history: JSON.stringify(messages), updated_at: updatedAt };
}

/**
 * Minimal env covering exactly the three bindings the recall path touches:
 *   - AI.run returns a dummy vector (the values are irrelevant — Vectorize is
 *     stubbed to echo our fixture matches regardless of the query vector).
 *   - VECTORIZE.query returns the fixture matches under the per-user namespace.
 *   - DB.prepare().bind().all() returns the fixture thread rows.
 * `vectorizeThrows` reproduces an index outage to assert the [] collapse.
 */
function fakeEnv(opts: {
  matches: MatchFixture[];
  threads: ThreadRow[];
  vectorizeThrows?: boolean;
  minScore?: number;
}): AppEnv {
  const env = {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async all() {
                return { results: opts.threads };
              },
            };
          },
        };
      },
    },
    AI: {
      async run() {
        return { data: [[0.1, 0.2, 0.3]] };
      },
    },
    VECTORIZE: {
      async query() {
        if (opts.vectorizeThrows) throw new Error("index unavailable");
        return {
          count: opts.matches.length,
          matches: opts.matches.map((m) => ({
            id: `${USER}::${m.threadId}::${m.turnIndex}::${m.role}`,
            score: m.score,
            metadata: { userId: USER, threadId: m.threadId, turnIndex: m.turnIndex, role: m.role, indexedAt: m.indexedAt ?? OLD_ENOUGH },
          })),
        };
      },
    },
  };
  if (opts.minScore !== undefined) (env as Record<string, unknown>).RECALL_MIN_SCORE = opts.minScore;
  return env as unknown as AppEnv;
}

describe("recallPriorSignals", () => {
  it("never echoes the live thread", async () => {
    const env = fakeEnv({
      matches: [{ threadId: "live", turnIndex: 0, role: "user", score: 0.95 }],
      threads: [thread("live", d1DaysAgo(30), [{ role: "user", content: "I keep circling this." }])],
    });
    const signals = await recallPriorSignals(env, USER, "circling", "live");
    expect(signals).toEqual([]);
  });

  it("drops matches below the cosine floor", async () => {
    const env = fakeEnv({
      matches: [
        { threadId: "t-weak", turnIndex: 0, role: "user", score: 0.8 },
        { threadId: "t-strong", turnIndex: 0, role: "user", score: 0.9 },
      ],
      threads: [
        thread("t-weak", d1DaysAgo(20), [{ role: "user", content: "weak match" }]),
        thread("t-strong", d1DaysAgo(20), [{ role: "user", content: "strong match" }]),
      ],
    });
    const signals = await recallPriorSignals(env, USER, "query", "current");
    expect(signals).toHaveLength(1);
    expect(signals[0].threadId).toBe("t-strong");
  });

  it("drops matches inside the freshness window (per-turn, not per-thread)", async () => {
    const env = fakeEnv({
      matches: [
        { threadId: "t-fresh", turnIndex: 0, role: "user", score: 0.93, indexedAt: isoDaysAgo(2) },
        { threadId: "t-old", turnIndex: 0, role: "user", score: 0.9, indexedAt: isoDaysAgo(20) },
      ],
      // Both rows carry an identical, old thread `updated_at` on purpose: the
      // gate must key off each turn's own index time, so only t-fresh is cut.
      threads: [
        thread("t-fresh", d1DaysAgo(20), [{ role: "user", content: "too recent turn" }]),
        thread("t-old", d1DaysAgo(20), [{ role: "user", content: "genuinely earlier" }]),
      ],
    });
    const signals = await recallPriorSignals(env, USER, "query", "current");
    expect(signals.map((s) => s.threadId)).toEqual(["t-old"]);
  });

  it("surfaces an old turn from a thread that is still open today", async () => {
    // A month-old statement inside a thread whose `updated_at` is 'today' must
    // still recall — the exact regression the thread-level filter caused.
    const env = fakeEnv({
      matches: [{ threadId: "t-longopen", turnIndex: 0, role: "user", score: 0.9, indexedAt: isoDaysAgo(30) }],
      threads: [thread("t-longopen", d1DaysAgo(0), [{ role: "user", content: "old thought, live thread" }])],
    });
    const signals = await recallPriorSignals(env, USER, "query", "current");
    expect(signals.map((s) => s.threadId)).toEqual(["t-longopen"]);
    expect(signals[0].occurredAt).not.toBeNull();
  });

  it("drops a fresh turn even when its owning thread looks old", async () => {
    // Per-turn wins over per-thread: a recently-added turn in an aged thread
    // is still 'too recent' to honestly call recall.
    const env = fakeEnv({
      matches: [{ threadId: "t-resumed", turnIndex: 0, role: "user", score: 0.95, indexedAt: isoDaysAgo(2) }],
      threads: [thread("t-resumed", d1DaysAgo(40), [{ role: "user", content: "just said this" }])],
    });
    const signals = await recallPriorSignals(env, USER, "query", "current");
    expect(signals).toEqual([]);
  });

  it("honors env.RECALL_MIN_SCORE to admit a lower-scoring match", async () => {
    // 0.80 is below the 0.82 default floor; a tuned floor of 0.75 lets it pass.
    const env = fakeEnv({
      matches: [{ threadId: "t-mid", turnIndex: 0, role: "user", score: 0.8, indexedAt: isoDaysAgo(20) }],
      threads: [thread("t-mid", d1DaysAgo(20), [{ role: "user", content: "borderline paraphrase" }])],
      minScore: 0.75,
    });
    const signals = await recallPriorSignals(env, USER, "query", "current");
    expect(signals.map((s) => s.threadId)).toEqual(["t-mid"]);
  });

  it("falls back to the default floor when RECALL_MIN_SCORE is out of range", async () => {
    const env = fakeEnv({
      matches: [{ threadId: "t-mid", turnIndex: 0, role: "user", score: 0.8, indexedAt: isoDaysAgo(20) }],
      threads: [thread("t-mid", d1DaysAgo(20), [{ role: "user", content: "borderline paraphrase" }])],
      minScore: 5, // invalid cosine bound → ignored → default 0.82 drops the 0.80
    });
    const signals = await recallPriorSignals(env, USER, "query", "current");
    expect(signals).toEqual([]);
  });

  it("collapses to [] when the index is unavailable", async () => {
    const env = fakeEnv({
      matches: [{ threadId: "t", turnIndex: 0, role: "user", score: 0.95 }],
      threads: [thread("t", d1DaysAgo(30), [{ role: "user", content: "x" }])],
      vectorizeThrows: true,
    });
    await expect(recallPriorSignals(env, USER, "query", "current")).resolves.toEqual([]);
  });

  it("caps the result at 5 survivors", async () => {
    const matches: MatchFixture[] = [];
    const threads: ThreadRow[] = [];
    for (let i = 0; i < 7; i++) {
      matches.push({ threadId: `t-${i}`, turnIndex: 0, role: "user", score: 0.9 });
      threads.push(thread(`t-${i}`, d1DaysAgo(20), [{ role: "user", content: `statement ${i}` }]));
    }
    const signals = await recallPriorSignals(fakeEnv({ matches, threads }), USER, "query", "current");
    expect(signals).toHaveLength(5);
  });

  it("sorts survivors by score, tightest first", async () => {
    const matches: MatchFixture[] = [
      { threadId: "t-lo", turnIndex: 0, role: "user", score: 0.85 },
      { threadId: "t-hi", turnIndex: 0, role: "user", score: 0.98 },
      { threadId: "t-mid", turnIndex: 0, role: "user", score: 0.9 },
    ];
    const threads = matches.map((m) =>
      thread(m.threadId, d1DaysAgo(20), [{ role: "user", content: m.threadId }]),
    );
    const signals = await recallPriorSignals(fakeEnv({ matches, threads }), USER, "query", "current");
    expect(signals.map((s) => s.threadId)).toEqual(["t-hi", "t-mid", "t-lo"]);
  });

  it("drops a match whose thread row is missing", async () => {
    const env = fakeEnv({
      matches: [{ threadId: "gone", turnIndex: 0, role: "user", score: 0.95 }],
      threads: [],
    });
    const signals = await recallPriorSignals(env, USER, "query", "current");
    expect(signals).toEqual([]);
  });
});

describe("hydrateMatches", () => {
  it("keeps the role-agreement guard and clamps long snippets", async () => {
    const longText = "a".repeat(400);
    const env = fakeEnv({
      matches: [],
      threads: [
        thread("t1", d1DaysAgo(10), [
          { role: "user", content: longText },
          { role: "assistant", content: "short reply" },
        ]),
      ],
    });
    const out = await hydrateMatches(env, USER, [
      { threadId: "t1", turnIndex: 0, role: "user", score: 0.9, indexedAt: OLD_ENOUGH },
      // Stale vector: claims assistant at index 0, but the row is a user turn.
      { threadId: "t1", turnIndex: 0, role: "assistant", score: 0.9, indexedAt: OLD_ENOUGH },
      { threadId: "t1", turnIndex: 1, role: "assistant", score: 0.9, indexedAt: OLD_ENOUGH },
    ]);
    expect(out).toHaveLength(2);
    const clipped = out.find((h) => h.turnIndex === 0)!;
    expect(clipped.snippet.length).toBeLessThanOrEqual(320);
    expect(clipped.snippet.endsWith("…")).toBe(true);
  });
});
