# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## Stack
Next.js App Router + React 19 on Cloudflare Workers via `@opennextjs/cloudflare` (OpenNext). D1 (SQLite), KV (sessions), Workers AI (gateway `sovereign-ai-gateway`), Stripe, Resend, Turnstile. `nodejs_compat` is implicit at `compatibility_date` ≥ 2026-08-04 — do NOT add it to `compatibility_flags`; no `runtime = "edge"` exports.

## Commands
- `npm run build` alone does NOT emit the Workers bundle. Use `npx opennextjs-cloudflare build`. Never add a `buildCommand` to `open-next.config.ts` — it causes infinite build recursion.
- `npm run verify:release` is the full pre-commit/pre-deploy ratchet. It must be green before any commit or deploy; `scripts/verify-release.mjs`'s own header is the source of truth for the gate/check count (do not trust counts quoted elsewhere).
- After editing `wrangler.jsonc` bindings, run `npm run cf-typegen`. `worker-configuration.d.ts` is committed and CI's `cf-typegen:check` fails on drift.

## Release (push-to-deploy IS live and verified — CLI is the out-of-band fallback)
- **Verified 2026-10-09 (second pass, by TAG) with this account's own Cloudflare API (`ac9a47dd…8349`):** Workers Builds **is** provisioned and wired. The earlier "NOT provisioned / CLI-only" conclusion was a **query bug**: Builds API paths take the worker **tag** (`external_script_id`), and name-based queries (`/builds/workers/{name}/…`) return `[]`/`12040` — never trust them. Queried by tag:
  - **Triggers** (both `branch_includes ["main"]`, `path_includes ["*"]`): `production-os` `ea6e4bc3-d4b4-45bb-8bab-69bada6f3933` (created 2026-10-02T07:38Z), `sovereign-tail` `7115623b-7785-4a0a-918b-1092591fde32` (created 2026-10-06T01:04Z); both modified 2026-10-09T17:49Z during the #50 repair. Repo connection `603a2d20-a840-4838-964b-83abfd21124a` (`defragapp/production.os`) has existed since 2026-09-18 (Cloudflare GitHub App installed).
  - **Builds fire on every push to `main` and are green**: 2026-10-09 18:01Z, 18:25Z, 20:40Z, 20:48Z, 20:50Z, 20:52Z — `build_outcome: "success"` on BOTH Workers. Latest `production-os` build `1767a466-…` (commit `93fb2dd`) deployed **version `1602b4df-16cf-4469-ac9d-4712d8b5000f`**, which is the live deployment (`6ae1c673-…`, 20:54:47Z).
  - **Build tokens are wired and valid — DO NOT delete**: `production-os` → `f40e7197-1b3f-4f06-bbd3-be535ede6c27`; `sovereign-tail` → `f96c21f9-3d32-43f6-b7f1-8fc8ba4b5bf5`. Every green build since 18:01Z uses them (verified in `build_trigger_metadata`).
  - **Why deployments read `source: "wrangler"`:** the triggers' `deploy_command` is literally `npx wrangler deploy` (`production-os`) / `npx -y wrangler@4.131.1 deploy` (`sovereign-tail`) — the BUILD system runs wrangler, so `source: "wrangler"` means Builds deployed, not CLI. To verify builds, use `GET /builds/workers/{tag}/builds` + `GET /builds/builds/{build_uuid}/logs`; never infer from deployment source alone.
- **The shipping path is `git push origin main`** — each push fires both triggers (production-os + sovereign-tail), so the tail Worker (and its `redact_query_string`) is never left behind — the exact drift Gate 33 exists to prevent. CLI `npm run deploy` (chains `opennextjs-cloudflare deploy` + `tail:deploy`) remains only as an out-of-band fallback.
- Collision rule (live, not hypothetical): never run a CLI deploy (`npm run deploy` / `opennextjs-cloudflare deploy` / `wrangler deploy`) while a push-triggered build is in flight — two builds of the same commit collide and stall static-asset binding propagation (the 503/hang on `/`, `/privacy`, `/terms`). `versions list`/`deployments list` sort ascending — the newest entries are at the BOTTOM.
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
