import { describe, it, expect } from "vitest";
import {
  sanitizeDuration, sanitizeMaxRedemptions, sanitizeNote, generateGiftCode,
  giftLink, isGrantOpen, nextGiftExpiry,
  GIFT_DEFAULT_DAYS, GIFT_MIN_DAYS, GIFT_MAX_DAYS, GIFT_MAX_REDEMPTIONS,
  type PromoGrantRow,
} from "./promo";
import { toSqliteUtc } from "./tier";

const DAY = 24 * 60 * 60 * 1000;

describe("sanitizeDuration", () => {
  it("defaults, clamps to the 1..365 band, and rounds", () => {
    expect(sanitizeDuration(undefined)).toBe(GIFT_DEFAULT_DAYS);
    expect(sanitizeDuration("abc")).toBe(GIFT_DEFAULT_DAYS);
    expect(sanitizeDuration(0)).toBe(GIFT_MIN_DAYS);
    expect(sanitizeDuration(-5)).toBe(GIFT_MIN_DAYS);
    expect(sanitizeDuration(1000)).toBe(GIFT_MAX_DAYS);
    expect(sanitizeDuration(45.6)).toBe(46);
  });
});

describe("sanitizeMaxRedemptions", () => {
  it("defaults to a single use and clamps to the 1..10 band", () => {
    expect(sanitizeMaxRedemptions(undefined)).toBe(1);
    expect(sanitizeMaxRedemptions(0)).toBe(1);
    expect(sanitizeMaxRedemptions(999)).toBe(GIFT_MAX_REDEMPTIONS);
  });
});

describe("sanitizeNote", () => {
  it("collapses whitespace, caps length, and nulls empties", () => {
    expect(sanitizeNote("   ")).toBeNull();
    expect(sanitizeNote(123)).toBeNull();
    expect(sanitizeNote("  hi   there  ")).toBe("hi there");
    expect(sanitizeNote("x".repeat(200))).toHaveLength(80);
  });
});

describe("generateGiftCode", () => {
  it("mints a sov_gift_ code with url-safe entropy and no repeats", () => {
    const a = generateGiftCode();
    const b = generateGiftCode();
    expect(a).toMatch(/^sov_gift_[A-Za-z0-9_-]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("giftLink", () => {
  it("builds a /redeem link and url-encodes the code, trimming trailing slashes", () => {
    expect(giftLink("https://sovereign.defrag.app/", "sov_gift_abc")).toBe(
      "https://sovereign.defrag.app/redeem?code=sov_gift_abc",
    );
  });
});

describe("isGrantOpen", () => {
  const base: Pick<PromoGrantRow, "max_redemptions" | "redeemed_count" | "expires_at" | "revoked_at"> = {
    max_redemptions: 1, redeemed_count: 0, expires_at: null, revoked_at: null,
  };
  const now = new Date("2026-09-29T00:00:00.000Z");
  it("is open while unclaimed, unrevoked, and unexpired", () => {
    expect(isGrantOpen(base, now)).toBe(true);
  });
  it("closes on revocation, exhaustion, and expiry", () => {
    expect(isGrantOpen({ ...base, revoked_at: "2026-09-01 00:00:00" }, now)).toBe(false);
    expect(isGrantOpen({ ...base, redeemed_count: 1 }, now)).toBe(false);
    expect(isGrantOpen({ ...base, expires_at: toSqliteUtc(new Date(now.getTime() - DAY)) }, now)).toBe(false);
  });
  it("stays open for a future expiry", () => {
    expect(isGrantOpen({ ...base, expires_at: toSqliteUtc(new Date(now.getTime() + DAY)) }, now)).toBe(true);
  });
});

describe("nextGiftExpiry", () => {
  const now = new Date("2026-09-29T00:00:00.000Z");
  it("starts a fresh 30-day clock for an account with no pass", () => {
    expect(nextGiftExpiry(null, 30, now)).toBe(toSqliteUtc(new Date(now.getTime() + 30 * DAY)));
  });
  it("stacks on a live pass rather than resetting it", () => {
    const live = toSqliteUtc(new Date(now.getTime() + 10 * DAY));
    expect(nextGiftExpiry(live, 30, now)).toBe(toSqliteUtc(new Date(now.getTime() + 40 * DAY)));
  });
  it("restarts from now when the existing pass already lapsed", () => {
    const dead = toSqliteUtc(new Date(now.getTime() - 3 * DAY));
    expect(nextGiftExpiry(dead, 30, now)).toBe(toSqliteUtc(new Date(now.getTime() + 30 * DAY)));
  });
});
