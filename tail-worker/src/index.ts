/**
 * Sovereign OS — Tail Worker for operational alerting.
 *
 * Cloudflare Streams a copy of every log/exception the parent Worker emits
 * into the `tail()` handler below (see the parent's `tail_consumers` block
 * in `../wrangler.jsonc`). This worker's whole job is to turn a small set
 * of alert-worthy signals into ONE email per (fingerprint, hour) to the
 * support inbox so outages surface in the operator's inbox within 60s
 * rather than in a user complaint 3 days later.
 *
 * Why a Tail Worker instead of Workers Logpush:
 *   - Logpush is a per-account sink to R2 / third-party SIEMs (Datadog,
 *     Axiom, etc.). It archives everything but does not alert. Setting up
 *     alerting on top of Logpush means running a query engine, which is
 *     disproportionate for a 6-user launch.
 *   - A Tail Worker is a first-class Cloudflare primitive: no external
 *     dependency, no extra cost, and the alert logic lives next to the
 *     app it observes in the same repo.
 *
 * Non-goals:
 *   - NO PII lands in the email body. We forward the console message text
 *     which is authored by our own code paths (`[chat] generation failed:
 *     ModelError: ...`) — those never interpolate user content. If a
 *     future log line does leak a snippet of a message, add it to the
 *     redaction list below.
 *   - NO in-worker retry loop. Cloudflare's tail pipeline already
 *     retries on 5xx from this handler; a second layer would double-send.
 *   - NO state that survives isolate recycling. The dedup map is
 *     intentionally in-memory so cold starts are safe; worst case after a
 *     recycling burst is a duplicate alert email, which is a strictly
 *     milder failure than a missed one.
 */

/** Envelope shape Cloudflare delivers into a Tail Worker. Loosely typed
 *  because the exact TS type is only shipped with wrangler, not this
 *  package — we treat anything unknown as non-alert-worthy. */
type TailEvent = {
  message: string;
  level: "debug" | "log" | "info" | "warn" | "error";
  timestamp: number;
  traceId?: unknown;
  outcome?: string;
  scriptName?: string;
  invocationId?: string;
  exception?: { message?: string; name?: string; stack?: string };
};

type Env = {
  SUPPORT_INBOX?: string;
  FROM_EMAIL?: string;
  ALERT_COOLDOWN_MINUTES?: string;
  RESEND_API_KEY?: string;
};

/** Message prefixes emitted by production-os that indicate a real
 *  operational signal worth waking someone for. Substring-match on the
 *  structured `[module]` convention already used in `src/app/api/chat`
 *  and `src/custom-worker.ts`. Anything not on this list only shows up in
 *  Workers Logs. Extend by adding a prefix here — no other code changes
 *  required. */
const ALERT_PREFIXES = [
  "[chat] generation failed",
  "[chat] uncaught",
  "[chat] reasoning prelude failed",
  "[chat] Failed to persist thread",
  "[chat] user lookup fell back",
  "[chat] journey derive/persist failed",
  "[cron ", // scheduled cleanup failure (see custom-worker.ts)
  "[sovereign-model] gateway run failed",
  "[sovereign-model] direct run failed",
  "[sovereign-model] secondary run failed",
  "[waitUntil]",
  "[embedTurn]",
  "[searchChat]",
] as const;

/** Substrings that indicate the log line itself contains user content that
 *  would be inappropriate to forward to email. If a matched line contains
 *  any of these, we redact the body to just the prefix + a stable
 *  fingerprint. Cheap insurance against future log lines accidentally
 *  including a message excerpt. */
const REDACT_MARKERS = ["userMessage", "message_history", "conversation", "password", "token"] as const;

// ── Dedup cache ────────────────────────────────────────────────────────
// Bounded so an unbounded burst of unique failures cannot exhaust isolate
// memory. 512 fingerprints is ~50KB; anything above that is a real outage
// and we WANT additional sends. TTL defaults to 60 minutes and is overridable
// via `ALERT_COOLDOWN_MINUTES` in wrangler.jsonc.
const MAX_FINGERPRINTS = 512;
type SeenEntry = { lastSent: number; hits: number };
const seen = new Map<string, SeenEntry>();

function cooldownMs(env: Env): number {
  const raw = env.ALERT_COOLDOWN_MINUTES;
  const minutes = raw ? Math.max(5, parseInt(raw, 10) || 60) : 60;
  return minutes * 60 * 1000;
}

function pruneIfNeeded(): void {
  if (seen.size <= MAX_FINGERPRINTS) return;
  // Oldest-first eviction. `Map` preserves insertion order, so the first
  // N entries are the ones that would have already expired under normal
  // traffic and can be dropped without meaningfully changing alert cadence.
  const dropCount = seen.size - MAX_FINGERPRINTS;
  let dropped = 0;
  for (const key of seen.keys()) {
    if (dropped >= dropCount) break;
    seen.delete(key);
    dropped++;
  }
}

/** Compute a stable fingerprint so bursts of the same failure collapse into
 *  a single email. Uses (source worker, level, top-frame or exception name,
 *  first 60 chars of message stripped of timestamps and ids) so a rolling
 *  D1 latency spike with the same shape maps to the same key. */
function fingerprint(evt: TailEvent): string {
  const source = evt.scriptName ?? "unknown";
  if (evt.exception) {
    const top = (evt.exception.stack ?? "").split("\n").slice(0, 3).join("|").replace(/\s+/g, " ");
    return `exc:${source}:${evt.exception.name ?? "Error"}:${top.slice(0, 160)}`;
  }
  const normalized = evt.message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b\d{10,13}\b/g, "<ts>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `log:${source}:${evt.level}:${normalized}`;
}

function isAlertWorthy(evt: TailEvent): boolean {
  // Any unhandled exception is always an alert. Cloudflare emits these as
  // separate events with `level=error` AND `exception` populated.
  if (evt.exception) return true;
  // Everything else has to be an error-level log line whose message matches
  // one of the explicit alert prefixes. This is deliberately conservative —
  // a new console.error() with a novel prefix stays silent until we add it.
  if (evt.level !== "error") return false;
  return ALERT_PREFIXES.some((p) => evt.message.includes(p));
}

function redactBody(evt: TailEvent): string {
  const lower = evt.message.toLowerCase();
  if (REDACT_MARKERS.some((m) => lower.includes(m))) {
    // Keep the leading `[module] …` tag so the operator still sees which
    // codepath fired, but drop the rest of the line.
    const m = /^\[[^\]]+\][^:]*:/.exec(evt.message);
    return `${m ? m[0] : "[redacted]"} <redacted: contains user content>`;
  }
  return evt.message.slice(0, 800);
}

async function sendAlert(env: Env, evt: TailEvent, fp: string, hits: number): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  const to = env.SUPPORT_INBOX ?? "chadowen93@gmail.com";
  const from = env.FROM_EMAIL ? `Sovereign Ops <${env.FROM_EMAIL}>` : undefined;
  if (!apiKey || !from) {
    console.warn("[tail-worker] RESEND_API_KEY or FROM_EMAIL unset; alert suppressed");
    return false;
  }
  const subject = hits > 1
    ? `[sovereign-os alert ×${hits}] ${evt.exception ? "Exception" : "Error"} in ${evt.scriptName ?? "worker"}`
    : `[sovereign-os alert] ${evt.exception ? "Exception" : "Error"} in ${evt.scriptName ?? "worker"}`;
  const prelude = `<p>A production error surfaced on <strong>${escapeHtml(evt.scriptName ?? "worker")}</strong> at ${new Date(evt.timestamp).toISOString()}.</p>`;
  const exceptionHtml = evt.exception
    ? `<h3 style="margin-top:1.5rem">Exception</h3><p><strong>${escapeHtml(evt.exception.name ?? "Error")}</strong>: ${escapeHtml(evt.exception.message ?? "(no message)")}</p>${evt.exception.stack ? `<pre style="background:#0d0d0d;color:#f4efe4;padding:12px;border-radius:8px;overflow:auto;font-size:12px">${escapeHtml(evt.exception.stack.slice(0, 2000))}</pre>` : ""}`
    : "";
  const body = `${prelude}${exceptionHtml}<h3 style="margin-top:1.5rem">Message</h3><pre style="background:#0d0d0d;color:#f4efe4;padding:12px;border-radius:8px;overflow:auto;font-size:12px">${escapeHtml(redactBody(evt))}</pre><p style="margin-top:1.5rem;font-size:12px;color:#666">Fingerprint: <code>${escapeHtml(fp.slice(0, 120))}</code><br/>This alert is deduplicated to one email per cooldown window (default 60 min). Configure via <code>ALERT_COOLDOWN_MINUTES</code>.</p>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html: body }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[tail-worker] resend ${res.status}: ${txt.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[tail-worker] resend threw:", err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

/**
 * Best-effort post-send bookkeeping on the parent Worker: we bump a
 * per-day KV counter (via a self-service REST call to the parent's
 * internal /api/owner/tail-ping endpoint) so the owner console can render
 * "alerts fired today". Disabled by default until that endpoint exists —
 * set to a full URL via `PARENT_PING_URL` to enable. Kept here so future
 * activation is a single env var.
 */
async function pingParent(_evt: TailEvent, _env: Env): Promise<void> {
  // no-op placeholder — deliberately NOT wired to a real endpoint yet.
}

export default {
  async tail(events: TailEvent[], env: Env): Promise<void> {
    if (!Array.isArray(events) || events.length === 0) return;
    const cooldown = cooldownMs(env);
    const now = Date.now();
    // Purge expired entries lazily before the loop so a mostly-idle worker
    // does not accumulate stale fingerprints.
    for (const [key, entry] of seen) {
      if (now - entry.lastSent > cooldown) seen.delete(key);
    }
    const fired: Array<{ fp: string; promise: Promise<boolean> }> = [];
    for (const evt of events) {
      if (!isAlertWorthy(evt)) continue;
      const fp = fingerprint(evt);
      const prior = seen.get(fp);
      if (prior && now - prior.lastSent < cooldown) {
        // Cooldown hit: increment the running count so the NEXT email
        // subject line can show "×N". Do not send now.
        prior.hits += 1;
        continue;
      }
      const hits = (prior?.hits ?? 0) + 1;
      seen.set(fp, { lastSent: now, hits: 0 });
      fired.push({ fp, promise: sendAlert(env, evt, fp, hits) });
      void pingParent(evt, env);
    }
    if (fired.length === 0) return;
    pruneIfNeeded();
    // Await sends so the isolate is not torn down mid-request. Cloudflare
    // gives tail handlers a modest CPU budget that comfortably covers a
    // few Resend fetches per batch.
    const results = await Promise.allSettled(fired.map((f) => f.promise));
    results.forEach((r, i) => {
      if (r.status === "rejected" || r.value === false) {
        // On failure, drop the fingerprint so the next batch can retry
        // without waiting for the full cooldown.
        seen.delete(fired[i].fp);
      }
    });
  },
};
