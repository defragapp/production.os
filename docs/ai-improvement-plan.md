# Public AI improvement plan

Status: **WS1 and WS3 shipped in code (pending `verify:release` + push).** WS2, WS4–WS9 are planned.
Owner-facing planning doc for iterating on the customer-facing AI (the signed-in `/chat`
surface). Backend identifiers keep their engine names; this doc describes product intent,
not renamed engine symbols.

Companion docs: [`ai-system.md`](./ai-system.md) (how answers are built),
[`ai-evaluation-and-cost.md`](./ai-evaluation-and-cost.md) (tone + cost),
[`../LATENCY_PROFILE_REPORT.md`](../LATENCY_PROFILE_REPORT.md) (measured timings),
[`scaling-plan.md`](./scaling-plan.md) (cost ceilings).

## 1. What the public AI is today

One customer-facing AI surface only: `/chat` (signed-in; free or Sovereign+). The owner-only
`/api/agent-lee` is deliberately not public. The pipeline is:

`sovereign-model.ts` (Workers AI, gateway → direct → secondary, 60 s budget, non-streaming)
→ `sovereign-reasoning.ts` (classify → meaning → signals → generate → validate → repair-once
→ grounded fallback) → `sovereign-safety.ts` (lexicon + crisis routing + extraction /
cross-account deflections) → `app/api/chat/route.ts` (burst + daily caps, SSE) →
`answer-eval/` (offline recorded-answer replay against a six-axis rubric).

## 2. The measured problem

From `LATENCY_PROFILE_REPORT.md` (2026-10-04):

| Turn | `gen_ms` |
| --- | --- |
| Cache-hit / identical prompt | 52–162 ms |
| Novel, 1849-char answer | 21,448 ms |
| Historical outliers | 19.4 s / 43.0 s |

Uncached time tracks **≈85–90 chars/s of output** — answer length is the latency dial. Because
token streaming is a hard "do not add" constraint, the real levers are (a) caching repeat
prompts, (b) shorter answers, and (c) making the *wait itself* feel alive. Before WS1 the SSE
stream opened only **after** generation, so the journey canvas sat still for the whole wait.

## 3. Workstreams

### WS1 — Pre-generation `{ state }` frame · **implemented**

`app/api/chat/route.ts`: the `ReadableStream` is now constructed **before** the model call, and
`{ threadId }` + the deterministic `{ state }` frame are enqueued immediately; `{ content }`
stays gated behind `generateSovereignResponse` (model + validation + repair). The journey write
is still deferred until generation succeeds, so a failed turn closes the stream with no
`{ content }`/`[DONE]` (the client's `!sawDone || !sawContent` retry path handles it; no early
503 once the stream is open). A first-ever arc's real id is delivered in a corrected frame
(`newly_unlocked: []`, so the milestone reveal fires once) once persistence mints it.

- **Constraint honored:** no token streaming — every painted byte is validated text.
- **Tradeoff (honest):** a failed turn can transiently move the *client* canvas before the
  retry corrects it; the *persisted* canvas still never advances on a failed turn. This is the
  seam the route comment used to say was "not built yet".
- **Pinned by:** `src/lib/chat-stream-contract.test.ts` (stream opens before generation; content
  gated; failure closes with no half-answer; corrected-id frame).

### WS2 — AI Gateway response caching · owner action, no code

Enable caching (short TTL) on `sovereign-ai-gateway` via the dashboard (Zero Trust → AI Gateway)
or an AI-Gateway-scoped token. Turns repeat/near-identical prompts from ~17 s into ~0.05–0.16 s
and cuts neurons. `scaling-plan.md` §4.3 / §C has the exact settings call. Verify with the
report's method (identical stored answers at `gen_ms < 200 ms` = cache hit) + gateway analytics.

### WS3 — User feedback loop · **implemented**

The live-quality signal: a content-free "Did this land?" control under the newest finished answer
`→ POST /api/chat/feedback` (authed, 30 writes/min/user) `→ answer_feedback` (migration `0009`).
The offline rubric (`answer-eval/`) stays the regression gate; this is the only read on whether an
answer actually landed for a real person. One row per `(user_id, thread_id, turn_index)` — the
upsert (`ON CONFLICT … DO UPDATE`) means changing your mind replaces the row instead of stacking a
duplicate, so that triple is the unit of signal.

- **Privacy:** server-memory only. A `memory_mode='local'` (zero-retention) account is never shown
  the control, and the route independently refuses to persist for one (`stored:false`) — two guards
  on one promise. No answer text, snippet, or free-text is ever stored; the table records only the
  enum and which turn.
- **Threads and the table:** `thread_id` carries no FK on purpose — a purged thread's signal stays
  useful in aggregate, and a cascading FK would erase the history the table exists to keep (same
  reasoning as `admin_audit_log`, migration `0008`). The route still verifies thread ownership so
  junk ids cannot be written.
- **Constraint honored:** the control carries the `tap-line` hook (the size floor lives in the one
  `(pointer: coarse)` block), never a hand-written `min-h`, and is kept off `role=radio/switch`.
- **Pinned by:** `src/lib/answer-feedback-contract.test.ts` (table content-free + schema/migration
  byte-identical; route user-scoped, upsert, local-refusal; control server-only + newest-answer-only
  + hook class).

### WS4 — Multilingual answering · planned

Safety already detects Spanish/French *crisis input* (#57), but nothing tells the model to
**answer in the user's language**. Add that directive to `buildSystemPrompt`, and — the harder,
higher-stakes half — make `buildSafetyResponse` crisis copy language-appropriate. The rubric's
`must_include_any` lists are English-keyed, so this depends on WS6.

### WS5 — Data-driven model evaluation · planned

Swap `SOVEREIGN_MODEL`, re-run the #59 capture flow (owner-approved; token from env only),
compare rubric axes vs latency. No production change until the numbers justify it. Capture uses
the direct `ai/run` tier (the Gateway binding is unreachable from plain Node).

### WS6 — Strengthen the eval · planned

Add multilingual / multi-turn / meaning-level fixtures; investigate why the `actionability`
threshold is `0` (not required) on several fixtures — the gate is thin where users live.
Preserve `floor(observed − 0.05)` thresholds and the mandatory negative control.

### WS7 — Per-turn token budget · planned

Pass `maxTokens: 512` for brief / Level-1 turns (a shorter answer is proportionally faster per
the 85–90 chars/s line). Guard against mid-sentence truncation; measure with WS6.

### WS8 — Recall hit-rate tuning · planned

`usedRecall` exists server-side; aggregate whether auto-recall fires. If the 0.82 floor
(`chat-recall.ts`, env-tunable via `RECALL_MIN_SCORE`) never triggers, lower it or widen the
freshness window.

### WS9 — Observability aggregation · planned

`chat_timing` is logged as structured object dimensions but consumed by nobody. Add a best-effort
daily KV aggregate (mirroring `ops:model-errors:*`) for repair/fallback counts and `gen_ms`
buckets. Never fail a request over telemetry.

## 4. Sequencing

1. **WS1 + WS3** (shipped) → 2. **WS2** (owner, parallel) → 3. **WS6 → WS4** →
4. **WS5** → 5. WS7–WS9 cleanup.

## 5. Verification & ship contract (any change)

- `npm run verify:release` green (read the gate/check count from `scripts/verify-release.mjs`'s
  own header — do not trust counts quoted elsewhere).
- Routes, D1/KV bindings, Stripe flows, and auth are preserved; small verified edits only.
- Copy rules apply to every new user-facing string and model directive.
- Ship via `git push origin main` (fires both `production-os` and `sovereign-tail` builds); never
  CLI-deploy while a push-triggered build is in flight.
