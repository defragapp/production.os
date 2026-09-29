"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/nav";
import { PageShell } from "@/components/page-shell";
import { Stepper } from "@/components/stepper";
import { PageHeader } from "@/components/page-header";
import { Eyebrow } from "@/components/ui/eyebrow";
import { LoadingScreen } from "@/components/ui/loading";
import { BaselineForm } from "@/components/baseline-form";
import { BaselineDrawer } from "@/components/baseline-drawer";
import type { Baseline, BaselineData } from "@/lib/types";
import { formatD1Date, formatDateOfBirth } from "@/lib/utils";

const STEPS = ["Account", "Baseline"];

function BaselineContent() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const [fromChat, setFromChat] = useState(false);
  const [row, setRow] = useState<Baseline | null>(null);
  const [parsed, setParsed] = useState<BaselineData | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("invite");
      setInvite(token && token.trim() ? token : null);
      setFromChat(params.get("from") === "chat");
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
      <PageShell className="max-w-md">
        <Stepper steps={STEPS} current={1} />
        <PageHeader
          title="Build your Baseline"
          description="Enter your birth information to generate a personal starting point, computed from NASA planetary data. It is used for one purpose only: computing your Baseline."
        />

        <Section
          title="Birth information"
          description="Set it once, then review or update it here any time."
          rule={false}
        >
          {/* The point of friction deserves the reason. Someone sent here from
              /chat has just been stopped, so this answers the three questions
              that actually stop people typing: why am I here, what does this
              unlock, what happens to my birth data. One box, directly above the
              form — not a page they have to scroll past — and only when they came
              from a conversation, because nobody else needs the explanation. */}
          {fromChat && (
            <div className="mb-6 rounded-panel border border-border/60 bg-white/[0.03] px-4 py-4">
              <Eyebrow as="p" scale="sm">Why we ask first</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Chat opens the moment your Baseline exists. It is the plain-language picture your
                conversations are read against — where you tend to start, what keeps coming back,
                which threads are yours to carry. Without it, every answer starts from nothing and
                has to guess.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your birth time and place are used for one thing only: computing that starting point from
                NASA/JPL planetary positions. Nothing is shared without a yes, and you can update these
                details here any time. It takes about a minute.
              </p>
            </div>
          )}
          <BaselineForm
            submitLabel="Build my Baseline"
            onSaved={() => {
              void loadBaseline();
            }}
            onDone={() => router.push(nextHref(invite))}
          />
        </Section>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Your birth time and location compute planetary positions via NASA data — a precise time is
          ideal, and an approximation works too. This data is used only to compute your Baseline.
        </p>
      </PageShell>
    );
  }

  // ── Existing Baseline: review it, or edit the birth data ───────
  const meta = parsed?.meta as
    | { dob?: string; pob?: string; tob?: string; effectiveTob?: string; timePrecision?: string }
    | undefined;

  return (
    <PageShell center={false} wide="prose">
      <PageHeader
        title="Your Baseline"
        description="The picture computed from NASA/JPL planetary data, and the birth information it came from."
      />

          {editing ? (
            <Section
              title="Update birth information"
              description="Saving recomputes your whole Baseline from the new details."
              rule={false}
            >
              <BaselineForm
                key={`${row?.dob}-${row?.tob}-${row?.pob}`}
                submitLabel="Recompute My Baseline"
                defaults={{ dob: row?.dob, pob: row?.pob, tob: row?.tob, timePrecision: meta?.timePrecision }}
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
            </Section>
          ) : (
            <>
              <Section
                title="Birth information"
                description="Only ever used to compute your Baseline — never shared."
                actions={
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                }
                rule={false}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-panel border border-white/[0.07] bg-surface-2/50 px-4 py-3.5 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.06)]">
                    <div className="mb-1 flex items-center gap-1.5 text-muted-foreground/80">
                      <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                      <Eyebrow as="span" scale="sm">Date of birth</Eyebrow>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{formatDateOfBirth(row?.dob)}</p>
                  </div>
                  <div className="rounded-panel border border-white/[0.07] bg-surface-2/50 px-4 py-3.5 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.06)]">
                    <div className="mb-1 flex items-center gap-1.5 text-muted-foreground/80">
                      <Clock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                      <Eyebrow as="span" scale="sm">Time of birth</Eyebrow>
                    </div>
                    <p className="mt-1 text-sm text-foreground">
                      {row?.tob || "—"}
                      {meta?.timePrecision === "approximate" && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(approximate)</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-panel border border-white/[0.07] bg-surface-2/50 px-4 py-3.5 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.06)]">
                    <div className="mb-1 flex items-center gap-1.5 text-muted-foreground/80">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                      <Eyebrow as="span" scale="sm">Place of birth</Eyebrow>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{row?.pob || "—"}</p>
                  </div>
                </div>
              </Section>

              {parsed && (
                <div className="mt-4">
                  <BaselineDrawer data={parsed} />
                </div>
              )}

              <p className="mt-4 text-center text-xs text-muted-foreground/70">
                Computed {formatD1Date(row?.updated_at)} from NASA/JPL planetary data.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="ghost" onClick={() => router.push("/chat")}>Back to chat</Button>
                <Button variant="ghost" onClick={() => router.push("/account")}>Account</Button>
              </div>
            </>
          )}
    </PageShell>
  );
}

export default function BaselinePage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading your Baseline" />}>
      <BaselineContent />
    </Suspense>
  );
}
