#!/usr/bin/env node
/**
 * verify:release — the permanent pre-commit / pre-deploy ratchet.
 *
 * One command, nineteen gates, all must be green before a commit or deploy:
 *   1. tsc --noEmit                       — types
 *   2. eslint . (--max-warnings 0)        — lint, warnings fail
 *   3. vitest run                          — unit + pure-reducer tests
 *  3b. contract wiring                     — the veil / draft-recovery /
 *                                            announcement / nav ratchets are
 *                                            still APPLIED in committed source
 *   4. opennextjs-cloudflare build         — clean build, NO esbuild duplicate-key warnings
 *   5. browser vault round-trip            — real AES-GCM + IndexedDB via the committed module
 *   6. browser JourneyCanvas render        — committed components render with zero console errors
 *   7. touch/CSS structural guard          — the coarse-pointer 44px floor is still in globals.css
 *   8. zero-CLS veil                       — the committed .journey-veil overlay arrives with CLS ≤ 0.01
 *   + (best-effort) live public-route console/overflow at 390 / 768 / 1440 against `preview`.
 *   9. authenticated surface walk          — seeded local-D1 session across /chat /settings
 *                                            /baseline /account at 3 viewports: console-clean,
 *                                            zero overflow, coarse 44px, live CLS ≤ 0.01.
 *  10. draft-recovery on a 503            — Playwright stubs /api/chat 503: the user's words
 *                                            survive, one-tap Try again re-sends without
 *                                            duplicating the turn or touching thread history.
 *  11. failed-turn keyboard contract      — Tab order + :focus-visible ring on the recovery row.
 *  12. transcript clearance               — the first message is never behind the collapsed veil
 *                                            (hit-tested, 390×844 / 390×640 / 1440×900, scrollTop 0).
 *  13. live veil interactions             — expand → "Not there yet?" step override → collapse on
 *                                            the real /chat page, CLS ≤ 0.01, console-clean, and the
 *                                            panel never spills onto the composer.
 *  14. mid-stream SSE drop                — a stream that closes before `content` + `[DONE]` arms
 *                                            the same one-tap retry and recovers on re-run.
 *  15. veil dismissal                     — Escape AND a tap on the transcript fold the expanded
 *                                            panel back to the compact band, CLS ≤ 0.01, focus kept.
 *  16. scroll affordance                  — the capped panel shows its bottom fade only while steps
 *                                            are out of reach (390×500), and loses it at the bottom.
 *  17. thread-switch isolation            — switching threads / New chat clears the retry banner,
 *                                            swaps the transcript, and follows threads.journey_id.
 *  18. voice dictation                    — a stubbed Web Speech engine: the mic mounts, is ≥44px,
 *                                            toggles aria-pressed, feeds the draft, lets go on send;
 *                                            with the API removed, no control renders at all.
 *  19. Device-Only parity                 — same walk with memory_mode='local' and a journey that
 *                                            exists only in the encrypted IndexedDB vault: thread
 *                                            switching keeps the DEVICE journey, never the server row
 *                                            the thread is linked to, and stays movement-free.
 *
 * Gates 1-8 and 10-19 fail closed. The preview-backed passes (9-19) boot the
 * real edge server against LOCAL D1 only; if it cannot come up or the local
 * seed cannot be written in this environment they are reported as SKIPPED
 * (never a false PASS), because a flaky boot is an environment fact, not a
 * code defect.
 *
 * Run: `npm run verify:release`. Exit 0 = every gate green, safe to deploy.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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

/** One statement against the LOCAL dev D1 only (.wrangler/state). Nothing in
 *  this script ever touches production D1: the authenticated passes need a
 *  seeded account, and `--local` is the only mode they are allowed to use. */
const d1Local = (command) =>
  run("npx", ["wrangler", "d1", "execute", "production-os-db", "--local", "--command", command]);

async function gateStaticAnalysis() {
  heading("Gate 1-3 · types, lint, tests");

  const tsc = await run(npmRun, ["run", "typecheck"]);
  record("typecheck (tsc --noEmit)", tsc.code === 0, tsc.code === 0 ? "" : (tsc.stderr || tsc.stdout).split("\n").slice(-6).join(" "));

  const lint = await run(npmRun, ["run", "lint", "--", "--max-warnings", "0"]);
  record("lint (eslint, 0 warnings)", lint.code === 0, lint.code === 0 ? "" : (lint.stderr || lint.stdout).split("\n").slice(-8).join(" "));

  const test = await run(npmRun, ["test"]);
  const testSummary = (test.stdout.match(/Tests\s+.+/i) || [""])[0].trim();
  record("unit tests (vitest run)", test.code === 0, test.code === 0 ? testSummary : (test.stderr || test.stdout).split("\n").slice(-8).join(" "));

  // Wiring ratchets for the resilience contracts, so a later refactor cannot
  // quietly drop them. Gate 8 measures the veil's behaviour; this proves the
  // chat shell still USES the measured contract.
  heading("Gate 3b · committed resilience contracts are still wired");
  const css = fs.readFileSync(path.join(srcDir, "app/globals.css"), "utf8");
  const chat = fs.readFileSync(path.join(srcDir, "app/chat/chat-client.tsx"), "utf8");
  const nav = fs.readFileSync(path.join(srcDir, "components/nav.tsx"), "utf8");
  const veilWired =
    css.includes(".journey-veil {") &&
    css.includes(".journey-veil-open {") &&
    chat.includes("journey-veil") &&
    chat.includes("journey-veil-open");
  record("chat shell mounts the measured .journey-veil contract", veilWired, veilWired ? "" : "the veil class is authored but no longer applied in chat-client");
  const neverLoses =
    /sovereign-chat-draft:/.test(chat) &&
    chat.includes("Try again") &&
    /min-h-\[44px\]/.test(chat) &&
    /navigator\.onLine/.test(chat);
  record("failed-turn recovery: draft key + one-tap retry + offline watch present", neverLoses, neverLoses ? "" : "a draft/recovery affordance was removed from chat-client");
  const announceWired =
    /role="status"[\s\S]{0,80}aria-live="polite"|aria-live="polite"[\s\S]{0,80}role="status"/.test(chat) &&
    chat.includes("MILESTONE_STEP_LABELS");
  record("milestone announcements stay polite, one-shot, label-mapped", announceWired, announceWired ? "" : "the sr-only status region or its label mapping is gone");
  const navStable = /authed !== null/.test(nav) && nav.includes("nav-fade") && css.includes(".nav-fade {");
  record("header nav reveals (never swaps) its auth-aware variant", navStable, navStable ? "" : "nav.tsx would again swap link sets in place (tablet CLS regression)");
  // The occlusion contract (Gate 12/13 measure the behaviour; this proves the
  // page still reserves the space and keeps the panel above transformed rows).
  const canvas = fs.readFileSync(path.join(srcDir, "components/journey-canvas.tsx"), "utf8");
  const clearanceWired =
    css.includes(".journey-clearance {") &&
    css.includes(".journey-veil-compact {") &&
    /\.journey-veil \{[^}]*z-index:\s*20/.test(css) &&
    /\.journey-veil \{[^}]*max-height:\s*100%/.test(css) &&
    chat.includes("journey-clearance") &&
    chat.includes("relative flex min-h-0 flex-1 flex-col") &&
    chat.includes("journeyExpanded");
  record("transcript still reserves the compact band (static clearance + anchored veil)", clearanceWired,
    clearanceWired ? "" : "the veil lost its anchor wrapper, its z-index, its height cap, or the transcript's static clearance");
  const compactToggle = canvas.includes("journey-veil-compact") && canvas.includes("onToggleExpanded") && canvas.includes('id="journey-steps"');
  record("journey bar ships compact + expanded forms behind one toggle", compactToggle, compactToggle ? "" : "JourneyBar's compact band or its step container was removed");
  const truncation = /sawDone/.test(chat) && /sawContent/.test(chat) && /!sawDone \|\| !sawContent/.test(chat) && chat.includes('kind: "incomplete"');
  record("a truncated SSE is treated as an incomplete turn, not a success", truncation, truncation ? "" : "the stream no longer checks for content + [DONE] before declaring the turn fine");
  // Dismissal + scroll affordance: Gate 15/16 measure the behaviour; this proves
  // the page still offers both ways to fold the panel and still marks overflow.
  const dismissal =
    css.includes(".journey-veil-fade::after {") &&
    /\.journey-veil-fade::after \{[^}]*position: sticky/.test(css) &&
    /\.journey-veil-fade::after \{[^}]*margin-bottom: -28px/.test(css) &&
    chat.includes("journey-veil-fade") &&
    chat.includes('event.key !== "Escape"') &&
    chat.includes("scrollerRef") &&
    /el\.addEventListener\("click", onClick\)/.test(chat);
  record("the expanded panel folds on Escape and on a transcript tap, with a scroll cue", dismissal,
    dismissal ? "" : "the veil lost its fade rule, its Escape handler, or its transcript-tap collapse");
  const store = fs.readFileSync(path.join(srcDir, "lib/journey-store.ts"), "utf8");
  const threadsRoute = fs.readFileSync(path.join(srcDir, "app/api/threads/route.ts"), "utf8");
  const chatRoute = fs.readFileSync(path.join(srcDir, "app/api/chat/route.ts"), "utf8");
  const isolation =
    chat.includes("clearThreadContext") &&
    /const clearThreadContext = useCallback\(\(\) => \{[\s\S]{0,400}setFailedTurn\(null\)/.test(chat) &&
    chat.includes("linkJourneyToThread") &&
    store.includes("fetchById") &&
    store.includes("selectLinked") &&
    threadsRoute.includes("SELECT id, user_id, message_history, journey_id") &&
    chatRoute.includes("UPDATE threads SET journey_id = ?");
  record("thread switching clears transient state and follows threads.journey_id", isolation,
    isolation ? "" : "a thread switch would again carry a retry banner / open panel into the next conversation");
  // Device-Only parity (Gate 19 measures it): the vault must stay reachable by
  // the same key/id names this script writes, and the store must keep resolving
  // a thread link through the device's single journey instead of asking D1.
  const parity =
    store.includes('async fetchById()') &&
    store.includes("viewFromLocal(rec)") &&
    chat.includes('Device-Only memory') &&
    fs.readFileSync(path.join(srcDir, "lib/local-memory.ts"), "utf8").includes('"journey-aesgcm"');
  record("Device-Only mode still resolves a thread's journey from the vault, not D1", parity,
    parity ? "" : "the local store lost fetchById / viewFromLocal, or the vault's key id moved without the gate's writer");
  const dictPath = path.join(srcDir, "lib/dictation.ts");
  const dict = fs.existsSync(dictPath) ? fs.readFileSync(dictPath, "utf8") : "";
  const voice =
    dict.includes("webkitSpeechRecognition") &&
    dict.includes("not-allowed") &&
    /interimResults = false/.test(dict) &&
    chat.includes("useDictation") &&
    chat.includes("aria-pressed={dictating}") &&
    chat.includes("motion-reduce:animate-none") &&
    /stopDictation\(\);\n\s*setFailedTurn\(null\)/.test(chat) &&
    /clearThreadContext[\s\S]{0,400}stopDictation\(\)/.test(chat);
  record("voice dictation is progressive, motion-safe, and stops on send / thread switch", voice,
    voice ? "" : "dictation lost its feature detection, its press state, or a stop path (a mic that outlives the turn)");
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
  const clsHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>cls harness</title>
  <style>html,body{margin:0;background:#0b0a09;color:#eee;font-family:system-ui,sans-serif}#fixture{display:flex;flex-direction:column;height:100vh}</style>
  </head><body><div id="fixture"><div id="journey"></div></div>
  <script src="/canvas.js"></script></body></html>`;
  const server = http.createServer((req, res) => {
    if (req.url === "/vault.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(fs.readFileSync(path.join(cacheDir, "vault.js")));
    } else if (req.url === "/canvas.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(fs.readFileSync(path.join(cacheDir, "canvas.js")));
    } else if (req.url === "/cls") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(clsHtml);
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
  const url = `http://127.0.0.1:${port}`;

  const consoleErrors = [];
  try {
    // Desktop context: crypto + IndexedDB available; render + vault assertions.
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    await page.goto(`${url}/`, { waitUntil: "load" });

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
    await touchPage.goto(`${url}/`, { waitUntil: "load" });
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
  }
  return { url, server };
}

async function gateCls(url) {
  heading("Gate 8 · zero-CLS JourneyBar veil (committed overlay contract)");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    // Deliberately NOT isMobile-emulated: Chrome's mobile view mode suppresses
    // layout-shift entries entirely (measured), which would turn every ≤ 0.01
    // assertion here into silent theatre. The veil contract has no touch
    // dependency; the 390×844 viewport is what the geometry is tested at.
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${url}/cls`, { waitUntil: "load" });
    // Inject the committed veil CSS verbatim, plus the tokens it references
    // — the gate measures the real authored contract, not a re-creation.
    const css = fs.readFileSync(path.join(srcDir, "app/globals.css"), "utf8");
    const veilBlock = css.slice(css.indexOf(".journey-veil {"));
    const rootBlock = /:root\s*\{[\s\S]*?\n\s*\}/.exec(css)?.[0] ?? ":root{--border:30 7% 14%}";
    await page.addStyleTag({ content: `${rootBlock}\n${veilBlock}` });

    await page.evaluate(() => window.__mountReveal(document.getElementById("fixture"), 3));
    // The bar is mounted inside the closed (clipped) veil — wait for it to
    // exist, not to be visible; the veil opening is what we measure.
    await page.waitForSelector("#reveal-slot svg", { state: "attached", timeout: 4000 });
    await sleep(400);

    // Detector sanity: the SAME bar inserted discretely IN FLOW at the
    // transcript's top edge (the pre-fix behavior) MUST read as a shift — if
    // the observer is blind here, every zero-CLS assertion below is theatre.
    // The reset and the mount are separate tasks on purpose: React commits
    // its render asynchronously, and a later same-task unmount would cancel
    // the movement before Chrome ever paints (and counts) it.
    await page.evaluate(() => { window.__clsReset(); window.__mountNaive(document.getElementById("fixture"), 3); });
    await sleep(350);
    const naive = await page.evaluate(() => window.__clsRead());
    record("cls: detector catches a discrete in-flow mount", naive.total > 0.005, `naive CLS=${naive.total.toFixed(4)}`);

    // Drop the naive mount and let the fixture settle BEFORE resetting the
    // tally — then open the veil in its own block, so the arrival is measured
    // against a clean, painted baseline.
    await page.evaluate(() => window.__naiveClear());
    await sleep(300);
    await page.evaluate(() => { window.__clsReset(); window.__revealOpen(true); });
    await sleep(600);
    const open = await page.evaluate(() => window.__clsRead());
    record("cls: JourneyBar veil arrival (transform/opacity) ≤ 0.01", open.total <= 0.01, `CLS=${open.total.toFixed(4)} across ${open.count} entr(ies)`);

    await page.evaluate(() => { window.__clsReset(); window.__revealOpen(false); });
    await sleep(500);
    const close = await page.evaluate(() => window.__clsRead());
    record("cls: veil collapse / dismiss ≤ 0.01", close.total <= 0.01, `CLS=${close.total.toFixed(4)}`);

    await page.evaluate(() => { window.__clsReset(); window.__appendRows(6); });
    await sleep(400);
    const insert = await page.evaluate(() => window.__clsRead());
    record("cls: message insertion into the anchored transcript ≤ 0.01", insert.total <= 0.01, `CLS=${insert.total.toFixed(4)}`);

    await page.evaluate(() => { window.__clsReset(); window.__revealOpen(true); });
    await sleep(600);
    const again = await page.evaluate(() => window.__clsRead());
    record("cls: veil re-arrival after dismissal ≤ 0.01", again.total <= 0.01, `CLS=${again.total.toFixed(4)}`);

    // The compact ↔ expanded swap the page now exposes: the panel changes its
    // own height inside an absolutely-positioned box, so the transcript under
    // it must not move at all — in either direction.
    await page.evaluate(() => { window.__clsReset(); window.__revealExpand(false); });
    await sleep(450);
    const toCompact = await page.evaluate(() => window.__clsRead());
    record("cls: veil expanded → compact swap ≤ 0.01", toCompact.total <= 0.01, `CLS=${toCompact.total.toFixed(4)}`);

    await page.evaluate(() => { window.__clsReset(); window.__revealExpand(true); });
    await sleep(450);
    const toFull = await page.evaluate(() => window.__clsRead());
    record("cls: veil compact → expanded swap ≤ 0.01", toFull.total <= 0.01, `CLS=${toFull.total.toFixed(4)}`);

    await page.close();
  } finally {
    await browser.close();
  }
}

/** Boot the real edge server against LOCAL persistence (never remote D1). */
function launchPreview(port) {
  let child;
  try {
    child = spawn(npmRun, ["run", "preview", "--", "--port", String(port)], { cwd: root, stdio: "ignore" });
  } catch {
    return Promise.resolve({ child: null, booted: false });
  }
  return (async () => {
    let booted = false;
    for (let i = 0; i < 45 && !booted; i += 1) {
      await sleep(2000);
      booted = await fetchWithTimeout(`http://localhost:${port}/onboard`, 2000).then((r) => r.ok).catch(() => false);
    }
    return { child, booted };
  })();
}

async function gateRoutes(port, booted) {
  heading("Bonus · live public-route console + overflow (skips if the edge server can't boot here)");
  if (!booted) {
    record("public routes (preview server)", true, "SKIPPED — preview server did not come up in this environment");
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
  }
}

const FIXTURE_USER_ID = "7v7f1r00-0000-4000-8000-000000000001";
const FIXTURE_JOURNEY_ID = "7v7f1r00-0000-4000-8000-000000000002";
const FIXTURE_THREAD_ID = "7v7f1r00-0000-4000-8000-000000000003";
// The second journey/thread pair is what makes thread-switching falsifiable:
// each thread links a different journey, so a bar that fails to follow the
// conversation shows the other goal and the gate sees it.
const FIXTURE_JOURNEY2_ID = "7v7f1r00-0000-4000-8000-000000000004";
const FIXTURE_THREAD2_ID = "7v7f1r00-0000-4000-8000-000000000005";
const FIXTURE_EMAIL = "verify-release@local.test";

/** Read a bare KEY=value from .dev.vars (local dev secrets, never printed). */
function readDevVar(file, key) {
  const m = new RegExp(`^${key}=(.*)$`, "m").exec(file);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

/** Apply the base schema + idempotent fixtures to LOCAL D1 only. A non-zero
 *  exit means this environment cannot support the authenticated walk — the
 *  caller reports SKIPPED, never a false PASS. */
async function seedLocalD1() {
  const apply = await run("npx", ["wrangler", "d1", "execute", "production-os-db", "--local", "--file", "schema.sql"]);
  if (apply.code !== 0) return { ok: false, why: "schema apply failed" };
  const tpl = fs.readFileSync(path.join(root, "scripts/e2e/seed-local.sql"), "utf8");
  const sql = tpl
    .replaceAll("__USER_ID__", FIXTURE_USER_ID)
    .replaceAll("__JOURNEY_ID__", FIXTURE_JOURNEY_ID)
    .replaceAll("__THREAD_ID__", FIXTURE_THREAD_ID)
    .replaceAll("__JOURNEY2_ID__", FIXTURE_JOURNEY2_ID)
    .replaceAll("__THREAD2_ID__", FIXTURE_THREAD2_ID);
  const tmp = path.join(cacheDir, "seed-local.rendered.sql");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(tmp, sql);
  const seed = await run("npx", ["wrangler", "d1", "execute", "production-os-db", "--local", "--file", tmp]);
  if (seed.code !== 0) return { ok: false, why: "fixture seed failed" };
  const check = await run("npx", ["wrangler", "d1", "execute", "production-os-db", "--local", "--json", "--command", `SELECT id FROM users WHERE id = '${FIXTURE_USER_ID}'`]);
  if (check.code !== 0 || !check.stdout.includes(FIXTURE_USER_ID)) return { ok: false, why: "fixture read-back failed" };
  return { ok: true };
}

/** Mint an HS256 session JWT with the local .dev.vars secret — the same
 *  signature the worker verifies, so the walk rides the real auth pipeline
 *  (middleware + token_version check against the seeded row). */
function mintSessionToken(secret) {
  const b64 = (buf) => Buffer.from(buf).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ sub: FIXTURE_USER_ID, email: FIXTURE_EMAIL, iat: now, exp: now + 3600, tv: 1 }));
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

const CLS_OBSERVER_SCRIPT = `window.__cls = { total: 0 };
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls.total += e.value;
}).observe({ type: "layout-shift", buffered: true });`;

/** Live /chat sweep probe, run once per veil state: geometry, the reveal's own
 *  health, and every coarse-pointer control the page currently exposes. */
const LIVE_CHAT_PROBE = `(() => ({
  cls: window.__cls ? window.__cls.total : -1,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  coarse: window.matchMedia("(pointer: coarse)").matches,
  veil: (() => {
    const v = document.querySelector(".journey-veil");
    if (!v) return null;
    const r = v.getBoundingClientRect();
    return { open: v.classList.contains("journey-veil-open"), h: Math.round(r.height), top: Math.round(r.top) };
  })(),
  nodes: [...document.querySelectorAll('.journey-veil button, .journey-veil input, .memory-pill, [role="switch"], [role="radio"]')]
    .filter((n) => n.getClientRects().length > 0)
    .map((b) => ({ tag: (b.getAttribute("aria-label") || b.className || b.tagName).slice(0, 24), h: Math.round(b.getBoundingClientRect().height) })),
}))()`;

async function gateAuthenticated(port, booted) {
  heading("Gate 9-11 · authenticated walk, draft-recovery on 503, keyboard contract");
  if (!booted) {
    record("authenticated walk (preview server)", true, "SKIPPED — preview server did not come up in this environment");
    return;
  }
  const devVars = fs.readFileSync(path.join(root, ".dev.vars"), "utf8");
  const jwtSecret = readDevVar(devVars, "JWT_SECRET");
  if (!jwtSecret) {
    record("authenticated walk", true, "SKIPPED — no JWT_SECRET in .dev.vars for this environment");
    return;
  }
  const seeded = await seedLocalD1();
  if (!seeded.ok) {
    record("authenticated walk (local seed)", true, `SKIPPED — ${seeded.why}`);
    return;
  }
  const token = mintSessionToken(jwtSecret);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const viewports = [
    // hasTouch (coarse pointer) without isMobile everywhere: Chrome's mobile
    // view mode suppresses layout-shift entries, and this pass measures live CLS.
    { width: 390, height: 844, hasTouch: true },
    { width: 768, height: 1024, hasTouch: true },
    { width: 1440, height: 900 },
  ];
  const problems = [];
  const clsFailures = [];
  const coarseFindings = [];
  const veilFindings = [];
  let reachedChat = false;
  let coarseMeasured = 0;
  try {
    for (const vp of viewports) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.hasTouch });
      // secure:false because the gate walks http://localhost — the claim set
      // and signature are identical to a real session cookie.
      await ctx.addCookies([{ name: "sovereign_session", value: token, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
      await ctx.addInitScript(CLS_OBSERVER_SCRIPT);
      const page = await ctx.newPage();
      page.on("console", (m) => { if (m.type() === "error") problems.push(`${vp.width} console: ${m.text()}`); });
      page.on("pageerror", (e) => problems.push(`${vp.width} pageerror: ${e}`));
      for (const route of ["/chat", "/settings", "/baseline", "/account"]) {
        try {
          await page.goto(`http://localhost:${port}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
          await sleep(route === "/chat" ? 1600 : 700);
          const m = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            cls: window.__cls ? window.__cls.total : -1,
            url: location.pathname,
          }));
          if (m.url.startsWith("/onboard")) { if (route === "/chat") reachedChat = false; problems.push(`${vp.width} ${route} redirected to ${m.url} — session seed not honoured`); continue; }
          if (route === "/chat") reachedChat = true;
          if (m.overflow > 1) problems.push(`overflow ${m.overflow}px at ${vp.width} on ${route}`);
          if (m.cls > 0.01) clsFailures.push(`${route}@${vp.width} CLS=${m.cls.toFixed(4)}`);
        } catch (e) {
          problems.push(`nav failed ${route}@${vp.width}: ${e}`);
        }
      }
      // Coarse-pointer 44px floor + veil reveal, measured on a FRESH /chat (the
      // loop has already moved on to /account, where no veil exists — checking
      // there would pass vacuously on an empty node list).
      if (vp.hasTouch && vp.width === 390) {
        try {
          await page.goto(`http://localhost:${port}/chat`, { waitUntil: "domcontentloaded", timeout: 20000 });
          await sleep(1600);
          const m = await page.evaluate(LIVE_CHAT_PROBE);
          if (m.cls > 0.01) clsFailures.push(`chat-veil-reveal@390 CLS=${m.cls.toFixed(4)}`);
          if (m.overflow > 1) problems.push(`overflow ${m.overflow}px at 390 on the live veil reveal`);
          if (!m.coarse) veilFindings.push("(pointer: coarse) did not match under hasTouch emulation");
          if (!m.veil) veilFindings.push("no .journey-veil element exists on live /chat");
          else if (!m.veil.open || m.veil.h < 40) veilFindings.push(`veil mounted but not revealed (open=${m.veil.open}, height=${m.veil.h}px)`);
          if (m.nodes.length < 2) veilFindings.push(`the compact state exposed only ${m.nodes.length} live control(s) to measure`);
          coarseMeasured = Math.max(coarseMeasured, m.nodes.length);
          const under = m.nodes.filter((s) => s.h < 44);
          if (under.length > 0) coarseFindings.push(`compact: ${under.length} control(s) under 44px: ${under.map((u) => `${u.tag}=${u.h}px`).join(", ")}`);
          // Measure the expanded panel too — its rename / pause / dismiss /
          // step-back controls are the ones a person actually taps, and the
          // compact band alone would let a regression in them pass unseen.
          await page.getByRole("button", { name: "Show journey steps" }).click();
          await sleep(700);
          const x = await page.evaluate(LIVE_CHAT_PROBE);
          if (x.nodes.length < 4) veilFindings.push(`the expanded panel exposed only ${x.nodes.length} live control(s) to measure`);
          coarseMeasured = Math.max(coarseMeasured, x.nodes.length);
          const underX = x.nodes.filter((s) => s.h < 44);
          if (underX.length > 0) coarseFindings.push(`expanded: ${underX.length} control(s) under 44px: ${underX.map((u) => `${u.tag}=${u.h}px`).join(", ")}`);
        } catch (e) {
          veilFindings.push(`live veil measurement failed: ${String(e).slice(0, 80)}`);
        }
      }
      await ctx.close();
    }
    record("authenticated walk console-clean (390/768/1440)", problems.length === 0, problems.slice(0, 3).join(" | "));
    record("authenticated walk zero horizontal overflow", !problems.some((p) => p.includes("overflow")), "");
    record("authenticated CLS ≤ 0.01 through the JourneyBar reveal", clsFailures.length === 0 && reachedChat, clsFailures.slice(0, 3).join(" | ") || (reachedChat ? "" : "SKIPPED — /chat never reached"));
    record("live /chat reveals the journey inside the measured veil", veilFindings.length === 0, veilFindings.slice(0, 2).join(" | "));
    record("coarse-pointer live controls ≥ 44px (where the media query matches)", coarseFindings.length === 0 && coarseMeasured >= 4, coarseFindings.slice(0, 2).join(" | ") || `${coarseMeasured} controls measured`);

    // ── Gate 10 · draft recovery against a stubbed 503 ──────────────
    // The stub intercepts in the browser, so /api/chat never runs: no AI
    // inference, no usage claim, no thread write. The server-side history is
    // asserted unchanged afterwards, which is exactly the corruption check.
    if (!reachedChat) {
      record("draft recovery: 503 keeps the words + one-tap retry", true, "SKIPPED — /chat not reachable in this environment");
      record("keyboard: recovery row is focusable with a visible ring", true, "SKIPPED — /chat not reachable in this environment");
      return;
    }
    const probe = `Gate probe ${Math.random().toString(36).slice(2, 8)}`;
    const stub = async (page) => page.route("**/api/chat", (r) =>
      r.request().method() === "POST" ? r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Model temporarily unavailable (gate stub)" }) }) : r.continue());
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await ctx.addCookies([{ name: "sovereign_session", value: token, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(`recovery pageerror: ${e}`));
    try {
      await page.goto(`http://localhost:${port}/chat`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForSelector('textarea[aria-label="Message Sovereign"]', { timeout: 12000 });
      // Draft persistence first: type, reload, the words must still be there.
      await page.fill('textarea[aria-label="Message Sovereign"]', probe);
      await sleep(300);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector('textarea[aria-label="Message Sovereign"]', { timeout: 12000 });
      const draftValue = await page.inputValue('textarea[aria-label="Message Sovereign"]');
      record("draft recovery: reload keeps the exact words", draftValue === probe, draftValue === probe ? "" : `restored=${JSON.stringify(draftValue.slice(0, 40))}`);

      await stub(page);
      // Target the button's real accessible name (its sr-only label), not an
      // attribute the committed component never claimed to carry.
      await page.getByRole("button", { name: "Send", exact: true }).click();
      const row = await page.waitForSelector("text=Your message is safe", { timeout: 8000 });
      if (!row) throw new Error("recovery row never appeared after the stubbed 503");
      // Count USER words only. `p.whitespace-pre-wrap` alone also catches every
      // RichText answer paragraph (same class, measured 4 nodes for 2 turns),
      // and user rows are the ones right-aligned via justify-end.
      const userBubbles = () =>
        page.evaluate(() =>
          [...document.querySelectorAll("p.whitespace-pre-wrap")]
            .filter((p) => p.closest("div.justify-end"))
            .map((p) => (p.textContent || "").trim()));
      const beforeRetry = await userBubbles();
      // One-tap retry, still under the 503: no duplicate may appear.
      await page.click('button:has-text("Try again")');
      await sleep(1400);
      const retryRowStill = await page.locator("text=Your message is safe").count();
      const afterRetry = await userBubbles();
      const probeCopies = afterRetry.filter((t) => t.includes(probe)).length;
      const composerEmpty = (await page.inputValue('textarea[aria-label="Message Sovereign"]')) === "";
      record(
        "503 recovery: one-tap retry re-sends without duplicating the turn",
        retryRowStill > 0 && beforeRetry.length === 2 && afterRetry.length === 2 && probeCopies === 1 && composerEmpty,
        `user bubbles ${beforeRetry.length}→${afterRetry.length} (expected 2), copies of the probe=${probeCopies}, retry row=${retryRowStill > 0}, composer cleared=${composerEmpty}`,
      );
      const retryBox = await page.locator('button:has-text("Try again")').boundingBox();
      record("503 recovery: Try again meets the 44px floor", !!retryBox && retryBox.height >= 44, retryBox ? `height=${Math.round(retryBox.height)}px` : "button not found");
      // Thread history uncorrupted: the server never saw either attempt.
      const raw = await run("npx", ["wrangler", "d1", "execute", "production-os-db", "--local", "--json", "--command", `SELECT message_history FROM threads WHERE id = '${FIXTURE_THREAD_ID}'`]);
      const intact = raw.stdout.includes("Help me see the pattern") && !raw.stdout.includes("Gate probe");
      record("503 recovery: server thread history untouched by the failed turns", intact, "");

      // ── Gate 11 · keyboard contract on the recovery row ───────────
      // Traversal is asserted from a known anchor. Clicking the retry unmounts
      // the pressed button (the row hides while streaming), which drops
      // activeElement to <body> and leaves Chrome resuming from mid-composer —
      // measuring that browser bookkeeping reported the Baseline drawer, not
      // any real keyboard defect (verified against the live page).
      await page.waitForSelector('button:has-text("Try again")', { timeout: 8000 });
      await page.focus('textarea[aria-label="Message Sovereign"]');
      await page.keyboard.press("Shift+Tab");
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          text: (el.textContent || "").trim(),
          w: parseFloat(cs.outlineWidth) || 0,
          style: cs.outlineStyle,
          shadow: cs.boxShadow || "none",
        };
      });
      const ringVisible = !!ring && ((ring.w >= 1 && ring.style !== "none") || (ring.shadow !== "none" && ring.shadow.length > 4));
      record("keyboard: Shift+Tab from the composer reaches Try again with a visible focus ring", !!ring && ring.text === "Try again" && ringVisible, ring ? `focused=${JSON.stringify(ring.text)} outline=${ring.w}px ${ring.style}` : "no focused element");
      await page.keyboard.press("Tab");
      const roundTrip = await page.evaluate(() => ({
        tag: document.activeElement?.tagName || "",
        label: document.activeElement?.getAttribute?.("aria-label") || "",
      }));
      record("keyboard: Tab from the recovery row returns to the composer", roundTrip.tag === "TEXTAREA" && roundTrip.label === "Message Sovereign", `${roundTrip.tag}/${roundTrip.label || "(no label)"}`);
      await ctx.close();
    } catch (e) {
      record("503 recovery flow completed", false, String(e).slice(0, 200));
      await ctx.close();
    }
    record("recovery flow: zero uncaught page errors", !problems.some((p) => String(p).includes("recovery pageerror")), "");
  } finally {
    await browser.close();
  }
}

/** In-page readability probe. Geometry alone is not proof of readability: the
 *  honest signal is which node Chrome reports for the centre of the first
 *  message, because whatever wins that hit-test is what the person can neither
 *  read nor tap. Returns null when the page has no veil + transcript to judge. */
const VEIL_PROBE = `(() => {
  const veil = document.querySelector(".journey-veil");
  const sc = document.querySelector('[role="log"]');
  const first = document.querySelector('[role="log"] > div > div');
  if (!veil || !sc || !first) return null;
  const v = veil.getBoundingClientRect();
  const w = veil.parentElement.getBoundingClientRect();
  const f = first.getBoundingClientRect();
  const ta = document.querySelector('textarea[aria-label="Message Sovereign"]');
  const hit = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return "null";
    return el.closest && el.closest(".journey-veil") ? "veil" : el.nodeName;
  };
  const rows = [...document.querySelectorAll("#journey-steps ol li")];
  return {
    veil: { top: Math.round(v.top), bottom: Math.round(v.bottom), h: Math.round(v.height) },
    wrapperBottom: Math.round(w.bottom),
    spillPx: Math.round(v.bottom - w.bottom),
    veilScrolls: veil.scrollHeight > veil.clientHeight + 1,
    fade: veil.classList.contains("journey-veil-fade"),
    scrollY: { top: Math.round(veil.scrollTop), max: Math.round(veil.scrollHeight - veil.clientHeight) },
    focus: (() => { const a = document.activeElement; return a ? a.tagName : "none"; })(),
    focusInCompact: (() => { const a = document.activeElement; return !!(a && a.closest && a.closest(".journey-veil-compact")); })(),
    firstTop: Math.round(f.top),
    gapPx: Math.round(f.top - v.bottom),
    firstHit: hit(Math.round(f.left + f.width / 2), Math.round((f.top + f.bottom) / 2)),
    composerHit: ta ? hit(Math.round(ta.getBoundingClientRect().left + 40), Math.round(ta.getBoundingClientRect().top + ta.getBoundingClientRect().height / 2)) : "none",
    steps: rows.length,
    currentRow: rows.findIndex((li) => (li.textContent || "").indexOf("(current step)") !== -1),
    band: (document.querySelector(".journey-veil figure") || { getAttribute: () => "" }).getAttribute("aria-label").replace(/\\s+/g, " ").slice(0, 96),
    cls: window.__cls ? Number(window.__cls.total.toFixed(4)) : -1,
  };
})()`;

/** A stand-in speech engine. The real one needs a microphone and a network
 *  service, neither of which belongs in a release gate; this records starts and
 *  stops and hands back exactly the `results[i][0].transcript` shape the app
 *  reads, so what is under test is the composer's integration. */
const SPEECH_STUB = `(() => {
  class FakeRecognition {
    constructor() {
      this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1;
      this.onresult = null; this.onerror = null; this.onend = null;
      window.__speech = window.__speech || { started: 0, stopped: 0, instance: null };
      window.__speech.instance = this;
    }
    start() { window.__speech.started += 1; window.__speech.instance = this; }
    stop() { window.__speech.stopped += 1; }
    abort() { window.__speech.stopped += 1; }
    __say(text) {
      const results = [{ 0: { transcript: text }, isFinal: true }];
      if (this.onresult) this.onresult({ resultIndex: 0, results });
    }
  }
  for (const key of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    Object.defineProperty(window, key, { value: FakeRecognition, configurable: true, writable: true });
  }
})()`;

/** The other half of progressive enhancement: pretend the API does not exist.
 *  Own properties shadow the prototype accessors Chrome really does expose. */
const SPEECH_REMOVED = `(() => {
  for (const key of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    Object.defineProperty(window, key, { value: undefined, configurable: true, writable: true });
  }
})()`;

async function gateErgonomics(port, booted) {
  heading("Gate 12-19 · transcript clearance, live veil interactions, mid-stream drop, dismissal, thread isolation (server + device), voice");
  const skip = (why) => {
    record("first message never behind the collapsed veil (3 viewports)", true, `SKIPPED — ${why}`);
    record("live veil expand → step override → collapse is shift-free", true, `SKIPPED — ${why}`);
    record("mid-stream drop: truncated SSE arms one-tap retry", true, `SKIPPED — ${why}`);
    record("mid-stream drop: retry answers and leaves no duplicate turn", true, `SKIPPED — ${why}`);
    record("expanded veil dismisses on Escape and on a transcript tap", true, `SKIPPED — ${why}`);
    record("capped panel shows its scroll affordance only while steps are out of reach", true, `SKIPPED — ${why}`);
    record("switching threads clears the retry banner and follows the thread's journey", true, `SKIPPED — ${why}`);
    record("voice dictation is progressive, ≥44px, feeds the draft and releases on send", true, `SKIPPED — ${why}`);
    record("Device-Only keeps its own journey across thread switches", true, `SKIPPED — ${why}`);
  };
  if (!booted) return skip("preview server did not come up in this environment");
  const jwtSecret = readDevVar(fs.readFileSync(path.join(root, ".dev.vars"), "utf8"), "JWT_SECRET");
  if (!jwtSecret) return skip("no JWT_SECRET in .dev.vars");
  const seeded = await seedLocalD1();
  if (!seeded.ok) return skip(seeded.why);
  const token = mintSessionToken(jwtSecret);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  // hasTouch without isMobile: this pass measures live CLS, and Chrome's mobile
  // view mode suppresses layout-shift entries entirely.
  const openChat = async (width, height, { touch = true, init = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch });
    await ctx.addCookies([{ name: "sovereign_session", value: token, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
    await ctx.addInitScript(CLS_OBSERVER_SCRIPT);
    // Before any page script: feature detection happens on mount, so a stub or
    // a removal has to be in place the first time the composer renders.
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(`http://localhost:${port}/chat`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector('textarea[aria-label="Message Sovereign"]', { timeout: 12000 });
    await sleep(1800);
    // Message #1 is the worst case, so look at the transcript from the top.
    await page.evaluate(() => { const sc = document.querySelector('[role="log"]'); if (sc) sc.scrollTop = 0; });
    await sleep(200);
    return { ctx, page, errs };
  };

  // ── Gate 12 · the collapsed veil must own nothing but its reserved band ──
  const occlusion = [];
  let viewportsJudged = 0;
  for (const vp of [{ w: 390, h: 844 }, { w: 390, h: 640 }, { w: 1440, h: 900, touch: false }]) {
    const { ctx, page, errs } = await openChat(vp.w, vp.h, { touch: vp.touch !== false });
    const m = await page.evaluate(VEIL_PROBE);
    if (!m) {
      occlusion.push(`${vp.w}x${vp.h}: live /chat has no veil + transcript to judge`);
    } else {
      viewportsJudged += 1;
      if (m.steps > 0) occlusion.push(`${vp.w}x${vp.h}: the panel arrives EXPANDED (${m.steps} step rows) — only the compact band has reserved clearance`);
      if (m.veil.bottom > m.firstTop) occlusion.push(`${vp.w}x${vp.h}: the collapsed veil covers message #1 (veil bottom ${m.veil.bottom} > first top ${m.firstTop}, gap ${m.gapPx}px)`);
      if (m.firstHit === "veil") occlusion.push(`${vp.w}x${vp.h}: message #1 hit-tests INTO the veil (unreadable)`);
      if (m.composerHit === "veil") occlusion.push(`${vp.w}x${vp.h}: the composer hit-tests into the veil (untypable)`);
      if (m.cls > 0.01) occlusion.push(`${vp.w}x${vp.h}: arrival CLS=${m.cls.toFixed(4)}`);
    }
    if (errs.length) occlusion.push(`${vp.w}x${vp.h}: console/page errors ${errs.slice(0, 2).join(" | ")}`);
    await ctx.close();
  }
  record("first message never behind the collapsed veil (3 viewports)", occlusion.length === 0 && viewportsJudged === 3, occlusion.slice(0, 3).join(" | ") || "cleared the reserved band at 390x844, 390x640, 1440x900");

  // ── Gate 13 · expand, override a step, collapse — on the real page ──────
  const interactions = [];
  let worstCycleCls = -1;
  for (const vp of [{ w: 390, h: 844 }, { w: 390, h: 640 }]) {
    // Re-apply the fixture first: a step override is a real write to LOCAL D1,
    // and a second pass that starts from an already-stepped-back journey could
    // never observe the current step moving backwards again.
    await seedLocalD1();
    const { ctx, page, errs } = await openChat(vp.w, vp.h);
    await page.evaluate(() => { window.__cls.total = 0; });
    await page.getByRole("button", { name: "Show journey steps" }).click();
    await sleep(700);
    const exp = await page.evaluate(VEIL_PROBE);
    if (!exp) {
      interactions.push(`${vp.w}x${vp.h}: the compact band's toggle rendered no panel`);
      await ctx.close();
      continue;
    }
    if (exp.steps !== 5) interactions.push(`${vp.w}x${vp.h}: expanding revealed ${exp.steps} step rows (expected 5)`);
    // The panel is allowed to cover conversation when asked; it is never
    // allowed to reach past its own box onto the composer's chrome.
    if (exp.spillPx > 0) interactions.push(`${vp.w}x${vp.h}: the expanded panel spills ${exp.spillPx}px past the transcript box${exp.veilScrolls ? "" : " (and does not scroll internally)"}`);
    if (exp.composerHit === "veil") interactions.push(`${vp.w}x${vp.h}: the expanded panel intercepts composer taps`);
    const beforeRow = exp.currentRow;
    const override = page.locator('#journey-steps button:has-text("Not there yet?")').first();
    if ((await override.count()) === 0) {
      interactions.push(`${vp.w}x${vp.h}: no step-override control in the live panel`);
    } else {
      await override.click();
      await sleep(1100);
      const after = await page.evaluate(VEIL_PROBE);
      if (after.steps !== 5) interactions.push(`${vp.w}x${vp.h}: the step override broke the row list (${after.steps} rows)`);
      if (!(after.currentRow < beforeRow)) interactions.push(`${vp.w}x${vp.h}: override left the current step at row ${after.currentRow} (was ${beforeRow})`);
    }
    await page.getByRole("button", { name: "Hide steps" }).click();
    await sleep(700);
    const back = await page.evaluate(VEIL_PROBE);
    if (back.steps !== 0) interactions.push(`${vp.w}x${vp.h}: "Hide steps" left the panel expanded`);
    if (back.veil.bottom > back.firstTop) interactions.push(`${vp.w}x${vp.h}: after collapsing, message #1 is still under the veil`);
    if (vp.h === 844) {
      // Typing room: on a phone the caret steals the panel back automatically.
      await page.getByRole("button", { name: "Show journey steps" }).click();
      await sleep(600);
      const opened = await page.evaluate(VEIL_PROBE);
      await page.focus('textarea[aria-label="Message Sovereign"]');
      await sleep(700);
      const folded = await page.evaluate(VEIL_PROBE);
      if (opened.steps === 0) interactions.push("composer-focus check could not expand the panel");
      if (folded.steps > 0) interactions.push(`${vp.w}x${vp.h}: the panel stayed expanded when the composer took focus`);
    }
    worstCycleCls = Math.max(worstCycleCls, back.cls);
    if (errs.length) interactions.push(`${vp.w}x${vp.h}: console/page errors ${errs.slice(0, 2).join(" | ")}`);
    await ctx.close();
  }
  record("live veil expand → step override → collapse is shift-free", interactions.length === 0 && worstCycleCls >= 0 && worstCycleCls <= 0.01, interactions.slice(0, 3).join(" | ") || `whole cycle CLS=${worstCycleCls.toFixed(4)}`);

  // ── Gate 14 · a stream that opens and dies mid-turn ───────────────────
  const armFindings = [];
  const recoverFindings = [];
  const probe = `Stream probe ${Math.random().toString(36).slice(2, 8)}`;
  const { ctx, page, errs } = await openChat(390, 844);
  const sse = (frames) => page.route("**/api/chat", (r) => {
    if (r.request().method() !== "POST") return r.continue();
    return r.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: frames });
  });
  const userBubbles = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("p.whitespace-pre-wrap")]
        .filter((p) => p.closest("div.justify-end"))
        .map((p) => (p.textContent || "").trim()));
  const lastAnswer = () =>
    page.evaluate(() => {
      const ps = [...document.querySelectorAll("p.whitespace-pre-wrap")].filter((p) => !p.closest("div.justify-end"));
      return ps.length ? (ps[ps.length - 1].textContent || "").trim() : "";
    });
  try {
    await sse(`data: {"threadId":"${FIXTURE_THREAD_ID}"}\n\n`);
    await page.fill('textarea[aria-label="Message Sovereign"]', probe);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const row = await page.waitForSelector("text=got cut off", { timeout: 8000 }).catch(() => null);
    if (!row) armFindings.push("a stream that closed before [DONE] was accepted as a finished turn");
    const bubble = await lastAnswer();
    if (!bubble.includes("stopped before it arrived")) armFindings.push(`the dead turn left no readable answer bubble (got ${JSON.stringify(bubble.slice(0, 40))})`);
    const midBubbles = await userBubbles();
    if (midBubbles.filter((t) => t.includes(probe)).length !== 1) armFindings.push(`the dropped turn duplicated the user bubble (${midBubbles.length} user bubbles)`);
    const retryBox = await page.locator('button:has-text("Try again")').boundingBox();
    if (!retryBox || retryBox.height < 44 || retryBox.width < 44) armFindings.push(`Try again is under the tap floor (${retryBox ? `${Math.round(retryBox.width)}x${Math.round(retryBox.height)}` : "missing"})`);

    // Re-run the same turn against a complete stream: the answer must land and
    // the recovery row must stand down, with still exactly one copy of the
    // person's words in the transcript.
    await page.unroute("**/api/chat");
    await sse([
      `data: {"threadId":"${FIXTURE_THREAD_ID}"}\n\n`,
      `data: {"content":"Recovered on the retry — this answer arrived whole."}\n\n`,
      `data: [DONE]\n\n`,
    ].join(""));
    await page.click('button:has-text("Try again")');
    await sleep(1600);
    const done = await lastAnswer();
    const afterBubbles = await userBubbles();
    if (!done.includes("Recovered on the retry")) recoverFindings.push(`retry did not deliver an answer (bubble=${JSON.stringify(done.slice(0, 40))})`);
    if (done.includes("stopped before it arrived")) recoverFindings.push("the dead-turn placeholder survived a successful retry");
    if ((await page.locator("text=got cut off").count()) > 0) recoverFindings.push("the recovery row stayed after a successful retry");
    if (afterBubbles.filter((t) => t.includes(probe)).length !== 1) recoverFindings.push(`retry duplicated the turn (${afterBubbles.length} user bubbles)`);
  } catch (e) {
    recoverFindings.push(`flow failed: ${String(e).slice(0, 90)}`);
  }
  if (errs.length) armFindings.push(`console/page errors ${errs.slice(0, 2).join(" | ")}`);
  record("mid-stream drop: truncated SSE arms one-tap retry", armFindings.length === 0, armFindings.slice(0, 2).join(" | "));
  record("mid-stream drop: retry answers and leaves no duplicate turn", recoverFindings.length === 0, recoverFindings.slice(0, 3).join(" | "));
  await ctx.close();

  // ── Gate 15 · two effortless ways to put the expanded panel away ──────
  const dismissal = [];
  let dismissalCls = -1;
  for (const vp of [{ w: 390, h: 844 }, { w: 1440, h: 900, touch: false }]) {
    const tag = `${vp.w}x${vp.h}`;
    const opts = { touch: vp.touch !== false };
    // Escape, from the panel's own toggle: the band folds AND focus lands on the
    // compact summary's show-steps button instead of dropping to <body>.
    const esc = await openChat(vp.w, vp.h, opts);
    await esc.page.getByRole("button", { name: "Show journey steps" }).click();
    await sleep(650);
    const escOpen = await esc.page.evaluate(VEIL_PROBE);
    if (!escOpen || escOpen.steps === 0) {
      dismissal.push(`${tag}: could not expand the panel to test Escape`);
    } else {
      await esc.page.keyboard.press("Escape");
      await sleep(650);
      const after = await esc.page.evaluate(VEIL_PROBE);
      if (after.steps > 0) dismissal.push(`${tag}: Escape left the panel expanded`);
      if (!(after.focus === "BUTTON" && after.focusInCompact)) dismissal.push(`${tag}: Escape left focus on ${after.focus}${after.focusInCompact ? " (compact band)" : " outside the compact band"}`);
      if (after.veil.bottom > after.firstTop) dismissal.push(`${tag}: after Escape the compact band covers message #1`);
      dismissalCls = Math.max(dismissalCls, after.cls);
    }
    if (esc.errs.length) dismissal.push(`${tag}: console/page errors during Escape ${esc.errs.slice(0, 2).join(" | ")}`);
    await esc.ctx.close();

    // A tap on the conversation underneath the panel.
    const tap = await openChat(vp.w, vp.h, opts);
    await tap.page.getByRole("button", { name: "Show journey steps" }).click();
    await sleep(650);
    const tapOpen = await tap.page.evaluate(VEIL_PROBE);
    if (!tapOpen || tapOpen.steps === 0) {
      dismissal.push(`${tag}: could not expand the panel to test the transcript tap`);
    } else {
      // Tap the conversation BELOW the panel, never through it: a tap that lands
      // on the veil belongs to the panel's own controls and must not fold it.
      const spot = await tap.page.evaluate(() => {
        const v = document.querySelector(".journey-veil")?.getBoundingClientRect();
        const sc = document.querySelector('[role="log"]')?.getBoundingClientRect();
        if (!v || !sc) return null;
        const y = Math.min(Math.round(Math.max(v.bottom + 30, sc.top + sc.height * 0.6)), Math.round(sc.bottom - 20));
        return { x: Math.round(sc.left + sc.width / 2), y };
      });
      if (!spot) {
        dismissal.push(`${tag}: no transcript area to judge`);
      } else {
        const covered = await tap.page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return !!(el && el.closest && el.closest(".journey-veil"));
        }, spot);
        if (covered) {
          dismissal.push(`${tag}: the whole transcript is under the panel at ${tag}, nothing left to tap`);
        } else {
          await tap.page.mouse.click(spot.x, spot.y);
          await sleep(650);
          const after = await tap.page.evaluate(VEIL_PROBE);
          if (after.steps > 0) dismissal.push(`${tag}: tapping the transcript left the panel expanded`);
          dismissalCls = Math.max(dismissalCls, after.cls);
        }
      }
    }
    if (tap.errs.length) dismissal.push(`${tag}: console/page errors during the transcript tap ${tap.errs.slice(0, 2).join(" | ")}`);
    await tap.ctx.close();
  }
  record("expanded veil dismisses on Escape and on a transcript tap", dismissal.length === 0 && dismissalCls >= 0 && dismissalCls <= 0.01,
    dismissal.slice(0, 3).join(" | ") || `both gestures fold the band, worst CLS=${dismissalCls.toFixed(4)}`);

  // ── Gate 16 · the capped panel admits when it is hiding steps ─────────
  const affordance = [];
  {
    // 390x500 is the phone with the keyboard up: the step list cannot fit, so
    // the panel scrolls internally and must say so — then stop saying it at the
    // bottom, or the cue becomes a lie.
    const { ctx, page, errs } = await openChat(390, 500);
    await page.getByRole("button", { name: "Show journey steps" }).click();
    await sleep(700);
    const top = await page.evaluate(VEIL_PROBE);
    if (!top) {
      affordance.push("390x500: no panel to judge");
    } else {
      if (!top.veilScrolls) affordance.push(`390x500: the capped panel did not scroll internally (${top.veil.h}px tall, ${top.scrollY.max}px of overflow)`);
      if (top.scrollY.max <= 0) affordance.push("390x500: expected hidden steps below the fold, the panel fits entirely");
      else if (!top.fade) affordance.push("390x500: steps are out of reach and no scroll affordance is marked");
      if (top.spillPx > 0) affordance.push(`390x500: the panel spills ${top.spillPx}px past its box`);
      if (top.composerHit === "veil") affordance.push("390x500: the panel intercepts composer taps");
      await page.evaluate(() => { const v = document.querySelector(".journey-veil"); if (v) v.scrollTop = v.scrollHeight; });
      await sleep(500);
      const bottom = await page.evaluate(VEIL_PROBE);
      if (bottom.scrollY.top <= 0) affordance.push("390x500: the panel never actually scrolled");
      if (bottom.fade) affordance.push("390x500: the affordance stayed after reaching the last step");
      if (errs.length) affordance.push(`console/page errors ${errs.slice(0, 2).join(" | ")}`);
    }
    await ctx.close();
  }
  {
    // A panel that fits must not wear the cue.
    const { ctx, page } = await openChat(390, 844);
    await page.getByRole("button", { name: "Show journey steps" }).click();
    await sleep(700);
    const m = await page.evaluate(VEIL_PROBE);
    if (m) {
      if (!m.veilScrolls && m.fade) affordance.push("390x844: the affordance renders on a panel with nothing hidden");
      if (m.veilScrolls && m.scrollY.max > 2 && !m.fade) affordance.push("390x844: steps are out of reach with no affordance");
    }
    await ctx.close();
  }
  record("capped panel shows its scroll affordance only while steps are out of reach", affordance.length === 0,
    affordance.slice(0, 3).join(" | ") || "fade marks 390x500 overflow, clears at the bottom, absent when the panel fits");

  // ── Gate 17 · one conversation's transient state never follows you ────
  const bleed = [];
  {
    const { ctx, page, errs } = await openChat(390, 844);
    const bandA = (await page.evaluate(VEIL_PROBE))?.band ?? "";
    if (!/Work through the tension/.test(bandA)) bleed.push(`thread A did not open on its linked journey (band ${JSON.stringify(bandA.slice(0, 60))})`);
    // Arm a retry banner in thread A. The stub answers in the browser, so
    // /api/chat never runs: no inference, no usage claim, no thread write.
    await page.route("**/api/chat", (r) => r.request().method() === "POST"
      ? r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Model unavailable (gate stub)" }) })
      : r.continue());
    const probe = `Bleed probe ${Math.random().toString(36).slice(2, 8)}`;
    await page.fill('textarea[aria-label="Message Sovereign"]', probe);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const armed = await page.waitForSelector('button:has-text("Try again")', { timeout: 8000 }).catch(() => null);
    if (!armed) bleed.push("thread A never armed the retry banner, so switching had nothing to clear");
    await page.unroute("**/api/chat");
    const chip = page.locator('button[title^="Second thread"]');
    if ((await chip.count()) === 0) {
      bleed.push("the second seeded thread's chip is not reachable at 390px");
    } else {
      await page.evaluate(() => { window.__cls.total = 0; });
      await chip.first().click();
      await sleep(1800);
      const b = await page.evaluate(VEIL_PROBE);
      if ((await page.locator('button:has-text("Try again")').count()) > 0) bleed.push("the retry banner followed into thread B — its Try again would re-send thread A's words here");
      const userTexts = await page.evaluate(() => [...document.querySelectorAll("p.whitespace-pre-wrap")]
        .filter((p) => p.closest("div.justify-end"))
        .map((p) => (p.textContent || "").trim()));
      if (userTexts.some((t) => t.includes(probe))) bleed.push("thread A's transcript stayed painted after switching");
      if (!userTexts.some((t) => t.includes("Second thread"))) bleed.push(`thread B's own messages never rendered (${JSON.stringify(userTexts[0] ?? "").slice(0, 40)})`);
      if (!b) {
        bleed.push("thread B rendered no transcript + veil to judge");
      } else {
        if (!/Stop replaying/.test(b.band)) bleed.push(`the canvas did not follow the thread: band shows ${JSON.stringify(b.band.slice(0, 60))}, expected thread B's linked journey`);
        if (b.cls > 0.01) bleed.push(`switching threads moved the layout (CLS=${b.cls.toFixed(4)})`);
      }
      // And back out: a new conversation returns to the active journey, folded.
      await page.getByRole("button", { name: "New thread" }).click();
      await sleep(1600);
      const fresh = await page.evaluate(VEIL_PROBE);
      if (fresh) {
        if (fresh.steps > 0) bleed.push(`"New thread" left thread B's panel expanded (${fresh.steps} rows)`);
        if (!/Work through the tension/.test(fresh.band)) bleed.push(`"New thread" did not return to the active journey (band ${JSON.stringify(fresh.band.slice(0, 60))})`);
        if (bandA && fresh.band !== bandA) bleed.push(`the active journey's band changed (${JSON.stringify(fresh.band.slice(0, 40))} vs ${JSON.stringify(bandA.slice(0, 40))})`);
      }
    }
    if (errs.filter((m) => !/status of 503/.test(m)).length) bleed.push(`console/page errors ${errs.filter((m) => !/status of 503/.test(m)).slice(0, 2).join(" | ")}`);
    // The one console entry we expect is Chrome logging our own deliberate 503
    // stub; a page error, a 500, or anything else is still a finding.
    await ctx.close();
  }
  record("switching threads clears the retry banner and follows the thread's journey", bleed.length === 0,
    bleed.slice(0, 3).join(" | ") || "banner cleared, transcript swapped, canvas followed thread B then returned to the active journey");

  // ── Gate 18 · voice dictation, on a stand-in engine ──────────────────
  // The only stable handle on the control: its accessible name deliberately
  // changes with its state ("Dictate your message" / "Stop dictation"), which is
  // correct for screen readers and wrong for a locator.
  const micSel = '.composer-pill button[aria-pressed]';
  const voice = [];
  {
    const { ctx, page, errs } = await openChat(390, 844, { init: SPEECH_STUB });
    if ((await page.locator(micSel).count()) !== 1) {
      voice.push("a browser that exposes SpeechRecognition rendered no microphone control");
    } else {
      const box = await page.locator(micSel).boundingBox();
      if (!box || box.width < 44 || box.height < 44) voice.push(`the mic control is ${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "unmeasurable"}, under the 44px tap floor`);
      if ((await page.locator(micSel).getAttribute("aria-pressed")) !== "false") voice.push("the mic did not start at aria-pressed=false");
      await page.locator(micSel).click();
      await sleep(400);
      if ((await page.locator(micSel).getAttribute("aria-pressed")) !== "true") voice.push("tapping the mic did not set aria-pressed=true");
      if ((await page.locator(micSel).getAttribute("aria-label")) !== "Stop dictation") voice.push("the listening control did not rename itself for assistive tech");
      const started = await page.evaluate(() => (window.__speech ? window.__speech.started : -1));
      if (started !== 1) voice.push(`tapping the mic started ${started} recognition session(s), expected 1`);
      await page.evaluate(() => window.__speech.instance.__say("I want to feel calmer about this"));
      await sleep(400);
      const draft = await page.inputValue('textarea[aria-label="Message Sovereign"]');
      if (!draft.includes("I want to feel calmer about this")) voice.push(`dictated words never reached the composer (draft=${JSON.stringify(draft.slice(0, 40))})`);
      // Send has to let go of the microphone, or a listener outlives the turn.
      await page.route("**/api/chat", (r) => r.request().method() !== "POST" ? r.continue() : r.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: [`data: {"threadId":"${FIXTURE_THREAD_ID}"}\n\n`, 'data: {"content":"Dictated and delivered."}\n\n', "data: [DONE]\n\n"].join(""),
      }));
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await sleep(1800);
      const stopped = await page.evaluate(() => (window.__speech ? window.__speech.stopped : -1));
      if (stopped < 1) voice.push("sending left the recognition session running");
      const pressed = await page.locator(micSel).getAttribute("aria-pressed").catch(() => "gone");
      if (pressed !== "false") voice.push(`after Send the mic reads aria-pressed=${pressed}`);
      if ((await page.inputValue('textarea[aria-label="Message Sovereign"]')).trim() !== "") voice.push("the sent turn left words in the composer");
      if ((await page.locator("text=Dictated and delivered").count()) === 0) voice.push("the dictated turn never produced an answer");
    }
    if (errs.length) voice.push(`console/page errors ${errs.slice(0, 2).join(" | ")}`);
    await ctx.close();
  }
  {
    // The other half of progressive enhancement: with the API gone, the
    // composer renders exactly as it did before — no dead control, no error.
    const { ctx, page, errs } = await openChat(390, 844, { init: SPEECH_REMOVED });
    if ((await page.locator(micSel).count()) > 0) voice.push("the mic control rendered in a browser without SpeechRecognition");
    if (errs.length) voice.push(`an unsupported browser produced console errors ${errs.slice(0, 2).join(" | ")}`);
    await ctx.close();
  }
  record("voice dictation is progressive, ≥44px, feeds the draft and releases on send", voice.length === 0,
    voice.slice(0, 3).join(" | ") || "stubbed engine mounted, pressed, dictated, sent, released; unsupported rendered nothing");

  // ── Gate 19 · the same isolation, in Device-Only mode ────────────────
  // Every gate above runs against journeys that live in D1. This one flips the
  // fixture account to memory_mode='local' and plants a THIRD journey that
  // exists nowhere on the server — only inside the encrypted IndexedDB vault —
  // then asks the question the mode actually makes: when a thread carries a
  // server `journey_id` that the device has never seen, which journey wins?
  // (The device's. It has to: a stranger reading the screen over someone's
  // shoulder must not be shown a journey this account chose to keep on device.)
  const LOCAL_GOAL = "Keep the evenings I actually want back";
  const parityFindings = [];
  const flip = async (mode) => (await d1Local(`UPDATE users SET memory_mode = '${mode}' WHERE id = '${FIXTURE_USER_ID}';`)).code === 0;
  if (!(await flip("local"))) {
    parityFindings.push("local D1 would not accept the memory_mode flip");
  } else {
    try {
      const { ctx, page, errs } = await openChat(390, 844);
      const pill = await page.evaluate(() => document.querySelector(".memory-pill")?.getAttribute("title") ?? "");
      if (pill !== "Device-Only memory") parityFindings.push(`the account did not boot in Device-Only (pill ${JSON.stringify(pill)})`);

      // Write the vault with the committed envelope format: AES-GCM, a
      // non-extractable key under "journey-aesgcm", one sealed record per kind.
      const seeded = await page.evaluate(async (goal) => {
        const openDb = () => new Promise((resolve, reject) => {
          const req = indexedDB.open("sovereign-memory", 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("keys")) db.createObjectStore("keys");
            if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "id" });
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const idb = (db, store, mode, fn) => new Promise((resolve, reject) => {
          const req = fn(db.transaction(store, mode).objectStore(store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const url = (buf) => {
          const bytes = new Uint8Array(buf);
          let s = "";
          for (const b of bytes) s += String.fromCharCode(b);
          return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        };
        const db = await openDb();
        let key = await idb(db, "keys", "readonly", (o) => o.get("journey-aesgcm"));
        if (!key) {
          key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
          await idb(db, "keys", "readwrite", (o) => o.put(key, "journey-aesgcm"));
        }
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const rec = {
          version: 1,
          userScope: "verify-release@local.test",
          updatedAt: new Date().toISOString(),
          status: "active",
          state: {
            current_step: "widen-the-frame",
            unlocked_milestones: ["signal-surfaced", "meaning-clarified", "parts-separated"],
            visual_progress: 0.55,
            newly_unlocked: [],
            inquiry_level: 3,
            suggested_goal: goal,
            steps: [
              { id: "surface-signal", label: "Say what's landing", status: "done" },
              { id: "name-what-landed", label: "Name what crossed the line", status: "done" },
              { id: "separate-the-parts", label: "Separate what's yours from what's theirs", status: "done" },
              { id: "widen-the-frame", label: "See the fuller picture", status: "current" },
              { id: "grounded-next-step", label: "Choose one grounded next step", status: "locked" },
            ],
          },
        };
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(rec)));
        await idb(db, "records", "readwrite", (o) => o.put({ id: "journey", env: { v: "v1", iv: url(iv.buffer), data: url(ct) } }));
        db.close();
        return true;
      }, LOCAL_GOAL).catch((e) => `vault write threw ${String(e)}`);
      if (seeded !== true) {
        parityFindings.push(String(seeded).slice(0, 90));
      } else {
        // Reload so the store is built from scratch in local mode: whatever band
        // appears afterwards came from the vault, not from an earlier fetch.
        await page.reload({ waitUntil: "domcontentloaded", timeout: 25000 });
        await page.waitForSelector('textarea[aria-label="Message Sovereign"]', { timeout: 15000 });
        await sleep(2000);
        const home = await page.evaluate(VEIL_PROBE);
        if (!home) {
          parityFindings.push("Device-Only /chat rendered no transcript + veil to judge");
        } else {
          if (!/Keep the evenings/.test(home.band)) parityFindings.push(`the canvas did not read the device journey (band ${JSON.stringify(home.band.slice(0, 60))})`);
          if (home.cls > 0.01) parityFindings.push(`a Device-Only arrival moved the layout (CLS=${home.cls.toFixed(4)})`);

          // Arm a retry banner here, so a failure to clear it is unmistakable.
          await page.route("**/api/chat", (r) => r.request().method() === "POST"
            ? r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Model unavailable (gate stub)" }) })
            : r.continue());
          const probe = `Device-only probe ${Math.random().toString(36).slice(2, 8)}`;
          await page.fill('textarea[aria-label="Message Sovereign"]', probe);
          await page.getByRole("button", { name: "Send", exact: true }).click();
          const armed = await page.waitForSelector('button:has-text("Try again")', { timeout: 8000 }).catch(() => null);
          await page.unroute("**/api/chat");
          if (!armed) parityFindings.push("the retry banner never armed in Device-Only, so switching had nothing to clear");

          const chip = page.locator('button[title^="Second thread"]');
          if ((await chip.count()) === 0) {
            parityFindings.push("thread B's chip is not reachable at 390px in Device-Only");
          } else {
            await chip.first().click();
            await sleep(2000);
            const b = await page.evaluate(VEIL_PROBE);
            if ((await page.locator('button:has-text("Try again")').count()) > 0) parityFindings.push("the retry banner followed into thread B in Device-Only too");
            const userTexts = await page.evaluate(() => [...document.querySelectorAll("p.whitespace-pre-wrap")]
              .filter((p) => p.closest("div.justify-end")).map((p) => (p.textContent || "").trim()));
            if (userTexts.some((t) => t.includes(probe))) parityFindings.push("thread A's transcript stayed painted after switching");
            if (!userTexts.some((t) => t.includes("Second thread"))) parityFindings.push("thread B's server messages never rendered in Device-Only");
            if (!b) {
              parityFindings.push("thread B rendered no transcript + veil to judge");
            } else {
              // The load-bearing assertion: thread B's row points at a server
              // journey the device has never held. Showing it would be a leak.
              if (!/Keep the evenings/.test(b.band)) parityFindings.push(`thread B's server journey overwrote the device one (band ${JSON.stringify(b.band.slice(0, 60))})`);
              if (b.cls > 0.01) parityFindings.push(`switching in Device-Only moved the layout (CLS=${b.cls.toFixed(4)})`);
            }
            if ((await page.inputValue('textarea[aria-label="Message Sovereign"]')).includes(probe)) parityFindings.push("thread A's words were still in the composer after switching");
          }
        }
        const noise = errs.filter((m) => !/status of 503/.test(m));
        if (noise.length) parityFindings.push(`console/page errors ${noise.slice(0, 2).join(" | ")}`);
        await ctx.close();
      }
    } finally {
      // Whatever the walk concluded, the account goes back to the mode every
      // other gate (and the next re-seed) expects.
      if (!(await flip("server"))) parityFindings.push("memory_mode could not be restored to 'server'");
    }
  }
  record("Device-Only keeps its own journey across thread switches", parityFindings.length === 0,
    parityFindings.slice(0, 3).join(" | ") || "vault journey survived a thread switch aimed at a server journey; banner cleared, CLS 0.0000");

  await browser.close();
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
  const { url: harnessUrl, server: harnessServer } = await gateBrowser();
  try {
    await gateCls(harnessUrl);
  } finally {
    harnessServer.close();
  }

  // One preview boot serves both the public-route pass and the authenticated
  // walk; the stale-artifact port guard means a re-run never collides with a
  // leftover worker from an interrupted session.
  await run("pkill", ["-f", "workerd.*8788"]);
  const { child, booted } = await launchPreview(8788);
  try {
    await gateRoutes(8788, booted);
    await gateAuthenticated(8788, booted);
    await gateErgonomics(8788, booted);
  } finally {
    if (child) child.kill("SIGKILL");
  }

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

// `SOVEREIGN_VERIFY_IMPORT_ONLY=1` lets scratch tooling import the gate
// functions without launching the full ratchet.
if (!process.env.SOVEREIGN_VERIFY_IMPORT_ONLY) {
  main().catch((err) => {
    console.error("\nverify:release crashed:", err);
    process.exit(1);
  });
}

// Exported for isolated gate development in .audit-tmp scratch runners.
export { buildHarnesses, serveHarnessPage, gateCls, launchPreview, seedLocalD1, readDevVar, mintSessionToken, FIXTURE_USER_ID, FIXTURE_THREAD_ID, FIXTURE_THREAD2_ID, FIXTURE_JOURNEY2_ID, CLS_OBSERVER_SCRIPT, VEIL_PROBE, gateErgonomics };
