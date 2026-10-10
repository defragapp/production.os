#!/usr/bin/env node
// Second-pass QA (temporary): dump rendered innerText of every public page for
// copy review, and resolve dynamic routes (blog slugs, sigil /s/:id).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORT = process.env.QA_PORT || "8799";
const BASE = `http://localhost:${PORT}`;
const PUBLIC = ["/", "/about", "/faq", "/offline", "/onboard", "/people",
  "/privacy", "/redeem", "/self", "/support", "/systems", "/terms", "/upgrade"];

async function main() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const dir = path.join(ROOT, ".qa-text");
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERROR:" + e));
  for (const r of PUBLIC) {
    errs.length = 0;
    await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    await new Promise((x) => setTimeout(x, 500));
    const txt = await page.evaluate(() => document.body.innerText).catch(() => "");
    const anchors = await page.evaluate(() => [...document.querySelectorAll("a[href]")]
      .map((a) => ({ href: a.getAttribute("href"), text: a.innerText.trim().slice(0, 40) }))
      .filter((a) => a.href && a.href.startsWith("/")));
    fs.writeFileSync(path.join(dir, r.replace(/\//g, "_") + ".txt"),
      `# ${r}\n\n## RENDERED TEXT\n${txt}\n\n## ANCHORS (${anchors.length})\n` +
      anchors.map((a) => `${a.href}\t[a: ${a.text}]`).join("\n") + "\n" +
      (errs.length ? `\n## CONSOLE ERRORS\n${errs.join("\n")}\n` : ""));
  }
  // Dynamic blog slugs via sitemap
  const sm = await fetch(`${BASE}/sitemap.xml`).then((x) => x.text()).catch(() => "");
  fs.writeFileSync(path.join(dir, "_sitemap.xml"), sm);
  await browser.close();
  console.log("dumped", PUBLIC.length, "pages to", dir);
  console.log("sitemap present:", sm.length > 0, sm.slice(0, 200));
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
