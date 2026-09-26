import * as React from "react";

/**
 * Section — an airy titled group used in place of a bordered <Card> when the
 * content is informational rather than an interactive/selected surface. It
 * keeps the platform's editorial rhythm (display title + muted description +
 * a fading `.section-rule` divider) without the "everything is a box" look,
 * matching the landing page's panel system.
 *
 * Drop-in replacement for the `<Card><CardHeader><CardTitle/><CardDescription/>
 * </CardHeader><CardContent>…</CardContent></Card>` pattern: pass the old title
 * and description as props and the old CardContent children as `children`.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  rule = true,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Render the fading divider under the section (default on). */
  rule?: boolean;
}) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section className={className}>
      {hasHeader && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-xl font-normal tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
      {rule && <div className="section-rule mt-8" aria-hidden="true" />}
    </section>
  );
}
