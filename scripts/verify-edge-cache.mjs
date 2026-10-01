#!/usr/bin/env node
/**
 * verify:edge — a permanent gate for the Cloudflare zone Cache Rules.
 *
 * The app's origin always answers `Cache-Control: public, max-age=0,
 * must-revalidate` (the OpenNext adapter stamps it, and legal/OG/SEO pages
 * must not be pinned in code), so edge caching those surfaces is enforced
 * ONLY by zone Cache Rules, not by this repo. This script proves the rules
 * are actually live: it warms each path with one GET, then re-requests and
 * reads `cf-cache-status` on the second response. A rule that has taken
 * effect turns that into HIT; a missing/dead rule leaves it MISS.
 *
 * Path set (kept in lockstep with docs/cloudflare-account-migration.md
 * "Ready-to-apply edge specs"):
 *   legal-static-immutable : /about /faq /privacy /terms
 *   seo-crawlers-immutable : /llms.txt /llms-full.txt /sitemap.xml
 *                            /robots.txt /.well-known/security.txt
 *   landing-og-immutable   : /opengraph-image
 *   sigil-og-immutable     : /s/<token>/opengraph-image  (only with --sigil)
 *
 * Usage:
 *   node scripts/verify-edge-cache.mjs
 *   node scripts/verify-edge-cache.mjs --sigil <token>
 *   EDGE_CACHE_BASE=https://sovereign.defrag.app SIGIL_TOKEN=<t> npm run verify:edge
 *
 * Exit 0 = every checked path is cached at the edge (HIT/STALE). Exit 1 =
 * at least one is not — which is the EXPECTED result until the four Cache
 * Rules are applied in the dashboard. A non-200 is reported as a hard fail
 * (a 404 means the rule matches a path that no longer exists).
 */

const base = (process.env.EDGE_CACHE_BASE || "https://sovereign.defrag.app").replace(/\/+$/, "");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return null;
}
const sigil = arg("sigil") || process.env.SIGIL_TOKEN || null;

// Each entry: the path to probe and the Cache Rule that should make it HIT.
const targets = [
  { rule: "legal-static-immutable", path: "/about" },
  { rule: "legal-static-immutable", path: "/faq" },
  { rule: "legal-static-immutable", path: "/privacy" },
  { rule: "legal-static-immutable", path: "/terms" },
  { rule: "seo-crawlers-immutable", path: "/llms.txt" },
  { rule: "seo-crawlers-immutable", path: "/llms-full.txt" },
  { rule: "seo-crawlers-immutable", path: "/sitemap.xml" },
  { rule: "seo-crawlers-immutable", path: "/robots.txt" },
  { rule: "seo-crawlers-immutable", path: "/.well-known/security.txt" },
  { rule: "landing-og-immutable", path: "/opengraph-image" },
];
if (sigil) targets.push({ rule: "sigil-og-immutable", path: `/s/${sigil}/opengraph-image` });

const CACHED = new Set(["HIT", "STALE"]);

async function probe(path) {
  const url = base + path;
  // Warm the edge cache with a first request, then read the second one's
  // cf-cache-status. Sequential (not parallel) so the seed lands first.
  await fetch(url, { redirect: "follow", headers: { "user-agent": "sovereign-edge-cache-verify" } }).catch(() => null);
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "sovereign-edge-cache-verify" } });
    return { status: res.status, cache: res.headers.get("cf-cache-status") };
  } catch (err) {
    return { status: 0, cache: null, error: String(err && err.message ? err.message : err) };
  }
}

function heading(text) {
  console.log(`\n${"─".repeat(3)} ${text} ${"─".repeat(Math.max(0, 60 - text.length))}`);
}

(async () => {
  heading(`edge cache verification · ${base}`);
  if (!sigil) console.log("  (no --sigil token: skipping /s/<token>/opengraph-image)");

  let failures = 0;
  for (const t of targets) {
    const r = await probe(t.path);
    let ok;
    let detail;
    if (r.error) {
      ok = false; detail = `request failed: ${r.error}`;
    } else if (r.status !== 200) {
      ok = false; detail = `HTTP ${r.status} (path gone?)`;
    } else {
      ok = CACHED.has((r.cache || "").toUpperCase());
      detail = `cf-cache-status: ${r.cache || "(absent → MISS)"}`;
    }
    if (!ok) failures += 1;
    const mark = ok ? "✓" : "✗";
    console.log(`  ${mark} [${t.rule}] ${t.path}  — ${detail}`);
  }

  const total = targets.length;
  const passed = total - failures;
  console.log("");
  if (failures === 0) {
    console.log(`  ${passed}/${total} paths cached at the edge — Cache Rules are live.`);
    process.exit(0);
  }
  console.log(`  ${passed}/${total} cached — ${failures} not edge-cached yet.`);
  console.log("  If the four Cache Rules are not applied in the dashboard yet, this");
  console.log("  is the expected baseline. Otherwise check each failing rule's filter.");
  process.exit(1);
})();
