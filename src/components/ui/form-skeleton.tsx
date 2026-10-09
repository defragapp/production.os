import { Card, CardContent } from "@/components/ui/card";

/**
 * A static stand-in for the auth / invitation card while the client resolves
 * the session and the query string.
 *
 * These pages can't read the query string or the session during SSR, so they
 * used to paint a bare "Loading…" / spinner that was then swapped for a full
 * card — a visible first-paint jump (and on /invite, a real layout shift when
 * the card appeared under a lone heading). This reserves the finished shape on
 * the server: a titled card with field bars, so the arrival of the real form is
 * a fade, not a reflow.
 *
 * Purely decorative — empty bars, no data, no motion. Fills use the `surface-2`
 * token and the 12px `rounded-panel` radius so the skeleton matches a real
 * input. The `sr-only` label keeps it announced for assistive tech without
 * painting a spinner.
 */
export function FormSkeleton({
  fields = 2,
  action = true,
  label = "Loading…",
}: {
  /** Number of label + input bars to reserve (default 2 — email + password). */
  fields?: number;
  /** Reserve a full-width primary action bar at the bottom (default on). */
  action?: boolean;
  /** Screen-reader text for the resolving state. */
  label?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2" aria-hidden="true">
            <div className="h-3 w-20 rounded bg-surface-2" />
            <div className="h-11 w-full rounded-panel border border-border/60 bg-surface-2" />
          </div>
        ))}
        {action && <div className="h-11 w-full rounded-panel bg-surface-2" aria-hidden="true" />}
        <span className="sr-only">{label}</span>
      </CardContent>
    </Card>
  );
}
