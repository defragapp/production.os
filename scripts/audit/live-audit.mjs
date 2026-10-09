// Live production audit — every public route at 1440 (desktop) + 390 (iOS),
// plus hard iOS metrics. Read-only against live. Screenshots to .audit-tmp/live-audit/.
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "https://sovereign.defrag.app";
const OUT = ".audit-tmp/live-audit";
fs.mkdirSync(OUT, { recursive: true });

const PUBLIC = ["/", "/about", "/self", "/people", "/systems", "/blog", "/blog/what-is-a-baseline", "/faq", "/support", "/terms", "/privacy", "/onboard", "/offline", "/redeem", "/reset"];
const AUTHED = ["/chat", "/settings", "/account", "/baseline", "/upgrade"];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];

async function shoot(path, vp, tag) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.hasTouch, isMobile: vp.isMobile });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  let status = "-", finalUrl = "";
  try {
    const r = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    status = r?.status() ?? "-";
    await page.waitForTimeout(1600);
    finalUrl = page.url();
  } catch (e) { errs.push("nav:" + String(e).slice(0, 60)); }
  const metrics = await page.evaluate(() => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - de.clientWidth;
    const inputs = [...document.querySelectorAll("input,select,textarea")].filter((n) => n.getClientRects().length)
      .map((n) => ({ tag: n.tagName.toLowerCase(), id: n.id || n.name || "", fs: Math.round(parseFloat(getComputedStyle(n).fontSize) * 100) / 100 }));
    const smallInputs = inputs.filter((i) => i.fs < 16).map((i) => `${i.tag}#${i.id}=${i.fs}px`);
    const taps = [...document.querySelectorAll('a[href],button,[role="button"],.btn,.btn-aurora,.btn-glass,.nav-link,.tap-line')]
      .filter((n) => n.getClientRects().length)
      .map((n) => Math.round(n.getBoundingClientRect().height));
    const shortTaps = taps.filter((h) => h > 0 && h < 44).length;
    const vpMeta = document.querySelector('meta[name="viewport"]')?.content || "";
    const vh = window.innerHeight;
    return { overflow, inputs: inputs.length, smallInputs, tapCount: taps.length, shortTaps, vpMeta, vh };
  });
  const file = `${OUT}${path.replace(/[^a-z0-9]/gi, "_") || "_root"}.${tag}.png`;
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  return { path, tag, status, finalUrl, consoleErrors: errs.length, errSample: errs.slice(0, 3), file, ...metrics };
}

const VP390 = { width: 390, height: 844, hasTouch: true, isMobile: true };
const VP1440 = { width: 1440, height: 900 };

for (const p of PUBLIC) {
  report.push(await shoot(p, VP390, "ios"));
  report.push(await shoot(p, VP1440, "desk"));
}
for (const p of AUTHED) {
  report.push(await shoot(p, VP390, "ios")); // expect redirect to /onboard
}

fs.writeFileSync(`${OUT}/_report.json`, JSON.stringify(report, null, 1));
// Console summary only
for (const r of report) {
  const flags = [];
  if (r.overflow > 1) flags.push(`OVERFLOW ${r.overflow}px`);
  if (r.consoleErrors) flags.push(`CONSOLE×${r.consoleErrors}`);
  if (r.smallInputs?.length) flags.push(`SMALL-INPUT ${r.smallInputs.join(",")}`);
  if (r.shortTaps) flags.push(`SHORT-TAP ${r.shortTaps}`);
  console.log(`${r.tag.padEnd(4)} ${r.path.padEnd(28)} ${String(r.status).padEnd(4)} ${flags.length ? "⚠ " + flags.join(" | ") : "clean"}`);
}
await browser.close();
