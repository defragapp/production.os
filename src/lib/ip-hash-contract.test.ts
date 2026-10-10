import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Source-contract lock for #62: every ephemeral rate-limit KV key that used to
 * interpolate a raw `cf-connecting-ip` must now interpolate a hashed token
 * produced by `hashClientIp`, and must not leak the bare address. The routes
 * aren't importable under plain vitest (no alias/D1 runtime), so — matching the
 * established advisory-hardening pattern — we assert against the shipped source.
 */
const authSrc = readFileSync("src/app/api/auth/route.ts", "utf8");
const passkeySrc = readFileSync("src/app/api/auth/passkey/authenticate/route.ts", "utf8");
const supportSrc = readFileSync("src/app/api/support/route.ts", "utf8");

describe("all IP-derived rate-limit KV keys hash the address (#62)", () => {
  it("auth route: imports hashClientIp and keys login/signup buckets on the token", () => {
    expect(authSrc).toMatch(/import \{ hashClientIp \} from "@\/lib\/ip-hash"/);
    expect(authSrc).toMatch(/hashClientIp\(/);
    expect(authSrc).toContain("`login-rl:${ipToken}:");
    expect(authSrc).toContain("`signup-ip-rl:${ipToken}`");
  });

  it("auth route: no key still interpolates the raw ip", () => {
    expect(authSrc).not.toMatch(/login-rl:\$\{ip\b/);
    expect(authSrc).not.toMatch(/signup-ip-rl:\$\{ip\b/);
  });

  it("passkey route: pkauth bucket keys on the hashed token, not the address", () => {
    expect(passkeySrc).toMatch(/import \{ hashClientIp \} from "@\/lib\/ip-hash"/);
    expect(passkeySrc).toContain("`pkauth-rl:${ipToken}:");
    expect(passkeySrc).not.toMatch(/pkauth-rl:\$\{ip\b/);
  });

  it("support route: IP throttle keys on the hashed token, not the address", () => {
    expect(supportSrc).toMatch(/import \{ hashClientIp \} from "@\/lib\/ip-hash"/);
    expect(supportSrc).toContain("`rl:support-ip:${ipToken}`");
    expect(supportSrc).not.toMatch(/rl:support-ip:\$\{ip\b/);
  });
});
