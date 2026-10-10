import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pre-generation `{ state }` stream contract (open-tasks #10 — the long-turn
 * dead-air fix).
 *
 * Closing that row was a source-shape change to /api/chat, not a behaviour a
 * plain Vitest harness can drive (the route needs NextRequest + D1 + Workers AI
 * bindings, and the repo pins route-level ordering against the route source —
 * see chat-recall-contract.test.ts). These assertions lock the new shape in
 * exactly the way the repo already pins the recall and journey-persist ordering:
 *
 *   1. `{ threadId }` and `{ state }` are enqueued BEFORE the model is awaited,
 *      so the canvas moves during the (measured 19–43s worst-case) inference
 *      wait instead of after it.
 *   2. `{ content }` is enqueued only AFTER generation returns — the validated
 *      text stays gated; no unvalidated token is ever painted (the hard
 *      constraint that keeps true token-streaming out).
 *   3. A generation failure closes the stream with NO `{ content }`/`[DONE]` and
 *      no early 503, so the client's `!sawDone || !sawContent` path arms its
 *      one-tap retry and a failed turn never paints a half-answer.
 *   4. A first-ever arc's real journey id is delivered in a corrected frame
 *      (with `newly_unlocked: []`) once persistence mints it.
 */

const src = readFileSync(join(__dirname, "../app/api/chat/route.ts"), "utf8");

describe("chat route pre-generation state stream (#10)", () => {
  const threadIdIdx = src.indexOf("JSON.stringify({ threadId: currentThreadId })");
  const earlyStateIdx = src.indexOf("state: journeyState, inquiryLevel: context.level, journeyId: knownJourneyId");
  const genIdx = src.indexOf("await generateSovereignResponse(");
  const contentIdx = src.indexOf("JSON.stringify({ content: result.text })");

  it("flushes { threadId } and { state } before awaiting the model", () => {
    expect(genIdx).toBeGreaterThan(-1);
    expect(threadIdIdx).toBeGreaterThan(-1);
    expect(earlyStateIdx).toBeGreaterThan(-1);
    expect(threadIdIdx).toBeLessThan(genIdx);
    expect(earlyStateIdx).toBeLessThan(genIdx);
    // The early frame's id comes from the already-loaded active journey.
    expect(src).toContain("priorActiveJourney?.id ?? null");
  });

  it("keeps the validated { content } frame gated behind generation", () => {
    expect(contentIdx).toBeGreaterThan(genIdx);
  });

  it("opens the stream before generation (async start), not after it", () => {
    // The ReadableStream must be constructed ahead of the model call; the old
    // shape built it only after generation completed.
    const streamIdx = src.indexOf("const sseStream = new ReadableStream<Uint8Array>");
    expect(streamIdx).toBeGreaterThan(-1);
    expect(streamIdx).toBeLessThan(genIdx);
    expect(src).toContain("async start(controller)");
  });
});

describe("chat route failure path (no half-answer)", () => {
  const genIdx = src.indexOf("await generateSovereignResponse(");
  const catchEnd = src.indexOf("const tGen = Date.now();", genIdx);
  const failureRegion = src.slice(genIdx, catchEnd);

  it("closes the stream without { content } / [DONE] on a generation throw", () => {
    expect(catchEnd).toBeGreaterThan(genIdx);
    expect(failureRegion).toMatch(/catch \(err\) \{/);
    expect(failureRegion).toContain("controller.close();");
    expect(failureRegion).not.toContain("JSON.stringify({ content: result.text })");
    expect(failureRegion).not.toContain("data: [DONE]");
  });

  it("no longer returns an early 503 JSON once the stream is open", () => {
    // A 503 can only precede the stream open now; inside the stream a failure is
    // an in-band close so the client's retry path (not a lost turn) handles it.
    expect(failureRegion).not.toContain("status: 503");
  });

  it("still refunds a claimed answer and counts the model error", () => {
    expect(failureRegion).toContain("releaseAnswer(env, payload.sub)");
    expect(failureRegion).toContain("ops:model-errors:");
  });
});

describe("chat route first-arc journey id delivery", () => {
  it("sends a corrected state frame when persistence mints a new id", () => {
    expect(src).toContain("newly_unlocked: []");
    expect(src).toMatch(/activeJourneyId !== knownJourneyId/);
    // The correction carries the real persisted id, not the provisional null.
    expect(src).toMatch(/journeyId: activeJourneyId/);
  });
});
