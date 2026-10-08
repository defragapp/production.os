"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { INQUIRY_LEVEL_LABELS, DEFAULT_JOURNEY_STEPS, type JourneyStep } from "@/lib/sovereign-journey";
import type { PastArc } from "@/lib/journeys";

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
  /** The veil overlays the transcript, so the full canvas + step list is the
   *  one thing that can cover words the person is reading. It therefore starts
   *  as a single 44px summary band — exactly the space the transcript reserves
   *  — and the taller view is only ever shown because it was asked for. */
  expanded: boolean;
  onToggleExpanded: () => void;
  onRename: (goal: string) => void;
  onPauseResume: () => void;
  onDismiss: () => void;
  onStepBack: (stepId: string) => void;
  /** Archive the finished arc. Offered the moment the last step is reached, so
   *  "done" is a thing a person can say out loud to the product. */
  onComplete: () => void;
  /** Close what is open and begin the next one, in a single tap. */
  onStartFresh: () => void;
  /** How many arcs this person has already closed. Zero means the door stays
   *  shut — an empty archive is not worth a control. */
  pastCount: number;
  onShowPast: () => void;
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

export function JourneyBar({ journey, expanded, onToggleExpanded, onRename, onPauseResume, onDismiss, onStepBack, onComplete, onStartFresh, pastCount, onShowPast }: JourneyBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(journey.goal ?? "");
  const renameTriggerRef = useRef<HTMLButtonElement>(null);
  // The two forms of the bar each own one toggle, and only one of them exists at
  // a time — so focus is moved by hand whenever the disclosure flips.
  const showRef = useRef<HTMLButtonElement>(null);
  const hideRef = useRef<HTMLButtonElement>(null);
  const toggleSteps = () => {
    const willExpand = !expanded;
    onToggleExpanded();
    // Focus follows the disclosure: the control that was just tapped unmounts
    // with the rest of its form, and a keyboard user would otherwise land on
    // <body> mid-thought. Hand them the control that survives the swap.
    requestAnimationFrame(() => (willExpand ? hideRef : showRef).current?.focus());
  };
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
  // Two ways to be at the end: the engine lit every milestone, or the person
  // said so. `progress >= 1` is the engine's own word for "nothing left".
  const atEnd = total > 0 && (doneCount === total || journey.progress >= 1);
  const isComplete = journey.status === "complete";
  // A finished arc has no "current step", so the ordinary label would read
  // "step 6 of 5" — say what is true instead.
  const groupLabel = isComplete
    ? `Journey complete${journey.goal ? `: ${journey.goal}` : ""}. ${doneCount} of ${total} steps reached.`
    : `Your progress${journey.goal ? ` on ${journey.goal}` : ""}: step ${Math.min(doneCount + 1, total)} of ${total}, ${doneCount} milestones reached. Currently: ${INQUIRY_LEVEL_LABELS[journey.inquiryLevel]}.`;
  if (!expanded) {
    // Compact band: one row, never a second line, so the overlay's footprint is
    // the reserved clearance and nothing else. Renaming, pausing, and dismissing
    // live one tap away in the full view — and so does the one control worth
    // putting here, because it is the thing a person looks for after finishing:
    // the tap sits *beside* the row's own toggle, never inside it (a button in a
    // button is invalid), and the row's flex-1 text absorbs its width, so
    // nothing on the band moves when it appears.
    return (
      <figure role="group" aria-label={groupLabel} className="journey-bar journey-veil-compact gap-2 rounded-panel border border-border/60 bg-white/[0.03] px-3">
        <button
          ref={showRef}
          type="button"
          onClick={toggleSteps}
          aria-expanded={false}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span aria-hidden="true" className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {isComplete ? "Complete" : INQUIRY_LEVEL_LABELS[journey.inquiryLevel]}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{journey.goal ?? "Untitled journey"}</span>
          <span aria-hidden="true" className="shrink-0 font-mono text-[10px] text-muted-foreground">{doneCount}/{total}</span>
          <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Show journey steps</span>
        </button>
        {isComplete && (
          <button
            type="button"
            onClick={onStartFresh}
            title="Start a fresh journey"
            className="inline-flex min-w-[2.75rem] shrink-0 items-center justify-center rounded-sm border border-border/60 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-[240ms] hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            New
            <span className="sr-only"> journey</span>
          </button>
        )}
      </figure>
    );
  }
  return (
    <figure role="group" aria-label={groupLabel} className="journey-bar rounded-panel border border-border/60 bg-white/[0.03] px-4 pb-3 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground" aria-label={isComplete ? "Journey complete" : `Inquiry level: ${INQUIRY_LEVEL_LABELS[journey.inquiryLevel]}`}>
          {isComplete ? "Complete" : INQUIRY_LEVEL_LABELS[journey.inquiryLevel]}
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
          <button ref={hideRef} type="button" onClick={toggleSteps} aria-expanded aria-controls="journey-steps" className="rounded-sm hover:text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Hide steps</button>
          {!isComplete && (
            <button type="button" onClick={onPauseResume} className="rounded-sm hover:text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">{journey.status === "paused" ? "Resume" : "Pause"}</button>
          )}
          <button type="button" onClick={onDismiss} className="rounded-sm hover:text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Dismiss</button>
        </div>
      </div>
      {/* The end of an arc deserves a sentence, not a confetti cannon. Both
          buttons clear the 44px floor because they are the point of the whole
          panel: one says "this is finished", the other opens the next thing. */}
      {(atEnd || isComplete) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 pb-1">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            {isComplete
              ? "Archived. Your next conversation starts its own journey whenever you're ready."
              : "You've reached the last step. Mark it complete and a new conversation starts fresh."}
          </p>
          {isComplete ? (
            <button
              type="button"
              onClick={onStartFresh}
              className="inline-flex shrink-0 items-center rounded-md border border-border/60 px-3 text-xs font-medium text-foreground transition-colors duration-[240ms] hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start a fresh journey
            </button>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex shrink-0 items-center rounded-md border border-border/60 px-3 text-xs font-medium text-foreground transition-colors duration-[240ms] hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Mark complete
            </button>
          )}
        </div>
      )}
      <div id="journey-steps">
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
      </div>
      {/* The archive, and the way back to it. It is the LAST child of the panel
          on purpose: content appended under the final row moves nothing that is
          already painted, so the count going 0 → 1 in the same breath as a
          completion costs exactly zero layout shift (the band above has the same
          property, which is why it survives on transform alone). Class name is
          a hook twice over — the tap floor audit reads it, and the page hands
          focus back to it when the sheet closes. */}
      {pastCount > 0 && (
        <button
          type="button"
          onClick={onShowPast}
          className="journey-past-trigger mt-2 flex w-full items-center justify-between gap-3 rounded-sm border-t border-border/50 pt-2 text-left transition-colors duration-[240ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="text-xs text-muted-foreground">Past journeys</span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{pastCount} archived</span>
        </button>
      )}
    </figure>
  );
}

/** A completion date, in the register the rest of the product uses — no
 *  timestamps, no ISO. An unreadable row is the same as a missing one. */
function formatArcDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

/** The archive, opened. A fixed sheet rather than in-flow content: it owns no
 *  static space, so looking back never moves the conversation (see the
 *  `.past-arc-*` keyframes in globals.css — transform and opacity only). It is
 *  deliberately non-modal: no scroll lock (that would shift every message row
 *  by the scrollbar's width) and the thread strip stays reachable. */
export function PastJourneysSheet({ arcs, onClose }: { arcs: PastArc[]; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // `onClose` arrives as a fresh arrow on every parent render, so it goes in a
  // ref: the listener is attached once (below) and always calls the latest
  // handler. Attaching per-render-on-`onClose` churned the document listener on
  // every parent update, and with the step panel also expanded underneath a
  // single Escape folded the panel while the sheet survived to the second press
  // — a sheet you can enter but not leave on the first try is a trap, not a
  // feature. Capture phase + stopPropagation makes this topmost layer win the
  // one press it owns, and leaves the panel behind for the next.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  return (
    <div
      className="past-arc-scrim fixed inset-0 z-[900] flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Past journeys"
        onClick={(event) => event.stopPropagation()}
        className="past-arc-sheet max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-t-panel border border-border/60 bg-background px-5 pb-6 pt-5 shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.9)] sm:rounded-panel sm:px-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Archive</p>
            <h2 className="mt-1 font-display text-xl font-normal tracking-tight text-foreground">Past journeys</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {/* Honest about the bound rather than promising a permanent record:
                  both memory modes keep the most recent ten (see MAX_LOCAL_ARCS
                  and COMPLETED_LIMIT), which is the whole point of a look-back. */}
              {arcs.length === 1 ? "One arc you have closed." : `${arcs.length} arcs you have closed.`} The ten most recent stay here.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded-md border border-border/60 px-3 text-xs font-medium text-foreground transition-colors duration-[240ms] hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Close
          </button>
        </div>
        <ol className="mt-4 space-y-3">
          {arcs.map((arc, i) => (
            <li key={`${arc.completedAt}-${i}`} className="rounded-md border border-border/50 bg-white/[0.03] px-4 py-3">
              <p className="text-sm font-medium text-foreground">{arc.goal ?? "Untitled journey"}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {formatArcDate(arc.completedAt) || "Date unavailable"}
                {" · "}
                {arc.stepsReached} of {arc.totalSteps} steps reached
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
