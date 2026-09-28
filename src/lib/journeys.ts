import { generateUUID } from "./auth";
import { DEFAULT_JOURNEY_STEPS, type JourneyState, type JourneyStep } from "./sovereign-journey";

/**
 * The one mapping between steps and milestones, shared by the server engine
 * (sovereign-journey), the PATCH route's step override, and the client's local
 * store — three places that must rewind or light the exact same notch.
 */
export const STEP_TO_MILESTONE: Record<string, string> = {
  "surface-signal": "signal-surfaced",
  "name-what-landed": "meaning-clarified",
  "separate-the-parts": "parts-separated",
  "widen-the-frame": "frame-widened",
  "grounded-next-step": "footing-found",
};
/** Per-milestone progress weights, mirroring MILESTONE_STEP_WEIGHTS. */
export const MILESTONE_WEIGHTS: Record<string, number> = {
  "signal-surfaced": 0.15,
  "meaning-clarified": 0.2,
  "parts-separated": 0.2,
  "frame-widened": 0.2,
  "footing-found": 0.25,
};
/** Pure view mapping: a step is reached when its milestone is unlocked. */
export function stepsFromUnlocked(unlocked: string[]): JourneyStep[] {
  return DEFAULT_JOURNEY_STEPS.map((s) => ({ ...s, status: unlocked.includes(STEP_TO_MILESTONE[s.id]) ? "done" as const : "locked" as const }));
}
/** Progress from the unlocked set alone — same sum, same clamp, same rounding. */
export function progressFromUnlocked(unlocked: string[]): number {
  return Math.min(1, Math.round(unlocked.reduce((t, m) => t + (MILESTONE_WEIGHTS[m] ?? 0), 0) * 100) / 100);
}
/** The confirmed `{ state }` SSE frame folded into the persisted-row shape,
 *  so one <JourneyView> renders both the load-time journey and live turns. */
export function stateToView(journeyId: string | null, state: JourneyState): JourneyView {
  return {
    id: journeyId ?? "",
    goal: state.suggested_goal,
    current_step: state.current_step,
    steps: state.steps,
    milestones: state.unlocked_milestones,
    visual_progress: state.visual_progress,
    status: "active",
    updated_at: new Date().toISOString(),
  };
}

/** Minimal D1 surface journeys.ts needs — structural so it works with both
 *  AppEnv and the generated CloudflareEnv regardless of which ambient types
 *  win in a given build. */
export interface JourneyDb {
  DB: D1Database;
}
export interface JourneyRow {
  id: string; user_id: string; goal: string | null; current_step: string;
  steps_json: string; milestones_json: string; visual_progress: number;
  status: string; created_at: string; updated_at: string;
}
export interface JourneyView {
  id: string; goal: string | null; current_step: string;
  steps: JourneyStep[];
  milestones: string[]; visual_progress: number; status: string;
  updated_at: string;
}
export function rowToView(r: JourneyRow): JourneyView {
  let steps: JourneyView["steps"] = DEFAULT_JOURNEY_STEPS.map((s) => ({ ...s, status: "locked" as const }));
  try { const p = JSON.parse(r.steps_json); if (Array.isArray(p) && p.length) steps = p; } catch {}
  let milestones: string[] = [];
  try { const m = JSON.parse(r.milestones_json); if (Array.isArray(m)) milestones = m; } catch {}
  return { id: r.id, goal: r.goal, current_step: r.current_step, steps, milestones, visual_progress: r.visual_progress, status: r.status, updated_at: r.updated_at };
}
export async function loadActiveJourney(env: JourneyDb, userId: string): Promise<JourneyRow | null> {
  try {
    return await env.DB.prepare("SELECT * FROM journeys WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1").bind(userId).first<JourneyRow>();
  } catch { return null; }
}
export function prevStateFromRow(row: JourneyRow | null): JourneyState | null {
  if (!row) return null;
  let milestones: string[] = [];
  try { const m = JSON.parse(row.milestones_json); if (Array.isArray(m)) milestones = m; } catch {}
  let steps = DEFAULT_JOURNEY_STEPS.map((s) => ({ ...s, status: "locked" as const }));
  try { const p = JSON.parse(row.steps_json); if (Array.isArray(p) && p.length) steps = p; } catch {}
  return { current_step: row.current_step, unlocked_milestones: milestones, visual_progress: row.visual_progress, newly_unlocked: [], inquiry_level: 1, steps, suggested_goal: row.goal };
}
/** Persist derived state: create the active journey on first unlock, else update + append events. */
export async function persistJourneyState(env: JourneyDb, userId: string, state: JourneyState, existing: JourneyRow | null): Promise<string | null> {
  try {
    if (!existing) {
      if (state.unlocked_milestones.length === 0 && !state.suggested_goal) return null;
      const id = generateUUID();
      await env.DB.prepare("INSERT INTO journeys (id, user_id, goal, current_step, steps_json, milestones_json, visual_progress) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, userId, state.suggested_goal, state.current_step, JSON.stringify(state.steps), JSON.stringify(state.unlocked_milestones), state.visual_progress).run();
      for (const m of state.newly_unlocked) {
        await env.DB.prepare("INSERT INTO journey_events (id, journey_id, user_id, milestone, source) VALUES (?, ?, ?, ?, 'derived')").bind(generateUUID(), id, userId, m).run();
      }
      return id;
    }
    await env.DB.prepare("UPDATE journeys SET goal = COALESCE(goal, ?), current_step = ?, steps_json = ?, milestones_json = ?, visual_progress = ?, updated_at = datetime('now') WHERE id = ?").bind(state.suggested_goal, state.current_step, JSON.stringify(state.steps), JSON.stringify(state.unlocked_milestones), state.visual_progress, existing.id).run();
    for (const m of state.newly_unlocked) {
      await env.DB.prepare("INSERT INTO journey_events (id, journey_id, user_id, milestone, source) VALUES (?, ?, ?, ?, 'derived')").bind(generateUUID(), existing.id, userId, m).run();
    }
    return existing.id;
  } catch (e) { console.error("[journeys] persist failed:", e); return existing?.id ?? null; }
}
