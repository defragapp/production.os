import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { computeNatalPositions, buildAstrologyBaseline } from "@/lib/nasa-jpl";
import { computeHumanDesign } from "@/lib/sovereign-humandesign";
import { getEnv } from "@/lib/env";
import type { AppEnv } from "@/lib/env";
import type { Baseline } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const env = await getEnv();
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
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { tob?: string; pob?: string; dob?: string; tobAccuracy?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const { tob, pob, dob, tobAccuracy } = body;
  if (!pob || !dob) return NextResponse.json({ error: "Date of birth and place of birth are required" }, { status: 400 });

  // Exact time, or an approximation for people who don't know it. These map to
  // representative local times; the derivation is built on tendencies, and the
  // approximation is carried into the AI context so it stays honest about it.
  const TOB_BUCKETS: Record<string, string> = {
    morning: "09:00",
    noon: "12:00",
    afternoon: "15:00",
    evening: "19:00",
    night: "22:00",
    unknown: "12:00",
  };
  if (tobAccuracy && tobAccuracy !== "exact") {
    const effective = TOB_BUCKETS[tobAccuracy];
    if (!effective) return NextResponse.json({ error: "That time approximation isn't recognized. Choose one of the options or your exact time." }, { status: 400 });
    if (!tob) return NextResponse.json({ error: "Choose a time window (or your exact time) to continue." }, { status: 400 });
    const instant = new Date(`${dob}T${effective}:00Z`);
    if (isNaN(instant.getTime())) return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    return storeBaseline(env, payload.sub, { tobStored: tob, pob, dob, instant, timePrecision: "approximate", tobAccuracy });
  }
  if (!tob) return NextResponse.json({ error: "Time of birth is required, or choose 'I don't know it' for an approximation" }, { status: 400 });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(tob)) return NextResponse.json({ error: "Time of birth must be a valid 24-hour time (HH:MM)" }, { status: 400 });
  const instant = new Date(`${dob}T${tob}:00Z`);
  if (isNaN(instant.getTime())) return NextResponse.json({ error: "Invalid date/time format" }, { status: 400 });
  return storeBaseline(env, payload.sub, { tobStored: tob, pob, dob, instant, timePrecision: "exact", tobAccuracy: "exact" });
}

async function storeBaseline(
  env: AppEnv,
  userId: string,
  opts: { tobStored: string; pob: string; dob: string; instant: Date; timePrecision: "exact" | "approximate"; tobAccuracy: string },
) {
  const { tobStored, pob, dob, instant, timePrecision, tobAccuracy } = opts;
  let nasaJplData: Record<string, unknown>;
  try {
    const positions = await computeNatalPositions(env, instant);
    const astrology = buildAstrologyBaseline(positions);
    const humanDesign = computeHumanDesign(positions);
    nasaJplData = {
      astrology,
      humanDesign,
      geneKeys: {
        keys: humanDesign.geneKeys,
        note: "Gene Keys frequencies by line: Shadow (1–2), Gift (3–4), Siddhi (5–6).",
      },
      numerology: { lifePath: computeLifePath(dob), birthDay: parseInt(dob.split("-")[2], 10) },
      meta: {
        tob: tobStored,
        effectiveTob: `${String(instant.getUTCHours()).padStart(2, "0")}:${String(instant.getUTCMinutes()).padStart(2, "0")}`,
        tobAccuracy,
        timePrecision,
        pob,
        dob,
        computedAt: new Date().toISOString(),
        source: "NASA/JPL Horizons API",
        observerCenter: "Earth geocenter 500@399",
      },
    };
  } catch (err) {
    console.error("[baseline] NASA/JPL computation failed:", err);
    nasaJplData = { error: "NASA/JPL computation failed — stored raw birth data only", meta: { tob: tobStored, effectiveTob: `${String(instant.getUTCHours()).padStart(2, "0")}:${String(instant.getUTCMinutes()).padStart(2, "0")}`, tobAccuracy, timePrecision, pob, dob, computedAt: new Date().toISOString() } };
  }
  const nasaJplJson = JSON.stringify(nasaJplData);
  await env.DB.prepare(`INSERT INTO baselines (user_id, tob, pob, dob, nasa_jpl_json_data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tob = excluded.tob, pob = excluded.pob, dob = excluded.dob, nasa_jpl_json_data = excluded.nasa_jpl_json_data, updated_at = datetime('now')`).bind(userId, tobStored, pob, dob, nasaJplJson).run();
  return NextResponse.json({ ok: true, baseline: nasaJplData });
}

function computeLifePath(dob: string): number {
  const digits = dob.replace(/-/g, "").split("").map(Number);
  let sum = digits.reduce((a, b) => a + b, 0);
  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) sum = sum.toString().split("").map(Number).reduce((a, b) => a + b, 0);
  return sum;
}
