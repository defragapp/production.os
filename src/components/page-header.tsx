/**
 * Shared page header: eyebrow + title + optional description.
 * Used by every authenticated route so headers stay consistent.
 */
export function PageHeader({
  eyebrow = "Sovereign OS",
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
      <div className={`flex items-center gap-2 mb-2 ${center ? "justify-center" : "justify-start"}`}>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
          {eyebrow}
        </p>
        {badge}
      </div>
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