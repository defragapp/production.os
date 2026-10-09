// Real-user authed walkthrough against local preview (:8787) with the minted
// session. Captures nav (public + authed, desktop + mobile), baseline intake,
// self, and an actual AI chat answer. Read-only w.r.t. source.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8787";
const OUT = ".audit-tmp/authed-audit";
fs.mkdirSync(OUT, { recursive: true });
const { cookie } = JSON.parse(fs.readFileSync(".audit-tmp/session.json", "utf8"));
const [name, value] = cookie.split("=");
const notes = [];

const browser = await chromium.launch({ channel: "chrome", headless: true });

// ── Desktop 1440 ──────────────────────────────────────────────
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await dctx.addCookies([{ name, value, domain: "127.0.0.1", path: "/" }]);
const page = await dctx.newPage();
page.on("console", (m) => { if (m.type() === "error") notes.push("console-error " + m.text().slice(0, 160)); });
page.on("pageerror", (e) => notes.push("pageerror " + String(e).slice(0, 160)));
const go = async (r) => { await page.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 30000 }); await page.waitForTimeout(1300); };
const pic = async (n, full = false) => { await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full }); };

// 1. authed /chat — if no baseline, it redirects to /baseline?from=chat
await go("/chat");
notes.push("chat entry url: " + page.url());
await pic("d-01-chat-entry", true);

// 2. baseline intake (only if we landed there)
if (page.url().includes("/baseline")) {
  await pic("d-02-baseline-form", true);
  const dateInputs = page.locator('input[inputmode="numeric"], input[maxlength="2"], input[maxlength="4"]');
  const cnt = await dateInputs.count();
  const vals = ["06", "14", "1988"];
  for (let i = 0; i < Math.min(3, cnt); i++) await dateInputs.nth(i).fill(vals[i] ?? "1988");
  const time = page.locator('input[type="time"]').first();
  if (await time.count()) await time.fill("09:30");
  const place = page.locator('input[placeholder*="City"], input[placeholder*="place"]').first();
  if (await place.count()) await place.fill("Lisbon, Portugal");
  await pic("d-03-baseline-filled", true);
  const buildBtn = page.locator('button:has-text("Baseline"), button:has-text("Build")').first();
  await buildBtn.click();
  await page.waitForTimeout(14000); // NASA/JPL geocode + compute + redirect
  notes.push("after baseline url: " + page.url());
  await pic("d-04-after-baseline", true);
}

// 3. authed /self reflects real data
await go("/self");
await pic("d-05-self-authed", true);

// 4. the AI conversation itself
await go("/chat");
const ta = page.locator("textarea").first();
if (await ta.isVisible().catch(() => false)) {
  await ta.fill("My partner says I go quiet when I'm overwhelmed, and it makes her chase. I don't experience it that way at all. What is actually happening between us?");
  await pic("d-06-composer");
  await page.locator('button[type="submit"], button:has-text("Send")').last().click();
  const before = (await page.evaluate(() => document.body.innerText)).length;
  let answered = false;
  for (let t = 0; t < 18; t++) {
    await page.waitForTimeout(8000);
    const len = await page.evaluate(() => document.body.innerText.length);
    if (len > before + 250) { answered = true; break; }
  }
  notes.push("chat answered: " + answered);
  await page.waitForTimeout(2500);
  await pic("d-07-chat-answer", true);
  const body = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(`${OUT}/chat-answer.txt`, body.slice(-3500));
  const errs = body.match(/(error|went wrong|try again|quota|not configured)[^\n]{0,120}/gi);
  if (errs) notes.push("surface text errors: " + JSON.stringify(errs.slice(0, 4)));
} else {
  notes.push("NO COMPOSER on authed /chat — url " + page.url());
  await pic("d-06-chat-nostate", true);
}

// 5. authed nav surfaces
for (const [r, n] of [["/account", "d-08-account"], ["/settings", "d-09-settings"], ["/upgrade", "d-10-upgrade"], ["/baseline", "d-11-baseline-view"]]) {
  await go(r);
  await pic(n, true);
}

// 6. logged-out public nav (fresh context, no cookie)
const pctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const ppage = await pctx.newPage();
await ppage.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
await ppage.waitForTimeout(1500);
await ppage.screenshot({ path: `${OUT}/d-12-public-nav.png` });

// ── Mobile 390 (isMobile + hasTouch so coarse-pointer floors apply) ──
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await mctx.addCookies([{ name, value, domain: "127.0.0.1", path: "/" }]);
const mp = await mctx.newPage();
const mgo = async (r) => { await mp.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 30000 }); await mp.waitForTimeout(1300); };
await mgo("/chat");
await mp.screenshot({ path: `${OUT}/m-01-chat.png`, fullPage: true });
// open the mobile drawer
const burger = mp.locator('button[aria-label="Open menu"]').first();
if (await burger.count()) { await burger.click(); await mp.waitForTimeout(600); await mp.screenshot({ path: `${OUT}/m-02-drawer.png` }); }
else notes.push("no mobile burger on authed chat");
// public mobile landing nav
const mpub = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const mpp = await mpub.newPage();
await mpp.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
await mpp.waitForTimeout(1500);
await mpp.screenshot({ path: `${OUT}/m-03-public-nav.png` });

await browser.close();
fs.writeFileSync(`${OUT}/notes.txt`, notes.join("\n"));
console.log(notes.join("\n"));
