import type { ChatMessage } from "@/lib/types";

/**
 * Merge a stored thread history with the client's cumulative message list.
 *
 * The chat client resends the ENTIRE visible transcript on every turn, so a
 * follow-up request looks like `[...stored, newMessage]`. When the stored
 * history is a prefix of what the client sends, the client's list is already
 * authoritative — we return it verbatim.
 *
 * A previous implementation compared each incoming message only against the
 * single last merged entry. That failed the common case: re-sent messages from
 * the *start* of the transcript never matched the stored *tail*, so the whole
 * prior exchange was re-appended on every turn (u1,a1 → u1,a1,u1,a1,u2,a2),
 * corrupting persisted threads. This version is correct and idempotent.
 *
 * The fallback path only runs when the client's transcript has genuinely
 * diverged from (or been trimmed relative to) the stored history — e.g. a
 * stale tab or context truncation — where we keep everything stored and append
 * only the incoming messages we don't already have.
 */
export function mergeChatHistories(base: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (startsWith(base, incoming)) return [...incoming];

  const merged: ChatMessage[] = [...base];
  for (const msg of incoming) {
    if (merged.some((m) => m.role === msg.role && m.content === msg.content)) continue;
    merged.push(msg);
  }
  return merged;
}

/** True when every entry of `prefix` appears at the head of `list` (role + content). */
function startsWith(prefix: ChatMessage[], list: ChatMessage[]): boolean {
  if (prefix.length > list.length) return false;
  return prefix.every((m, i) => list[i].role === m.role && list[i].content === m.content);
}
