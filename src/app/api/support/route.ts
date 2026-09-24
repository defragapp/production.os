import { NextRequest, NextResponse } from "next/server";
import { sendTemplate } from "@/lib/email";
import { getEnv, type AppEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const EMAIL_RATE_MAX = 4;
const EMAIL_RATE_WINDOW_MS = 10 * 60 * 1000;
const IP_RATE_MAX = 10;
const IP_RATE_WINDOW_MS = 60 * 60 * 1000;

const MAX_MESSAGE_LENGTH = 6000;
const MAX_NAME_LENGTH = 80;
const MAX_TOPIC_LENGTH = 120;

function isValidEmail(email: string): boolean {
  if (email.length > 254 || email.length < 3) return false;
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !/[a-z0-9.!#$%&'*+/=?^_`{|}~-]/.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((l) => l.length < 1 || l.length > 63 || /^-|-$/.test(l) || /[^a-z0-9-]/.test(l))) return false;
  return true;
}

function clientIp(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

async function verifyTurnstile(env: AppEnv, token: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[support] turnstile verify failed:", err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const env = await getEnv();

  let body: { name?: string; email?: string; topic?: string; message?: string; turnstileToken?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, MAX_NAME_LENGTH);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 254);
  const topic = (body.topic ?? "").trim().slice(0, MAX_TOPIC_LENGTH) || "General";
  const message = (body.message ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "A valid reply email is required so we can get back to you." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "A few words about what's happening helps us help you." }, { status: 400 });
  }

  if (body.turnstileToken && !(await verifyTurnstile(env, body.turnstileToken))) {
    return NextResponse.json({ error: "Security check failed. Please try again." }, { status: 400 });
  }

  const ip = clientIp(request);
  const now = Date.now();
  const limits: Array<[string, number, number]> = [
    [`rl:support-email:${email}`, EMAIL_RATE_MAX, EMAIL_RATE_WINDOW_MS],
    [`rl:support-ip:${ip}`, IP_RATE_MAX, IP_RATE_WINDOW_MS],
  ];
  for (const [key, max, window] of limits) {
    let stamps: number[] = [];
    const raw = await env.SESSION_KV.get(key);
    if (raw) { try { stamps = JSON.parse(raw) as number[]; } catch { stamps = []; } }
    stamps = stamps.filter((t) => now - t < window);
    if (stamps.length >= max) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a bit before sending another." },
        { status: 429 },
      );
    }
    await env.SESSION_KV.put(key, JSON.stringify([...stamps, now]), { expirationTtl: Math.ceil(window / 1000) });
  }

  const operatorInbox = env.SUPPORT_INBOX || env.FROM_EMAIL || "sovereign@defrag.app";
  await sendTemplate(env, "support-notification", operatorInbox, { name, email, topic, message }).catch((err) => {
    console.error("[support] notification send failed:", err);
  });
  await sendTemplate(env, "support-received", email, {}).catch((err) => {
    console.error("[support] ack failed:", err);
  });

  return NextResponse.json({ ok: true });
}