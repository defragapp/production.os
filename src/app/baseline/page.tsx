"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
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
import { LoadingScreen } from "@/components/ui/loading";
import { BaselineForm } from "@/components/baseline-form";

const STEPS = ["Account", "Baseline", "Plan"];

function BaselineContent() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = new URLSearchParams(window.location.search).get("invite");
      setInvite(token && token.trim() ? token : null);
    }
  }, []);

  const nextHref = (token: string | null) => (token ? `/invite?token=${encodeURIComponent(token)}` : "/chat");

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
            const token = new URLSearchParams(window.location.search).get("invite");
            router.push(nextHref(token));
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

  if (!authChecked) {
    return (
      <>
        <Nav />
        <LoadingScreen className="min-h-[calc(100vh-3.5rem)]" label="Checking your account" />
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
              <BaselineForm
                submitLabel="Compute My Baseline"
                onSaved={() => router.push(nextHref(invite))}
              />
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Your birth time and location compute planetary positions via NASA data — a precise time is
            ideal, and an approximation works too. This data is stored securely and never shared.
          </p>
        </div>
      </main>
    </>
  );
}

export default function BaselinePage() {
  return (
    <Suspense fallback={<LoadingScreen label="Checking your account" />}>
      <BaselineContent />
    </Suspense>
  );
}
