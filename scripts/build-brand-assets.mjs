// Generates the Sovereign OS brand mark assets from the canonical Ace-of-Cups
// line-art source (assets/ace-of-cups.jpg) into public/brand/*.png.
//
// The source is white line-art on a transparent (checkerboard) background, so we
// isolate the bright line cores by thresholding and use them as an alpha channel.
// Everything downstream draws from these outputs — there is exactly ONE mark, the
// same engraving, just rendered at the weight each surface needs:
//   • emblem-core.png        — detailed full-res crop  → iOS icon, social card
//   • emblem-core-bold.png   — bold small render       → nav logo, tab favicon
// A detailed hairline engraving collapses into a gray smudge when a browser
// crushes it to 24–48px, so the small surfaces get a purpose-built render: the
// SAME art downscaled to a working size (where fine filigree fuses into solid
// forms) then morphologically thickened — emboldening, never a redraw.
//
// Run: node scripts/build-brand-assets.mjs   (re-run any time the source changes)
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const SRC = "assets/ace-of-cups.jpg";
const OUT = "public/brand";
const CREAM = { r: 244, g: 244, b: 245 };
const PLATE = "#0d0d0d";
// 200 (not the old 225) keeps more of each line's bright core, so strokes come
// out solid and high-contrast instead of thin and faint.
const THRESHOLD = 200;

mkdirSync(OUT, { recursive: true });

// Isolate near-white line pixels -> transparent cream glyph.
async function extract(threshold = THRESHOLD) {
  const md = await sharp(SRC).metadata();
  const mask = await sharp(SRC).greyscale().threshold(threshold).raw().toBuffer();
  const rgba = Buffer.alloc(md.width * md.height * 4);
  for (let i = 0; i < md.width * md.height; i++) {
    rgba[i * 4] = CREAM.r;
    rgba[i * 4 + 1] = CREAM.g;
    rgba[i * 4 + 2] = CREAM.b;
    rgba[i * 4 + 3] = mask[i];
  }
  return { data: rgba, width: md.width, height: md.height };
}

// Morphological dilation of the alpha channel (thicken lines).
function dilate(rgba, width, height, iterations = 1) {
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) alpha[i] = rgba[i * 4 + 3];
  let a = alpha;
  const out = new Uint8Array(a.length);
  for (let it = 0; it < iterations; it++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let m = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) m = Math.max(m, a[ny * width + nx]);
          }
        }
        out[y * width + x] = m;
      }
    }
    a = Uint8Array.from(out);
  }
  const res = Buffer.from(rgba);
  for (let i = 0; i < a.length; i++) res[i * 4 + 3] = a[i];
  return res;
}

const { data, width, height } = await extract();
const full = await sharp(data, { raw: { width, height, channels: 4 } }).trim().png().toBuffer();
const fm = await sharp(full).metadata();

// Core crop: dove + cross + chalice bowl (top ~55%) — the compact, recognizable
// subject. Kept at full detail for the large surfaces (iOS icon, social card).
const core = await sharp(full).extract({ left: 0, top: 0, width: fm.width, height: Math.round(fm.height * 0.55) }).trim().png().toBuffer();

// Bold small render for the nav + favicon: downscale the SAME crop to a working
// height where the hairline filigree fuses into solid forms, then thicken the
// lines so the dove+chalice silhouette actually reads at 24–48px.
const WORK_H = 200;
const cm = await sharp(core).metadata();
const workW = Math.round((cm.width * WORK_H) / cm.height);
const boldRaw = await sharp(core).resize(workW, WORK_H).ensureAlpha().raw().toBuffer();
const bold = await sharp(dilate(boldRaw, workW, WORK_H, 2), { raw: { width: workW, height: WORK_H, channels: 4 } }).png().toBuffer();
const bm = await sharp(bold).metadata();

// Center a glyph on a square graphite plate (favicon / iOS icon). The glyph is
// scaled to fit the plate; its own whitespace provides the breathing room.
async function plate(glyph, size) {
  const g = await sharp(glyph).resize(size, size, { fit: "inside" }).png().toBuffer();
  const gm = await sharp(g).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: PLATE } })
    .composite([{ input: g, top: Math.round((size - gm.height) / 2), left: Math.round((size - gm.width) / 2) }])
    .png().toBuffer();
}

await sharp(full).toFile(`${OUT}/emblem-full.png`);
await sharp(core).toFile(`${OUT}/emblem-core.png`);
await sharp(bold).toFile(`${OUT}/emblem-core-bold.png`);
// Favicon (64px) wants the bold render; the iOS icon (180px) has room for detail.
await sharp(await plate(bold, 64)).toFile(`${OUT}/icon.png`);
await sharp(await plate(core, 180)).toFile(`${OUT}/apple-icon.png`);

// The social card is rendered by satori at request time, which cannot fetch a
// runtime asset URL under the Workers/OpenNext runtime (it silently drops the
// <img>). So embed the emblem as a base64 data URI in a committed module that
// opengraph-image.tsx imports — still ONE mark, just inlined for the OG route.
// The card shows the mark large, so it uses the DETAILED crop, not the bold
// small render (which would upscale soft).
const ogPng = await sharp(core).resize({ height: 460 }).png().toBuffer();
const ogDataUri = `data:image/png;base64,${ogPng.toString("base64")}`;
writeFileSync(
  "src/lib/brand-emblem-data.ts",
  `// GENERATED by scripts/build-brand-assets.mjs — do not edit by hand.\n` +
    `// The canonical Ace-of-Cups emblem (detailed core) as a base64 data URI,\n` +
    `// embedded so the satori social card can render it without a runtime fetch.\n` +
    `export const EMBLEM_DATA_URI =\n  "${ogDataUri}";\n`,
);

console.log("built:", { full: fm, core: cm, bold: bm });
console.log("wrote public/brand/{emblem-full,emblem-core,emblem-core-bold,icon,apple-icon}.png + src/lib/brand-emblem-data.ts");
