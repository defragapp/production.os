/**
 * Pure, dependency-free date-of-birth validation shared by the Baseline form.
 *
 * The Baseline is the funnel's anchor and the entire product gates behind it, so
 * the entry path must fail loudly and accessibly rather than relying on a native
 * `<input type="date">` (whose segmented shadow-DOM field is unreachable for
 * keyboard / screen-reader / automated entry and silently blocks submit).
 * Three separate month / day / year numbers composed here give a clear, single
 * source of truth that is trivially unit-testable.
 */

/** Days in a given month. `month` is 1-12; leap years handled by Date math. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export type DateOfBirthResult =
  | { ok: true; iso: string }
  | { ok: false; error: string };

const MIN_YEAR = 1900;

/** Hard eligibility floor: Sovereign OS is an adult-only product (Terms §3). */
export const MIN_ADULT_AGE = 18;

export const UNDER_18_ERROR = "Sovereign OS is only available to adults 18 and older.";

/**
 * Whole years elapsed between an ISO `YYYY-MM-DD` birth date and `now` (UTC).
 * Calendar-exact: someone born 2008-10-01 is 17 until 2026-10-01, 18 on it.
 * Returns NaN for a non-ISO / unparseable value so callers fail closed.
 */
export function ageInYearsAt(iso: string, now: Date = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN;
  const birth = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(birth)) return NaN;
  const b = new Date(birth);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - b.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/** True when an ISO DOB represents a person at least 18 as of `now` (UTC).
 *  Unparseable dates are NOT adults — server routes fail closed. */
export function isAdultIso(iso: string, now: Date = new Date()): boolean {
  const age = ageInYearsAt(iso, now);
  return Number.isFinite(age) && age >= MIN_ADULT_AGE;
}

/**
 * Validate three user-entered DOB parts and compose an ISO `YYYY-MM-DD` string
 * (the exact shape `/api/baseline` expects). Rejects missing, non-numeric,
 * out-of-range, impossible-calendar, and under-18 dates with a human-readable
 * message. The three `current*` params exist for tests and pinned contexts —
 * together they fix "today" completely, so the 18+ boundary never depends on
 * the machine clock's month or day.
 */
export function validateDateOfBirth(
  monthRaw: string,
  dayRaw: string,
  yearRaw: string,
  currentYear: number = new Date().getUTCFullYear(),
  currentMonth: number = new Date().getUTCMonth() + 1,
  currentDay: number = new Date().getUTCDate(),
): DateOfBirthResult {
  const month = parseInt(monthRaw, 10);
  const day = parseInt(dayRaw, 10);
  const year = parseInt(yearRaw, 10);
  if (!monthRaw || !dayRaw || !yearRaw || Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) {
    return { ok: false, error: "Please enter your full date of birth — month, day, and year." };
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: "Month must be between 1 and 12." };
  }
  if (year < MIN_YEAR || year > currentYear) {
    return { ok: false, error: `Year must be between ${MIN_YEAR} and ${currentYear}.` };
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return { ok: false, error: `That month only has ${daysInMonth(year, month)} days — please check the day.` };
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // 18+ eligibility floor (Terms §3). Any pinned `currentYear` (tests, form
  // context) pins the whole UTC date so the boundary stays deterministic;
  // with no pin, the live UTC clock owns it.
  const today = new Date();
  if (currentYear !== undefined) today.setTime(Date.UTC(currentYear, currentMonth - 1, currentDay));
  if (!isAdultIso(iso, today)) {
    return { ok: false, error: UNDER_18_ERROR };
  }
  return { ok: true, iso };
}
