/**
 * /api/health — Lightweight production health probe.
 *
 * Exercises every binding that a real request depends on (D1 query + KV read)
 * so external uptime monitors catch binding-level failures that a generic
 * "Worker is alive" ping would miss.
 *
 * Cloudflare Workers production checklist:
 * "Ship a /health endpoint that touches D1, KV, and Vectorize. External uptime
 * monitoring that doesn't exercise the bindings misses the real failure modes."
 *
 * No auth, no rate limit, no cache. Returns 200 on success or 503 on any
 * binding failure. Latency is measured server-side to catch cold-start issues.
 */
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = performance.now();

  try {
    const env = await getEnv();

    // D1: round-trip a trivial query. Fails if the database is unreachable,
    // the binding is misconfigured, or the Worker lacks permission.
    await env.DB.prepare("SELECT 1").first();

    // KV: read a sentinel key (never written — we only care that the read
    // succeeds, not that it returns a value). Fails if the namespace binding
    // is broken or the namespace was deleted.
    await env.SESSION_KV.get("health-probe");

    // Vectorize: `describe()` is the cheapest round-trip that proves the
    // binding resolves and the index still exists. Skipped when the binding
    // is absent (e.g. a local dev environment without a provisioned index)
    // so the health endpoint still returns 200 in that configuration.
    // The AI binding itself is intentionally NOT pinged here — a Workers AI
    // round-trip costs neurons, and the semantic-recall path exercises it
    // on every chat turn anyway; a real outage would surface as a chat
    // 500 well before a monitoring poll caught it here.
    if (env.VECTORIZE) {
      try {
        await env.VECTORIZE.describe();
      } catch (vErr) {
        // Surface the Vectorize failure without masking which binding broke.
        throw new Error(`VECTORIZE.describe: ${vErr instanceof Error ? vErr.message : String(vErr)}`);
      }
    }

    const latency_ms = Math.round(performance.now() - start);
    return NextResponse.json(
      { status: "ok", latency_ms },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const latency_ms = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { status: "degraded", latency_ms, error: message },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
