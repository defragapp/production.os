/**
 * Peer-identity sanitisation for the reasoning prompt (finding F-G).
 *
 * A consented peer's display name and the relationship label are both
 * user-authored free text stored in D1 (`users.display_name`,
 * `relationships.a_label`/`b_label`). When one person's peer enters ANOTHER
 * person's reasoning context, that text is interpolated into the system prompt
 * composed for the model. Without delimiting, a peer could name themselves
 * something that breaks out of the framing the renderer applies — a newline
 * that forges a new `## SECTION` heading, a stray quote or bracket that mimics
 * the prompt's own markers — i.e. context poisoning.
 *
 * This is a hard, deterministic scrub, not a blocklist of "bad words": it removes
 * the *structural* characters the prompt itself uses (line breaks, section-heading
 * hashes, list/quote brackets, angle and backtick markup) and collapses remaining
 * whitespace to single spaces. Legitimate names and labels ("Alex", "best friend",
 * "Mom —" with an em-dash) are preserved verbatim. It carries no birth data and
 * never runs on the self (requester's own) framing text.
 *
 * Dependency-free on purpose (mirrors ./invite-status) so it is unit-testable in
 * isolation and importable from both the consent builder and the prompt renderer
 * without pulling next/server into the reasoning module's graph.
 */

// Framing/breakout characters stripped from a peer-controlled identity string:
// ASCII double/single quotes, markdown/code and section markers (# ` [ ] < >),
// and ASCII control characters. Unicode typographic marks (— ’ “) are kept.
const IDENTITY_BREAKOUT_CHARS = /["'`#\[\]<>]/g;
const IDENTITY_CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Max length that reaches the prompt; matches the UI label cap in normalizedLabel. */
export const PEER_IDENTITY_MAX_LEN = 40;

/**
 * Neutralise a peer-controlled identity string (display name or relationship
 * label) so it cannot break out of the framing it is rendered inside. Returns
 * `fallback` when nothing legible survives.
 */
export function sanitizePeerIdentity(
  value: string | null | undefined,
  fallback = "connected person",
): string {
  const cleaned = (value ?? "")
    .replace(IDENTITY_CONTROL_CHARS, " ")
    .replace(IDENTITY_BREAKOUT_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PEER_IDENTITY_MAX_LEN)
    .trim();
  return cleaned || fallback;
}
