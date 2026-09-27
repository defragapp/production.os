import { tokenizeInline, splitBlocks } from "@/lib/markdown-lite";

function renderInline(text: string) {
  return tokenizeInline(text).map((t, i) =>
    t.type === "bold" ? (
      <strong key={i} className="font-semibold text-foreground">{t.value}</strong>
    ) : t.type === "italic" ? (
      /* The brand's assistant voice: Sovereign's italic emphasis — most often
         its closing question — sets in Instrument Serif, same as the hero. */
      <em key={i} className="font-display text-[1.075em] italic">{t.value}</em>
    ) : (
      <span key={i}>{t.value}</span>
    ),
  );
}

/**
 * Renders an AI answer's lightweight markdown (bold + italic runs, bullet
 * lists) as styled text without any HTML injection. Plain prose falls through
 * untouched.
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
