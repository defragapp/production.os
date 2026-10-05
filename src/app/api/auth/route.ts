import { NextRequest, NextResponse } from "next/server";
import {
  createJWT, generateSalt, generateUUID, hashPassword,
  verifyPassword, passwordNeedsRehash, PBKDF2_ITERATIONS, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY, tokenVersionOf,
} from "@/lib/auth";
import { sendTemplate, emailVerificationEnabled } from "@/lib/email";
import { generateResetToken, hashResetToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { bumpTokenVersion, verifySession } from "@/lib/session";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { syncStripeTier } from "@/lib/stripe";
import { FREE_TIER_DAILY_LIMIT } from "@/lib/limits";
import { readUsage } from "@/lib/usage";
import { CURRENT_TERMS_VERSION, termsNeedReaccept } from "@/lib/terms";
import { resolveTier } from "@/lib/tier";
import type { User } from "@/lib/types";

export async function GET(request: NextRequest) {
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });

  // This route is public on purpose — it is the session probe every page calls —
  // so it cannot lean on the middleware gate and must make the whole check
  // itself, including the token_version (revocation) comparison. A signature-only
  // check would keep reporting a live session for a cookie that was just revoked.
  const signedOut = { user: null, turnstileSiteKey: env.TURNSTILE_SITE_KEY || null };
  const session = await verifySession(env, request);
  if (!session) return NextResponse.json(signedOut, { status: 200 });
  const payload = session.payload;
  // Same defensive lookup as /api/chat: stale D1 snapshots may lack the
  // email_verified column. Fall back rather than 500ing the session check.
  let user: User | null;
  try {
    user = await env.DB.prepare("SELECT id, email, stripe_customer_id, subscription_tier, email_verified, display_name, memory_mode, gift_expires_at, created_at, terms_version FROM users WHERE id = ?").bind(payload.sub).first<User>();
  } catch {
    try {
      user = await env.DB.prepare("SELECT id, email, stripe_customer_id, subscription_tier, email_verified, created_at FROM users WHERE id = ?").bind(payload.sub).first<User>();
    } catch {
      user = await env.DB.prepare("SELECT id, email, stripe_customer_id, subscription_tier, created_at FROM users WHERE id = ?").bind(payload.sub).first<User>();
    }
  }
  if (!user) return NextResponse.json({ user: null, turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }, { status: 200 });

  // The single tier truth: owner elevation, live gift passes, and lapsed-pass
  // reversion all resolve here (and self-heal the stored column), so every
  // surface that reads this probe sees the effective tier — not the cache.
  const tierInfo = await resolveTier(env, user);
  user.subscription_tier = tierInfo.tier;

  // Webhook-loss reconciliation: if Stripe is configured and we have a customer
  // id, occasionally (≤ 1×/6h) verify the stored tier against Stripe's live
  // subscriptions. Self-heals a dropped customer.subscription.deleted so a
  // lapsed subscriber stops seeing Sovereign+ on their next session. Bounded by
  // a KV stamp to keep the hot session-check path cheap.
  if (user.stripe_customer_id && env.STRIPE_SECRET_KEY) {
    const syncKey = `tier-sync:${user.id}`;
    if (!(await env.SESSION_KV.get(syncKey))) {
      await env.SESSION_KV.put(syncKey, "1", { expirationTtl: 6 * 60 * 60 });
      const synced = await syncStripeTier(env, user.id, user.stripe_customer_id);
      if (synced !== user.subscription_tier) user.subscription_tier = synced;
    }
  }

  const hasBaseline = !!(await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?").bind(payload.sub).first());
  // Daily AI usage for the UI (free tier only — the gauge and the upgrade
  // banner are the only consumers, and both are inert when limit is null).
  // Read from the same D1 counter /api/chat enforces against, so the gauge can
  // never disagree with the gate.
  const isFree = user.subscription_tier === "free";
  const usage = { used: isFree ? await readUsage(env, payload.sub) : 0, limit: isFree ? FREE_TIER_DAILY_LIMIT : null };
  // Newest undismissed transit nudge within the last 72h (Turn 10). The daily
  // cron enqueues at most one per user per UTC day; this surfaces the freshest
  // one for the front-end's quiet nudge affordance. Read defensively — a
  // pre-migration D1 with no `nudge` table must never 500 the session probe,
  // which every page calls. A miss simply means "no nudge right now".
  let nudge: { id: string; text: string; kind: string } | null = null;
  try {
    const nudgeRow = await env.DB.prepare(
      "SELECT id, text, kind FROM nudge WHERE user_id = ? AND dismissed_at IS NULL AND created_at >= datetime('now','-72 hours') ORDER BY created_at DESC LIMIT 1",
    ).bind(payload.sub).first<{ id: string; text: string; kind: string }>();
    nudge = nudgeRow ? { id: nudgeRow.id, text: nudgeRow.text, kind: nudgeRow.kind } : null;
  } catch (e) {
    console.error("[auth] nudge read failed:", e);
    nudge = null;
  }
  return NextResponse.json({
    user,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
    usage,
    hasBaseline,
    nudge,
    // Terms state for the in-app re-acceptance gate (see <TermsGate /> and
    // POST /api/auth/accept-terms). null/undefined `stored` is treated as
    // “not yet applicable” and never triggers the modal — the login path
    // backfills it silently.
    terms: {
      stored: user.terms_version ?? null,
      current: CURRENT_TERMS_VERSION,
      needsReaccept: termsNeedReaccept(user.terms_version),
    },
    // Effective-entitlement detail for the account/upgrade surfaces: a gifted
    // pass reads as Sovereign+ (with its expiry) but is not a paid subscription.
    tier: {
      tier: tierInfo.tier,
      paid: tierInfo.paid,
      isOwner: tierInfo.isOwner,
      giftActive: tierInfo.giftActive,
      giftExpiresAt: tierInfo.giftExpiresAt,
    },
  });
}

const LOGIN_RATE_LIMIT_TTL = 300;
const LOGIN_RATE_LIMIT_MAX = 10;

/**
 * IP-only guard on account *creation*. The ip+email limiter below is defeated
 * by simply rotating the email address — which is the exact shape of signup
 * abuse (mass account creation, and verification-email bombing against third
 * parties). Applied to signup only, never to sign-in, so a shared network
 * (office, campus, carrier NAT) can never lock a household out of its accounts.
 */
const SIGNUP_IP_RATE_LIMIT_TTL = 3600;
const SIGNUP_IP_RATE_LIMIT_MAX = 6;

export async function POST(request: NextRequest) {
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  let body: { email?: string; password?: string; turnstileToken?: string; intent?: string; termsAccepted?: boolean; termsVersion?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  // Turnstile guards account *creation* (signup) — that's where bot spam is a
  // real threat. Sign-in is already protected by the password check, the
  // IP+email rate limiter below, and email verification, so a widget that fails
  // to load (ad-blocker, iOS-Safari ITP, strict network) or an expired token
  // must never dead-end a returning user. Skip the check entirely for login.
  const intent = body.intent === "login" ? "login" : "signup";
  // Provable clickwrap (Terms §1/§3): account creation is refused unless the
  // payload explicitly affirms acceptance — the UI checkbox alone is not the
  // gate; a curl client without `termsAccepted: true` cannot open an account.
  // Checked first, before the Turnstile round-trip: consent is the front door,
  // and a request that withholds it should never spend a siteverify call.
  if (intent !== "login" && body.termsAccepted !== true) {
    return NextResponse.json({ error: "You must confirm you are at least 18 and agree to the Terms of Service and Privacy Policy to create an account." }, { status: 400 });
  }
  if (intent !== "login") {
    const turnstileValid = await verifyTurnstileToken(env, body.turnstileToken);
    if (!turnstileValid) {
      return NextResponse.json({ error: "That security check didn't go through — try again in a moment." }, { status: 400 });
    }
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const emailForRl = body.email?.trim().toLowerCase() || "unknown";
  const rlKey = `login-rl:${ip}:${emailForRl}`;
  const rlCount = parseInt((await env.SESSION_KV.get(rlKey)) || "0", 10);
  if (rlCount >= LOGIN_RATE_LIMIT_MAX) return NextResponse.json({ error: "Too many attempts — try again in a few minutes." }, { status: 429 });
  await env.SESSION_KV.put(rlKey, String(rlCount + 1), { expirationTtl: LOGIN_RATE_LIMIT_TTL });

  if (intent !== "login") {
    const signupKey = `signup-ip-rl:${ip}`;
    const signupCount = parseInt((await env.SESSION_KV.get(signupKey)) || "0", 10);
    if (signupCount >= SIGNUP_IP_RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Too many accounts have been created from this network today. Try again later, or contact us and we'll sort it out." },
        { status: 429 },
      );
    }
    await env.SESSION_KV.put(signupKey, String(signupCount + 1), { expirationTtl: SIGNUP_IP_RATE_LIMIT_TTL });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const pepper = env.PASSWORD_PEPPER;
  if (email && !isValidEmail(email)) return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  // (Clickwrap affirmation was already required above, before Turnstile.)
  const existing = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User & { password_hash: string; password_salt: string; token_version?: number | null }>();
  // Explicit sign-in must never provision an account. Without this, a "Sign In"
  // submit for an unknown (or just-deleted) email silently created one and
  // signed the visitor in as its owner.
  if (!existing && body.intent === "login") {
    return NextResponse.json({ error: "No account found for this email. Create your account to get started." }, { status: 401 });
  }
  let userId: string;
  if (existing) {
    const valid = await verifyPassword(password, existing.password_salt, existing.password_hash, pepper);
    if (!valid) {
      // A wrong password during *signup* isn't an "invalid login" — the account
      // exists and the person just picked a password that doesn't match it.
      // Say so plainly and point at the way out (sign in / forgot password),
      // instead of a message that reads like their credentials were rejected.
      if (intent === "signup") {
        return NextResponse.json({ error: "An account with this email already exists — sign in with your password, or use Forgot password to set a new one." }, { status: 409 });
      }
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    userId = existing.id;
    // Legacy accounts predating clickwrap carry no receipt. Signing in under
    // the Terms' continued-use clause stamps the current version, so every
    // active account's consent becomes provable in D1 over time. One guarded
    // write per account, on the cold login path only.
    if (existing.terms_version === undefined || existing.terms_version === null) {
      try {
        await env.DB.prepare("UPDATE users SET terms_version = ?, terms_accepted_at = datetime('now') WHERE id = ? AND terms_version IS NULL").bind(CURRENT_TERMS_VERSION, existing.id).run();
      } catch (e) {
        // Pre-migration databases have no column; the login must never fail for it.
        console.error("[auth] terms receipt backfill failed:", e);
      }
    }
    // Upgrade-on-login: silently move hashes that predate the current policy
    // (legacy raw hex, sub-target iterations, or un-peppered) to the current
    // peppered 100k form, so accounts harden without an outage or password reset.
    if (passwordNeedsRehash(existing.password_hash, PBKDF2_ITERATIONS, !!pepper)) {
      const newSalt = generateSalt();
      const newHash = await hashPassword(password, newSalt, PBKDF2_ITERATIONS, pepper);
      try {
        await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?").bind(newHash, newSalt, existing.id).run();
      } catch (e) {
        console.error("[auth] failed to upgrade password hash:", e);
      }
    }
  } else {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt, PBKDF2_ITERATIONS, pepper);
    userId = generateUUID();
    await env.DB.prepare("INSERT INTO users (id, email, password_hash, password_salt, subscription_tier, terms_version, terms_accepted_at) VALUES (?, ?, ?, ?, 'free', ?, datetime('now'))").bind(userId, email, passwordHash, salt, typeof body.termsVersion === "string" && body.termsVersion ? body.termsVersion : CURRENT_TERMS_VERSION).run();
    const origin = new URL(request.url).origin;
    // Verification email (only when mail delivery is actually configured —
    // otherwise the flow is disabled and nothing is gated).
    if (emailVerificationEnabled(env)) {
      // Retention: opportunistically purge expired verification tokens.
      try {
        await env.DB.prepare("UPDATE users SET verification_token = NULL, verification_expires = NULL WHERE verification_expires IS NOT NULL AND verification_expires < ?").bind(new Date().toISOString()).run();
      } catch {}
      try {
        const token = generateResetToken();
        const tokenHash = await hashResetToken(token);
        const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare("UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?").bind(tokenHash, expires, userId).run();
        await sendTemplate(env, "verify", email, { origin, token });
      } catch (e) {
        console.error("[auth] verification email failed:", e);
      }
    } else {
      await sendTemplate(env, "welcome", email, { origin });
    }
  }
  // Carry the account's live session generation into the new cookie. A token
  // minted at a stale version would fail its own revocation check; a new
  // account starts at the column default of 1. Normalising through
  // `tokenVersionOf` keeps the minted claim byte-identical to what the verifier
  // will compute for it.
  const tokenVersion = tokenVersionOf({ tv: existing?.token_version ?? undefined });
  const token = await createJWT(userId, email, secret, tokenVersion);
  const hasBaseline = !!(await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?").bind(userId).first());
  const response = NextResponse.json({ user: { id: userId, email }, hasBaseline });
  response.cookies.set(SESSION_COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
  return response;
}

/**
 * Sign out.
 *
 * Clearing the cookie only affects the device that asked; the signed token
 * itself stays valid everywhere else until it expires. So sign-out also rotates
 * the account's session generation, which invalidates every cookie issued
 * before this moment — including a copy an attacker may be holding.
 */
export async function DELETE(request: NextRequest) {
  const env = await getEnv();
  const session = await verifySession(env, request);
  if (session) await bumpTokenVersion(env, session.payload.sub);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

function isValidEmail(email: string): boolean {
  if (email.length < 3 || email.length > 254) return false;
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !/[a-z0-9.!#$%&'*+/=?^_`{|}~-]/.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((l) => l.length < 1 || l.length > 63 || /^-|-$/.test(l) || /[^a-z0-9-]/.test(l))) return false;
  return true;
}
