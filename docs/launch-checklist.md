# Launch Checklist — post-cutover remaining work

Companion to `cloudflare-account-migration.md` (the runbook is the source of
truth for rule values, ids, and history). Every item below is either gated on
an external surface (Stripe dashboard, zone tokens, the source account) or on
calendar time — nothing here is blocked on code. Cutover completed
2026-10-01/02; production runs on the ASU account, D1 migrations 0001–0007
applied, with a pre-cutover D1 snapshot (`asu-prod-backup-20261002T172232Z.sql`)
kept as an off-box operator backup — it lives in the gitignored `.audit-tmp/`
scratch dir, is not committed, and re-exports via
`npx wrangler d1 export production-os-db --remote`. Workers Builds is connected
and verified 2026-10-06: a push to `main` builds and deploys BOTH Workers
(check-runs `Workers Builds: production-os` / `sovereign-tail`); the CLI
`npm run deploy` is the fallback only.

## 1. Now — full release-gate coverage (no external dependency)

- [x] Run `npm run verify:release` in a host terminal where the OpenNext
      preview worker boots. Done 2026-10-05/06: two full green runs (116/116
      gates, preview-backed gates passing) on the host before the copy and
      Builds work shipped.
- [x] ~~First CI run: add repo secrets~~ — moot. The `verify.yml` workflow was
      retired 2026-10-06 (dead-on-arrival: GitHub Actions billing lockout, and
      `cf-typegen:check` is un-satisfiable in CI anyway). Release coverage is
      Workers Builds (real build + deploy per push) plus the local
      `verify:release` ratchet as the pre-push gate.

## 2. Stripe go-live (dashboard-side)

- [ ] Register the webhook endpoint in the Stripe Dashboard →
      `https://sovereign.defrag.app/api/webhooks/stripe` subscribed to the
      eleven events the handler already processes
      (`checkout.session.completed`, `checkout.session.async_payment_failed`,
      `customer.subscription.created`, `…updated`, `…deleted`, `…paused`,
      `…resumed`, `invoice.paid`, `invoice.payment_succeeded`,
      `invoice.payment_failed`, `invoice.payment_action_required` — canonical
      list in `src/app/api/webhooks/stripe/route.ts`). Copy the signing
      secret → `wrangler secret put STRIPE_WEBHOOK_SECRET` (ASU worker).
- [ ] One live test purchase end-to-end (checkout → tier flip → receipt
      email), then cancel and confirm the dunning/expiry path leaves the
      account in `free`.
- Optional: drop a read-capable `STRIPE_SECRET_KEY` into `.dev.vars` and the
  endpoint registration can be verified programmatically
  (`GET /v1/webhook_endpoints`) instead of by eye.

## 3. Zone Cache Rules (cost optimization only — Workers Paid removes the
    1102 availability risk)

- [ ] Author the 4 cache rules with the values recorded in runbook Phase 7.
      Route: dashboard, **or** a User API Token with `Zone > Cache Rules:
      Edit` hitting `PUT /zones/{zone_id}/cache_rules` (the migration token
      gets `7003` there — `http_request_cache_settings` entrypoint accepts
      eligibility only, no TTL fields).

## 4. T+10 days (by 2026-10-12) — revert trace head sampling

- [x] `wrangler.jsonc` reverted `head_sampling_rate` 1.0 → 0.1 on 2026-10-06
      (owner directive to close the checklist early — the full-trace window
      ran 4 days instead of 10; migration has been healthy throughout). Shipped
      via push → Workers Builds (the canonical path), not CLI. The durable-edit
      rule below still governs: the value lives in `wrangler.jsonc`, so any
      API-only patch is silently undone by the next deploy.
      File edit + deploy is the only durable path.

## 5. T+14 days green (by 2026-10-16) — Phase 8, decommission gmail

- [ ] Preconditions: ASU healthy for 14 days; freshest D1 export saved
      outside the repo-ignored tmp dir; Gmail-residue items from runbook
      §"Gmail residue" closed.
- [ ] Then (source-account login required): cancel Workers Paid subscription
      on source, delete source Worker/D1/KV/Vectorize per runbook Phase 8.
      Rollback path until then: restore from the prod backup; ASU KV is
      session-only and re-populates.

## 6. Next credential rotation — token scope trim + vestigial secrets

- [ ] **Revoke immediately** the token `steep-smoke-dc94` and its companion
      R2 S3 access/secret-key pair shown on its creation panel — both were
      pasted into chat on 2026-10-02, so both are compromised-on-paste by
      this project's standing rule (same incident class as the 2026-09-30
      `cfat_` token). Never hand external agents credentials through chat;
      create scoped tokens directly in the target environment. Reminder:
      Cloudflare tokens cannot clone GitHub repos — repo access needs a
      read-only GitHub PAT/deploy key instead.
- [ ] Rotate `ASU_MIGRATION_TOKEN` down: drop `Zone > Read` (the app needs no
      zone scopes; deploy + secret push are account-scoped).
- [ ] Rotate/revoke the vestigial `R2_*` keys in `.dev.vars` (no `src/`
      references) and confirm the `cfat_`/clone-token items from the runbook
      checklist table are closed.
