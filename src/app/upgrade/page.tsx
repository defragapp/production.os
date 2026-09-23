"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { Stepper } from "@/components/stepper";
import { PageHeader } from "@/components/page-header";
import { LoadingScreen } from "@/components/ui/loading";

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
      if (!res.ok || !data.url) throw new Error(data.error || "Failed to open billing");
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Something went wrong");
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
      if (!res.ok || !data.url) throw new Error(data.error || "Failed to create checkout session");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(null); }
  };

  if (!authChecked) {
    return (<><Nav /><LoadingScreen className="min-h-[calc(100vh-3.5rem)]" label="Checking your plan" /></>);
  }

  return (
    <>
      <Nav />
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-3xl">
          <Stepper steps={STEPS} current={2} />
          {fromBaseline && (
            <p className="mb-4 text-center text-sm font-medium text-foreground">
              ✓ Your baseline is ready. Choose how you&apos;d like to continue.
            </p>
          )}
          <PageHeader
            title={isPlus ? "You're on Sovereign+" : "Choose Your Plan"}
            description={
              isPlus
                ? "Manage your subscription, update your payment method, or cancel anytime."
                : "Start free, then unlock unlimited AI conversations, full chat history, and advanced pattern analysis with Sovereign+."
            }
          />
          {isPlus ? (
            <Card className="border border-foreground/25">
              <CardHeader>
                <CardTitle className="text-base">Sovereign+ subscription</CardTitle>
                <CardDescription>Manage billing in the Stripe portal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>✓ Unlimited AI messages</li>
                  <li>✓ Full chat history &amp; threads</li>
                  <li>✓ Advanced pattern analysis</li>
                  <li>✓ Priority AI inference</li>
                </ul>
                <Button className="w-full" onClick={handleManageBilling} disabled={portalLoading}>
                  {portalLoading ? "Opening billing..." : "Manage subscription (cancel in two clicks)"}
                </Button>
                {portalError && <p className="text-xs text-destructive">{portalError}</p>}
              </CardContent>
            </Card>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader><CardTitle className="text-base">Free</CardTitle><CardDescription>For trying out Sovereign OS</CardDescription></CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="mb-4 font-display text-3xl font-normal">$0</p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <li>5 AI messages per day</li><li>Baseline computation</li><li>Basic chat history</li>
                </ul>
                <Button variant="outline" className="mt-6 w-full" onClick={() => router.push("/chat")}>
                  Continue with Free
                </Button>
              </CardContent>
            </Card>
            <Card className="border border-foreground/25">
              <CardHeader><CardTitle className="text-base">Sovereign+</CardTitle><CardDescription>For deep pattern work</CardDescription></CardHeader>
              <CardContent className="flex flex-col">
                <div className="mb-4 flex items-baseline gap-2"><span className="font-display text-3xl font-normal">$99</span><span className="text-sm text-muted-foreground">/year</span></div>
                <p className="mb-4 inline-flex w-fit items-center rounded-md border border-foreground/20 bg-foreground/[0.06] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground">Save 59% · Best value</p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <li>Unlimited AI messages</li><li>Full chat history &amp; threads</li><li>Advanced pattern analysis</li><li>Priority AI inference</li>
                </ul>
                <div className="mt-6 space-y-2">
                  <Button className="w-full" onClick={() => handleUpgrade("annual")} disabled={loading !== null}>
                    {loading === "annual" ? "Redirecting..." : "Annual — $99/yr (Save 59%)"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => handleUpgrade("monthly")} disabled={loading !== null}>
                    {loading === "monthly" ? "Redirecting..." : "Monthly — $20/mo"}
                  </Button>
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