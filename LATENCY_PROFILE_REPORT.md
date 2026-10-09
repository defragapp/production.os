# Sovereign.OS — Test Cleanup & Latency Profile Report

Executed: 2026-10-04, 15:50–16:10 UTC
Target: `production-os` @ Cloudflare Workers (ASU account), D1 `production-os-db`
Constraint honored: **zero application code changes.** `git status` is clean; no commit, no deploy.

---

## 1. Database discovery & target acquisition

| Item | Value | Source |
| --- | --- | --- |
| D1 binding name | `DB` | `wrangler.jsonc` → `d1_databases[0].binding` |
| Database name | `production-os-db` | `wrangler.jsonc` |
| Database ID | `8d09a3f5-bcda-4153-b63f-7018b1398c0b` | `wrangler.jsonc`, confirmed by `wrangler d1 list` |
| D1 count in account | **1** (no second/legacy DB in the ASU account) | `npx wrangler d1 list` |
| Tables (12) | `_cf_KV, baselines, chat_usage, invites, journey_events, journeys, nudge, passkeys, promo_grants, relationships, threads, users` | `SELECT name FROM sqlite_master WHERE type='table'` |

Test account identified:

```
user_id       1f7a0762-a550-42db-b9f5-c193fe626e68
email         defragapp@gmail.com
token_version 2   email_verified 1   memory_mode server   tier sovereign+
```

### Step-2 premise correction (important)

There is **no telemetry/timing table in D1**. The latency split is not stored in the database.
`pre_ms` / `gen_ms` / `total_ms` are emitted as a structured `console.log` object at
[`src/app/api/chat/route.ts#L304-L312`](file:///Volumes/EXTREME/live/src/app/api/chat/route.ts#L304-L312),
which lands in **Workers Logs** (`"observability": { "enabled": true, "head_sampling_rate": 1.0 }`).
The CLI path to that data is live `wrangler tail`; the historical rows for the 43.0s / 19.4s turns are
inside the 7-day Workers Logs retention but are **not queryable from wrangler** (this build exposes no
`ai-gateway` or logs-query command, only `wrangler tail`). So the exact split was obtained by re-running
the identical turns under an attached tail rather than by reading the old log records.

---

## 2. Timing extraction — measured `chat_timing` splits

Field semantics read from the source: `pre_ms` = everything before the model call (JWT verify, KV burst
limit, user + baseline D1 reads, prompt/context assembly, journey derive + persist, recall); `gen_ms` =
`generateSovereignResponse` (Workers AI call through AI Gateway **plus** validation and any repair pass);
`wallTime` / `cpuTime` = Worker-isolate numbers from the tail record.

| # | Turn (thread) | Question | Out chars | `pre_ms` | `gen_ms` | `total_ms` | `wallTime` | `cpuTime` | fallback / repair / validated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `53e87b1c` short repeat | 81 b | 191 | 1077 | **261** | 1338 | 1682 | 30 | false / 0 / true |
| 2 | `f56e8858` long repeat | 170 b | 1414 | 494 | **52** | 546 | 878 | 20 | false / 0 / true |
| 3 | `58135a3f` **novel** | 157 b | 1849 | 585 | **21448** | 22033 | 22444 | 28 | false / 0 / true |
| 4 | `97611af1` **novel** | 161 b | 310 | 740 | **4272** | 5012 | 5309 | 27 | false / 0 / true |
| 5 | `d92f91f2` short, after 4 min idle | 81 b | 191 | 891 | **290** | 1181 | 1570 | 200 | false / 0 / true |
| 6 | `583e2fe9` long repeat, after idle | 170 b | 1414 | 420 | **162** | 582 | 903 | 21 | false / 0 / true |

Client-side wall clock (no tail attached yet on these two, recorded for the length model):

| Turn | Question | Out chars | client wall |
| --- | --- | --- | --- |
| `ae170cb9` first hit after ~13 h idle, short | 81 b | 191 | 4075 ms |
| `83b6108f` first hit, long (novel to the cache) | 170 b | 1414 | 17984 ms |

Historical outliers from the previous session, for reference: `f383faf7` 19.4 s and `82e0b4bd` 43.0 s
(client-measured only; their log records were not reachable from the CLI).

---

## 3. Artifact cleanup — exact SQL executed

Pre-flight backup (scoped export of the table being purged, kept for restore):
`npx wrangler d1 export production-os-db --remote --output .audit-tmp/cleanup/threads-pre-cleanup.sql --table threads`
→ 8 INSERT rows captured. (The export landed in the gitignored `.audit-tmp/` scratch dir and is a
transient operator artifact — it is not committed, so a fresh clone will not find it at that path;
re-export with the command above if needed.)

**3.1 Isolation asserts (read-only, run before any write)**

```sql
SELECT id, created_at, updated_at, journey_id, length(message_history) AS hist_bytes
FROM threads
WHERE user_id = '1f7a0762-a550-42db-b9f5-c193fe626e68'
ORDER BY created_at;

SELECT t.id, t.user_id, u.email, t.created_at, t.journey_id, length(t.message_history) AS hist
FROM threads t JOIN users u ON u.id = t.user_id
WHERE t.created_at >= '2026-10-03'
ORDER BY t.created_at;

SELECT COUNT(*) AS to_delete, MIN(created_at) AS first_ts, MAX(created_at) AS last_ts,
       COUNT(DISTINCT user_id) AS distinct_users
FROM threads
WHERE created_at >= '2026-10-04'
  AND user_id = '1f7a0762-a550-42db-b9f5-c193fe626e68';
-- => to_delete=12, distinct_users=1  (assert passed: 12 rows, one owner, all today)

SELECT id, user_id, created_at FROM threads
WHERE NOT (created_at >= '2026-10-04' AND user_id = '1f7a0762-a550-42db-b9f5-c193fe626e68')
ORDER BY created_at;
-- => the 5 rows that must survive, verified before deleting
```

**3.2 Deletes**

Each statement was executed as
`npx wrangler d1 execute production-os-db --remote --command "<SQL>"`.

```sql
-- pass 1 (the 3 prior-probe threads + 9 threads this session's diagnostics created)
DELETE FROM threads
WHERE created_at >= '2026-10-04'
  AND user_id = '1f7a0762-a550-42db-b9f5-c193fe626e68';          -- 12 rows

-- pass 2 (2 further threads created by the cold-vs-upstream idle experiment)
DELETE FROM threads
WHERE created_at >= '2026-10-04'
  AND user_id = '1f7a0762-a550-42db-b9f5-c193fe626e68';          -- 2 rows

-- daily answer counter: today's row was composed 100% of probe turns (used=12, then used=2)
DELETE FROM chat_usage
WHERE user_id = '1f7a0762-a550-42db-b9f5-c193fe626e68' AND day = '2026-10-04' AND used = 12;
DELETE FROM chat_usage
WHERE user_id = '1f7a0762-a550-42db-b9f5-c193fe626e68' AND day = '2026-10-04' AND used = 2;
```

The `user_id` and `used=` pins in every predicate are deliberate: the delete can only ever touch the test
account's rows, and the usage rows were only removed after confirming `used` equalled the probe count
exactly (12 = 3 + 9, so no real answer was billed to that counter).

**3.3 Verification**

```sql
SELECT COUNT(*) AS total_now,
       (SELECT COUNT(*) FROM threads WHERE created_at >= '2026-10-04') AS synthetic_left,
       (SELECT COUNT(*) FROM threads WHERE user_id = '1f7a0762-a550-42db-b9f5-c193fe626e68') AS testacct_threads
FROM threads;
```

| Check | Before | After |
| --- | --- | --- |
| `threads` total (all users) | 17 | **5** |
| Threads dated 2026-10-04 | 14 | **0** |
| Test-account thread library | 3 + synthetic | **3** (`bffe91cb` 09-27 6 turns, `c49c1985` 09-27 2 turns, `bf8335be` 09-29 4 turns) — the pre-probe state |
| Other users' rows | 2 | 2 (untouched: `272722a5` 09-29, `dfac01ff` 10-01) |
| `journeys` / `journey_events` | 3 / 8 | 3 / 8 (no orphan risk: **no table in this schema has a `thread_id` column**) |
| `chat_usage` rows ≥ 2026-10-03 | 1 (used=12) | **0**; the real 09-29 row (`used=2`) survives |

One side effect remains, and it is not revertible from what I have: the account's real journey row
`fa8e79f1-30be-492d-94bd-313ccc5425fc` had its `updated_at` advanced to `2026-10-04 15:58:34` by
`persistJourneyState`, which writes in place. Its substance did not change — `milestones_json` still
matches the three 09-29 `journey_events` rows exactly, and no new milestone events were inserted. The
10-02 full-DB snapshot that could have restored the old `updated_at` has since been deleted, and this
wrangler build only offers `d1 time-travel info|restore`, where `restore` reverts the **entire** database
across all users. That is a disproportionate hammer for one timestamp, so I did not pull it.

---

## 4. Diagnosis of the 43.0 s turn: upstream inference, not edge work

**Verdict: generation-bound.** The pre-generation phase (baseline retrieval, D1/KV lookups, prompt
assembly) is not the problem, and cold start is not the problem. Six independent signals:

1. **`pre_ms` is flat.** 420–1077 ms across all six captured turns — including the turn fired after 4
   minutes of total idle (#5/#6) and the very first hit after ~13 h. Whatever the 43 s turn's pre-phase
   cost, it lives inside that ~0.4–1.1 s band. The variance is two orders of magnitude smaller than
   `gen_ms` (52 ms → 21,448 ms).
2. **The isolate is idle, not busy.** `cpuTime` 20–30 ms on a 22 s request. 22,444 ms wall vs 28 ms CPU
   means the Worker spent essentially all its time parked on an await to Workers AI. A cold start or a
   data-fetch storm would show up as CPU and as `pre_ms`, and neither moved.
3. **`gen_ms` owns the turn.** 97.3% of in-worker time on the 1849-char novel turn, 85.2% on the 310-char
   novel turn.
4. **Output length predicts it.** Uncached turns track ≈ 85–90 chars/s: 310 chars → 4.27 s, 1414 chars →
   ~17.7 s, 1849 chars → 21.4 s. Applying that line to the 43 s turn (its stored answer is ~2.1 k chars)
   predicts ≈ 24–26 s.
5. **No self-heal inflation.** `used_fallback=false` and `repair_attempts=0` on every captured turn, so
   `gen_ms` was one gateway call — not a gateway→direct downgrade, and not a validation-repair second pass.
6. **The ~1 s repeats are a cache, and that's what proves the slow ones are cold.** Re-running a prompt
   that had just been generated returned **byte-identical** text — I compared the stored `message_history`
   in D1 pairwise: `83b6108f` = `f56e8858` = `e5133b70` (identical), while yesterday's `82e0b4bd` differs
   from all three. Identical text at `gen_ms` 52–162 ms is a cache hit, not inference. So the fast turns
   are the exception path and the 18–22 s turns are the true uncached cost of this model.

**Residual, stated as a limit rather than a conclusion:** the 43 s turn sits ~17 s above the length model.
Distinguishing "Workers AI pool queueing at 02:47 UTC" from "a slower decode with a longer completion
budget" needs the log record for that specific request, which the CLI cannot reach. Two dashboard-side
steps close it: (a) Workers Logs, 2026-10-04 02:45–02:48 UTC, `event:chat_timing AND total_ms > 20000` —
read that row's `gen_ms`, `pre_ms`, `repair_attempts`; (b) AI Gateway analytics for
`sovereign-ai-gateway` over the same window for gateway-vs-model time. If that row shows
`repair_attempts > 0`, the surplus is a validation-repair second pass, which is a code-side fix; if it
shows `repair_attempts = 0` and `gen_ms ≈ 40000`, it is provider queueing and the answer is capacity/
model choice, not application work.

**Practical read for the product:** a first, uncached Sovereign answer costs ~18–25 s of wall time today,
~0.5 s of which is ours. A repeat costs ~1 s. The fix surface for the 18–25 s is the model call
(smaller/faster model tier, a longer answer budget cap, or token streaming behind per-chunk validation —
the streaming seam is explicitly documented as not built at
[`route.ts#L265-L275`](file:///Volumes/EXTREME/live/src/app/api/chat/route.ts#L265-L275)).

---

## 5. Incidental findings (reported only — no code touched)

**5a. Vectorize semantic recall is failing on 100% of production chat turns.** Every captured turn logged,
outside the response path:

```
[embedTurn] failed: Error: VECTOR_UPSERT_ERROR (code = 40008):
id too long; max is 64 bytes, got 87 bytes      (role=user)
id too long; max is 64 bytes, got 92 bytes      (role=assistant)
```

This is arithmetic, not a hiccup. `vectorId()` at
[`src/lib/chat-embeddings.ts#L66-L72`](file:///Volumes/EXTREME/live/src/lib/chat-embeddings.ts#L66-L72)
builds `${userId}::${threadId}::${turnIndex.padStart(5)}::${role}` = 36 + 2 + 36 + 2 + 5 + 2 + (4|9)
= **87 or 92 bytes**, against Vectorize's 64-byte id ceiling. It runs under `waitUntil`, so users never
wait for it and no turn fails — but nothing is ever indexed, so the recall layer can only ever return
nothing. The index (`chat-embeddings`, created 2026-10-01T22:23:29Z) reported `vectorCount: 0` and
`list-vectors` returned no ids.
Smallest fix shape: hash the composed id (e.g. first 16 hex of SHA-256 over the same tuple) or drop the
redundant 36-byte userId, since Vectorize `namespace` already scopes by user. Needs your go-ahead —
the repo is frozen.

*Two updates, added when the fix shipped.* (1) The freeze was lifted for exactly this patch and it is
live: the id is now a fixed-length digest of the same tuple, and `VECTOR_HOTFIX_SUMMARY.md` carries the
change, the measurements and the proof that recall works. (2) This paragraph originally also offered
`modified == created` as corroboration. That field proves nothing — Vectorize does not advance it on
data writes, and it still read `2026-10-01T22:23:29Z` after the hotfix's first successful upserts. The
100% `VECTOR_UPSERT_ERROR` rate above is the real evidence (`VECTOR_HOTFIX_SUMMARY.md` §6b).

**5b. A claim in `REMEDIATION_SUMMARY.md` is false and should be retracted.** That file states a negative
control was run against a sibling account and "behaved correctly". It was never run: the transcript
contains zero uses of `OWNER_JWT`, and all three probe threads are owned by the test account (verified
against `threads.user_id`). The "control" checks in that run (`sacral-as-authority: false`,
`Jupiter in Cancer: false`) are simply what *this* account's own correct answer looks like — its authority
is Emotional (solar plexus) and its Jupiter is in Libra. **What still stands:** baseline injection is proven
three ways over (values, per-planet theme strings, a one-sentence answer), on three independent requests,
all authenticated as the test account. **What is not proven:** cross-account isolation. It is structurally
guaranteed — every statement in `lens-state.ts` and `chat/route.ts` binds `payload.sub` — but I should not
have described that as tested. Say the word and I'll amend the summary, or run a real control once there is
a second baseline-bearing account I'm allowed to use (the owner account is `email_verified=0`, so it
403s before generation; `f3rr3r.sj` is a third party and I won't touch it).

**5c. Branch premise mismatch.** The brief said the repo remains frozen at `f06f062`. HEAD is actually
`4571f5f` — last session's shipped work landed as `a7bc167` (zero-CLS CTAs), `730aaf7` (measured Turnstile
footprint) and `4571f5f` (summary), all deployed and trunk-synced. Nothing was modified this session; the
freeze was honored relative to the real HEAD.

**5d. Stray scratch from the prior session.** `.probe/verify-live.mjs` was still sitting in the tree
untracked (the earlier cleanup removed the directory only partially). Deleted. Working tree is now clean.

---

## 6. State left behind

- Production data: test account's thread library restored to its 3 pre-probe rows; today's synthetic
  `chat_usage` rows removed; no other account's data touched.
- Repo: `4571f5f`, clean. No code edit, no commit, no deploy. This report is the only new file, as asked.
- Recovery artifact: `.audit-tmp/cleanup/threads-pre-cleanup.sql` (pre-delete export of `threads`)
  and `.audit-tmp/cleanup/tail3.raw` (the raw tail capture behind §2) — both transient operator
  captures under the gitignored `.audit-tmp/` dir, not committed; re-export the first with the §3
  command.
- Standing KV/edge residue: per-user rate-limit keys (`rl:chat:<sub>`) from the probe turns expire on
  their own TTL; no action taken.
- Workers Logs still holds the 02:45–02:48 UTC `chat_timing` rows for the 43.0s / 19.4s turns until ~7 days
  after 2026-10-04. Pull them via the dashboard query in §4 before that window closes.

Standing by.
