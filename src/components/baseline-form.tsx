"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TOB_BUCKETS = [
  { key: "morning", label: "Morning" },
  { key: "noon", label: "Noon" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "night", label: "Night" },
];

const BUCKET_TIMES: Record<string, string> = {
  morning: "around 9am",
  noon: "around midday",
  afternoon: "around 3pm",
  evening: "around 7pm",
  night: "around 10pm",
};

/**
 * The Baseline entry form shared by onboarding and the /baseline page. Each
 * field explains why it is asked, and a time you don't know exactly can be
 * approximated with a window — the derivation is built on tendencies and the
 * site stays honest about the reduced precision. When `defaults` is provided
 * (editing an existing Baseline) the fields start prefilled.
 */
export function BaselineForm({
  submitLabel = "Build My Baseline",
  onSaved,
  onDone,
  defaults,
}: {
  submitLabel?: string;
  onSaved: () => void;
  /** Optional terminal action after a successful save (e.g. "Done" on edit). */
  onDone?: () => void;
  defaults?: { dob?: string | null; pob?: string | null; tob?: string | null };
}) {
  const [dob, setDob] = useState(defaults?.dob ?? "");
  const [pob, setPob] = useState(defaults?.pob ?? "");
  const [tob, setTob] = useState(defaults?.tob ?? "");
  const [unknownTime, setUnknownTime] = useState(false);
  const [bucket, setBucket] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (unknownTime && !bucket) {
      setError("Choose the closest time window, or you can go back and enter your exact time.");
      return;
    }

    if (!unknownTime && !tob) {
      setError("Enter your exact time of birth, or approximate it with a time window.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unknownTime
          ? { dob, pob, tob: bucket, tobAccuracy: bucket }
          : { dob, pob, tob, tobAccuracy: "exact" }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || "Failed to compute baseline");
      }

      onSaved();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="bf-dob">Date of birth</Label>
        <Input
          id="bf-dob"
          type="date"
          required
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          The anchor. It fixes where the Sun and Moon stood when you arrived — the qualities
          your Baseline starts from.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bf-tob">Time of birth</Label>
        {!unknownTime ? (
          <>
            <Input
              id="bf-tob"
              type="time"
              value={tob}
              onChange={(e) => setTob(e.target.value)}
              aria-describedby="bf-tob-hint"
            />
            <p id="bf-tob-hint" className="text-[13px] leading-relaxed text-muted-foreground">
              Tunes the finer layers — your Human Design type and hour-level placements.
              Don&apos;t know it exactly?{" "}
              <button
                type="button"
                onClick={() => setUnknownTime(true)}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Approximate it instead
              </button>
              .
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 pt-1">
              {TOB_BUCKETS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBucket(b.key)}
                  className={`rounded-md border px-3.5 py-2 text-sm transition-colors ${
                    bucket === b.key
                      ? "border-foreground/60 bg-foreground/[0.08] text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {bucket ? (
                <>
                  We&apos;ll compute with{" "}
                  <span className="text-foreground">{BUCKET_TIMES[bucket]}</span> on your birth
                  day, and mark your baseline as approximate so it stays honest. You can set your
                  exact time later from your baseline.
                </>
              ) : (
                <>
                  Pick the closest window. Your Baseline works on tendencies, not precision —
                  and you can make it exact later.
                </>
              )}{" "}
              <button
                type="button"
                onClick={() => { setUnknownTime(false); setBucket(null); }}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Enter exact time
              </button>
            </p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bf-pob">Place of birth</Label>
        <Input
          id="bf-pob"
          type="text"
          required
          value={pob}
          onChange={(e) => setPob(e.target.value)}
          placeholder="City, Country"
        />
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Pins your location on Earth, which the calculation needs alongside the date. City and
          country is enough.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Computing baseline..." : submitLabel}
      </Button>
    </form>
  );
}