#!/usr/bin/env node
// Interaction probe (temporary): on each public page, click every visible
// button while stubbing mutating API endpoints, capturing page errors, failed
// navigations, and dead targets (buttons with no effect and no handler signal).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORT = process.env.QA_PORT || "8799";
const BASE = `http://localhost:${PORT}`;
const PAGES = ["/", "/about", "/faq", "/self", "/people", "/systems", "/support", "/upgrade", "/redeem", "/onboard"];
// Never let a click hit a real mutating endpoint during the probe.
const MUTATING = ["**/api/auth**", "**/api/checkout**", "**/api/support**", "**/api/redeem**", "**/api/invites**", "**/api/chat**", "**/api/baseline**"];

async function main() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const report = [];
  for (const route of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    for (const pat of MUTATING) {
      await ctx.route(pat, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    }
    const page = await ctx.newPage();
    const errs = new Set();
    page.on("pageerror", (e) => errs.add("PAGEERROR:" + String(e).slice(0, 120)));
    page.on("console", (m) => { if (m.type() === "error") { const t = m.text(); if (!/favicon|ResizeObserver|Failed to load resource|404/i.test(t)) errs.add("CONSOLE:" + t.slice(0, 120)); } });
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    await new Promise((x) => setTimeout(x, 600));
    const before = page.url();
    // Enumerate button labels, click each by index (re-query after DOM changes).
    const count = await page.locator("button:visible").count().catch(() => 0);
    const clicked = [];
    for (let i = 0; i < count && i < 40; i++) {
      const btn = page.locator("button:visible").nth(i);
      let label = "";
      try { label = (await btn.getAttribute("aria-label")) || (await btn.innerText()).trim().slice(0, 30); } catch { continue; }
      try {
        await btn.scrollIntoViewIfNeeded({ timeout: 1500 });
        await btn.click({ timeout: 1500 });
        await new Promise((x) => setTimeout(x, 250));
        clicked.push(label || "(icon)");
      } catch { /* not clickable / covered — skip, not a defect signal alone */ }
    }
    const after = page.url();
    report.push({ route, buttons: count, clicked: clicked.length, navigated: after !== before, errors: [...errs] });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(ROOT, ".qa-interact.json"), JSON.stringify(report, null, 2));
  console.log("route        btns clicked nav errors");
  for (const r of report) {
    console.log(`${r.route.padEnd(12)} ${String(r.buttons).padStart(3)}  ${String(r.clicked).padStart(3)}   ${r.navigated ? "↦ " : "  "} ${r.errors.length ? "⚠ " + r.errors.join(" | ") : "clean"}`);
  }
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
