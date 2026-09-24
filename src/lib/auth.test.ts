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
    expect(h1).toMatch(new RegExp(`^pbkdf2\\$${PBKDF2_ITERATIONS}\\$[0-9a-f]{64}$`));
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

  it("flags hashes below the current iteration target for rehashing", async () => {
    const salt = generateSalt();
    const fresh = await hashPassword("pw", salt, PBKDF2_ITERATIONS);
    const stale = await hashPassword("pw", salt, 10_000); // below the target
    expect(passwordNeedsRehash(fresh)).toBe(false);
    expect(passwordNeedsRehash(stale)).toBe(true);
  });
});

describe("peppered hashing", () => {
  it("round-trips a peppered hash and never stores the raw PBKDF2 digest", async () => {
    const pepper = "unit-test-pepper-secret";
    const salt = generateSalt();
    const hash = await hashPassword("correct battery staple", salt, PBKDF2_ITERATIONS, pepper);
    expect(hash).toContain("$pepper$");
    // The raw 64-hex PBKDF2 output must not appear verbatim in a peppered row.
    const rawHex = (await hashPassword("correct battery staple", salt, PBKDF2_ITERATIONS)).split("$")[2];
    expect(hash).not.toContain(rawHex);
    await expect(verifyPassword("correct battery staple", salt, hash, pepper)).resolves.toBe(true);
    await expect(verifyPassword("wrong", salt, hash, pepper)).resolves.toBe(false);
    // A peppered hash cannot be checked without the pepper.
    await expect(verifyPassword("correct battery staple", salt, hash)).resolves.toBe(false);
  });

  it("still verifies legacy un-peppered hashes and flags them for upgrade", async () => {
    const pepper = "unit-test-pepper-secret";
    const salt = generateSalt();
    const unpeppered = await hashPassword("pw", salt, PBKDF2_ITERATIONS); // pre-pepper row
    await expect(verifyPassword("pw", salt, unpeppered, pepper)).resolves.toBe(true); // verifies regardless
    expect(passwordNeedsRehash(unpeppered, PBKDF2_ITERATIONS, true)).toBe(true); // upgrade to peppered on login
    const peppered = await hashPassword("pw", salt, PBKDF2_ITERATIONS, pepper);
    expect(passwordNeedsRehash(peppered, PBKDF2_ITERATIONS, true)).toBe(false); // already current
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