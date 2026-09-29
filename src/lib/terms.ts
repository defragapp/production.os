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
