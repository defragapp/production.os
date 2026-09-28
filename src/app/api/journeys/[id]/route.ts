import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { verifySession } from "@/lib/session";

/** Session gate for the journey-detail route: signature + token_version. */
async function getSessionPayload(request: NextRequest) {
  const env = await getEnv();
  const session = await verifySession(env, request);
  if (!session) return { env, payload: undefined, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse | undefined };
  return { env, payload: session.payload, error: undefined as NextResponse | undefined };
}
import { DEFAULT_JOURNEY_STEPS } from "@/lib/sovereign-journey";
import { rowToView, STEP_TO_MILESTONE, MILESTONE_WEIGHTS, type JourneyRow } from "@/lib/journeys";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["active", "paused", "complete"]);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { env, payload, error } = await getSessionPayload(request);
  if (error || !payload) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await env.DB.prepare("SELECT * FROM journeys WHERE id = ? AND user_id = ?").bind(id, payload.sub).first<JourneyRow>();
  if (!row) return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  const events = await env.DB.prepare("SELECT milestone, source, created_at FROM journey_events WHERE journey_id = ? ORDER BY created_at ASC LIMIT 100").bind(id).all<{ milestone: string; source: string; created_at: string }>();
  return NextResponse.json({ journey: rowToView(row), events: events.results ?? [] });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { env, payload, error } = await getSessionPayload(request);
  if (error || !payload) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await env.DB.prepare("SELECT * FROM journeys WHERE id = ? AND user_id = ?").bind(id, payload.sub).first<JourneyRow>();
  if (!row) return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  let body: { goal?: string; status?: string; current_step?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  // "I'm not there yet": step override restores the step to current and
  // removes its milestone from the unlocked list so progress steps back
  // exactly one notch — the only place progress may decrease, and only by
  // explicit user intent.
  if (typeof body.current_step === "string") {
    const target = DEFAULT_JOURNEY_STEPS.find((s) => s.id === body.current_step);
    if (!target) return NextResponse.json({ error: "Unknown step" }, { status: 400 });
    let milestones: string[] = [];
    try { const m = JSON.parse(row.milestones_json); if (Array.isArray(m)) milestones = m; } catch {}
    const targetIdx = DEFAULT_JOURNEY_STEPS.findIndex((s) => s.id === target.id);
    const laterSteps = new Set(DEFAULT_JOURNEY_STEPS.slice(targetIdx + 1).map((s) => s.id));
    const drop = new Set([...laterSteps].map((s) => STEP_TO_MILESTONE[s]).filter(Boolean));
    const kept = milestones.filter((m) => !drop.has(m));
    const progress = Math.round(kept.reduce((t, m) => t + (MILESTONE_WEIGHTS[m] ?? 0), 0) * 100) / 100;
    const steps = DEFAULT_JOURNEY_STEPS.map((s, i) => ({ ...s, status: i < targetIdx ? "done" as const : i === targetIdx ? "current" as const : "locked" as const }));
    await env.DB.prepare("UPDATE journeys SET current_step = ?, steps_json = ?, milestones_json = ?, visual_progress = ?, updated_at = datetime('now') WHERE id = ?").bind(target.id, JSON.stringify(steps), JSON.stringify(kept), progress, id).run();
    const updated = await env.DB.prepare("SELECT * FROM journeys WHERE id = ?").bind(id).first<JourneyRow>();
    return NextResponse.json({ journey: updated ? rowToView(updated) : null });
  }
  const updates: string[] = [];
  const binds: unknown[] = [];
  if (typeof body.goal === "string") { updates.push("goal = ?"); binds.push(body.goal.trim().slice(0, 200) || null); }
  if (typeof body.status === "string") {
    if (!VALID_STATUS.has(body.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    updates.push("status = ?"); binds.push(body.status);
  }
  if (updates.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  updates.push("updated_at = datetime('now')");
  await env.DB.prepare(`UPDATE journeys SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`).bind(...binds, id, payload.sub).run();
  const updated = await env.DB.prepare("SELECT * FROM journeys WHERE id = ?").bind(id).first<JourneyRow>();
  return NextResponse.json({ journey: updated ? rowToView(updated) : null });
}
