import { describe, it, expect } from "vitest";
import { FREE_TIER_DAILY_LIMIT, SOVEREIGN_PLUS_DAILY_LIMIT } from "./limits";
import { claimAnswer, releaseAnswer, readUsage, todayUtc } from "./usage";

/** A D1 stub that reproduces the atomic UPSERT's exact semantics: the
 *  `DO UPDATE ... WHERE used < ? RETURNING used` branch matches nothing once
 *  the cap is spent, so `first()` returns no row and the claim is refused. */
function makeUsageEnv(initialUsed = 0) {
  let used = initialUsed;
  const DB = {
    prepare(sql: string) {
      let binds: unknown[] = [];
      const stmt: Record<string, unknown> = {
        bind(...args: unknown[]) { binds = args; return stmt; },
        async first<T>() {
          if (sql.includes("INSERT INTO chat_usage")) {
            const limit = Number(binds[2]);
            if (used < limit) { used += 1; return { used } as T; }
            return null as T;
          }
          if (sql.includes("SELECT used FROM chat_usage")) return { used } as T;
          return null as T;
        },
        async run() {
          if (sql.includes("SET used = used - 1") && used > 0) used -= 1;
          return {};
        },
      };
      return stmt;
    },
  };
  return { env: { DB } as never, peek: () => used };
}

describe("daily caps", () => {
  it("keeps free at 5 and sovereign+ at a generous 150 fair-use ceiling", () => {
    expect(FREE_TIER_DAILY_LIMIT).toBe(5);
    expect(SOVEREIGN_PLUS_DAILY_LIMIT).toBe(150);
  });

  it("claims the last free slot then refuses the next", async () => {
    const { env } = makeUsageEnv(FREE_TIER_DAILY_LIMIT - 1);
    const last = await claimAnswer(env, "u", FREE_TIER_DAILY_LIMIT);
    expect(last).toMatchObject({ claimed: true, used: FREE_TIER_DAILY_LIMIT, degraded: false });
    const over = await claimAnswer(env, "u", FREE_TIER_DAILY_LIMIT);
    expect(over.claimed).toBe(false);
    expect(over.used).toBe(FREE_TIER_DAILY_LIMIT);
  });

  it("enforces the 150/day sovereign+ ceiling exactly", async () => {
    const { env } = makeUsageEnv(SOVEREIGN_PLUS_DAILY_LIMIT - 1);
    const ok = await claimAnswer(env, "u", SOVEREIGN_PLUS_DAILY_LIMIT);
    expect(ok).toMatchObject({ claimed: true, used: SOVEREIGN_PLUS_DAILY_LIMIT });
    const capped = await claimAnswer(env, "u", SOVEREIGN_PLUS_DAILY_LIMIT);
    expect(capped.claimed).toBe(false);
    expect(capped.used).toBe(SOVEREIGN_PLUS_DAILY_LIMIT);
  });

  it("refunds a claimed slot so a failed turn is not charged", async () => {
    const { env, peek } = makeUsageEnv(0);
    await claimAnswer(env, "u", SOVEREIGN_PLUS_DAILY_LIMIT);
    expect(peek()).toBe(1);
    await releaseAnswer(env, "u");
    expect(await readUsage(env, "u")).toBe(0);
  });

  it("keys the counter to the UTC day", () => {
    expect(todayUtc(new Date("2026-09-29T23:59:59Z"))).toBe("2026-09-29");
  });
});
