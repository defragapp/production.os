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
    const { options } = await buildRegistrationOptions(env, request, user);
    return NextResponse.json(options);
  } catch (e) {
    console.error("[passkey:register:options]", e);
    return NextResponse.json({ error: "Could not start passkey setup." }, { status: 500 });
  }
}

/** Finish enrollment: verify the attestation and store the credential. */
export async function PUT(request: NextRequest) {
  const env = await getEnv();
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: RegistrationResponseJSON;
  try {
    body = (await request.json()) as RegistrationResponseJSON;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const result = await completeRegistration(env, request, user, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, label: result.label });
}
