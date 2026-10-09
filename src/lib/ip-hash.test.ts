import { describe, expect, it } from "vitest";

import { hashClientIp } from "./ip-hash";

/**
 * Locks #62: the value that lands inside an ephemeral rate-limit KV key is a
 * one-way, keyed token derived from the client IP — never the address itself,
 * and not a bare hash an attacker can invert by pre-computing the whole IPv4
 * space. The counter only needs a value that is STABLE for one client and
 * INVERTIBLE by nobody who reads the namespace without the server secret.
 */
const SECRET = "unit-test-jwt-secret-not-a-real-one";

describe("hashClientIp — privacy-preserving rate-limit token (#62)", () => {
  it("is deterministic: the same IP + secret always maps to the same token", async () => {
    const a = await hashClientIp("203.0.113.9", SECRET);
    const b = await hashClientIp("203.0.113.9", SECRET);
    expect(a).toBe(b);
  });

  it("distinguishes IPs: two different addresses never share a token", async () => {
    const a = await hashClientIp("203.0.113.9", SECRET);
    const b = await hashClientIp("198.51.100.7", SECRET);
    expect(a).not.toBe(b);
  });

  it("is KEYED, not a bare hash: the same IP under a different secret differs", async () => {
    const a = await hashClientIp("203.0.113.9", SECRET);
    const b = await hashClientIp("203.0.113.9", "a-different-secret");
    expect(a).not.toBe(b);
    // And it must not equal an unkeyed SHA-256 prefix of the IP, which is what
    // a rainbow-table attacker would precompute against a bare hash.
    const unkeyed = await sha256Hex("203.0.113.9");
    expect(a).not.toBe(unkeyed.slice(0, a.length));
  });

  it("never leaks the raw address and is a bounded lowercase-hex token", async () => {
    const ip = "203.0.113.137";
    const token = await hashClientIp(ip, SECRET);
    expect(token).not.toContain(ip);
    expect(token).toMatch(/^[0-9a-f]+$/);
    // Short enough to stay a tidy KV key, long enough that bucket collisions
    // are a rounding error (128 bits of keyed digest).
    expect(token.length).toBe(32);
  });

  it("handles the 'unknown' sentinel and IPv6 without throwing", async () => {
    const unknown = await hashClientIp("unknown", SECRET);
    expect(unknown).toMatch(/^[0-9a-f]{32}$/);
    const v6 = await hashClientIp("2001:db8::1", SECRET);
    expect(v6).toMatch(/^[0-9a-f]{32}$/);
    expect(v6).not.toBe(unknown);
  });

  it("degrades to a still-non-raw token when no secret is configured", async () => {
    // /support and /passkey run without the session/secret guard; a missing
    // secret must never crash the limiter nor fall back to the raw IP.
    const token = await hashClientIp("203.0.113.9", "");
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(token).not.toContain("203.0.113.9");
  });
});

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
