# Ledger format — `docs/open-tasks.md`

The ledger is the single durable artifact `/goal` reads and writes. Its whole job is to make
"what's left" answerable without re-reading chat history.

## Shape

```markdown
# Open tasks — compiled <YYYY-MM-DD HH:MM> from threads <ids>

Current evidence: HEAD `<sha>` (= `origin/main`), working tree <clean|dirty: n files>,
last full ratchet: <result + which thread read it, or "no green run seen">.

## P0 — security, privacy, data integrity, production failure
| # | Task | Owner | Status | Source thread | Evidence |
|---|------|-------|--------|---------------|----------|
| 1 | Revoke token `<name>` + companion key pair | owner | blocked-dashboard | 4b798035 | checklist §6 unchecked |

## P1 — launch blocker / serious user-facing defect
## P2 — reliability, comprehension, performance, maintainability
## P3 — polish
## P4 — speculative (do not turn into architecture)
## Closed this pass
| Task | Closed by | How verified |
```

## Field rules

- **# is stable.** Never renumber an open row; new tasks append. Closing a row moves it to
  *Closed this pass* with the SHA, command output, or check that proved it.
- **Owner** is exactly one of `agent` (I can do it here), `owner` (a human must act in an
  external control plane), `blocked` (needs a credential, device, calendar date, or a
  decision). `owner` and `blocked` rows must carry the exact next action — the dashboard
  path, the CLI command, or the decision question — not a restatement of the problem.
- **Evidence** cites a file path, line, commit SHA, command result, or HTTP status. A claim
  with no evidence is a question to verify in Step 2, not a row.
- One row = one verifiable thing. Compound findings split into their independently
  actionable parts; parts that are genuinely one decision stay one row.

## Owner-only taxonomy for this repo

Anything that lives outside the checkout is `owner`, and `/goal` never marks it done:

- Cloudflare dashboard: API-token revocation and scope rotation, zone Cache Rules, Workers
  Builds project settings, secrets added via the UI
- Stripe: webhook endpoint registration, the signing secret, any real purchase, refund, or
  cancellation — never simulated, never test data in production
- Analytics (Fathom) and operator inboxes
- Legal/brand decisions: currency and liability disclosures, astrology-adjacency framing,
  whether a trust surface (`/team`) exists, populating testimonials with real permitted quotes
- Calendar gates: decommissions, sampling reverts, post-migration cleanup windows

## Priority discipline

- Never open a P3/P4 row's remediation while a P0 or P1 row is open and agent-actionable.
- A deferred finding stays a row with the reason for deferral, so the next pass can pick it
  up without re-deriving it (e.g. "left as-is: explicit availability trade-off").
- Recurring-doc-drift rows are cheap and should be closed in one pass rather than
  accumulated — stale gate counts, table counts, and superseded deploy claims actively
  mislead future sessions.
