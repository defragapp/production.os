---
name: goal
description: Recover the true open-task ledger for this repo by reading every recent Qoder chat thread, deduping it against what actually shipped in git, and compiling one complete list of unfinished tasks — then optionally working through it in priority order. Use when the user says "/goal", asks to continue, finish, or "work through all" outstanding tasks, wants a status roll-up across sessions, or asks what is still unfinished. Also triggers on "what did the other tabs leave open", "compile all unfinished tasks", "what's left".
---

# Goal — thread-crossing task ledger

The problem this solves: several Qoder threads work this repo at once. Each one leaves
findings, deferrals, and blocked items that no other thread can see. A thread that ends
mid-verification, or one that ships work another thread also planned, both make a single
session's task list wrong. `/goal` rebuilds the list from evidence, not memory.

Two modes, decided by the user's wording:

- **Compile** (default when asked "what's left", "list everything"): scan → reconcile →
  write the ledger → report. No source edits.
- **Work through** (when asked to "continue", "work through all", "finish it"): the same,
  then execute the agent-actionable items in priority order and keep the ledger updated.

## Hard rules

1. **Evidence beats chat history.** A thread's "still open" list is a hypothesis. Before
   reporting any item as open, prove it against the repo: `git log`, `git status`, the
   file in question, an unchecked box in `docs/launch-checklist.md`, or a live HTTP check.
   Items shipped by a *different* thread get marked done with the commit SHA that shipped
   them — never re-implemented.
2. **Single writer.** Before editing anything, check for competing builds
   (`pgrep -fl "verify-release|next build|opennextjs-cloudflare"`). If another agent owns
   the checkout, stop and report; do not start a third build. Shared `.next/` contention
   invalidates `verify:release` rather than revealing a defect.
3. **Verify before declaring done.** `npm run verify:release` is the only release evidence.
   Never run it while another build is in flight. Its gate count is whatever
   `scripts/verify-release.mjs`'s own header says at that moment — do not trust, or write
   down, any count quoted elsewhere (including this file).
4. **Commit and push only on explicit go-ahead.** "work through all the tasks" authorizes
   edits; it does not authorize shipping. Ask before `git push origin HEAD:main`. When
   told to ship, follow the repo's current release contract in `AGENTS.md` — push is the
   primary path, CLI deploy only as a fallback with no build in flight — and confirm both
   Workers via GitHub check-runs, not `wrangler versions list`.
5. **Owner-only items stay on the owner.** Cloudflare dashboard actions, credential
   revocation, Stripe webhook registration and real purchases, zone Cache Rules, Fathom
   data, and anything calendar-gated get listed as blocked-with-exact-steps. Never
   simulate, stub, or mark them done.
6. **Preserve, don't rewrite.** Behavior changes go test-first. Safety gates, consent
   boundaries, the non-streaming chat contract, `PASSWORD_PEPPER`, PBKDF2 ≤100k
   iterations, both Workers' `redact_query_string`, and the zero-CLS machinery are not
   negotiable for convenience. Copy and touch-target rules in `AGENTS.md` apply to every
   user-facing string and control.

## Step 1 — Find the threads and read them

```bash
node .qoder/skills/goal/scripts/scan-threads.mjs --days 2
node .qoder/skills/goal/scripts/scan-threads.mjs --days 3 --full     # include open-task lines
node .qoder/skills/goal/scripts/scan-threads.mjs --list              # just session mtimes
```

The script locates the current workspace's Qoder cache directory automatically (override
with `--project <slug>` or `--dir <path>`), sorts sessions by last activity, and prints per
session: every user query (the goals) and the closing assistant reports. Skim
`~/.qoder/cache/.../conversation-history` only through the script — the raw `.jsonl` files
are large and interleaved with tool output.

For each thread record: stated goal, what it shipped (commit SHAs), what it explicitly
deferred, what it left unverified, and what it blocked on. A thread that ends mid-command
has an *unknown* outcome, not a passing one.

## Step 2 — Reconcile against reality

```bash
git log --oneline -20
git status --short
grep -n "^- \[ \]" docs/launch-checklist.md
```

Then, item by item: does the repo already contain the fix? Is the doc claim still false in
the file? Does the live route still behave that way? Prefer one cheap check over one
assumption. Drop anything a later thread superseded, and note the superseding SHA.

## Step 3 — Write the ledger

Write or refresh `docs/open-tasks.md` using the format in [LEDGER.md](LEDGER.md): one row
per task, with priority, owner (`agent` / `owner` / `blocked`), source thread, status, and
the evidence that established it. The ledger is the input for the next `/goal` run, so an
item that gets closed must record *how* it was closed.

## Step 4 — Work through it (only in work-through mode)

Take items strictly in this order, and never spend polish effort while a P0/P1 is open:

1. P0 credential / privacy / data-integrity items that are agent-actionable
2. P1 launch blockers
3. P2 reliability, comprehension, performance, maintainability
4. P3 polish and P4 speculation (last, or leave)

Per item: `TodoWrite` one entry → reproduce or read the evidence → smallest defensible
change (with the regression test first if behavior changed) → re-check the live or local
surface → mark the ledger row done with evidence. If an item turns out to be not
reproducible, not real, or owner-only, say so in the ledger and move on rather than
manufacturing a change.

Batch the local verification: one `npm run verify:release` after the set of edits, not one
per edit, and only when the checkout is uncontended.

## Step 5 — Report

Report as: goals found per thread → what was already shipped by someone else → ledger path →
what changed in this run with file paths → what is left and exactly why → the one question
or owner action that unblocks the next step. State unverified things as unverified; a
`verify:release` run whose final line you did not read counts as unknown, not green.

## Additional resources

- Ledger format, priority bands, and owner-only taxonomy: [LEDGER.md](LEDGER.md)
