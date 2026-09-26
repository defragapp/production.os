import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The brand is ONE mark — the canonical Ace-of-Cups emblem built from
 * assets/ace-of-cups.jpg by scripts/build-brand-assets.mjs into public/brand/*.png.
 * Every surface (nav logo, tab favicon, iOS icon, social card, PWA manifest) draws
 * from those PNGs. These guards fail if an asset goes missing, if a surface stops
 * referencing the raster emblem, or if the retired hand-drawn SVG brand system
 * (icon.svg / apple-icon.tsx / lib/brand-mark.ts) is resurrected and starts to drift.
 */
const BRAND = join(__dirname, "../../public/brand");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("raster brand assets", () => {
  for (const file of ["emblem-core.png", "emblem-core-bold.png", "icon.png", "apple-icon.png"]) {
    it(`${file} exists and is a valid PNG`, () => {
      const path = join(BRAND, file);
      expect(existsSync(path), path).toBe(true);
      const head = readFileSync(path).subarray(0, 8);
      expect(Buffer.compare(head, PNG)).toBe(0);
    });
  }
});

describe("surfaces reference the raster emblem (single source of truth)", () => {
  const read = (p: string) => readFileSync(join(__dirname, `../app/${p}`), "utf8");

  it("nav/footer logo uses the emboldened emblem", () => {
    const logo = readFileSync(join(__dirname, "../components/ui/logo.tsx"), "utf8");
    expect(logo).toContain("/brand/emblem-core-bold.png");
  });

  it("favicon, iOS icon and social card point at public/brand PNGs", () => {
    const layout = read("layout.tsx");
    expect(layout).toContain("/brand/icon.png");
    expect(layout).toContain("/brand/apple-icon.png");
    const manifest = read("manifest.ts");
    expect(manifest).toContain("/brand/icon.png");
    expect(manifest).toContain("/brand/apple-icon.png");
    const og = read("opengraph-image.tsx");
    // satori can't fetch a runtime URL under Workers, so the OG card inlines the
    // emblem via the generated base64 data-URI module instead of a src path.
    expect(og).toContain("EMBLEM_DATA_URI");
  });

  it("keeps the retired SVG brand system deleted", () => {
    expect(existsSync(join(__dirname, "../app/icon.svg"))).toBe(false);
    expect(existsSync(join(__dirname, "../app/apple-icon.tsx"))).toBe(false);
    expect(existsSync(join(__dirname, "../lib/brand-mark.ts"))).toBe(false);
    expect(existsSync(join(__dirname, "../components/ui/brand-mark.tsx"))).toBe(false);
  });
});
