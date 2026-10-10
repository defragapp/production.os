import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Answer feedback (WS3, docs/ai-improvement-plan.md) — source contracts.
 *
 * The route and the control are surface code that the plain Vitest harness does
 * not boot (no alias resolution, no NextRequest/D1), so — following the repo's
 * precedent (`chat-recall-contract.test.ts`, `contrast-floors-and-register.test.ts`)
 * — these pin the load-bearing invariants against the source:
 *
 *   1. The D1 table is content-free and byte-identical in schema.sql and the
 *      migration, so a fresh local D1 and a migrated remote one agree.
 *   2. The route is user-scoped, upserts on (user, thread, turn), and refuses to
 *      write for a zero-retention (`memory_mode='local'`) account.
 *   3. The control is server-memory only, offered on the newest finished answer,
 *      and carries the sanctioned `tap-line` hook rather than a hand-written size.
 */
const root = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const CREATESTART = "CREATE TABLE IF NOT EXISTS answer_feedback";
const CREATEND = "ON answer_feedback(value, created_at);";
function createBlock(src: string): string {
  const start = src.indexOf(CREATESTART);
  const end = src.indexOf(CREATEND, start);
  expect(start, "answer_feedback CREATE block present").toBeGreaterThan(-1);
  expect(end, "answer_feedback index present").toBeGreaterThan(-1);
  return src.slice(start, end + CREATEND.length);
}

describe("answer_feedback table (D1)", () => {
  const schema = read("schema.sql");
  const migration = read("migrations/0009_answer_feedback.sql");

  it("schema.sql and the migration declare a byte-identical table block", () => {
    expect(createBlock(schema)).toBe(createBlock(migration));
  });

  it("is content-free — an enum per (person, thread, turn), never answer text", () => {
    const block = createBlock(schema);
    expect(block).toContain("value       TEXT    NOT NULL");
    expect(block).toContain("PRIMARY KEY (user_id, thread_id, turn_index)");
    // No column could echo the conversation: no content/snippet/text/answer.
    expect(block).not.toMatch(/\b(content|snippet|answer_text|message)\b/i);
  });

  it("cascades with the account but keeps no FK on the thread", () => {
    const block = createBlock(schema);
    expect(block).toContain("REFERENCES users(id) ON DELETE CASCADE");
    expect(block).not.toMatch(/thread_id\s+TEXT\s+NOT NULL\s+REFERENCES/);
  });
});

describe("POST /api/chat/feedback", () => {
  const route = read("src/app/api/chat/feedback/route.ts");

  it("writes one row per (person, thread, turn) and replaces on a change of mind", () => {
    expect(route).toContain("INSERT INTO answer_feedback (user_id, thread_id, turn_index, value)");
    expect(route).toContain("ON CONFLICT (user_id, thread_id, turn_index) DO UPDATE SET value = excluded.value");
  });

  it("is user-scoped and verifies thread ownership", () => {
    expect(route).toMatch(/WHERE id = \? AND user_id = \?/);
    expect(route).toContain("Unknown thread");
  });

  it("honours the zero-retention contract for memory_mode='local'", () => {
    expect(route).toContain("memory_mode");
    expect(route).toMatch(/memory_mode === "local"[\s\S]*?stored: false/);
  });

  it("validates the enum and bounds the inputs", () => {
    expect(route).toContain('FEEDBACK_VALUES = new Set(["landed", "missed"])');
    expect(route).toContain("MAX_TURN_INDEX");
    expect(route).toContain("rl:chat-feedback:");
  });
});

describe("the chat control (chat-client.tsx)", () => {
  const chat = read("src/app/chat/chat-client.tsx");

  it("posts the enum to the feedback endpoint from a single callback", () => {
    expect(chat).toContain('fetch("/api/chat/feedback"');
    expect(chat).toMatch(/JSON\.stringify\(\{ threadId, turnIndex, value \}\)/);
  });

  it("is offered only to a server-memory account, never a Device-Only one", () => {
    expect(chat).toMatch(/memoryMode === "server" && threadId/);
    expect(chat).toContain('memoryMode !== "server"');
  });

  it("appears on the newest finished answer only, and uses the tap floor hook", () => {
    // The gate includes `isLast`, and the control carries `tap-line`, not a
    // hand-written min-h — the size floor lives in the one coarse block.
    // Anchor on the visible span so the earlier prose (the sendFeedback comment,
    // which also says "Did this land?") can never satisfy this vacuously.
    const anchor = chat.indexOf(">Did this land?</span>");
    expect(anchor, "the visible feedback question renders").toBeGreaterThan(-1);
    const gate = chat.slice(anchor - 700, anchor);
    expect(gate).toContain("isLast");
    const control = chat.slice(anchor, anchor + 1400);
    expect(control).toContain("tap-line");
    expect(control).not.toMatch(/min-h-\[/);
  });
});
