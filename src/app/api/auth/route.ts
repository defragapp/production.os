import { NextRequest, NextResponse } from "next/server";
import { createJWT, generateSalt, generateUUID, hashPassword, verifyJWT, verifyPassword, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import type { User } from "@/lib/types";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ user: null }, { status: 200 });
  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ user: null }, { status: 200 });
  const user = await env.DB.prepare("SELECT id, email, stripe_customer_id, subscription_tier FROM users WHERE id = ?").bind(payload.sub).first<User>();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  const existing = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User & { password_hash: string; password_salt: string }>();
  let userId: string;
  if (existing) {
    const valid = await verifyPassword(password, existing.password_salt, existing.password_hash);
    if (!valid) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    userId = existing.id;
  } else {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    userId = generateUUID();
    await env.DB.prepare("INSERT INTO users (id, email, password_hash, password_salt, subscription_tier) VALUES (?, ?, ?, ?, 'free')").bind(userId, email, passwordHash, salt).run();
    await sendTransactionalEmail(env, { to: email, subject: "Welcome to Sovereign OS", html: `<p>Welcome to Sovereign OS. Complete your baseline (TOB/POB/DOB) to begin.</p>` });
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
