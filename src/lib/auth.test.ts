import { describe, it, expect } from "vitest";
import { generateSalt, hashPassword, verifyPassword, createJWT, verifyJWT, passwordNeedsRehash, PBKDF2_ITERATIONS } from "./auth";

describe("password hashing", () => {
  it("generates unique 32-char hex salts", () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  it("is deterministic for the same password + salt", async () => {
    const salt = generateSalt();
    const h1 = await hashPassword("correct horse battery staple", salt);
    const h2 = await hashPassword("correct horse battery staple", salt);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^pbkdf2\$600000\$[0-9a-f]{64}$/);
  });

  it("verifies a correct password and rejects a wrong one", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("supersecret", salt);
    await expect(verifyPassword("supersecret", salt, hash)).resolves.toBe(true);
    await expect(verifyPassword("wrongsecret", salt, hash)).resolves.toBe(false);
  });

  it("rejects a different salt", async () => {
    const hash = await hashPassword("supersecret", generateSalt());
    await expect(verifyPassword("supersecret", generateSalt(), hash)).resolves.toBe(false);
  });

  it("accepts legacy unprefixed hashes at the legacy iteration count", async () => {
    const salt = generateSalt();
    const modern = await hashPassword("legacypw", salt, 100_000);
    const legacyHex = modern.split("$")[2]; // strip the prefix, as old rows stored only hex
    await expect(verifyPassword("legacypw", salt, legacyHex)).resolves.toBe(true);
    await expect(verifyPassword("wrongpw", salt, legacyHex)).resolves.toBe(false);
  });

  it("flags legacy hashes for rehashing but not fresh ones", async () => {
    const salt = generateSalt();
    const fresh = await hashPassword("pw", salt, PBKDF2_ITERATIONS);
    const legacy = await hashPassword("pw", salt, 100_000);
    expect(passwordNeedsRehash(fresh)).toBe(false);
    expect(passwordNeedsRehash(legacy.split("$")[2])).toBe(true); // legacy raw hex
    expect(passwordNeedsRehash(legacy)).toBe(true); // versioned-but-old-hash too
  });
});

describe("JWT", () => {
  const secret = "test-secret-value";

  it("round-trips a signed token", async () => {
    const token = await createJWT("user-1", "a@example.com", secret);
    const payload = await verifyJWT(token, secret);
    expect(payload?.sub).toBe("user-1");
    expect(payload?.email).toBe("a@example.com");
  });

  it("rejects a tampered token", async () => {
    const token = await createJWT("user-1", "a@example.com", secret);
    const [h, p, s] = token.split(".");
    const tampered = `${h}.${p}.${s.slice(0, -2)}xx`;
    expect(await verifyJWT(tampered, secret)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createJWT("user-1", "a@example.com", "other-secret");
    expect(await verifyJWT(token, secret)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyJWT("not-a-jwt", secret)).toBeNull();
  });
});