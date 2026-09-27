import { describe, expect, it } from "vitest";
import { openingPassage, plainPassage } from "./share-card";

describe("plainPassage", () => {
  it("strips markdown-lite down to readable prose", () => {
    const md = "## Heading\n\nOne **bold** and *italic* and `code` line.\n\n- a bullet\n- another";
    expect(plainPassage(md)).toBe("Heading One bold and italic and code line. a bullet another");
  });

  it("drops links but keeps their labels and removes images entirely", () => {
    expect(plainPassage("See [the docs](https://x.dev) now")).toBe("See the docs now");
    expect(plainPassage("Look ![alt](https://x.dev/a.png) here")).toBe("Look here");
  });
});

describe("openingPassage", () => {
  it("returns a short reply untouched", () => {
    expect(openingPassage("You value being needed.")).toBe("You value being needed.");
  });

  it("breaks a long reply at a sentence boundary, never mid-word", () => {
    const sentence = "This is a complete sentence that carries one idea. ";
    const long = sentence.repeat(12); // well past the 260-char default
    const out = openingPassage(long);
    expect(out.length).toBeLessThanOrEqual(260);
    expect(out.endsWith(".")).toBe(true);
    expect(out).not.toContain("…");
  });

  it("ellipsizes when there is no clean sentence boundary near the limit", () => {
    const noStops = "word ".repeat(120);
    const out = openingPassage(noStops, 60);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(61);
  });
});
