import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Source-contract tests for the advisory fixes #34 (public health detail)
 * and #32 (webhook event-marking order). Routes are not importable under
 * the plain vitest setup (no alias config), and the repo's established
 * pattern for route invariants is reading the route source — as
 * chat-recall-contract.test.ts and the F-F call-site block do.
 */

describe("/api/health — degraded response carries no internal error detail (#34)", () => {
  const src = readFileSync("src/app/api/health/route.ts", "utf8");

  it("does not return the caught error message in the response body", () => {
    expect(src).not.toMatch(/error:\s*message/);
    expect(src).not.toMatch(/degraded[^}]*error/);
  });

  it("logs the detail server-side instead (tails read logs, not the public body)", () => {
    expect(src).toMatch(/console\.error\([^)]*(degraded|health)/);
  });

  it("still returns 503 with the degraded status for uptime monitors", () => {
    expect(src).toContain('status: "degraded"');
    expect(src).toContain("status: 503");
  });
});

describe("Stripe webhook — at-least-once processing with duplicate skip (#32)", () => {
  const src = readFileSync("src/app/api/webhooks/stripe/route.ts", "utf8");

  it("checks the processed-event marker before dispatching", () => {
    const getIdx = src.indexOf("stripe-event:");
    const switchIdx = src.indexOf("switch (event.type)");
    expect(getIdx).toBeGreaterThan(-1);
    expect(getIdx).toBeLessThan(switchIdx);
  });

  it("marks the event processed only AFTER the handler switch — a mid-handler failure must stay retryable", () => {
    const putIdx = src.indexOf("SESSION_KV.put(eventKey");
    const switchIdx = src.indexOf("switch (event.type)");
    expect(putIdx).toBeGreaterThan(switchIdx);
  });

  it("skips already-delivered events with a 200 duplicate answer", () => {
    expect(src).toMatch(/duplicate:\s*true/);
  });

  it("tolerates a missing event id rather than collapsing every such event into one key", () => {
    expect(src).toMatch(/event\.id\s*\?|\(?event\.id\)?\s*&&|if\s*\(\s*event\.id\s*\)/);
  });
});
