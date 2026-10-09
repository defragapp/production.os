# Legacy asset inventory — verdicts and drift

Compiled 2026-10-08 from the local predecessor archive. Method: read-only inspection of
`~/SOVV`, `~/OPENAPI`, `~/Projects/defragsrelationalswap`, `~/Sovereign.final`,
`~/IdeaProjects/defrag2`, `~/air/DEFRAG.app` against current source in this repo. Full
history of each is preserved at `/Users/cjo/_legacy-harvest/` (see its `README.md`);
reproduce with `.audit-tmp/legacy-harvest.sh`.

This document changes no code. It is the input to `docs/legacy-implementation-plan.md`.

## Verdict vocabulary

| Verdict | Meaning |
|---|---|
| `port-directly` | Architecture-neutral logic; its assertions still hold against this repo's code |
| `port-pattern-only` | The idea transfers; the file cannot (different runtime — standalone Worker vs OpenNext route handlers) |
| `stale-assertions` | Right shape, wrong facts. Re-derive from current code, never copy |
| `do-not-port` | Conflicts with a product rule this repo has since adopted |

## Inventory

| Asset | Source | Verdict | Cost | Depends on | Current equivalent |
|---|---|---|---|---|---|
| Answer-quality fixture format | `defragsrelationalswap:tests/evals/*.fixture.json` | `port-pattern-only` (**corrected**, see §corrections) | S | none | `src/lib/sovereign-evals.test.ts` (mocked model, no rubric) |
| Six-axis scored runner | `defragsrelationalswap:apps/web/src/server/reasoning/evaluation/quality-runner.ts` (49 L) | `port-pattern-only` (**corrected**: the axes are hardcoded — see correction 4) | S | `DynamicsIntakeInput` type it does not need | none |
| Golden prompts, direct + indirect | `defragsrelationalswap:…/metadata/golden-prompts.ts` (112 L) | `port-pattern-only` | S | MCP tool names (`get_dynamics_guidance` et al.) | none |
| Admin audit log helper | `SOVV:apps/worker/src/utils/audit.ts` (50 L) | `port-directly` **with one required change** (§corrections) | S | `crypto.randomUUID`, D1 | none — `schema.sql` has no audit table |
| Audit log migration | `SOVV:apps/worker/migrations/0024_admin_audit_log.sql` | `port-directly` **with required change** | S | plain SQL | none |
| Crisis-resource registry | `OPENAPI:apps/sovereign-worker/src/agent/safety-resources.ts` (172 L) | `port-pattern-only` | M | `input-safety` types (`SovereignInputSafetyCategory`, `…Decision`) | hardcoded helpline list, `src/lib/sovereign-safety.ts:486-511` |
| Output-safety taxonomy + per-issue rewrites | `OPENAPI:…/agent/safety.ts` (118 L, 14 issues) | `port-pattern-only` | M | zod-free, portable | `SafetyViolationType` (11 types), repair→fallback only |
| Input dispositions (4) | `OPENAPI:…/agent/input-safety.ts` (373 L) | `port-pattern-only` | M | zod | `SafetyMode = standard \| grounded \| escalate` |
| Reduced model-safe Baseline context | `OPENAPI:…/baseline.ts:601-632` + `SOVV:…/active-signals.ts` rule | `port-pattern-only` | M | `baseline-contracts`, facet registry | `buildSystemPrompt` dumps 11 Baseline fields unconditionally (`src/lib/sovereign-prompt.ts:256-277`) |
| Degradation state machine | `SOVV:…/accountability.ts` (337 L) — but `shouldBypassAi`/`tuneTokenBudget` (**corrected**: `port-directly`, pure) | `port-pattern-only` | M | `env.KV` get/put with `expirationTtl` | daily limits only (`src/lib/limits.ts`) |
| Neuron-budget reservation | `OPENAPI:…/ai/free-tier-capacity.ts` (62 L) | `port-pattern-only` (**corrected**: reserve/settle/void are no-ops — see correction 5) | M | model-specific rates | none — no spend ceiling exists |
| User-facing retention status/purge | `SOVV:…/retention.ts` (173 L) | `port-pattern-only` | M | cron + entitlements | `src/custom-worker.ts` cron already purges tokens/invites/usage/journey events |
| Owner cohort + revenue views | `SOVV:…/admin-cohorts.ts`, `admin-revenue.ts` | `port-pattern-only` | S-M | D1 + admin auth | `/api/owner/overview`, `owner-console.tsx` |
| Referral / affiliate attribution | `SOVV:…/referral.ts` + `0025_referral_affiliate.sql` | `port-pattern-only` | M | KV codes + D1 table | `invites`, `promo_grants` — no attribution link between them |
| Support tickets | `SOVV:apps/worker/migrations/0004_support_tickets.sql`, `support-checkout.ts` | `port-pattern-only` | M | D1 + email | `/api/support` sends email, persists nothing |
| Compliance / legal document set | `OPENAPI:docs/legal/*` (21), `docs/security/*` (5), `docs/company/TRUST_CENTER.md` | `stale-assertions` | L | see §drift | none in `docs/` |
| Product-language system | `OPENAPI:docs/product-language-system.md` (623 L) | `stale-assertions` | M | several dead claims | `AGENTS.md` copy + vocabulary section |
| Baseline question universe | `OPENAPI:docs/baseline-question-universe-and-demonstration-strategy.md` (1428 L) | `stale-assertions` | M | old five-space IA | `baseline-form.tsx`, onboard content |
| API Shield schema | `OPENAPI:docs/api-shield/sovereign-critical-api.openapi.yaml` | `stale-assertions` | S | dead route paths (`/api/v1/*`) | WAF config, not in repo |
| MCP / ChatGPT app surface | `defragsrelationalswap:apps/defrag-chatgpt-app/*` (357 L tools) | `port-pattern-only`, **last** | L | `@modelcontextprotocol/*`, Supabase auth, Vercel | none; different deploy path |
| Worlds / video renderer, MindWave visual contract | `OPENAPI:…/world-video.ts`, `docs/mindwave-global-visual-contract.md` | `do-not-port` | — | — | product is text-first |
| Covenant scripture space | `OPENAPI:…/covenant/scripture.ts` | `do-not-port` | — | — | new product scope, not a component |
| `emotional-field.ts` / `expression-field.ts` **as named** | `OPENAPI:…/*.ts` | `do-not-port` as names | — | — | "field geometry" is banned vocabulary; the deterministic-computation principle survives in the Baseline row above |
| Human Design gate/channel generation | `SOVV:…/derive-profile.ts` | `do-not-port` | — | — | forbids inventing gates/channels; this repo bans that vocabulary in output |
| KV at-rest encryption | `SOVV:…/kms.ts` | `do-not-port` | — | — | Baselines are not in KV; `local-memory.ts` already does client AES-GCM |
| Pipeline engine (`parse`/`timing`/`safety` 10 L) | `defrag-ai-gateway-app:engine/*` | `do-not-port` | — | — | superseded by `sovereign-reasoning.ts` |
| DEFRAG.app FastAPI backend, `thefinalfrags` agent docs, `.agents/*` transcripts, `GROWTH_STRATEGY.md`, `v0-*` delivery reports | various | `do-not-port` | — | — | process residue; growth copy violates current rules ("Defragment Your Reality", sells astrology) |

## Corrections to the pre-assigned verdicts

The plan asked that verdicts be confirmed by reading rather than by title. Six changed.

1. **The eval fixtures are `port-pattern-only`, not `port-directly`.** The *format* is
   exactly what is needed, but the *contents* encode an older lexicon.
   `plain-language.fixture.json` asserts `"must_avoid": ["pressure", "resonance",
   "alignment", "diagnosis"]` — and **`pressure` is an approved word in this repo**
   (`AGENTS.md`: friction → "tension", "pressure"). Ported verbatim, the fixture would
   fail a compliant answer. Every `must_avoid` / `must_include` list must be re-derived
   from `sovereign-safety.ts` `LEXICON` and the AGENTS.md vocabulary section before it
   can gate anything.
2. **The audit log needs one change before it can ship.** `SOVV/utils/audit.ts` binds
   `actor_email`, `target_email`, and a plaintext `ip` into D1. This repo's posture is
   the opposite: promo and invite codes are stored only as SHA-256 hashes
   (`src/lib/promo.ts:14`), and birth data never leaves the server
   (`sovereign-prompt.ts:280`). The port must hash or omit `ip` and store ids rather than
   emails. Its fail-silent `catch {}` around the INSERT is worth keeping — an audit
   write must never break a user-facing mutation.
3. **The crisis registry carries an invariant not in this repo at all.** Beyond
   provenance and review dates, `safety-resources.ts:139` states the fallback notice:
   *"…without relying on a model-generated contact."* Combined with
   `selectionSource: 'connection_country' | 'generic_fallback'`, `disregardAllowed: true`,
   and a `version` string on the catalog, the design assumes the model may be *wrong*
   about a phone number and forbids it from improvising one. `buildSafetyResponse()` here
   emits a fixed four-jurisdiction list with no statement of how it was chosen and no
   unknown-jurisdiction path — a gap worth closing, not just reformatting.
4. **The six-axis runner measures nothing, and must not be trusted as an oracle.**
   `packages/reasoning/src/narrative-generator.ts:32-43` returns
   `groundedness: 0.84, relationalAccuracy: 0.8, uncertaintyHandling: 0.82,
   actionability: 0.81, safety: 0.92` as **literal constants**; only `clarity` varies, and
   it is a character-length test (`baseLength > 150 ? 0.88 : 0.72`). `generateNarrative`
   above it is string concatenation, not a model call, and `quality-runner.test.ts` asserts
   `>= 0.5` — below every constant. The JSON fixture set is separately orphaned: nothing in
   that repo references `tests/evals` except its own README, while the wired fixtures live
   in `evaluation/fixtures.ts` as TypeScript. **What ports is the schema (fixture shape,
   axis names, runner loop, test wiring) and nothing else; the oracle has to be built here
   over recorded text, with a negative-control fixture that a bad answer must fail.**
5. **The cost ceiling is three functions that pretend to work.**
   `OPENAPI:ai/free-tier-capacity.ts` exposes `reserveWorkersAiCapacity(db, …)` which
   accepts a `db` and never touches it, `settleWorkersAiCapacity` whose body is `return;`,
   and `voidStaleWorkersAiCapacityReservations` which returns `0` — each commented as
   "delegated to Cloudflare AI Gateway". `parseWorkersAiDailyBudget` (strict, bounded,
   throws) and `estimateWorkersAiNeurons` are real and worth porting; `freeCapacityResponse`
   is the one this repo lacks outright, because **no response here sends `Retry-After`**.
   Porting the trio as written would produce a ceiling that reports it is enforcing a
   budget while recording no spend.
6. **Two verdicts upgrade to `port-directly`.** `accountability.ts:313-322`
   (`shouldBypassAi`, `tuneTokenBudget`) take state as arguments and touch no KV, so they
   move as pure functions; and the four separation lines at `baseline.ts:610-615` are
   prompt prose, of which three are absent from this repo's `## Baseline Context`.

Corrections 4 and 5 are the same defect, and it is the reason for the rule now carried into
`docs/legacy-implementation-plan.md` §0: **a check may not return a value it did not
compute.**

## Drift table — legacy assertions vs this repo (2026-10-08)

Verified against `wrangler.jsonc`, `schema.sql`, `src/lib/*`, `src/custom-worker.ts`.
This table is the reason the legal/security document set is `stale-assertions`.

| Legacy claim (source) | Current reality | Evidence |
|---|---|---|
| Model `@cf/zai-org/glm-4.7-flash`, fail-closed (`AI_GOVERNANCE.md`) | `@cf/meta/llama-3.1-8b-instruct-fp8`, secondary `llama-3.1-8b-instruct`, gateway `sovereign-ai-gateway` | `src/lib/sovereign-model.ts:9-14` |
| Text-to-speech via `@cf/deepgram/aura-2-en` (`AI_GOVERNANCE.md`) | **No TTS exists.** Only dictation, which is client-side and zero-cost | grep for `deepgram\|aura\|tts` in `src/lib` returns nothing; `src/lib/dictation.ts:4` |
| Single provider gate at `sovereign.ts:53` throws unless `cloudflare-gateway` | Gateway id is configurable and an empty value legitimately disables it | `src/lib/sovereign-model.ts:51-53` |
| Queue and R2 bindings (`production-ai-safety-boundary.md`) | **Neither is bound.** Bindings are `ASSETS`, `DB` (D1), `SESSION_KV`, `AI`, `VECTORIZE` + a `sovereign-tail` service binding | `wrangler.jsonc:12,44-70` |
| `app.defrag.app` as the authenticated app origin | Single app origin: `sovereign.defrag.app` | `wrangler.jsonc:91-93` |
| Sessions: HMAC-SHA256 token in D1, 30-day TTL, revocable | JWT in an httpOnly cookie, `exp = now + 7 days`, `tv` token-version for revocation; D1 holds no session token | `src/lib/auth.ts:170,191`; `src/app/api/auth/route.ts:273` |
| `auth_magic_links`, `auth_email_codes`, `auth_passkey_challenges` tables (`jobs.ts` delete list) | No such tables. Only `users.verification_token`; passkeys live in a `passkeys` table | `schema.sql:8` |
| "IP hash (SHA-256) in D1, up to 90 days" (`DATA_FLOW_MAP.md`) | **Raw** IP is used to build KV rate-limit keys alongside a lowercased email; no D1 storage, TTL-bounded, and no hashing helper exists | `src/app/api/auth/route.ts:156-159` |
| Deletion: 14-day grace, then comprehensive table deletion | Immediate erasure: Stripe cancel, Vectorize id snapshot, then one `DELETE FROM users` with `ON DELETE CASCADE` | `src/app/api/auth/account/route.ts:8-19,59` |
| Migrations up to `0019`/`0024`/`0025` | 7 migrations, `0001`–`0007` | `ls migrations` |
| Baseline facets, `reducedContext`, basis registry in D1/KV | No facet registry; `DerivedBaseline` is computed and interpolated whole | `src/lib/sovereign-prompt.ts:256-277` |
| Five spaces: Baseline / Defrag / Alignment / Covenant / Library | Product surfaces are `/chat`, `/baseline`, `/self`, `/people`, `/systems`, `/journey` via `lens` and `s/[id]` | `src/app/` tree |
| Durable Objects for thread coordination (`ThreadCoordinator.ts`) | No app-level DO. Only OpenNext's internal `DOQueueHandler` / `DOShardedTagCache` | `src/custom-worker.ts:20` |
| "clinically validated", "pattern", "friction", "ephemeris" in user copy | Banned; deterministic scrub exists precisely because the model still reaches for them | `AGENTS.md` copy section; `sovereign-safety.ts:523-536` |

One honest consequence: if a privacy document is ever derived from current code, it must
say plainly that a **raw IP address appears in an ephemeral KV rate-limit key** — the
older document's "hashed, never raw" sentence would be false. That is a small hardening
opportunity in its own right (hash before keying), tracked as a row in `docs/open-tasks.md`.

## Do-not-port, with the rule each violates

| Asset | Rule it conflicts with |
|---|---|
| `world-video.ts`, MindWave visual contract | Text-first launch; current design system, not a template lock |
| `covenant/scripture.ts` | New product scope; not a component, a commitment |
| `emotional-field.ts` / `expression-field.ts` as *names* | "field geometry" is banned vocabulary. The determinism principle is kept |
| `derive-profile.ts` gate/channel/gene-key invention | `human-translation.ts` itself forbids inventing gates/channels/placements |
| `kms.ts` | Baselines are not stored in KV; would protect a surface that does not exist |
| `defrag-ai-gateway-app:engine/*` | Superseded twice over; its `safety.ts` is a 10-line regex strip |
| `GROWTH_STRATEGY.md`, `DEFRAG.app` phase scripts, `.agents/*`, `v0-*` reports | Process residue; growth copy contradicts the current positioning rules |

## Open questions requiring an owner decision

Registered as ledger rows in `docs/open-tasks.md` (#59–#61, #67, and #47), not held here —
eight questions, none blocking Phase 1, each blocking a specific implementation step.

1. **(#47)** Where the harvest copies get pushed off this machine (the `defragapp` token cannot write)
2. **(#60)** Whether to ratify the no-`zod` decision for every ported legacy contract
3. **(#59)** Whether to approve recorded-answer capture on the consented test account — it
   spends paid-tier capacity once, and gates the harness that gates everything after it
4. **(#61)** Whether `pressure` staying an approved word is intended, now that a legacy
   fixture calls it forbidden
5. **(#51, #67)** Whether to split `escalate` into `urgent` / `emergency`, and which of the
   four remaining input-safety categories to adopt — both change user-visible crisis copy
6. **(#62)** Whether raw-IP-in-KV should be hashed as part of the audit-log work, or tracked separately
7. **(#69)** Whether compliance documents are a launch requirement for the target market
   or a post-launch one — this decides whether the plan's §8 is scheduled or deferred
8. **(#58)** Confirmation that *not* porting the hypothetical/past-tense crisis suppression
   is intended, since it deliberately keeps a false-positive rate the predecessor removed

The two things this pass discovered that no document in the archive admitted: the
predecessor's quality harness attested its own passing (correction 4), and its cost
ceiling recorded no spend while exposing a ledger-shaped API (correction 5). Both would
have shipped green.
