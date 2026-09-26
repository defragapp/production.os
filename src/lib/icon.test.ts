import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The favicon/PWA icon is served as a raw .svg file, so it must be valid XML —
 * a regression that broke the manifest icon in production when JSX authoring
 * syntax (comment braces, camelCase attrs, raw `&`) leaked into the file.
 */
describe("app icon.svg", () => {
  const svg = readFileSync(join(__dirname, "../app/icon.svg"), "utf8");

  it("is a plain SVG root with an explicit size", () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/width="\d+"/);
    expect(svg).toMatch(/height="\d+"/);
  });

  it("contains no JSX authoring syntax", () => {
    expect(svg).not.toContain("{/*");
    expect(svg).not.toMatch(/strokeWidth|strokeLinecap|strokeLinejoin/);
  });

  it("has no unescaped ampersands outside entity references", () => {
    const stray = svg.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);
    expect(stray).toBeNull();
  });
});
