import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Returning-user thread-load state (open-tasks #19).
 *
 * A failed `/api/threads` fetch used to `return []`, which is
 * indistinguishable from "you have no conversations yet" — so a returning
 * member whose request blinked saw the first-run empty state as if their
 * history had vanished, with no way to retry. This pins the fix at the
 * source-shape level (the repo's pattern for UI invariants a plain Vitest
 * harness cannot drive — see chat-stream-contract.test.ts):
 *
 *   1. `refreshThreads` flags the failure on BOTH exit paths (`!res.ok` and
 *      the `catch`) and clears it on success.
 *   2. The failure renders as its own retry state, distinct from the first-run
 *      empty state, which must stay intact.
 */

const src = readFileSync(join(__dirname, "../app/chat/chat-client.tsx"), "utf8");

describe("returning-user thread-load error state (#19)", () => {
  it("marks a failed thread fetch instead of silently returning empty", () => {
    const refreshIdx = src.indexOf("const refreshThreads = useCallback");
    const endIdx = src.indexOf("}, []);", refreshIdx);
    expect(refreshIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(refreshIdx);
    const region = src.slice(refreshIdx, endIdx);
    // Both failure exits flag the error...
    expect(region).toContain("if (!res.ok) {");
    expect(region.match(/setThreadsError\(true\)/g)?.length).toBe(2);
    // ...and a success clears it.
    expect(region).toContain("setThreadsError(false)");
  });

  it("renders the failure as a retry, distinct from the first-run empty state", () => {
    // The first-run prompt survives alongside the new error branch.
    expect(src).toContain("Start with what");
    expect(src).toContain("Couldn&apos;t load your conversations");
    // The library receives both the error flag and a retry handler.
    expect(src).toContain("error={threadsError}");
    expect(src).toContain("onRetry={refreshThreads}");
  });
});
