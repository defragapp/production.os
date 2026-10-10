import { TESTIMONIALS } from "@/content/testimonials";

/**
 * Renders nothing until real quotes exist in src/content/testimonials.ts.
 * The absence is intentional — see the header of that file for why we would
 * rather show a bare landing than invent social proof. Once the array has
 * entries, this section slots between "Between two people" and "Plans" on
 * the landing, matching the surrounding typographic rhythm (SectionCrown
 * pattern: eyebrow + display heading + deck).
 */
export function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-muted/20 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
          In their words
        </p>
        <h2 className="mb-10 text-center font-display text-[1.75rem] font-normal tracking-tight text-foreground md:text-4xl">
          What people say when it <span className="italic">lands</span>.
        </h2>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <li
              key={`${t.name}-${t.quote.slice(0, 24)}`}
              className="glass-panel card-lift flex flex-col justify-between gap-5 p-6"
            >
              <blockquote className="font-display text-[1.05rem] leading-relaxed tracking-tight text-foreground md:text-lg">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <footer className="text-sm">
                <p className="font-semibold text-foreground">{t.name}</p>
                {t.role && <p className="text-muted-foreground">{t.role}</p>}
                {t.source && (
                  <a
                    href={t.source}
                    className="tap-line mt-1 inline-block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Source →
                  </a>
                )}
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
