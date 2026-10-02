# Worker audit

Use this prompt to assess Worker deployment health and production risk.

## Prompt

Review all Cloudflare Workers relevant to this app. Check:

- deployed versions and route mapping
- worker bindings for D1, KV, AI Gateway, secrets, and environment variables
- runtime errors, request spikes, and 5xx behavior
- stale or duplicate deployments
- deployment history and rollback readiness
- config drift relative to local or repo config
- unsafe logging or secret leak patterns

Report:
- current deployment state
- active bindings and their risk
- anomalies or drift
- likely failure modes
- recommended remediation

Constraints:
- no destructive actions unless explicitly approved
- keep findings tied to evidence and error patterns
- prefer a concise but operationally useful summary
