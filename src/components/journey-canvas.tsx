"use client";
import { useRef, useState } from "react";
import { INQUIRY_LEVEL_LABELS, DEFAULT_JOURNEY_STEPS, type JourneyStep } from "@/lib/sovereign-journey";

export interface JourneyBarData {
  id: string | null;
  goal: string | null;
  status: string;
  steps: JourneyStep[];
  progress: number;
  newlyUnlocked: string[];
  inquiryLevel: 1 | 2 | 3 | 4;
}

interface JourneyBarProps {
  journey: JourneyBarData;
  onRename: (goal: string) => void;
  onPauseResume: () => void;
  onDismiss: () => void;
  onStepBack: (stepId: string) => void;
}

const VIEW_W = 600;
const VIEW_H = 96;
const TRACK_Y = 48;
const PAD_X = 36;
const STEP_MILESTONES = ["signal-surfaced", "meaning-clarified", "parts-separated", "frame-widened", "footing-found"];
/** Milestone id → the human step it represents. Used by the chat shell's
 *  screen-reader announcement, which speaks step labels, not internal ids. */
export const MILESTONE_STEP_LABELS: Record<string, string> = Object.fromEntries(
  STEP_MILESTONES.map((m, i) => [m, DEFAULT_JOURNEY_STEPS[i]?.label ?? m]),
);

function nodeX(i: number, n: number): number {
  if (n <= 1) return VIEW_W / 2;
  return PAD_X + (i * (VIEW_W - PAD_X * 2)) / (n - 1);
}

export function JourneyCanvas({ steps, progress, newlyUnlocked }: {
  steps: JourneyStep[];
  progress: number;
  newlyUnlocked: string[];
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const n = steps.length;
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block h-24 w-full" aria-hidden="true" focusable="false">
      <line x1={PAD_X} y1={TRACK_Y} x2={VIEW_W - PAD_X} y2={TRACK_Y} className="stroke-border" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      <line x1={PAD_X} y1={TRACK_Y} x2={VIEW_W - PAD_X} y2={TRACK_Y} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamped} className="journey-progress-line stroke-foreground" strokeWidth={2.5} strokeLinecap="round" />
      {steps.map((s, i) => {
        const cx = nodeX(i, n);
        const done = s.status === "done";
        const current = s.status === "current";
        const fresh = newlyUnlocked.includes(STEP_MILESTONES[i] ?? "");
        return (
          <g key={s.id}>
            {current && <circle cx={cx} cy={TRACK_Y} r={14} fill="none" className="stroke-foreground/40 journey-current-ring" strokeWidth={1.5} />}
            <circle cx={cx} cy={TRACK_Y} r={done ? 8 : 6} strokeWidth={current ? 2 : 1.5} className={`${done ? "fill-foreground" : current ? "fill-background stroke-foreground" : "fill-muted stroke-border"} ${fresh ? "milestone-pop" : ""}`} />
            {done && <path d={`M ${cx - 3.5} ${TRACK_Y} l 2.5 2.5 l 4.5 -5`} fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="stroke-background" />}
          </g>
        );
      })}
    </svg>
  );
}

export function JourneyBar({ journey, onRename, onPauseResume, onDismiss, onStepBack }: JourneyBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(journey.goal ?? "");
  const renameTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelRename = () => {
    // Escape abandons the edit cleanly and hands focus back to the control it
    // came from, so the keyboard never lands on an element that just unmounted.
    setDraft(journey.goal ?? "");
    setEditing(false);
    requestAnimationFrame(() => renameTriggerRef.current?.focus());
  };
  const doneCount = journey.steps.filter((s) => s.status === "done").length;
  const total = journey.steps.length;
  const currentIdx = journey.steps.findIndex((s) => s.status === "current");
  return (
    <figure role="group" aria-label={`Your progress${journey.goal ? ` on ${journey.goal}` : ""}: step ${doneCount + 1} of ${total}, ${doneCount} milestones reached. Currently: ${INQUIRY_LEVEL_LABELS[journey.inquiryLevel]}.`} className="journey-bar rounded-panel border border-border/60 bg-white/[0.03] px-4 pb-3 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground" aria-label={`Inquiry level: ${INQUIRY_LEVEL_LABELS[journey.inquiryLevel]}`}>
          {INQUIRY_LEVEL_LABELS[journey.inquiryLevel]}
        </span>
        {editing ? (
          <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); onRename(draft.trim()); setEditing(false); }}>
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancelRename(); } }} maxLength={200} placeholder="Name this journey..." aria-label="Journey name" className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
            <button type="submit" className="rounded-sm text-xs font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Save</button>
            <button type="button" onClick={cancelRename} className="rounded-sm text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Cancel</button>
          </form>
        ) : (
          <button ref={renameTriggerRef} type="button" onClick={() => { setDraft(journey.goal ?? ""); setEditing(true); }} title="Rename journey" className="min-w-0 flex-1 truncate rounded-sm text-left text-sm font-medium text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            {journey.goal ?? "Untitled journey"}
          </button>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          <button type="button" onClick={onPauseResume} className="rounded-sm hover:text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">{journey.status === "paused" ? "Resume" : "Pause"}</button>
          <button type="button" onClick={onDismiss} className="rounded-sm hover:text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Dismiss</button>
        </div>
      </div>
      <div className="journey-emblem-wash relative">
        <JourneyCanvas steps={journey.steps} progress={journey.progress} newlyUnlocked={journey.newlyUnlocked} />
      </div>
      <ol className="mt-1 space-y-1">
        {journey.steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 text-xs">
            <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${s.status === "done" ? "bg-foreground" : s.status === "current" ? "border border-foreground bg-transparent" : "bg-muted-foreground/30"}`} />
            <span className={s.status === "locked" ? "text-muted-foreground/70" : s.status === "current" ? "font-medium text-foreground" : "text-muted-foreground"}>{s.label}</span>
            {s.status !== "locked" && i > 0 && i <= currentIdx && (
              <button type="button" onClick={() => onStepBack(s.id)} title="I am not there yet" className="ml-1 rounded-sm text-[11px] text-muted-foreground/70 hover:text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Not there yet?</button>
            )}
            <span className="sr-only">{s.status === "done" ? " (reached)" : s.status === "current" ? " (current step)" : " (locked)"}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
