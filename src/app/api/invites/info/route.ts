import { NextRequest, NextResponse } from "next/server";
import { hashResetToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { loadUser, maskEmail, personName } from "@/lib/connections";
import type { Invite } from "@/lib/types";

export const dynamic = 'force-dynamic';

/**
 * Public-ish status for the /invite accept page. Returns only what the page
 * needs to render — masked email, sender name, role, and lifecycle status.
 */
export async function GET(request: NextRequest) {
  const env = await getEnv();
  const token = request.nextUrl.searchParams.get("token")?.trim() || "";
  if (!token) return NextResponse.json({ status: "invalid" });

  const tokenHash = await hashResetToken(token);
  const invite = await env.DB.prepare("SELECT id, owner_user_id, email, role, status, created_at, expires_at, accepted_at FROM invites WHERE token_hash = ?").bind(tokenHash).first<Invite>();
  if (!invite) return NextResponse.json({ status: "invalid" });

  if (invite.status === "revoked") return NextResponse.json({ status: "revoked" });
  if (invite.status === "accepted") return NextResponse.json({ status: "accepted" });
  if (new Date(invite.expires_at).getTime() < Date.now()) return NextResponse.json({ status: "expired" });

  const owner = await loadUser(env, invite.owner_user_id);
  return NextResponse.json({
    status: "pending",
    emailMasked: maskEmail(invite.email),
    inviterName: owner ? personName(owner) : "Someone",
    role: invite.role,
  });
}