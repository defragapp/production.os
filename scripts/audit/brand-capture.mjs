// Experiential brand audit harness — read-only crawl of local preview.
// Stage A: public routes desktop+mobile, console/overflow/CLS.
// Stage B: signup -> onboard/baseline -> authed /chat walkthrough.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.AUDIT_BASE || "http://localhost:8787";
const OUT = ".audit-tmp/brand";
fs.mkdirSync(OUT, { recursive: true });

const PUBLIC = ["/", "/about", "/self", "/people", "/systems", "/onboard", "/faq"];
const EMAIL = `brand-audit-${Date.now()}@example.com`;
const PASSWORD = "BrandAudit!2026x";

const findings = [];
function note(kind, text) { findings.push({ kind, text: String(text).slice(0, 300) }); }

const browser = await chromium.launch();

async function newPage(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") note("console-error", `${m.text()}`); });
  page.on("pageerror", (e) => note("pageerror", e));
  page.on("response", (r) => { if (r.status() >= 400) note("http-" + r.status(), r.url()); });
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  });
  return { ctx, page };
}

async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: name.endsWith("full") }); }

async function crawlPublic(w, h, tag) {
  const { ctx, page } = await newPage(w, h);
  for (const route of PUBLIC) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      const m = await page.evaluate(() => ({
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cls: window.__cls,
      }));
      if (m.overflowX > 0) note("overflowX", `${route} ${tag}: ${m.overflowX}px`);
      if (m.cls > 0.01) note("cls", `${route} ${tag}: ${m.cls.toFixed(4)}`);
      const name = `${tag}-${route === "/" ? "home" : route.slice(1)}${tag === "mob" ? "-hero" : "-full"}`;
      await shot(page, name);
      console.log(`${tag} ${route}: ok overflowX=${m.overflowX} cls=${m.cls.toFixed(4)}`);
    } catch (e) { note("nav-fail", `${route} ${tag}: ${e}`); console.log(`${tag} ${route}: FAIL`); }
  }
  await ctx.close();
}

await crawlPublic(1440, 900, "desk");
await crawlPublic(390, 844, "mob");

// ---- Stage B: authed walkthrough on desktop ----
const { page } = await newPage(1440, 900);
try {
  await page.goto(BASE + "/onboard?mode=signup", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await shot(page, "auth-01-signup-form");
  // fill whatever email/password fields exist
  const emailSel = 'input[type="email"], input[name="email"]';
  const passSel = 'input[type="password"]';
  await page.fill(emailSel, EMAIL);
  await page.fill(passSel, PASSWORD);
  // terms checkbox if present
  const terms = page.locator('input[type="checkbox"]').first();
  if (await terms.isVisible().catch(() => false)) await terms.click();
  await shot(page, "auth-02-signup-filled");
  // submit via visible submit button
  const btn = page.locator('button[type="submit"]').first();
  await btn.click();
  await page.waitForTimeout(6000);
  console.log("after signup, url:", page.url());
  await shot(page, "auth-03-after-signup", true);

  // follow redirects: baseline intake if present
  if (/onboard/.test(page.url())) {
    // maybe email verification wall — capture text
    const body = await page.evaluate(() => document.body.innerText.slice(0, 600));
    note("signup-landing", body);
  }
  for (const dest of ["/baseline", "/self", "/chat"]) {
    await page.goto(BASE + dest, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, `auth-10-${dest.slice(1)}`, true);
    console.log("authed visit", dest, "->", page.url());
  }

  // chat interaction
  await page.goto(BASE + "/chat", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const ta = page.locator("textarea").first();
  if (await ta.isVisible().catch(() => false)) {
    await ta.fill("My partner and I keep going in circles about how decisions get made in our house. What is actually happening between us?");
    await shot(page, "auth-20-chat-composer");
    await page.locator('button:has-text("Send"), button[type="submit"]').last().click();
    // non-streaming generation can take a while locally
    await page.waitForTimeout(45000);
    await shot(page, "auth-21-chat-answer", true);
    const txt = await page.evaluate(() => document.body.innerText.slice(-1200));
    note("chat-answer-tail", txt);
  } else {
    note("chat-no-composer", "textarea not visible on /chat");
    await shot(page, "auth-20-chat-nostate", true);
  }
} catch (e) { note("stageB-crash", e); }

await browser.close();
console.log("--- FINDINGS ---");
for (const f of findings) console.log(JSON.stringify(f));
console.log("done. email:", EMAIL);
