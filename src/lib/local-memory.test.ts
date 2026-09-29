import { describe, expect, it } from "vitest";
import {
  appendLocalHistory,
  clearLocalMemory,
  isLocalMemoryAvailable,
  MAX_LOCAL_ARCS,
  MAX_LOCAL_EVENTS,
  patchLocalJourney,
  readRecord,
  writeRecord,
  type LocalArcSummary,
  type LocalJourneyEventLog,
  type LocalJourneyHistory,
  type LocalJourneyRecord,
} from "./local-memory";
import { MILESTONE_WEIGHTS, pastArcFromView, rowToView, STEP_TO_MILESTONE, type JourneyRow } from "./journeys";
import { DEFAULT_JOURNEY_STEPS, type JourneyState } from "./sovereign-journey";

// A record is the encrypted payload's plaintext shape: a journey state plus
// the scope/version bookkeeping the vault writes around it.
function rec(state: Partial<JourneyState> = {}): LocalJourneyRecord<JourneyState> {
  return {
    version: 1,
    userScope: "you@example.com",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "active",
    state: {
      current_step: "widen-the-frame",
      unlocked_milestones: ["signal-surfaced", "meaning-clarified", "parts-separated", "frame-widened"],
      visual_progress: 0.75,
      newly_unlocked: [],
      inquiry_level: 3,
      steps: DEFAULT_JOURNEY_STEPS.map((s) => ({ ...s, status: "done" as const })),
      suggested_goal: "Work through the tension with my partner",
      ...state,
    },
  };
}

describe("local-memory storage surface (Node has no IndexedDB)", () => {
  // The load-bearing guarantee for SSR + graceful degrade: every entry point
  // resolves to a null/false sentinel instead of throwing, so a browser without
  // IndexedDB (private mode, old WebView) falls back to server mode rather than
  // crashing the chat page or silently dropping history.
  it("reports unavailable and no-ops reads/writes without IndexedDB", async () => {
    expect(await isLocalMemoryAvailable()).toBe(false);
    expect(await readRecord<JourneyState>("journey", "you@example.com")).toBeNull();
    expect(await writeRecord("journey", rec())).toBe(false);
    // The archive is a second record kind in the same vault, and it degrades
    // exactly the same way: a null read, never a throw.
    expect(await readRecord<LocalJourneyHistory>("journey-history", "you@example.com")).toBeNull();
    await expect(clearLocalMemory()).resolves.toBeUndefined();
  });
});

describe("patchLocalJourney (pure reducer, parity with PATCH /api/journeys/[id])", () => {
  it("renames the goal and stamps a fresh updatedAt", () => {
    const next = patchLocalJourney(rec(), { goal: "  Showing up calmer  " }, DEFAULT_JOURNEY_STEPS, STEP_TO_MILESTONE, MILESTONE_WEIGHTS);
    expect(next.state.suggested_goal).toBe("Showing up calmer");
    expect(next.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("an empty rename clears the goal rather than storing blank text", () => {
    const next = patchLocalJourney(rec(), { goal: "   " }, DEFAULT_JOURNEY_STEPS, STEP_TO_MILESTONE, MILESTONE_WEIGHTS);
    expect(next.state.suggested_goal).toBeNull();
  });

  it("carries status changes (pause / resume / complete / hide) through", () => {
    const paused = patchLocalJourney(rec(), { status: "paused" }, DEFAULT_JOURNEY_STEPS, STEP_TO_MILESTONE, MILESTONE_WEIGHTS);
    expect(paused.status).toBe("paused");
    expect(paused.state).toEqual(rec().state);
  });

  it("a step override rewinds milestones, progress and step state identically to the server", () => {
    // Standing at the far end (all unlocked, progress 0.75) then declaring
    // "I'm not there yet" at separate-the-parts (index 2) must drop every
    // later milestone and rebuild the done/current/locked ladder.
    const next = patchLocalJourney(rec(), { overrideStep: "separate-the-parts" }, DEFAULT_JOURNEY_STEPS, STEP_TO_MILESTONE, MILESTONE_WEIGHTS);
    expect(next.state.unlocked_milestones).toEqual(["signal-surfaced", "meaning-clarified", "parts-separated"]);
    expect(next.state.unlocked_milestones).not.toContain("frame-widened");
    expect(next.state.current_step).toBe("separate-the-parts");
    // 0.15 + 0.2 + 0.2 = 0.55, clamped to two decimals like the server.
    expect(next.state.visual_progress).toBeCloseTo(0.55, 5);
    expect(next.state.steps.map((s) => s.status)).toEqual(["done", "done", "current", "locked", "locked"]);
  });

  it("an unknown override step is a no-op on progress", () => {
    const next = patchLocalJourney(rec(), { overrideStep: "not-a-real-step" }, DEFAULT_JOURNEY_STEPS, STEP_TO_MILESTONE, MILESTONE_WEIGHTS);
    expect(next.state.unlocked_milestones).toEqual(rec().state.unlocked_milestones);
    expect(next.state.visual_progress).toBe(0.75);
  });
});

describe("appendLocalHistory (the device's archive and lifecycle timeline)", () => {
  const arc = (goal: string, at = "2026-01-01T00:00:00.000Z"): LocalArcSummary => ({
    goal,
    completedAt: at,
    stepsReached: 5,
    totalSteps: 5,
  });
  const line = (milestone: string, at = "2026-01-01T00:00:00.000Z"): LocalJourneyEventLog => ({
    milestone,
    source: "user-confirmed",
    at,
  });

  it("starts from an empty archive rather than a null-shaped one", () => {
    expect(appendLocalHistory(null, {})).toEqual({ arcs: [], events: [] });
  });

  it("closing an arc keeps the arcs closed before it — the bug this exists for", () => {
    // Device-Only holds exactly one live journey record, so a completion that
    // only writes that record erases the person's history. The archive is a
    // separate record precisely so "fresh" never means "gone".
    const first = appendLocalHistory(null, { arc: arc("Show up calmer"), events: [line("journey-completed")] });
    const second = appendLocalHistory(first, { arc: arc("Repair the rift with my brother"), events: [line("journey-completed")] });
    expect(second.arcs.map((a) => a.goal)).toEqual(["Repair the rift with my brother", "Show up calmer"]);
    expect(second.events.length).toBe(2);
  });

  it("bounds the archive at ten arcs and the timeline at fifty lines, newest first", () => {
    let history: LocalJourneyHistory = { arcs: [], events: [] };
    for (let i = 0; i < MAX_LOCAL_ARCS + 4; i += 1) {
      history = appendLocalHistory(history, { arc: arc(`Arc ${i}`) });
    }
    expect(history.arcs.length).toBe(MAX_LOCAL_ARCS);
    expect(history.arcs[0]?.goal).toBe(`Arc ${MAX_LOCAL_ARCS + 3}`);
    expect(history.arcs[history.arcs.length - 1]?.goal).toBe(`Arc ${MAX_LOCAL_ARCS - 6}`);

    let events = { arcs: [], events: [] } as LocalJourneyHistory;
    for (let i = 0; i < MAX_LOCAL_EVENTS + 10; i += 1) {
      events = appendLocalHistory(events, { events: [line(`m${i}`)] });
    }
    expect(events.events.length).toBe(MAX_LOCAL_EVENTS);
    expect(events.events[0]?.milestone).toBe(`m${MAX_LOCAL_EVENTS + 9}`);
  });

  it("an events-only write leaves the archive untouched, and vice versa", () => {
    const base = appendLocalHistory(null, { arc: arc("Name what landed") });
    expect(appendLocalHistory(base, { events: [line("journey-started")] }).arcs).toEqual(base.arcs);
    expect(appendLocalHistory(base, { arc: arc("Second") }).events).toEqual([]);
  });
});

describe("pastArcFromView (one shape for both memory modes)", () => {
  it("reduces a completed row to goal, date and steps reached", () => {
    // The shape the server reports and the shape the device archives must be
    // the same one, or the "Past journeys" list reads differently depending on
    // where a person's memory lives.
    const row: JourneyRow = {
      id: "j1",
      user_id: "u1",
      goal: "Work through the tension with my brother",
      current_step: "grounded-next-step",
      steps_json: JSON.stringify(DEFAULT_JOURNEY_STEPS.map((s) => ({ ...s, status: "done" as const }))),
      milestones_json: JSON.stringify(["signal-surfaced", "meaning-clarified", "parts-separated", "frame-widened", "footing-found"]),
      visual_progress: 1,
      status: "complete",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-02-03T10:00:00.000Z",
    };
    expect(pastArcFromView(rowToView(row))).toEqual({
      goal: "Work through the tension with my brother",
      completedAt: "2026-02-03T10:00:00.000Z",
      stepsReached: 5,
      totalSteps: 5,
    });
  });

  it("counts an arc that was closed early as the steps actually reached", () => {
    const steps = DEFAULT_JOURNEY_STEPS.map((s, i) => ({ ...s, status: (i < 4 ? "done" : "current") as "done" | "current" }));
    const arc = pastArcFromView({
      id: "j2",
      goal: null,
      current_step: "grounded-next-step",
      steps,
      milestones: ["signal-surfaced"],
      visual_progress: 0.75,
      status: "complete",
      updated_at: "2026-03-01T00:00:00.000Z",
    });
    expect(arc).toEqual({ goal: null, completedAt: "2026-03-01T00:00:00.000Z", stepsReached: 4, totalSteps: 5 });
  });
});
