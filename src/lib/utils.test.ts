import { describe, it, expect } from "vitest";
import { parseD1Date, formatD1Date } from "./utils";

/**
 * D1's datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC with no zone
 * marker. Fed to `new Date()` raw, Safari yields Invalid Date and every
 * "Member since"/timestamp surface breaks — these pin the normalization.
 */
describe("parseD1Date", () => {
  it("anchors bare D1 UTC timestamps as UTC", () => {
    const d = parseD1Date("2026-09-26 05:32:39");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-09-26T05:32:39.000Z");
  });

  it("passes through ISO strings that already carry a zone", () => {
    expect(parseD1Date("2026-09-26T05:32:39Z")?.toISOString()).toBe("2026-09-26T05:32:39.000Z");
    expect(parseD1Date("2026-09-26T05:32:39+08:00")?.toISOString()).toBe("2026-09-25T21:32:39.000Z");
  });

  it("returns null for empty or unparseable values", () => {
    expect(parseD1Date(null)).toBeNull();
    expect(parseD1Date(undefined)).toBeNull();
    expect(parseD1Date("")).toBeNull();
    expect(parseD1Date("not a date")).toBeNull();
  });
});

describe("formatD1Date", () => {
  it("formats a D1 timestamp as a calendar date", () => {
    // Pinned to UTC so the assertion doesn't drift with the machine timezone.
    expect(formatD1Date("2026-09-26 05:32:39", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })).toBe("September 26, 2026");
  });

  it("falls back to an em dash instead of Invalid Date", () => {
    expect(formatD1Date("garbage")).toBe("—");
    expect(formatD1Date(null)).toBe("—");
  });
});
