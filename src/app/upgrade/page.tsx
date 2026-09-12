"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { Stepper } from "@/components/stepper";
import { PageHeader } from "@/components/page-header";

const STEPS = ["Account", "Baseline", "Plan"];

function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBaseline = searchParams.get("from") === "baseline";

  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json() as { user?: unknown };
        if (!data.user) { router.push("/onboard?mode=login"); return; }
      } catch { router.push("/onboard?mode=login"); }
      finally { setAuthChecked(true); }
    })();
  }, [router]);

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
    return (<><Nav /><main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center"><p className="text-muted-foreground">Loading...</p></main></>);
  }

  return (
    <>
      <Nav />
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-3xl">
          <Stepper steps={STEPS} current={2} />
          {fromBaseline && (
            <p className="mb-4 text-center text-sm font-medium text-emerald-400">
              ✓ Your baseline is ready. Choose how you&apos;d like to continue.
            </p>
          )}
          <PageHeader
            title="Choose Your Plan"
            description="Start free, then unlock unlimited AI conversations, full chat history, and advanced pattern analysis with Sovereign+."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader><CardTitle className="text-base">Free</CardTitle><CardDescription>For trying out Sovereign OS</CardDescription></CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="mb-4 text-3xl font-bold">$0</p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <li>5 AI messages per day</li><li>Baseline computation</li><li>Basic chat history</li>
                </ul>
                <Button variant="outline" className="mt-6 w-full" onClick={() => router.push("/chat")}>
                  Continue with Free
                </Button>
              </CardContent>
            </Card>
            <Card className="border border-primary/60">
              <CardHeader><CardTitle className="text-base">Sovereign+</CardTitle><CardDescription>For deep pattern work</CardDescription></CardHeader>
              <CardContent className="flex flex-col">
                <div className="mb-4 flex items-baseline gap-2"><span className="text-3xl font-bold">$79</span><span className="text-sm text-muted-foreground">/year</span></div>
                <p className="mb-4 inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Save 27% — best value</p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <li>Unlimited AI messages</li><li>Full chat history &amp; threads</li><li>Advanced pattern analysis</li><li>Priority AI inference</li>
                </ul>
                <div className="mt-6 space-y-2">
                  <Button className="w-full" onClick={() => handleUpgrade("annual")} disabled={loading !== null}>
                    {loading === "annual" ? "Redirecting..." : "Annual — $79/yr (Save 27%)"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => handleUpgrade("monthly")} disabled={loading !== null}>
                    {loading === "monthly" ? "Redirecting..." : "Monthly — $9/mo"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <UpgradeContent />
    </Suspense>
  );
}