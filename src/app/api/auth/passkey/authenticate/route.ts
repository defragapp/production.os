import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  buildAuthenticationOptions,
  completeAuthentication,
  attachSessionCookie,
} from "@/lib/passkeys";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

const AUTH_RATE_LIMIT_TTL = 300;
const AUTH_RATE_LIMIT_MAX = 10;

/**
 * Passkey login. Fully public (no session yet — that's the point). Discoverable
 * credentials mean the user picks their passkey without typing an email.
 */
export async function POST(request: NextRequest) {
  const env = await getEnv();
  try {
    const { requestId, options } = await buildAuthenticationOptions(env, request);
    return NextResponse.json({ requestId, options });
  } catch (e) {
    console.error("[passkey:auth:options]", e);
    return NextResponse.json({ error: "Could not start passkey sign-in." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const env = await getEnv();
  let body: { requestId?: string; response?: AuthenticationResponseJSON };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { requestId, response } = body;
  if (!requestId || !response) {
    return NextResponse.json({ error: "Missing passkey response" }, { status: 400 });
  }

  // Per-IP + per-credential throttle, mirroring the password login route.
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rlKey = `pkauth-rl:${ip}:${response.id}`;
  const count = parseInt((await env.SESSION_KV.get(rlKey)) || "0", 10);
  if (count >= AUTH_RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }
  await env.SESSION_KV.put(rlKey, String(count + 1), { expirationTtl: AUTH_RATE_LIMIT_TTL });

  const result = await completeAuthentication(env, request, requestId, response);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  const hasBaseline = !!(await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?").bind(result.user.userId).first());
  const out = NextResponse.json({ user: { id: result.user.userId, email: result.user.email }, hasBaseline });
  return attachSessionCookie(out, env, result.user);
}
