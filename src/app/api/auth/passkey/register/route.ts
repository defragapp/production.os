import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  getAuthedUser,
  buildRegistrationOptions,
  completeRegistration,
} from "@/lib/passkeys";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

/**
 * Start passkey enrollment. These routes live under /api/auth/ (public in
 * middleware) but enrollment is only meaningful for a signed-in user, so we
 * verify the session here and 401 otherwise.
 */
export async function POST(request: NextRequest) {
  const env = await getEnv();
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { options, requestId } = await buildRegistrationOptions(env, request, user);
    // The requestId names THIS ceremony's challenge slot; the client echoes it
    // back on PUT so concurrent registrations never read or consume each
    // other's challenge.
    return NextResponse.json({ ...options, requestId });
  } catch (e) {
    console.error("[passkey:register:options]", e);
    return NextResponse.json({ error: "Couldn't start passkey setup — try again in a moment." }, { status: 500 });
  }
}

/** Finish enrollment: verify the attestation and store the credential. */
export async function PUT(request: NextRequest) {
  const env = await getEnv();
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: RegistrationResponseJSON & { requestId?: string };
  try {
    body = (await request.json()) as RegistrationResponseJSON & { requestId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { requestId, ...response } = body;
  if (!requestId) return NextResponse.json({ error: "Couldn't verify that passkey setup — start it again." }, { status: 400 });
  const result = await completeRegistration(env, request, user, requestId, response);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, label: result.label });
}
