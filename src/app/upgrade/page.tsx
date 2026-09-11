"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";

export default function UpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json() as { user?: unknown };
        if (!data.user) { router.push("/onboard"); return; }
      } catch { router.push("/onboard"); }
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
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center">
            <p className="mb-1 text-sm font-medium uppercase tracking-widest text-muted-foreground">Sovereign OS</p>
            <h1 className="text-3xl font-bold">Upgrade to Sovereign+</h1>
            <p className="mt-2 text-muted-foreground">Unlock unlimited AI conversations, full chat history, and advanced pattern analysis.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Free</CardTitle><CardDescription>For trying out Sovereign OS</CardDescription></CardHeader>
              <CardContent>
                <p className="mb-4 text-3xl font-bold">$0</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>5 AI messages per day</li><li>Baseline computation</li><li>Basic chat history</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-primary">
              <CardHeader><CardTitle className="text-base">Sovereign+</CardTitle><CardDescription>For deep pattern work</CardDescription></CardHeader>
              <CardContent>
                <div className="mb-4 flex items-baseline gap-2"><span className="text-3xl font-bold">$9</span><span className="text-sm text-muted-foreground">/month</span></div>
                <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                  <li>Unlimited AI messages</li><li>Full chat history & threads</li><li>Advanced pattern analysis</li><li>Priority AI inference</li>
                </ul>
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => handleUpgrade("monthly")} disabled={loading !== null}>
                    {loading === "monthly" ? "Redirecting..." : "Monthly — $9/mo"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => handleUpgrade("annual")} disabled={loading !== null}>
                    {loading === "annual" ? "Redirecting..." : "Annual — $79/yr (Save 27%)"}
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
