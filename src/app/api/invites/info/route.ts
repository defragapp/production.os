import { NextRequest, NextResponse } from "next/server";
import { hashResetToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { loadUser, maskEmail, personName, tokenFromPost } from "@/lib/connections";
import type { Invite } from "@/lib/types";

export const dynamic = 'force-dynamic';

/**
 * Public-ish status for the /invite accept page. Returns only what the page
 * needs to render — masked email, sender name, role, and lifecycle status.
 *
 * POST (not GET-with-?token=): the invite page is a client-issued caller, so the
 * one-time token belongs in the JSON body rather than the request line/query,
 * where it would appear in Workers Logs and intermediary URL logs. The token is
 * additionally hashed (`hashResetToken`) before it is ever matched against the
 * stored row. See `tokenFromPost` in @/lib/connections and docs/auth.md.
 */
export async function POST(request: NextRequest) {
  const env = await getEnv();
  const token = await tokenFromPost(request);
  if (!token) return NextResponse.json({ status: "invalid" });

  const tokenHash = await hashResetToken(token);
  const invite = await env.DB.prepare("SELECT id, owner_user_id, email, role, invitee_name, status, created_at, expires_at, accepted_at FROM invites WHERE token_hash = ?").bind(tokenHash).first<Invite>();
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
    name: invite.invitee_name ?? null,
  });
}