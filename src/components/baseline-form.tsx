"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateDateOfBirth } from "@/lib/date-of-birth";

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
  defaults?: { dob?: string | null; pob?: string | null; tob?: string | null; timePrecision?: string | null };
}) {
  // Split the ISO `YYYY-MM-DD` default (if any) into editable numeric parts.
  const defaultDob = defaults?.dob && /^\d{4}-\d{2}-\d{2}$/.test(defaults.dob) ? defaults.dob : "";
  const [dobYY, setDobYY] = useState(defaultDob.slice(0, 4));
  const [dobMM, setDobMM] = useState(defaultDob.slice(5, 7));
  const [dobDD, setDobDD] = useState(defaultDob.slice(8, 10));
  const [pob, setPob] = useState(defaults?.pob ?? "");
  // An approximate Baseline stores its `tob` as a bucket key ("morning"), not a
  // clock time — feeding that into the time input renders an empty field and a
  // date-only edit would re-submit "morning" tagged `exact`, corrupting the
  // recompute. Detect the stored precision and open the form in the matching
  // mode so editing never silently changes the time-of-birth basis.
  const approximateDefault = defaults?.timePrecision === "approximate";
  const validBucket = approximateDefault && defaults?.tob && TOB_BUCKETS.some((b) => b.key === defaults.tob) ? defaults.tob : null;
  const [tob, setTob] = useState(approximateDefault ? "" : (defaults?.tob ?? ""));
  const [unknownTime, setUnknownTime] = useState(approximateDefault);
  const [bucket, setBucket] = useState<string | null>(validBucket);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onlyDigits = (v: string, max: number) => v.replace(/[^0-9]/g, "").slice(0, max);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate the date explicitly: a native <input type="date"> fails silently
    // and is inaccessible to keyboard / screen-reader / automated entry, so the
    // whole product dead-ends. Three numeric fields + this shared check give a
    // clear, reachable error on the funnel's anchor field.
    const dobCheck = validateDateOfBirth(dobMM, dobDD, dobYY);
    if (!dobCheck.ok) {
      setError(dobCheck.error);
      return;
    }
    const dob = dobCheck.iso;

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
      <fieldset className="space-y-2 border-0 p-0 m-0">
        <legend className="text-sm font-medium leading-none">Date of birth</legend>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="bf-dob-mm" className="block text-xs font-normal text-muted-foreground">Month</Label>
            <Input
              id="bf-dob-mm"
              inputMode="numeric"
              autoComplete="bday-month"
              maxLength={2}
              placeholder="MM"
              value={dobMM}
              onChange={(e) => { setDobMM(onlyDigits(e.target.value, 2)); setError(null); }}
              aria-describedby="bf-dob-hint"
              className="w-[4.5rem] text-center tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bf-dob-dd" className="block text-xs font-normal text-muted-foreground">Day</Label>
            <Input
              id="bf-dob-dd"
              inputMode="numeric"
              autoComplete="bday-day"
              maxLength={2}
              placeholder="DD"
              value={dobDD}
              onChange={(e) => { setDobDD(onlyDigits(e.target.value, 2)); setError(null); }}
              aria-describedby="bf-dob-hint"
              className="w-[4.5rem] text-center tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bf-dob-yy" className="block text-xs font-normal text-muted-foreground">Year</Label>
            <Input
              id="bf-dob-yy"
              inputMode="numeric"
              autoComplete="bday-year"
              maxLength={4}
              placeholder="YYYY"
              value={dobYY}
              onChange={(e) => { setDobYY(onlyDigits(e.target.value, 4)); setError(null); }}
              aria-describedby="bf-dob-hint"
              className="w-[5.5rem] text-center tabular-nums"
            />
          </div>
        </div>
        <p id="bf-dob-hint" className="text-[13px] leading-relaxed text-muted-foreground">
          The anchor. It fixes where the Sun and Moon stood when you arrived — the qualities
          your Baseline starts from.
        </p>
      </fieldset>

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