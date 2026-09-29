import { describe, it, expect } from "vitest";
import { validateDateOfBirth, daysInMonth, ageInYearsAt, isAdultIso, UNDER_18_ERROR } from "./date-of-birth";

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
    // Adult leap-year dates, so the 18+ floor is not what is under test in this
    // block — it is only about per-month day validity. 2000 is a leap year,
    // 2001 is not.
    const res = validateDateOfBirth("2", "30", "2000", 2026);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/only has 29 days/);
    expect(validateDateOfBirth("2", "29", "2000", 2026).ok).toBe(true);
    expect(validateDateOfBirth("2", "29", "2001", 2026).ok).toBe(false);
  });

  it("rejects years out of the sane range", () => {
    expect(validateDateOfBirth("6", "15", "1899", 2026).ok).toBe(false);
    expect(validateDateOfBirth("6", "15", "2027", 2026).ok).toBe(false);
    expect(validateDateOfBirth("6", "15", "2008", 2026, 9, 29).ok).toBe(true);
  });

  it("rejects a DOB under 18 with the adult-only message", () => {
    // Pinned today = 2026-09-29: a 2008-05-01 DOB is 18 (accepted), a
    // 2008-10-01 DOB is still 17 (rejected).
    expect(validateDateOfBirth("5", "1", "2008", 2026, 9, 29).ok).toBe(true);
    const res = validateDateOfBirth("10", "1", "2008", 2026, 9, 29);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(UNDER_18_ERROR);
    // Year 2015 — clearly a minor — is rejected as well.
    expect(validateDateOfBirth("5", "1", "2015", 2026, 9, 29).ok).toBe(false);
  });

  it("accepts an 18-year-old DOB at the exact birthday boundary", () => {
    // 18 years exactly as of the pinned UTC today passes (Terms §3 floor);
    // one day short of the birthday does not.
    expect(validateDateOfBirth("9", "29", "2008", 2026, 9, 29).ok).toBe(true);
    expect(validateDateOfBirth("9", "30", "2008", 2026, 9, 29).ok).toBe(false);
    expect(validateDateOfBirth("1", "1", "2000", 2026, 9, 29).ok).toBe(true);
  });
});

describe("ageInYearsAt / isAdultIso (UTC, calendar-exact)", () => {
  const now = new Date(Date.UTC(2026, 8, 29)); // 2026-09-29
  it("is 17 the day before the 18th birthday and 18 on it", () => {
    expect(ageInYearsAt("2008-09-30", now)).toBe(17); // 17 y 364 d
    expect(isAdultIso("2008-09-30", now)).toBe(false);
    expect(ageInYearsAt("2008-09-29", now)).toBe(18); // exactly 18 today
    expect(isAdultIso("2008-09-29", now)).toBe(true);
  });
  it("rejects a minor's DOB (2015) and accepts adults", () => {
    expect(isAdultIso("2015-05-01", now)).toBe(false);
    expect(isAdultIso("2008-09-28", now)).toBe(true);
    expect(isAdultIso("1990-06-15", now)).toBe(true);
  });
  it("fails closed on garbage instead of throwing", () => {
    expect(ageInYearsAt("not-a-date", now)).toBeNaN();
    expect(isAdultIso("2020-02-30T00:00", now)).toBe(false);
    expect(isAdultIso("", now)).toBe(false);
  });
});
