import { NextRequest, NextResponse } from "next/server";
import {
  createJWT, generateSalt, generateUUID, hashPassword,
  verifyJWT, verifyPassword, passwordNeedsRehash, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY,
} from "@/lib/auth";
import { sendTransactionalEmail, emailVerificationEnabled, emailShell, emailButton } from "@/lib/email";
import { generateResetToken, hashResetToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { verifyTurnstileToken } from "@/lib/turnstile";
import type { User } from "@/lib/types";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ user: null, turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }, { status: 200 });
  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ user: null, turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }, { status: 200 });
  // Same defensive lookup as /api/chat: stale D1 snapshots may lack the
  // email_verified column. Fall back rather than 500ing the session check.
  let user: User | null;
  try {
    user = await env.DB.prepare("SELECT id, email, stripe_customer_id, subscription_tier, email_verified FROM users WHERE id = ?").bind(payload.sub).first<User>();
  } catch {
    user = await env.DB.prepare("SELECT id, email, stripe_customer_id, subscription_tier FROM users WHERE id = ?").bind(payload.sub).first<User>();
  }
  if (!user) return NextResponse.json({ user: null, turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }, { status: 200 });
  return NextResponse.json({ user, turnstileSiteKey: env.TURNSTILE_SITE_KEY || null });
}

const LOGIN_RATE_LIMIT_TTL = 300;
const LOGIN_RATE_LIMIT_MAX = 10;

export async function POST(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  let body: { email?: string; password?: string; turnstileToken?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const turnstileValid = await verifyTurnstileToken(env, body.turnstileToken);
  if (!turnstileValid) {
    return NextResponse.json({ error: "Security verification failed. Please try again." }, { status: 400 });
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const emailForRl = body.email?.trim().toLowerCase() || "unknown";
  const rlKey = `login-rl:${ip}:${emailForRl}`;
  const rlCount = parseInt((await env.SESSION_KV.get(rlKey)) || "0", 10);
  if (rlCount >= LOGIN_RATE_LIMIT_MAX) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  await env.SESSION_KV.put(rlKey, String(rlCount + 1), { expirationTtl: LOGIN_RATE_LIMIT_TTL });

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (email && !isValidEmail(email)) return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  const existing = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User & { password_hash: string; password_salt: string }>();
  let userId: string;
  if (existing) {
    const valid = await verifyPassword(password, existing.password_salt, existing.password_hash);
    if (!valid) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    userId = existing.id;
    // Upgrade-on-login: silently move legacy (100k-iteration) hashes to the
    // current target (600k) so existing users are re-hashed without an outage.
    if (passwordNeedsRehash(existing.password_hash)) {
      const newSalt = generateSalt();
      const newHash = await hashPassword(password, newSalt);
      try {
        await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?").bind(newHash, newSalt, existing.id).run();
      } catch (e) {
        console.error("[auth] failed to upgrade password hash:", e);
      }
    }
  } else {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    userId = generateUUID();
    await env.DB.prepare("INSERT INTO users (id, email, password_hash, password_salt, subscription_tier) VALUES (?, ?, ?, ?, 'free')").bind(userId, email, passwordHash, salt).run();
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
        const link = `${origin}/api/auth/verify?token=${token}`;
        await sendTransactionalEmail(env, {
          to: email,
          subject: "Verify your email — Sovereign OS",
          html: emailShell(
            "Verify your email",
            `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Welcome to Sovereign OS. Confirm your email address to unlock your baseline and personal AI chat.</p>${emailButton(link, "Verify Email")}<p style="color:#a1a1aa;font-size:13px;margin:12px 0 0">This link expires in 48 hours. If you didn't create an account, you can safely ignore this email.</p>`,
          ),
        });
      } catch (e) {
        console.error("[auth] verification email failed:", e);
      }
    } else {
      await sendTransactionalEmail(env, {
        to: email,
        subject: "Welcome to Sovereign OS",
        html: emailShell(
          "Welcome to Sovereign OS",
          `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Your account is ready. Complete your baseline to begin.</p>${emailButton(`${origin}/onboard`, "Set Your Baseline")}`,
        ),
      });
    }
  }
  const token = await createJWT(userId, email, secret);
  const response = NextResponse.json({ user: { id: userId, email } });
  response.cookies.set(SESSION_COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
  return response;
}

export async function DELETE() {
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
