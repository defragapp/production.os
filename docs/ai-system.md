# Sovereign AI System

This document describes how the Sovereign OS AI works internally — how a Baseline is
computed, how signals are derived, how answers are generated, and how safety is enforced.
It is the reference for the current "reflection engine" and the basis for the future
relational-patterning layer (see "Future: relational patterning assessment" at the bottom).

## 1. Inputs to every answer

An AI answer is generated per user from four scoped sources:

| Source | Origin | Access control |
| --- | --- | --- |
| Baseline signals | Computed once from birth data (NASA/JPL) | Account-scoped row in D1 `baselines` |
| Thread messages | The user's current conversation | Account-scoped chat rows (KVs / D1) |
| Consented people | Derived profiles of people who accepted an invite | Gated by accepted `relationships` rows |
| Static directives | Model instructions + write-time caps | Code |

No source is ever broader than the owning account. The raw baseline JSON is never sent to
the model verbatim or exposed to another user.

## 2. Baseline computation (`/api/baseline`)

1. User submits optional place, date, time, timezone.
2. **Natal positions**: `src/lib/nasa-jpl.ts` resolves coordinates against the NASA/JPL
   Horizons API (`BASELINE_HORIZONS_URL`) for the ten natal bodies (Sun, Moon, Mercury,
   Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto).
3. **Human Design**: `src/lib/sovereign-humandesign.ts` derives type, strategy, authority,
   profile, defined centers, and active channels from the same planetary figures.
4. The result is stored as JSON in `D1.baselines` (`nasa_jpl_json_data`).

## 3. Derivation — Baseline → signals (`sovereign-baseline.ts`)

`deriveBaseline(...)` (in `sovereign-prompt.ts`) folds the raw JSON into the
`DerivedBaseline` shape: sun/moon themes, qualities, pressure response, underused
capacities, numerology life path, Human Design summary, and Gene Keys labels.

`buildBaselineSignals(...)` then converts that into `BaselineSignal[]`, where every signal
carries its `source` and `epistemicStatus` ("baseline-supported"), so downstream reasoning
can use the Baseline as *context* without presenting it as verdict.

`buildBaselineLimitations(...)` produces explicit "insufficient data" notes (e.g. no life
path, unknown Human Design type) that the reasoning layer reports honestly rather than
padding.

## 4. Reasoning engine (`sovereign-reasoning.ts`)

The engine classifies the latest user message into one of four inquiry levels:

1. **Reflection** — qualities, patterns, pressure responses, underused capacities.
2. **Meaning** — investigates the user's *definition* of a loaded concept before
   interpreting (trigger list includes love, success, safety, responsibility, loyalty,
   betrayal, etc.).
3. **Relationship** — only with consent-gated context of another person; otherwise the
   engine works only with what the user described.
4. **System** — multiple consented participants; else it stays grounded in what was said.

It builds the reasoning context from: baseline signals, consented peers (via
`sovereign-connections.ts`), corrected prior interpretations, and a bounded message window
(`MAX_CONTEXT_MESSAGES`). Generated answers follow the Meaning → Expression → Consequence
→ Reinforcement → Cost → Question loop and must separate **Observed / Baseline-supported /
Interpretive / Unknown** states.

## 5. Model adapter (`sovereign-model.ts`)

- Model: `@cf/meta/llama-3.1-8b-instruct-fp8` (Cloudflare Workers AI).
- First attempt routes through the **AI Gateway** (`sovereign-ai-gateway`); on failure it
  falls back to a direct Workers AI call.
- Output budget: every call sends an explicit `max_tokens` (`DEFAULT_MAX_TOKENS = 1024`
  in `sovereign-model.ts`). Cloudflare's implicit default was small enough to truncate a
  typical Sovereign answer mid-sentence, so the ceiling is now set deliberately (and kept
  bounded) so replies arrive complete without unbounded per-message compute.
- Generation is **non-streaming**: one complete, validated answer is produced, then shipped
  to the client as a single SSE `content` event. The model call itself is not token-streamed.
- Answer integrity: if the model returns an empty/incomplete turn, the pipeline retries
  once; on repeat failure it returns an honest "couldn't finish" message — it never emits a
  fabricated placeholder.

## 6. Chat pipeline (`/api/chat`)

Gates applied in order:

1. JWT auth (`verifyJWT`) — anonymous messages are rejected.
2. Account must exist and have a completed Baseline.
3. Rate limits: burst (20 req / 60 s) and, for the free tier, a daily cap
   (`FREE_TIER_DAILY_LIMIT = 5`, reset nightly). Sovereign+ lifts the daily cap (enforced
   server-side, not in the UI).
4. Message is trimmed and length-capped (`MAX_MESSAGE_LENGTH`).

The thread merges server-side (`mergeChatHistories`) and is sanitized (`sanitizeMessages`)
before the safety layers run. The validated answer is delivered as a single SSE `content`
event and rendered on the client by `markdown-lite.ts` → `components/rich-text.tsx`, which
turns a lightweight markdown subset (headings, lists, bold, inline code) into safe React
elements — no raw HTML, no third-party markdown dependency.

## 7. Safety architecture

Three layers, all in `sovereign-safety.ts`:

- **Layer 1 — Intent escalation (detectSafetyMode)**: flags turns that push the model to
  act as a clinician, fortune-teller, psychic, or to moralize across the user's life. Flagged
  turns get an escalated, grounded instruction block.
- **Layer 2 — Lexicon validation**: a negation-aware category filter over the model's output
  (diagnosis/pathology prohibitions, self-harm encouragement, harassment/abuse, explicit
  content, dangerous/illegal action). Negation awareness prevents "not a diagnosis" from being
  falsely flagged.
- **Layer 3 — Repair + grounded fallback**: on violation the pipeline returns a grounded,
  repair-style reply (acknowledge + redirection) instead of silence; the fallback branch
  replies from the evidence discipline alone.

Cross-cutting: the system prompt (in `sovereign-prompt.ts`) enforces *interpretive safety* —
no diagnosis, no identity labels, no prediction, no claiming knowledge of another person's
hidden emotions, no overvalidation, no relationship verdicts, reversible corrections, and a
crisis protocol that acknowledges and redirects to professional resources.

The prompt also keeps the reply in the reader's experience rather than exposing its own
scaffolding:

- **Evidence states stay internal.** *Observed / Baseline-supported / Interpretive / Unknown*
  are epistemic postures to weave into prose, never headings or labels to print.
- **Baseline quality tags are internal.** Each derived quality is labeled with a short
  `<planet> <role>:` tag for the model's grounding only; the directive forbids echoing it
  (an earlier `(Jupiter — expansion)` parenthetical leaked verbatim into answers — now fixed
  and pinned by a regression test in `sovereign-prompt.test.ts`).
- **Second-person voice.** Answers address "you / your Baseline," never third-person
  ("the user," "their Baseline").

## 8. Privacy and consent invariants

- Birth data is used only to compute the Baseline; it is never shared or sold.
- Raw `nasa_jpl_json_data` never reaches a model prompt or another user.
- A person appears in another user's AI context only after an explicit, accepted
  invitation; each side is rendered through its own Baseline.
- Accounts and their data delete atomically (one click from Account).
- There is no training on user conversations — generation is per-request.

## 9. Future: relational patterning assessment

The product roadmap describes systems-level reading ("the systems you live within"). The
foundations exist:

- Consent-gated relationship rows are already materialized (`relationships` table,
  `sovereign-connections.ts` builds `consentedPeers`).
- `buildBaselineSignals` is per-person; a **pair-comparison renderer** can diff two signal
  sets on the client-visible evidence triangle (values, pressure responses, and capacities),
  and a **group/systems renderer** can surface role structures across consented participants.

Planned additions (design-only, no behavior change committed yet):

1. `buildRelationalSignals(a, b)` — overlap/conflict annotations between two Baselines,
   each labeled `baseline-supported` (never verdicts).
2. `buildSystemSignals(people[])` — role/loyalty hypothesis generation for ≥3 consented
   people, gated exactly like relationships, with the same interpretive safety rules.
3. Relational correction memory — the pipeline already stores corrected interpretations;
   extend it to pair-level corrections so a reframe in one relationship context does not
   contaminate another.

Implement these inside the existing `sovereign-reasoning` pipeline and re-route the consent
check through `sovereign-connections` exactly as Level 3 does today.

## 10. Operations notes

- Bindings: `DB` (D1), `SESSION_KV`, `AI`, `AI_GATEWAY_ID`, `BASELINE_HORIZONS_URL`.
- Secrets: `JWT_SECRET`, `RESEND_API_KEY`, `STRIPE_*`, `TURNSTILE_SECRET_KEY`,
  `SUPPORT_INBOX`.
- Messages are never logged server-side; failures are logged at the pipeline layer only.
- Cost/eval context lives in `docs/ai-evaluation-and-cost.md`.