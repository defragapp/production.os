import { NextRequest, NextResponse } from "next/server";
import { getAuthPayload } from "@/lib/connections";

export const dynamic = "force-dynamic";

/**
 * POST /api/nudge/dismiss — retire a transit nudge the user has acknowledged.
 * Scoped to the caller: the UPDATE only touches a row that is both theirs and
 * still undismissed, so re-dismissing or guessing another account's id is a
 * no-op. Body: { id?: string }. Idempotent by design — dismissing an already
 * dismissed nudge returns the same { ok: true } as dismissing a live one.
 */
export async function POST(request: NextRequest) {
  const { env, error, payload } = await getAuthPayload(request);
  if (error) return error;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "A nudge id is required" }, { status: 400 });

  // Best-effort against a pre-migration DB: if the nudge table is absent the
  // write throws — swallow it and still report ok, since there is nothing to
  // dismiss and the client's affordance is already gone from the GET payload.
  try {
    await env.DB.prepare(
      "UPDATE nudge SET dismissed_at = datetime('now') WHERE id = ? AND user_id = ? AND dismissed_at IS NULL",
    ).bind(id, payload.sub).run();
  } catch (e) {
    console.error("[nudge] dismiss failed:", e);
  }

  return NextResponse.json({ ok: true });
}
