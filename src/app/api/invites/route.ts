import { NextRequest, NextResponse } from "next/server";
import { generateResetToken, hashResetToken, generateUUID } from "@/lib/auth";
import { sendTemplate } from "@/lib/email";
import { recipientMailAllowed } from "@/lib/email-guard";
import {
  getAuthPayload, loadUser, normalizedLabel, maskEmail, personName,
  MAX_PENDING_INVITES, INVITE_TTL_MS, isLapsedInvite,
} from "@/lib/connections";
import { hasPlusEntitlement } from "@/lib/tier";
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

  const invites = await env.DB.prepare(`SELECT id, email, role, invitee_name, status, created_at, expires_at, accepted_at FROM invites WHERE owner_user_id = ? ORDER BY created_at DESC`).bind(payload.sub).all<Pick<Invite, "id" | "email" | "role" | "invitee_name" | "status" | "created_at" | "expires_at" | "accepted_at">>();
  // Emails still backed by a live relationship. Accepted invites to any other
  // address are ghosts — the person connected then deleted their account.
  const peerEmails = new Set<string>();
  try {
    const peers = await env.DB.prepare(
      `SELECT lower(u.email) AS email FROM relationships r JOIN users u ON u.id = CASE WHEN r.user_a = ?1 THEN r.user_b ELSE r.user_a END WHERE r.user_a = ?1 OR r.user_b = ?1`,
    ).bind(payload.sub).all<{ email: string }>();
    for (const p of peers.results ?? []) if (p.email) peerEmails.add(p.email);
  } catch (e) {
    console.error("[invites] peer lookup failed:", e);
  }
  const list = (invites.results ?? []).map((inv) => ({
    id: inv.id,
    emailMasked: maskEmail(inv.email),
    role: inv.role,
    name: inv.invitee_name ?? null,
    status: inv.status,
    lapsed: isLapsedInvite(inv.status, inv.email, peerEmails),
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
  // Invitations are the people (Sovereign+) feature — enforced server-side,
  // through the live resolver so a gifted pass opens the same doors as Stripe.
  if (!(await hasPlusEntitlement(env, user))) {
    return NextResponse.json(
      { error: "Invitations are part of Sovereign+. Upgrade to invite people into your relationships.", code: "plus_required" },
      { status: 403 },
    );
  }

  let body: { email?: string; role?: string; name?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const email = body.email?.trim().toLowerCase() || "";
  if (!isValidEmail(email)) return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  if (email === user.email.toLowerCase()) return NextResponse.json({ error: "You can't invite yourself" }, { status: 400 });
  const role = normalizedLabel(body.role);
  // Who this is for, in the inviter's words ("Mom", "Alex") — used to
  // personalize the email and the share text. Not an identity anchor;
  // the email address stays the one the accept check enforces.
  const inviteeName = body.name?.trim().replace(/\s+/g, " ").slice(0, 80) || null;

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
    "INSERT INTO invites (id, owner_user_id, email, role, invitee_name, token_hash, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
  ).bind(id, payload.sub, email, role, inviteeName, tokenHash, expiresAt).run();

  const origin = new URL(request.url).origin;
  // F-F: the invite and its share link are created either way — a capped
  // recipient simply does not get bombable mail, and the inviter can still
  // share the link directly.
  if (await recipientMailAllowed(env, email)) {
    try {
      await sendTemplate(env, "invite", email, { origin, inviterName: personName(user), role, token, name: inviteeName ?? undefined });
    } catch (e) {
      console.error("[invites] invite email failed:", e);
    }
  } else {
    console.warn("[invites] recipient mail cap reached — invite email skipped");
  }

  return NextResponse.json({
    invite: {
      id,
      emailMasked: maskEmail(email),
      role,
      name: inviteeName,
      status: "pending",
      expiresAt,
      shareUrl: `${origin}/invite?token=${token}`,
    },
  }, { status: 201 });
}