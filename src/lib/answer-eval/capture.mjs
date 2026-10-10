#!/usr/bin/env node
/**
 * One-off capture driver — owner-authorised via open-tasks #59.
 *
 * Bundles record.ts (and the answer-eval harness) with the repo's own esbuild
 * devDependency to a temp ESM file, then runs `runCapture`. record.ts itself
 * drives the SAME pipeline entry points the chat route uses, against the real
 * model over the account's Workers AI REST endpoint (direct tier — the product
 * prefers the AI Gateway binding, which a plain Node script cannot reach).
 *
 * Env:
 *   CLOUDFLARE_ACCOUNT_ID  (defaults to the production os account id below)
 *   CLOUDFLARE_API_TOKEN   (required; falls back to ~/.cf_token if present)
 *
 * The token is read from the environment / the user's home dotfile — never
 * written into this repo, never committed.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_ACCOUNT_ID = "ac9a47ddb8928af2f3535e2a1e4d8349";

function loadToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  try {
    return readFileSync(join(homedir(), ".cf_token"), "utf8").trim();
  } catch {
    return "";
  }
}

const here = fileURLToPath(new URL(".", import.meta.url));
const tmpDir = mkdtempSync(join(tmpdir(), "answer-eval-capture-"));
const outfile = join(tmpDir, "record-bundle.mjs");

try {
  await build({
    entryPoints: [join(here, "record.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile,
    logLevel: "error",
  });

  const { runCapture } = await import(pathToFileURL(outfile).href);
  const { recorded } = await runCapture({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID,
    apiToken: loadToken(),
    // import.meta.url under the bundle points at the temp file, so the repo
    // path must come from here, the real source location.
    outDir: join(here, "recorded"),
  });

  console.log(`captured ${recorded.length} recorded answers`);
  for (const r of recorded) {
    console.log(`  ${r.fixtureId}: ${r.observedTotal.toFixed(2)} (${r.usage.total_tokens ?? "?"} tokens)`);
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}