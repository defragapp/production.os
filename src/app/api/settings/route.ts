import { NextRequest, NextResponse } from "next/server";
import { getAuthPayload } from "@/lib/connections";
import type { MemoryMode } from "@/lib/types";

export const dynamic = 'force-dynamic';

/** The settings surface the /settings page reads on load. memory_mode is
 *  selected defensively: a pre-migration D1 snapshot lacks the column, and a
 *  failed read here must not take the whole page (or display_name) offline. */
export async function GET(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let memoryMode: MemoryMode = "server";
  try {
    const row = await env.DB.prepare("SELECT memory_mode FROM users WHERE id = ?").bind(payload.sub).first<{ memory_mode: string | null }>();
    if (row?.memory_mode === "local") memoryMode = "local";
  } catch {}
  return NextResponse.json({ memoryMode });
}

export async function PATCH(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { displayName?: string; memoryMode?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const cleaned = (body.displayName ?? "").trim().replace(/\s+/g, " ");
  if (cleaned.length > 60) return NextResponse.json({ error: "Display name must be 60 characters or fewer" }, { status: 400 });

  // One field per PATCH — the page saves each control independently, so an
  // absent key means "leave it alone", not "clear it".
  if (body.displayName !== undefined) {
    try {
      await env.DB.prepare("UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?").bind(cleaned || null, payload.sub).run();
    } catch {
      return NextResponse.json({ error: "Display name isn't available yet on this server. Please try again shortly." }, { status: 500 });
    }
  }

  if (body.memoryMode !== undefined) {
    if (body.memoryMode !== "server" && body.memoryMode !== "local") {
      return NextResponse.json({ error: "Memory mode must be 'server' or 'local'" }, { status: 400 });
    }
    try {
      await env.DB.prepare("UPDATE users SET memory_mode = ?, updated_at = datetime('now') WHERE id = ?").bind(body.memoryMode, payload.sub).run();
    } catch {
      // Pre-migration databases have no column to write — say so plainly
      // rather than pretending the preference landed.
      return NextResponse.json({ error: "Memory mode isn't available yet on this server. Please try again shortly." }, { status: 500 });
    }
  }

  return NextResponse.json({ displayName: cleaned || null, memoryMode: body.memoryMode ?? null });
}