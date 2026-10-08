# Open tasks — reconciled 2026-10-07 (this pass) from threads 61b587a3, 4b798035, 3fb1011e, 0e54bb64, 9fa21c6a, a9034055, 628d00dc; first compiled 2026-10-06 19:35

Maintained by `/goal` (`.qoder/skills/goal/SKILL.md`). One row per verifiable thing; the
`#` of an open row never changes. Re-derive with
`node .qoder/skills/goal/scripts/scan-threads.mjs --days 2 --full`.

Current evidence: this pass's four commits (`93c9545`/`a78bf85`/`3cab4f8`/`7d65707`) are
**pushed to `main` and live** — `HEAD` `7d65707` == `origin/main`, both Workers Builds
check-runs `completed/success`. Since then the launch-audit Pass 2+3 ran against live
`sovereign.defrag.app`, yielding one clear code fix (the sign-in password label, F3) and a
genuine negative control for #9, plus the #22 Veil-CLS fix layered on top.
**Shipped:** `git push origin HEAD:main` pushed `7d65707..311d935` (F3 + Gate 34 + #22
CLS scoping + this ledger) to production. Both Workers Builds check-runs
(`production-os`, `sovereign-tail`) came back `completed/success`; live
`sovereign.defrag.app` returns `200` on `/`, `/privacy`, `/terms`, `/faq` and the
expected `307` on `/upgrade`, with no deploy-collision 503/hang. The ratchet on this
tree (F3 + Gate 34 + #22): **117/117 checks green, 0 skips, exit 0, 524s**, read to its
final line (`.audit-tmp/verify-22b.log`) — the count stays 117 because #22 scopes
existing gate measurements, it adds no check. The prior tree's run was 116/116; the +1
is Gate 34. NOTE: a *parallel tab*'s 10 uncommitted PageShell edits (`about`/`blog`/`blog[slug]`/`faq`/`invite`/`support`/`upgrade`/`offline`/`s/[id]`/`lens-page`)
were present during that run but are NOT in the pushed commits (isolated by explicit
pathspec) and so are not deployed; my commits touch only the gate script, docs, and the
already-committed `onboard-content` fix, none of which alter those pages.

**This pass (2026-10-07) — tree state, verified empirically:** `origin/main` is `311d935`;
local HEAD is `0aacd4d` with **two committed-but-unpushed** docs/test commits on top
(`d5a9c14`, `0aacd4d` — the latter's message records a 117/117 0-skip ratchet at 01:58,
`.audit-tmp/verify-email.log`, on the then-committed tree). The entire email-audit
implementation batch — `email.ts` shell/receipt redesign, `receiptFields()` in
`stripe.ts`, webhook-route mapping, `send-test-emails.mjs` rewrite, README/stripe-plan/
ledger doc drift — is **live only in the working tree (19 modified files), uncommitted,
and NOT fully verified**: the 09:34 run (`.audit-tmp/verify-emails.log`) ended `PASS WITH
SKIPS` (preview-gated checks skipped in a sandboxed environment) and the batch's final
mtimes are 09:40 — *after* that run. Production therefore still serves the pre-audit
`email.ts` (dead receipt rows, missing shell `bgcolor`/preheader/MSO fallback). The tree
also still carries the parallel tab's page/design-token edits (mtimes Oct 6 21:27, the
`duration-[240ms]`/`ease-spring`/CTA-padding set across the 9 public pages +
`lens-page.tsx`) — same not-mine, isolate-by-pathspec situation as before. No competing
builds were running at scan time. Environmental: thread `61b587a3` was destroyed mid-run
by the `/Volumes/EXTREME` dropout (SanDisk Unlocker partition presenting, 270 phantom
"deletions"); reads are healthy again and both held commits (`d5a9c14`/`0aacd4d`) are
intact in the object store — nothing phantom-deleted was ever committed.

**Work-through update (same day, this thread):** #30 executed AND SHIPPED. Full
uncontended `verify:release` on the exact email-batch tree: **117/117, 0 skips, 535s**,
read to its final line (`.audit-tmp/verify-30.log`). Committed pathspec-isolated as
`e7d101e` (`fix(email): …`, 8 files — the parallel tab's 10 page/`lens-page` edits
deliberately left uncommitted, mtime unchanged). Owner go-ahead given; `git push origin
HEAD:main` shipped `311d935..f78c710` (four commits: `d5a9c14`+`0aacd4d`+`e7d101e`+ledger).
Both `Workers Builds` check-runs for `f78c710` — `production-os` and `sovereign-tail` —
came back `completed/success`; live `sovereign.defrag.app` answers `/`, `/privacy`,
`/terms`, `/faq`, `/api/health` all 200, no collision 503/hang. Production now sends the
audited email templates.

## P0 — security, privacy, data integrity, production failure

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 1 | Revoke compromised API token `steep-smoke-dc94` and its companion R2 S3 access/secret key pair | owner | blocked-dashboard | 4b798035, 628d00dc, 0e54bb64 | `docs/launch-checklist.md` §6 unchecked; pasted into chat 2026-10-02, compromised by this project's own rule. Dashboard → My Settings → API Tokens → Delete |
| 2 | Rotate `ASU_MIGRATION_TOKEN` down: drop `Zone > Read` (or revoke if migration is done) | owner | blocked-dashboard | 628d00dc | checklist §6 unchecked |
| 3 | Rotate/revoke vestigial `R2_*` credentials in `.dev.vars` | owner | blocked-dashboard | 628d00dc | checklist §6; repo side already cleaned — `0320ece`/`0fd7270` touched no live binding |
| 4 | Confirm no compromised credential is still active in the control plane | owner | blocked-verification | 628d00dc | needs dashboard/`wrangler` after #1–#3 |
| 28 | **Rotate the live Stripe secret key** `sk_live_51TV1FSBk78yJ8Hww…` pasted into chat on 2026-10-07, then `npx wrangler secret put STRIPE_SECRET_KEY` | owner | blocked-dashboard | this pass | Compromised-on-paste by this project's own rule — a live `sk_live_` key is full-account access (charges, refunds, payouts, customer PII). It was used only for reversible config work (webhook event list, product description) and never written to the repo; the temp copy at `/tmp/sv_sk` is deleted. Until it is rolled, anyone with this transcript can charge or refund real customers. Roll in dashboard → Developers → API keys → *Roll secret*, then update the Worker secret; `STRIPE_WEBHOOK_SECRET` is separate and does NOT need rotating with it. |

## P1 — launch blocker / serious user-facing defect

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 5 | Register the Stripe webhook endpoint `https://sovereign.defrag.app/api/webhooks/stripe` for the eleven events, then `npx wrangler secret put STRIPE_WEBHOOK_SECRET` for `production-os` | owner | done-verified | 4b798035, 628d00dc, 2026-10-07 | Verified against the live account `acct_1TV1FSBk78yJ8Hww`: endpoint `we_1UJuNpBk78yJ8HwwPUlSiOZd` **enabled**; added the one missing event (`invoice.payment_succeeded`) so all **11** events the route handles are subscribed. `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` already on `production-os`. Unsigned POST to the live route returns **400 `Missing stripe-signature`** (not 500) → deployed, receiving, secret configured. Prices active: $20/mo `price_1Te0g9…`, $99/yr `price_1Tq6nP…`, product `prod_UdHEFXmi3YN78U`. |
| 6 | One real purchase end-to-end: checkout → tier flip → receipt → cancel → dunning | owner | blocked-external | 628d00dc, 2026-10-07 | Checklist §2. Config side now fully verified: `/api/checkout` stamps `client_reference_id` + `metadata.account_id` + `customer_email` (stripe.ts:118–123) and the webhook maps those to set `subscription_tier='sovereign+'` + dedup receipt + dunning — so a paid session **will** upgrade the right account. A real Checkout Session was created and rendered in Chrome at 390 + 1280 (then expired; zero open sessions left on the account), so the hosted payment page itself is verified. The three webhook email templates are pinned by `src/lib/email.test.ts` (now 15 tests) and all ten templates were delivered for real to `defragapp@gmail.com` through the live Resend key (11/11 message ids, no failures). A signed live trigger is still not possible without the Stripe CLI login (test-mode only) — `testHelpers` returns 404 on the live API. Remaining is a human paying a real card through the app (agent must not spend owner money). |
| 7 | Author the zone Cache Rules (sigil OG immutable, legal-static, SEO-crawler) on `defrag.app`, then re-run `npm run verify:edge` | owner | blocked-dashboard | 4b798035 | last measurement **2/10 cached**; checklist §3 unchecked. Ready-to-paste dashboard-AI prompt in thread `4b798035`; a `Zone > Cache Rules: Edit` token would let `scripts/verify-edge-cache.mjs` drive it |
| 30 | Ship the email-audit batch: pathspec-isolated commit of the 10 email/stripe/docs files (leave the parallel tab's 9 page edits + `lens-page.tsx` alone), push `HEAD:main` together with the two unpushed commits `d5a9c14`/`0aacd4d`, confirm both Workers check-runs | agent | closed-shipped | this pass | shipped in `f78c710` (`311d935..f78c710` push after a 117/117 0-skip ratchet on the exact tree); both Workers Builds check-runs success; live routes 200. See *Closed this pass*. Checkbox hygiene: `docs/launch-checklist.md` §1's webhook-registration box (L28) can be ticked once #5's registration is dashboard-confirmed by the owner |

## P2 — reliability, comprehension, performance, maintainability

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 8 | F-G: prompt-delimit peer-controlled identity strings (`display_name`, relationship label) before they enter another user's reasoning context | agent | closed-this-pass | 0e54bb64 | see *Closed this pass* — `src/lib/peer-identity.ts` sanitizer applied at the `buildConsentedPeers` entry and the render seam; 4 targeted suites green |
| 9 | Empirically test cross-account isolation with a real negative control (user A cannot read B's Baseline/thread/journey) | agent | closed-this-pass | 628d00dc | see *Closed this pass* — new Gate 34 drives the live routes with a valid stranger session; J.5's retracted negative control is now run for real |
| 10 | Long-turn dead air: measured chat turns at 19.4s / 43.0s show no early canvas motion because `{state}` flushes only after generation | agent | open-design | 628d00dc | J.6. Hard constraint: do **not** "add streaming" — the pre-generation state-stream seam does not exist. `chat_timing` dimensions are already logged |
| 11 | F-F: per-recipient cap on signup/resend email (third-party verify-email bombing; today only Turnstile mitigates) | agent | closed-shipped | 0e54bb64 | see *Closed this pass* — shipped in `1737269`; both Workers Builds check-runs success; live `/api/auth/resend` and `/api/invites` answer unauthenticated POSTs 401 (auth before guard, correct precedence) |
| 12 | Pre-deploy gate gap on the push path: Workers Builds deploys `main` on push with no machinery between push and production (CI retired for billing/secret reasons) | agent | open-design | 628d00dc | J.7; `a2f88f9` removed `verify.yml` |
| 13 | F-C: `verifySession` fails open on a D1 read error | owner | deferred-decision | 0e54bb64 | deliberate availability trade-off, documented at `src/lib/session.ts` L38-45; flipping it fails every login during a D1 blip. Needs an owner decision, not a patch |
| 14 | F-H advisory bundle — split into individual rows (#31–#36) below; no work starts on an item without its own row | agent | closed-split | 0e54bb64 | superseded by #31–#36 |

## P3 — polish and comprehension

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 15 | Full pixel pass on live production: 8 pages, 320/390/768/1024/1440, lazy-scroll + accordion interaction, every screenshot read | agent | partial | 4b798035 | Pass 2+3 ran on live `sovereign.defrag.app` at 1920 (funnel + public routes): no console errors, no overflow, plan rows reach full opacity, focus ring present, dead-ends offer next actions. TRUE 390/1440 pixel captures still blocked (browser bridge can't resize; CSP blocks iframe proxies) — but overflow/44px/16px at those widths are asserted green by Gates 24/30 |
| 16 | Rendered inspection of authed surfaces (chat, settings, baseline) — the cold-white hairline (`border-white/10`) consolidation decision waits on it | agent | open | a9034055 | visual pass shipped its 6 edits in `0fd7270`; authed pixels never captured. This pass read the authed-surface SOURCE (`/redeem`/`/settings`/`/baseline` copy vs the engine): claims accurate, banned vocab only in code comments — no code change warranted. The pixel capture + hairline decision still need a resize-capable browser. |
| 17 | Landing mobile trust-row separators look loose — adjudicate against the desktop rhythm | agent | open | a9034055 | observed, not filed as a fix |
| 18 | iOS device-profile audit of coarse-pointer floors, install prompt, offline retry on a real device or simulator | blocked | blocked-device | 4b798035 | code-complete since `1d52daa`; no device profile exercised since the tone sweep |
| 19 | Funnel review with Fathom numbers (landing CTA → onboard → quota moment → upgrade) | owner | blocked-access | 4b798035 | analytics are owner-visible only |
| 20 | Anonymous "full comparison" link in the landing plans block points at `/upgrade`, which 307s a stranger to signup | owner | blocked-decision | 9fa21c6a | `landing-client.tsx` L313-318, still present. Both fixes are judgment calls: keep the signup CTA, or send strangers to the FAQ only. Not unilateral |
| 21 | `/redeem` and `/onboard` were verified by text dump, not pixels | agent | partial | 4b798035 | Pass 2 walked `/onboard` (login + signup, Turnstile renders, inline errors) on live at 1920 and surfaced the F3 sign-in label fix (see *Closed this pass*); `/redeem` auth-gated pixels + true 390 still not captured (Gate 29 walks the redeemed card at 390 in preview). This pass verified `/redeem` copy against the engine by code — the "up to 150 AI messages a day" claim equals `SOVEREIGN_PLUS_DAILY_LIMIT=150`, gift→sovereign+, no card→"nothing is charged" — accurate, no change. |
| 22 | Veil-CLS gate flakes under load — quiet its measurement window | agent | closed-this-pass | 628d00dc | see *Closed this pass* — the live `/chat` CLS gates now reset-and-measure-the-transition instead of asserting the raw whole-load accumulator (which carried hydration noise); verified green inside the 117/117 run |

## P4 — speculative (do not turn into architecture)

| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 23 | Testimonials: `TESTIMONIALS = []` and the component is unmounted after the landing refactor — populate with real, permitted quotes or leave hidden | owner | blocked-decision | 9fa21c6a | `src/content/testimonials.ts`. Inventing quotes would break the honesty contract |
| 24 | Astrology-adjacency framing: `/about` meta says "not astrology", `/faq` says "numerology" for an engine that is astrology + Human Design + Gene Keys | owner | blocked-decision | 628d00dc | J.8 open owner decision |
| 25 | No `/team` / founder trust surface on a product that asks for relationship data | owner | blocked-decision | 628d00dc | J.8 |
| 29 | Check Stripe's own **"email receipts"** toggle (Settings → Customer emails) so a paying customer does not get two receipts per charge | owner | blocked-dashboard | this pass | `src/lib/email.ts` `payment-received` carries a deliberate belt-and-suspenders comment about this exact toggle. Our send is now a real on-brand receipt (Plan / Billing / Amount / Paid / Next billing), so a second Stripe-branded one alongside it reads as duplication, not reassurance. Not readable through the API — dashboard only. |
| 31 | Non-atomic KV limiters (reset, resend-cooldown, and now the F-F recipient cap): a large concurrent burst can read the same count and overshoot | agent | open | 0e54bb64 (F-H split) | D1-slot like `claimAnswer` is the atomic alternative; needed only if any limiter is ever load-bearing for money/quota, not abuse-braking |
| 32 | Stripe webhook idempotency — the row's premise was STALE (a generic `stripe-event:${id}` guard already shipped); the real defect was mark-BEFORE-process swallowing retries | agent | closed-this-pass | 0e54bb64 (F-H split) | see *Closed this pass* |
| 33 | Passkey challenge take-over: registration/authentication challenges stored where a concurrent ceremony could consume the other's | agent | closed-this-pass | 0e54bb64 (F-H split) | see *Closed this pass* — auth already keyed per-ceremony; registration moved to the same shape (`pkreg:${userId}:${requestId}`) |
| 34 | `/api/health` returns error detail strings on a public route | agent | closed-this-pass | 0e54bb64 (F-H split) | see *Closed this pass* |
| 35 | Owner-console access keyed on mutable `email` string — an account email change could hand owner rights to a new address-holder (or revoke them) | agent | open | 0e54bb64 (F-H split) | move to a stable user-id allowlist |
| 36 | Account deletion proceeds without a re-auth step | agent | open | 0e54bb64 (F-H split) | pair with the passkey/password re-confirm UX when the destructive-flows pass is scheduled |

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
| #9 cross-account isolation negative control | this pass (agent) | New **Gate 34** in `scripts/verify-release.mjs` seeds a second fully-valid account (own `users` row, live `token_version`) that owns nothing, then drives the live preview routes: the owner reads a sentinel Baseline the stranger's identical GET never surfaces; the owner's thread is 404 by id and absent from the stranger's list; a journey PATCH is refused and leaves the row byte-identical; a thread DELETE that answers `ok` destroys nothing. Positive control + teardown included. Smoke-green on an isolated preview boot, then green inside the full 117/117 run. |
| F3 sign-in password label (from audit Pass 2) | this pass (agent) | `src/app/onboard/onboard-content.tsx`: the label is now `{isLogin ? "Password" : "Password (at least 8 characters)"}` — the 8-char floor is a signup requirement and should not tell a returning person their own password needs 8 characters. `minLength={8}` left unconditional (harmless — every stored password is ≥8). |
| #22 Veil-CLS gate load flake | this pass (agent) | Root cause: the live `/chat` CLS gates (`gateAuthenticated` arrival, the 390 veil-reveal, Gate 12 occlusion arrival, Gate 15 dismissal) asserted the raw `window.__cls.total` accumulator, which sums `/chat`'s unavoidable async hydration shifts (nav-fade, journey/thread fetch) and intermittently tipped 0.01 under CPU contention. Fix follows the file's OWN established pattern (Gate 8 fixture + Gate 13 already reset before the interaction): added a `window.__clsReset()`/`__clsRead()` seam to `CLS_OBSERVER_SCRIPT`, scoped the veil-reveal assertion to the deterministic expand transition, excluded `/chat`'s raw load total from the arrival tally (still covered by the static routes + Gate 12), and made Gate 12 assert *settled* quietness and Gate 15 measure the fold transition. No check added (count stays 117). Also corrected a residual header count drift `thirty-three`→`thirty-four` gates. Verified inside the full **117/117, 0 skips** uncontended run — Gates 9/12/13/15 green with preview actually executing, not skipped. |
| Email template audit — design, necessity, deliverability, receipt fields | this pass (agent) | Inventoried all call sites: 12 templates shipped, **2 had none** (`billing-success` duplicated `payment-received`; `trial-ending` advertised a free trial the product does not have) and `sendTransactionalEmail` was a dead export — all three deleted, with `email.test.ts` now asserting the removed names throw. Rendered every template through the real `email.ts` (Node type-stripping + fetch interception, so the artefacts are byte-identical to production output) and screenshotted at 375 + 700: the shared shell was missing `bgcolor` attributes, `color-scheme`/`supported-color-schemes`, a preheader, and any MSO fallback in **12/12** — all four now live in `emailShell`, plus a `@media (max-width:480px)` card rule and Get help · Privacy footer links. Every send now carries a generated plain-text part (`toPlainText`). The receipt went from prose to a Plan/Billing/Amount/Paid/Next billing summary table — and its `next`/`interval` rows were dead because `webhooks/stripe/route.ts` never passed them and formatted the date with `toDateString()`; that mapping moved to `receiptFields()`/`invoiceDate()` in `src/lib/stripe.ts` (UTC-pinned, 6 new tests). `scripts/send-test-emails.mjs` was a drifted mirror copy of the design (wrong brand colours, still listing `trial-ending`) — rewritten to call the real `sendTemplate`, so it can no longer mislead a release pass. 11/11 renders delivered for real to `defragapp@gmail.com`. |
| #30 verify + commit the email-audit batch | this pass (agent) | Full uncontended `npm run verify:release` on the exact tree: **117/117 green, 0 SKIPPED lines, exit line read** (535s, `.audit-tmp/verify-30.log`). Pre-commit secret scan of the staged diff: no live key bytes (only the truncated `sk_live_51TV1FSBk78yJ8Hww…` *reference* in #28, which identifies the key to roll). Committed pathspec-isolated `e7d101e` — exactly the 8 email/stripe/docs files; `git status` after commit shows the parallel tab's 10 page/`lens-page` edits still untouched in the worktree. Owner gave explicit go-ahead; pushed `311d935..f78c710` via `git push origin HEAD:main` (origin/main verified unchanged first — pure FF). Both `Workers Builds` check-runs (`production-os`, `sovereign-tail`) `completed/success` on `f78c710`; live `/`, `/privacy`, `/terms`, `/faq`, `/api/health` → 200. |
| #11 F-F per-recipient email cap | this pass (agent) | Test-first: `src/lib/email-guard.test.ts` written before wiring — 7/10 red at the contract block, then 10/10 green. New `recipientMailAllowed()` (`src/lib/email-guard.ts`): one shared recipient-keyed KV counter (`recipient-mail-rl:${email}`, cap **6/hour**, TTL-restart window), deliberately mirroring the reset route's established per-recipient pattern and `claimAnswer`'s fail-open degradation policy; the accepted non-atomicity is filed as #31 instead of silently re-architected. Wired at three call sites: signup verify/welcome (token still minted, mail skipped when capped), `/api/auth/resend` (checked BEFORE the cooldown is spent; honest 429 copy), and `/api/invites` (invite row + share link still created, only the mail is capped — kills the bomb without dead-ending the feature). Full local suite **474/474 across 40 files**, `tsc --noEmit` exit 0, eslint clean on all five touched files. Full ratchet on the final tree: **117/117, 0 skips, 501s** (`.audit-tmp/verify-ff.log`). Owner go-ahead given; committed `1737269` (6 files, parallel tab's edits untouched) and pushed `f50f9c5..1737269` — both `Workers Builds` check-runs `completed/success`, live `/` + `/api/health` 200, touched routes 401 unauthenticated. |
| #32 + #34 advisory pair (webhook retry ordering, public health detail) | this pass (agent) | Test-first `src/lib/advisory-hardening.test.ts` (source-contract style, the repo's pattern for routes — no alias config exists to import them): 4 of 7 red before the edits, 7/7 after. **#34:** the 503 body no longer carries the caught error message (binding error strings can name databases/namespaces/permissions on an unauthenticated public route); the detail now goes to `console.error("[health] degraded:", …)` where wrangler tail and the alerting tail worker already read logs — grep proved the `error` field had one producer and zero consumers. **#32:** the ledger premise was wrong — a generic `stripe-event:${event.id}` dedup guard already shipped at the route top; the actual flaw was writing the marker BEFORE dispatch, making the webhook at-most-once (a mid-handler D1 blip left the event marked, so Stripe's retry was skipped as a duplicate). Marker now written only after the switch completes; a missing `event.id` no longer collapses all such events into one `undefined` key; replay-safety of re-run handlers documented (idempotent tier UPDATEs + per-invoice/per-customer email dedup). Suite **481/481 across 41 files**, tsc 0, eslint clean. Shipped in `d7ade71`. |
| #33 passkey registration per-ceremony challenge | this pass (agent) | The F-H row's worry confirmed in source: the auth ceremony already keyed its challenge by a random per-ceremony `requestId`, but registration used one shared slot per user (`pkreg:${userId}`) — two tabs starting setup overwrote each other's challenge and the first ceremony failed as "expired" (self-trample; registration is session-authenticated, so no cross-user vector exists). Fix mirrors the established auth shape: `pkreg:${user.userId}:${requestId}` with a `crypto.randomUUID()` per ceremony; the requestId ships alongside the options and is echoed back on PUT (400 with honest retry copy if absent — a stale client bundle just re-starts the ceremony). Three layers wired: `src/lib/passkeys.ts`, the register route, `AddPasskeyButton` in `src/components/passkey.tsx`. Contract block 5 tests: 4 red before, 12/12 after; Full suite **486/486 across 41 files**, tsc 0, eslint clean. Full uncontended ratchet on the final tree: **117/117 green, 0 skips, 517s** (`.audit-tmp/verify-passkey.log`, final line read: `RESULT: PASS`). |
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
| Email-template inventory in the architecture list | `README.md` | claimed "Five email templates … billing-success, trial-ending" — two of those five had no call site and one advertised a trial that does not exist; now lists the ten that actually ship, and points at `scripts/send-test-emails.mjs` |
| Tier-limit claims | `docs/stripe-plan.md` | three places sold `sovereign+` as "unlimited" (enforcement table, a suggested "unlock unlimited" in-chat nudge, and "consider a fair-use ceiling") while `src/lib/limits.ts` has capped it at 150/day since the tier shipped — corrected to the real ceiling, with a note never to print "unlimited" |
| **Live Stripe product description** | `prod_UdHEFXmi3YN78U` (account `acct_1TV1FSBk78yJ8Hww`) | Checkout rendered "Unlimited AI answers … with no daily cap" beside the $20/mo price — a false claim at the moment of payment, and the only place it existed (the site itself says "Up to 150 AI messages a day"). Rewritten through the API to the site's own three bullets and re-verified in Chrome on a fresh session (then expired). Before/after JSON kept in `.audit-tmp/stripe-checkout/` |

## Pixel pass — 2026-10-07 late (append-only; another writer held the tables above)

**Correction that unblocks three rows: #15's "true 390/1440 captures are blocked" premise is
empirically false.** Playwright 1.63 is already a devDependency and the ratchet already drives
arbitrary viewports (`verify-release.mjs:919`); capturing live production at any width takes about
a minute. Ran 55 captures — 11 public routes × 320/390/768/1024/1440, with `hasTouch`/`isMobile`
set on the three mobile widths so `(pointer: coarse)` actually matches (scripts + artefacts in
`.audit-tmp/pixel-pass/`). **Measured green across the board: zero horizontal overflow at every
width, exactly one `h1` per page, zero 44px touch-floor violations on hook classes, zero sub-16px
form-font violations, zero unnamed controls, zero `img` without `alt`, and the focus ring computes
to `solid 2px rgb(229,222,210)` at `2px` offset — the BRAND.md spec exactly.** Screenshots read at
1440/390/320 for `/`, `/faq`, `/onboard`, `/support`. Two things this does NOT cover, stated so
nobody re-derives them: the **authed** surfaces (`/chat`, `/settings`, `/baseline`, `/account`,
`/redeem`) remain blocked by ground rule 2 (no audit accounts in production) — not by the browser
bridge; and a first-pass contrast probe reported 1.01:1 on `.btn-aurora`/`.btn`, which is a **tool
artifact, not a defect** — those buttons paint their background with gradients/pseudo-elements, so
reading `backgroundColor` resolves transparent; the pixels show cream-on-dark and dark-on-cream,
both legible. Trust the screenshot.

### New rows (P2)

| # | Task | Owner | Status | Evidence |
|---|------|-------|--------|----------|
| 37 | **Sovereign+ sells a benefit the code does not implement.** Delete or build the two "priority" lines | agent | open | `landing-client.tsx:298` "Priority reply speeds" and `pricing-table.tsx:22` "Priority support (a person replies first)". Verified against the engine: `sovereign-model.ts` has no subscription-tier routing (its "tier" hits are the model *fallback ladder*, shared by everyone), and the operator `support-notification` template (`email.ts:320-335`) carries only name/email/topic/message — no tier field, so nobody *can* reply first. The only real tier difference is the daily cap (5 vs 150) plus invite gating. Same defect class as the Stripe product-description fix above, and it sits at the moment of payment. Minimal honest fix: delete both rows. |
| 38 | **The human-first vocabulary decree is unenforced in the AI channel — and the prompt teaches the banned words.** | agent | open | `sovereign-prompt.ts:148` offers `"one pattern in your Baseline is..."` as *approved* phrasing; `:207` makes "What pattern have you observed?" one of the Four Levels of Inquiry; `:244` says "offer the single **reading**" and endorses `"One reading is…"` as a valid opener. `sovereign-reasoning.ts:422,434,445,449,761,837` push "pattern"/"structural reading" into prompt context the model may echo verbatim (the comment at `:443` admits exactly that). No prompt rule forbids the banned set — `:127-128` and `:246` forbid identity labels, moralizing and disclosure-inventories, but never "pattern"/"friction"/"read(ing)". So BRAND.md's most-emphasised copy rule exists only in the docs, not where AI output is decided. |

### New rows (P3)

| # | Task | Owner | Status | Evidence |
|---|------|-------|--------|----------|
| 39 | Dead Tailwind class renders the plans table untinted | agent | open | `pricing-table.tsx:94` uses `bg-surface/40`, but `tailwind.config.ts:27-30` defines `surface` as `1|2|3` with **no DEFAULT** — the class cannot compile, so the wrapper silently gets no surface tint. Fix `bg-surface-1/40`. Same family: `journey-thread-row` (`chat-client.tsx:249`) has no rule in `globals.css` and no harness selector (unlike `.journey-past-trigger`/`.journey-thread-badge`) — inert class name. |
| 40 | Sub-AA body text on the dark canvas | agent | open | Against `--background 30 8% 4.5%`: `text-muted-foreground/50` = 3.10:1 (`chat-client.tsx:154,227,264`), `/55` = 3.52:1 (`:1542`), `/60` = 3.99:1 at `text-xs` (`chat-client.tsx:232,1924`, `baseline-drawer.tsx:130,149`, `pricing-table.tsx:57`, `share-card.tsx:222,241`) — all under the 4.5:1 AA floor for small text; `/70` = 5.05:1 passes. Corroborated live: the sweep measured exactly 3.99:1 on the 11px "from NASA/JPL planetary data" label in the landing demo plate. Fix: raise to `/70`. |
| 41 | `<Logo href="#">` is a focusable link that goes nowhere | agent | open | `site-footer.tsx:29`, `landing-client.tsx:329`, `chat-client.tsx:1488`, `error.tsx:27`, `not-found.tsx:25`, `ui/loading.tsx:37`. Keyboard users tab onto a dead control on the error and 404 surfaces — the two places that most need a working next action. Fix: use the `/` default in the footer, drop `href` where the medallion is decorative. |
| 42 | Landing plans CTA drops the return path | agent | open | `landing-client.tsx:300` is `href="/onboard?mode=signup"` with no `next`, so a person who clicks through the pricing block signs up and lands in `/chat` — not back at the plan they were considering. `pricing-table.tsx:152` already does it correctly (`&next=%2Fupgrade`). One-line fix, precedent in-repo. |
| 43 | `/support` form controls overflow by 6px at 200% text | agent | open | Measured at 390×844 with root font-size doubled: inputs, the topic `select`, and the message `textarea` sit at `L=96 R=396`. `scrollWidth` still reports 390 because the parent clips, so **no gate catches this** — the loss is invisible to the ratchet. Minor, but it is the page a paying person goes to for help. |
| 44 | Hand-written touch floors duplicated away from the single hook block | agent | open | AGENTS.md puts the 44px floor in exactly one place (the `@media (pointer: coarse)` block). Violations: `terms-gate.tsx:135,141,159,166` (`tap-line`/`btn-focal` *plus* `min-h-[44px]`, which inflates desktop contrary to `globals.css:536-541`), `journey-canvas.tsx:149,197,205,240,315` and `chat-client.tsx:1510` (`min-h-[2.75rem]` inside `.journey-bar`, already floored at `globals.css:543`), and `sigil-composer.tsx:100,112` which carry a literal but **no hook class at all**. NOT violations: `chat-client.tsx:1641` and `offline-retry.tsx:71` — the ratchet asserts those literals verbatim (`verify-release.mjs:255,3608`). |
| 45 | The 10-file design-token batch still has no numbered row | owner | open | It is named several times in prose above but never filed, which breaks #14's own rule ("no work starts on an item without its own row"). Contents verified by inspection: `Eyebrow` extraction, `duration-[240ms]`/`ease-spring` motion tokens, `btn-glass` secondary CTA, and removal of hand-written `min-h-[48px]`/`rounded-panel`/glow-shadow across `about`/`blog`/`blog[slug]`/`faq`/`invite`/`support`/`upgrade`/`offline`/`s/[id]`/`lens-page`. Its dependencies all resolve (`Eyebrow` tracked, `ease-spring` at `globals.css:273`, `btn-glass` at `:299`) and dropping `min-h-[48px]` is *correct* — `.btn-focal` is floored by the coarse hook at `:614`. Adjudicate: ship it as its own pathspec-isolated commit, or revert it. |
| 46 | Legal-page heading register drift | agent | open | `terms/page.tsx:19-53` uses legalese ("1. Acceptance of Terms") while `privacy/page.tsx:18-47` uses the brand register ("1. What we collect"). BRAND.md bans the legalese register. Low risk, one page, do it with the next copy pass. |

### Re-triage of rows already filed

| # | Correction |
|---|---|
| 34 | **Mis-prioritised as "P4 speculative" — it is a live, five-line info leak.** `api/health/route.ts` returns `{ status: "degraded", latency_ms, error: message }` on an unauthenticated public route, and composes `VECTORIZE.describe: ${vErr.message}` into it deliberately. *Observed mid-pass: another tab has `src/app/api/health/route.ts` modified in the worktree, so this may already be in flight — check before starting it.* |
| 35 | **Correctly low-priority, and the reason should be recorded so nobody over-engineers it.** Owner rights require `email_verified === 1` (`owner.ts:66`), so signing up as `chadowen93@gmail.com` grants nothing without access to that inbox. A stable user-id allowlist is still tidier; it is not urgent. |
| 36 | **Also correctly low-priority, for a reason the row does not state.** Deletion needs only a session JWT, but the cookie is `sameSite: "lax"` (`auth/route.ts:269`), so a cross-site delete is not reachable. Re-auth is defence-in-depth, not a hole. |
| 11 | Shipped while this pass ran: committed `1737269`, pushed, main Worker at 100% on `de117610` (17:54 local), tail on `1c3cd8c2`. One residue: the capped-`welcome` branch (`auth/route.ts:256`) drops the send with **no `console.warn`**, unlike the verify and invite branches — so a real signup silently losing its welcome mail is invisible in logs. |
| — | **Measurement note for future passes:** `/support` and `/onboard` never reach Playwright's `networkidle` (60s timeout at all five widths) because Turnstile holds a connection open. Use `domcontentloaded` + a fixed settle when scripting those two, or the capture silently degrades. |
