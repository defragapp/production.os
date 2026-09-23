import { NextRequest, NextResponse } from "next/server";
import { getAuthPayload } from "@/lib/connections";

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { displayName?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const cleaned = (body.displayName ?? "").trim().replace(/\s+/g, " ");
  if (cleaned.length > 60) return NextResponse.json({ error: "Display name must be 60 characters or fewer" }, { status: 400 });

  try {
    await env.DB.prepare("UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?").bind(cleaned || null, payload.sub).run();
  } catch {
    return NextResponse.json({ error: "Display name isn't available yet on this server. Please try again shortly." }, { status: 500 });
  }
  return NextResponse.json({ displayName: cleaned || null });
}