/**
 * The Intent Sigil as a React component. It embeds the exact SVG string the
 * OpenGraph card uses, so the crest is pixel-identical across surfaces. The
 * markup is fully deterministic and contains no user content (the signer's name
 * never enters the SVG), so injecting it is safe and adds zero layout shift —
 * the box is a fixed square and the drawing is `aria-hidden` decoration.
 */
import { sigilGeometry, renderSigilSvg } from "@/lib/sigil";

export function Sigil({
  seed,
  intentId,
  size = 40,
  className,
  title,
}: {
  seed: number;
  intentId: string;
  size?: number;
  className?: string;
  /** Optional accessible label; when omitted the Sigil is pure decoration. */
  title?: string;
}) {
  const markup = renderSigilSvg(sigilGeometry(seed, intentId), size);
  const labelled = Boolean(title);
  return (
    <span
      className={className}
      style={{ display: "inline-flex", width: size, height: size, lineHeight: 0 }}
      role={labelled ? "img" : undefined}
      aria-label={title}
      aria-hidden={labelled ? undefined : "true"}
      // Deterministic, dependency-free SVG produced entirely by sigil.ts.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
