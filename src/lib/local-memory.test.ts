import { describe, expect, it } from "vitest";
import {
  clearLocalMemory,
  isLocalMemoryAvailable,
  patchLocalJourney,
  readRecord,
  writeRecord,
  type LocalJourneyRecord,
} from "./local-memory";
import { MILESTONE_WEIGHTS, STEP_TO_MILESTONE } from "./journeys";
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
