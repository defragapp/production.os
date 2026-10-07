# LAUNCH TODO

## 🔴 CRITICAL BLOCKERS
- None found in the current working tree.
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

