#!/usr/bin/env node
// Autonomous QA crawl (temporary — removed before commit). Walks every route
// against the running preview server, captures console/page errors, HTTP 4xx/5xx,
// horizontal overflow, and validates same-origin links. Emits JSON to stdout.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PORT = process.env.QA_PORT || "8799";
const BASE = `http://localhost:${PORT}`;

const PUBLIC = [
  "/", "/about", "/baseline", "/chat", "/faq", "/offline", "/onboard",
  "/people", "/privacy", "/redeem", "/reset", "/self", "/settings", "/support",
  "/systems", "/terms", "/upgrade",
];
const AUTHED = ["/chat", "/settings", "/baseline", "/account", "/invite", "/people", "/self", "/systems"];

function run(cmd, args) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { cwd: ROOT });
    let out = "", err = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (err += d));
    c.on("close", (code) => resolve({ code, stdout: out, stderr: err }));
    c.on("error", () => resolve({ code: -1, stdout: out, stderr: err }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function readDevVar(file, key) {
  const m = new RegExp(`^${key}=(.*)$`, "m").exec(file);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}
function mintToken(secret, sub, email) {
  const b64 = (buf) => Buffer.from(buf).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ sub, email, iat: now, exp: now + 3600, tv: 1 }));
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

async function seed() {
  const USER = "7v7f1r00-0000-4000-8000-000000000001";
  const EMAIL = "verify-release@local.test";
  const apply = await run("npx", ["wrangler", "d1", "execute", "production-os-db", "--local", "--file", "schema.sql"]);
  if (apply.code !== 0) return { ok: false, why: "schema apply failed: " + apply.stderr.slice(-160) };
  const tpl = fs.readFileSync(path.join(ROOT, "scripts/e2e/seed-local.sql"), "utf8");
  const sql = tpl
    .replaceAll("__USER_ID__", USER)
    .replaceAll("__JOURNEY_ID__", "7v7f1r00-0000-4000-8000-000000000002")
    .replaceAll("__THREAD_ID__", "7v7f1r00-0000-4000-8000-000000000003")
    .replaceAll("__JOURNEY2_ID__", "7v7f1r00-0000-4000-8000-000000000004")
    .replaceAll("__THREAD2_ID__", "7v7f1r00-0000-4000-8000-000000000005");
  const tmp = path.join(ROOT, ".qa-seed.rendered.sql");
  fs.writeFileSync(tmp, sql);
  const seedres = await run("npx", ["wrangler", "d1", "execute", "production-os-db", "--local", "--file", tmp]);
  if (seedres.code !== 0) return { ok: false, why: "seed failed: " + seedres.stderr.slice(-160) };
  return { ok: true, USER, EMAIL };
}

async function main() {
  const { chromium } = await import("playwright");
  const devVars = fs.readFileSync(path.join(ROOT, ".dev.vars"), "utf8");
  const jwt = readDevVar(devVars, "JWT_SECRET");
  const s = await seed();
  const token = jwt && s.ok ? mintToken(jwt, s.USER, s.EMAIL) : null;
  console.log("SEED:", JSON.stringify(s), "TOKEN:", token ? "yes" : "no");

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const findings = [];
  const allLinks = new Set();

  async function walk(routes, label, withAuth) {
    for (const route of routes) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      if (withAuth && token) {
        await ctx.addCookies([{ name: "sovereign_session", value: token, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
      }
      const page = await ctx.newPage();
      const errs = [];
      const statuses = [];
      page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
      page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e)));
      page.on("response", (r) => {
        const u = r.url();
        if (u.startsWith(BASE) && r.status() >= 400) statuses.push(`${r.status()} ${u.replace(BASE, "")}`);
      });
      try {
        const resp = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await sleep(route === "/chat" ? 1500 : 700);
        const info = await page.evaluate(() => ({
          finalUrl: location.pathname,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          title: document.title,
          links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
          h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 80),
        })).catch((e) => ({ finalUrl: "?", overflow: -1, title: "?", links: [], h1: "", err: String(e) }));
        for (const l of info.links || []) {
          if (l && l.startsWith("/") && !l.startsWith("//")) allLinks.add(l.split("#")[0].split("?")[0]);
        }
        findings.push({
          label, route, status: resp ? resp.status() : 0, finalUrl: info.finalUrl,
          overflow: info.overflow, title: info.title, h1: info.h1,
          consoleErrors: errs.filter((x) => !/favicon|ResizeObserver|Failed to load resource/i.test(x)),
          httpErrors: statuses, linkCount: (info.links || []).length,
        });
      } catch (e) {
        findings.push({ label, route, error: String(e).slice(0, 120), consoleErrors: errs, httpErrors: statuses });
      }
      await ctx.close();
    }
  }

  await walk(PUBLIC, "public", false);
  await walk(AUTHED, "authed", true);

  const linkResults = [];
  for (const l of [...allLinks].sort()) {
    try {
      const r = await fetch(`${BASE}${l}`, { redirect: "manual" });
      if (r.status >= 400) linkResults.push({ link: l, status: r.status });
    } catch (e) {
      linkResults.push({ link: l, error: String(e) });
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(ROOT, ".qa-crawl-report.json"), JSON.stringify({ findings, linkResults }, null, 2));
  console.log("\n=== ROUTE FINDINGS ===");
  for (const f of findings) {
    const flags = [];
    if (f.error) flags.push("NAV:" + f.error);
    if (f.status >= 400) flags.push("HTTP " + f.status);
    if (f.consoleErrors?.length) flags.push("CONSOLE[" + f.consoleErrors.length + "]: " + f.consoleErrors[0].slice(0, 90));
    if (f.httpErrors?.length) flags.push("SUBREQ: " + f.httpErrors.join(","));
    if (f.overflow > 1) flags.push("OVERFLOW " + f.overflow + "px");
    console.log(`${(f.label + " " + f.route).padEnd(24)} -> ${f.finalUrl || "?"} ${flags.length ? "⚠ " + flags.join(" | ") : "ok"}`);
  }
  console.log("\n=== BROKEN INTERNAL LINKS ===");
  console.log(linkResults.length ? JSON.stringify(linkResults, null, 2) : "none");
}
main().catch((e) => { console.error("CRAWL FAILED:", e); process.exit(1); });
