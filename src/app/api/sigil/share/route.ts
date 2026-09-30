import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { verifySession } from "@/lib/session";
import { loadUser } from "@/lib/connections";
import {
  SIGIL_INTENTS,
  getSigilIntent,
  deriveSigilSeed,
  encodeSigilToken,
  sigilSentence,
} from "@/lib/sigil";

export const dynamic = "force-dynamic";

/**
 * Mint a shareable Intent Sigil. Stateless by design: the returned link encodes
 * the crest itself (intent + a one-way Baseline seed + optional first name), so
 * no row is written and no table is touched. Requires a signed-in user because
 * the crest is seeded from their Baseline and, if they choose, their name.
 */
export async function POST(request: NextRequest) {
  const env = await getEnv();
  const session = await verifySession(env, request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.payload.sub;

  let body: { intent?: string; includeName?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const intent = getSigilIntent(typeof body.intent === "string" ? body.intent : undefined);
  if (!intent) {
    return NextResponse.json(
      { error: "Choose one of the available states.", available: SIGIL_INTENTS.map((i) => i.id) },
      { status: 400 },
    );
  }

  // Seed from the Baseline when present, always salted with the account id so a
  // missing (or JPL-degraded/empty) Baseline still draws a personal, distinct
  // crest rather than one shape shared by everyone with nothing on file.
  const baselineRow = await env.DB
    .prepare("SELECT nasa_jpl_json_data FROM baselines WHERE user_id = ?")
    .bind(userId)
    .first<{ nasa_jpl_json_data: string | null }>();
  let baseline: unknown = null;
  if (baselineRow?.nasa_jpl_json_data) {
    try {
      baseline = JSON.parse(baselineRow.nasa_jpl_json_data);
    } catch {
      baseline = null;
    }
  }
  const seed = deriveSigilSeed(baseline, userId);

  // Publishing a name is strictly opt-in, and only the display name the person
  // chose is ever used — never the email local-part, which signup leaves as the
  // only stored name and would otherwise leak a private address onto a public card.
  const includeName = body.includeName === true;
  let name: string | undefined;
  if (includeName) {
    const user = await loadUser(env, userId);
    const display = user?.display_name?.trim();
    if (display) name = display;
  }

  const token = encodeSigilToken({ intent, seed, name });
  const origin = new URL(request.url).origin;
  const url = `${origin}/s/${token}`;

  return NextResponse.json(
    {
      token,
      url,
      seed,
      intent: intent.id,
      label: intent.label,
      sentence: sigilSentence({ intent, seed, name }),
    },
    { status: 201 },
  );
}
