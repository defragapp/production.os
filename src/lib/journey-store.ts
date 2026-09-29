/**
 * Unified journey store (Batch 3, P3).
 *
 * One face — load, fold in a confirmed `{ state }` frame, apply a control —
 * over two memories: the server's D1 rows (default, multi-device continuity)
 * and the device's encrypted IndexedDB vault (`memory_mode = 'local'`, sealed
 * by local-memory.ts under a non-extractable key). The UI never branches on
 * the mode; this module does, once.
 *
 * Server controls round-trip through PATCH so every device converges on the
 * same truth. Local controls land immediately on this device — which is the
 * trade the person chose when they switched to Device-Only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_JOURNEY_STEPS, type JourneyState } from "./sovereign-journey";
import {
  progressFromUnlocked,
  stateToView,
  stepsFromUnlocked,
  STEP_TO_MILESTONE,
  MILESTONE_WEIGHTS,
  type JourneyView,
} from "./journeys";
import {
  patchLocalJourney,
  readRecord,
  writeRecord,
  type LocalJourneyRecord,
  type LocalJourneyStatus,
  type MemoryMode,
} from "./local-memory";
import type { JourneyStep } from "./sovereign-journey";

/** The journey plus the per-turn extras the canvas animates from. */
export interface JourneyClientView extends JourneyView {
  inquiryLevel: 1 | 2 | 3 | 4;
  newlyUnlocked: string[];
}

/** A journey a person can hold on-device: the client engine's state, kept in
 *  the canonical done/locked form (the record's own `status` field carries
 *  paused/hidden; the current-step marker is re-derived at render). */
type HoldableJourney = JourneyState;

/** Local records carry a fixed id: there is one journey per device and the
 *  id only exists so controls and renders share a stable key. */
const LOCAL_JOURNEY_ID = "local";

/** Place the `current` marker after the reached (done) steps. Shared by both
 *  stores so the canvas converges identically whichever memory answered. */
function withCurrentMarker(steps: JourneyStep[]): { steps: JourneyStep[]; currentIdx: number } {
  const doneCount = steps.filter((s) => s.status === "done").length;
  const currentIdx = Math.min(doneCount, steps.length - 1);
  return {
    steps: steps.map((s, i) => (s.status === "done" ? s : i === currentIdx ? { ...s, status: "current" as const } : { ...s, status: "locked" as const })),
    currentIdx,
  };
}

/** Inquiry level from reached steps when no frame has reported the live one —
 *  a coarse mirror of the engine's 4 levels, good enough for the badge. */
function levelFromDone(doneCount: number): 1 | 2 | 3 | 4 {
  return (doneCount >= 4 ? 4 : doneCount >= 3 ? 3 : doneCount >= 1 ? 2 : 1) as 1 | 2 | 3 | 4;
}

function viewFromLocal(rec: LocalJourneyRecord<HoldableJourney>): JourneyClientView {
  const marked = withCurrentMarker(rec.state.steps);
  return {
    id: LOCAL_JOURNEY_ID,
    goal: rec.state.suggested_goal,
    current_step: marked.steps[marked.currentIdx]?.id ?? rec.state.current_step,
    steps: marked.steps,
    milestones: rec.state.unlocked_milestones,
    visual_progress: rec.state.visual_progress,
    status: rec.status,
    updated_at: rec.updatedAt,
    inquiryLevel: rec.state.inquiry_level,
    newlyUnlocked: [],
  };
}

function localRecordFromView(view: JourneyClientView, userScope: string, status: LocalJourneyStatus): LocalJourneyRecord<HoldableJourney> {
  // viewToState already carries inquiry_level, so there is nothing to overlay —
  // re-adding the key here was a duplicate object literal (esbuild flagged it).
  const state: HoldableJourney = viewToState(view);
  return { version: 1, userScope, updatedAt: new Date().toISOString(), status, state };
}

/** Back to the engine's canonical shape: milestones are the truth, step
 *  statuses and progress are re-derived from them on every read. */
function viewToState(view: JourneyClientView): JourneyState {
  return {
    current_step: view.current_step,
    unlocked_milestones: [...view.milestones],
    visual_progress: view.visual_progress,
    newly_unlocked: [],
    inquiry_level: view.inquiryLevel,
    steps: stepsFromUnlocked(view.milestones),
    suggested_goal: view.goal,
  };
}

interface JourneyStore {
  fetchActive(): Promise<JourneyClientView | null>;
  /** The journey a specific thread was produced in. `null` when the row is
   *  gone (deleted, or never linked) and the caller should fall back. */
  fetchById(id: string): Promise<JourneyClientView | null>;
  /** Fold in the confirmed `{ state }` frame — the journey the UI shows next. */
  applyStateFrame(state: JourneyState, journeyId: string | null): Promise<JourneyClientView>;
  /** `undefined` means the write failed — the caller keeps the current view.
   *  Dismissal is deliberately not here: it is session-local in both modes
   *  (the bar folds away, the journey survives, a new unlock re-reveals it). */
  applyControl(patch: { id: string; rename?: string; pause?: boolean; overrideStep?: string }): Promise<JourneyClientView | undefined>;
}

/** Re-mark a server row for the canvas: the `current` marker and the badge
 *  level are derived here so a GET, a PATCH and a thread-linked read cannot
 *  drift apart. */
function markedView(row: JourneyView): JourneyClientView {
  const marked = withCurrentMarker(row.steps);
  return {
    ...row,
    current_step: marked.steps[marked.currentIdx]?.id ?? row.current_step,
    steps: marked.steps,
    inquiryLevel: levelFromDone(marked.currentIdx),
    newlyUnlocked: [],
  };
}

async function getJSON<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const serverStore: JourneyStore = {
  async fetchActive() {
    try {
      const res = await fetch("/api/journeys");
      if (!res.ok) return null;
      const data = await res.json() as { journeys?: JourneyView[] };
      // The active row wins; a paused one is shown (with Resume) only when
      // nothing is active — resuming stays an explicit choice, never a surprise.
      const rows = data.journeys ?? [];
      const row = rows.find((j) => j.status === "active") ?? rows.find((j) => j.status === "paused");
      if (!row) return null;
      return markedView(row);
    } catch {
      return null;
    }
  },
  async fetchById(id) {
    const data = await getJSON<{ journey?: JourneyView }>(`/api/journeys/${encodeURIComponent(id)}`);
    return data?.journey ? markedView(data.journey) : null;
  },
  async applyStateFrame(state, journeyId) {
    return { ...stateToView(journeyId, state), inquiryLevel: state.inquiry_level, newlyUnlocked: state.newly_unlocked };
  },
  async applyControl({ id, rename, pause, overrideStep }) {
    const body = rename !== undefined ? { goal: rename }
      : pause !== undefined ? { status: pause ? "paused" : "active" }
      : overrideStep ? { current_step: overrideStep }
      : null;
    if (!body) return undefined;
    const data = await getJSON<{ journey?: JourneyView }>(`/api/journeys/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!data?.journey) return undefined;
    return markedView(data.journey);
  },
};

function localStore(userScope: string): JourneyStore {
  return {
    async fetchActive() {
      const rec = await readRecord<HoldableJourney>("journey", userScope);
      // 'hidden' is the local analogue of dismissal: invisible, but the
      // record (and its progress) survives for the next unlock.
      if (!rec || rec.status === "hidden" || rec.status === "complete") return null;
      return viewFromLocal(rec);
    },
    async fetchById() {
      // A device holds exactly one journey, so any link resolves to it. The id
      // exists so the code path is shared, not because local rows are addressable.
      const rec = await readRecord<HoldableJourney>("journey", userScope);
      return rec ? viewFromLocal(rec) : null;
    },
    async applyStateFrame(state) {
      const view: JourneyClientView = { ...stateToView(LOCAL_JOURNEY_ID, state), inquiryLevel: state.inquiry_level, newlyUnlocked: state.newly_unlocked };
      const prev = await readRecord<HoldableJourney>("journey", userScope);
      // A local journey never disappears behind someone's back: a paused or
      // renamed record keeps its human-set status through a derived turn.
      const status: LocalJourneyStatus = prev && prev.status !== "complete" ? prev.status : "active";
      await writeRecord("journey", localRecordFromView(view, userScope, status));
      return view;
    },
    async applyControl({ rename, pause, overrideStep }) {
      const rec = await readRecord<HoldableJourney>("journey", userScope);
      if (!rec) return undefined;
      const status: LocalJourneyStatus | undefined = pause !== undefined ? (pause ? "paused" : "active") : undefined;
      const patched = patchLocalJourney<HoldableJourney>(rec, { goal: rename, status, overrideStep }, DEFAULT_JOURNEY_STEPS, STEP_TO_MILESTONE, MILESTONE_WEIGHTS);
      // An override rewinds the unlocked set, so step statuses and progress
      // must be recomputed from it — exactly what the server PATCH does.
      if (overrideStep) {
        patched.state = {
          ...patched.state,
          steps: stepsFromUnlocked(patched.state.unlocked_milestones),
          visual_progress: progressFromUnlocked(patched.state.unlocked_milestones),
        };
      }
      await writeRecord("journey", patched);
      return viewFromLocal(patched);
    },
  };
}

export function getJourneyStore(mode: MemoryMode, userScope: string): JourneyStore {
  return mode === "local" ? localStore(userScope) : serverStore;
}

/**
 * The chat page's journey hook: loads the stored journey once, folds in every
 * confirmed `{ state }` frame, and exposes the four controls. `onReveal` lets
 * the page un-hide a dismissed bar when a fresh milestone unlocks — the bar
 * earns its place back by progress, not by nagging.
 *
 * `selectLinked` is the thread-switch half of the same face: a thread that
 * carries a `journey_id` shows THAT journey, and an unlinked thread (or one
 * whose row was deleted) falls back to the active journey — so switching
 * conversations can never leave the previous thread's steps on screen, and can
 * never leave a person staring at an empty canvas either.
 */
export function useJourney(mode: MemoryMode, userScope: string, onReveal?: () => void) {
  const [view, setView] = useState<JourneyClientView | null>(null);
  // Stable store identity per (mode, scope): the fetch effect must not
  // re-fire on every render.
  const store = useMemo(() => getJourneyStore(mode, userScope), [mode, userScope]);
  // Reads resolve out of order (a slow active-list fetch answering after a
  // thread-linked read). The latest request wins, always.
  const genRef = useRef(0);

  useEffect(() => {
    const gen = ++genRef.current;
    void (async () => {
      const loaded = await store.fetchActive();
      if (gen === genRef.current) setView(loaded);
    })();
  }, [store]);

  const selectLinked = useCallback(async (journeyId: string | null) => {
    const gen = ++genRef.current;
    const linked = journeyId ? await store.fetchById(journeyId) : null;
    // A link that no longer resolves is not a reason to hide the canvas: fall
    // back to the active journey rather than reporting nothing.
    const next = linked ?? await store.fetchActive();
    if (gen === genRef.current) setView(next);
    return next;
  }, [store]);

  const applyStateFrame = useCallback(async (state: JourneyState, journeyId: string | null) => {
    const next = await store.applyStateFrame(state, journeyId);
    genRef.current += 1;
    setView(next);
    if (next.newlyUnlocked.length > 0) onReveal?.();
    return next;
  }, [store, onReveal]);

  const applyControl = useCallback(async (patch: { id: string; rename?: string; pause?: boolean; overrideStep?: string }) => {
    const next = await store.applyControl(patch);
    if (next) {
      genRef.current += 1;
      setView(next);
    }
    return next ?? null;
  }, [store]);

  return { view, selectLinked, applyStateFrame, applyControl };
}
