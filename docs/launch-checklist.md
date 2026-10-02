# Launch Checklist — post-cutover remaining work

Companion to `cloudflare-account-migration.md` (the runbook is the source of
truth for rule values, ids, and history). Every item below is either gated on
an external surface (Stripe dashboard, zone tokens, the source account) or on
calendar time — nothing here is blocked on code. Cutover completed
2026-10-01/02; production runs version `11a39179` on the ASU account, D1
migrations 0001–0007 applied, backup at
`.audit-tmp/asu-prod-backup-20261002T172232Z.sql`.

## 1. Now — full release-gate coverage (no external dependency)

- [ ] Run `npm run verify:release` in a host terminal where the OpenNext
      preview worker boots. In the agent sandbox the preview-backed gates
      (~48) skip because workerd refuses the ESM-default interop of
      `.open-next/worker.js` locally — production is unaffected; CI
      (`.github/workflows/verify.yml`) runs the same ratchet on ubuntu where
      workerd + system Chrome boot normally.
- [ ] First CI run: add repo secrets `CLOUDFLARE_API_TOKEN` (a token scoped
      to Workers Scripts read + AI, or reuse an account token) and
      `CLOUDFLARE_ACCOUNT_ID`. Without them the ratchet still passes; the
      remote-AI gates count as skipped.

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

- [ ] `wrangler.jsonc` line 12 currently reads `"head_sampling_rate": 1.0`
      (full migration visibility; README documents the steady state as 0.1).
      Edit back to `0.1`, then ship via the canonical path (push → poll
      `npx wrangler deployments status` ~3 min → one CLI `npm run deploy`
      only if no build-system version appeared). Do **not** shortcut this
      with `PATCH …/environments/production/settings` alone: the value lives
      in `wrangler.jsonc`, so the next deploy re-applies `1.0` and silently
      undoes the API change. File edit + deploy is the only durable path.

## 5. T+14 days green (by 2026-10-16) — Phase 8, decommission gmail

- [ ] Preconditions: ASU healthy for 14 days; freshest D1 export saved
      outside the repo-ignored tmp dir; Gmail-residue items from runbook
      §"Gmail residue" closed.
- [ ] Then (source-account login required): cancel Workers Paid subscription
      on source, delete source Worker/D1/KV/Vectorize per runbook Phase 8.
      Rollback path until then: restore from the prod backup; ASU KV is
      session-only and re-populates.

## 6. Next credential rotation — token scope trim + vestigial secrets

- [ ] Rotate `ASU_MIGRATION_TOKEN` down: drop `Zone > Read` (the app needs no
      zone scopes; deploy + secret push are account-scoped).
- [ ] Rotate/revoke the vestigial `R2_*` keys in `.dev.vars` (no `src/`
      references) and confirm the `cfat_`/clone-token items from the runbook
      checklist table are closed.
