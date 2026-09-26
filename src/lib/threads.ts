import type { ChatMessage } from "./types";

/**
 * Merge a saved thread history with the full message list the client posts on
 * each save. Clients send the whole conversation every time, so the incoming
 * list normally starts with everything already stored: find how much of the
 * stored history the incoming list repeats from the front and append only what
 * comes after it. A client that sends only the new tail still works (zero
 * prefix overlap → append-everything with tail dedupe). Comparing only against
 * the last stored message re-appends the entire prior conversation on every
 * save once there are two or more turns — the duplication bug this prevents.
 */
export function mergeThreadHistory(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  let prefix = 0;
  while (prefix < existing.length && prefix < incoming.length
    && existing[prefix].role === incoming[prefix].role
    && existing[prefix].content === incoming[prefix].content) {
    prefix += 1;
  }
  // Incoming re-posts the stored history from the front: it is the full
  // conversation (or an edit of it), so it wins wholesale (tail dedupe still
  // guards double taps). If it re-posts a prefix but then diverges while the
  // thread holds more turns, trust the stored history and append nothing —
  // mutation of already-saved turns is not a shape the product produces.
  if (prefix > 0) {
    if (incoming.length < existing.length) return existing;
    const merged: ChatMessage[] = [];
    for (const msg of incoming) {
      const last = merged[merged.length - 1];
      if (last && last.role === msg.role && last.content === msg.content) continue;
      merged.push(msg);
    }
    return merged;
  }
  // Otherwise treat incoming as an extension: append onto the stored history,
  // never truncating it.
  const merged = [...existing];
  for (const msg of incoming) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role && last.content === msg.content) continue;
    merged.push(msg);
  }
  return merged;
}
