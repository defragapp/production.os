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

  let body: { myLabel?: string; shareBaseline?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const row = await env.DB.prepare("SELECT id, user_a, user_b, a_label, b_label, a_share_baseline, b_share_baseline, created_at FROM relationships WHERE id = ?").bind(request.nextUrl.searchParams.get("id") ?? "").first<RelationshipRow>();
  if (!row) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  const iAmA = row.user_a === me.id;
  if (!iAmA && row.user_b !== me.id) return NextResponse.json({ error: "Not your connection" }, { status: 403 });

  const label = body.myLabel !== undefined ? normalizedLabel(body.myLabel, iAmA ? row.a_label : row.b_label) : null;
  const share = body.shareBaseline !== undefined ? (body.shareBaseline ? 1 : 0) : null;

  if (label !== null && share !== null) {
    await env.DB.prepare(
      iAmA
        ? "UPDATE relationships SET a_label = ?, a_share_baseline = ?, created_at = created_at WHERE id = ?"
        : "UPDATE relationships SET b_label = ?, b_share_baseline = ?, created_at = created_at WHERE id = ?",
    ).bind(label, share, row.id).run();
  } else if (label !== null) {
    await env.DB.prepare(iAmA ? "UPDATE relationships SET a_label = ? WHERE id = ?" : "UPDATE relationships SET b_label = ? WHERE id = ?").bind(label, row.id).run();
  } else if (share !== null) {
    await env.DB.prepare(iAmA ? "UPDATE relationships SET a_share_baseline = ? WHERE id = ?" : "UPDATE relationships SET b_share_baseline = ? WHERE id = ?").bind(share, row.id).run();
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