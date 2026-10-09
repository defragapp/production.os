import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getMiddlewareMatchers } = require("next/dist/build/analysis/get-page-static-info.js");
const { getMiddlewareRouteMatcher } = require("next/dist/shared/lib/router/utils/middleware-route-matcher.js");

// Pull the matcher string literal straight out of the TS source so we never
// hand-transcribe (and never re-escape) it. The literal is a double-quoted
// JS string, so JSON.parse decodes it exactly as the runtime would.
function extractMatcher(tsSource) {
  const m = tsSource.match(/"(\/\(\(\?![^"]*)"/);
  if (!m) throw new Error("matcher literal not found");
  return JSON.parse(`"${m[1]}"`);
}

const original = extractMatcher(execSync("git show HEAD:src/middleware.ts", { encoding: "utf8" }));
const current = extractMatcher(readFileSync("src/middleware.ts", "utf8"));

console.log("ORIGINAL literal :", original);
console.log("CURRENT  literal :", current);

const cases = [
  ["/api/invites/abc.", true], // dotted API path MUST be gated (middleware runs)
  ["/api/journeys/x.y", true],
  ["/api/chat", true],
  ["/api/agent-lee", true],
  ["/chat", true],
  ["/sw.js", false], // static asset MUST keep its bypass
  ["/manifest.webmanifest", false],
  ["/robots.txt", false],
  ["/favicon.ico", false],
  ["/_next/static/chunks/app.js", false],
];

function label(fn, name) {
  console.log(`\n### ${name}`);
  let bad = 0;
  for (const [p, want] of cases) {
    const got = Boolean(fn(p, { headers: new Headers() }, {}));
    if (got !== want) bad++;
    console.log(`  ${got === want ? "OK  " : "XX  "} ${got ? "gate " : "bypass"} ${p}  (want ${want ? "gate" : "bypass"})`);
  }
  console.log(`  -> ${bad} mismatch(es)`);
  return bad;
}

function build(pattern) {
  const matchers = getMiddlewareMatchers([pattern], {});
  console.log("compiled regexp:", matchers[0].regexp);
  return getMiddlewareRouteMatcher(matchers);
}

const badOrig = label(build(original), "ORIGINAL (git HEAD)");
const badCur = label(build(current), "CURRENT (my fix)");

console.log("\nSUMMARY original mismatches:", badOrig, "| current mismatches:", badCur);
