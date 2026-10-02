import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hydrateMatches } from "./chat-recall";
import type { AppEnv } from "./env";

const USER = "user-1";

/**
 * The search route (/api/chat/search) and the recall path now share exactly
 * one hydration implementation. These are regression pins for Turn 8's wiring,
 * written the same way the repo pins route-level behavior elsewhere (see
 * hydration.test.ts): a runtime contract check on the shared function, plus
 * source assertions that the routes still route through it. A full NextRequest
 * + D1 + Workers-AI harness is not configured here (no @-alias runtime
 * resolution under vitest), so the SSE frame ordering on the chat route is
 * pinned against the route source rather than by driving the handler.
 */

describe("hydrateMatches — search route 200 contract", () => {
  it("emits exactly the documented result shape the search route returns", async () => {
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                async all() {
                  return {
                    results: [
                      { id: "t1", message_history: JSON.stringify([{ role: "user", content: "remember this" }]), updated_at: "2026-01-01 00:00:00" },
                    ],
                  };
                },
              };
            },
          };
        },
      },
    } as unknown as AppEnv;

    const [row] = await hydrateMatches(env, USER, [
      { threadId: "t1", turnIndex: 0, role: "user", score: 0.9, indexedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    // /api/chat/search serializes hydrateMatches output verbatim into
    // { results: [...] }; the field set is the public response contract.
    expect(Object.keys(row).sort()).toEqual(
      ["role", "score", "snippet", "threadId", "turnIndex", "updatedAt"].sort(),
    );
    expect(row).toMatchObject({ threadId: "t1", turnIndex: 0, role: "user", score: 0.9, snippet: "remember this", updatedAt: "2026-01-01 00:00:00" });
  });
});

describe("search route wiring", () => {
  const src = readFileSync(join(__dirname, "../app/api/chat/search/route.ts"), "utf8");

  it("delegates hydration to the shared chat-recall module", () => {
    expect(src).toContain('import { hydrateMatches } from "@/lib/chat-recall"');
    expect(src).toContain("await hydrateMatches(env, payload.sub, matches)");
  });

  it("no longer carries a local hydrate() implementation", () => {
    // The refactor moved the one hydration path into chat-recall.ts; a stray
    // local copy here would silently re-diverge the two callers.
    expect(src).not.toMatch(/function hydrate\b/);
    expect(src).not.toMatch(/\bhydrate\(/);
  });

  it("keeps memory_mode='local' from reaching Vectorize", () => {
    expect(src).toMatch(/memoryMode === "local"[\s\S]*return NextResponse\.json\(\{ results: \[\], indexed: false, memoryMode: "local" \}\)/);
  });
});

describe("chat route recall wiring", () => {
  const src = readFileSync(join(__dirname, "../app/api/chat/route.ts"), "utf8");

  it("short-circuits recall for non-server memory modes", () => {
    // recallPriorSignals is only ever called under memoryMode === "server";
    // local mode resolves to [] and never touches Vectorize.
    expect(src).toMatch(/memoryMode === "server" && lastUserContent[\s\S]*recallPriorSignals\(/);
    expect(src).toContain("Promise.resolve([])");
  });

  it("flags recall from a non-empty signal list", () => {
    expect(src).toContain("usedRecall = priorSignals.length > 0;");
  });

  it("emits the recall frame only when recall was used, before [DONE]", () => {
    // Ordering matters within the main answer stream: the recall signal must
    // land after { content } and strictly before that stream's [DONE]. Note
    // the file has two `data: [DONE]` emissions (the extraction-deflection
    // stream also closes with one), so anchor on the [DONE] that follows the
    // recall enqueue rather than the first occurrence in the file.
    const recallFrameIdx = src.indexOf('JSON.stringify({ recall: true })');
    expect(recallFrameIdx).toBeGreaterThan(-1);
    const doneIdx = src.indexOf('data: [DONE]', recallFrameIdx);
    expect(doneIdx).toBeGreaterThan(recallFrameIdx);
    // The validated content frame precedes the recall signal.
    expect(src.indexOf('JSON.stringify({ content: result.text })')).toBeLessThan(recallFrameIdx);
    // Gated behind usedRecall, not always-on.
    expect(src).toMatch(/if \(usedRecall\) controller\.enqueue\([^)]*recall: true/);
  });
});
