# Open tasks — compiled 2026-10-06 19:35 from threads 4b798035, 3fb1011e, 0e54bb64, 9fa21c6a, a9034055, 628d00dc

Maintained by `/goal` (`.qoder/skills/goal/SKILL.md`). One row per verifiable thing; the
`#` of an open row never changes. Re-derive with
`node .qoder/skills/goal/scripts/scan-threads.mjs --days 2 --full`.

Current evidence: HEAD `0fd7270` = `origin/main` = local `main`; working tree carries this
pass's doc-drift + F-G edits (uncommitted, awaiting owner go-ahead). Last full ratchet:
**116/116 checks green, 0 skips, 443 unit tests, exit 0** read to its final line on THIS
working tree (`.audit-tmp/goal-ratchet.log`, this `/goal` pass). Earlier green on the
pre-edit tree (`628d00dc`); `9fa21c6a` and `a9034055` each launched a run and never
reported its result — that is *unknown*, not green.

## P0 — security, privacy, data integrity, production failure

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 1 | Revoke compromised API token `steep-smoke-dc94` and its companion R2 S3 access/secret key pair | owner | blocked-dashboard | 4b798035, 628d00dc, 0e54bb64 | `docs/launch-checklist.md` §6 unchecked; pasted into chat 2026-10-02, compromised by this project's own rule. Dashboard → My Settings → API Tokens → Delete |
| 2 | Rotate `ASU_MIGRATION_TOKEN` down: drop `Zone > Read` (or revoke if migration is done) | owner | blocked-dashboard | 628d00dc | checklist §6 unchecked |
| 3 | Rotate/revoke vestigial `R2_*` credentials in `.dev.vars` | owner | blocked-dashboard | 628d00dc | checklist §6; repo side already cleaned — `0320ece`/`0fd7270` touched no live binding |
| 4 | Confirm no compromised credential is still active in the control plane | owner | blocked-verification | 628d00dc | needs dashboard/`wrangler` after #1–#3 |

## P1 — launch blocker / serious user-facing defect

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 5 | Register the Stripe webhook endpoint `https://sovereign.defrag.app/api/webhooks/stripe` for the eleven events, then `npx wrangler secret put STRIPE_WEBHOOK_SECRET` for `production-os` | owner | blocked-dashboard | 4b798035, 628d00dc | checklist §2 unchecked; the Worker already carries a secret — whether the endpoint was registered post-migration is unconfirmed |
| 6 | One real purchase end-to-end: checkout → tier flip → receipt → cancel → dunning | owner | blocked-external | 628d00dc | checklist §2. Never exercised in production; every pricing/claims pass is unproven revenue until this is green |
| 7 | Author the zone Cache Rules (sigil OG immutable, legal-static, SEO-crawler) on `defrag.app`, then re-run `npm run verify:edge` | owner | blocked-dashboard | 4b798035 | last measurement **2/10 cached**; checklist §3 unchecked. Ready-to-paste dashboard-AI prompt in thread `4b798035`; a `Zone > Cache Rules: Edit` token would let `scripts/verify-edge-cache.mjs` drive it |

## P2 — reliability, comprehension, performance, maintainability

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 8 | F-G: prompt-delimit peer-controlled identity strings (`display_name`, relationship label) before they enter another user's reasoning context | agent | closed-this-pass | 0e54bb64 | see *Closed this pass* — `src/lib/peer-identity.ts` sanitizer applied at the `buildConsentedPeers` entry and the render seam; 4 targeted suites green |
| 9 | Empirically test cross-account isolation with a real negative control (user A cannot read B's Baseline/thread/journey) | agent | open | 628d00dc | J.5: structurally guaranteed by `payload.sub`-bound reads; the one negative control in `REMEDIATION_SUMMARY` was retracted as never run |
| 10 | Long-turn dead air: measured chat turns at 19.4s / 43.0s show no early canvas motion because `{state}` flushes only after generation | agent | open-design | 628d00dc | J.6. Hard constraint: do **not** "add streaming" — the pre-generation state-stream seam does not exist. `chat_timing` dimensions are already logged |
| 11 | F-F: per-recipient cap on signup/resend email (third-party verify-email bombing; today only Turnstile mitigates) | agent | open | 0e54bb64 | deferred as needing abuse-rate design, not a patch |
| 12 | Pre-deploy gate gap on the push path: Workers Builds deploys `main` on push with no machinery between push and production (CI retired for billing/secret reasons) | agent | open-design | 628d00dc | J.7; `a2f88f9` removed `verify.yml` |
| 13 | F-C: `verifySession` fails open on a D1 read error | owner | deferred-decision | 0e54bb64 | deliberate availability trade-off, documented at `src/lib/session.ts` L38-45; flipping it fails every login during a D1 blip. Needs an owner decision, not a patch |
| 14 | F-H advisory bundle: non-atomic KV limiters, webhook idempotency, passkey-challenge take, `/api/health` error detail, owner keyed on mutable email, account-delete without re-auth | agent | open-split | 0e54bb64 | P4-grade individually; each needs its own row before work starts |

## P3 — polish and comprehension

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 15 | Full pixel pass on live production: 8 pages, 320/390/768/1024/1440, lazy-scroll + accordion interaction, every screenshot read | agent | open | 4b798035 | never executed — the IDE browser bridge died mid-session and the thread ended. Text-level audit of the same version passed |
| 16 | Rendered inspection of authed surfaces (chat, settings, baseline) — the cold-white hairline (`border-white/10`) consolidation decision waits on it | agent | open | a9034055 | visual pass shipped its 6 edits in `0fd7270`; authed pixels never captured |
| 17 | Landing mobile trust-row separators look loose — adjudicate against the desktop rhythm | agent | open | a9034055 | observed, not filed as a fix |
| 18 | iOS device-profile audit of coarse-pointer floors, install prompt, offline retry on a real device or simulator | blocked | blocked-device | 4b798035 | code-complete since `1d52daa`; no device profile exercised since the tone sweep |
| 19 | Funnel review with Fathom numbers (landing CTA → onboard → quota moment → upgrade) | owner | blocked-access | 4b798035 | analytics are owner-visible only |
| 20 | Anonymous "full comparison" link in the landing plans block points at `/upgrade`, which 307s a stranger to signup | owner | blocked-decision | 9fa21c6a | `landing-client.tsx` L313-318, still present. Both fixes are judgment calls: keep the signup CTA, or send strangers to the FAQ only. Not unilateral |
| 21 | `/redeem` and `/onboard` were verified by text dump, not pixels | agent | open | 4b798035 | the browser died before those two captures |
| 22 | Veil-CLS gate flakes under load — quiet its measurement window | agent | open | 628d00dc | one documented flake in a 116-gate run; `0e54bb64` hit the same class |

## P4 — speculative (do not turn into architecture)

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 23 | Testimonials: `TESTIMONIALS = []` and the component is unmounted after the landing refactor — populate with real, permitted quotes or leave hidden | owner | blocked-decision | 9fa21c6a | `src/content/testimonials.ts`. Inventing quotes would break the honesty contract |
| 24 | Astrology-adjacency framing: `/about` meta says "not astrology", `/faq` says "numerology" for an engine that is astrology + Human Design + Gene Keys | owner | blocked-decision | 628d00dc | J.8 open owner decision |
| 25 | No `/team` / founder trust surface on a product that asks for relationship data | owner | blocked-decision | 628d00dc | J.8 |

## Calendar-gated

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 26 | Decommission the gmail relay address | owner | due-2026-10-16 | 4b798035 | checklist §5 |
| 27 | Source-account teardown: cancel Workers Paid subscription after 14 days healthy + freshest D1 export | owner | due-~2026-10-16 | 628d00dc | checklist §7 prerequisites |

## Deferred from today's threads — closed by someone else, recorded so nobody re-does it

| Task | Closed by | How verified |
|---|---|---|
| Offline-shell chunk cache fix + landing slice + QA artifact hygiene | `0fd7270` (`628d00dc`) | 116/116 ratchet, live Playwright hard-`setOffline` test with screenshots read; deployed `sw.js` md5 ≡ verified tree |
| F-A owner-only `/api/agent-lee`, F-B dotted-API matcher, F-D support-email escaping, F-E thread-delete Vectorize erasure | `0320ece` (`0e54bb64`) | live: `/api/invites/abc.` → 401, `/api/agent-lee` → 401, `/sw.js` → 200; `security-review.test.ts` uses Next's own matcher compiler |
| AI audit changes A–F (current-turn safety routing, definition capture, concision, third-party framework verdicts, 6-message unknown scan, non-consented relational framing) | `01d24f5` + `6d941f8` (`3fb1011e`) | 418→421 tests green, Gate 4 proven green on an internal filesystem (external-SSD I/O diagnosed), deployed `11e9ebcd`, routes 200 |
| Visual pass CTA ladder / radii / demo plates | `0fd7270` (`a9034055`) | edits confirmed in committed HEAD; `git status` clean |
| 48 preview-backed gates skipped in sandboxed runs | `628d00dc` | a full run with 0 skips executed them all on the host |
| Stale local `main` pointer (the ref-safety trap) | `0fd7270` push | local `main` aligned to `origin/main`; `git push origin HEAD:main` remains the required form |

## Closed this pass

| Task | Closed by | How verified |
|---|---|---|
| #8 F-G peer-identity prompt-delimiting | this pass (agent) | New `sanitizePeerIdentity` in `src/lib/peer-identity.ts` (dependency-free) strips newline/`#`/quotes/brackets/angle/backtick, collapses whitespace, caps at 40. Applied at the single entry choke point `buildConsentedPeers` (`sovereign-connections.ts`) AND re-applied idempotently at the render seam + the two signal call sites (`sovereign-reasoning.ts`). Tests: `peer-identity.test.ts`, a render-layer `peer-identity prompt-delimiting (F-G)` block, and an entry-layer block in `sovereign-connections.test.ts` — 72/72 across the 4 affected suites. UI `personName()` left untouched. |
| Doc-drift batch (see table below) | this pass (agent) | Every row's claim re-verified against the tree before editing; edits are comments/markdown only. |

## Doc drift corrected in this pass

| Task | File | What was wrong |
|---|---|---|
| Gate count and check total in the ratchet header | `scripts/verify-release.mjs` | header claimed "thirty-two numbered gates (110 individual checks)" and enumerated to 32 while Gate 33 exists in the script — and AGENTS.md names this header as the source of truth |
| Table count, migration range, runtime claim | `README.md` | "10 tables" vs 11 in `schema.sql` (`nudge` missing); "migrations/0001–0004" vs 7 files; architecture line still said edge + `nodejs_compat` |
| Sampling-status note | `QA_ACTION_LIST.md` | §4 still flagged `head_sampling_rate: 1.0` and claimed it "feeds Gate 33 expectations"; the main Worker was already reverted to `0.1` in `e8bdcce` and no gate inspects the rate. §2 (middleware drift) marked resolved |
| Stale sampling comment above the live value | `wrangler.jsonc` | the block above `head_sampling_rate: 0.1` still said "1.0 for the launch window; revert to 0.1 at T+10d" — rewritten to describe the current steady state (tail Worker's `1.0` is intentional and left as-is) |
| Deploy-path claims in historical summaries | `REMEDIATION_SUMMARY.md`, `VECTOR_HOTFIX_SUMMARY.md` | asserted "Workers Builds is still not connected"; connected and verified 2026-10-06 — corrected with a dated supersession note rather than rewriting the snapshots |
| Route + tail-worker claims | `LAUNCH_TODO.md` | claimed `SELF`/`PEOPLE`/`SYSTEMS` have no route files (they exist and serve 200) and referenced a `pingParent()` no-op that no longer exists |
| Middleware header | `src/middleware.ts` | comment listed `/invite` among auth-gated public pages while the code leaves it public by fall-through |
