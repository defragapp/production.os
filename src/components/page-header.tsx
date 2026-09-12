/**
 * Shared page header: eyebrow + title + optional description.
 * Used by every authenticated route so headers stay consistent.
 */
export function PageHeader({
  eyebrow = "Sovereign OS",
  title,
  description,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  center?: boolean;
}) {
  return (
    <div className={`mb-8 ${center ? "text-center" : ""}`}>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        {title}
      </h1>
      {description && (
        <p
          className={`mt-2 text-sm leading-relaxed text-muted-foreground ${
            center ? "mx-auto max-w-md" : "max-w-xl"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}