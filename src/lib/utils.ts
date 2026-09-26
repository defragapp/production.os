import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a timestamp stored by D1. `datetime('now')` yields
 * "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker, which Safari refuses to
 * parse — anchor it as UTC before handing it to Date. ISO strings with their
 * own zone marker pass through untouched.
 */
export function parseD1Date(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = /Z|[+-]\d{2}:\d{2}$/.test(value)
    ? value
    : value.includes(" ")
      ? `${value.replace(" ", "T")}Z`
      : value;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Formats a D1 timestamp as a local calendar date, or an em dash when absent/unparseable. */
export function formatD1Date(
  value: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
  locale: string | undefined = "en-US"
): string {
  const d = parseD1Date(value);
  return d ? d.toLocaleDateString(locale, opts) : "—";
}

/**
 * Renders an ISO birth date (`YYYY-MM-DD`, as stored on a Baseline) as
 * long-form text ("June 15, 1990") to match every other date in the UI.
 * Anchored to UTC so a browser's local offset can never shift the day. A
 * malformed value falls through unchanged; empty renders as an em dash.
 */
export function formatDateOfBirth(
  iso: string | null | undefined,
  locale: string | undefined = "en-US"
): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
