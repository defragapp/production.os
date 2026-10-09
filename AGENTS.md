# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## Stack
Next.js App Router + React 19 on Cloudflare Workers via `@opennextjs/cloudflare` (OpenNext). D1 (SQLite), KV (sessions), Workers AI (gateway `sovereign-ai-gateway`), Stripe, Resend, Turnstile. `nodejs_compat` is implicit at `compatibility_date` ≥ 2026-08-04 — do NOT add it to `compatibility_flags`; no `runtime = "edge"` exports.

## Commands
- `npm run build` alone does NOT emit the Workers bundle. Use `npx opennextjs-cloudflare build`. Never add a `buildCommand` to `open-next.config.ts` — it causes infinite build recursion.
- `npm run verify:release` is the full pre-commit/pre-deploy ratchet. It must be green before any commit or deploy; `scripts/verify-release.mjs`'s own header is the source of truth for the gate/check count (do not trust counts quoted elsewhere).
- After editing `wrangler.jsonc` bindings, run `npm run cf-typegen`. `worker-configuration.d.ts` is committed and CI's `cf-typegen:check` fails on drift.

## Release (CLI is the shipping path — Workers Builds is NOT provisioned on this account)
- **Verified 2026-10-09 with this account's own Cloudflare API (`ac9a47dd…8349`):** Workers Builds is **not** provisioned. `GET /builds/workers/{name}/triggers` and `…/builds` return `[]` for BOTH `production-os` and `sovereign-tail`; build config returns **12040** ("No build configuration associated with that script tag"); and every deployment ever on both Workers is `source: "wrangler"` (CLI), including the latest (2026-10-09 20:32Z). There is no repo connection, no `.github/workflows`, hence no "Workers Builds" check-runs. The two build tokens (`f40e7197…`/`f96c21f9…`, created 2026-10-05) are orphaned — not wired to any trigger. **Earlier "push-to-deploy is live (verified 2026-10-06)" claims describe infrastructure the live API shows was never provisioned. Do not claim push-to-deploy works unless you have verified triggers/builds via the Builds API yourself.**
- **The shipping path is `npm run deploy`** — it builds and deploys BOTH Workers by chaining `opennextjs-cloudflare deploy` + `npm run tail:deploy` (`wrangler deploy --config tail-worker/wrangler.jsonc`), so the tail Worker (and its `redact_query_string`) is never left behind — the exact drift Gate 33 exists to prevent. Push to `main` updates source of truth only; it does **NOT** deploy (no triggers exist to fire).
- Collision rule: never run a CLI deploy (`npm run deploy` / `opennextjs-cloudflare deploy` / `wrangler deploy`) while a push-triggered build is in flight — two builds of the same commit collide and stall static-asset binding propagation (the 503/hang on `/`, `/privacy`, `/terms`). With zero triggers provisioned this cannot fire today, but keep the rule if Workers Builds is ever wired. `versions list`/`deployments list` sort ascending — the newest entries are at the BOTTOM.
- Do NOT treat `typecheck + lint + test` as sufficient. They passed fully green on a commit whose OpenNext bundle could not build (ESM/CJS interop). Gate 1 — the clean OpenNext build — is the only check that catches bundling regressions.
- Verify before shipping: `npm run verify:release` (all gates green, or do not ship).

## Copy & vocabulary (product-critical)
Banned in user-facing copy and AI output: "pattern"/"patterns" as a noun for what the AI surfaces (→ "what keeps happening", "the dynamic"), "friction" (→ "tension", "pressure"), "ephemeris"/"astrological transit" (→ "NASA/JPL planetary data"), "activation loop"/"field geometry"/"firewall"/"entropy"/"telemetry", pathology labels ("narcissist", "toxic", "borderline", "gaslighting", "diagnosis"), and calling AI output a "read"/"reading" (→ "answer"). Sentence case for headings/buttons/nav/CTAs; proper nouns keep capitals (Baseline, Sovereign, Sovereign+, NASA, JPL, Stripe). Honest claims only — never "clinically validated".
EXCEPTION: backend engine identifiers keep those words (`PatternCandidate`, `scanPatternCandidates`, `ctx.patterns`, safety regexes) and MUST NOT be renamed by copy passes.

## Editing rules
- Preserve, don't rewrite: no whole-page rewrites and no deleting working routes/components. Evolve in place with small, verified edits; retain all routes, D1/KV bindings, Stripe flows, and auth logic.
- The touch-size floor and the iOS ≥16px font floor live in ONE place: the `@media (pointer: coarse)` block and the `!important` font-size floor in `src/app/globals.css`, keyed on hook classes (`btn`, `btn-size-icon`, `tap-line`, `nav-link`, …). Put the hook on the element — do not hand-write `min-h-[44px]` or font-size at call sites.

## Runtime & auth gotchas
- PBKDF2 is capped at 100,000 iterations (the workerd WebCrypto ceiling — higher values throw at runtime). `PASSWORD_PEPPER` is an HMAC layer over each hash and must NEVER be rotated after first signup, or every stored password check is invalidated.
- Chat generation is non-streaming (one complete validated answer via Workers AI), delivered to the client as a single SSE `content` event; input capped at 2,000 chars, context windowed to the last 20 messages, `max_tokens=1024`. Do not "add streaming" to the model call.
- Dual memory: `memory_mode='server'` persists threads/journeys to D1; `memory_mode='local'` is zero-retention (client AES-GCM IndexedDB vault, `/api/chat` skips the D1 write).

## Repo etiquette
Conventional commits (`fix(release): …`, `chore(deps): …`, `docs(release): …`). `main` is the trunk.
