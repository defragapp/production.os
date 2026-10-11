#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_ROOT = "https://api.cloudflare.com/client/v4";
const OUTPUT_DIR = path.join(REPO_ROOT, ".cloudflare-audit");
const REPORT_VERSION = 1;
const SAFE_BINDING_FIELDS = [
  "id",
  "database_id",
  "namespace_id",
  "bucket_name",
  "queue_name",
  "script_name",
  "service",
  "environment",
  "class_name",
  "dataset",
  "workflow_name",
];

function fail(message) {
  throw new Error(message);
}

function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
    } else if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      output += "\n";
    } else if (char === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") output += "\n";
        i += 1;
      }
      i += 1;
    } else {
      output += char;
    }
  }

  return output;
}

function stripTrailingCommas(source) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
    } else if (char === ",") {
      let next = i + 1;
      while (/\s/.test(source[next] ?? "")) next += 1;
      if (source[next] !== "}" && source[next] !== "]") output += char;
    } else {
      output += char;
    }
  }

  return output;
}

export function parseJsonc(source) {
  return JSON.parse(stripTrailingCommas(stripJsonComments(source)));
}

function stripSqlComments(source) {
  let output = "";
  let quote = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (quote) {
      output += char;
      if (char === quote) {
        if (source[i + 1] === quote && quote !== "]") {
          output += source[i + 1];
          i += 1;
        } else {
          quote = null;
        }
      } else if (char === "\\" && quote === "'") {
        output += source[i + 1] ?? "";
        i += 1;
      }
    } else if (char === "'" || char === '"' || char === "`" || char === "[") {
      quote = char === "[" ? "]" : char;
      output += char;
    } else if (char === "-" && next === "-") {
      while (i < source.length && source[i] !== "\n") i += 1;
      output += "\n";
    } else if (char === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") output += "\n";
        i += 1;
      }
      i += 1;
    } else {
      output += char;
    }
  }

  return output;
}

function splitSqlStatements(source) {
  const statements = [];
  let start = 0;
  let depth = 0;
  let quote = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === quote) {
        if (source[i + 1] === quote && quote !== "]") i += 1;
        else quote = null;
      } else if (char === "\\" && quote === "'") {
        i += 1;
      }
    } else if (char === "'" || char === '"' || char === "`" || char === "[") {
      quote = char === "[" ? "]" : char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === ";" && depth === 0) {
      const statement = source.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }

  const tail = source.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function splitTopLevelComma(source) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === quote) {
        if (source[i + 1] === quote && quote !== "]") i += 1;
        else quote = null;
      } else if (char === "\\" && quote === "'") {
        i += 1;
      }
    } else if (char === "'" || char === '"' || char === "`" || char === "[") {
      quote = char === "[" ? "]" : char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      parts.push(source.slice(start, i).trim());
      start = i + 1;
    }
  }

  const tail = source.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function unquoteIdentifier(identifier) {
  if (identifier.startsWith("[") && identifier.endsWith("]")) return identifier.slice(1, -1);
  if (
    (identifier.startsWith('"') && identifier.endsWith('"')) ||
    (identifier.startsWith("`") && identifier.endsWith("`"))
  ) {
    return identifier.slice(1, -1).replaceAll(identifier[0] + identifier[0], identifier[0]);
  }
  return identifier;
}

function readIdentifier(source) {
  const match = source.match(/^\s*("[^"]*(?:""[^"]*)*"|`[^`]*`|\[[^\]]*\]|[A-Za-z_][\w$]*)/);
  return match ? unquoteIdentifier(match[1]) : null;
}

const TABLE_CONSTRAINTS = new Set(["CONSTRAINT", "PRIMARY", "UNIQUE", "CHECK", "FOREIGN"]);
const emptySchema = () => ({
  tables: new Map(),
  columnDefinitions: new Map(),
  tableConstraints: new Map(),
  indexes: new Map(),
});
const normalizeDefinition = (definition) => definition.trim().replace(/\s+/g, " ").toLowerCase();

function schemaFromSql(source, schema = emptySchema()) {
  const cleanSource = stripSqlComments(source);

  for (const statement of splitSqlStatements(cleanSource)) {
    const createTable = statement.match(
      /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)\s*\(([\s\S]*)\)\s*(?:WITHOUT\s+ROWID|STRICT)?\s*$/i
    );
    if (createTable) {
      const name = unquoteIdentifier(createTable[1]);
      const columns = new Set(schema.tables.get(name) ?? []);
      const definitions = new Map(schema.columnDefinitions.get(name) ?? []);
      const constraints = new Set(schema.tableConstraints.get(name) ?? []);
      for (const declaration of splitTopLevelComma(createTable[2])) {
        const firstToken = readIdentifier(declaration);
        if (firstToken && TABLE_CONSTRAINTS.has(firstToken.toUpperCase())) {
          constraints.add(normalizeDefinition(declaration));
          continue;
        }
        const column = readIdentifier(declaration);
        const identifier = declaration.match(/^\s*("[^"]*(?:""[^"]*)*"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)/);
        if (column && identifier) {
          columns.add(column);
          definitions.set(column, normalizeDefinition(declaration.slice(identifier[0].length)));
        }
      }
      schema.tables.set(name, columns);
      schema.columnDefinitions.set(name, definitions);
      schema.tableConstraints.set(name, constraints);
      continue;
    }

    const createIndex = statement.match(
      /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)\s+ON\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)/i
    );
    if (createIndex) {
      const indexName = unquoteIdentifier(createIndex[1]);
      const tableName = unquoteIdentifier(createIndex[2]);
      const onClause = statement.slice(statement.toUpperCase().indexOf(" ON "));
      const unique = /^\s*CREATE\s+UNIQUE\s+INDEX/i.test(statement);
      schema.indexes.set(indexName, {
        table: tableName,
        definition: `${unique ? "unique " : ""}${normalizeDefinition(onClause)}`,
      });
      continue;
    }

    const alterAddColumn = statement.match(
      /^\s*ALTER\s+TABLE\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)\s+ADD\s+COLUMN\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)/i
    );
    if (alterAddColumn) {
      const table = unquoteIdentifier(alterAddColumn[1]);
      const column = unquoteIdentifier(alterAddColumn[2]);
      const columns = schema.tables.get(table);
      if (columns) {
        columns.add(column);
        const definition = statement.slice(alterAddColumn[0].length);
        const definitions = schema.columnDefinitions.get(table) ?? new Map();
        definitions.set(column, normalizeDefinition(definition));
        schema.columnDefinitions.set(table, definitions);
      }
    }
  }

  return schema;
}

export function parseSchema(sqlSources) {
  const schema = emptySchema();
  for (const source of sqlSources) schemaFromSql(source, schema);
  return schema;
}

function getExpectedBindings(config) {
  const bindings = [];
  for (const item of config.d1_databases ?? []) {
    bindings.push({ type: "d1", name: item.binding, resourceId: item.database_id, resourceName: item.database_name });
  }
  for (const item of config.kv_namespaces ?? []) {
    bindings.push({ type: "kv_namespace", name: item.binding, resourceId: item.id });
  }
  if (config.ai?.binding) bindings.push({ type: "ai", name: config.ai.binding });
  if (config.assets?.binding) bindings.push({ type: "assets", name: config.assets.binding });
  return bindings.filter((item) => item.name);
}

function getAppEnvKeys(source) {
  const interfaceBody = source.match(/export\s+interface\s+AppEnv\s*\{([\s\S]*?)^\}/m)?.[1];
  if (!interfaceBody) fail("Could not extract secret names from src/lib/env.ts AppEnv interface.");
  const keys = [];
  for (const line of interfaceBody.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_$][\w$]*)(\?)?\s*:/);
    if (match) keys.push({ name: match[1], optional: Boolean(match[2]) });
  }
  return keys;
}

export async function loadExpectedState() {
  const configPath = path.join(REPO_ROOT, "wrangler.jsonc");
  const schemaPath = path.join(REPO_ROOT, "schema.sql");
  const migrationsDir = path.join(REPO_ROOT, "migrations");
  const envPath = path.join(REPO_ROOT, "src/lib/env.ts");
  const config = parseJsonc(await readFile(configPath, "utf8"));
  const schemaSql = [await readFile(schemaPath, "utf8")];
  const migrationNames = (await readdir(migrationsDir))
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort();
  for (const name of migrationNames) {
    schemaSql.push(await readFile(path.join(migrationsDir, name), "utf8"));
  }

  const bindings = getExpectedBindings(config);
  const configuredNames = new Set([
    ...bindings.map((binding) => binding.name),
    ...Object.keys(config.vars ?? {}),
  ]);
  const secrets = getAppEnvKeys(await readFile(envPath, "utf8"))
    .filter((item) => !configuredNames.has(item.name))
    .map(({ name, optional }) => ({ name, required: !optional }));
  const database = (config.d1_databases ?? []).find((item) => item.binding === "DB") ?? config.d1_databases?.[0];
  if (!database?.database_id) fail("Wrangler config has no D1 database ID to audit.");
  const schema = parseSchema(schemaSql);
  if (schema.tables.size === 0) fail("Could not extract any tables from schema.sql and migrations.");

  return {
    worker: config.name,
    database: { binding: database.binding, id: database.database_id, name: database.database_name },
    bindings,
    vars: Object.keys(config.vars ?? {}).sort(),
    secrets,
    schema,
    migrationFiles: migrationNames,
  };
}

function normalizeBinding(binding) {
  const normalized = {
    type: String(binding.type ?? "unknown").toLowerCase(),
    name: String(binding.name ?? ""),
  };
  for (const field of SAFE_BINDING_FIELDS) {
    if (["string", "number", "boolean"].includes(typeof binding[field])) normalized[field] = binding[field];
  }
  return normalized;
}

function cloudflareErrorMessage(status, payload) {
  const codes = Array.isArray(payload?.errors)
    ? payload.errors.map((item) => item?.code).filter((code) => code !== undefined)
    : [];
  return `Cloudflare API request failed (HTTP ${status}${codes.length ? `, error code(s): ${codes.join(", ")}` : ""}).`;
}

async function cloudflareGet(accountId, route, token) {
  const response = await fetch(`${API_ROOT}/accounts/${encodeURIComponent(accountId)}/${route}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    fail(`Cloudflare API returned invalid JSON (HTTP ${response.status}).`);
  }
  if (!response.ok || payload?.success === false) fail(cloudflareErrorMessage(response.status, payload));
  return payload?.result;
}

async function cloudflareQuery(accountId, databaseId, token, sql) {
  const response = await fetch(
    `${API_ROOT}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  let payload;
  try {
    payload = await response.json();
  } catch {
    fail(`Cloudflare D1 query returned invalid JSON (HTTP ${response.status}).`);
  }
  if (!response.ok || payload?.success === false) fail(cloudflareErrorMessage(response.status, payload));
  const result = payload?.result;
  const results = Array.isArray(result) ? result.flatMap((item) => item?.results ?? []) : result?.results;
  if (!Array.isArray(results)) fail("Cloudflare D1 query response did not include result rows.");
  return results;
}

async function collectWorkerBindings(accountId, worker, token) {
  const route = `workers/scripts/${encodeURIComponent(worker)}`;
  const deploymentResult = await cloudflareGet(accountId, `${route}/deployments`, token);
  const deployments = deploymentResult?.deployments;
  if (!Array.isArray(deployments) || deployments.length === 0) {
    fail(`No deployed version metadata was returned for Worker "${worker}".`);
  }
  deployments.sort((left, right) => Date.parse(right.created_on ?? "") - Date.parse(left.created_on ?? ""));
  const current = deployments[0];
  if (typeof current.id !== "string" || !Number.isFinite(Date.parse(current.created_on))) {
    fail(`Cloudflare returned an invalid current deployment record for Worker "${worker}".`);
  }
  if (!Array.isArray(current.versions) || current.versions.length === 0) {
    fail(`The current deployment for Worker "${worker}" has no version entries.`);
  }
  const percentageTotal = current.versions.reduce((total, version) => total + Number(version.percentage), 0);
  if (!Number.isFinite(percentageTotal) || Math.abs(percentageTotal - 100) > 0.01) {
    fail(`The current deployment for Worker "${worker}" has invalid traffic percentages.`);
  }

  const versions = await Promise.all(
    current.versions.map(async ({ version_id: versionId, percentage }) => {
      if (typeof versionId !== "string" || typeof percentage !== "number") {
        fail(`The current deployment for Worker "${worker}" contains an invalid version entry.`);
      }
      const version = await cloudflareGet(
        accountId,
        `${route}/versions/${encodeURIComponent(versionId)}`,
        token
      );
      const bindings = version?.resources?.bindings;
      if (!Array.isArray(bindings)) {
        fail(`Cloudflare returned no binding metadata for Worker version "${versionId}".`);
      }
      if (bindings.some((binding) => typeof binding.type !== "string" || typeof binding.name !== "string")) {
        fail(`Cloudflare returned malformed binding metadata for Worker version "${versionId}".`);
      }
      return {
        versionId,
        percentage,
        bindings: bindings.map(normalizeBinding),
      };
    })
  );

  return { deploymentId: current.id, createdOn: current.created_on, versions };
}

async function collectD1Schema(accountId, databaseId, token) {
  const rows = await cloudflareQuery(
    accountId,
    databaseId,
    token,
    "SELECT name, type, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('table', 'index') ORDER BY type, name"
  );
  const sources = rows
    .filter((row) => typeof row.sql === "string")
    .map((row) => row.sql);
  return parseSchema(sources);
}

export async function collectLiveState(accountId, expected, token) {
  const [workerResult, databaseResult] = await Promise.allSettled([
    collectWorkerBindings(accountId, expected.worker, token),
    collectD1Schema(accountId, expected.database.id, token),
  ]);
  const errors = [];
  if (workerResult.status === "rejected") {
    errors.push({
      resource: "worker",
      message: workerResult.reason instanceof Error ? workerResult.reason.message : String(workerResult.reason),
    });
  }
  if (databaseResult.status === "rejected") {
    errors.push({
      resource: "d1",
      message: databaseResult.reason instanceof Error ? databaseResult.reason.message : String(databaseResult.reason),
    });
  }
  return {
    worker: workerResult.status === "fulfilled" ? workerResult.value : null,
    databaseSchema: databaseResult.status === "fulfilled" ? databaseResult.value : null,
    collectionErrors: errors,
  };
}

function addFinding(findings, id, severity, title, resource, evidence, recommendation, confidence = 0.95) {
  findings.push({ id, severity, title, resource, evidence, recommendation, confidence });
}

function compareSet(findings, expected, actual, {
  idPrefix,
  resource,
  severityMissing,
  severityExtra,
  recommendationMissing,
  recommendationExtra,
}) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  for (const name of expectedSet) {
    if (!actualSet.has(name)) {
      addFinding(
        findings,
        `${idPrefix}-missing-${name}`,
        severityMissing,
        `Expected ${resource} "${name}" is missing from Cloudflare`,
        resource,
        `Expected name "${name}" was not present in the deployed state.`,
        recommendationMissing
      );
    }
  }
  for (const name of actualSet) {
    if (!expectedSet.has(name)) {
      addFinding(
        findings,
        `${idPrefix}-unexpected-${name}`,
        severityExtra,
        `Unexpected ${resource} "${name}" exists in Cloudflare`,
        resource,
        `Live name "${name}" is not declared in repository configuration.`,
        recommendationExtra
      );
    }
  }
}

function compareBindings(findings, expected, versions) {
  for (const version of versions) {
    const runtimeBindings = version.bindings.filter(
      (binding) => !["plain_text", "text", "var"].includes(binding.type) && !binding.type.startsWith("secret")
    );
    const runtimeByName = new Map(runtimeBindings.map((binding) => [binding.name, binding]));
    const expectedByName = new Map(expected.bindings.map((binding) => [binding.name, binding]));

    for (const expectedBinding of expected.bindings) {
      const actual = runtimeByName.get(expectedBinding.name);
      if (!actual) {
        addFinding(
          findings,
          `worker-binding-missing-${version.versionId}-${expectedBinding.name}`,
          "high",
          `Expected Worker binding "${expectedBinding.name}" is missing`,
          `Worker ${expected.worker} version ${version.versionId}`,
          `The deployed version has no binding named "${expectedBinding.name}".`,
          "Restore the binding in Wrangler configuration or update the application to the intended resource."
        );
        continue;
      }

      if (actual.type !== expectedBinding.type) {
        addFinding(
          findings,
          `worker-binding-type-${version.versionId}-${expectedBinding.name}`,
          "high",
          `Worker binding "${expectedBinding.name}" has a different type`,
          `Worker ${expected.worker} version ${version.versionId}`,
          `Repository expects type "${expectedBinding.type}" but deployment reports "${actual.type}".`,
          "Reconcile the deployed binding type with the checked-in Wrangler configuration."
        );
      }

      const actualId = actual.database_id ?? actual.namespace_id ?? actual.id;
      if (expectedBinding.resourceId && !actualId) {
        addFinding(
          findings,
          `worker-binding-identity-unverified-${version.versionId}-${expectedBinding.name}`,
          "medium",
          `Worker binding "${expectedBinding.name}" resource identity could not be verified`,
          `Worker ${expected.worker} version ${version.versionId}`,
          `The deployed binding exposes no resource ID for comparison with the Wrangler config.`,
          "Verify the deployed resource ID in Cloudflare and confirm that it matches the checked-in config."
        );
      } else if (expectedBinding.resourceId && actualId !== expectedBinding.resourceId) {
        addFinding(
          findings,
          `worker-binding-resource-${version.versionId}-${expectedBinding.name}`,
          "high",
          `Worker binding "${expectedBinding.name}" targets a different resource`,
          `Worker ${expected.worker} version ${version.versionId}`,
          `Repository expects resource ID "${expectedBinding.resourceId}" but deployment reports "${actualId}".`,
          "Confirm the intended Cloudflare resource, then align the Wrangler ID and deployed binding."
        );
      }
    }

    for (const actual of runtimeBindings) {
      if (!expectedByName.has(actual.name)) {
        addFinding(
          findings,
          `worker-binding-unexpected-${version.versionId}-${actual.name}`,
          "medium",
          `Unexpected Worker binding "${actual.name}" exists`,
          `Worker ${expected.worker} version ${version.versionId}`,
          `Live binding "${actual.name}" (type "${actual.type}") is not declared in this repository's Wrangler config.`,
          "Confirm the binding is intentional and either add it to source configuration or remove it through the approved deployment process."
        );
      }
    }
  }
}

function compareWorker(findings, expected, worker) {
  const activeVersions = worker.versions;
  for (const version of activeVersions) {
    const vars = version.bindings
      .filter((binding) => ["plain_text", "text", "var"].includes(binding.type))
      .map((binding) => binding.name);
    compareSet(findings, expected.vars, vars, {
      idPrefix: `worker-vars-${version.versionId}`,
      resource: "Worker variable",
      severityMissing: "high",
      severityExtra: "medium",
      recommendationMissing: "Restore the non-secret variable in Wrangler configuration and redeploy after review.",
      recommendationExtra: "Confirm the variable is intentional and reconcile its key with repository configuration.",
    });

    const secretBindings = version.bindings.filter((binding) => binding.type.startsWith("secret"));
    const requiredSecrets = expected.secrets.filter((secret) => secret.required).map((secret) => secret.name);
    const optionalSecrets = expected.secrets.filter((secret) => !secret.required).map((secret) => secret.name);
    const knownOptionalSecrets = new Set(optionalSecrets);
    const requiredAndUnexpectedSecrets = secretBindings
      .filter((binding) => !knownOptionalSecrets.has(binding.name))
      .map((binding) => binding.name);
    compareSet(findings, requiredSecrets, requiredAndUnexpectedSecrets, {
      idPrefix: `worker-secrets-required-${version.versionId}`,
      resource: "required Worker secret name",
      severityMissing: "high",
      severityExtra: "medium",
      recommendationMissing: "Confirm the required secret is provisioned with its supported secure workflow; do not place its value in Wrangler vars or reports.",
      recommendationExtra: "Confirm the secret is still needed and reconcile its name with the application environment contract.",
    });
    for (const name of optionalSecrets) {
      if (!secretBindings.some((binding) => binding.name === name)) {
        addFinding(
          findings,
          `worker-secret-optional-missing-${version.versionId}-${name}`,
          "low",
          `Optional Worker secret "${name}" is not configured`,
          `Worker ${expected.worker} version ${version.versionId}`,
          `The optional secret name "${name}" was not present in deployed bindings.`,
          "Configure it only if the associated optional feature is enabled."
        );
      }
    }

    compareBindings(findings, expected, [version]);
  }
}

function compareSchema(findings, expected, actual) {
  const expectedTables = expected.schema.tables;
  const actualTables = actual.tables;

  for (const [table, expectedColumns] of expectedTables) {
    const actualColumns = actualTables.get(table);
    if (!actualColumns) {
      addFinding(
        findings,
        `d1-table-missing-${table}`,
        "high",
        `Expected D1 table "${table}" is missing`,
        `D1 ${expected.database.name}`,
        `Repository schema declares "${table}", but the live sqlite_master catalog does not.`,
        "Review the missing schema change and prepare a versioned migration; do not apply it automatically."
      );
      continue;
    }
    compareSet(findings, expectedColumns, actualColumns, {
      idPrefix: `d1-column-${table}`,
      resource: `D1 column on ${table}`,
      severityMissing: "high",
      severityExtra: "medium",
      recommendationMissing: "Review the schema and migration history, then prepare an approved migration if the column is intended.",
      recommendationExtra: "Confirm whether the live-only column is a pending migration or undocumented production change.",
    });
  }

  for (const table of actualTables.keys()) {
    if (!expectedTables.has(table) && table !== "d1_migrations") {
      addFinding(
        findings,
        `d1-table-unexpected-${table}`,
        "medium",
        `Unexpected D1 table "${table}" exists`,
        `D1 ${expected.database.name}`,
        `Live sqlite_master contains "${table}", which is absent from schema.sql and migrations/*.sql.`,
        "Confirm whether the table is intentional, then document it or schedule approved cleanup."
      );
    }
  }

  for (const [table, expectedColumns] of expected.schema.columnDefinitions) {
    const actualColumns = actual.columnDefinitions?.get(table);
    if (!actualColumns) continue;
    for (const [column, definition] of expectedColumns) {
      if (actualColumns.has(column) && actualColumns.get(column) !== definition) {
        addFinding(
          findings,
          `d1-column-definition-${table}-${column}`,
          "high",
          `D1 column "${table}.${column}" has a different definition`,
          `D1 ${expected.database.name}`,
          `The normalized SQLite declaration for "${table}.${column}" differs from the repository schema.`,
          "Review the live definition and migration history; prepare an approved migration if this is unintended."
        );
      }
    }
  }

  for (const [table, expectedConstraints] of expected.schema.tableConstraints) {
    const actualConstraints = actual.tableConstraints?.get(table);
    if (!actualConstraints) continue;
    compareSet(findings, expectedConstraints, actualConstraints, {
      idPrefix: `d1-constraint-${table}`,
      resource: `D1 table constraint on ${table}`,
      severityMissing: "high",
      severityExtra: "medium",
      recommendationMissing: "Review the constraint and migration history; prepare an approved migration to restore it if required.",
      recommendationExtra: "Confirm whether the extra live constraint is intentional and document it.",
    });
  }

  compareSet(findings, expected.schema.indexes.keys(), actual.indexes.keys(), {
    idPrefix: "d1-index",
    resource: "D1 index",
    severityMissing: "medium",
    severityExtra: "low",
    recommendationMissing: "Review query patterns and prepare an approved migration to restore an intended index.",
    recommendationExtra: "Confirm the index's workload value and document or remove it through an approved migration.",
  });
  for (const [name, expectedIndex] of expected.schema.indexes) {
    const actualIndex = actual.indexes.get(name);
    if (actualIndex && (actualIndex.table !== expectedIndex.table || actualIndex.definition !== expectedIndex.definition)) {
      addFinding(
        findings,
        `d1-index-definition-${name}`,
        "medium",
        `D1 index "${name}" has a different definition`,
        `D1 ${expected.database.name}`,
        "The live index target or indexed expression differs from the repository schema.",
        "Review query plans and migration history before changing this index."
      );
    }
  }
}

export function createParityReport(expected, live, target, generatedAt = new Date().toISOString()) {
  const findings = [];
  const collectionErrors = live.collectionErrors ?? [];
  const safeWorkerState = live.worker
    ? {
        ...live.worker,
        versions: live.worker.versions.map((version) => ({
          versionId: version.versionId,
          percentage: version.percentage,
          bindings: version.bindings.map(normalizeBinding),
        })),
      }
    : null;
  if (safeWorkerState) compareWorker(findings, expected, safeWorkerState);
  if (live.databaseSchema) compareSchema(findings, expected, live.databaseSchema);

  const status = collectionErrors.length > 0
    ? "incomplete"
    : findings.length > 0
      ? "drift"
      : "clean";
  const safeWorker = safeWorkerState
    ? {
        deploymentId: safeWorkerState.deploymentId,
        createdOn: safeWorkerState.createdOn,
        versions: safeWorkerState.versions.map((version) => ({
          versionId: version.versionId,
          percentage: version.percentage,
          bindings: version.bindings,
        })),
      }
    : null;

  return {
    schemaVersion: REPORT_VERSION,
    generatedAt,
    status,
    target: {
      accountId: target.accountId,
      worker: expected.worker,
      database: expected.database,
    },
    resourcesReviewed: Number(Boolean(live.worker)) + Number(Boolean(live.databaseSchema)),
    sources: {
      config: "wrangler.jsonc",
      schema: "schema.sql plus migrations/*.sql",
      migrationFiles: expected.migrationFiles,
      migrationLedger: "Applied migration status is not inferred; this repository applies SQL files directly.",
    },
    expected: {
      bindings: expected.bindings,
      variableNames: expected.vars,
      secretNames: expected.secrets.map(({ name, required }) => ({ name, required })),
    },
    observed: {
      worker: safeWorker,
      database: live.databaseSchema
        ? {
            tables: [...live.databaseSchema.tables.entries()]
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([name, columns]) => ({ name, columns: [...columns].sort() })),
            indexes: [...live.databaseSchema.indexes.entries()]
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([name, index]) => ({ name, table: index.table })),
          }
        : null,
    },
    collectionErrors,
    findings: findings.sort((left, right) => {
      const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityRank[left.severity] - severityRank[right.severity] ||
        right.confidence - left.confidence ||
        left.id.localeCompare(right.id);
    }),
  };
}

export function renderMarkdown(report) {
  const severityCount = (severity) => report.findings.filter((finding) => finding.severity === severity).length;
  const lines = [
    "# Cloudflare parity audit",
    "",
    `- Status: **${report.status}**`,
    `- Target: account \`${report.target.accountId}\`, Worker \`${report.target.worker}\`, D1 \`${report.target.database.name}\``,
    `- Generated: ${report.generatedAt}`,
    `- Resources reviewed: ${report.resourcesReviewed}`,
    `- Findings: ${report.findings.length} (high ${severityCount("high")}, medium ${severityCount("medium")}, low ${severityCount("low")})`,
    "",
  ];

  if (report.collectionErrors.length) {
    lines.push("## Collection errors", "");
    for (const error of report.collectionErrors) lines.push(`- **${error.resource}:** ${error.message}`);
    lines.push("");
  }

  lines.push("## Findings", "");
  if (report.findings.length === 0) {
    lines.push(report.status === "clean" ? "No drift detected." : "No parity findings could be established.", "");
  } else {
    for (const finding of report.findings) {
      lines.push(
        `### ${finding.severity.toUpperCase()}: ${finding.title}`,
        "",
        `- Resource: ${finding.resource}`,
        `- Evidence: ${finding.evidence}`,
        `- Confidence: ${Math.round(finding.confidence * 100)}%`,
        `- Recommendation: ${finding.recommendation}`,
        ""
      );
    }
  }

  lines.push(
    "## Safety",
    "",
    "This report compares names and resource identifiers only. Worker variable values and secret values are not included. Live collection uses read-only Cloudflare API operations and a SELECT-only D1 query.",
    ""
  );
  return lines.join("\n");
}

async function writeReport(report, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "parity-report.json");
  const markdownPath = path.join(outputDir, "parity-report.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await writeFile(markdownPath, renderMarkdown(report), { mode: 0o600 });
  await Promise.all([chmod(jsonPath, 0o600), chmod(markdownPath, 0o600)]);
  return { jsonPath, markdownPath };
}

function parseArgs(argv) {
  const args = { mode: null, accountId: null, worker: null, fixture: null, outputDir: OUTPUT_DIR };
  const valueAfter = (index, option) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${option} requires a value.`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--live") args.mode = "live";
    else if (arg === "--fixture") {
      args.mode = "fixture";
      args.fixture = valueAfter(i, arg);
      i += 1;
    } else if (arg === "--account-id") {
      args.accountId = valueAfter(i, arg);
      i += 1;
    } else if (arg === "--worker") {
      args.worker = valueAfter(i, arg);
      i += 1;
    } else if (arg === "--out-dir") {
      args.outputDir = path.resolve(valueAfter(i, arg));
      i += 1;
    }
    else if (arg === "--help" || arg === "-h") args.mode = "help";
    else fail(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    "Usage:\n" +
      "  npm run cf:audit:parity -- --live [--account-id ID] [--worker NAME] [--out-dir PATH]\n" +
      "  npm run cf:audit:parity -- --fixture PATH [--account-id ID] [--worker NAME] [--out-dir PATH]\n\n" +
      "Live mode requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, with D1 Read and Workers Scripts Read permissions.\n"
  );
}

async function loadFixture(fixturePath, expected) {
  const fixture = JSON.parse(await readFile(path.resolve(fixturePath), "utf8"));
  const worker = fixture.worker ?? null;
  if (worker) {
    for (const version of worker.versions ?? []) {
      version.bindings = (version.bindings ?? []).map(normalizeBinding);
    }
  }
  let databaseSchema = null;
  if (Array.isArray(fixture.databaseRows)) {
    databaseSchema = parseSchema(fixture.databaseRows.map((row) => row.sql).filter((sql) => typeof sql === "string"));
  } else if (fixture.databaseSchema) {
    databaseSchema = {
      tables: new Map(Object.entries(fixture.databaseSchema.tables ?? {}).map(([name, columns]) => [name, new Set(columns)])),
      columnDefinitions: new Map(
        Object.entries(fixture.databaseSchema.columnDefinitions ?? {}).map(([name, columns]) => [name, new Map(Object.entries(columns))])
      ),
      tableConstraints: new Map(
        Object.entries(fixture.databaseSchema.tableConstraints ?? {}).map(([name, constraints]) => [name, new Set(constraints)])
      ),
      indexes: new Map(Object.entries(fixture.databaseSchema.indexes ?? {}).map(([name, index]) => [
        name,
        typeof index === "string" ? { table: index, definition: "" } : index,
      ])),
    };
  }
  return {
    worker,
    databaseSchema,
    collectionErrors: [],
    targetAccountId: fixture.accountId ?? null,
    expected,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "help") {
    printHelp();
    return;
  }
  if (!args.mode) fail("Choose an explicit mode: --live or --fixture PATH.");

  const expected = await loadExpectedState();
  const accountId = args.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const workerName = args.worker ?? expected.worker;
  if (!/^[a-f0-9]{32}$/i.test(accountId)) fail("Provide a valid 32-character Cloudflare account ID.");
  if (
    args.mode === "live" &&
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_ACCOUNT_ID.toLowerCase() !== accountId.toLowerCase()
  ) {
    fail("The requested account ID does not match CLOUDFLARE_ACCOUNT_ID; refusing to query Cloudflare.");
  }
  if (workerName !== expected.worker) fail(`Worker "${workerName}" does not match wrangler.jsonc name "${expected.worker}".`);

  let live;
  if (args.mode === "fixture") {
    if (!args.fixture) fail("--fixture requires a path.");
    const fixture = await loadFixture(args.fixture, expected);
    if (fixture.targetAccountId && fixture.targetAccountId !== accountId) {
      fail("Fixture account ID does not match the requested account ID.");
    }
    live = fixture;
  } else {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!token) fail("CLOUDFLARE_API_TOKEN is required for --live; it must not be passed as a command-line argument.");
    live = await collectLiveState(accountId, expected, token);
  }

  const report = createParityReport(expected, live, { accountId });
  const paths = await writeReport(report, args.outputDir);
  process.stdout.write(`Cloudflare parity status: ${report.status}\n`);
  process.stdout.write(`Findings: ${report.findings.length}\n`);
  process.stdout.write(`JSON: ${paths.jsonPath}\nMarkdown: ${paths.markdownPath}\n`);
  if (report.status === "incomplete") process.exitCode = 2;
  else if (report.status === "drift") process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Cloudflare parity audit failed: ${error.message}\n`);
    process.exitCode = 2;
  });
}
