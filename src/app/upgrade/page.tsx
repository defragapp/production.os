"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";
import { PageShell } from "@/components/page-shell";
import { LoadingScreen } from "@/components/ui/loading";
import { PricingTable } from "@/components/pricing-table";

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-foreground/60" strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function UpgradeContent() {
  const router = useRouter();

  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isPlus, setIsPlus] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  // Free-tier daily counter, mirrored from /api/auth → `usage` (see
  // src/app/api/auth/route.ts). null while loading; {used:0,limit:5} for
  // brand-new free accounts; null for sovereign+ accounts (no cap to show).
  const [usage, setUsage] = useState<{ used: number; limit: number | null } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json() as {
          user?: { subscription_tier?: string } | null;
          usage?: { used: number; limit: number | null };
        };
        if (!data.user) { router.push("/onboard?mode=signup&next=%2Fupgrade"); return; }
        setIsPlus(data.user.subscription_tier === "sovereign+");
        if (data.usage) setUsage(data.usage);
      } catch { router.push("/onboard?mode=signup&next=%2Fupgrade"); }
      finally { setAuthChecked(true); }
    })();
  }, [router]);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/billing-portal");
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't open billing — try again in a moment.");
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Couldn't open billing — try again in a moment.");
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async (interval: "monthly" | "annual") => {
    setLoading(interval);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout — try again in a moment.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout — try again in a moment.");
    } finally { setLoading(null); }
  };

  if (!authChecked) {
    return (<><Nav /><LoadingScreen className="min-h-[calc(100dvh-3.5rem)]" label="Checking your plan" /></>);
  }

  return (
    <PageShell center={false} wide="prose">
          <PageHeader
            title={isPlus ? "You're on Sovereign+" : "Pick your plan"}
            description={
              isPlus
                ? "Update your payment method, download receipts, or cancel — all in one place."
                : "Free includes your full Baseline and five AI answers a day. Sovereign+ lifts that to 150 a day and opens invites."
            }
          />
          {isPlus ? (
            <Card className="card-backlight card-lift border border-foreground/25">
              <CardHeader>
                <CardTitle className="text-base">Sovereign+ subscription</CardTitle>
                <CardDescription>Active on your account — billing runs through Stripe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <PlanFeature>Up to 150 AI messages a day</PlanFeature>
                  <PlanFeature>Invite people into your relationships</PlanFeature>
                  <PlanFeature>Your full Baseline, same private engine</PlanFeature>
                </ul>
                <Button className="w-full" onClick={handleManageBilling} disabled={portalLoading}>
                  {portalLoading ? "Opening billing..." : "Manage subscription"}
                </Button>
                <p className="text-center text-xs text-muted-foreground/70">Cancel anytime — no emails needed.</p>
                {portalError && <Alert>{portalError}</Alert>}
              </CardContent>
            </Card>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="card-lift flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>Free</span>
                  {usage && usage.limit !== null && (
                    // Usage pill — a live “you’ve used X of 5 today”, so the
                    // cap is a fact the user can see rather than an abstract
                    // promise. Renders only once /api/auth has responded.
                    <span
                      className="rounded-full border border-foreground/20 bg-foreground/[0.04] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                      aria-label={`You have used ${usage.used} of ${usage.limit} AI messages today`}
                    >
                      {usage.used}/{usage.limit} today
                    </span>
                  )}
                </CardTitle>
                <CardDescription>Five good answers a day</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="mb-4 font-display text-3xl font-normal">$0</p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <PlanFeature>5 AI messages per day</PlanFeature>
                  <PlanFeature>Your full Baseline</PlanFeature>
                  <PlanFeature>Your conversations stay with you</PlanFeature>
                </ul>
                <Button variant="outline" className="mt-6 w-full" onClick={() => router.push("/chat")}>
                  Continue with Free
                </Button>
              </CardContent>
            </Card>
            <Card className="card-backlight card-lift relative border border-foreground/25">
              <CardHeader><CardTitle className="text-base">Sovereign+</CardTitle><CardDescription>150 messages a day — room to go as deep as you want</CardDescription></CardHeader>
              <CardContent className="flex flex-col">
                <div className="mb-4 flex items-baseline gap-2"><span className="font-display text-3xl font-normal">$99</span><span className="text-sm text-muted-foreground">/year</span></div>
                <p className="mb-4 text-sm text-muted-foreground">Best value when billed yearly</p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <PlanFeature>Up to 150 AI messages a day</PlanFeature>
                  <PlanFeature>Invite people into your relationships</PlanFeature>
                  <PlanFeature>Your full Baseline, same private engine</PlanFeature>
                </ul>
                <div className="mt-6 space-y-2">
                  <Button className="w-full" onClick={() => handleUpgrade("annual")} disabled={loading !== null}>
                    {loading === "annual" ? "Redirecting..." : "Get Sovereign+ — $99/year"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => handleUpgrade("monthly")} disabled={loading !== null}>
                    {loading === "monthly" ? "Redirecting..." : "Or pay monthly — $20/mo"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground/70">US dollars. Secure checkout by Stripe. Cancel anytime.</p>
                </div>
              </CardContent>
            </Card>
          </div>
          )}
          {/* Comparison table — same data the landing shows, but reached
              already-warm: the reader is on the account, deciding. */}
          <div className="mt-2">
            <PricingTable />
          </div>
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="ghost" onClick={() => router.push("/chat")}>Back to chat</Button>
            <Button variant="ghost" onClick={() => router.push("/account")}>Account</Button>
          </div>
    </PageShell>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<LoadingScreen label="Checking your plan" />}>
      <UpgradeContent />
    </Suspense>
  );
}