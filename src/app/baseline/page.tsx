"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { Stepper } from "@/components/stepper";
import { PageHeader } from "@/components/page-header";

const STEPS = ["Account", "Baseline", "Plan"];

function BaselineContent() {
  const router = useRouter();
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [pob, setPob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch("/api/auth");
        const authData = await authRes.json() as { user?: unknown };
        if (!authData.user) {
          router.push("/onboard?mode=login");
          return;
        }

        // If baseline already exists, skip to chat (persists across logins)
        const baselineRes = await fetch("/api/baseline");
        if (baselineRes.ok) {
          const bd = await baselineRes.json() as { baseline?: { nasa_jpl_json_data?: string } };
          if (bd.baseline?.nasa_jpl_json_data) {
            router.push("/chat");
            return;
          }
        }
      } catch {
        router.push("/onboard?mode=login");
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, tob, pob }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || "Failed to compute baseline");
      }

      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <>
        <Nav />
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-md">
          <Stepper steps={STEPS} current={1} />
          <PageHeader
            title="Set Your Baseline"
            description="Enter your birth information to generate a personal starting point, computed from NASA planetary data. Your data is never shared with third parties."
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Birth Information</CardTitle>
              <CardDescription>
                This is a one-time setup. You can update it later from your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tob">Time of Birth (24h)</Label>
                  <Input
                    id="tob"
                    type="time"
                    required
                    value={tob}
                    onChange={(e) => setTob(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pob">Place of Birth</Label>
                  <Input
                    id="pob"
                    type="text"
                    required
                    value={pob}
                    onChange={(e) => setPob(e.target.value)}
                    placeholder="City, Country"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Computing baseline..." : "Compute My Baseline"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            We use your exact birth time and location to compute planetary positions via NASA data.
            This data is stored securely and never shared.
          </p>
        </div>
      </main>
    </>
  );
}

export default function BaselinePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <BaselineContent />
    </Suspense>
  );
}
