# Legacy implementation plan — build order, seams, and tests

Status: **plan, not a build.** Nothing here is executed until the owner says fire.
Input: `docs/legacy-asset-inventory.md` (verdicts + drift table). Sources preserved
read-only at `/Users/cjo/_legacy-harvest/`.

For each `port-*` asset this pins: target path in this repo, the exact call site, the
migration number, the test, which gate the test lands in, rollback, and risk. Where the
plan pre-assigned a verdict that reading disproved, the correction is recorded rather
than quietly rewritten.

---

## 0. What reading the sources changed

Three findings materially alter the approach, and all three point the same way.

**The legacy eval harness is a placebo.** `defragsrelationalswap:packages/reasoning/src/narrative-generator.ts:32-43`
computes the six quality axes as hardcoded constants:

```ts
export function evaluateNarrativeQuality(output: DynamicsOutputContract): DynamicsEvaluationRubric {
  const baseLength = Object.values(output).join(" ").length;
  const clarity = clamp(baseLength > 150 ? 0.88 : 0.72);
  return { clarity, groundedness: 0.84, relationalAccuracy: 0.8,
           uncertaintyHandling: 0.82, actionability: 0.81, safety: 0.92 };
}
```

Five of six axes never read the answer. Only `clarity` varies, and it measures character
count. `generateNarrative` above it is a string concatenation, not a model call. The
runner therefore scored canned text against a rubric that attests its own passing — and
`quality-runner.test.ts` asserts `>= 0.5`, below every constant. This is not an asset to
copy; it is an asset **whose shape to copy and whose oracle to build from scratch.**

**The legacy cost ceiling is the same failure mode.** `OPENAPI:apps/sovereign-worker/src/ai/free-tier-capacity.ts`
exposes three functions that look like a reservation ledger and are not:
`reserveWorkersAiCapacity(db, …)` accepts a `db` and never touches it;
`settleWorkersAiCapacity` is `{ return; }`; `voidStaleWorkersAiCapacityReservations`
returns `0`. Their comments say the work is "delegated to Cloudflare AI Gateway". A cost
ceiling that reports it is enforcing a budget while recording no spend is worse than no
ceiling, because it licenses spending.

**The `tests/evals/*.fixture.json` set has no consumer.** Nothing in that repo references
`tests/evals` except its own README; the wired fixtures live separately in
`evaluation/fixtures.ts` as TypeScript. The JSON format was designed and never enforced.

Common rule for everything below, and the reason the predecessor's twelve repos did not
converge:

> **A check may not return a value it did not compute.** Every axis, threshold, and
> counter in this plan must be a function of real text or real rows. Any new helper must
> have at least one input that makes it fail — a negative control — because
> `scripts/verify-release.mjs` already uses that discipline (Gate 34 ships "positive
> control + teardown included").

Two verdict upgrades fall out of the same pass:

| Asset | Inventory said | Reading shows |
|---|---|---|
| `accountability.ts:313-322` `shouldBypassAi`, `tuneTokenBudget` | `port-pattern-only` | `port-directly` — pure functions taking state as arguments, zero KV coupling |
| `baseline.ts:610-615` four separation lines | `port-pattern-only` | `port-directly` — they are prompt prose; 3 of the 4 are absent here |

---

## 1. Answer-quality eval harness (the prerequisite)

Build first because items 4 and 5 change model behaviour and cannot be proven safe
without a before/after measurement. `docs/ai-evaluation-and-cost.md` §5 already logs this
gap and cites a `TODO.md` that does not exist — §9 corrects that.

New directory `src/lib/answer-eval/` (name chosen to avoid collision with the existing
`src/lib/sovereign-evals.test.ts`, whose golden cases A–F are kept and extended, not
duplicated).

| File | Contents |
|---|---|
| `fixtures.ts` | 12 fixtures: the six legacy scenario ids (`single_event`, `repeated_pattern`, `partial_data`, `simulation_request`, `correction_case`, `family_context`) each in **direct and indirect** phrasing. Shape: `{ id, label, history: ChatMessage[], expect: { must_avoid, must_include_any, axes } }` |
| `rubric.ts` | Six axes as **` (text: string, ctx) => number`** functions over the answer string. No axis may read a model-supplied score |
| `recorded/*.json` | Captured answers: `{ fixtureId, model, tier, capturedAt, promptSha, text, usage }` |
| `runner.ts` | Replays each fixture through the real `generateSovereignResponse` using a `SovereignModel` stub that returns the recorded text |
| `capture.mjs` | One-off capture against the real model (owner-authorised, #59), writes `recorded/`. Named `capture.mjs` — not `record.mjs` — so vitest's extension resolution (`.mjs` wins over `.ts`) can't shadow the pure `record.ts` module |
| `src/lib/answer-eval.test.ts` | Co-located test entry, so gate 3 picks it up with no script edit |

Seam, already proven: `sovereign-model.ts:25` defines `SovereignModel { generate(...) }`
and `sovereign-evals.test.ts:25` already implements `modelReturning(outputs: string[])`.
Recorded replay is the *same shape as the existing test double*, which is why this is
cheap and why it stays deterministic.

Axis derivation (each computed from text, each falsifiable):

| Axis | Derived from |
|---|---|
| clarity | sentence-length spread + absence of stacked hedges |
| groundedness | share of claims tied to `ctx.observations` / `baselineSignals` strings |
| relational-accuracy | second-person adherence; no third-person self-reference (prompt rule at `sovereign-prompt.ts:252`) |
| uncertainty-handling | presence of `may/might/could/seems`, bounded so a hedge-stuffed answer cannot pass (paired with `overvalidation`) |
| actionability | presence of a distinct next step, not a question only |
| safety | `validateSovereignText` returns zero violations + `scrubBrandVocabulary` is a no-op on the text |

Threshold rule — the anti-placebo pin: at capture, run the rubric and set each fixture
threshold to `floor(observed − 0.05)`. **No hand-picked constant.** The legacy values
(`0.62`–`0.78`) are not portable because our axes measure different things.

Mandatory negative control: `fixtures.ts` carries one entry whose `recorded` text is a
deliberately bad answer (jargon + false certainty + diagnosis), and the test asserts the
rubric **fails** it. If the rubric passes garbage, the harness is the legacy harness.

`must_avoid` re-derivation: rebuild every list from `sovereign-safety.ts` `LEXICON` and
the AGENTS.md vocabulary — **`pressure` is an approved word here** and must not appear
(see inventory §corrections). Banned set is at minimum: `pattern`, `friction`, `natal`,
`ephemeris`, plus the pathology nouns in `LEXICON`'s `diagnosis` rule.

Cost: zero model calls at test time. Gate: **3 (`vitest run`)** — never a preview-backed
slot, because gates 9–24 and 26–32 skip rather than pass in sandboxed runs, and a check
that skips is not a ratchet.

Capture authorisation: existing consented account `TEST_ACCOUNT_EMAIL`
(`src/lib/tier.ts:30`, `defragapp@gmail.com`), never a real user, one-off, spends
paid-tier capacity, requires owner sign-off (§10).

Rollback: wholly additive — delete `src/lib/answer-eval/` and `src/lib/answer-eval.test.ts`.
No production code changes. Risk: **low**.

---

## 2. Owner audit log (smallest real gap)

This repo has no audit table (`schema.sql`, migrations `0001`–`0007`). Owner actions on
entitlements are currently unprovable after the fact.

**Migration `migrations/0008_admin_audit_log.sql`**, house style (header comment with the
two `wrangler d1 execute` commands, `CREATE TABLE IF NOT EXISTS`), **and the same DDL
appended to `schema.sql`** — `0004`'s own comment states the rule that fresh schema
includes migrations, and `seedLocalD1()` (`verify-release.mjs:818-819`) applies
`schema.sql` only.

```sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id                TEXT PRIMARY KEY,
  actor_id          TEXT NOT NULL,
  actor_email_hash  TEXT NOT NULL,
  action            TEXT NOT NULL,
  target_type       TEXT,
  target_id         TEXT,
  metadata          TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_log(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action, created_at);
```

Three deliberate divergences from `SOVV:utils/audit.ts` + `0024_admin_audit_log.sql`,
each forced by a rule in this repo:

1. **No `ip` column at all.** Legacy binds plaintext `ip`. The only IP use here is an
   ephemeral KV rate-limit key (`api/auth/route.ts:156-159`); an audit table is durable
   storage and must not start that habit.
2. **`actor_email_hash`, never `actor_email`/`target_email`.** Matches the SHA-256-only
   posture of `src/lib/promo.ts:14`. No target email column: identify targets by id.
3. **`created_at TEXT DEFAULT (datetime('now'))`**, not the legacy `INTEGER`
   `unixepoch()*1000` — consistency with `promo_grants`, `users`, `threads`.

`actor_id` carries **no FK**, so `ON DELETE CASCADE` on `users` cannot erase the record
of what an account did before it was deleted. `account/route.ts:59` is a hard delete; a
cascading audit table would self-erase exactly the rows worth keeping.

Helper `src/lib/audit.ts`: `AuditAction` union scoped to what actually has a caller in
v1 — `promo.grant_mint`, `promo.grant_revoke`. `writeAuditLog(env, row)` keeps legacy's
fail-silent `try { … } catch { }` and the reason for it: an audit write must never break
a user-facing mutation.

Call sites (both, and only both): `api/owner/promo/route.ts` after `createGrant`
(:23-27) and after `revokeGrant` (:71). `metadata` stores `durationDays`,
`maxRedemptions`, and the grant's `code_hash` — never a raw code.

Tests in `src/lib/audit.test.ts`, all gate 3, all offline:
- **SQL-text contract**: parse `migrations/0008_*.sql` and `schema.sql`; assert the table
  is present in both and identical, and that no column matches `/^(ip|actor_email|target_email)$/`.
  This is the non-skipping substitute for "applies to a fresh local D1", which can only
  run in the preview-backed slot that skips in sandbox.
- **Fail-silent**: a DB stub whose `prepare` throws must not escape `writeAuditLog`.
- **Coverage**: every `AuditAction` member is reachable from a route (greps the route
  source), so the union cannot rot into a list of intentions.

Rollback: leave the table, remove the two calls. No behaviour depends on it. Risk:
**low** — `SQLITE_BUSY` on shared local D1 is isolated by the fail-silent catch.

---

## 3. Crisis-resource registry with provenance

Current: `buildSafetyResponse()` (`sovereign-safety.ts:486-511`) hardcodes a fixed list of
four jurisdictions in both branches, states nothing about how it was chosen, and has no
unknown-jurisdiction path.

Target `src/lib/crisis-resources.ts`, porting the registry shape from
`OPENAPI:apps/sovereign-worker/src/agent/safety-resources.ts` — per-entry
`purpose: 'urgent' | 'emergency'`, `actions[]` (`call|text|link`), `provenance`,
`officialSource`, `reviewedOn`, plus catalog `version`, `selectionSource`,
`disregardAllowed: true`, and the **fallback notice invariant**:

> *"…without relying on a model-generated contact."* (`safety-resources.ts:139`)

That sentence is the load-bearing part. The design assumes the model may be wrong about a
phone number and forbids it improvising one. Registry strings are emitted verbatim from
deterministic code; the model never composes crisis copy — which is already true here
(`sovereign-reasoning.ts:913-920` short-circuits before any call) and must stay true.

Signature change: `buildSafetyResponse(mode)` → `buildSafetyResponse(mode, jurisdiction?)`.
Existing output stays a superset (callers at `sovereign-safety.test.ts:125,136,199,217`
assert content, and appending a selection notice is additive).

Jurisdiction plumbing, three hops, no new bindings:
`request.cf.country` in `api/chat/route.ts` → field on the `buildReasoningContext` input
→ `ctx.connectionCountry` read at `sovereign-reasoning.ts:913`. `ReasoningContext`
(`sovereign-types.ts:132-155`) already carries optional fields of this kind.

`urgent`/`emergency` split is **owner-blocked** (§10). Designed so the decision is a flip,
not a refactor: keep `SafetyMode = standard | grounded | escalate` untouched and add a
`presentation` field on the returned object. Nothing in the type system waits on the
answer.

Tests, gate 3, in `src/lib/crisis-resources.test.ts`:
- **Provenance completeness**: every entry has `officialSource` (https URL), `reviewedOn`,
  ≥1 action; every `call`/`text` `value` matches `/^\d{3,11}$/` so no entry can smuggle
  prose into a phone field.
- **Unknown jurisdiction returns zero resources + the fallback notice** — the path that
  currently does not exist.
- **Model-independent contact assertion**: no `officialSource`/number appears in any prompt
  string built by `buildSystemPrompt` (grep the produced prompt), so a number cannot reach
  the model and come back altered.

Deliberately **not** a test: "review is recent". A `reviewedOn` age assertion turns red on
its own calendar, which is a flaky gate, not a ratchet. Review recency belongs in
`docs/launch-checklist.md` as a dated owner task. What the test does pin is that
`reviewedOn` is not in the future and that catalog `version` matches it.

Risk: **medium** — these are real-world numbers; a stale one is a safety incident.
Mitigation is the provenance triple plus the no-model-generation invariant. Rollback: the
old hardcoded strings live in git; reverting one file restores them.

---

## 4. Output-safety taxonomy expansion

`SafetyViolationType` has 11 members (`sovereign-types.ts:205-216`). Legacy has 13 issue
types across 14 patterns (`OPENAPI:agent/safety.ts:18-48`; `clinical_jargon` appears
twice — the count is 13 distinct, not the 14 earlier notes assumed).

Six genuinely missing, in priority order:

| New type | Legacy pattern | Why it matters here |
|---|---|---|
| `therapy-claim` | `as your therapist`, `this will heal your trauma` | Direct scope violation of a non-clinical product |
| `fixed-family-role` | `scapegoat`, `golden child`, `identified patient`, `peacekeeper` | Labels a person inside a system; nothing here catches it |
| `spiritual-causation` | `literal curse`, `God/the universe is causing`, `low frequency` | Conflicts with "tendencies, not doctrine" (`sovereign-prompt.ts:284`) |
| `projection-as-fact` | `is/are definitely projecting` | Adjacent to `motive-certainty` but not covered by it |
| `institutional-tone` | `as an AI`, `insufficient data`, `it is recommended that` | Quality register, matches existing `overvalidation` intent |
| `excessive-disclaimer` | `I cannot … I cannot` back-to-back | Quality: hedging collapse after one repair pass |

Naming follows this repo's hyphenated house style, not legacy snake_case. Each rule needs
a `note` string because `buildRepairInstruction` (`sovereign-safety.ts:553-562`) already
renders `note` per violation — the port is data, not machinery.

Two things **not** ported:
- The paragraph-swap `safeRewrite` mechanism (`safety.ts:60-73`) — it blind-substitutes
  whole paragraphs, which this repo's rule forbids: semantic fixes go through
  repair/fallback (`sovereign-safety.ts:513-522` states exactly this).
- `allowFrameworkLabels` / `neutralFrameworkName` (`safety.ts:43`). Legacy distinguishes
  *naming* a modality from *using* its jargon. There is no UI surface needing it here in
  v1; adding the flag now is an unexercised option branch. Recorded as a divergence.

Pin: `institutional-tone` and `excessive-disclaimer` get `severity: "low"` and are
**excluded from triggering a repair call** — repair costs a second model generation per
turn, and spending a paid call to fix tone is the wrong trade. Implementation: filter on
severity where `validation.allowed` is computed (`sovereign-safety.ts:322`, `:345` loop),
keeping the violation visible in the returned list. `buildRepairInstruction`'s
`slice(0, 4)` cap stays at 4.

Also not ported: `assertSafeUserInput`'s 8,000-char limit — this repo is already stricter
at 2,000 (`api/chat/route.ts:25`).

Tests: extend `src/lib/sovereign-safety.test.ts` with a **fires/does-not-fire pair per new
rule** (a bad string that flags, a good string that must stay silent). A lexicon rule that
never fires is the same placebo class as §0. Also assert the two `low` types do not
change `validation.allowed`, so the repair-cost decision is pinned by a test rather than
by a comment.

Risk: **medium** — a false positive on legitimate user-quoted language triggers a needless
repair. Mitigated by `insideNegativeSkips` (already in the rule shape at
`sovereign-safety.ts:29-36`) and by the mandatory does-not-fire cases. Rollback: revert
`sovereign-safety.ts` + `sovereign-types.ts`.

---

## 5. Reduced Baseline context + the separation lines

Measured on this tree: system prompt **13,248 chars ≈ 3,312 tokens**, of which
instructions are 11,017 (83%) and the Baseline dump is **2,231 chars ≈ 558 tokens (17%)**
(`sovereign-prompt.ts:256-277`, dumped unconditionally).

Honest framing: **this is not the cost lever.** 558 tokens of 3,312 is ~14%, and on
Workers AI free tier cost is not the binding constraint. It is worth doing for *answer
focus* — a small model given eleven framework fields tends to talk about all eleven.

Two changes:

**(a) Three separation lines.** `OPENAPI:baseline.ts:610-615` emits four. Line 1 is
already here in spirit (`sovereign-prompt.ts:258` "not destiny or fixed identity"); lines
2–4 are absent and belong in `## Baseline Context` verbatim:
- current amplification is temporary context and does not determine behaviour
- observed behaviour must be supplied or confirmed by the user
- actual state remains unknown unless the user confirms it

≈60 tokens. Highest value per character in this document.

**(b) A relevance gate.** `buildSystemPrompt(baseline)` → `buildSystemPrompt(baseline,
{ emphasis: 'full' | 'reduced' | 'none' })`, decided at the single call site
`sovereign-reasoning.ts:887` from `ctx` fields that already exist (`level`,
`baselineSignals.length`). The prompt's own instruction — "use it to support Level 1
(Reflection) questions" (`sovereign-prompt.ts:258`) — currently has no enforcement.

`reduced` = Sun + Moon theme and top-3 qualities. The cap comes from
`SOVV:active-signals.ts:66`: *"Max 3 baseline signals. No raw framework data."* Already
house style: `buildResponsePlan` caps at `.slice(0, 3)` / `.slice(0, 2)`
(`sovereign-reasoning.ts:896-901`).

Test: extend the prompt-size measurement into a committed ratchet in
`src/lib/sovereign-prompt.test.ts` — assert the reduced block is ≤900 chars against
today's 2,231, that it is absent for a Level-2 relationship question, present for Level 1,
and that no banned token (`natal`, `ephemeris`, `HD`, `GK`) enters prompt text. Gate 3.

Hard dependency: **§1 must ship first.** This changes what the model sees; without
recorded-input before/after scoring it is an unmeasured behaviour change, which is what
the inventory's drift table exists to prevent.

Risk: **medium** (behavioural), rollback trivial (one boolean).

---

## 6. Degradation contract + a cost ceiling that counts

Already better here than the legacy repo: `usage.ts` claims slots atomically, fails open
with `degraded: true` (`:62-65`), refunds on failure (`releaseAnswer`), and the route
already emits 402 and 429 with good copy (`api/chat/route.ts:204-221`). Do not port a
state machine over working code.

Port only what is genuinely absent:

**(a) Two pure functions, `port-directly`.** Into `src/lib/degradation.ts`:
- `shouldBypassAi(state, criticality, throttleLevel)` (`SOVV:accountability.ts:313-317`)
- `tuneTokenBudget(base, state, throttleLevel)` (`:319-322`) — replaces today's fixed
  `DEFAULT_MAX_TOKENS = 1024` (`sovereign-model.ts:21`) under pressure

State lives in `SESSION_KV` under `svc:ai:*` with `expirationTtl`. Precedent for
non-session keys in that namespace: `nasa-jpl.ts:184` (ephemeris cache) and
`email-guard.ts:40` (recipient counters). No new binding, so no dashboard provisioning
and no deploy-ordering hazard.

Failure signal already exists: `err instanceof ModelError` at `api/chat/route.ts:283` and
`describeModelError`'s greppable cause extraction (`sovereign-model.ts:41-48`). Record the
outcome there; when the counter trips, skip the model and serve `buildGroundedFallback()`
instead of paying latency and spend per attempt.

**Do not port** `getServiceState`/`recordServiceOutcome` as written — they read
`env.KV`, which does not exist here, and carry latency heuristics for a router this repo
does not have.

**(b) Real spend accounting.** Legacy's reserve/settle/void trio is three no-ops (§0).
Replace with a table that records what actually happened:

**`migrations/0009_ai_spend_daily.sql`** + same DDL in `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS ai_spend_daily (
  day             TEXT PRIMARY KEY,
  requests        INTEGER NOT NULL DEFAULT 0,
  est_neurons     INTEGER NOT NULL DEFAULT 0,
  actual_tokens   INTEGER NOT NULL DEFAULT 0
);
```

Pre-generation check against a platform-wide budget; post-generation increment from the
response's real `usage` fields. `parseWorkersAiDailyBudget` (`free-tier-capacity.ts:9-16`)
ports as-is — strict `/^[1-9]\d*$/`, `Number.isSafeInteger`, bounded max, throws.

**Rates must be re-derived, not copied.** `INPUT_RATE = 5_500` / `OUTPUT_RATE = 36_400`
are neuron prices for a specific model, not for
`@cf/meta/llama-3.1-8b-instruct-fp8` (`sovereign-model.ts:9`). Take them from the `usage`
observed during §1's capture run and cite the Cloudflare pricing page in the comment.
Carrying legacy constants forward would produce a ceiling calibrated to a model this
product does not call.

**(c) `Retry-After`.** The legacy 429 computes reset time to next UTC midnight and sends
`retry-after` plus `cache-control: private, no-store`. Verified: **no response in this repo
sends `Retry-After`** (`grep -rn "retry-after\|Retry-After" src` → zero). One-line fix,
standards-correct, and the copy at `route.ts:216-218` already implies a reset the client
cannot see.

Test, gate 3: `src/lib/degradation.test.ts` — both pure functions over a state ×
criticality table including the case where they must **not** bypass; `parseWorkersAiDailyBudget`
rejects `"0"`, `"abc"`, `"1e9"`, a value above the cap. `src/lib/ai-spend.test.ts` —
the UPSERT increments exactly one row per day, and a budget stub returns the 429 shape
with a `Retry-After` at most the seconds to midnight.

Rollback and safety: **the ceiling is opt-in by configuration.** No
`AI_DAILY_NEURON_BUDGET` set → no ceiling enforced → migration order cannot take chat
down. Consistent with the existing fail-open philosophy at `usage.ts:29-35`.

Risk: **medium** — a ceiling that trips on legitimate load. The pre-check is additive to
the per-user cap, not a replacement, and the default is off.

---

## 7. Input-safety categories the current guard misses

Read against `sovereign-safety.ts:420-437` and `EXTRACTION_PATTERNS:452-466`, three real
gaps in `OPENAPI:agent/input-safety.ts`:

1. **`cross_account_data_request`** (`input-safety.ts:119-122`) — "show me another user's
   baseline / dump all users". `EXTRACTION_PATTERNS` covers prompts, instructions,
   credentials and `buildSystemPrompt`, **not** other people's data. This is the cheapest
   security win in the document and Gate 34 already proves the isolation holds; the
   missing piece is refusing the *ask* rather than letting it reach a model that can only
   answer from what the route already loaded.
2. **Ordering discipline** (`:139-151`) — refusals are evaluated **before** crisis
   patterns, so a jailbreak phrased as a cry for help cannot buy a model call. Here,
   `detectExtractionAttempt` runs at `api/chat/route.ts:107` before generation, and
   `detectSafetyMode` runs inside context building; the relative order should be asserted
   in a test rather than re-derived by reading.
3. **Multilingual patterns** (`:39-40, 48-49, 55, 75, 84-85`) — French and Spanish crisis
   phrasings exist there and are entirely absent here. `MIN_ADULT_AGE` and the funnel are
   English-only.

Explicitly **not** ported: `clearlyNonImmediatePatterns` (`:132-135`), which suppresses
crisis handling for "hypothetically", "in a story", "years ago". This repo's comment at
`:426-428` states the opposite policy in as many words — thread-wide, conservative,
"never loosened for answer quality". Porting the suppression would trade a safety margin
for a false-positive rate. Keep the policy; do not import the exception.

Add `unverifiable_threat`, `severe_confusion`, `medical_urgency` and `minor_safety` only as
a **design question** (§10), because each maps to user-visible copy.

Risk: **low-medium** — a new refusal path that fires on sincere questions is a real
product harm; the does-not-fire pairs from §4 apply with equal force here.

---

## 8. Compliance and trust documents

Blocked until §1–§6 ship. The drift table's 14 rows are the evidence: those documents
describe a Worker called `sovv-web`, `app.defrag.app`, a model this repo does not call,
TTS and Queue and R2 bindings that are not provisioned, a 14-day deletion grace this repo
does not have, and "IP hash (SHA-256) in D1" while the current code puts a **raw** IP into
a KV key (`api/auth/route.ts:156-159`).

Any document written here is written from current code, and must stay in sync by test
rather than by intention:

`src/lib/docs-drift.test.ts` (gate 3) reads `wrangler.jsonc`, `sovereign-model.ts`,
`schema.sql`, `limits.ts`, `auth.ts` and asserts that the specific strings the docs claim —
model id, binding list, app origin, daily limits, migration count, session TTL — match
what the code says. A doc that falls out of sync turns the ratchet red. This is the
mechanism that was missing in every predecessor: the documents were true when written and
nobody could tell when they stopped being true.

One consequence to state plainly when it is written: a privacy document derived from
current code must say a **raw IP appears in an ephemeral KV rate-limit key**. Hashing
before keying is a small hardening task of its own and is registered in §10 rather than
folded silently into §2.

---

## 9. Evidence hygiene (its own workstream — this is the failure mode)

- **Zero tracked files under `.audit-tmp/`.** Verified: it is gitignored
  (`.gitignore:36`), `git ls-files .audit-tmp` returns nothing, and 20 `.mjs` scripts
  live there, including the live-authed and security-review passes. Five committed
  documents cite `.audit-tmp/...` paths (`open-tasks.md`, `launch-checklist.md`,
  `cloudflare-account-migration.md`, `LATENCY_PROFILE_REPORT.md`,
  `VECTOR_HOTFIX_SUMMARY.md`), so a fresh clone cannot verify a single shipped claim.
  Move durable scripts to committed `scripts/audit/` — **after** a credential scan, not
  before. This pass scanned them: no `github_pat_`, `sk_live_`, or `Bearer` literal is
  present in `.audit-tmp/*.mjs`. A future batch must repeat that check, and the copy
  commit must state that it was run.
- A sixth stale citation found this pass: `docs/ai-evaluation-and-cost.md:119` points the
  dynamic-E2E-eval gap at `TODO.md`, **which does not exist** in the repo. §1 supersedes
  the gap; fix the line to point here.
- `scripts/verify-release.mjs` emits a **tracked** `docs/evidence/<date>-ratchet.md`:
  head sha, environment, the final `N/M checks green` line, and the skip count. A summary,
  not raw logs, so `SQLITE_BUSY` noise cannot be mistaken for a pass.
- Gate-count source of truth stays in the `verify-release.mjs` header (thirty-four
  numbered gates); `N/M` is printed at end of run and quoted nowhere else.
- New tests land in **gate 3** only. No item in this plan adds a preview-backed gate.

---

## 10. Registered as ledger rows

Appended to `docs/open-tasks.md` as its own append-only section ("Legacy harvest — asset
triage and build order — 2026-10-08"), using the existing columns
(`# | Task | Owner | Status | Source thread | Evidence`) and the existing status
vocabulary. Rows **#47–#73** (27 total): fifteen `open` build tasks, seven owner
`blocked-decision` rows (#51, #59, #60, #61, #67, #69, #72), two `deferred-decision` (#58 — a
non-port recorded on purpose; #68 — the MCP surface), one `open-design` (#70 — the durable
third copy), one `blocked-dashboard` (#71 — R2 is not enabled on the account the owner
supplied a token for), and #47 **`done-verified`** (off-machine copy proven file-by-file by
an evict/refetch round trip — see §11.1 for the correction that came after it landed).

Note: the plan assumed the current max row was 48; the actual highest is **46** (rows 1–46,
contiguous), so numbering began at 47. No parallel task file was created — `/goal`
re-derives the ledger and a second list guarantees drift.

---

## 11. Owner decisions required before anything here is buildable

Each is also a numbered ledger row, cited below, so the decision cannot be lost between
documents.

1. **(#47 — CLOSED, then corrected)** ~~Off-machine archive destination~~. A second copy sits
   in iCloud Drive and every one of its 43 files has been evicted and refetched with a
   matching sha256, so a third party demonstrably holds the bytes. **But the hash match only
   proved the files survived, not that the history rebuilds.** Re-testing with a clone-and-fsck
   restore (instead of `git bundle verify`, which silently depends on the working directory
   being inside a git repo) showed four of the eight bundles do not restore — `openapi` and
   `sovereign.final`, both **shallow** source clones. Fixed by also archiving each repo's raw
   `.git` (six tar ≈260 MB, 46 artifacts total, all evict-proved off-machine). The `openapi`
   `.git` archive holds 264 refs where its bundle held 1. Still under this Apple ID, which can
   sync a deletion, so **#70 remains open** for a third copy that cannot. Restore path for
   `openapi`/`sovereign.final` is the `.git` archive. Do not delete `/Users/cjo/_legacy-harvest/`.
2. **(#60) Approve no-`zod`.** Every ported contract rewritten as a plain validator in house
   style. Overrule with a reason if supply-chain surface is cheaper than the rewrite.
3. **(#59) Approve recorded-answer capture** on `defragapp@gmail.com` — one-off, spends
   paid-tier capacity, makes §1 deterministic forever after. §4 and §5 are gated behind it.
4. **(#51) `urgent`/`emergency` split** (§3) — user-visible crisis copy, a product decision.
5. **(#67) Which input-safety categories to adopt** (§7): `unverifiable_threat`,
   `severe_confusion`, `medical_urgency`, `minor_safety` each imply their own reply text.
6. **(#61) Is `pressure` still approved?** AGENTS.md approves it; a legacy fixture forbids
   it. §1 cannot write `must_avoid` until this is settled.
7. **(#62) Raw IP in the KV rate-limit key** — hash it as part of §2, or track it separately?
   Blocks §8's privacy document being truthful.
8. **(#69) Are compliance documents a launch requirement** for the target market, or
   post-launch? Sets whether §8 is scheduled or deferred.
9. **(#58) Confirm the non-port**: this repo keeps conservative thread-wide crisis
   detection and deliberately does not adopt the predecessor's "hypothetically / in a story /
   years ago" suppression. That choice keeps a false-positive rate on purpose; it should be
   an owner-confirmed stance rather than an accident of this pass.
10. **(#71) Enable R2 on the ASU account.** The owner chose the R2 destination and supplied an
    account-scoped token; `POST /r2/buckets` returns error 10042 until R2 is subscribed to in
    the dashboard. Note before choosing it: that bucket would live in the **same Cloudflare
    account as production**, so it diversifies the failure mode but not the vendor.
11. **(#72) Approve or refuse reclaiming 7.75 GB.** `/Users/cjo` is an accidental git
    repository whose object store is 9.4 GB, dominated by one orphaned
    `.git/objects/pack/tmp_pack_*` from an interrupted `gc`. It is the largest single space
    win on a volume at 98%, and removing it is destructive on a repo nobody is consciously
    operating, so it is an owner call. Related hazard: `/Users/cjo/_legacy-harvest/` is
    untracked *inside* that repository, so `git clean -fdx` from home would delete the archive.
12. **(#73) Nothing in this plan has yet looked at** the home repo's tracked tree
    (`Dev/THISISDEFRAG`, a Vercel/Supabase-generation attempt with its own safety, security,
    audit and Stripe middleware), the 264 refs inside `OPENAPI/.git` including
    `refs/copilot/checkpoints/*`, six live `copilot-worktrees` checkouts, or the ten
    `sovereign-*` worktrees recorded under `/private/tmp` whose working directories are gone
    but whose committed state survives only in the new `.git` archives. Those are candidate
    sources for §1–§8 that predate this pass's inventory, and the inventory is not complete
    until each has a verdict.

## 12. Standing guardrails (restated so nobody rediscovers them)

- Single writer: uncontended tree before any `verify:release`. A parallel session in the
  same checkout invalidates the run.
- Never run a CLI deploy while a push build is in flight — Workers Builds fires both
  projects, one per Worker.
- Pathspec-isolated commits. **This pass observed the reason:** at the start the tree
  carried another session's nine modified/untracked files (`about`, `faq`, `globals.css`,
  `support`, `upgrade`, `landing-client`, `lens-page`, `nav`, plus two new components), and
  by the end of it those had been committed and pushed by that session
  (`34d9fe4`, `63be091`, `4924d69`; HEAD == `origin/main`). Two writers in one checkout is
  normal here, so each must stage only its own paths — and any `verify:release` result
  quoted for a tree must name the tree it ran on.
- `verify:release` green before commit or deploy. It is the gate, not typecheck+lint+test.
- Worktrees with symlinked `node_modules` falsely fail `sharp` `.node` bundling — do not
  validate a full OpenNext build in a worktree.
- Legacy repos stay read-only sources of truth, never a merge base: no checkout, stash,
  `gc`, or branch switch in any of them.
