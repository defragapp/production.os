#!/usr/bin/env node
// Temporary audit: dump rendered innerText of every public page on the LIVE
// deployment for copy/accuracy review (mirrors scripts/qa-text.mjs, live target).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = process.env.QA_BASE || "https://sovereign.defrag.app";
const PUBLIC = ["/", "/about", "/blog", "/faq", "/offline", "/onboard", "/people",
  "/privacy", "/redeem", "/self", "/support", "/systems", "/terms", "/upgrade",
  "/account", "/settings", "/chat", "/baseline", "/invite", "/reset"];

async function main() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const dir = path.join(ROOT, ".audit-tmp", "live-text");
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERROR:" + e));
  for (const r of PUBLIC) {
    errs.length = 0;
    await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => errs.push("NAV:" + e.message));
    await new Promise((x) => setTimeout(x, 800));
    const finalUrl = page.url();
    const txt = await page.evaluate(() => document.body.innerText).catch(() => "");
    const anchors = await page.evaluate(() => [...document.querySelectorAll("a[href]")]
      .map((a) => ({ href: a.getAttribute("href"), text: a.innerText.trim().slice(0, 40) }))
      .filter((a) => a.href && a.href.startsWith("/")));
    const title = await page.title().catch(() => "");
    fs.writeFileSync(path.join(dir, r.replace(/\//g, "_") + ".txt"),
      `# ${r}\nFINAL URL: ${finalUrl}\nTITLE: ${title}\n\n## RENDERED TEXT\n${txt}\n\n## ANCHORS (${anchors.length})\n` +
      anchors.map((a) => `${a.href}\t[a: ${a.text}]`).join("\n") + "\n" +
      (errs.length ? `\n## CONSOLE ERRORS\n${errs.join("\n")}\n` : ""));
    console.log("dumped", r, "->", finalUrl.replace(BASE, ""), txt.length, "chars");
  }
  const sm = await fetch(`${BASE}/sitemap.xml`).then((x) => x.text()).catch(() => "");
  fs.writeFileSync(path.join(dir, "_sitemap.xml"), sm);
  const llms = await fetch(`${BASE}/llms.txt`).then((x) => x.text()).catch(() => "");
  fs.writeFileSync(path.join(dir, "_llms.txt"), llms);
  await browser.close();
  console.log("done");
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
