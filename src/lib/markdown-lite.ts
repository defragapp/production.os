/**
 * Markdown-lite for AI chat answers.
 *
 * The model writes lightweight markdown (`**bold**`, `- `/`* ` bullet lists).
 * Rendering it as plain text leaks raw asterisks into the UI; rendering real
 * markdown with an HTML library is heavyweight and an XSS surface. This module
 * tokenizes the tiny subset we actually use into plain React-renderable data —
 * no `dangerouslySetInnerHTML`, no third-party parser.
 */

export type InlineToken = { type: "text" | "bold"; value: string };

/** Split a line into text/bold tokens on `**...**` runs. */
export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const rx = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) });
    tokens.push({ type: "bold", value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

/** A line is a bullet if it starts with `-`, `*`, or `•` followed by whitespace. */
export function isBulletLine(line: string): boolean {
  return /^\s*[-*•]\s+/.test(line);
}

export function stripBulletMarker(line: string): string {
  return line.replace(/^\s*[-*•]\s+/, "");
}

export type Block = { kind: "list"; items: string[] } | { kind: "para"; text: string };

/**
 * Break text into blocks separated by blank lines. A block whose every line is
 * a bullet becomes a list; everything else stays a paragraph (single newlines
 * are preserved by the renderer via whitespace-pre-wrap).
 */
export function splitBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.split(/\n{2,}/)) {
    const block = raw.replace(/\s+$/, "");
    if (!block.trim()) continue;
    const lines = block.split("\n");
    if (lines.length > 0 && lines.every(isBulletLine)) {
      out.push({ kind: "list", items: lines.map(stripBulletMarker) });
    } else {
      out.push({ kind: "para", text: block });
    }
  }
  return out;
}
