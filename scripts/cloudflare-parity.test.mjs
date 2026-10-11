import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  createParityReport,
  collectLiveState,
  loadExpectedState,
  parseJsonc,
  parseSchema,
  renderMarkdown,
} from "./cloudflare-parity.mjs";

const ACCOUNT_ID = "ac9a47ddb8928af2f3535e2a1e4d8349";
const GENERATED_AT = "2026-10-02T12:00:00.000Z";

describe("Cloudflare parity audit", () => {
  it("parses Wrangler JSONC comments without modifying strings or trailing commas", () => {
    const value = parseJsonc(`{
      // comment
      "url": "https://example.test/a//b",
      "text": ",}",
      "items": [1, 2,],
    }`);
    assert.deepEqual(value, {
      url: "https://example.test/a//b",
      text: ",}",
      items: [1, 2],
    });
  });

  it("extracts the complete repository schema including migration-added columns", async () => {
    const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
    const migrationNames = (await readdir(new URL("../migrations", import.meta.url)))
      .filter((name) => /^\d+.*\.sql$/i.test(name))
      .sort();
    const migrations = await Promise.all(
      migrationNames.map((name) => readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"))
    );
    const parsed = parseSchema([schema, ...migrations]);

    assert.ok(parsed.tables.get("users").has("token_version"));
    assert.ok(parsed.tables.get("users").has("gift_expires_at"));
    assert.ok(parsed.tables.get("threads").has("journey_id"));
    assert.ok(parsed.tables.get("baselines").has("consent_accepted_at"));
    assert.ok(parsed.tables.has("promo_grants"));
    assert.equal(parsed.indexes.get("idx_promo_grants_owner").table, "promo_grants");
  });

  it("distinguishes unique and non-unique index definitions", () => {
    const unique = parseSchema(["CREATE TABLE sample (id TEXT); CREATE UNIQUE INDEX sample_idx ON sample (id);"]);
    const ordinary = parseSchema(["CREATE TABLE sample (id TEXT); CREATE INDEX sample_idx ON sample (id);"]);
    assert.notEqual(unique.indexes.get("sample_idx").definition, ordinary.indexes.get("sample_idx").definition);
  });

  it("reports a clean comparison and never serializes variable or secret values", async () => {
    const expected = await loadExpectedState();
    const bindings = [
      ...expected.bindings.map((binding) => ({
        type: binding.type,
        name: binding.name,
        ...(binding.resourceId ? { id: binding.resourceId } : {}),
      })),
      ...expected.vars.map((name) => ({
        type: "plain_text",
        name,
        text: "private-variable-value",
      })),
      ...expected.secrets.map(({ name }) => ({
        type: "secret_text",
        name,
        text: "private-secret-value",
      })),
    ];
    const report = createParityReport(
      expected,
      {
        worker: {
          deploymentId: "deployment-1",
          createdOn: GENERATED_AT,
          versions: [{ versionId: "version-1", percentage: 100, bindings }],
        },
        databaseSchema: expected.schema,
        collectionErrors: [],
      },
      { accountId: ACCOUNT_ID },
      GENERATED_AT
    );
    const serialized = JSON.stringify(report);

    assert.equal(report.status, "clean");
    assert.equal(report.findings.length, 0);
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.expected.secretNames.some((secret) => secret.name === "JWT_SECRET"), true);
    assert.equal(serialized.includes("private-variable-value"), false);
    assert.equal(serialized.includes("private-secret-value"), false);
    assert.match(renderMarkdown(report), /No drift detected/);
  });

  it("flags missing and unexpected Worker/D1 state with evidence", async () => {
    const expected = await loadExpectedState();
    const runtimeBindings = [
      ...expected.bindings
        .filter((binding) => binding.name !== "DB")
        .map((binding) => ({
          type: binding.type,
          name: binding.name,
          ...(binding.resourceId ? { id: binding.resourceId } : {}),
        })),
      { type: "plain_text", name: "UNDECLARED", text: "must-not-leak" },
      ...expected.vars
        .filter((name) => name !== "TURNSTILE_REQUIRED")
        .map((name) => ({ type: "plain_text", name, text: "private" })),
      ...expected.secrets
        .filter(({ name }) => name !== "JWT_SECRET")
        .map(({ name }) => ({ type: "secret_text", name, text: "private-secret" })),
    ];
    const actualSchema = {
      tables: new Map([...expected.schema.tables].map(([name, columns]) => [name, new Set(columns)])),
      columnDefinitions: new Map([...expected.schema.columnDefinitions].map(([name, columns]) => [name, new Map(columns)])),
      tableConstraints: new Map([...expected.schema.tableConstraints].map(([name, constraints]) => [name, new Set(constraints)])),
      indexes: new Map([...expected.schema.indexes].map(([name, index]) => [name, { ...index }])),
    };
    actualSchema.tables.get("users").delete("terms_version");
    actualSchema.columnDefinitions.get("users").set("token_version", "text");
    actualSchema.tables.set("production_only", new Set(["id"]));
    const report = createParityReport(
      expected,
      {
        worker: {
          deploymentId: "deployment-2",
          createdOn: GENERATED_AT,
          versions: [{ versionId: "version-2", percentage: 100, bindings: runtimeBindings }],
        },
        databaseSchema: actualSchema,
        collectionErrors: [],
      },
      { accountId: ACCOUNT_ID },
      GENERATED_AT
    );

    assert.equal(report.status, "drift");
    assert.ok(report.findings.some((finding) => finding.id.includes("worker-binding-missing") && finding.id.endsWith("-DB")));
    assert.ok(report.findings.some((finding) => finding.id.includes("worker-vars-") && finding.title.includes("TURNSTILE_REQUIRED")));
    assert.ok(report.findings.some((finding) => finding.id.includes("worker-secrets-required") && finding.title.includes("JWT_SECRET")));
    assert.ok(report.findings.some((finding) => finding.id === "d1-column-users-missing-terms_version"));
    assert.ok(report.findings.some((finding) => finding.id === "d1-column-definition-users-token_version"));
    assert.ok(report.findings.some((finding) => finding.id === "d1-table-unexpected-production_only"));
    assert.equal(JSON.stringify(report).includes("must-not-leak"), false);
    assert.equal(JSON.stringify(report).includes("private-secret"), false);
  });

  it("marks partial live collection as incomplete instead of clean", async () => {
    const expected = await loadExpectedState();
    const report = createParityReport(
      expected,
      {
        worker: null,
        databaseSchema: null,
        collectionErrors: [{ resource: "worker", message: "read denied" }],
      },
      { accountId: ACCOUNT_ID },
      GENERATED_AT
    );

    assert.equal(report.status, "incomplete");
    assert.equal(report.resourcesReviewed, 0);
    assert.equal(report.collectionErrors.length, 1);
  });

  it("uses read-only Cloudflare endpoints and strips secret values from version metadata", async () => {
    const expected = await loadExpectedState();
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options = {}) => {
      requests.push({ url: String(url), ...options });
      if (String(url).endsWith("/deployments")) {
        return new Response(JSON.stringify({
          success: true,
          result: {
            deployments: [{
              id: "deployment-readonly",
              created_on: GENERATED_AT,
              versions: [{ version_id: "version-readonly", percentage: 100 }],
            }],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (String(url).endsWith("/versions/version-readonly")) {
        return new Response(JSON.stringify({
          success: true,
          result: {
            resources: {
              bindings: [
                { type: "secret_text", name: "JWT_SECRET", text: "remote-secret-value" },
                { type: "plain_text", name: "FROM_EMAIL", text: "remote-variable-value" },
              ],
            },
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (String(url).includes("/d1/database/")) {
        return new Response(JSON.stringify({
          success: true,
          result: [{
            results: [{
              name: "users",
              type: "table",
              tbl_name: "users",
              sql: "CREATE TABLE users (id TEXT PRIMARY KEY)",
            }],
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected test URL: ${url}`);
    };

    try {
      const live = await collectLiveState(ACCOUNT_ID, expected, "test-token");
      const requestMethods = requests.map((request) => request.method ?? "GET");
      assert.deepEqual(requestMethods.sort(), ["GET", "GET", "POST"]);
      const d1Request = requests.find((request) => request.url.includes("/d1/database/"));
      const sql = JSON.parse(d1Request.body).sql;
      assert.match(sql, /^\s*SELECT\b/i);
      assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b/i);
      assert.ok(requests.every((request) => request.headers.Authorization === "Bearer test-token"));
      const serializedWorker = JSON.stringify(live.worker);
      assert.equal(serializedWorker.includes("remote-secret-value"), false);
      assert.equal(serializedWorker.includes("remote-variable-value"), false);
      assert.equal(live.collectionErrors.length, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("runs offline fixture mode and writes private JSON and Markdown reports", async () => {
    const expected = await loadExpectedState();
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "cloudflare-parity-"));
    const fixturePath = path.join(temporaryDirectory, "fixture.json");
    const outputDirectory = path.join(temporaryDirectory, "output");
    const fixture = {
      accountId: ACCOUNT_ID,
      worker: {
        deploymentId: "fixture-deployment",
        createdOn: GENERATED_AT,
        versions: [{
          versionId: "fixture-version",
          percentage: 100,
          bindings: [
            ...expected.bindings.map((binding) => ({
              type: binding.type,
              name: binding.name,
              ...(binding.resourceId ? { id: binding.resourceId } : {}),
            })),
            ...expected.vars.map((name) => ({ type: "plain_text", name })),
            ...expected.secrets.map(({ name }) => ({ type: "secret_text", name })),
          ],
        }],
      },
      databaseSchema: {
        tables: Object.fromEntries([...expected.schema.tables].map(([name, columns]) => [name, [...columns]])),
        columnDefinitions: Object.fromEntries([...expected.schema.columnDefinitions].map(([name, columns]) => [name, Object.fromEntries(columns)])),
        tableConstraints: Object.fromEntries([...expected.schema.tableConstraints].map(([name, constraints]) => [name, [...constraints]])),
        indexes: Object.fromEntries([...expected.schema.indexes].map(([name, index]) => [name, index])),
      },
    };

    try {
      await writeFile(fixturePath, JSON.stringify(fixture));
      const scriptPath = new URL("./cloudflare-parity.mjs", import.meta.url);
      const result = spawnSync(
        process.execPath,
        [scriptPath.pathname, "--fixture", fixturePath, "--account-id", ACCOUNT_ID, "--out-dir", outputDirectory],
        { encoding: "utf8" }
      );
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(await readFile(path.join(outputDirectory, "parity-report.json"), "utf8"));
      const markdown = await readFile(path.join(outputDirectory, "parity-report.md"), "utf8");
      assert.equal(report.status, "clean");
      assert.match(markdown, /No drift detected/);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("rejects an account override that conflicts with live account confirmation", async () => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "cloudflare-parity-account-"));
    try {
      const scriptPath = new URL("./cloudflare-parity.mjs", import.meta.url);
      const result = spawnSync(
        process.execPath,
        [
          scriptPath.pathname,
          "--live",
          "--account-id",
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "--out-dir",
          temporaryDirectory,
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
            CLOUDFLARE_API_TOKEN: "do-not-print-this-token",
          },
        }
      );
      assert.equal(result.status, 2);
      assert.match(result.stderr, /does not match CLOUDFLARE_ACCOUNT_ID/);
      assert.equal(result.stderr.includes("do-not-print-this-token"), false);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
