import { describe, it, expect } from "vitest";
import { mergeThreadHistory } from "./threads";
import type { ChatMessage } from "./types";

const m = (role: ChatMessage["role"], content: string): ChatMessage => ({ role, content });

describe("mergeThreadHistory", () => {
  it("appends only the new turn when the client re-posts the full conversation", () => {
    // Live bug: second save posted [u1,a1,u2,a2] onto stored [u1,a1] and the
    // old last-message-only dedupe re-appended u1/a1, duplicating turn one.
    const existing = [m("user", "q1"), m("assistant", "a1")];
    const incoming = [m("user", "q1"), m("assistant", "a1"), m("user", "q2"), m("assistant", "a2")];
    expect(mergeThreadHistory(existing, incoming)).toEqual(incoming);
  });

  it("is idempotent when the same full list is posted twice", () => {
    const list = [m("user", "q1"), m("assistant", "a1")];
    expect(mergeThreadHistory(list, list)).toEqual(list);
    expect(mergeThreadHistory(mergeThreadHistory(list, list), list)).toEqual(list);
  });

  it("still appends a tail-only payload with no prefix overlap", () => {
    const existing = [m("user", "q1"), m("assistant", "a1")];
    const tail = [m("user", "q2"), m("assistant", "a2")];
    expect(mergeThreadHistory(existing, tail)).toEqual([...existing, ...tail]);
  });

  it("keeps stored history intact when a re-posted prefix then diverges short", () => {
    // Malformed shape (client rewriting saved turns): refuse to mutate or truncate.
    const existing = [m("user", "q1"), m("assistant", "a1"), m("user", "q2")];
    const incoming = [m("user", "q1"), m("assistant", "CHANGED")];
    expect(mergeThreadHistory(existing, incoming)).toEqual(existing);
  });

  it("dedupes consecutive identical messages regardless of position", () => {
    const existing = [m("user", "q1")];
    const incoming = [m("user", "q1")];
    expect(mergeThreadHistory(existing, incoming)).toEqual(existing);
  });

  it("handles an empty stored thread (first save)", () => {
    const incoming = [m("user", "q1"), m("assistant", "a1")];
    expect(mergeThreadHistory([], incoming)).toEqual(incoming);
  });

  it("keeps legitimate repeats of the same content at different points", () => {
    const existing = [m("user", "ok"), m("assistant", "sure"), m("user", "ok")];
    const incoming = [...existing, m("assistant", "still here")];
    expect(mergeThreadHistory(existing, incoming)).toEqual(incoming);
  });
});
