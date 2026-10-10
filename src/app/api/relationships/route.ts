import { NextRequest, NextResponse } from "next/server";
import {
  getAuthPayload, loadUser, relationshipViews, normalizedLabel, RelationshipRow,
} from "@/lib/connections";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await loadUser(env, payload.sub);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const views = await relationshipViews(env, me);
  return NextResponse.json({ relationships: views });
}

export async function PATCH(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await loadUser(env, payload.sub);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { myLabel?: string; shareBaseline?: boolean; shareHistory?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const row = await env.DB.prepare("SELECT id, user_a, user_b, a_label, b_label, a_share_baseline, b_share_baseline, a_share_history, b_share_history, created_at FROM relationships WHERE id = ?").bind(request.nextUrl.searchParams.get("id") ?? "").first<RelationshipRow>();
  if (!row) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  const iAmA = row.user_a === me.id;
  if (!iAmA && row.user_b !== me.id) return NextResponse.json({ error: "Not your connection" }, { status: 403 });

  // A single PATCH may set the label and/or the baseline-share flag and/or the
  // history-share flag, always on the CALLER's own side (a_* when user_a else b_*).
  // Build the SET list from whichever fields are present so partial updates work.
  const prefix = iAmA ? "a_" : "b_";
  const sets: string[] = [];
  const binds: Array<string | number> = [];

  const label = body.myLabel !== undefined ? normalizedLabel(body.myLabel, iAmA ? row.a_label : row.b_label) : null;
  if (label !== null) { sets.push(`${prefix}label = ?`); binds.push(label); }
  if (body.shareBaseline !== undefined) { sets.push(`${prefix}share_baseline = ?`); binds.push(body.shareBaseline ? 1 : 0); }
  if (body.shareHistory !== undefined) { sets.push(`${prefix}share_history = ?`); binds.push(body.shareHistory ? 1 : 0); }

  if (sets.length > 0) {
    // `created_at = created_at` keeps the row's timestamp untouched (explicit no-op).
    sets.push("created_at = created_at");
    await env.DB.prepare(`UPDATE relationships SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, row.id).run();
  }

  const views = await relationshipViews(env, me);
  return NextResponse.json({ relationship: views.find((v) => v.id === row.id) });
}

export async function DELETE(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  const row = await env.DB.prepare("SELECT id, user_a, user_b FROM relationships WHERE id = ?").bind(id).first<RelationshipRow>();
  if (!row || (row.user_a !== payload.sub && row.user_b !== payload.sub)) {
    return NextResponse.json({ error: "Not your connection" }, { status: 404 });
  }
  await env.DB.prepare("DELETE FROM relationships WHERE id = ?").bind(id).run();
  return NextResponse.json({ ok: true });
}