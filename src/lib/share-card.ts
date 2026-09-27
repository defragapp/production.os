/**
 * Pure text helpers behind the "What Sovereign saw" share card. Kept free of
 * React and browser APIs so the passage-extraction rules can be unit-tested
 * and reused. The canvas drawing lives in the client component.
 */

// Strip the markdown-lite Sovereign emits down to a readable passage.
export function plainPassage(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// The opening passage — a clean sentence boundary near the limit, never a
// mid-word cut. Long replies collapse to a pull-quote a card can carry.
export function openingPassage(text: string, max = 260): string {
  const plain = plainPassage(text);
  if (plain.length <= max) return plain;
  const slice = plain.slice(0, max);
  const stop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (stop > 100) return slice.slice(0, stop + 1);
  const space = slice.lastIndexOf(" ");
  return `${slice.slice(0, space < 0 ? max : space).trimEnd()}…`;
}
