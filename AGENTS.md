# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## Stack
Next.js App Router + React 19 on Cloudflare Workers via `@opennextjs/cloudflare` (OpenNext). D1 (SQLite), KV (sessions), Workers AI (gateway `sovereign-ai-gateway`), Stripe, Resend, Turnstile. `nodejs_compat` is implicit at `compatibility_date` ≥ 2026-08-04 — do NOT add it to `compatibility_flags`; no `runtime = "edge"` exports.

## Commands
- `npm run build` alone does NOT emit the Workers bundle. Use `npx opennextjs-cloudflare build`. Never add a `buildCommand` to `open-next.config.ts` — it causes infinite build recursion.
- `npm run verify:release` is the full pre-commit/pre-deploy ratchet. It must be green before any commit or deploy; `scripts/verify-release.mjs`'s own header is the source of truth for the gate/check count (do not trust counts quoted elsewhere).
- After editing `wrangler.jsonc` bindings, run `npm run cf-typegen`. `worker-configuration.d.ts` is committed and CI's `cf-typegen:check` fails on drift.

## Release (Workers Builds: push path under verification — CLI remains the proven path today)
- **Diagnosis (2026-10-05, dashboard AI + build logs):** the earlier "not connected" reading was wrong in detail — a Builds project for `production-os` has existed in this account since 2026-10-02 (repo connection since Sep 18) and every push DID trigger a build, but all ~14 failed at deploy because the build command was `npm run build` (emits `.next/` only; OpenNext deploy needs `.open-next/`). Fixed to `npx opennextjs-cloudflare build` on 2026-10-05; a second project for `sovereign-tail` is being created alongside. Until `npx wrangler versions list` shows a `push_event` version on BOTH Workers, treat the CLI as the only verified deploy path.
- Builds needs **TWO projects, one per Worker**: the main project uses root `/`, build `npx opennextjs-cloudflare build`, deploy `npx wrangler deploy`; the second uses root `tail-worker/`, NO build command, deploy `npx -y wrangler@4.131.1 deploy` (pin matches the repo's devDependency; `tail-worker/` has no package.json, so this fetches wrangler per build). Root `/` + `-c tail-worker/wrangler.jsonc` does NOT work for the second project: Workers Builds matches the dashboard Worker name against the wrangler config in the project's root directory, and root's config says `production-os`. Both projects are required — a push that fires only the main project leaves the tail Worker (and its `redact_query_string`) behind, the exact drift Gate 33 exists to prevent.
- The CLI path `npm run deploy` ships BOTH Workers (it chains `npm run tail:deploy`). It stays the primary path until a push-triggered pair lands green; then it becomes the fallback.
- Collision rule: never run a CLI deploy (`npm run deploy` / `opennextjs-cloudflare deploy` / `wrangler deploy`) while a push-triggered build is in flight — two builds of the same commit collide and stall static-asset binding propagation (the 503/hang on `/`, `/privacy`, `/terms`). Poll `npx wrangler versions list` first and look for `Source: push_event`: that value means the build system deployed, so stop and wait. Do NOT infer the deploy source from the `Author` field — a blank Author is a Secret Change, and `version_upload` is ambiguous between the CLI and upload-based deploys. Absence of `push_event` is the reliable signal.
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
