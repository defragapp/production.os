/**
 * Passkey (WebAuthn) server helpers.
 *
 * Design (see docs/auth.md §9):
 * - Passkey-FIRST for return visits, password as the always-available recovery
 *   path. Registration happens only inside an authenticated session, so we
 *   always know who is enrolling and can never orphan a credential.
 * - Challenges are short-lived and stored in KV (single-use), never in a
 *   cookie or the client. Registration keys by user id; authentication keys by
 *   an opaque request id the client echoes back (there is no identity yet at
 *   login time — this is a discoverable-credential flow).
 */
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { createJWT, verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { bufToB64url, b64urlToBuf } from "@/lib/base64url";
import type { AppEnv } from "@/lib/env";

const RP_NAME = "Sovereign OS";
/** Seconds a pending WebAuthn challenge stays valid. */
const CHALLENGE_TTL = 300;

// ── relying-party config, derived from the request host ─────────────────
// The canonical-domain redirect in middleware guarantees this is either
// sovereign.defrag.app (prod) or localhost (dev).
export function rpConfig(request: NextRequest): { rpID: string; origin: string } {
  const url = new URL(request.url);
  return { rpID: url.hostname.replace(/:\d+$/, ""), origin: url.origin };
}

// ── single-use challenge storage in KV ─────────────────────────────────
async function putChallenge(env: AppEnv, key: string, challenge: string): Promise<void> {
  await env.SESSION_KV.put(key, challenge, { expirationTtl: CHALLENGE_TTL });
}

async function takeChallenge(env: AppEnv, key: string): Promise<string | null> {
  const value = await env.SESSION_KV.get(key);
  if (value) await env.SESSION_KV.delete(key);
  return value;
}

// ── authenticated-session lookup (routes are public, so we self-check) ─
export interface SessionUser {
  userId: string;
  email: string;
}

export async function getAuthedUser(request: NextRequest): Promise<SessionUser | null> {
  const env = await (await import("@/lib/env")).getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyJWT(token, secret);
  if (!payload) return null;
  return { userId: payload.sub, email: String(payload.email ?? "") };
}

// ── stored credential CRUD ──────────────────────────────────────────────
interface PasskeyRow {
  credential_id: string;
  user_id: string;
  public_key: string;
  counter: number | null;
  transports: string | null;
}

export async function listCredentialIds(
  env: AppEnv,
  userId: string,
): Promise<{ id: string; transports: AuthenticatorTransportFuture[] }[]> {
  const res = await env.DB.prepare(
    "SELECT credential_id, transports FROM passkeys WHERE user_id = ?",
  )
    .bind(userId)
    .all<Pick<PasskeyRow, "credential_id" | "transports">>();
  return (res.results ?? []).map((r) => ({
    id: r.credential_id,
    transports: parseTransports(r.transports),
  }));
}

function parseTransports(raw: string | null): AuthenticatorTransportFuture[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as AuthenticatorTransportFuture[]) : [];
  } catch {
    return [];
  }
}

// ── registration ceremony ───────────────────────────────────────────────
export async function buildRegistrationOptions(
  env: AppEnv,
  request: NextRequest,
  user: SessionUser,
) {
  const { rpID, origin } = rpConfig(request);
  const excludeCredentials = await listCredentialIds(env, user.userId);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email,
    userDisplayName: user.email,
    userID: new TextEncoder().encode(user.userId),
    attestationType: "none",
    excludeCredentials,
    // Discoverable (resident) + device-bound so login works with no email.
    // preferredAuthenticatorType nudges iOS/Safari to offer the device's own
    // Face ID / Touch ID first, for a native-app feel; userVerification
    // "required" ensures the biometric is actually captured.
    preferredAuthenticatorType: "localDevice",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });
  await putChallenge(env, `pkreg:${user.userId}`, options.challenge);
  return { options, origin, rpID };
}

export async function completeRegistration(
  env: AppEnv,
  request: NextRequest,
  user: SessionUser,
  response: RegistrationResponseJSON,
): Promise<{ ok: true; label: string | null } | { ok: false; error: string }> {
  const { rpID, origin } = rpConfig(request);
  const expectedChallenge = await takeChallenge(env, `pkreg:${user.userId}`);
  if (!expectedChallenge) return { ok: false, error: "Passkey registration expired. Please retry." };
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return { ok: false, error: "Passkey verification failed." };
  }
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: "Passkey verification failed." };
  }
  const { credential } = verification.registrationInfo;
  await env.DB.prepare(
    "INSERT OR REPLACE INTO passkeys (credential_id, user_id, public_key, counter, transports, label, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
  )
    .bind(
      credential.id,
      user.userId,
      bufToB64url(credential.publicKey),
      credential.counter ?? 0,
      JSON.stringify(credential.transports ?? []),
      request.headers.get("user-agent")?.slice(0, 200) ?? null,
    )
    .run();
  return { ok: true, label: request.headers.get("user-agent")?.slice(0, 60) ?? null };
}

// ── authentication ceremony ─────────────────────────────────────────────
export async function buildAuthenticationOptions(env: AppEnv, request: NextRequest) {
  const { rpID } = rpConfig(request);
  const options = await generateAuthenticationOptions({
    rpID,
    // No allowCredentials → the browser offers the user's stored passkeys
    // (discoverable credentials) without needing an email first.
    userVerification: "preferred",
  });
  const requestId = crypto.randomUUID();
  await putChallenge(env, `pkauth:${requestId}`, options.challenge);
  return { requestId, options };
}

export async function completeAuthentication(
  env: AppEnv,
  request: NextRequest,
  requestId: string,
  response: AuthenticationResponseJSON,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const { rpID, origin } = rpConfig(request);
  const [expectedChallenge, row] = await Promise.all([
    takeChallenge(env, `pkauth:${requestId}`),
    env.DB.prepare(
      "SELECT credential_id, user_id, public_key, counter, transports FROM passkeys WHERE credential_id = ?",
    )
      .bind(response.id)
      .first<PasskeyRow>(),
  ]);
  if (!expectedChallenge) return { ok: false, error: "Passkey sign-in expired. Please retry." };
  if (!row) return { ok: false, error: "This passkey is not recognized." };
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: row.credential_id,
        publicKey: b64urlToBuf(row.public_key),
        counter: row.counter ?? 0,
        transports: parseTransports(row.transports),
      },
    });
  } catch {
    return { ok: false, error: "Passkey verification failed." };
  }
  if (!verification.verified) return { ok: false, error: "Passkey verification failed." };
  await env.DB.prepare(
    "UPDATE passkeys SET counter = ?, last_used_at = datetime('now') WHERE credential_id = ?",
  )
    .bind(verification.authenticationInfo.newCounter, row.credential_id)
    .run();
  const email = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(row.user_id).first<{ email: string }>();
  return { ok: true, user: { userId: row.user_id, email: email?.email ?? "" } };
}

// ── session issuance (mirrors /api/auth POST exactly) ───────────────────
export async function attachSessionCookie(
  response: NextResponse,
  env: AppEnv,
  user: SessionUser,
): Promise<NextResponse> {
  const secret = env[JWT_SECRET_ENV_KEY];
  const token = await createJWT(user.userId, user.email, secret);
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
