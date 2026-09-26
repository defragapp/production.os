import { describe, it, expect } from "vitest";
import { validateDateOfBirth, daysInMonth } from "./date-of-birth";

describe("daysInMonth", () => {
  it("handles leap vs common February", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });
  it("handles 30- and 31-day months", () => {
    expect(daysInMonth(2021, 4)).toBe(30);
    expect(daysInMonth(2021, 12)).toBe(31);
  });
});

describe("validateDateOfBirth", () => {
  it("composes a zero-padded ISO string in YYYY-MM-DD order", () => {
    expect(validateDateOfBirth("6", "15", "1990", 2026)).toEqual({ ok: true, iso: "1990-06-15" });
    expect(validateDateOfBirth("3", "9", "2000", 2026)).toEqual({ ok: true, iso: "2000-03-09" });
    expect(validateDateOfBirth("12", "31", "1999", 2026)).toEqual({ ok: true, iso: "1999-12-31" });
  });

  it("rejects missing or non-numeric parts", () => {
    expect(validateDateOfBirth("", "15", "1990", 2026).ok).toBe(false);
    expect(validateDateOfBirth("6", "", "1990", 2026).ok).toBe(false);
    expect(validateDateOfBirth("6", "15", "", 2026).ok).toBe(false);
    expect(validateDateOfBirth("ab", "15", "1990", 2026).ok).toBe(false);
  });

  it("rejects out-of-range months and days", () => {
    expect(validateDateOfBirth("0", "15", "1990", 2026).ok).toBe(false);
    expect(validateDateOfBirth("13", "15", "1990", 2026).ok).toBe(false);
    expect(validateDateOfBirth("6", "0", "1990", 2026).ok).toBe(false);
    expect(validateDateOfBirth("6", "31", "1990", 2026).ok).toBe(false);
  });

  it("rejects impossible calendar days for the specific month", () => {
    const res = validateDateOfBirth("2", "30", "2024", 2026);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/only has 29 days/);
    expect(validateDateOfBirth("2", "29", "2024", 2026).ok).toBe(true);
    expect(validateDateOfBirth("2", "29", "2023", 2026).ok).toBe(false);
  });

  it("rejects years out of the sane range", () => {
    expect(validateDateOfBirth("6", "15", "1899", 2026).ok).toBe(false);
    expect(validateDateOfBirth("6", "15", "2027", 2026).ok).toBe(false);
    expect(validateDateOfBirth("6", "15", "2026", 2026).ok).toBe(true);
  });
});
