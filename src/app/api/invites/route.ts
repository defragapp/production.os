import { NextRequest, NextResponse } from "next/server";
import { generateResetToken, hashResetToken, generateUUID } from "@/lib/auth";
import { sendTemplate } from "@/lib/email";
import {
  getAuthPayload, loadUser, isPlusTier, normalizedLabel, maskEmail, personName,
  MAX_PENDING_INVITES, INVITE_TTL_MS,
} from "@/lib/connections";
import type { Invite } from "@/lib/types";

export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invites = await env.DB.prepare(`SELECT id, email, role, status, created_at, expires_at, accepted_at FROM invites WHERE owner_user_id = ? ORDER BY created_at DESC`).bind(payload.sub).all<Pick<Invite, "id" | "email" | "role" | "status" | "created_at" | "expires_at" | "accepted_at">>();
  const list = (invites.results ?? []).map((inv) => ({
    id: inv.id,
    emailMasked: maskEmail(inv.email),
    role: inv.role,
    status: inv.status,
    createdAt: inv.created_at,
    expiresAt: inv.expires_at,
    acceptedAt: inv.accepted_at,
  }));
  return NextResponse.json({ invites: list });
}

export async function POST(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await loadUser(env, payload.sub);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Invitations are the people (Sovereign+) feature — enforced server-side.
  if (!isPlusTier(user)) {
    return NextResponse.json(
      { error: "Invitations are part of Sovereign+. Upgrade to invite people into your relationships.", code: "plus_required" },
      { status: 403 },
    );
  }

  let body: { email?: string; role?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const email = body.email?.trim().toLowerCase() || "";
  if (!isValidEmail(email)) return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  if (email === user.email.toLowerCase()) return NextResponse.json({ error: "You can't invite yourself" }, { status: 400 });
  const role = normalizedLabel(body.role);

  const pending = await env.DB.prepare("SELECT COUNT(*) AS total FROM invites WHERE owner_user_id = ? AND status = 'pending'").bind(payload.sub).first<{ total: number }>();
  if ((pending?.total ?? 0) >= MAX_PENDING_INVITES) {
    return NextResponse.json({ error: "Too many pending invitations. Accept one or revoke one before inviting again." }, { status: 409 });
  }

  const existing = await env.DB.prepare("SELECT id FROM invites WHERE owner_user_id = ? AND email = ? AND status = 'pending'").bind(payload.sub, email).first<{ id: string }>();
  if (existing) return NextResponse.json({ error: "A pending invitation already exists for this email." }, { status: 409 });

  const token = generateResetToken();
  const tokenHash = await hashResetToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const id = generateUUID();
  await env.DB.prepare(
    "INSERT INTO invites (id, owner_user_id, email, role, token_hash, status, expires_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
  ).bind(id, payload.sub, email, role, tokenHash, expiresAt).run();

  const origin = new URL(request.url).origin;
  try {
    await sendTemplate(env, "invite", email, { origin, inviterName: personName(user), role, token });
  } catch (e) {
    console.error("[invites] invite email failed:", e);
  }

  return NextResponse.json({
    invite: {
      id,
      emailMasked: maskEmail(email),
      role,
      status: "pending",
      expiresAt,
      shareUrl: `${origin}/invite?token=${token}`,
    },
  }, { status: 201 });
}