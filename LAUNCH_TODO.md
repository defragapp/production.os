# LAUNCH TODO

## 🔴 CRITICAL BLOCKERS
- Secret hygiene: rotate the live Stripe secret key leaked in chat (#28) and update Workers bindings.
- `npm run lint`, `npm run typecheck`, `npm run cf-typegen:check`, and `npm run verify:release` all passed in this audit run.
- Re-run the release gate before launch if any auth, routing, D1, or Cloudflare config changes land.

## 🟡 REFINEMENT
- `SELF`, `PEOPLE`, and `SYSTEMS` ARE dedicated routes: `src/app/self/page.tsx`, `src/app/people/page.tsx`, `src/app/systems/page.tsx` all exist and serve 200. (An earlier version of this note claimed matching route segments were missing — that was wrong.)
- `tail-worker/src/index.ts` no longer carries a `pingParent()` no-op placeholder; the claim to decide its fate is stale. The Tail Worker forwards alert-worthy signals to `SUPPORT_INBOX` (see `wrangler.jsonc` `tail_consumers`).
- Add or remove runtime Agent Lee integration as needed; the only live match in this audit was documentation, not app code.
- Populate or intentionally hide the empty testimonials/social-proof surface if launch copy should feel fully finished.
- Review landing-page composer copy for any remaining placeholder feel around the demo input and send affordance.

## 🟢 LAUNCH PROTOCOL
1. `npm run verify:release`
2. `rm -rf .open-next .next && npm run deploy`
3. `git status --short`
4. `git push origin main`

## 🔐 Secret hygiene — Stripe live key rotation checklist (#28)
1. In Stripe Dashboard (Live mode), create a new Live secret key.
2. Update BOTH Workers’ secret binding for the key name used by the app: `STRIPE_SECRET_KEY`.
   - Also confirm `STRIPE_WEBHOOK_SECRET` is set and matches the active endpoint.
3. Do NOT edit bindings while a push-triggered build is in flight (collision rule).
4. After editing bindings, run locally: `npm run cf-typegen` and commit the updated `worker-configuration.d.ts` so CI’s `cf-typegen:check` stays green.
5. Probe production: `/api/health`, then a Checkout session start (no purchase) to confirm Stripe works.
6. In Stripe Dashboard, immediately disable the old Live key.

