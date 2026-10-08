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

describe("passkey registration — per-ceremony challenge, no cross-tab trample (#33)", () => {
  const lib = readFileSync("src/lib/passkeys.ts", "utf8");
  const route = readFileSync("src/app/api/auth/passkey/register/route.ts", "utf8");
  const client = readFileSync("src/components/passkey.tsx", "utf8");

  it("keys the registration challenge by user AND a per-ceremony request id", () => {
    expect(lib).toContain("pkreg:${user.userId}:${requestId}");
  });

  it("returns the request id to the client on options and consumes it on completion", () => {
    expect(lib).toMatch(/return \{ options, origin, rpID, requestId \}/);
    expect(lib).toMatch(/completeRegistration\([\s\S]*?requestId: string/);
  });

  it("the route ships the requestId with the options and requires it on verify", () => {
    expect(route).toMatch(/\.\.\.options,\s*requestId/);
    expect(route).toMatch(/requestId/);
    expect(route).toMatch(/completeRegistration\(env, request, user, requestId/);
  });

  it("the client carries the requestId from options into the verification body", () => {
    expect(client).toMatch(/requestId/);
    expect(client).toMatch(/JSON\.stringify\(\{\.\.\.response,\s*requestId\s*\}\)/);
  });

  it("the authentication ceremony keeps its existing per-ceremony key", () => {
    expect(lib).toContain("pkauth:${requestId}");
  });
});
