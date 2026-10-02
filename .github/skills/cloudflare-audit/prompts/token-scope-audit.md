# Token scope audit

Use this prompt to assess Cloudflare API token exposure and privilege level.

## Prompt

Audit all relevant Cloudflare API tokens and scoped permissions for this account.

Check for:
- broad permissions beyond app need
- global access instead of account or resource-scoped access
- expired or stale tokens
- user ownership and mismatch with service responsibilities
- secret leakage risk from logs, env files, or CI secrets
- rotation cadence and emergency revocation steps

Return:
- token inventory
- scope summary
- risk level per token
- recommended revocation or rotation actions
- next best governance policy

Rules:
- do not overstate the risk if a token is scoped narrowly and time-limited
- always prefer least-privilege patterns
- call out long-lived or shared credentials as high-risk by default
