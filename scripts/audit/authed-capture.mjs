// #16 — rendered inspection of AUTHED surfaces against the LOCAL seeded preview.
// Mints a session for the content-rich fixture user, then screenshots the
// authed routes at 390 (mobile, coarse pointer) and 1440 (desktop). Read-only.
import fs from "node:fs";
import { chromium } from "playwright";
import { createJWT } from "../src/lib/auth.ts";

const PORT = 8789;
const USER_ID = "7v7f1r00-0000-4000-8000-000000000001";
const EMAIL = "verify-release@local.test";
const OUT = ".audit-tmp/authed-pixels";
fs.mkdirSync(OUT, { recursive: true });

const vars = Object.fromEntries(
  fs.readFileSync(".dev.vars", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const jwt = await createJWT(USER_ID, EMAIL, vars.JWT_SECRET, 1);

const ROUTES = ["/chat", "/settings", "/baseline", "/account", "/redeem"];
const VIEWPORTS = [
  { name: "390", width: 390, height: 844, hasTouch: true, isMobile: true },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.hasTouch, isMobile: vp.isMobile });
  await ctx.addCookies([{ name: "sovereign_session", value: jwt, domain: "localhost", path: "/" }]);
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    let status = "-";
    try {
      const resp = await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "domcontentloaded", timeout: 25000 });
      status = resp?.status() ?? "-";
      await page.waitForTimeout(1800); // let client hydration + fetches settle
    } catch (e) {
      errs.push("nav: " + String(e).slice(0, 80));
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth).catch(() => -1);
    const file = `${OUT}/${route.replace(/\//g, "_") || "_root"}.${vp.name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    results.push({ route, vp: vp.name, status, overflow, consoleErrors: errs.length, errSample: errs.slice(0, 2), file });
    await page.close();
  }
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 1));
