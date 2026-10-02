# Deployment review

Use this prompt to review release health, drift, and deployment risk.

## Prompt

Audit this Cloudflare deployment path and release history for risk, drift, and operational gaps.

Check:
- current deployed version vs repo commit
- build and release timings
- worker deployment history and rollbacks
- stale assets or failed asset propagation
- 503, 500, and routing issues
- environment mismatch between local and deployed configuration
- release checklist compliance and verification drift

Report:
- deployment posture summary
- risk of stale or partial deployments
- evidence of recent failures or silent drift
- recommended rollout and verification process
- rollout hardening steps

Important:
- prioritize production stability and recoverability
- identify if release process is too dependent on manual intervention or unstaged builds
