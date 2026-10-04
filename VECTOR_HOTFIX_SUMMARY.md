# Sovereign.OS — Vector Identity Hotfix Summary

**Branch:** `migrate-to-asu` → trunk `main`, both at `2a9dbb3` · **Date:** 2026-10-04 · **Status:** shipped to production and proven live
**Scope:** one function (`vectorId`) plus its comments. No other chat-pipeline logic touched.

---

## 1. The defect

`vectorId()` built a composite id out of two full UUIDs:

```ts
return `${userId}::${turn.threadId}::${String(turn.turnIndex).padStart(5, "0")}::${turn.role}`;
```

36 (`userId`) + 2 + 36 (`threadId`) + 2 + 5 (`turnIndex`) + 2 + 4|9 (`role`) = **87 bytes** for a user
turn and **92** for an assistant turn. Cloudflare Vectorize caps ids at **64 bytes**, so every upsert
was rejected:

```
[embedTurn] failed: Error: VECTOR_UPSERT_ERROR (code = 40008): id too long; max is 64 bytes, got 87 bytes
```

Because `embedTurn` runs under `waitUntil` and swallows its own errors, chat kept returning 200s while
the semantic index stayed **completely empty**. Observed before this fix: `wrangler vectorize info
chat-embeddings` → `vectorCount: 0` and `list-vectors` → *"No vectors found in this index"*. Those two
counters lag (see §6b), so the decisive evidence is the log line above: it appeared on **every** turn
captured in `wrangler tail` during the latency study, i.e. a 100% upsert rejection rate, and an id that
is always rejected leaves nothing to index. Semantic recall had never worked in production.

## 2. The change (`src/lib/chat-embeddings.ts`)

The four coordinates are now folded into a fixed-length digest instead of concatenated:

```ts
function fnv1a32(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function vectorId(turn: Turn, userId: string): string {
  const tuple = `${userId}\u0000${turn.threadId}\u0000${turn.turnIndex}\u0000${turn.role}`;
  const a = fnv1a32(tuple, 0x811c9dc5).toString(16).padStart(8, "0");
  const b = fnv1a32(tuple, 0x9e3779b9).toString(16).padStart(8, "0");
  return `ce${a}${b}`;
}
```

`ce` + 8 hex (FNV-1a, seed `0x811c9dc5`) + 8 hex (FNV-1a, seed `0x9e3779b9`) = **18 bytes, constant**.
Two independent seeds carry 64 bits of digest rather than 32; `\u0000` separates the coordinates so
`(a·b)` and `(ab)` cannot collide. Measured properties (scratch harness, `/tmp/idlen.mjs`):

| Check | Result |
|---|---|
| old id length (user / assistant) | 87 / 92 bytes — **over the 64-byte ceiling** |
| new id length | **18 bytes**, worst case over 800 turns |
| determinism (same input → same id) | pass |
| distinct ids over 800 turns | 800 / 800 |
| differs by `userId` / `threadId` / `turnIndex` / `role` | pass on all four |

Why a digest rather than the cheaper edits:

- **Not just dropping `userId`.** Shortening to `${threadId}::${turnIndex}::${role}` fits (54 bytes) and
  leans on the Vectorize `namespace` for user scoping, but `threadId` is partly caller-supplied
  (`/api/chat` accepts one on the wire). Keeping `userId` *inside* the digest means one account cannot
  compose — and therefore cannot target for deletion — another account's turn id even if it guesses a
  thread uuid. The hash is also immune to any future coordinate growing longer.
- **Nothing reads structure *out* of the id.** `searchChat` hydrates matches from Vectorize
  `metadata` (`userId` / `threadId` / `turnIndex` / `role` / `indexedAt`), and recall freshness sorts on
  `metadata.indexedAt`, so losing the old natural sort by id costs nothing. Metadata is unchanged.
- **The delete sweeps keep working.** `deleteThreadEmbeddings` and `deleteUserEmbeddings` enumerate ids
  locally rather than querying Vectorize (there is no filter-by-prefix delete, and `deleteByIds` caps at
  1000 per request). That only holds if ids stay deterministic — they are. Verified live in §4.3.

Rejected alternative: an 8-hex digest prefix plus the raw 36-char `threadId` = exactly 64 bytes. Zero
headroom against a future limit change or a longer id component, so it was not chosen.

## 3. Verification ratchet (all exit 0, run before commit)

| Step | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean, 0 warnings |
| `npm run verify:release` | **116/116 checks green in 526s** — `RESULT: PASS`, zero `✗` lines (`.audit-tmp/verify-vector-fix.log`) |
| `git diff` review | only `vectorId()` + `fnv1a32()` + three comment blocks changed; no call-site, route, schema, or copy edits |

## 4. Deployment & production proof

Preflight first, per the collision rule: `npx wrangler versions list` showed **zero `push_event`
sources** (Workers Builds is still not connected), so the CLI was the only deploy path in flight.

| Worker | Version ID |
|---|---|
| `production-os` | `410c3bcd-3305-4de5-943c-bc67c9f21afe` |
| `sovereign-tail` | `34a93d75-2c0e-42d7-84f6-b8694611bdcd` |

`npm run deploy` exited 0 (`DEPLOY_EXIT=0`, `.audit-tmp/deploy-vector-fix.log`). Worker URL
`https://production-os.cjowen2.workers.dev` → canonical `https://sovereign.defrag.app`.

**4.1 Write path — one live turn, captured against the new version.** Posted a real turn to
`POST /api/chat` as the test account (`defragapp@gmail.com`, `memory_mode='server'`); thread
`8f5e7725-37e2-41af-8e53-d68fcb327ca1`, 213 chars, 5.4s wall. `wrangler tail` for that request shows
`"id": "410c3bcd-3305-4de5-943c-bc67c9f21afe"` (the new version served it), `"exceptions": []`, one
`chat_timing` event (`pre_ms 1011 / gen_ms 3380 / total_ms 4391 / validated true`) and **no
`[embedTurn] failed` line** — that log call is the only thing `embedTurn` writes, and it writes it only
on failure.

Direct read-back, which is the authoritative check:

```
$ npx wrangler vectorize get-vectors chat-embeddings --ids ce111584d4f2199728 ce3ba40a45a5077219
  id ce111584d4f2199728  namespace 1f7a0762-…  {role:"user",      threadId:"8f5e7725-…", turnIndex:0, indexedAt:"2026-10-04T16:48:39.599Z"}  1024-dim
  id ce3ba40a45a5077219  namespace 1f7a0762-…  {role:"assistant", threadId:"8f5e7725-…", turnIndex:0, indexedAt:"2026-10-04T16:48:39.438Z"}  1024-dim
```

First vectors ever written to `chat-embeddings`, with the digest ids the local reimplementation
predicts.

**4.2 Read path — semantic recall returns a hit for the first time.**

```
POST /api/chat/search  {q:"how do I decide when to act?", topK:5}   → 200
  indexed=true  memoryMode=server  results=1
  user t0 score=0.6695 thread=8f5e7725 :: "In one short sentence: what is my strategy for deciding? …"
```

A paraphrased query with no shared keywords retrieves the turn and its snippet hydrates from D1 —
end-to-end proof of `query → metadata → hydrateMatches`.

**4.3 Delete-sweep determinism — the ids the sweep computes are the ids that were written.** Folding
the same `(userId, threadId, turnIndex 0…1, role)` coordinates through the new function yields:

```
sweep ids  : ce111584d4f2199728 ce3ba40a45a5077219 ce9e008db1e6839ae5 ce42a816da08caa43e
written ids: ce111584d4f2199728 ce3ba40a45a5077219      →  both covered
```

**4.4 Cleanup.** The probe thread was deleted through the product path (`DELETE /api/threads?id=…`,
200 `{"ok":true}`) and its two vectors removed with `wrangler vectorize delete-vectors` (changeset
`1a599951-8375-4bcb-a779-54d14980c020`). Final state re-verified: `threads` back to 5 rows, test
account back to its 3 pre-probe threads, probe thread absent, `chat_usage` today purged back to zero
rows (assert-then-delete, exactly 1 row changed), `get-vectors` reports no vectors for the probe ids.
No other account's data was touched.

## 5. Reports are now tracked in `origin/main`

Commit `2a9dbb3` — `fix(ai): enforce 64-character limit on vector embeddings and sync diagnostic reports` —
contains `src/lib/chat-embeddings.ts`, `LATENCY_PROFILE_REPORT.md` (new) and `REMEDIATION_SUMMARY.md`
(amended). `git ls-tree --name-only origin/main` lists both report files; `main`,
`origin/main`, `migrate-to-asu` and `origin/migrate-to-asu` all point at `2a9dbb3` (fast-forward, no
divergence).

The amendment: `REMEDIATION_SUMMARY.md` §3 previously asserted a cross-account **negative control** was
run against a sibling account and "behaved correctly". **It never ran.** The paragraph now says so
plainly, cites the evidence (zero uses of a second account's credentials in the probe transcript; all
probe threads owned by the test account in `threads.user_id`), and separates what *is* proven (per-user
Baseline injection, three independent ways) from what is *not* (cross-account isolation — structurally
guaranteed by `payload.sub` binding in `lens-state.ts` and `chat/route.ts`, but untested).

## 6. Two new findings surfaced by the proof (not fixed — out of the stated scope)

**6a. `DELETE /api/threads` never sweeps its vectors.** The handler computes the turn count with
`json_array_length(json_extract(message_history))`, and in D1 that expression returns **NULL** for every
thread — while `json_array_length(message_history)` returns the right number. Confirmed on an untouched
row: `n = null`, `n2 = 6`. So `turnCount` is 0, the `if (turnCount > 0)` guard at
[`src/app/api/threads/route.ts#L120`](file:///Volumes/EXTREME/live/src/app/api/threads/route.ts#L120)
is false, and `deleteThreadEmbeddings` is never called. The proof that the inner `json_extract` is
simply wrong here: the *account*-erasure path in the sibling route already uses the correct form
([`src/app/api/auth/account/route.ts#L46`](file:///Volumes/EXTREME/live/src/app/api/auth/account/route.ts#L46),
`json_array_length(message_history)`). Live confirmation: after deleting the probe thread through the
API, both vectors were still retrievable (which is why §4.4 needed a CLI delete).
Consequence: now that vectors are actually being written, deleting a single thread leaks its vectors —
account deletion still sweeps correctly. One-token fix at line 117 (`json_array_length(message_history)`),
plus a gate that asserts the two paths agree so this cannot drift again. This is a **pre-existing**
defect independent of the id length bug; it was invisible only because nothing was ever indexed.
Flagged rather than patched because the instruction was to isolate this change to id generation.
**Recommend it as the next fix.**

**6b. Vectorize's CLI metadata counters are all laggy or inert — only read ids back.** Minutes after two
successful upserts, `info` still reported `vectorCount: 0` and `list-vectors` still said "No vectors
found", while `get-vectors --ids …` returned both vectors with correct metadata. And `wrangler vectorize
get chat-embeddings` still shows `modified == created` (2026-10-01T22:23:29Z) *after* those writes
landed, so that field does not track data mutation at all. Operational rule: to decide whether the
index has content, compute the deterministic ids and `get-vectors` them — never trust `vectorCount`,
`list-vectors`, or `modified`. This also retroactively demotes one signal I used in
`LATENCY_PROFILE_REPORT.md` §5a (`modified == created`): the emptiness conclusion was right — it is
overdetermined by the 100% `VECTOR_UPSERT_ERROR` rate in the logs and `get-vectors` finding nothing —
but that particular corroborator proves nothing.

**6c. Minor test-fixture staleness (cosmetic).**
[`src/lib/chat-recall.test.ts#L77`](file:///Volumes/EXTREME/live/src/lib/chat-recall.test.ts#L77)
mints mock ids as `${USER}::${threadId}::${turnIndex}::${role}`. `searchChat` reads only `metadata`, so
the tests pass either way and the fixture never asserts on id shape; left alone for scope discipline,
but it no longer mirrors production ids.

## 7. What is now true

Semantic recall is live on the edge: every server-memory turn indexes two 1024-dim vectors under an
18-byte deterministic id, and paraphrased retrieval returns them. The `memory_mode='local'` contract is
untouched (that path never reaches this code). Existing pre-fix threads have no vectors — the
`embedThread` backfill helper and the owner backfill script path are the way to index history if you
want it, and are idempotent by `upsert`.
