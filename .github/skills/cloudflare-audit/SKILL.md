# Cloudflare Audit Skill

This skill is designed to help a Copilot agent review Cloudflare resources in a disciplined, security-first way.

## Purpose

Use this skill when auditing:
- Cloudflare Workers
- D1 databases
- KV namespaces
- DNS and zone security
- API tokens and permissions
- deployment history and release drift
- account posture and governance

The primary objective is to produce a clear risk assessment with evidence, not to mutate production blindly.

## Safety rules

- Read-only by default.
- Never create, delete, update, or deploy Cloudflare resources without explicit approval.
- If a write is required, present a dry-run plan with impacted resources, reason, and rollback steps.
- Prioritize least-privilege design and account hygiene.
- Prefer evidence over assumptions.

## Workflow

1. Inventory the account and application context.
2. List relevant Cloudflare resources: Workers, D1, KV, Pages, DNS, tokens, ACLs, and bindings.
3. Match those resources to the repository architecture.
4. Flag drift, stale resources, missing tables, orphaned namespaces, token over-scoping, or weak configuration.
5. Use severity levels:
   - Critical: data loss, secret exposure, auth bypass, or unsafe automation
   - High: drift or misconfiguration with likely production impact
   - Medium: governance or operational hygiene issues
   - Low: cleanup or documentation opportunities
6. Propose fixes with impact and rollback guidance.
7. Produce a concise markdown report with findings and next actions.

## Repository-specific priorities

For this repository (`defragapp/production.os`), prioritize checks around:
- D1 schema drift and migration coverage
- KV usage for sessions/idempotency versus D1 counters
- Worker bindings for D1, KV, AI Gateway, and secrets
- API token scope breadth and expiry
- Worker error rate and spike analysis
- release/deploy drift and versioning issues
- account governance and stale resources

## Recommended Cloudflare sources

Use the official Cloudflare developer docs as the reference source for API patterns and account configuration:
- https://developers.cloudflare.com/
- https://developers.cloudflare.com/fundamentals/api/
- https://developers.cloudflare.com/workers/
- https://developers.cloudflare.com/d1/
- https://developers.cloudflare.com/kv/
- https://developers.cloudflare.com/ssl/
- https://developers.cloudflare.com/learning-paths/

## Core audit questions

Ask these questions in every review:
- What is actually deployed versus what the repo expects?
- What is the blast radius of each resource?
- Which tokens are scoped too broadly or never rotated?
- Are there unsafe read-modify-write patterns in KV or app logic?
- Are D1 migrations and code drift aligned?
- Which resources are stale, unused, or unlabeled?
- What is the risk of no-op or silent failure paths?

## Output contract

Return structured audit results in this format:

1. Executive summary
2. Inventory of resources
3. Findings by severity
4. Recommended remediation plan
5. Evidence / commands / IDs
6. Confidence rating

## Useful commands

For deterministic repository-to-production comparison, run
[`npm run cf:audit:parity -- --live`](../../../docs/cloudflare-parity.md)
with a read-only Cloudflare API token. The check compares the current deployed
Worker version bindings, variable/secret names, and D1 schema; it never
deploys or writes to Cloudflare.

These commands are useful for a discipline-first review:

```bash
wrangler whoami
wrangler d1 list
wrangler kv namespace list
wrangler deployments list
wrangler secret list
wrangler pages project list
wrangler tail
```

If the agent is instructed to review tokens or account posture, prefer API-based inspection with narrow scopes and explicit permission requirements.

## Prompt pack

Use the prompt files in `prompts/` for standard workflow review tasks.
