# D1 and KV audit

Use this prompt to audit the database and state layer for correctness and race safety.

## Prompt

Review the D1 and KV architecture for this project and identify any correctness, drift, or concurrency risks.

Focus on:
- D1 schema alignment with repo definitions
- missing or stale tables
- migrations that are not versioned
- atomicity gaps and race conditions
- use of KV for counters or rate limiting instead of D1 atomic patterns
- idempotency keys and session storage separation
- D1 size, table usage, and indexing hygiene

Report:
- schema inventory
- missing or inconsistent schema elements
- likely concurrency bugs
- recommended atomic fix plan
- priority recommendations

Hard rule:
- if KV is being used for counters or rate limits, explicitly flag the risk and recommend D1-based atomic replacement unless the use case is intentionally non-transactional
