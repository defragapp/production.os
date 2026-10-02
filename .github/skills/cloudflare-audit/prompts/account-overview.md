# Account overview audit

Use this prompt to review the overall Cloudflare posture for the selected account or app.

## Prompt

Audit this Cloudflare account for the application and environment in scope. Focus on:

- active Workers and deployment state
- D1 databases and scheme drift
- KV namespaces and usage patterns
- pages/projects and stale resources
- API tokens and scopes
- secrets and environment variable exposure
- DNS, SSL/TLS, and zone protections
- AI Gateway or Workers AI usage
- infrastructure drift relative to the repo

Return a report with:
1. account inventory
2. production exposure summary
3. critical findings
4. medium findings
5. low-priority cleanup items
6. suggested remediation order

Rules:
- read-only by default
- show evidence with IDs, resource names, and commands if available
- do not assume a resource is safe without checking scope and ownership
- distinguish between legacy drift and active production risk
- include a risk rating from low to critical
