import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Source-contract tests for the copy/controls batch #37, #39, #41, #42 and the
 * #11 residue. Components and routes are not importable under the plain vitest
 * setup (no alias config), so this follows the repo's established pattern for
 * surface invariants — read the file, assert on it (`advisory-hardening.test.ts`,
 * `chat-recall-contract.test.ts`).
 *
 * The claim behind #37 is the product-critical one: AGENTS.md allows honest
 * claims only. Both "priority" lines sold a benefit the engine does not
 * implement — `sovereign-model.ts` has no subscription-tier routing (its "tier"
 * hits are the shared model fallback ladder) and the operator
 * `support-notification` template carries only name/email/topic/message, so no
 * reply order exists to prioritise.
 */

describe("plan copy sells only what the code does (#37)", () => {
  const landing = readFileSync("src/components/landing-client.tsx", "utf8");
  const pricing = readFileSync("src/components/pricing-table.tsx", "utf8");

  it("no 'priority reply' claim in the landing plans block", () => {
    expect(landing).not.toMatch(/Priority reply/i);
    expect(landing).not.toMatch(/faster (reply|answers?)/i);
  });

  it("no 'priority support' claim in the comparison table's rows", () => {
    // Asserted on the row strings, not the whole file: the explanatory comment
    // that replaced the row is allowed to name the claim it removed.
    const start = pricing.indexOf("const ROWS");
    expect(start).toBeGreaterThan(-1);
    const rows = pricing.slice(start, pricing.indexOf("];", start));
    expect(rows).not.toMatch(/Priority/i);
    expect(rows).not.toMatch(/replies first/i);
    expect(pricing).not.toMatch(/feature:\s*"Priority/);
  });

  it("the two files still carry the limits that ARE implemented", () => {
    expect(landing).toContain("Up to 150 AI messages a day");
    expect(pricing).toContain('"AI messages per day"');
    expect(pricing).toContain("150/day");
  });
});

describe("capped mail is visible in logs (#11 residue)", () => {
  const signup = readFileSync("src/app/api/auth/route.ts", "utf8");

  it("both recipient-cap branches — verification mail and welcome mail — warn when they skip", () => {
    const gates = (signup.match(/recipientMailAllowed\(/g) || []).length;
    const warns = (signup.match(/recipient mail cap reached/g) || []).length;
    expect(gates).toBe(2);
    expect(warns).toBe(gates);
  });

  it("the welcome send is still gated, never unconditional", () => {
    expect(signup).toMatch(/else if \(await recipientMailAllowed\(env, email\)\)/);
    expect(signup).toMatch(/sendTemplate\(env, "welcome"/);
  });
});

describe("class names that render nothing (#39)", () => {
  const pricing = readFileSync("src/components/pricing-table.tsx", "utf8");
  const chat = readFileSync("src/app/chat/chat-client.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");

  it("the plans wrapper uses a surface token that exists — `surface` has no DEFAULT in tailwind.config.ts", () => {
    expect(pricing).not.toContain("bg-surface/");
    expect(pricing).toMatch(/bg-surface-\d\/40/);
  });

  it("every journey hook class the thread list applies is consumed by CSS or by the ratchet", () => {
    // The repo's precedent: `.journey-past-trigger` and `.journey-thread-badge`
    // have no rule in globals.css either — they are ratchet selectors. A class
    // with NEITHER is dead weight that misleads the next reader (#39).
    const ratchet = readFileSync("scripts/verify-release.mjs", "utf8");
    const hooks = new Set([...chat.matchAll(/\bjourney-[a-z][a-z-]*\b/g)].map((m) => m[0]));
    expect(hooks.size).toBeGreaterThan(0);
    for (const hook of hooks) {
      const consumed = css.includes(`.${hook}`) || ratchet.includes(hook);
      expect(consumed, `.${hook} is applied in chat-client.tsx but nothing styles or selects it`).toBe(true);
    }
    expect(chat).not.toContain("journey-thread-row");
  });
});

describe("the logo medallion never links nowhere (#41)", () => {
  const logo = readFileSync("src/components/ui/logo.tsx", "utf8");
  const files = [
    "src/components/ui/logo.tsx",
    "src/components/ui/loading.tsx",
    "src/components/site-footer.tsx",
    "src/components/landing-client.tsx",
    "src/app/chat/chat-client.tsx",
    "src/app/error.tsx",
    "src/app/not-found.tsx",
  ];

  it("no <Logo> is handed an empty/hash href", () => {
    for (const f of files) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/<Logo[^>]*href="#"/);
    }
  });

  it("Logo can render as non-interactive art for decorative contexts", () => {
    expect(logo).toMatch(/href\?:\s*string \| null/);
    // The tap-floor hook belongs to the link branch only — a span is not tappable.
    expect(logo).toMatch(/nav-brand/);
  });

  it("the decorative medallions opt out of focus, the real brand links point home", () => {
    expect(readFileSync("src/components/ui/loading.tsx", "utf8")).toMatch(/<Logo[^>]*href=\{null\}/);
    expect(readFileSync("src/app/error.tsx", "utf8")).not.toMatch(/<Logo[^>]*href=\{null\}/);
    expect(readFileSync("src/app/not-found.tsx", "utf8")).not.toMatch(/<Logo[^>]*href=\{null\}/);
  });
});

describe("the pricing CTA keeps its return path (#42)", () => {
  const landing = readFileSync("src/components/landing-client.tsx", "utf8");
  const pricing = readFileSync("src/components/pricing-table.tsx", "utf8");

  it("the paid plan CTA carries next=%2Fupgrade, as the comparison table's does", () => {
    // Slice from the Sovereign+ button to its label, so the assertion is about
    // the plans-block paid CTA and not the generic "Start free" links, which
    // correctly keep no return path (same split as pricing-table.tsx).
    const idx = landing.indexOf("Start with Sovereign+");
    expect(idx).toBeGreaterThan(-1);
    const block = landing.slice(idx - 400, idx);
    expect(block).toMatch(/href="\/onboard\?mode=signup&next=%2Fupgrade"/);
    expect(pricing).toContain("/onboard?mode=signup&next=%2Fupgrade");
  });

  it("the generic free CTAs keep no return path", () => {
    expect(landing).toContain('href="/onboard?mode=signup"');
  });
});

describe("user-facing labels carry no engine jargon, and the lens rename kept its route", () => {
  const pricing = readFileSync("src/components/pricing-table.tsx", "utf8");
  const nav = readFileSync("src/components/nav.tsx", "utf8");
  const footer = readFileSync("src/components/site-footer.tsx", "utf8");
  const landing = readFileSync("src/components/landing-client.tsx", "utf8");

  it("the comparison table's recall row speaks the user's words, not 'Semantic recall'", () => {
    // "Semantic recall" stays legal in backend identifiers and comments
    // (AGENTS.md); the row strings are the surface this pins.
    const start = pricing.indexOf("const ROWS");
    expect(start).toBeGreaterThan(-1);
    const rows = pricing.slice(start, pricing.indexOf("];", start));
    expect(rows).not.toMatch(/Semantic/i);
    expect(rows).toContain("Find your way back to any past conversation");
  });

  it("nav, footer and the landing lens card all say Family & Teams", () => {
    expect(nav).toContain("Family & Teams");
    expect(footer).toContain("Family & Teams");
    expect(landing).toContain('name: "Family & Teams"');
  });

  it("the rename is a label only — every link still points at /systems", () => {
    expect(nav).toContain('href="/systems"');
    expect(footer).toContain('href: "/systems"');
    expect(landing).toContain('href: "/systems"');
    expect(nav).not.toMatch(/>Systems</);
  });
});

describe("the composer's shortcuts survive refactor passes", () => {
  const chat = readFileSync("src/app/chat/chat-client.tsx", "utf8");

  it("⌘K opens the recall panel through the same toggle the button uses", () => {
    // One shared callback is the contract: a second inline toggle could drift
    // from the shortcut's guards without any type error.
    expect(chat).toMatch(/const toggleSearch = useCallback/);
    expect(chat).toMatch(/onClick=\{toggleSearch\}/);
    expect(chat).toMatch(/event\.key\.toLowerCase\(\) !== "k" \|\| !\(event\.metaKey \|\| event\.ctrlKey\)/);
  });
});
