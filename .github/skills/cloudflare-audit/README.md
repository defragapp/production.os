# Cloudflare Audit Skill

This skill provides a disciplined, trustworthy way to review a Cloudflare account and application stack for security, drift, and operational health.

It is designed for production-grade systems like this repository and for accounts that combine:
- Cloudflare Workers
- D1 databases
- KV namespaces
- AI Gateway and Workers AI
- DNS and TLS
- Stripe / Resend / Turnstile integrations

## Why this exists

Cloudflare is a strong platform, but production hygiene still depends on:
- least privilege
- token scoping
- migration discipline
- resource inventory
- deployment validation
- correct use of D1 vs KV

This skill keeps the agent focused on evidence, not guesswork.

## Safety posture

The default posture is:
- review, summarize, recommend
- never mutate without approval
- show the exact impact before a change
- prefer read-only analysis in live environments

## Fast workflow

Use the standard flow below:

1. Discover account + app context
2. Inventory Workers, D1, KV, Pages, DNS, tokens, and bindings
3. Compare with repo assumptions and schema state
4. Audit for drift, technical debt, stale resources, and unsafe patterns
5. Rank findings by impact and urgency
6. Recommend fixes with rollback guidance

## Standard outputs

Each audit should return:
- executive summary
- affected resources
- issue severity
- evidence and command references
- recommended next steps
- confidence level

## Included prompts

- `prompts/account-overview.md`
- `prompts/worker-audit.md`
- `prompts/d1-kv-audit.md`
- `prompts/token-scope-audit.md`
- `prompts/deployment-review.md`

## Best practices for this repo

This repository already has a serious product architecture. The main opportunities for evolution are:
- D1 migration hygiene and schema drift monitoring
- atomic D1 rate limiting instead of KV counter races
- governance for tokens and account scope
- stale resource cleanup
- deployment safety gates
- read-only AI review automation with approval checkpoints

Use this skill to audit those areas before changing production behavior.
