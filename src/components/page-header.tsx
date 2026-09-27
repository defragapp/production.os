/**
 * Shared page header: optional eyebrow + title + optional description.
 * Used by every authenticated route so headers stay consistent. The brand is
 * already carried by the nav, so the eyebrow is opt-in — pass a real category
 * (not the product name) only when it adds meaning; otherwise the header is a
 * clean serif title.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`mb-8 ${center ? "text-center" : ""}`}>
      {(eyebrow || badge) && (
        <div className={`flex items-center gap-2 mb-2 ${center ? "justify-center" : "justify-start"}`}>
          {eyebrow && (
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              {eyebrow}
            </p>
          )}
          {badge}
        </div>
      )}
      <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p
          className={`mt-2.5 text-sm leading-relaxed text-muted-foreground ${
            center ? "mx-auto max-w-md" : "max-w-xl"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}