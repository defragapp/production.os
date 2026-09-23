import { NextRequest, NextResponse } from "next/server";
import { generateResetToken, hashResetToken } from "@/lib/auth";
import { getAuthPayload, loadUser, isPlusTier } from "@/lib/connections";
import type { Invite } from "@/lib/types";

export const dynamic = 'force-dynamic';

const INVITE_SELECT = "id, owner_user_id, email, role, status, created_at, expires_at, accepted_at";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const user = await loadUser(env, payload.sub);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPlusTier(user)) {
    return NextResponse.json({ error: "Invitations are part of Sovereign+.", code: "plus_required" }, { status: 403 });
  }

  let body: { action?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (body.action !== "rotate") return NextResponse.json({ error: "Unsupported action" }, { status: 400 });

  const invite = await env.DB.prepare(`SELECT ${INVITE_SELECT} FROM invites WHERE id = ? AND owner_user_id = ?`).bind(id, payload.sub).first<Invite>();
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (invite.status !== "pending") return NextResponse.json({ error: "Only pending invitations can be re-shared" }, { status: 409 });
  if (new Date(invite.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Invitation expired. Revoke it and invite again." }, { status: 410 });

  const token = generateResetToken();
  const tokenHash = await hashResetToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("UPDATE invites SET token_hash = ?, expires_at = ? WHERE id = ?").bind(tokenHash, expiresAt, id).run();

  const origin = new URL(request.url).origin;
  return NextResponse.json({ shareUrl: `${origin}/invite?token=${token}`, expiresAt });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const invite = await env.DB.prepare(`SELECT ${INVITE_SELECT} FROM invites WHERE id = ? AND owner_user_id = ?`).bind(id, payload.sub).first<Invite>();
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

  // Revoking a pending invite voids any unconsumed token. Accepted invites are
  // kept (the connection is live) unless explicitly removed by the user.
  const nextStatus = invite.status === "accepted" ? "accepted" : "revoked";
  await env.DB.prepare("UPDATE invites SET status = ? WHERE id = ?").bind(nextStatus, id).run();
  return NextResponse.json({ ok: true, status: nextStatus });
}