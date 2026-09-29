import { describe, it, expect } from "vitest";
import {
  resolveTier, hasPlusEntitlement, isOwnerEmail, toSqliteUtc, parseSqliteUtc,
  OWNER_EMAIL,
} from "./tier";

/** A hand-built D1 stub with just enough behaviour for the resolver's two
 *  touches: the `SELECT gift_expires_at` probe and the `UPDATE subscription_tier`
 *  self-heal. Writes are recorded so tests can assert the cache was corrected. */
function makeEnv(opts: { probeGift?: string | null; giftColumnExists?: boolean } = {}) {
  const writes: Array<{ userId: string; tier: string }> = [];
  const DB = {
    prepare(sql: string) {
      let binds: unknown[] = [];
      const stmt: Record<string, unknown> = {
        bind(...args: unknown[]) { binds = args; return stmt; },
        async first<T>() {
          if (sql.includes("SELECT gift_expires_at FROM users")) {
            if (opts.giftColumnExists === false) throw new Error("no such column");
            return { gift_expires_at: opts.probeGift ?? null } as T;
          }
          return null as T;
        },
        async run() {
          if (sql.includes("UPDATE users SET subscription_tier")) {
            // writeTier binds (tier, userId, tier).
            writes.push({ userId: String(binds[1]), tier: String(binds[0]) });
          }
          return {};
        },
      };
      return stmt;
    },
  };
  return { env: { DB } as never, writes };
}

const DAY = 24 * 60 * 60 * 1000;
const future = () => toSqliteUtc(new Date(Date.now() + 5 * DAY));
const past = () => toSqliteUtc(new Date(Date.now() - 5 * DAY));

describe("toSqliteUtc / parseSqliteUtc", () => {
  it("round-trips a Date through the D1 datetime('now') shape", () => {
    const d = new Date("2026-09-29T13:45:00.000Z");
    const s = toSqliteUtc(d);
    expect(s).toBe("2026-09-29 13:45:00");
    expect(parseSqliteUtc(s)).toBe(d.getTime());
    // The full ISO shape parses identically.
    expect(parseSqliteUtc("2026-09-29T13:45:00.000Z")).toBe(d.getTime());
  });
});

describe("isOwnerEmail", () => {
  it("matches the owner address case- and whitespace-insensitively", () => {
    expect(isOwnerEmail(`  ${OWNER_EMAIL.toUpperCase()} `)).toBe(true);
    expect(isOwnerEmail("someone@example.com")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
  });
});

describe("resolveTier", () => {
  it("elevates the verified owner to sovereign+ and heals the column", async () => {
    const { env, writes } = makeEnv();
    const r = await resolveTier(env, {
      id: "u1", email: OWNER_EMAIL, email_verified: 1, subscription_tier: "free", gift_expires_at: null,
    });
    expect(r.tier).toBe("sovereign+");
    expect(r.isOwner).toBe(true);
    expect(writes).toEqual([{ userId: "u1", tier: "sovereign+" }]);
  });

  it("does not re-write when the owner column already agrees", async () => {
    const { env, writes } = makeEnv();
    await resolveTier(env, {
      id: "u1", email: OWNER_EMAIL, email_verified: 1, subscription_tier: "sovereign+", gift_expires_at: null,
    });
    expect(writes).toEqual([]);
  });

  it("treats an unverified owner address as a normal free account", async () => {
    const { env } = makeEnv();
    const r = await resolveTier(env, {
      id: "u1", email: OWNER_EMAIL, email_verified: 0, subscription_tier: "free", gift_expires_at: null,
    });
    expect(r.isOwner).toBe(false);
    expect(r.tier).toBe("free");
  });

  it("upgrades a free account holding a live gift pass", async () => {
    const { env, writes } = makeEnv();
    const r = await resolveTier(env, {
      id: "u2", email: "a@b.co", email_verified: 1, subscription_tier: "free", gift_expires_at: future(),
    });
    expect(r.tier).toBe("sovereign+");
    expect(r.giftActive).toBe(true);
    expect(r.paid).toBe(false);
    expect(writes).toEqual([{ userId: "u2", tier: "sovereign+" }]);
  });

  it("reverts a lapsed gifted pass (no Stripe) back to free", async () => {
    const { env, writes } = makeEnv();
    const r = await resolveTier(env, {
      id: "u3", email: "a@b.co", email_verified: 1, subscription_tier: "sovereign+",
      stripe_customer_id: null, gift_expires_at: past(),
    });
    expect(r.tier).toBe("free");
    expect(r.giftActive).toBe(false);
    expect(writes).toEqual([{ userId: "u3", tier: "free" }]);
  });

  it("keeps a paying sovereign+ on a lapsed gift (Stripe owns the tier)", async () => {
    const { env, writes } = makeEnv();
    const r = await resolveTier(env, {
      id: "u4", email: "a@b.co", email_verified: 1, subscription_tier: "sovereign+",
      stripe_customer_id: "cus_1", gift_expires_at: past(),
    });
    expect(r.tier).toBe("sovereign+");
    expect(r.paid).toBe(true);
    expect(writes).toEqual([]);
  });

  it("probes the live expiry when the caller's row predates the migration", async () => {
    const { env } = makeEnv({ probeGift: future() });
    const r = await resolveTier(env, {
      id: "u5", email: "a@b.co", email_verified: 1, subscription_tier: "free",
      // gift_expires_at intentionally undefined → resolver probes.
    });
    expect(r.tier).toBe("sovereign+");
    expect(r.giftExpiresAt).not.toBeNull();
  });

  it("falls back to the stored tier on a pre-migration database with no column", async () => {
    const { env, writes } = makeEnv({ giftColumnExists: false });
    const r = await resolveTier(env, {
      id: "u6", email: "a@b.co", email_verified: 1, subscription_tier: "free",
    });
    expect(r.tier).toBe("free");
    expect(writes).toEqual([]);
  });
});

describe("hasPlusEntitlement", () => {
  it("is true for the owner and for a live gift, false for a plain free account", async () => {
    const { env } = makeEnv();
    await expect(hasPlusEntitlement(env, { id: "o", email: OWNER_EMAIL, email_verified: 1, subscription_tier: "free", gift_expires_at: null })).resolves.toBe(true);
    await expect(hasPlusEntitlement(env, { id: "g", email: "a@b.co", email_verified: 1, subscription_tier: "free", gift_expires_at: future() })).resolves.toBe(true);
    await expect(hasPlusEntitlement(env, { id: "f", email: "a@b.co", email_verified: 1, subscription_tier: "free", gift_expires_at: null })).resolves.toBe(false);
  });
});
