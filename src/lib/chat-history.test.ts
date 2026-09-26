import { describe, it, expect } from "vitest";
import { mergeChatHistories } from "./chat-history";
import type { ChatMessage } from "@/lib/types";

const u = (c: string): ChatMessage => ({ role: "user", content: c });
const a = (c: string): ChatMessage => ({ role: "assistant", content: c });

describe("mergeChatHistories", () => {
  it("does not duplicate the prior exchange when the client resends full history", () => {
    // Regression: a follow-up turn resends [u1,a1,u2] against stored [u1,a1].
    // The buggy tail-only compare produced [u1,a1,u1,a1,u2].
    const stored = [u("hi"), a("hello")];
    const incoming = [u("hi"), a("hello"), u("next question")];
    expect(mergeChatHistories(stored, incoming)).toEqual([u("hi"), a("hello"), u("next question")]);
  });

  it("treats the client transcript as authoritative when it extends the store", () => {
    const stored = [u("q1"), a("a1")];
    const incoming = [u("q1"), a("a1"), u("q2"), a("a2"), u("q3")];
    expect(mergeChatHistories(stored, incoming)).toEqual(incoming);
  });

  it("returns incoming unchanged for a brand-new first message (empty store)", () => {
    expect(mergeChatHistories([], [u("first")])).toEqual([u("first")]);
  });

  it("preserves legitimate repeated messages in the authoritative path", () => {
    // Same short question asked twice is valid; the prefix path must not dedup it.
    const stored = [u("again"), a("yes")];
    const incoming = [u("again"), a("yes"), u("again")];
    expect(mergeChatHistories(stored, incoming)).toEqual([u("again"), a("yes"), u("again")]);
  });

  it("keeps stored history and appends only new messages on divergence", () => {
    // Client trimmed its context (incoming doesn't start with stored): retain
    // the stored turns, add the genuinely new one, without re-adding duplicates.
    const stored = [u("q1"), a("a1"), u("q2"), a("a2")];
    const incoming = [a("a2"), u("q3")];
    expect(mergeChatHistories(stored, incoming)).toEqual([u("q1"), a("a1"), u("q2"), a("a2"), u("q3")]);
  });
});
