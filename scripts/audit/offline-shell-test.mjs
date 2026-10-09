#!/usr/bin/env node
// Release-recovery Phase 9: prove the deployed offline shell stays styled when
// its own hashed chunks cannot be fetched. Targets LIVE production. Sequence
// follows the documented constraint: the SW must install while online BEFORE
// setOffline (a fresh context + offline kills the very first navigation).
import fs from "node:fs";

const BASE = "https://sovereign.defrag.app";
const OUT = "/tmp/audit-offline";
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = await import("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const errors = [];
ctx.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const p = await ctx.newPage();

// 1 · online visit: let the SW install + precache (syncShell runs on install)
await p.goto(`${BASE}/`, { waitUntil: "load" });
await p.evaluate(() => navigator.serviceWorker.ready);
await p.waitForTimeout(4000); // give syncShell time to drain allSettled()
console.log("SW registered + activated: yes (serviceWorker.ready resolved)");

// 2 · still online, open /offline once so the shell document itself is cached
await p.goto(`${BASE}/offline`, { waitUntil: "load" }).catch(() => {});
await p.waitForTimeout(1500);

// 3 · HARD OFFLINE: cut the network at the browser level
await ctx.setOffline(true);

// 4 · direct navigation to /offline while fully offline
try { await p.goto(`${BASE}/offline`, { waitUntil: "load", timeout: 15000 }); } catch { /* an offline nav can reject; the shellFacts probe below inspects whatever rendered */ }
await p.waitForTimeout(2500);
const shellFacts = await p.evaluate(async () => {
  const cache = await caches.open("sovereign-offline-shell-v3");
  const keys = (await cache.keys()).map((r) => new URL(r.url).pathname);
  const cs = getComputedStyle(document.body);
  const emblem = document.querySelector("img[src*='emblem'], img[src*='icon']");
  const retry = [...document.querySelectorAll("button,a")].find((b) => /retry/i.test(b.textContent || ""));
  return {
    url: location.href,
    bg: cs.backgroundColor,
    emblemVisible: emblem ? emblem.getBoundingClientRect().width > 20 && emblem.currentSrc !== "" && (emblem.naturalWidth > 0 || emblem.complete) && emblem.getBoundingClientRect().width > 20 : false,
    emblemSrc: emblem ? emblem.getAttribute("src") : null,
    retryVisible: retry ? retry.getBoundingClientRect().height >= 32 : false,
    h1: (document.querySelector("h1") || {}).textContent || "",
    cacheKeys: keys,
  };
});
await p.screenshot({ path: `${OUT}/step2-offline-shell.png` });
console.log("OFFLINE /offline →", JSON.stringify(shellFacts, null, 2));

// 5 · offline navigation to a page never visited: expect /offline shell fallback
try { await p.goto(`${BASE}/faq`, { waitUntil: "load", timeout: 15000 }); } catch (e) { console.log("faq nav threw:", String(e).slice(0, 100)); }
await p.waitForTimeout(2500);
const faqFacts = await p.evaluate(() => ({
  url: location.href,
  isOfflineShell: !!document.querySelector("h1") && /no connection|offline|retry/i.test(document.body.innerText),
  h1: (document.querySelector("h1") || {}).textContent || "",
  bg: getComputedStyle(document.body).backgroundColor,
}));
await p.screenshot({ path: `${OUT}/step3-offline-any-page.png` });
console.log("OFFLINE /faq →", JSON.stringify(faqFacts));

// 6 · recover
await ctx.setOffline(false);
await p.goto(`${BASE}/`, { waitUntil: "load" });
await p.screenshot({ path: `${OUT}/step4-recovered.png` });
console.log("RECOVERED / →", await p.evaluate(() => ({ url: location.href, title: document.title })));

console.log("PAGE CONSOLE ERRORS:", errors.length ? errors : "(none)");
await browser.close();
