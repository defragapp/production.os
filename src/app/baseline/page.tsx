"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/nav";
import { Stepper } from "@/components/stepper";
import { PageHeader } from "@/components/page-header";
import { LoadingScreen } from "@/components/ui/loading";
import { BaselineForm } from "@/components/baseline-form";
import { BaselineDrawer } from "@/components/baseline-drawer";
import type { Baseline, BaselineData } from "@/lib/types";
import { formatD1Date } from "@/lib/utils";

const STEPS = ["Account", "Baseline", "Plan"];

function BaselineContent() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const [row, setRow] = useState<Baseline | null>(null);
  const [parsed, setParsed] = useState<BaselineData | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = new URLSearchParams(window.location.search).get("invite");
      setInvite(token && token.trim() ? token : null);
    }
  }, []);

  const nextHref = (token: string | null) => (token ? `/invite?token=${encodeURIComponent(token)}` : "/chat");

  const loadBaseline = useCallback(async () => {
    const baselineRes = await fetch("/api/baseline");
    if (!baselineRes.ok) return null;
    const bd = await baselineRes.json() as { baseline?: Baseline | null };
    const baseline = bd.baseline ?? null;
    if (baseline?.nasa_jpl_json_data) {
      try {
        setParsed(JSON.parse(baseline.nasa_jpl_json_data) as BaselineData);
      } catch {
        setParsed(null);
      }
    } else {
      setParsed(null);
    }
    setRow(baseline);
    return baseline;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch("/api/auth");
        const authData = await authRes.json() as { user?: unknown };
        if (!authData.user) {
          router.push("/onboard?mode=login");
          return;
        }

        const baseline = await loadBaseline();
        // First-timers land on the setup form. People arriving from an invite
        // who already have a Baseline skip straight back to the accept flow.
        if (baseline?.nasa_jpl_json_data && invite) {
          router.replace(nextHref(invite));
          return;
        }
      } catch {
        router.push("/onboard?mode=login");
      } finally {
        setAuthChecked(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadBaseline]);

  if (!authChecked) {
    return (
      <>
        <Nav />
        <LoadingScreen className="min-h-[calc(100vh-3.5rem)]" label="Checking your account" />
      </>
    );
  }

  // ── First-time setup: no Baseline yet ──────────────────────────
  if (!row?.nasa_jpl_json_data && !editing) {
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
                  This is a one-time setup. You can review and update it here any time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BaselineForm
                  submitLabel="Compute My Baseline"
                  onSaved={() => {
                    void loadBaseline();
                  }}
                  onDone={() => router.push(nextHref(invite))}
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

  // ── Existing Baseline: review it, or edit the birth data ───────
  const meta = parsed?.meta as
    | { dob?: string; pob?: string; tob?: string; effectiveTob?: string; timePrecision?: string }
    | undefined;

  return (
    <>
      <Nav />
      <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden px-6 py-10">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto w-full max-w-2xl">
          <PageHeader
            title="Your Baseline"
            description="The picture computed from NASA/JPL planetary data, and the birth information it came from."
          />

          {editing ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Update Birth Information</CardTitle>
                <CardDescription>
                  Saving recomputes your whole Baseline from the new details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BaselineForm
                  key={`${row?.dob}-${row?.tob}-${row?.pob}`}
                  submitLabel="Recompute My Baseline"
                  defaults={{ dob: row?.dob, pob: row?.pob, tob: row?.tob }}
                  onSaved={() => {
                    void loadBaseline();
                    setEditing(false);
                  }}
                />
                <Button
                  variant="ghost"
                  className="mt-3 w-full"
                  onClick={() => setEditing(false)}
                  disabled={false}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-base">Birth Information</CardTitle>
                    <CardDescription>Only ever used to compute your Baseline — never shared.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Date of birth</p>
                    <p className="mt-1 text-sm text-foreground">{row?.dob || "—"}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Time of birth</p>
                    <p className="mt-1 text-sm text-foreground">
                      {row?.tob || "—"}
                      {meta?.timePrecision === "approximate" && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(approximate)</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Place of birth</p>
                    <p className="mt-1 text-sm text-foreground">{row?.pob || "—"}</p>
                  </div>
                </CardContent>
              </Card>

              {parsed && (
                <div className="mt-4">
                  <BaselineDrawer data={parsed} />
                </div>
              )}

              <p className="mt-4 text-center text-xs text-muted-foreground/70">
                Computed {formatD1Date(row?.updated_at)} from NASA/JPL Horizons ephemeris.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="ghost" onClick={() => router.push("/chat")}>Back to chat</Button>
                <Button variant="ghost" onClick={() => router.push("/account")}>Account</Button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default function BaselinePage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading your baseline" />}>
      <BaselineContent />
    </Suspense>
  );
}
