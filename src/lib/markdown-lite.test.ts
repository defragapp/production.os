import { describe, it, expect } from "vitest";
import { tokenizeInline, isBulletLine, stripBulletMarker, splitBlocks } from "./markdown-lite";

describe("tokenizeInline", () => {
  it("splits bold runs into tokens", () => {
    expect(tokenizeInline("hello **world** end")).toEqual([
      { type: "text", value: "hello " },
      { type: "bold", value: "world" },
      { type: "text", value: " end" },
    ]);
  });
  it("leaves plain text as one token", () => {
    expect(tokenizeInline("just words")).toEqual([{ type: "text", value: "just words" }]);
  });
  it("handles multiple bold runs", () => {
    const t = tokenizeInline("**a** and **b**");
    expect(t).toEqual([
      { type: "bold", value: "a" },
      { type: "text", value: " and " },
      { type: "bold", value: "b" },
    ]);
  });
  it("tokenizes single-asterisk italics", () => {
    expect(tokenizeInline("It ends with *a question?*")).toEqual([
      { type: "text", value: "It ends with " },
      { type: "italic", value: "a question?" },
    ]);
  });
  it("prefers bold over italic on ** runs", () => {
    const t = tokenizeInline("**both** then *emphasis*");
    expect(t).toEqual([
      { type: "bold", value: "both" },
      { type: "text", value: " then " },
      { type: "italic", value: "emphasis" },
    ]);
  });
  it("leaves spaced asterisks (arithmetic) as plain text", () => {
    expect(tokenizeInline("2 * 3 * 4")).toEqual([{ type: "text", value: "2 * 3 * 4" }]);
  });
  it("leaves a lone unmatched asterisk as plain text", () => {
    expect(tokenizeInline("a * b")).toEqual([{ type: "text", value: "a * b" }]);
  });
});

describe("isBulletLine / stripBulletMarker", () => {
  it("recognizes -, *, and • markers requiring whitespace", () => {
    expect(isBulletLine("- item")).toBe(true);
    expect(isBulletLine("* item")).toBe(true);
    expect(isBulletLine("• item")).toBe(true);
    expect(isBulletLine("  - indented")).toBe(true);
    expect(isBulletLine("plain line")).toBe(false);
    expect(isBulletLine("*not a bullet")).toBe(false);
  });
  it("strips the marker", () => {
    expect(stripBulletMarker("- item")).toBe("item");
    expect(stripBulletMarker("*  spaced")).toBe("spaced");
  });
});

describe("splitBlocks", () => {
  it("groups consecutive bullet lines into a list", () => {
    const blocks = splitBlocks("- one\n- two\n- three");
    expect(blocks).toEqual([{ kind: "list", items: ["one", "two", "three"] }]);
  });
  it("separates a paragraph and a list by a blank line", () => {
    const blocks = splitBlocks("Intro line\n\n- a\n- b");
    expect(blocks).toEqual([
      { kind: "para", text: "Intro line" },
      { kind: "list", items: ["a", "b"] },
    ]);
  });
  it("treats a mixed block as a paragraph", () => {
    const blocks = splitBlocks("- a\nnot a bullet");
    expect(blocks).toEqual([{ kind: "para", text: "- a\nnot a bullet" }]);
  });
  it("drops trailing whitespace and empty blocks", () => {
    expect(splitBlocks("hi  \n\n  \n")).toEqual([{ kind: "para", text: "hi" }]);
  });
});
