import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_MARK_SHAPES } from "./brand-mark";

/**
 * The brand is ONE mark — the Ace-of-Cups glyph — reused at every size. These
 * guards fail if someone forks a separate simplified logo or drops a defining
 * element of the canonical silhouette (dove, overflow streams, droplets).
 */
describe("brand mark (single canonical glyph)", () => {
  const dove = "M32 14 C30.5 11.5";
  const leftStream = "M26.5 23 C26.5 15 21 15";
  const droplet = "M 15 30 Q 13.5 32.5";

  it("keeps the defining elements in the shared source of truth", () => {
    const paths = BRAND_MARK_SHAPES.filter((s) => s.tag === "path").map((s) => s.d);
    expect(paths.some((d) => d?.startsWith(dove))).toBe(true);
    expect(paths.some((d) => d?.startsWith(leftStream))).toBe(true);
    expect(paths.some((d) => d?.startsWith(droplet))).toBe(true);
  });

  it("renders the same glyph in the favicon (icon.svg)", () => {
    const svg = readFileSync(join(__dirname, "../app/icon.svg"), "utf8");
    expect(svg).toContain(dove);
    expect(svg).toContain(leftStream);
    expect(svg).toContain(droplet);
    // The old stripped-goblet bowl must not sneak back in as a separate icon.
    expect(svg).not.toContain("M12 21h40c-1 12-9 20-20 20s-19-8-20-20Z");
  });

  it("renders the same glyph in the iOS icon and social card (satori)", () => {
    for (const file of ["apple-icon.tsx", "opengraph-image.tsx"]) {
      const src = readFileSync(join(__dirname, `../app/${file}`), "utf8");
      expect(src, file).toContain("BRAND_MARK_SHAPES");
    }
  });
});
