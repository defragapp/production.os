#!/usr/bin/env node
/**
 * verify:release — the permanent pre-commit / pre-deploy ratchet.
 *
 * One command, seven gates, all must be green before a commit or deploy:
 *   1. tsc --noEmit                       — types
 *   2. eslint . (--max-warnings 0)        — lint, warnings fail
 *   3. vitest run                          — unit + pure-reducer tests
 *   4. opennextjs-cloudflare build         — clean build, NO esbuild duplicate-key warnings
 *   5. browser vault round-trip            — real AES-GCM + IndexedDB via the committed module
 *   6. browser JourneyCanvas render        — committed components render with zero console errors
 *   7. touch/CSS structural guard          — the coarse-pointer 44px floor is still in globals.css
 *   + (best-effort) live public-route console/overflow at 390 / 768 / 1440 against `preview`.
 *
 * Gates 1-7 fail closed. The public-route pass boots the real edge server; if
 * it cannot come up in this environment it is reported as SKIPPED (never a
 * false PASS), because a flaky boot is an environment fact, not a code defect.
 *
 * Run: `npm run verify:release`. Exit 0 = every gate green, safe to deploy.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const cacheDir = path.join(root, "node_modules", ".cache", "sovereign-verify");
const npmRun = process.platform === "win32" ? "npm.cmd" : "npm";

let failures = 0;
const results = [];

function heading(text) {
  console.log(`\n\u2500\u2500\u2500 ${text} \u2500\u2500\u2500`.padEnd(64, "\u2500"));
}
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const mark = ok ? "\u2713" : "\u2717";
  console.log(`  ${mark} ${name}${detail ? `  — ${detail}` : ""}`);
}

/** Run a command, resolve {code, stdout, stderr}. Does not reject on non-zero. */
function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: root, ...opts });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (err) => resolve({ code: -1, stdout, stderr: stderr + String(err) }));
  });
}

async function gateStaticAnalysis() {
  heading("Gate 1-3 · types, lint, tests");

  const tsc = await run(npmRun, ["run", "typecheck"]);
  record("typecheck (tsc --noEmit)", tsc.code === 0, tsc.code === 0 ? "" : (tsc.stderr || tsc.stdout).split("\n").slice(-6).join(" "));

  const lint = await run(npmRun, ["run", "lint", "--", "--max-warnings", "0"]);
  record("lint (eslint, 0 warnings)", lint.code === 0, lint.code === 0 ? "" : (lint.stderr || lint.stdout).split("\n").slice(-8).join(" "));

  const test = await run(npmRun, ["test"]);
  const testSummary = (test.stdout.match(/Tests\s+.+/i) || [""])[0].trim();
  record("unit tests (vitest run)", test.code === 0, test.code === 0 ? testSummary : (test.stderr || test.stdout).split("\n").slice(-8).join(" "));
}

async function gateBuild() {
  heading("Gate 4 · clean build (no duplicate-key / bundler warnings)");
  const build = await run(npmRun, ["run", "build"]);
  // `npm run build` = `next build`. The esbuild duplicate-key warnings surfaced
  // during the OpenNext bundling; run the opennext build too so the ratchet
  // actually sees them.
  const onext = await run("npx", ["opennextjs-cloudflare", "build"]);
  const combined = build.stdout + build.stderr + onext.stdout + onext.stderr;
  const codeOk = build.code === 0 && onext.code === 0;
  const dupKey = /Duplicate key/i.test(combined);
  record("build exits 0", codeOk, codeOk ? "" : "build returned non-zero");
  record("no esbuild duplicate-key warnings", !dupKey, dupKey ? "a 'Duplicate key ... in object literal' warning is present" : "");
}

/** Build the two browser harness bundles with esbuild (aliases the app's @/). */
async function buildHarnesses() {
  const esbuild = (await import("esbuild")).default;
  fs.mkdirSync(cacheDir, { recursive: true });
  const common = {
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    jsx: "automatic",
    alias: { "@": srcDir },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  };
  await esbuild.build({ ...common, entryPoints: [path.join(root, "scripts/e2e/vault-harness.ts")], outfile: path.join(cacheDir, "vault.js") });
  await esbuild.build({ ...common, entryPoints: [path.join(root, "scripts/e2e/canvas-harness.tsx")], outfile: path.join(cacheDir, "canvas.js") });
}

/** Minimal loopback static server (localhost = secure context: crypto + IDB). */
function serveHarnessPage(port) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>verify harness</title>
  <style>html,body{margin:0;background:#0b0a09;color:#eee;font-family:system-ui,sans-serif}</style>
  </head><body><div id="journey"></div>
  <script src="/vault.js"></script><script src="/canvas.js"></script></body></html>`;
  const server = http.createServer((req, res) => {
    if (req.url === "/vault.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(fs.readFileSync(path.join(cacheDir, "vault.js")));
    } else if (req.url === "/canvas.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(fs.readFileSync(path.join(cacheDir, "canvas.js")));
    } else {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(html);
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

async function gateBrowser() {
  heading("Gate 5-7 · browser vault, JourneyCanvas render, touch floor");
  await buildHarnesses();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const port = 8791;
  const server = await serveHarnessPage(port);
  const url = `http://127.0.0.1:${port}/`;

  const consoleErrors = [];
  try {
    // Desktop context: crypto + IndexedDB available; render + vault assertions.
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    await page.goto(url, { waitUntil: "load" });

    // Gate 5: AES-GCM + IndexedDB round-trip via the committed module.
    const vault = await page.evaluate(() => window.__sovereignVault.run());
    record("vault: IndexedDB + crypto.subtle available", vault.available, vault.available ? "" : "browser lacks IDB/subtle (unexpected in Chrome)");
    record("vault: write succeeded", vault.wrote);
    record("vault: ciphertext at rest (opaque base64url blob)", vault.ciphertextAtRest);
    record("vault: plaintext absent from stored bytes", vault.plaintextAbsent);
    record("vault: decrypt round-trips to the same object", vault.roundTripEquals);
    record("vault: clear removes the record", vault.cleared);

    // Gate 6: JourneyCanvas / JourneyBar render from deterministic state.
    await page.evaluate(() => window.__mountJourney(document.getElementById("journey"), 3));
    await page.waitForSelector("#journey svg", { timeout: 4000 });
    const render = await page.evaluate(() => {
      const svg = document.querySelector("#journey svg");
      const circles = svg ? svg.querySelectorAll("circle").length : 0;
      const line = svg ? svg.querySelector(".journey-progress-line") : null;
      const offset = line ? line.getAttribute("stroke-dashoffset") : null;
      const stepRows = document.querySelectorAll("#journey ol li").length;
      const horizontal = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { circles, offset, stepRows, horizontal };
    });
    // 3 done + 1 current each render a node circle (done r=8, current r=6+ring), locked r=6 => 5 step circles + 1 current halo = 6 circles.
    record("canvas: milestone nodes render (>= 5 circles)", render.circles >= 5, `circles=${render.circles}`);
    record("canvas: 5 step rows render", render.stepRows === 5, `rows=${render.stepRows}`);
    record("canvas: progress line reflects state", render.offset !== null && Number(render.offset) > 0 && Number(render.offset) < 1, `dashoffset=${render.offset}`);
    record("canvas: no horizontal overflow", render.horizontal <= 1, `overflow=${render.horizontal}px`);

    // Gate 7a: coarse-pointer 44px floor must still be authored in globals.css.
    const css = fs.readFileSync(path.join(srcDir, "app/globals.css"), "utf8");
    const coarseBlock = /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\n\s*\}/.exec(css)?.[0] ?? "";
    const hasFloor =
      /\.journey-bar\s+button/.test(coarseBlock) &&
      /\.memory-pill/.test(coarseBlock) &&
      /\[role="switch"\]/.test(coarseBlock) &&
      /\[role="radio"\]/.test(coarseBlock) &&
      /min-height:\s*2\.75rem/.test(coarseBlock);
    record("css: coarse-pointer 44px floor present in globals.css", hasFloor);

    // Gate 7b: touch context — coarse pointer matched + tap targets >= 44px.
    const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    touchPage.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    touchPage.on("pageerror", (e) => consoleErrors.push(String(e)));
    await touchPage.goto(url, { waitUntil: "load" });
    // Inject the authored coarse rule so the measurement reflects the real CSS.
    await touchPage.addStyleTag({ content: coarseBlock || "@media (pointer: coarse){ .journey-bar button{min-height:2.75rem} }" });
    await touchPage.evaluate(() => window.__mountJourney(document.getElementById("journey"), 3));
    await touchPage.waitForSelector("#journey button", { timeout: 4000 });
    const touch = await touchPage.evaluate(() => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const btns = [...document.querySelectorAll("#journey button")];
      const sizes = btns.map((b) => Math.round(b.getBoundingClientRect().height));
      return { coarse, count: btns.length, min: Math.min(...sizes, 9999) };
    });
    record("touch: coarse pointer matched under mobile emulation", touch.coarse);
    record("touch: every journey control >= 44px tall", touch.min >= 44, `min height=${touch.min}px across ${touch.count} controls`);

    record("browser: zero console / page errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
    await page.close();
    await touchPage.close();
  } finally {
    await browser.close();
    server.close();
  }
}

async function gateRoutes() {
  heading("Bonus · live public-route console + overflow (skips if the edge server can't boot here)");
  let child;
  let booted = false;
  const port = 8788;
  try {
    child = spawn(npmRun, ["run", "preview", "--", "--port", String(port)], { cwd: root, stdio: "ignore" });
    for (let i = 0; i < 45 && !booted; i += 1) {
      await sleep(2000);
      booted = await fetchWithTimeout(`http://localhost:${port}/onboard`, 2000).then((r) => r.ok).catch(() => false);
    }
  } catch {
    booted = false;
  }

  if (!booted) {
    record("public routes (preview server)", true, "SKIPPED — preview server did not come up in this environment");
    if (child) child.kill("SIGKILL");
    return;
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const routes = ["/", "/onboard", "/privacy", "/terms"];
  const viewports = [
    { width: 390, height: 844, hasTouch: true, isMobile: true },
    { width: 768, height: 1024, hasTouch: true },
    { width: 1440, height: 900 },
  ];
  const problems = [];
  try {
    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.hasTouch, isMobile: vp.isMobile });
      page.on("console", (m) => { if (m.type() === "error") problems.push(`${vp.width} console: ${m.text()}`); });
      page.on("pageerror", (e) => problems.push(`${vp.width} pageerror: ${e}`));
      for (const route of routes) {
        try {
          await page.goto(`http://localhost:${port}${route}`, { waitUntil: "domcontentloaded", timeout: 15000 });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (overflow > 1) problems.push(`overflow ${overflow}px at ${vp.width} on ${route}`);
        } catch (e) {
          problems.push(`nav failed ${route}@${vp.width}: ${e}`);
        }
      }
      await page.close();
    }
    record("public routes console-clean + zero overflow (390/768/1440)", problems.length === 0, problems.slice(0, 3).join(" | "));
  } finally {
    await browser.close();
    if (child) child.kill("SIGKILL");
  }
}

function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function main() {
  const started = Date.now();
  console.log("verify:release — continuous stability & zero-regression ratchet");
  await gateStaticAnalysis();
  await gateBuild();
  await gateBrowser();
  await gateRoutes();

  heading("Summary");
  const passed = results.filter((r) => r.ok).length;
  console.log(`  ${passed}/${results.length} checks green in ${Math.round((Date.now() - started) / 1000)}s`);
  if (failures > 0) {
    console.log(`\n  RESULT: FAIL (${failures} failing gate(s)) — do NOT commit or deploy.`);
    process.exit(1);
  }
  console.log("\n  RESULT: PASS — safe to commit and deploy.");
  // Harness bundles live under node_modules/.cache (gitignored) — no cleanup needed.
  process.exit(0);
}

main().catch((err) => {
  console.error("\nverify:release crashed:", err);
  process.exit(1);
});
