import { describe, it, expect } from "vitest";
import { ownerNotFound } from "./owner";

describe("ownerNotFound", () => {
  it("is the single, indistinguishable 404 refusal", async () => {
    const res = ownerNotFound();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  it("never varies by caller — a non-owner cannot tell the surface exists", async () => {
    const a = await ownerNotFound().json();
    const b = await ownerNotFound().json();
    expect(a).toEqual(b);
    // Same bytes an unknown path returns, so the owner routes are not enumerable.
    expect(JSON.stringify(a)).toBe('{"error":"Not Found"}');
  });
});
