# Cloudflare live parity audit

The parity audit compares the checked-in Wrangler config, D1 schema and
migrations, and the `AppEnv` contract with the currently deployed Cloudflare
Worker and D1 database. It is read-only; it does not deploy, mutate bindings,
change secrets, or alter database contents.

## Run

Install the repository dependencies first. Set a read-only Cloudflare API token
in the process environment; do not put the token in command arguments, source
files, `.dev.vars`, or report files.

```sh
export CLOUDFLARE_API_TOKEN='…'
export CLOUDFLARE_ACCOUNT_ID='your-32-character-account-id'
npm run cf:audit:parity -- --live
```

The token needs **Workers Scripts Read** and **D1 Read** for the target account.
The audit also accepts `--account-id ID`; in live mode it refuses to query if
that value differs from `CLOUDFLARE_ACCOUNT_ID`. It targets the Worker name and D1 database ID in
`wrangler.jsonc`; `--worker NAME` is accepted only if it matches that config.

For offline verification or CI fixtures, use `--fixture PATH` instead of
`--live`. Fixture JSON may contain the same `worker` and `databaseSchema` data
shapes used by the audit. It does not make network requests.

```sh
npm run cf:audit:parity -- --fixture ./path/to/parity-fixture.json \
  --account-id your-32-character-account-id
```

Reports are written with owner-only file permissions to the ignored
`.cloudflare-audit/` directory by default:

- `parity-report.json` follows
  [the versioned report schema](../.github/skills/cloudflare-audit/schemas/parity-report.schema.json).
- `parity-report.md` presents the severity-ranked findings and evidence.

Exit status is `0` when no drift is detected, `1` when parity findings exist,
and `2` when collection is incomplete or the audit cannot run.

## Compared state

- **Worker bindings:** every version receiving traffic in the latest deployment
  is compared by binding name/type and, where exposed, resource ID.
- **Variables and secrets:** only names are compared. Expected variable names
  come from `wrangler.jsonc`; expected secret names come from fields in
  `src/lib/env.ts` not declared as plain variables or resource bindings.
  Optional `AppEnv` fields are reported as optional. Deployed version metadata
  is reduced to an explicit allowlist of names, types, and resource identifiers;
  binding values are neither copied into the report nor written to logs.
- **D1:** table, column declarations, table constraints, and named-index
  definitions are compared using the repository's `schema.sql` plus sorted
  `migrations/*.sql` files and the live `sqlite_master` catalog. The only D1
  SQL issued is a `SELECT` of schema metadata. Migration files are currently
  applied directly by the project's scripts, so the tool does not infer which
  files were applied from a migration ledger.

Unexpected and missing state is evidence of drift, not an instruction to
mutate production. Review the report and use the normal migration/release
approval path for remediation. API failures are reported as incomplete
collection; absence of evidence is never reported as a clean result.

## API reference

The live collector uses Cloudflare's read endpoints for
[Worker deployments](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/)
and [Worker versions](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/),
plus the [D1 query endpoint](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
It does not call the secret-list endpoint, which may include secret material in
its response.
