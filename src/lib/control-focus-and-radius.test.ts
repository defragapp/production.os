import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Source-contract ratchets for the visual-refinement pass (focus-offset +
 * radius token). These surfaces are not importable under the plain vitest
 * setup (no alias config), so — like `contrast-floors-and-register.test.ts` —
 * each test reads the file and asserts on it.
 */

describe("the primary Button keeps a warm focus offset", () => {
  const button = readFileSync("src/components/ui/button.tsx", "utf8");

  it("pins the focus ring offset to the background token, never the default white", () => {
    // Tailwind's `ring-offset-2` defaults `--tw-ring-offset-color` to #fff, so
    // without an explicit offset colour a focused <Button> paints a pure-white
    // 2px seam inside the warm ring — off the cream/graphite scale and unlike
    // every other control in the app, which all add `ring-offset-background`.
    expect(button).toMatch(/focus-visible:ring-offset-2\b/);
    expect(button).toMatch(/focus-visible:ring-offset-background\b/);
  });
});

describe("small-control radii stay on the 6 / 8 / 12 token scale", () => {
  const canvas = readFileSync("src/components/journey-canvas.tsx", "utf8");

  it("journey controls do not carry the off-scale 4px `rounded-sm`", () => {
    // BRAND.md's radius scale is chip (6) / control (8) / panel (12). The
    // text buttons used the shadcn default `rounded-sm` (calc(--radius - 4px)
    // = 4px) while the rest of the same component used `rounded-chip`; the
    // outliers were snapped onto the chip step.
    expect(canvas).not.toMatch(/rounded-sm\b/);
    expect(canvas).toMatch(/rounded-chip\b/);
  });
});
