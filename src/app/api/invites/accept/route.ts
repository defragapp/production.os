import { NextRequest, NextResponse } from "next/server";
import { hashResetToken, generateUUID } from "@/lib/auth";
import { sendTemplate } from "@/lib/email";
import {
  getAuthPayload, loadUser, personName, maskEmail, orderedPair,
} from "@/lib/connections";
import type { Invite } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { token?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const token = body.token?.trim() || "";
  if (!token) return NextResponse.json({ error: "Invitation token is required" }, { status: 400 });

  const tokenHash = await hashResetToken(token);
  const invite = await env.DB.prepare("SELECT id, owner_user_id, email, role, status, created_at, expires_at, accepted_at FROM invites WHERE token_hash = ?").bind(tokenHash).first<Invite>();
  if (!invite) return NextResponse.json({ error: "This invitation doesn't exist or the link is invalid." }, { status: 404 });

  if (invite.status === "revoked") return NextResponse.json({ error: "This invitation was revoked by the sender." }, { status: 410, statusText: "invite_revoked" });
  if (invite.status === "accepted") return NextResponse.json({ error: "The invitation was already accepted." }, { status: 409, statusText: "invite_already_accepted" });
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This invitation has expired. Ask the sender to invite you again." }, { status: 410, statusText: "invite_expired" });
  }

  const me = await loadUser(env, payload.sub);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.email.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invitation was sent to ${maskEmail(invite.email)}. Sign in with that account to accept it.`, code: "email_mismatch", emailMasked: maskEmail(invite.email) },
      { status: 403 },
    );
  }

  // Both connections are only meaningful once a baseline exists. Until then,
  // hold the invitation so the accept keeps working after the flow completes.
  const has = await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?").bind(payload.sub).first<{ user_id: string }>();
  if (!has) {
    return NextResponse.json(
      { error: "Complete your baseline before accepting. It powers your side of the connection.", code: "baseline_required", token },
      { status: 428 },
    );
  }

  await env.DB.prepare("UPDATE invites SET status = 'accepted', accepted_at = ? WHERE id = ?").bind(new Date().toISOString(), invite.id).run();

  const { userA, userB } = orderedPair(invite.owner_user_id, payload.sub);
  await env.DB.prepare(
    "INSERT INTO relationships (id, user_a, user_b, a_label, b_label, a_share_baseline, b_share_baseline) VALUES (?, ?, ?, ?, ?, 1, 1) ON CONFLICT(user_a, user_b) DO NOTHING",
  ).bind(generateUUID(), userA, userB, invite.role, invite.role).run();

  const owner = await loadUser(env, invite.owner_user_id);
  try {
    if (owner) await sendTemplate(env, "invite-accepted", owner.email, { origin: new URL(request.url).origin, inviteeName: personName(me), role: invite.role });
  } catch (e) {
    console.error("[invites] accept notification email failed:", e);
  }

  return NextResponse.json({ ok: true, person: { name: owner ? personName(owner) : "Your connection", role: invite.role } });
}