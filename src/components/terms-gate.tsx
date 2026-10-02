"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TERMS_AFFIRMATION } from "@/lib/terms";

/**
 * <TermsGate /> — the in-app re-affirmation modal that fires when a signed-in
 * user's stored `terms_version` differs from CURRENT_TERMS_VERSION (see
 * src/lib/terms.ts and the `terms` block returned by GET /api/auth).
 *
 * Behaviour notes:
 *  - Only mounted after auth resolves; a signed-out visitor sees nothing.
 *  - Renders only when `needsReaccept === true`. Legacy accounts with a
 *    null stored version are handled by the login backfill and never trigger
 *    this modal — the modal is specifically for *material* Terms changes that
 *    happened after someone was already an account holder.
 *  - The user can read /terms in a new tab without losing their place; the
 *    "I accept" button POSTs /api/auth/accept-terms with { accepted: true }
 *    and hides the modal on success.
 *  - There's no "Decline" affordance. Terms changes are material; if someone
 *    doesn't agree, the honest path is to delete their account. The modal
 *    copy names that path with a link to /account so the choice is real.
 *  - Focus trap and role="dialog" with aria-modal="true" for screen readers.
 *    Keyboard: Escape does NOT dismiss (there's no way to dismiss without
 *    either accepting or leaving — silently closing on Escape would defeat
 *    the whole purpose).
 */

type TermsState = {
  stored: string | null;
  current: string;
  needsReaccept: boolean;
};

type AuthResponse = {
  user?: { id?: string } | null;
  terms?: TermsState;
};

export function TermsGate() {
  const [terms, setTerms] = useState<TermsState | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as AuthResponse;
      if (data.user && data.terms) setTerms(data.terms);
      else setTerms(null);
    } catch {
      // Network hiccup: leave the modal state alone rather than flicker it.
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Re-check when the tab regains focus — a long-lived session that spans a
    // Terms deploy should surface the modal without a page reload.
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Hide while the user is on /terms or /privacy themselves — they're already
  // reading the thing the modal is asking them to acknowledge.
  const [onLegalPage, setOnLegalPage] = useState(false);
  useEffect(() => {
    const check = () => {
      const p = window.location.pathname;
      setOnLegalPage(p === "/terms" || p === "/privacy");
    };
    check();
    window.addEventListener("popstate", check);
    return () => window.removeEventListener("popstate", check);
  }, []);

  if (!terms || !terms.needsReaccept) return null;
  // If the user closed the modal once in this session (e.g. to read /terms
  // in another tab), keep it closed for that same version so it doesn't
  // reopen on every visibilitychange.
  if (dismissed === terms.current) return null;
  if (onLegalPage) return null;

  const accept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ accepted: true, previousVersion: terms.stored }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Something went wrong — please try again.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-title"
      aria-describedby="terms-gate-body"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div className="glass-panel card-lift w-full max-w-lg rounded-xl border border-foreground/25 p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] md:p-8">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
          We updated the Terms
        </p>
        <h2 id="terms-gate-title" className="mb-3 font-display text-2xl font-normal leading-tight tracking-tight text-foreground md:text-[1.75rem]">
          Please re-read and re-affirm.
        </h2>
        <p id="terms-gate-body" className="mb-4 text-sm leading-6 text-muted-foreground">
          Our Terms of Service and Privacy Policy changed since you last agreed — version{" "}
          <span className="font-mono text-foreground">{terms.stored ?? "pre-clickwrap"}</span> has been replaced by{" "}
          <span className="font-mono text-foreground">{terms.current}</span>. Read the update, then let us know you still agree to keep using Sovereign.
        </p>
        <div className="mb-5 flex flex-wrap gap-3">
          <Link
            href="/terms"
            className="tap-line inline-flex min-h-[44px] items-center rounded-md border border-foreground/25 px-4 py-2 text-sm text-foreground hover:border-foreground/60"
          >
            Read the Terms
          </Link>
          <Link
            href="/privacy"
            className="tap-line inline-flex min-h-[44px] items-center rounded-md border border-foreground/25 px-4 py-2 text-sm text-foreground hover:border-foreground/60"
          >
            Read the Privacy Policy
          </Link>
        </div>
        <p className="mb-4 text-xs leading-5 text-muted-foreground">
          {TERMS_AFFIRMATION}
        </p>
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={accept}
            disabled={submitting}
            className="btn-focal inline-flex min-h-[44px] items-center justify-center px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Saving…" : "I agree — continue"}
          </button>
          <Link
            href="/account"
            onClick={() => setDismissed(terms.current)}
            className="tap-line inline-flex min-h-[44px] items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Review my account instead
          </Link>
        </div>
        <p className="mt-4 text-[11px] leading-4 text-muted-foreground/70">
          If you don&rsquo;t agree, you can export your data and delete your account from the Account page — nothing you&rsquo;ve written is kept after that.
        </p>
      </div>
    </div>
  );
}
