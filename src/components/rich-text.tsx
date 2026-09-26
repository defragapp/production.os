import { tokenizeInline, splitBlocks } from "@/lib/markdown-lite";

function renderInline(text: string) {
  return tokenizeInline(text).map((t, i) =>
    t.type === "bold" ? (
      <strong key={i} className="font-semibold text-foreground">{t.value}</strong>
    ) : (
      <span key={i}>{t.value}</span>
    ),
  );
}

/**
 * Renders an AI answer's lightweight markdown (bold runs + bullet lists) as
 * styled text without any HTML injection. Plain prose falls through untouched.
 */
export function RichText({ text }: { text: string }) {
  const blocks = splitBlocks(text);
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) =>
        b.kind === "list" ? (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
            {b.items.map((item, j) => (
              <li key={j} className="leading-relaxed">{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">{renderInline(b.text)}</p>
        ),
      )}
    </div>
  );
}
