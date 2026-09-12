import { NextRequest, NextResponse } from "next/server";
import { JWT_SECRET_ENV_KEY, hashPassword, generateSalt, generateResetToken, hashResetToken } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import type { User } from "@/lib/types";

const RESET_TOKEN_TTL = 30 * 60;
const RATE_LIMIT_TTL = 3600;
const RATE_LIMIT_MAX = 5;

export async function POST(request: NextRequest) {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
  let body: { email?: string; token?: string; newPassword?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  if (body.email && !body.token) {
    const email = body.email.trim().toLowerCase();
    const rlKey = `reset-rl:${email}`;
    const rlCount = parseInt((await env.SESSION_KV.get(rlKey)) || "0", 10);
    if (rlCount >= RATE_LIMIT_MAX) return NextResponse.json({ error: "Too many reset requests. Please try again later." }, { status: 429 });
    await env.SESSION_KV.put(rlKey, String(rlCount + 1), { expirationTtl: RATE_LIMIT_TTL });
    const user = await env.DB.prepare("SELECT id, email FROM users WHERE email = ?").bind(email).first<User>();
    if (user) {
      const token = generateResetToken();
      const tokenHash = await hashResetToken(token);
      await env.SESSION_KV.put(`reset-token:${tokenHash}`, user.id, { expirationTtl: RESET_TOKEN_TTL });
      const origin = new URL(request.url).origin;
      const resetUrl = `${origin}/onboard?reset=${token}`;
      await sendTransactionalEmail(env, { to: email, subject: "Reset your Sovereign OS password", html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#1e293b">Sovereign OS</h2><p>We received a request to reset your password.</p><p><a href="${resetUrl}" style="display:inline-block;background:#1e293b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Reset Password</a></p><p style="color:#64748b;font-size:14px">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p></div>` });
    }
    return NextResponse.json({ ok: true, message: "If an account exists, a reset email has been sent." });
  }

  if (body.token && body.newPassword) {
    if (body.newPassword.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    const tokenHash = await hashResetToken(body.token);
    const userId = await env.SESSION_KV.get(`reset-token:${tokenHash}`);
    if (!userId) return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    await env.SESSION_KV.delete(`reset-token:${tokenHash}`);
    const salt = generateSalt();
    const passwordHash = await hashPassword(body.newPassword, salt);
    await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?").bind(passwordHash, salt, userId).run();
    return NextResponse.json({ ok: true, message: "Password reset successfully" });
  }
  return NextResponse.json({ error: "Provide either { email } or { token, newPassword }" }, { status: 400 });
}
