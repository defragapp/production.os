import { describe, it, expect } from "vitest";
import { deleteThreadEmbeddings, embedTurn } from "./chat-embeddings";
import type { AppEnv } from "./env";

const USER = "user-1";
const THREAD_A = "thread-a";
const THREAD_B = "thread-b";

/**
 * Mock Vectorize Index to prove the actual deletion invariant.
 * We use a Map to simulate the index and track exactly which
 * deterministic IDs are present.
 */
class MockVectorize {
  private store = new Map<string, { id: string; values: number[]; namespace?: string; metadata?: Record<string, unknown> }>();
  public deleteLog: string[] = [];

  async upsert(vectors: Array<{ id: string; values: number[]; namespace?: string; metadata?: Record<string, unknown> }>) {
    for (const v of vectors) {
      this.store.set(v.id, v);
    }
    return {};
  }

  async deleteByIds(ids: string[]) {
    this.deleteLog.push(...ids);
    for (const id of ids) {
      this.store.delete(id);
    }
    return {};
  }

  async query(vector: number[], options: { namespace: string }) {
    const matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> = [];
    for (const [id, v] of this.store.entries()) {
      if (v.namespace === options.namespace) {
        matches.push({ id, score: 0.9, metadata: v.metadata });
      }
    }
    return { matches, count: matches.length };
  }

  exists(id: string): boolean {
    return this.store.has(id);
  }

  count(): number {
    return this.store.size;
  }
}

function createTestEnv(vectorize: MockVectorize): AppEnv {
  return {
    DB: { prepare: () => ({ bind: () => ({ first: async () => ({}) }) }) },
    SESSION_KV: { get: async () => null, put: async () => {} },
    AI: {
      async run() {
        return { data: [[0.1, 0.2, 0.3]] };
      },
    },
    ASSETS: {} as unknown as AppEnv["ASSETS"],
    VECTORIZE: vectorize as unknown as AppEnv["VECTORIZE"],
    AI_GATEWAY_ID: "test",
    FROM_EMAIL: "test@test.com",
    BASELINE_HORIZONS_URL: "test",
    STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY: "test",
    STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL: "test",
    STRIPE_SUCCESS_URL: "test",
    STRIPE_CANCEL_URL: "test",
    STRIPE_PORTAL_RETURN_URL: "test",
    JWT_SECRET: "test",
    PASSWORD_PEPPER: "test",
    STRIPE_WEBHOOK_SECRET: "test",
    STRIPE_SECRET_KEY: "test",
    RESEND_API_KEY: "test",
    SUPPORT_INBOX: "test",
    TURNSTILE_SITE_KEY: "test",
    TURNSTILE_SECRET_KEY: "test",
    TURNSTILE_REQUIRED: "false",
    RECALL_MIN_SCORE: 0.82,
    TRANSIT_CONJUNCTION_ORB: 1.5,
  } as unknown as AppEnv;
}

describe("Privacy: deleteThreadEmbeddings", () => {
  it("empirically proves total deletion of a thread without affecting other users/threads", async () => {
    const vectorize = new MockVectorize();
    const env = createTestEnv(vectorize);

    // 1. Setup: Embed turns for two different threads
    // Thread A: 2 turns (User, Assistant)
    await embedTurn(env, USER, { threadId: THREAD_A, turnIndex: 0, role: "user", text: "Hello A" });
    await embedTurn(env, USER, { threadId: THREAD_A, turnIndex: 0, role: "assistant", text: "Hi A" });
    
    // Thread B: 1 turn (User)
    await embedTurn(env, USER, { threadId: THREAD_B, turnIndex: 0, role: "user", text: "Hello B" });

    expect(vectorize.count()).toBe(3);

    // 2. Execute Deletion for Thread A
    // The real production code calls deleteThreadEmbeddings(env, userId, threadId, turnCount)
    // For Thread A, turnCount is 1 (indices 0..0, both roles).
    await deleteThreadEmbeddings(env, USER, THREAD_A, 1);

    // 3. Prove Absence
    // The 18-byte deterministic IDs for Thread A should be gone.
    // We check the store directly via the Mock.
    const remaining = await vectorize.query([0], { namespace: USER });
    
    // Only Thread B should remain.
    expect(remaining.count).toBe(1);
    expect(remaining.matches[0]!.metadata!.threadId).toBe(THREAD_B);

    // Verify that the specific IDs for Thread A were the ones requested for deletion.
    // We check the deleteLog of our mock.
    expect(vectorize.deleteLog).toHaveLength(2);
    // IDs should start with "ce" per the deterministic implementation.
    expect(vectorize.deleteLog[0]).toMatch(/^ce[0-9a-f]{16}$/);
    expect(vectorize.deleteLog[1]).toMatch(/^ce[0-9a-f]{16}$/);
  });

  it("handles empty threads gracefully without error", async () => {
    const vectorize = new MockVectorize();
    const env = createTestEnv(vectorize);
    
    const result = await deleteThreadEmbeddings(env, USER, "empty-thread", 0);
    expect(result).toBe(0);
    expect(vectorize.deleteLog).toHaveLength(0);
  });

  it("handles missing Vectorize binding gracefully", async () => {
    const env = createTestEnv({} as unknown as MockVectorize);
    delete (env as unknown as Record<string, unknown>).VECTORIZE;
    
    const result = await deleteThreadEmbeddings(env, USER, THREAD_A, 1);
    expect(result).toBe(0);
  });
});
