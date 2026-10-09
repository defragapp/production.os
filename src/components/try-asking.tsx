/**
 * A quiet, surface-specific example question for the lens pages (/self,
 * /people, /systems). Each lens shows the kind of question it is actually for —
 * the "start with the question you already have" entry point — without
 * pretending to be a second interactive surface. The CTA below still owns the
 * click; this stays descriptive, and it never claims the example is the only
 * way to ask.
 */
export function TryAsking({ question }: { question: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(38_45%_75%)]">Try asking</p>
      <p className="mt-2 font-display text-lg italic leading-snug text-foreground/90 md:text-xl">“{question}”</p>
      <p className="mt-2 text-xs text-muted-foreground/80">
        The kind of question this lens is for — your own words will be better than mine.
      </p>
    </div>
  );
}