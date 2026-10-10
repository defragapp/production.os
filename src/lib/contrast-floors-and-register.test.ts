import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Source-contract tests for the polish batch #40 (AA contrast), #44 (touch
 * floors living in the single coarse block) and #46 (legal-page register).
 * These surfaces are not importable under the plain vitest setup (no alias
 * config), so this follows the repo's established pattern for surface
 * invariants — read the file, assert on it (`plan-copy-and-controls.test.ts`,
 * `advisory-hardening.test.ts`).
 */

describe("body and label text clears the AA contrast floor (#40)", () => {
  const files = [
    "src/app/chat/chat-client.tsx",
    "src/app/support/support-form.tsx",
    "src/app/account/page.tsx",
    "src/components/ui/input.tsx",
    "src/components/pricing-table.tsx",
    "src/components/baseline-drawer.tsx",
    "src/components/share-card.tsx",
  ];

  it("no muted body/label/placeholder tone sits below the /70 (5.05:1) AA floor", () => {
    // Against `--background 30 8% 4.5%`: `/50` = 3.10:1, `/55` = 3.52:1,
    // `/60` = 3.99:1 — all under the 4.5:1 floor for small text. `/70` passes.
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} still uses a sub-AA text-muted-foreground/(50|55|60)`).not.toMatch(
        /text-muted-foreground\/(50|55|60)\b/,
      );
    }
  });
});

describe("the 44px touch floor is authored once, in the coarse block (#44)", () => {
  const gate = readFileSync("src/components/terms-gate.tsx", "utf8");
  const canvas = readFileSync("src/components/journey-canvas.tsx", "utf8");
  const chat = readFileSync("src/app/chat/chat-client.tsx", "utf8");

  it("terms-gate controls carry the sanctioned hook, never a hand-written desktop floor", () => {
    expect(gate).toContain("tap-line");
    expect(gate).toContain("btn-focal");
    // `tap-line`/`btn-focal` are floored at 2.75rem only under `pointer: coarse`
    // (globals.css:578,612). The old inline `min-h-[44px]` inflated the same
    // controls on desktop — the exact duplication AGENTS.md forbids.
    expect(gate).not.toMatch(/min-h-\[44px\]/);
  });

  it("journey-bar buttons drop the redundant inline floor — `.journey-bar button` already floors them", () => {
    // Five literals became one: only the past-arc-sheet Close button (NOT a
    // `.journey-bar` descendant) keeps an inline floor, because nothing else
    // covers it. The four in-bar buttons rely on globals.css:543.
    expect((canvas.match(/min-h-\[2\.75rem\]/g) || []).length).toBe(1);
    // The "New" chip keeps its min-width: the coarse block floors height, not
    // width, so a two-letter target still needs the explicit square.
    expect(canvas).toMatch(/min-w-\[2\.75rem\]/);
  });

  it("the surviving inline floor is the past-arc Close button, not a journey-bar control", () => {
    const sheetIdx = canvas.indexOf("past-arc-sheet");
    const floorIdx = canvas.search(/min-h-\[2\.75rem\]/);
    expect(sheetIdx).toBeGreaterThan(-1);
    expect(floorIdx).toBeGreaterThan(sheetIdx);
  });

  it("the ratchet-protected literals are untouched", () => {
    // verify-release.mjs:255 asserts chat-client keeps a `min-h-[44px]` (the
    // failed-turn recovery). This batch must not delete it.
    expect(chat).toMatch(/min-h-\[44px\]/);
  });
});

describe("the legal pages share one plain register (#46)", () => {
  const terms = readFileSync("src/app/terms/page.tsx", "utf8");
  const headings = [...terms.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]);

  it("no terms heading still speaks the legalese register", () => {
    for (const legalese of [
      "Acceptance of Terms",
      "Eligibility",
      "Prohibited Conduct",
      "Intellectual Property",
      "Disclaimer of Warranties",
      "Limitation of Liability",
      "Indemnification",
      "Governing Law",
    ]) {
      // Asserted against the <h2> text only: bodies keep the legal term where
      // precision needs it; the headings move to the brand register (privacy).
      expect(headings.join(" "), `a heading still reads "${legalese}"`).not.toContain(legalese);
    }
  });

  it("still 16 numbered sections in order — a rename, not a rewrite", () => {
    const numbers = [...terms.matchAll(/<h2[^>]*>\s*(\d+)\./g)].map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });
});
