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

/**
 * Validate three user-entered DOB parts and compose an ISO `YYYY-MM-DD` string
 * (the exact shape `/api/baseline` expects). Rejects missing, non-numeric,
 * out-of-range, and impossible-calendar dates with a human-readable message.
 */
export function validateDateOfBirth(
  monthRaw: string,
  dayRaw: string,
  yearRaw: string,
  currentYear: number = new Date().getUTCFullYear(),
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
  return { ok: true, iso };
}
