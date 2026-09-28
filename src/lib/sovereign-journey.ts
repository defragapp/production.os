/**
 * Deterministic journey-state derivation (Batch 2, P2).
 * Pure + dependency-free: runs in <50ms on the edge, unit-testable.
 * The model must never control progress state.
 */
import type { ChatMessage } from "./types";
import type { ReasoningContext } from "./sovereign-types";

export interface JourneyStepDef { id: string; label: string; }
export interface JourneyStep extends JourneyStepDef { status: "done" | "current" | "locked"; }
export interface JourneyState {
  current_step: string;
  unlocked_milestones: string[];
  visual_progress: number;
  newly_unlocked: string[];
  inquiry_level: 1 | 2 | 3 | 4;
  steps: JourneyStep[];
  suggested_goal: string | null;
}
export const DEFAULT_JOURNEY_STEPS: JourneyStepDef[] = [
  { id: "surface-signal", label: "Say what's landing" },
  { id: "name-what-landed", label: "Name what crossed the line" },
  { id: "separate-the-parts", label: "Separate what's yours from what's theirs" },
  { id: "widen-the-frame", label: "See the fuller picture" },
  { id: "grounded-next-step", label: "Choose one grounded next step" },
];
const MILESTONE_STEP_WEIGHTS = [
  { milestone: "signal-surfaced", step: "surface-signal", weight: 0.15 },
  { milestone: "meaning-clarified", step: "name-what-landed", weight: 0.2 },
  { milestone: "parts-separated", step: "separate-the-parts", weight: 0.2 },
  { milestone: "frame-widened", step: "widen-the-frame", weight: 0.2 },
  { milestone: "footing-found", step: "grounded-next-step", weight: 0.25 },
];
export const INQUIRY_LEVEL_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Reflection", 2: "Meaning", 3: "Between Us", 4: "Whole System",
};
function userTurns(history: ChatMessage[]): ChatMessage[] {
  return history.filter((m) => m.role === "user" && m.content.trim().length > 0);
}
export function inferJourneyGoal(history: ChatMessage[], ctx: ReasoningContext): string | null {
  const users = userTurns(history);
  if (users.length < 2) return null;
  const substantial =
    ctx.meaningTargets.length > 0 || ctx.patterns.length > 0 ||
    (ctx.consented?.length ?? 0) > 0 ||
    users.some((m) => m.content.trim().length >= 40);
  if (!substantial) return null;
  const first = users[0].content.trim().replace(/\s+/g, " ");
  const clipped = first.length > 64 ? `${first.slice(0, 61).trimEnd()}…` : first;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

export function deriveJourneyState(ctx: ReasoningContext, history: ChatMessage[], prev: JourneyState | null): JourneyState {
  const detected = detectMilestones(ctx, history);
  const prevUnlocked = new Set(prev?.unlocked_milestones ?? []);
  const unlocked = [...prevUnlocked];
  for (const m of detected) if (!prevUnlocked.has(m)) unlocked.push(m);
  const newly_unlocked = unlocked.filter((m) => !prevUnlocked.has(m));
  let progress = 0;
  for (const w of MILESTONE_STEP_WEIGHTS) if (unlocked.includes(w.milestone)) progress += w.weight;
  progress = Math.min(1, Math.max(prev?.visual_progress ?? 0, progress));
  progress = Math.round(progress * 100) / 100;
  const doneSteps = new Set(MILESTONE_STEP_WEIGHTS.filter((w) => unlocked.includes(w.milestone)).map((w) => w.step));
  const steps: JourneyStep[] = DEFAULT_JOURNEY_STEPS.map((s) => doneSteps.has(s.id) ? { ...s, status: "done" as const } : { ...s, status: "locked" as const });
  const firstOpen = steps.findIndex((s) => s.status !== "done");
  let current_step = DEFAULT_JOURNEY_STEPS[DEFAULT_JOURNEY_STEPS.length - 1].id;
  if (firstOpen !== -1) { steps[firstOpen] = { ...steps[firstOpen], status: "current" }; current_step = steps[firstOpen].id; }
  return { current_step, unlocked_milestones: unlocked, visual_progress: progress, newly_unlocked, inquiry_level: ctx.level, steps, suggested_goal: inferJourneyGoal(history, ctx) };
}

function detectMilestones(ctx: ReasoningContext, history: ChatMessage[]): Set<string> {
  const found = new Set<string>();
  const users = userTurns(history);
  if (users.length >= 1) found.add("signal-surfaced");
  if (ctx.meaningTargets.some((t) => t.definitionKnown)) found.add("meaning-clarified");
  if (ctx.correctionState.confirmedInterpretations.length > 0 || ctx.correctionState.rejectedHypotheses.length > 0) found.add("parts-separated");
  if (ctx.domains.includes("between") || ctx.domains.includes("system") || ctx.relationshipScope !== "self" || (ctx.consented?.length ?? 0) > 0 || ctx.level >= 3) found.add("frame-widened");
  if (ctx.domains.includes("choice") || ctx.level >= 4 || ctx.hypotheses.some((h) => h.status === "supported-by-user")) found.add("footing-found");
  return found;
}
