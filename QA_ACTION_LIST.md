# QA_ACTION_LIST.md — items held for owner review

Source: full-platform UX/copy walkthrough (Perspectives A/B/C), 2026-10-03.
Unauthenticated visitor, free/unverified user, and Sovereign+ owner lenses were crawled
across every public and authed route. Surface-level copy and link issues were fixed in
the same pass (see the commit). The items below are **copy-accuracy / positioning /
structural** calls that need the owner's decision rather than a blind edit.

## 1. Astrology-adjacency framing is internally inconsistent (content accuracy)
The product openly presents astrological natal bodies, yet two public surfaces claim it
is not astrology and name the systems inconsistently:

- `src/app/about/page.tsx` metadata description: _"…not a diagnosis, **not astrology**,
  not a verdict."_ — but the landing shows zodiac placements (Sun/Moon/Rising, "Ten natal
  bodies", Human Design, Gene Keys). The on-page PRINCIPLES card already uses the safer,
  defensible framing **"Grounded, not fortune-telling"** (about/page.tsx:20). Recommend
  aligning the meta description to "not fortune-telling" for consistency and honesty.
- `src/app/faq/page.tsx` "Where does my Baseline come from?" says the reference systems
  are **"(numerology and Human Design)"**. The actual Baseline combines **astrology**
  (natal bodies), **Human Design**, and **Gene Keys** — "numerology" mislabels astrology
  and Gene Keys is omitted. Recommend naming the systems the same way the landing does.

Owner call: pick ONE canonical framing of the astrological basis and propagate it through
`about`, `faq`, `terms` §2, and the landing provenance strip.

## 2. `middleware.ts` doc-comment drift — RESOLVED (comment corrected, auth logic untouched)
The header comment once listed `/invite` as a public page while the `publicPages` array
(line 55) omitted it and named `/redeem` instead. Behaviour was always correct — `/invite`
is publicly reachable because it falls through the "not an API and not a PROTECTED_PAGE"
branch (line 86) — only the comment was wrong. The comment now names `/redeem` in the
explicit public set and describes `/invite` as fall-through-public. No gate logic changed.

## 3. No `/team` (or founder) page (trust signal / structural)
`src/app/about/page.tsx` carries a code comment noting the operator's background "belongs
on a real /team page once one is authored." For an AI platform selling a paid tier, a
credibility surface (who builds this, why trustworthy) is a conversion/trust lever. New
route + copy — deferred, not a quick patch.

## 4. Observability sampling — main Worker REVERTED; Tail Worker intentionally at full rate
The main Worker's `head_sampling_rate` was already reverted `1.0 → 0.1` (steady state) in
`e8bdcce` — `wrangler.jsonc` now reads `0.1`. The `tail-worker/wrangler.jsonc` value stays
`1.0` on purpose: the Tail Worker only receives a copy of `production-os` events that
survived the main Worker's own 0.1 sampling, so its log volume is already tiny and full
retention there is what makes the operator alert path reliable. `verify:release` does NOT
gate either rate (no gate inspects `head_sampling_rate`); the earlier note claiming it
"feeds Gate 33 expectations" was wrong — Gate 33 is release-path completeness/hygiene.

---
### Notes on what was NOT changed
- No whole-page rewrites; every fix was a minimal in-place string edit preserving all
  routes, bindings, and logic.
- Client-bundle isolation (Gate 28), auth boundaries (401/404/redirect), touch/CLS/a11y
  floors are enforced by `verify:release`; interactions were not hand-regressed.
- Backend `/api/agent-lee` + `src/lib/agent-lee.ts` remain in place and protected (401) —
  correct, just unlinked from public surfaces (prior hotfix).
