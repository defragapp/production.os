import { describe, it, expect } from "vitest";
import { bufToB64url, b64urlToBuf } from "./base64url";

describe("base64url helpers (passkeys)", () => {
  it("round-trips arbitrary bytes without padding or url-unsafe chars", () => {
    // Include bytes that force '+' and '/' in standard base64 (0xfb, 0xff)
    // and a length that needs '==' padding.
    const bytes = new Uint8Array([0x00, 0xff, 0xfb, 0x10, 0x7f, 0xfe, 0x01]);
    const encoded = bufToB64url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    const decoded = b64urlToBuf(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it("handles empty input", () => {
    expect(bufToB64url(new Uint8Array([]))).toBe("");
    expect(Array.from(b64urlToBuf(""))).toEqual([]);
  });

  it("returns a plain ArrayBuffer-backed Uint8Array", () => {
    const out = b64urlToBuf("aGVsbG8"); // "hello"
    expect(out.buffer).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(out)).toEqual([104, 101, 108, 108, 111]);
  });
});
