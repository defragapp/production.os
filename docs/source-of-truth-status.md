# Source-of-Truth Status (2026-10-06)

Purpose: keep launch-critical operational facts synchronized when docs drift.

## Active hierarchy
1. Current source code
2. Current tests and release gates
3. Current Cloudflare/deployment configuration
4. Current production behavior (when directly verified)
5. `AGENTS.md`
6. Current product/architecture docs
7. Historical docs/notes/audits

## Contradictions resolved in this pass

### Release path ownership
- **Observed conflict:**
  - `AGENTS.md` and `docs/launch-checklist.md` state Workers Builds is connected and push-to-main is live.
  - `README.md` and `package.json` release comment still described CLI-only deployment.
- **Source-of-truth used:**
  - `AGENTS.md` release section
  - `docs/launch-checklist.md` lines documenting 2026-10-06 verification
- **Resolution applied:**
  - Updated `README.md` release flow to canonical `verify -> push -> confirm`.
  - Updated `package.json` `//release` guidance to push-based canonical path with CLI fallback.

### Launch protocol branch target
- **Observed conflict:** `LAUNCH_TODO.md` launch protocol used `git push origin migrate-to-asu` while repo etiquette defines `main` as trunk.
- **Source-of-truth used:** `AGENTS.md` repo etiquette (`main` is trunk).
- **Resolution applied:** Updated launch protocol to `git push origin main`.

## No-behavior-change guarantee
This pass changes documentation only. No runtime behavior, security logic, data shape, AI reasoning path, or deployment scripts were modified.

## Follow-up checks
- Run `npm run verify:release` before any production ship.
- Confirm both Workers Builds projects (`production-os`, `sovereign-tail`) are green on each release commit.

