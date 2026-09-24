"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { Stepper } from "@/components/stepper";
import { PageHeader } from "@/components/page-header";
import { PageTexture } from "@/components/page-texture";
import { LoadingScreen } from "@/components/ui/loading";

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg viewBox="0 0 16 16" className="mt-[3px] h-3.5 w-3.5 shrink-0 text-foreground/60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 8.5l4 4 7-9" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

const STEPS = ["Account", "Baseline", "Plan"];

function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBaseline = searchParams.get("from") === "baseline";

  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isPlus, setIsPlus] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json() as { user?: { subscription_tier?: string } | null };
        if (!data.user) { router.push("/onboard?mode=login"); return; }
        setIsPlus(data.user.subscription_tier === "sovereign+");
      } catch { router.push("/onboard?mode=login"); }
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
      setPortalError(err instanceof Error ? err.message : "Something went wrong — please try again.");
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
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally { setLoading(null); }
  };

  if (!authChecked) {
    return (<><Nav /><LoadingScreen className="min-h-[calc(100vh-3.5rem)]" label="Checking your plan" /></>);
  }

  return (
    <>
      <PageTexture />
      <Nav />
      <main className="relative z-10 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-3xl">
          <Stepper steps={STEPS} current={2} />
          {fromBaseline && (
            <p className="mb-4 text-center text-sm font-medium text-foreground">
              Your Baseline is ready. Last step — choose how you&apos;d like to continue.
            </p>
          )}
          <PageHeader
            title={isPlus ? "You're on Sovereign+" : "Pick your plan"}
            description={
              isPlus
                ? "Update your payment method, download receipts, or cancel — all in one place."
                : "Free includes your full Baseline and five AI answers a day. Sovereign+ lifts the daily cap entirely."
            }
          />
          {isPlus ? (
            <Card className="border border-foreground/25">
              <CardHeader>
                <CardTitle className="text-base">Sovereign+ subscription</CardTitle>
                <CardDescription>Active on your account — billing runs through Stripe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <PlanFeature>Unlimited AI messages — no daily cap</PlanFeature>
                  <PlanFeature>Invite people into your relationships</PlanFeature>
                  <PlanFeature>Your full Baseline, same private engine</PlanFeature>
                </ul>
                <Button className="w-full" onClick={handleManageBilling} disabled={portalLoading}>
                  {portalLoading ? "Opening billing..." : "Manage subscription"}
                </Button>
                <p className="text-center text-xs text-muted-foreground/70">Cancel anytime — two clicks, no emails.</p>
                {portalError && <p className="text-xs text-destructive">{portalError}</p>}
              </CardContent>
            </Card>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader><CardTitle className="text-base">Free</CardTitle><CardDescription>Five good answers a day</CardDescription></CardHeader>
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
            <Card className="border border-foreground/25">
              <CardHeader><CardTitle className="text-base">Sovereign+</CardTitle><CardDescription>No daily cap — go as deep as you want</CardDescription></CardHeader>
              <CardContent className="flex flex-col">
                <div className="mb-4 flex items-baseline gap-2"><span className="font-display text-3xl font-normal">$99</span><span className="text-sm text-muted-foreground">/year</span></div>
                <p className="mb-4 inline-flex w-fit items-center rounded-md border border-foreground/20 bg-foreground/[0.06] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground">Save 59% · Best value</p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <PlanFeature>Unlimited AI messages — no daily cap</PlanFeature>
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
                  <p className="text-center text-xs text-muted-foreground/70">Secure checkout by Stripe. Cancel anytime.</p>
                </div>
              </CardContent>
            </Card>
          </div>
          )}
          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="ghost" onClick={() => router.push("/chat")}>Back to chat</Button>
            <Button variant="ghost" onClick={() => router.push("/account")}>Account</Button>
          </div>
        </div>
      </main>
    </>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<LoadingScreen label="Checking your plan" />}>
      <UpgradeContent />
    </Suspense>
  );
}