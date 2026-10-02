"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PageShell } from "@/components/page-shell";
import { LoadingScreen } from "@/components/ui/loading";
import { formatD1Date } from "@/lib/utils";

/**
 * A gifted 30-day Sovereign+ pass, redeemed from an iMessage or email link.
 * The link carries only the code; identity is whoever opens it while signed
 * in, so the page's whole job is: read the code, know the session, and either
 * invite them in or hand them the pass.
 */
export function RedeemCard() {
  const router = useRouter();
  // SSR can't see the query string, so the first paint must be neutral —
  // rendering a "no link" error during SSR then swapping on the client is the
  // hydration mismatch this repo already guards against on /invite.
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [redeemedAt, setRedeemedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnHref = code
    ? `/onboard?mode=signup&next=${encodeURIComponent(`/redeem?code=${code}`)}`
    : "/onboard?mode=signup";
  const loginHref = code
    ? `/onboard?mode=login&next=${encodeURIComponent(`/redeem?code=${code}`)}`
    : "/onboard?mode=login";

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code")?.trim() || "";
    setCode(c || null);
    let cancelled = false;
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setAuthed(Boolean((d as { user?: unknown }).user));
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRedeem = async () => {
    if (!code) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as { giftExpiresAt?: string; error?: string };
      if (res.ok) {
        setRedeemedAt(data.giftExpiresAt ?? new Date().toISOString());
        return;
      }
      setError(data.error || "We couldn't apply that pass. Please check the link and try again.");
    } catch {
      setError("We couldn't reach Sovereign just now — please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Still resolving the link + session ──────────────────────────────
  // The Card shell is rendered here for the SAME reason /invite keeps its card
  // while it resolves: the loading state used to return a bare LoadingScreen
  // (min-h of the whole viewport) and was then swapped for a short card, so
  // every resolved branch moved the layout by ~0.21 CLS the moment the session
  // check answered. Holding the shell and reserving the content box means the
  // arrival is a fade, not a jump. The PageHeader wording still changes, but
  // both are a single-line title over a one-line description, so its own box
  // height does not move.
  if (code === undefined || authed === null) {
    return (
      <PageShell className="max-w-md">
        <PageHeader title="Your invitation" description="Checking your pass…" />
        <Card>
          <CardContent className="pt-6">
            {/* LoadingScreen defaults to a full-viewport min-height; inside the
                reserved card that would defeat the point, so the override
                pins it to the content box the resolved card will occupy. */}
            <LoadingScreen className="min-h-[9rem] py-8" label="Checking your account" />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Link missing its code ───────────────────────────────────────────
  if (code === null) {
    return (
      <PageShell className="max-w-md">
        <PageHeader title="Your invitation" description="This pass link doesn't look right." />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The part of the link that identifies your pass is missing — it may have been
              cut off when it was shared. Ask the sender to forward the whole link again.
            </p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => router.push("/")}>
              Back to Sovereign
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Pass applied ────────────────────────────────────────────────────
  if (redeemedAt) {
    return (
      <PageShell className="max-w-md">
        <PageHeader title="Welcome to Sovereign+" description="Your 30-day pass is active." />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Check className="h-4 w-4" />
              Your pass runs through {formatD1Date(redeemedAt)}.
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Unlimited reflections, your relationships, and the full journey canvas are open
              to you. When the pass ends you drop back to the free tier — nothing is charged.
            </p>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => router.push("/chat")}>Open chat</Button>
              <Button variant="outline" className="w-full" onClick={() => router.push("/baseline")}>
                Set up my Baseline
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Signed in: hand them the pass ───────────────────────────────────
  if (authed) {
    return (
      <PageShell className="max-w-md">
        <PageHeader title="You've been invited" description="A private 30-day Sovereign+ pass is ready for you." />
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Claim your pass</CardTitle>
            <CardDescription>
              Thirty days of Sovereign+ — unlimited reflections and connections. No card needed,
              and it ends on its own.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleRedeem} disabled={submitting}>
              {submitting ? "Applying…" : "Redeem 30 days of Sovereign+"}
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Not signed in: invite them in, then the pass lands ──────────────
  return (
    <PageShell className="max-w-md">
      <PageHeader title="You've been invited" description="Someone sent you 30 days of Sovereign+." />
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg">A private pass is waiting</CardTitle>
          <CardDescription>
            Sign in or create a free account to claim your 30 days of Sovereign+ — no card
            required, and the pass ends on its own.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
          <div className="flex flex-col gap-2">
            <Link href={returnHref} className="btn-aurora w-full px-4 py-2.5 text-center text-sm font-medium">
              Create a free account
            </Link>
            <Link href={loginHref} className="btn-glass w-full px-4 py-2.5 text-center text-sm font-medium text-foreground">
              Sign in
            </Link>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Your pass stays reserved on this link — come back and finish whenever you&apos;re ready.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
