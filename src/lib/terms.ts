/**
 * Clickwrap versioning — the shared constant behind provable consent.
 *
 * Every signup writes the terms version the person affirmed, so D1 holds a
 * receipt (version + timestamp) rather than a bare boolean. Bump this string
 * (YYYY-MM-DD of the /terms rewrite it names) whenever the Terms or Privacy
 * pages change materially; the old value stays in each user's row forever.
 */
export const CURRENT_TERMS_VERSION = "2026-09-29";

/** The affirmative signup copy, in one place so the checkbox and the API
 *  error can never drift apart. */
export const TERMS_AFFIRMATION =
  "I am at least 18 years old and agree to the Terms of Service and Privacy Policy.";

/**
 * Whether the stored `terms_version` on a user row is out of date relative to
 * `CURRENT_TERMS_VERSION` and needs a fresh in-app re-affirmation.
 *
 * Semantics:
 *  - null / undefined → false. Legacy accounts that predate the clickwrap
 *    column are backfilled on the next successful login (see
 *    src/app/api/auth/route.ts), and we do not want the re-acceptance modal
 *    to fire before that has had a chance to run — the login backfill stamps
 *    them at the current version without bothering the user.
 *  - any non-null value !== CURRENT → true. This is the material-change
 *    case: the operator bumped the version after rewriting Terms or Privacy,
 *    and existing users must be prompted before continuing.
 *  - equal → false.
 */
export function termsNeedReaccept(stored: string | null | undefined): boolean {
  if (stored == null) return false;
  return stored !== CURRENT_TERMS_VERSION;
}
