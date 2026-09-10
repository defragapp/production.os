import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { computeNatalPositions, buildAstrologyBaseline } from "@/lib/nasa-jpl";
import { getEnv } from "@/lib/env";
import type { Baseline } from "@/lib/types";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const baseline = await env.DB.prepare("SELECT user_id, tob, pob, dob, nasa_jpl_json_data, created_at, updated_at FROM baselines WHERE user_id = ?").bind(payload.sub).first<Baseline>();
  return NextResponse.json({ baseline });
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { tob?: string; pob?: string; dob?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const { tob, pob, dob } = body;
  if (!tob || !pob || !dob) return NextResponse.json({ error: "TOB, POB, and DOB are required" }, { status: 400 });
  const instant = new Date(`${dob}T${tob}:00Z`);
  if (isNaN(instant.getTime())) return NextResponse.json({ error: "Invalid date/time format" }, { status: 400 });
  let nasaJplData: Record<string, unknown>;
  try {
    const positions = await computeNatalPositions(env, instant);
    const astrology = buildAstrologyBaseline(positions);
    nasaJplData = {
      astrology,
      humanDesign: { type: "Generator", strategy: "To Respond", authority: "Sacral", note: "Human Design requires additional computation from natal positions" },
      geneKeys: { note: "Gene Keys requires additional computation from natal positions" },
      numerology: { lifePath: computeLifePath(dob), birthDay: parseInt(dob.split("-")[2], 10) },
      meta: { tob, pob, dob, computedAt: new Date().toISOString(), source: "NASA/JPL Horizons API", observerCenter: "Earth geocenter 500@399" },
    };
  } catch (err) {
    console.error("[baseline] NASA/JPL computation failed:", err);
    nasaJplData = { error: "NASA/JPL computation failed — stored raw birth data only", meta: { tob, pob, dob, computedAt: new Date().toISOString() } };
  }
  const nasaJplJson = JSON.stringify(nasaJplData);
  await env.DB.prepare(`INSERT INTO baselines (user_id, tob, pob, dob, nasa_jpl_json_data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tob = excluded.tob, pob = excluded.pob, dob = excluded.dob, nasa_jpl_json_data = excluded.nasa_jpl_json_data, updated_at = datetime('now')`).bind(payload.sub, tob, pob, dob, nasaJplJson).run();
  return NextResponse.json({ ok: true, baseline: nasaJplData });
}

function computeLifePath(dob: string): number {
  const digits = dob.replace(/-/g, "").split("").map(Number);
  let sum = digits.reduce((a, b) => a + b, 0);
  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) sum = sum.toString().split("").map(Number).reduce((a, b) => a + b, 0);
  return sum;
}
