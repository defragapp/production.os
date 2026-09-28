import { NextRequest, NextResponse } from "next/server";
import { generateUUID } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { verifySession } from "@/lib/session";

/** Session gate for journey routes: verifies signature + token_version in one place. */
async function getSessionPayload(request: NextRequest) {
  const env = await getEnv();
  const session = await verifySession(env, request);
  if (!session) return { env, payload: undefined, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse | undefined };
  return { env, payload: session.payload, error: undefined as NextResponse | undefined };
}
import { DEFAULT_JOURNEY_STEPS } from "@/lib/sovereign-journey";
import { rowToView, type JourneyRow } from "@/lib/journeys";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 20;

export async function GET(request: NextRequest) {
  const { env, payload, error } = await getSessionPayload(request);
  if (error || !payload) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await env.DB.prepare(
    "SELECT * FROM journeys WHERE user_id = ? AND status != 'complete' ORDER BY updated_at DESC LIMIT ?"
  ).bind(payload.sub, LIST_LIMIT).all<JourneyRow>();
  return NextResponse.json({ journeys: (rows.results ?? []).map(rowToView) });
}

export async function POST(request: NextRequest) {
  const { env, payload, error } = await getSessionPayload(request);
  if (error || !payload) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { goal?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 200) : null;
  const existing = await env.DB.prepare(
    "SELECT id FROM journeys WHERE user_id = ? AND status = 'active' LIMIT 1"
  ).bind(payload.sub).first<{ id: string }>();
  if (existing) return NextResponse.json({ error: "You already have an active journey — pause or complete it first.", code: "journey_active", journeyId: existing.id }, { status: 409 });
  const id = generateUUID();
  const steps = DEFAULT_JOURNEY_STEPS.map((s, i) => ({ ...s, status: i === 0 ? "current" : "locked" }));
  await env.DB.prepare(
    "INSERT INTO journeys (id, user_id, goal, current_step, steps_json, milestones_json, visual_progress) VALUES (?, ?, ?, ?, ?, '[]', 0)"
  ).bind(id, payload.sub, goal, DEFAULT_JOURNEY_STEPS[0].id, JSON.stringify(steps)).run();
  const row = await env.DB.prepare("SELECT * FROM journeys WHERE id = ?").bind(id).first<JourneyRow>();
  return NextResponse.json({ journey: row ? rowToView(row) : null }, { status: 201 });
}
