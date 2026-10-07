# LAUNCH TODO

## 🔴 CRITICAL BLOCKERS
- None found in the current working tree.
- `npm run lint`, `npm run typecheck`, `npm run cf-typegen:check`, and `npm run verify:release` all passed in this audit run.
- Re-run the release gate before launch if any auth, routing, D1, or Cloudflare config changes land.

## 🟡 REFINEMENT
- Confirm whether `SELF`, `PEOPLE`, and `SYSTEMS` are intended to be dedicated routes or just internal product concepts; the current `src/app` route tree does not expose matching route segments.
- Decide whether `tail-worker/src/index.ts` should keep the `pingParent()` no-op placeholder or be wired to a real owner-bookkeeping endpoint before launch.
- Add or remove runtime Agent Lee integration as needed; the only live match in this audit was documentation, not app code.
- Populate or intentionally hide the empty testimonials/social-proof surface if launch copy should feel fully finished.
- Review landing-page composer copy for any remaining placeholder feel around the demo input and send affordance.

## 🟢 LAUNCH PROTOCOL
1. `npm run verify:release`
2. `rm -rf .open-next .next && npm run deploy`
3. `git status --short`
4. `git push origin main`

